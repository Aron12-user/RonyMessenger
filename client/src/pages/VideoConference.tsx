import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2,
  Maximize2, Minimize2, X, Crown, Settings, MessageSquare,
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  isAdmin: boolean;
  isMuted: boolean;
  hasVideo: boolean;
}

const VideoConference: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // États
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Contrôles
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  
  const roomCode = params?.roomCode;

  // Configuration WebRTC optimisée
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  // Initialisation des médias
  const initializeMedia = useCallback(async () => {
    try {
      console.log('Initialisation média...');
      
      // Essayer vidéo + audio d'abord
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
      } catch (audioError) {
        // Fallback: vidéo seulement
        console.log('Audio indisponible, vidéo seulement');
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30, max: 60 }
          }
        });
        setIsMuted(true);
        toast({
          title: "Microphone indisponible",
          description: "Mode vidéo seulement activé"
        });
      }

      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      console.log('Média initialisé:', stream.getTracks().map(t => `${t.kind}: ${t.label}`));
      return stream;
    } catch (error: any) {
      console.error('Erreur média:', error);
      let message = 'Impossible d\'accéder à la caméra';
      
      if (error.name === 'NotAllowedError') {
        message = 'Accès caméra refusé. Autorisez l\'accès dans votre navigateur.';
      } else if (error.name === 'NotFoundError') {
        message = 'Aucune caméra détectée sur cet appareil.';
      } else if (error.name === 'NotReadableError') {
        message = 'Caméra utilisée par une autre application.';
      }
      
      setErrorMsg(message);
      throw error;
    }
  }, [toast]);

  // Connexion WebSocket
  const connectWebSocket = useCallback(() => {
    if (!roomCode) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    console.log('Connexion WebSocket:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connecté');
      setStatus('ready');
      
      // Envoyer informations utilisateur
      wsRef.current?.send(JSON.stringify({
        type: 'user-info',
        info: {
          name: authUser?.displayName || authUser?.username || 'Utilisateur',
          isAdmin: false
        }
      }));
    };
    
    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Message reçu:', data.type);
        
        switch (data.type) {
          case 'user-joined':
            await handleUserJoined(data.userId, data.userInfo);
            break;
          case 'user-left':
            handleUserLeft(data.userId);
            break;
          case 'offer':
            await handleOffer(data.userId, data.offer);
            break;
          case 'answer':
            await handleAnswer(data.userId, data.answer);
            break;
          case 'ice-candidate':
            await handleIceCandidate(data.userId, data.candidate);
            break;
          case 'participant-update':
            updateParticipant(data.userId, data.updates);
            break;
        }
      } catch (error) {
        console.error('Erreur traitement message:', error);
      }
    };
    
    wsRef.current.onclose = () => {
      console.log('WebSocket fermé');
      setStatus('error');
      setErrorMsg('Connexion perdue');
    };
    
    wsRef.current.onerror = () => {
      console.log('Erreur WebSocket');
      setStatus('error');
      setErrorMsg('Erreur de connexion');
    };
  }, [roomCode, authUser]);

  // Créer une connexion peer
  const createPeerConnection = useCallback((participantId: string) => {
    const pc = new RTCPeerConnection(rtcConfig);
    
    // Ajouter le flux local
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Gérer le flux distant
    pc.ontrack = (event) => {
      console.log('Flux distant reçu de:', participantId);
      const [remoteStream] = event.streams;
      
      setParticipants(prev => prev.map(p => 
        p.id === participantId ? { ...p, stream: remoteStream } : p
      ));
    };
    
    // Gérer les candidats ICE
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetId: participantId,
          candidate: event.candidate
        }));
      }
    };
    
    pc.onconnectionstatechange = () => {
      console.log(`Connexion ${participantId}:`, pc.connectionState);
      if (pc.connectionState === 'failed') {
        console.log('Reconnexion...');
        pc.restartIce();
      }
    };
    
    peerConnections.current.set(participantId, pc);
    return pc;
  }, [localStream]);

  // Gestionnaires WebRTC
  const handleUserJoined = async (userId: string, userInfo: any) => {
    console.log('Utilisateur rejoint:', userId);
    
    setParticipants(prev => [...prev, {
      id: userId,
      name: userInfo?.name || 'Utilisateur',
      isAdmin: userInfo?.isAdmin || false,
      isMuted: false,
      hasVideo: true
    }]);
    
    // Créer offer pour le nouveau participant
    const pc = createPeerConnection(userId);
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    wsRef.current?.send(JSON.stringify({
      type: 'offer',
      targetId: userId,
      offer: offer
    }));
    
    toast({
      title: "Participant rejoint",
      description: `${userInfo?.name || 'Quelqu\'un'} a rejoint la réunion`
    });
  };

  const handleUserLeft = (userId: string) => {
    console.log('Utilisateur parti:', userId);
    
    // Fermer la connexion peer
    const pc = peerConnections.current.get(userId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userId);
    }
    
    setParticipants(prev => prev.filter(p => p.id !== userId));
  };

  const handleOffer = async (userId: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(userId);
    await pc.setRemoteDescription(offer);
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    wsRef.current?.send(JSON.stringify({
      type: 'answer',
      targetId: userId,
      answer: answer
    }));
  };

  const handleAnswer = async (userId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      await pc.setRemoteDescription(answer);
    }
  };

  const handleIceCandidate = async (userId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(userId);
    if (pc) {
      await pc.addIceCandidate(candidate);
    }
  };

  const updateParticipant = (userId: string, updates: any) => {
    setParticipants(prev => prev.map(p => 
      p.id === userId ? { ...p, ...updates } : p
    ));
  };

  // Contrôles média
  const toggleMute = () => {
    if (!localStream) return;
    
    const audioTracks = localStream.getAudioTracks();
    if (audioTracks.length === 0) {
      toast({
        title: "Microphone indisponible",
        variant: "destructive"
      });
      return;
    }
    
    audioTracks.forEach(track => {
      track.enabled = isMuted;
    });
    setIsMuted(!isMuted);
    
    // Notifier les autres participants
    wsRef.current?.send(JSON.stringify({
      type: 'participant-update',
      updates: { isMuted: !isMuted }
    }));
  };

  const toggleVideo = () => {
    if (!localStream) return;
    
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoOn;
    });
    setIsVideoOn(!isVideoOn);
    
    wsRef.current?.send(JSON.stringify({
      type: 'participant-update',
      updates: { hasVideo: !isVideoOn }
    }));
  };

  const shareScreen = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Remplacer la piste vidéo
        const videoTrack = screenStream.getVideoTracks()[0];
        const sender = peerConnections.current.forEach(pc => {
          const videoSender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (videoSender) {
            videoSender.replaceTrack(videoTrack);
          }
        });
        
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          // Revenir à la caméra
          if (localStream) {
            const cameraTrack = localStream.getVideoTracks()[0];
            peerConnections.current.forEach(pc => {
              const videoSender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (videoSender && cameraTrack) {
                videoSender.replaceTrack(cameraTrack);
              }
            });
          }
        };
        
        setIsScreenSharing(true);
        toast({ title: "Partage d'écran démarré" });
      }
    } catch (error) {
      toast({
        title: "Erreur partage d'écran",
        variant: "destructive"
      });
    }
  };

  const leaveRoom = () => {
    console.log('Quitter la réunion');
    
    // Fermer toutes les connexions
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Initialisation
  useEffect(() => {
    if (!roomCode) return;
    
    const init = async () => {
      try {
        const stream = await initializeMedia();
        if (stream) {
          connectWebSocket();
        }
      } catch (error) {
        setStatus('error');
      }
    };
    
    init();
    
    return () => {
      // Nettoyage
      peerConnections.current.forEach(pc => pc.close());
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomCode, initializeMedia, connectWebSocket]);

  // Gestion plein écran
  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  // Écrans d'état
  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Code manquant</h2>
          <p className="text-gray-600 mb-6">Code de réunion requis</p>
          <Button onClick={() => setLocation('/')} className="w-full">
            Retour
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Connexion...</h2>
          <p className="text-gray-600">Initialisation de la vidéoconférence</p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Erreur</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <div className="space-y-3">
            <Button 
              onClick={() => window.location.reload()}
              className="w-full"
            >
              Réessayer
            </Button>
            <Button 
              onClick={() => setLocation('/')}
              variant="outline"
              className="w-full"
            >
              Retour
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Interface principale
  return (
    <div className={`h-screen bg-gray-900 text-white flex flex-col ${
      isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-lg overflow-hidden shadow-2xl' : ''
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Barre de titre */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h1 className="font-semibold">Vidéoconférence Pro</h1>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              navigator.clipboard.writeText(roomCode);
              toast({ title: "Code copié" });
            }}
            className="text-xs border-gray-600 hover:bg-gray-700"
          >
            <Copy className="h-3 w-3 mr-1" />
            {roomCode}
          </Button>
          
          <Badge variant="secondary" className="bg-blue-600">
            {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={leaveRoom} className="text-red-400">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Zone vidéo principale */}
        <div className="flex-1 flex flex-col">
          
          {/* Grille vidéo */}
          <div className="flex-1 bg-black p-4">
            <div className="h-full grid gap-4" style={{
              gridTemplateColumns: participants.length === 0 ? '1fr' : 
                                 participants.length === 1 ? 'repeat(2, 1fr)' :
                                 participants.length <= 3 ? 'repeat(2, 1fr)' :
                                 'repeat(3, 1fr)'
            }}>
              
              {/* Vidéo locale */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-full text-sm font-medium">
                  <div className="flex items-center space-x-2">
                    <span>Vous</span>
                    {isMuted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400" />}
                  </div>
                </div>
                
                {!isVideoOn && (
                  <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                    <Avatar className="w-24 h-24">
                      <AvatarFallback className="text-3xl bg-blue-600">
                        {authUser?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>

              {/* Vidéos participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                  {participant.stream ? (
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(el) => {
                        if (el && participant.stream) {
                          el.srcObject = participant.stream;
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                      <Avatar className="w-24 h-24">
                        <AvatarFallback className="text-3xl bg-green-600">
                          {participant.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                    </div>
                  )}
                  
                  <div className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-full text-sm font-medium">
                    <div className="flex items-center space-x-2">
                      {participant.isAdmin && <Crown className="h-4 w-4 text-yellow-400" />}
                      <span>{participant.name}</span>
                      {participant.isMuted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contrôles */}
          <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-center space-x-6">
              
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={!isVideoOn ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={shareScreen}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                <Share2 className="h-6 w-6" />
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowParticipants(!showParticipants)}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                <Users className="h-6 w-6" />
              </Button>
              
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              
            </div>
          </div>
        </div>

        {/* Panneau participants */}
        {showParticipants && !isMinimized && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            
            <div className="p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="font-semibold text-lg">Participants</h3>
              <p className="text-sm text-gray-400">{participants.length + 1} connecté{participants.length > 0 ? 's' : ''}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              
              {/* Vous */}
              <div className="flex items-center space-x-3 p-3 bg-blue-600/20 rounded-lg">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-blue-600">
                    {authUser?.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <p className="font-medium">Vous</p>
                  <p className="text-xs text-gray-400">Organisateur</p>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                </div>
              </div>

              {/* Autres participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-green-600">
                      {participant.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <p className="font-medium">{participant.name}</p>
                    <p className="text-xs text-gray-400">
                      {participant.isAdmin ? 'Admin' : 'Participant'}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {participant.isAdmin && <Crown className="w-4 h-4 text-yellow-400" />}
                    {participant.isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                  </div>
                </div>
              ))}
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConference;