import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { 
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Users,
  Share2,
  Maximize,
  Minimize,
  X,
  Crown
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  isAdmin: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  stream?: MediaStream;
}

interface MeetingRoom {
  id: string;
  title: string;
  participants: Participant[];
  isActive: boolean;
  startTime: Date;
  adminId: string;
}

const VideoConference: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  // Récupérer l'utilisateur actuel
  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // États de la vidéoconférence
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [meetingRoom, setMeetingRoom] = useState<MeetingRoom | null>(null);
  
  // États des contrôles
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const ws = useRef<WebSocket | null>(null);

  const roomCode = params?.roomCode;

  // Configuration WebRTC
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Initialiser le flux local
  const initializeLocalStream = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error) {
      console.error('Erreur d\'accès aux médias:', error);
      toast({
        title: "Erreur d'accès",
        description: "Impossible d'accéder à la caméra ou au microphone",
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  // Connexion WebSocket pour la signalisation
  const connectWebSocket = useCallback(() => {
    if (!roomCode) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      console.log('WebSocket connecté pour la réunion:', roomCode);
      setIsConnected(true);
      
      // Envoyer les informations utilisateur
      ws.current?.send(JSON.stringify({
        type: 'user-info',
        info: {
          name: authUser?.displayName || authUser?.username || 'Utilisateur',
          isAdmin: false
        }
      }));
    };
    
    ws.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      
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
        case 'room-info':
          setMeetingRoom(data.room);
          break;
        case 'participant-update':
          updateParticipant(data.userId, data.updates);
          break;
      }
    };
    
    ws.current.onclose = () => {
      setIsConnected(false);
      toast({
        title: "Connexion fermée",
        description: "La connexion à la réunion a été interrompue"
      });
    };
    
    ws.current.onerror = (error) => {
      console.error('Erreur WebSocket:', error);
    };
  }, [roomCode, authUser]);

  // Créer une connexion peer
  const createPeerConnection = useCallback((userId: string) => {
    const pc = new RTCPeerConnection(rtcConfiguration);
    
    pc.onicecandidate = (event) => {
      if (event.candidate && ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetId: userId,
          candidate: event.candidate
        }));
      }
    };
    
    pc.ontrack = (event) => {
      const remoteVideo = remoteVideoRefs.current[userId];
      if (remoteVideo) {
        remoteVideo.srcObject = event.streams[0];
      }
    };
    
    // Ajouter le flux local
    if (localStream) {
      localStream.getTracks().forEach(track => {
        pc.addTrack(track, localStream);
      });
    }
    
    peerConnections.current[userId] = pc;
    return pc;
  }, [localStream]);

  // Gestionnaires WebRTC
  const handleUserJoined = async (userId: string, userInfo: any) => {
    const pc = createPeerConnection(userId);
    
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'offer',
          targetId: userId,
          offer: offer
        }));
      }
      
      // Ajouter le participant
      setParticipants(prev => [...prev, {
        id: userId,
        name: userInfo.name,
        isAdmin: false,
        isMuted: false,
        hasVideo: true
      }]);
      
    } catch (error) {
      console.error('Erreur lors de la création de l\'offre:', error);
    }
  };

  const handleUserLeft = (userId: string) => {
    const pc = peerConnections.current[userId];
    if (pc) {
      pc.close();
      delete peerConnections.current[userId];
    }
    
    setParticipants(prev => prev.filter(p => p.id !== userId));
  };

  const handleOffer = async (userId: string, offer: RTCSessionDescriptionInit) => {
    const pc = createPeerConnection(userId);
    
    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'answer',
          targetId: userId,
          answer: answer
        }));
      }
    } catch (error) {
      console.error('Erreur lors du traitement de l\'offre:', error);
    }
  };

  const handleAnswer = async (userId: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current[userId];
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error('Erreur lors du traitement de la réponse:', error);
      }
    }
  };

  const handleIceCandidate = async (userId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current[userId];
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Erreur lors de l\'ajout du candidat ICE:', error);
      }
    }
  };

  const updateParticipant = (userId: string, updates: Partial<Participant>) => {
    setParticipants(prev => prev.map(p => 
      p.id === userId ? { ...p, ...updates } : p
    ));
  };

  // Contrôles de la vidéoconférence
  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = isMuted;
      });
      setIsMuted(!isMuted);
      
      // Informer les autres participants
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'participant-update',
          updates: { isMuted: !isMuted }
        }));
      }
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !hasVideo;
      });
      setHasVideo(!hasVideo);
      
      // Informer les autres participants
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({
          type: 'participant-update',
          updates: { hasVideo: !hasVideo }
        }));
      }
    }
  };

  const shareScreen = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Remplacer le flux vidéo pour tous les peers
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender) {
            sender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });
        
        setIsScreenSharing(true);
        
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          // Remettre la caméra
          if (localStream) {
            Object.values(peerConnections.current).forEach(pc => {
              const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender) {
                sender.replaceTrack(localStream.getVideoTracks()[0]);
              }
            });
          }
        };
      }
    } catch (error) {
      console.error('Erreur lors du partage d\'écran:', error);
      toast({
        title: "Erreur de partage",
        description: "Impossible de partager l'écran",
        variant: "destructive"
      });
    }
  };

  const leaveRoom = () => {
    // Fermer toutes les connexions
    Object.values(peerConnections.current).forEach(pc => pc.close());
    
    // Arrêter le flux local
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Fermer WebSocket
    if (ws.current) {
      ws.current.close();
    }
    
    // Retourner à la page des réunions
    setLocation('/meetings');
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
    setIsFullscreen(!isFullscreen);
  };

  // Initialisation
  useEffect(() => {
    if (roomCode && !isConnecting) {
      setIsConnecting(true);
      
      const initialize = async () => {
        const stream = await initializeLocalStream();
        if (stream) {
          connectWebSocket();
        }
        setIsConnecting(false);
      };
      
      initialize();
    }
    
    return () => {
      // Nettoyage
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [roomCode, initializeLocalStream, connectWebSocket]);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Code de salle manquant</h2>
          <p className="text-gray-600 mb-4">Impossible de rejoindre la réunion sans code de salle.</p>
          <Button onClick={() => setLocation('/meetings')}>
            Retourner aux réunions
          </Button>
        </Card>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Connexion en cours...</h2>
          <p className="text-gray-600">Initialisation de la vidéoconférence...</p>
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white ${isMinimized ? 'fixed bottom-4 right-4 w-80 h-60 z-50 rounded-lg overflow-hidden' : ''}`}>
      {/* Barre de titre */}
      <div className="bg-gray-800 px-4 py-2 flex items-center justify-between border-b border-gray-700">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold">
            Réunion {roomCode}
          </h1>
          {meetingRoom?.title && (
            <Badge variant="secondary">{meetingRoom.title}</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-white hover:bg-gray-700"
          >
            {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-white hover:bg-gray-700"
          >
            <Minimize className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={leaveRoom}
            className="text-red-400 hover:bg-red-900/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-60px)]">
        {/* Zone vidéo principale */}
        <div className="flex-1 flex flex-col">
          {/* Vidéos des participants */}
          <div className="flex-1 p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 h-full">
              {/* Vidéo locale */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-sm">
                  Vous {isMuted ? <MicOff className="inline w-3 h-3 ml-1" /> : <Mic className="inline w-3 h-3 ml-1" />}
                </div>
              </div>
              
              {/* Vidéos des autres participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden">
                  <video
                    ref={(el) => {
                      if (el) remoteVideoRefs.current[participant.id] = el;
                    }}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-sm flex items-center gap-1">
                    {participant.isAdmin && <Crown className="w-3 h-3 text-yellow-400" />}
                    {participant.name}
                    {participant.isMuted ? <MicOff className="w-3 h-3" /> : <Mic className="w-3 h-3" />}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contrôles */}
          <div className="bg-gray-800 p-4 border-t border-gray-700">
            <div className="flex items-center justify-center gap-4">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="rounded-full w-12 h-12"
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={!hasVideo ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12"
              >
                {hasVideo ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={shareScreen}
                className="rounded-full w-12 h-12"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowParticipants(!showParticipants)}
                className="rounded-full w-12 h-12"
              >
                <Users className="h-5 w-5" />
              </Button>
              
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-12 h-12"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Panneau des participants */}
        {showParticipants && !isMinimized && (
          <div className="w-80 bg-gray-800 border-l border-gray-700">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold flex items-center gap-2">
                <Users className="h-4 w-4" />
                Participants ({participants.length + 1})
              </h3>
            </div>
            
            <div className="p-4 space-y-3">
              {/* Utilisateur actuel */}
              <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-700">
                <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                  {authUser?.displayName?.charAt(0) || 'U'}
                </div>
                <div className="flex-1">
                  <p className="font-medium">Vous</p>
                  <p className="text-xs text-gray-400">Organisateur</p>
                </div>
                <div className="flex gap-1">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                </div>
              </div>
              
              {/* Autres participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-700">
                  <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {participant.name.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{participant.name}</p>
                    <p className="text-xs text-gray-400">Participant</p>
                  </div>
                  <div className="flex gap-1">
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