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
  isAdmin: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream;
  videoElement?: HTMLVideoElement;
}

const VideoConferenceAutonomous: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // États de connexion
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  
  // États des médias
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  
  // États des contrôles
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const remoteStreams = useRef<Map<string, MediaStream>>(new Map());

  const roomCode = params?.roomCode;

  // Configuration WebRTC optimisée pour production
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun.cloudflare.com:3478' },
      // Serveurs TURN publics pour traverser les NAT stricts
      { 
        urls: 'turn:openrelay.metered.ca:80',
        username: 'openrelayproject',
        credential: 'openrelayproject'
      }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Initialisation des médias avec fallbacks robustes
  const initializeMedia = useCallback(async (): Promise<MediaStream> => {
    try {
      console.log('Initialisation des médias...');
      
      // Essai 1: Vidéo HD + Audio haute qualité
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 48000
          }
        });
        
        console.log('✓ Médias HD obtenus');
        return stream;
      } catch (hdError) {
        console.log('Fallback: Qualité standard');
        
        // Essai 2: Qualité standard
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { width: 640, height: 480 },
            audio: true
          });
          
          console.log('✓ Médias standards obtenus');
          return stream;
        } catch (standardError) {
          console.log('Fallback: Vidéo seulement');
          
          // Essai 3: Vidéo seulement
          const stream = await navigator.mediaDevices.getUserMedia({
            video: true
          });
          
          setIsMuted(true);
          toast({
            title: "Mode vidéo seulement",
            description: "Microphone indisponible"
          });
          
          console.log('✓ Vidéo seule obtenue');
          return stream;
        }
      }
    } catch (error: any) {
      console.error('Erreur accès médias:', error);
      
      let message = 'Impossible d\'accéder aux médias';
      if (error.name === 'NotAllowedError') {
        message = 'Autorisez l\'accès caméra/micro dans votre navigateur';
      } else if (error.name === 'NotFoundError') {
        message = 'Aucune caméra détectée';
      } else if (error.name === 'NotReadableError') {
        message = 'Caméra/micro utilisé par une autre application';
      }
      
      setConnectionError(message);
      throw new Error(message);
    }
  }, [toast]);

  // Connexion WebSocket pour signalisation
  const connectWebSocket = useCallback(() => {
    if (!roomCode || !authUser) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    console.log('Connexion WebSocket signalisation:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('✓ Signalisation connectée');
      setIsConnected(true);
      setIsConnecting(false);
      
      // Envoyer les informations utilisateur
      const userInfo = {
        type: 'join-room',
        userId: `user_${authUser.id}_${Date.now()}`,
        name: authUser.displayName || authUser.username,
        isAdmin: true // Premier utilisateur admin
      };
      
      wsRef.current?.send(JSON.stringify(userInfo));
      
      toast({
        title: "Connexion établie",
        description: "Prêt pour la vidéoconférence"
      });
    };
    
    wsRef.current.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data);
        await handleSignalingMessage(data);
      } catch (error) {
        console.error('Erreur traitement message:', error);
      }
    };
    
    wsRef.current.onclose = () => {
      console.log('Signalisation fermée');
      setIsConnected(false);
      if (!connectionError) {
        setConnectionError('Connexion perdue');
      }
    };
    
    wsRef.current.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
      setConnectionError('Erreur de signalisation');
    };
  }, [roomCode, authUser, connectionError, toast]);

  // Gestionnaire de messages de signalisation
  const handleSignalingMessage = async (data: any) => {
    console.log('Message signalisation:', data.type);
    
    switch (data.type) {
      case 'user-joined':
        await handleUserJoined(data);
        break;
      case 'user-left':
        handleUserLeft(data.userId);
        break;
      case 'offer':
        await handleOffer(data);
        break;
      case 'answer':
        await handleAnswer(data);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data);
        break;
      case 'media-state':
        handleMediaStateUpdate(data);
        break;
    }
  };

  // Créer une connexion peer-to-peer
  const createPeerConnection = (userId: string): RTCPeerConnection => {
    console.log('Création connexion P2P pour:', userId);
    
    const pc = new RTCPeerConnection(rtcConfig);
    
    // Ajouter le flux local
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    // Gérer les flux distants
    pc.ontrack = (event) => {
      console.log('✓ Flux distant reçu de:', userId);
      const [remoteStream] = event.streams;
      
      remoteStreams.current.set(userId, remoteStream);
      
      // Mettre à jour l'état des participants
      setParticipants(prev => prev.map(p => 
        p.id === userId ? { ...p, stream: remoteStream } : p
      ));
    };
    
    // Gérer les candidats ICE
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetUserId: userId,
          candidate: event.candidate
        }));
      }
    };
    
    // Surveillance de l'état de connexion
    pc.onconnectionstatechange = () => {
      console.log(`Connexion ${userId}:`, pc.connectionState);
      
      if (pc.connectionState === 'failed') {
        console.log('Reconnexion ICE...');
        pc.restartIce();
      } else if (pc.connectionState === 'connected') {
        console.log('✓ P2P établi avec:', userId);
      }
    };
    
    peerConnections.current.set(userId, pc);
    return pc;
  };

  // Gestionnaires d'événements P2P
  const handleUserJoined = async (data: any) => {
    console.log('Utilisateur rejoint:', data.name);
    
    // Ajouter à la liste des participants
    const newParticipant: Participant = {
      id: data.userId,
      name: data.name,
      isAdmin: data.isAdmin || false,
      isMuted: false,
      hasVideo: true
    };
    
    setParticipants(prev => [...prev, newParticipant]);
    
    // Créer une offre WebRTC
    const pc = createPeerConnection(data.userId);
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    });
    
    await pc.setLocalDescription(offer);
    
    // Envoyer l'offre
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'offer',
        targetUserId: data.userId,
        offer: offer
      }));
    }
    
    toast({
      title: "Nouveau participant",
      description: `${data.name} a rejoint la réunion`
    });
  };

  const handleUserLeft = (userId: string) => {
    console.log('Utilisateur parti:', userId);
    
    // Fermer la connexion P2P
    const pc = peerConnections.current.get(userId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(userId);
    }
    
    // Nettoyer les références
    remoteStreams.current.delete(userId);
    
    // Retirer de la liste
    setParticipants(prev => prev.filter(p => p.id !== userId));
  };

  const handleOffer = async (data: any) => {
    console.log('Offre reçue de:', data.fromUserId);
    
    const pc = createPeerConnection(data.fromUserId);
    await pc.setRemoteDescription(data.offer);
    
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'answer',
        targetUserId: data.fromUserId,
        answer: answer
      }));
    }
  };

  const handleAnswer = async (data: any) => {
    console.log('Réponse reçue de:', data.fromUserId);
    
    const pc = peerConnections.current.get(data.fromUserId);
    if (pc) {
      await pc.setRemoteDescription(data.answer);
    }
  };

  const handleIceCandidate = async (data: any) => {
    const pc = peerConnections.current.get(data.fromUserId);
    if (pc) {
      await pc.addIceCandidate(data.candidate);
    }
  };

  const handleMediaStateUpdate = (data: any) => {
    setParticipants(prev => prev.map(p => 
      p.id === data.userId ? { 
        ...p, 
        isMuted: data.isMuted, 
        hasVideo: data.hasVideo 
      } : p
    ));
  };

  // Contrôles médias
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
    
    const newMuteState = !isMuted;
    setIsMuted(newMuteState);
    
    // Notifier les autres participants
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'media-state',
        isMuted: newMuteState,
        hasVideo: isVideoOn
      }));
    }
    
    toast({
      title: newMuteState ? "Micro coupé" : "Micro activé"
    });
  };

  const toggleVideo = () => {
    if (!localStream) return;
    
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoOn;
    });
    
    const newVideoState = !isVideoOn;
    setIsVideoOn(newVideoState);
    
    // Notifier les autres participants
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'media-state',
        isMuted: isMuted,
        hasVideo: newVideoState
      }));
    }
    
    toast({
      title: newVideoState ? "Caméra activée" : "Caméra désactivée"
    });
  };

  const shareScreen = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Remplacer la piste vidéo dans toutes les connexions
        const videoTrack = screenStream.getVideoTracks()[0];
        
        peerConnections.current.forEach(pc => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Gérer l'arrêt du partage
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          // Revenir à la caméra
          if (localStream) {
            const cameraTrack = localStream.getVideoTracks()[0];
            peerConnections.current.forEach(pc => {
              const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender && cameraTrack) {
                sender.replaceTrack(cameraTrack);
              }
            });
          }
          toast({ title: "Partage d'écran arrêté" });
        };
        
        setIsScreenSharing(true);
        toast({ title: "Partage d'écran démarré" });
      }
    } catch (error: any) {
      console.error('Erreur partage écran:', error);
      toast({
        title: "Impossible de partager l'écran",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const leaveRoom = () => {
    console.log('Quitter la réunion');
    
    // Fermer toutes les connexions
    peerConnections.current.forEach(pc => pc.close());
    peerConnections.current.clear();
    remoteStreams.current.clear();
    
    // Arrêter les médias locaux
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    
    // Fermer WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    setLocation('/');
    toast({ title: "Réunion terminée" });
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code copié dans le presse-papier" });
  };

  // Initialisation principale
  useEffect(() => {
    if (!roomCode || !authUser) return;
    
    const initialize = async () => {
      setIsConnecting(true);
      setConnectionError('');
      
      try {
        // Étape 1: Obtenir les médias
        console.log('Étape 1: Médias');
        const stream = await initializeMedia();
        setLocalStream(stream);
        
        // Attacher à l'élément vidéo local
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        // Étape 2: Connexion signalisation
        console.log('Étape 2: Signalisation');
        connectWebSocket();
        
      } catch (error: any) {
        console.error('Erreur initialisation:', error);
        setIsConnecting(false);
      }
    };
    
    initialize();
    
    // Nettoyage
    return () => {
      peerConnections.current.forEach(pc => pc.close());
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomCode, authUser, initializeMedia, connectWebSocket]);

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
          <h2 className="text-2xl font-bold mb-4">Code requis</h2>
          <p className="text-gray-600 mb-6">Un code de réunion est nécessaire</p>
          <Button onClick={() => setLocation('/')} className="w-full">
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Erreur de connexion</h2>
          <p className="text-gray-600 mb-6">{connectionError}</p>
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

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Initialisation</h2>
          <p className="text-gray-600 mb-2">Configuration de la vidéoconférence autonome</p>
          <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '75%'}}></div>
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
      
      {/* Barre de contrôle */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <h1 className="font-semibold">Vidéoconférence Autonome</h1>
          </div>
          
          <Button
            variant="outline"
            size="sm"
            onClick={copyRoomCode}
            className="text-xs border-gray-600 hover:bg-gray-700"
          >
            <Copy className="h-3 w-3 mr-1" />
            {roomCode}
          </Button>
          
          <Badge variant="secondary" className="bg-blue-600">
            {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
          </Badge>
          
          <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
            ∞ Illimité
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
        
        {/* Zone vidéo */}
        <div className="flex-1 flex flex-col">
          
          {/* Grille des participants */}
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
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span>Vous</span>
                    {isMuted ? <MicOff className="h-4 w-4 text-red-400" /> : <Mic className="h-4 w-4 text-green-400" />}
                  </div>
                </div>
                
                {!isVideoOn && (
                  <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                    <Avatar className="w-24 h-24">
                      <AvatarFallback className="text-3xl bg-blue-600">
                        {(authUser?.displayName || authUser?.username || 'U').charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>

              {/* Vidéos participants distants */}
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                  {participant.stream ? (
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(videoElement) => {
                        if (videoElement && participant.stream) {
                          videoElement.srcObject = participant.stream;
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
                    {(authUser?.displayName || authUser?.username || 'U').charAt(0)}
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

export default VideoConferenceAutonomous;