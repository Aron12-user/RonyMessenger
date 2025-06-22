import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
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
  Maximize2,
  Minimize2,
  X,
  Crown,
  Settings,
  MessageSquare,
  MoreHorizontal,
  Monitor,
  Hand,
  Grid3X3,
  Camera,
  Volume2,
  VolumeX
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  isAdmin: boolean;
  isMuted: boolean;
  hasVideo: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}

interface MeetingRoom {
  id: string;
  title: string;
  participants: number;
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
  const [connectionError, setConnectionError] = useState<string>('');
  
  // États des contrôles
  const [isMuted, setIsMuted] = useState(false);
  const [hasVideo, setHasVideo] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [speakerVolume, setSpeakerVolume] = useState(75);
  
  // États de l'interface
  const [viewMode, setViewMode] = useState<'grid' | 'speaker'>('grid');
  const [showChat, setShowChat] = useState(false);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<{ [key: string]: HTMLVideoElement }>({});
  const peerConnections = useRef<{ [key: string]: RTCPeerConnection }>({});
  const ws = useRef<WebSocket | null>(null);

  const roomCode = params?.roomCode;

  // Configuration WebRTC optimisée
  const rtcConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10
  };

  // Initialiser le flux local avec gestion d'erreurs améliorée
  const initializeLocalStream = useCallback(async () => {
    try {
      setConnectionError('');
      console.log('Demande d\'accès aux médias...');
      
      const constraints = {
        video: { 
          width: { ideal: 1280, max: 1920 }, 
          height: { ideal: 720, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100
        }
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('Flux média obtenu avec succès:', stream);
      
      setLocalStream(stream);
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        localVideoRef.current.muted = true; // Éviter le feedback
      }
      
      return stream;
    } catch (error: any) {
      console.error('Erreur d\'accès aux médias:', error);
      let errorMessage = "Impossible d'accéder à la caméra ou au microphone";
      
      if (error.name === 'NotAllowedError') {
        errorMessage = "Accès refusé à la caméra/microphone. Veuillez autoriser l'accès dans les paramètres de votre navigateur.";
      } else if (error.name === 'NotFoundError') {
        errorMessage = "Aucune caméra ou microphone détecté sur cet appareil.";
      } else if (error.name === 'NotReadableError') {
        errorMessage = "Caméra ou microphone déjà utilisé par une autre application.";
      }
      
      setConnectionError(errorMessage);
      toast({
        title: "Erreur d'accès aux médias",
        description: errorMessage,
        variant: "destructive"
      });
      return null;
    }
  }, [toast]);

  // Connexion WebSocket pour la signalisation
  const connectWebSocket = useCallback(() => {
    if (!roomCode) return;
    
    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
      console.log('Connexion WebSocket à:', wsUrl);
      
      ws.current = new WebSocket(wsUrl);
      
      ws.current.onopen = () => {
        console.log('WebSocket connecté pour la réunion:', roomCode);
        setIsConnected(true);
        setConnectionError('');
        
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
        try {
          const data = JSON.parse(event.data);
          console.log('Message WebSocket reçu:', data);
          
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
            case 'chat-message':
              setChatMessages(prev => [...prev, data.message]);
              break;
          }
        } catch (error) {
          console.error('Erreur traitement message WebSocket:', error);
        }
      };
      
      ws.current.onclose = (event) => {
        console.log('WebSocket fermé:', event.code, event.reason);
        setIsConnected(false);
        if (event.code !== 1000) { // Pas une fermeture normale
          setConnectionError('Connexion à la réunion interrompue');
          toast({
            title: "Connexion fermée",
            description: "La connexion à la réunion a été interrompue",
            variant: "destructive"
          });
        }
      };
      
      ws.current.onerror = (error) => {
        console.error('Erreur WebSocket:', error);
        setConnectionError('Erreur de connexion au serveur');
      };
    } catch (error) {
      console.error('Erreur création WebSocket:', error);
      setConnectionError('Impossible de se connecter au serveur');
    }
  }, [roomCode, authUser, toast]);

  // Créer une connexion peer avec gestion d'erreurs
  const createPeerConnection = useCallback((userId: string) => {
    try {
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
        console.log('Track reçue pour utilisateur:', userId);
        const remoteVideo = remoteVideoRefs.current[userId];
        if (remoteVideo && event.streams[0]) {
          remoteVideo.srcObject = event.streams[0];
        }
      };
      
      pc.onconnectionstatechange = () => {
        console.log(`État connexion peer ${userId}:`, pc.connectionState);
        if (pc.connectionState === 'failed') {
          console.error('Connexion peer échouée pour:', userId);
        }
      };
      
      // Ajouter le flux local
      if (localStream) {
        localStream.getTracks().forEach(track => {
          console.log('Ajout track local:', track.kind);
          pc.addTrack(track, localStream);
        });
      }
      
      peerConnections.current[userId] = pc;
      return pc;
    } catch (error) {
      console.error('Erreur création peer connection:', error);
      return null;
    }
  }, [localStream]);

  // Gestionnaires WebRTC
  const handleUserJoined = async (userId: string, userInfo: any) => {
    console.log('Utilisateur rejoint:', userId, userInfo);
    const pc = createPeerConnection(userId);
    if (!pc) return;
    
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
        name: userInfo.name || 'Utilisateur',
        isAdmin: userInfo.isAdmin || false,
        isMuted: false,
        hasVideo: true,
        isScreenSharing: false
      }]);
      
    } catch (error) {
      console.error('Erreur création offre:', error);
    }
  };

  const handleUserLeft = (userId: string) => {
    console.log('Utilisateur parti:', userId);
    const pc = peerConnections.current[userId];
    if (pc) {
      pc.close();
      delete peerConnections.current[userId];
    }
    delete remoteVideoRefs.current[userId];
    setParticipants(prev => prev.filter(p => p.id !== userId));
  };

  const handleOffer = async (userId: string, offer: RTCSessionDescriptionInit) => {
    console.log('Offre reçue de:', userId);
    const pc = createPeerConnection(userId);
    if (!pc) return;
    
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
      console.error('Erreur traitement offre:', error);
    }
  };

  const handleAnswer = async (userId: string, answer: RTCSessionDescriptionInit) => {
    console.log('Réponse reçue de:', userId);
    const pc = peerConnections.current[userId];
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error('Erreur traitement réponse:', error);
      }
    }
  };

  const handleIceCandidate = async (userId: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current[userId];
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Erreur ajout candidat ICE:', error);
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
      
      toast({
        title: isMuted ? "Microphone activé" : "Microphone coupé",
        description: isMuted ? "Votre microphone est maintenant activé" : "Votre microphone est maintenant coupé"
      });
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
      
      toast({
        title: hasVideo ? "Caméra désactivée" : "Caméra activée",
        description: hasVideo ? "Votre caméra est maintenant désactivée" : "Votre caméra est maintenant activée"
      });
    }
  };

  const shareScreen = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { width: 1920, height: 1080 },
          audio: true
        });
        
        // Remplacer le flux vidéo pour tous les peers
        Object.values(peerConnections.current).forEach(pc => {
          const sender = pc.getSenders().find(s => 
            s.track && s.track.kind === 'video'
          );
          if (sender && screenStream.getVideoTracks()[0]) {
            sender.replaceTrack(screenStream.getVideoTracks()[0]);
          }
        });
        
        setIsScreenSharing(true);
        
        // Gérer l'arrêt du partage
        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          // Remettre la caméra
          if (localStream) {
            Object.values(peerConnections.current).forEach(pc => {
              const sender = pc.getSenders().find(s => 
                s.track && s.track.kind === 'video'
              );
              if (sender && localStream.getVideoTracks()[0]) {
                sender.replaceTrack(localStream.getVideoTracks()[0]);
              }
            });
          }
          toast({
            title: "Partage d'écran arrêté",
            description: "Le partage d'écran a été arrêté"
          });
        };
        
        toast({
          title: "Partage d'écran démarré",
          description: "Votre écran est maintenant partagé"
        });
      }
    } catch (error) {
      console.error('Erreur partage écran:', error);
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
      ws.current.close(1000, 'User left');
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

  // Initialisation au montage du composant
  useEffect(() => {
    if (roomCode && !isConnecting) {
      setIsConnecting(true);
      console.log('Initialisation de la réunion:', roomCode);
      
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
      console.log('Nettoyage composant');
      // Nettoyage
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peerConnections.current).forEach(pc => pc.close());
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [roomCode, initializeLocalStream, connectWebSocket, isConnecting]);

  // Gestion de l'état plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <X className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold mb-2">Code de salle manquant</h2>
          <p className="text-gray-600 mb-4">Impossible de rejoindre la réunion sans code de salle valide.</p>
          <Button onClick={() => setLocation('/meetings')} className="w-full">
            Retourner aux réunions
          </Button>
        </Card>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md p-6 text-center">
          <div className="animate-spin h-12 w-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <h2 className="text-xl font-semibold mb-2">Connexion en cours...</h2>
          <p className="text-gray-600">Initialisation de la vidéoconférence et accès aux médias...</p>
          {connectionError && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{connectionError}</p>
              <Button 
                onClick={() => {
                  setConnectionError('');
                  setIsConnecting(false);
                }} 
                variant="outline" 
                size="sm" 
                className="mt-2"
              >
                Réessayer
              </Button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className={`min-h-screen bg-gray-900 text-white overflow-hidden ${isMinimized ? 'fixed bottom-4 right-4 w-96 h-72 z-50 rounded-lg shadow-2xl' : ''}`}>
      {/* Barre de titre professionnelle */}
      <div className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <h1 className="text-lg font-semibold">Réunion {roomCode}</h1>
          </div>
          
          {meetingRoom?.title && (
            <Badge variant="secondary" className="bg-blue-600 text-white">
              {meetingRoom.title}
            </Badge>
          )}
          
          <div className="flex items-center space-x-1 text-sm text-gray-300">
            <Users className="h-4 w-4" />
            <span>{participants.length + 1} participant{participants.length !== 0 ? 's' : ''}</span>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleFullscreen}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-300 hover:text-white hover:bg-gray-700"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={leaveRoom}
            className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-64px)]">
        {/* Zone principale de projection */}
        <div className="flex-1 flex flex-col bg-black">
          {/* Zone de projection principale */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-900 to-black">
            {viewMode === 'speaker' ? (
              // Mode orateur principal
              <div className="w-full h-full flex items-center justify-center">
                <video
                  ref={mainVideoRef}
                  autoPlay
                  playsInline
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
                />
                <div className="absolute bottom-4 left-4 bg-black/70 px-3 py-2 rounded-lg">
                  <div className="flex items-center space-x-2 text-white">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span className="font-medium">Orateur principal</span>
                  </div>
                </div>
              </div>
            ) : (
              // Mode grille - Projection principale
              <div className="w-full h-full p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full">
                  {/* Vidéo locale */}
                  <div className="relative bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded-lg">
                      <div className="flex items-center space-x-2 text-white text-sm">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-medium">Vous</span>
                        {isMuted ? (
                          <MicOff className="h-3 w-3 text-red-400" />
                        ) : (
                          <Mic className="h-3 w-3 text-green-400" />
                        )}
                      </div>
                    </div>
                    {!hasVideo && (
                      <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                        <Avatar className="w-16 h-16">
                          <AvatarFallback className="bg-blue-600 text-white text-xl">
                            {authUser?.displayName?.charAt(0) || 'U'}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                  </div>
                  
                  {/* Vidéos des participants */}
                  {participants.map((participant) => (
                    <div key={participant.id} className="relative bg-gray-800 rounded-xl overflow-hidden shadow-lg border border-gray-700">
                      <video
                        ref={(el) => {
                          if (el) remoteVideoRefs.current[participant.id] = el;
                        }}
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-3 left-3 bg-black/70 px-2 py-1 rounded-lg">
                        <div className="flex items-center space-x-2 text-white text-sm">
                          {participant.isAdmin && <Crown className="h-3 w-3 text-yellow-400" />}
                          <span className="font-medium">{participant.name}</span>
                          {participant.isMuted ? (
                            <MicOff className="h-3 w-3 text-red-400" />
                          ) : (
                            <Mic className="h-3 w-3 text-green-400" />
                          )}
                        </div>
                      </div>
                      {!participant.hasVideo && (
                        <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                          <Avatar className="w-16 h-16">
                            <AvatarFallback className="bg-green-600 text-white text-xl">
                              {participant.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                        </div>
                      )}
                      {participant.isScreenSharing && (
                        <div className="absolute top-3 right-3 bg-blue-600 px-2 py-1 rounded-lg">
                          <Monitor className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Barre de contrôles moderne */}
          <div className="bg-gray-800 border-t border-gray-700 px-6 py-4">
            <div className="flex items-center justify-center space-x-4">
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={!hasVideo ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                {hasVideo ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={shareScreen}
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                <Share2 className="h-6 w-6" />
              </Button>
              
              <Separator orientation="vertical" className="h-8 bg-gray-600" />
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setViewMode(viewMode === 'grid' ? 'speaker' : 'grid')}
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                <Grid3X3 className="h-6 w-6" />
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowChat(!showChat)}
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                <MessageSquare className="h-6 w-6" />
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                <Settings className="h-6 w-6" />
              </Button>
              
              <Separator orientation="vertical" className="h-8 bg-gray-600" />
              
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-14 h-14 shadow-lg hover:scale-105 transition-transform"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
            </div>
          </div>
        </div>
        
        {/* Panneau latéral participants (mode mosaïque) */}
        {showParticipants && !isMinimized && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            {/* En-tête du panneau */}
            <div className="p-4 border-b border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-lg">Participants</h3>
                <Badge variant="secondary" className="bg-blue-600">
                  {participants.length + 1}
                </Badge>
              </div>
              <div className="flex space-x-2">
                <Button variant="outline" size="sm" className="flex-1">
                  <Users className="h-4 w-4 mr-2" />
                  Inviter
                </Button>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            {/* Liste des participants en mosaïque */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {/* Utilisateur actuel */}
              <div className="bg-gray-700 rounded-lg p-3 border border-blue-500/30">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className="bg-blue-600 text-white">
                        {authUser?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white">Vous</p>
                    <p className="text-xs text-gray-400">Organisateur</p>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Crown className="w-4 h-4 text-yellow-400" />
                    {isMuted ? (
                      <MicOff className="w-4 h-4 text-red-400" />
                    ) : (
                      <Mic className="w-4 h-4 text-green-400" />
                    )}
                    {hasVideo ? (
                      <Video className="w-4 h-4 text-green-400" />
                    ) : (
                      <VideoOff className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                </div>
              </div>
              
              {/* Autres participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="bg-gray-700 rounded-lg p-3 hover:bg-gray-600 transition-colors">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-green-600 text-white">
                          {participant.name.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-gray-800"></div>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-white">{participant.name}</p>
                      <p className="text-xs text-gray-400">
                        {participant.isAdmin ? 'Administrateur' : 'Participant'}
                      </p>
                    </div>
                    <div className="flex items-center space-x-1">
                      {participant.isAdmin && <Crown className="w-4 h-4 text-yellow-400" />}
                      {participant.isMuted ? (
                        <MicOff className="w-4 h-4 text-red-400" />
                      ) : (
                        <Mic className="w-4 h-4 text-green-400" />
                      )}
                      {participant.hasVideo ? (
                        <Video className="w-4 h-4 text-green-400" />
                      ) : (
                        <VideoOff className="w-4 h-4 text-red-400" />
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {/* Zone de contrôle du volume */}
            <div className="p-4 border-t border-gray-700">
              <div className="flex items-center space-x-3">
                <Volume2 className="h-4 w-4 text-gray-400" />
                <div className="flex-1">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={speakerVolume}
                    onChange={(e) => setSpeakerVolume(parseInt(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                </div>
                <span className="text-xs text-gray-400 w-8">{speakerVolume}%</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConference;