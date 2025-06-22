import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { User } from "@shared/schema";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2,
  Maximize2, Minimize2, X, Crown, Settings, MessageSquare,
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2,
  Send, Hand, Grid3X3, MoreVertical, Circle, FileText,
  UserPlus, Lock, Unlock, Tv, PictureInPicture, 
  ScreenShare, ScreenShareOff, Presentation, Layout,
  Wifi, WifiOff, Signal, Eye, EyeOff, Pin, PinOff
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isLocal: boolean;
  connection?: RTCPeerConnection;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

const VideoConferenceWebRTC: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Refs WebRTC
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // États de l'interface
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  
  // États des participants
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  
  // États des contrôles
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isPresentationMode, setIsPresentationMode] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  
  // États de l'interface
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showMoreOptions, setShowMoreOptions] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker' | 'presentation' | 'filmstrip'>('grid');
  const [pinnedParticipant, setPinnedParticipant] = useState<string | null>(null);
  const [virtualBackground, setVirtualBackground] = useState<string | null>(null);
  const [isNoiseSuppressionEnabled, setIsNoiseSuppressionEnabled] = useState(true);
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high'>('high');
  
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isHandRaised, setIsHandRaised] = useState(false);

  const roomCode = params?.roomCode;

  // Calcul de la disposition en mosaïque
  const getGridLayout = () => {
    const totalParticipants = participants.size + 1;
    
    if (layoutMode === 'speaker') {
      return 'flex flex-col';
    }
    
    if (layoutMode === 'filmstrip') {
      return 'grid grid-cols-1 lg:grid-cols-6 gap-4';
    }
    
    // Mode grille automatique
    if (totalParticipants === 1) return 'grid grid-cols-1 gap-6';
    if (totalParticipants === 2) return 'grid grid-cols-1 lg:grid-cols-2 gap-6';
    if (totalParticipants <= 4) return 'grid grid-cols-2 gap-4';
    if (totalParticipants <= 6) return 'grid grid-cols-2 lg:grid-cols-3 gap-4';
    if (totalParticipants <= 9) return 'grid grid-cols-3 gap-3';
    if (totalParticipants <= 12) return 'grid grid-cols-3 lg:grid-cols-4 gap-3';
    return 'grid grid-cols-4 lg:grid-cols-5 gap-2';
  };

  // Configuration WebRTC
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' }
    ]
  };

  // Initialisation WebSocket
  const initializeWebSocket = useCallback(() => {
    if (!roomCode || !authUser) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connecté');
      setConnectionStatus('connected');
      
      // Rejoindre la salle avec les informations utilisateur
      wsRef.current?.send(JSON.stringify({
        type: 'user-info',
        info: {
          userId: authUser.id,
          displayName: authUser.displayName || authUser.username,
          username: authUser.username
        }
      }));

      // Ensuite rejoindre la salle
      wsRef.current?.send(JSON.stringify({
        type: 'join-room',
        participant: {
          id: authUser.id.toString(),
          name: authUser.displayName || authUser.username,
          audioEnabled: isAudioEnabled,
          videoEnabled: isVideoEnabled
        }
      }));
    };

    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);
      await handleWebSocketMessage(data);
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket fermé');
      setConnectionStatus('disconnected');
    };

    wsRef.current.onerror = () => {
      console.error('Erreur WebSocket');
      setConnectionStatus('failed');
    };
  }, [roomCode, authUser, isAudioEnabled, isVideoEnabled]);

  // Gestion des messages WebSocket
  const handleWebSocketMessage = async (data: any) => {
    switch (data.type) {
      case 'room-joined':
        console.log('Salle rejointe:', data);
        for (const existingParticipant of data.existingParticipants) {
          await handleParticipantJoined(existingParticipant);
        }
        break;
      case 'participant-joined':
        await handleParticipantJoined(data.participant);
        break;
      case 'participant-left':
        handleParticipantLeft(data.participantId);
        break;
      case 'offer':
        await handleOffer(data.offer, data.from);
        break;
      case 'answer':
        await handleAnswer(data.answer, data.from);
        break;
      case 'ice-candidate':
        await handleIceCandidate(data.candidate, data.from);
        break;
      case 'chat-message':
        handleChatMessage(data.message);
        break;
      case 'participant-update':
        handleParticipantUpdate(data.participant);
        break;
      case 'screen-share-started':
        toast({ title: `${data.participantId} partage son écran` });
        break;
      case 'screen-share-stopped':
        toast({ title: `${data.participantId} a arrêté le partage` });
        break;
      case 'hand-raised':
        toast({ title: `${data.participantId} ${data.raised ? 'lève' : 'baisse'} la main` });
        break;
    }
  };

  // Initialisation du stream local (optionnel)
  const initializeLocalStream = async () => {
    try {
      const local: Participant = {
        id: authUser?.id.toString() || 'local',
        name: authUser?.displayName || authUser?.username || 'Vous',
        stream: undefined,
        audioEnabled: false,
        videoEnabled: false,
        isLocal: true
      };

      setLocalParticipant(local);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);

      toast({
        title: "Vidéoconférence prête",
        description: "Cliquez sur les boutons pour activer micro/caméra"
      });

      console.log('Participant local créé sans stream initial');

    } catch (error) {
      console.error('Erreur initialisation:', error);
      const local: Participant = {
        id: authUser?.id.toString() || 'local',
        name: authUser?.displayName || authUser?.username || 'Vous',
        stream: undefined,
        audioEnabled: false,
        videoEnabled: false,
        isLocal: true
      };

      setLocalParticipant(local);
      setIsAudioEnabled(false);
      setIsVideoEnabled(false);

      toast({
        title: "Mode sans média",
        description: "Rejoignez la réunion et activez les médias si nécessaire"
      });
    }
  };

  // Gestion participant rejoint
  const handleParticipantJoined = async (participant: any) => {
    console.log('Participant rejoint:', participant);
    
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(participant.id, peerConnection);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      console.log('Stream distant reçu de:', participant.id);
      setParticipants(prev => {
        const newParticipants = new Map(prev);
        newParticipants.set(participant.id, {
          id: participant.id,
          name: participant.name || `Utilisateur ${participant.id}`,
          stream: remoteStream,
          audioEnabled: true,
          videoEnabled: true,
          isLocal: false,
          connection: peerConnection
        });
        return newParticipants;
      });
    };

    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          to: participant.id
        }));
      }
    };

    peerConnection.onconnectionstatechange = () => {
      console.log(`Connexion avec ${participant.id}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        toast({ title: `Connecté à ${participant.name || participant.id}` });
      }
    };

    try {
      const offer = await peerConnection.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true
      });
      await peerConnection.setLocalDescription(offer);

      wsRef.current?.send(JSON.stringify({
        type: 'offer',
        offer,
        to: participant.id
      }));
    } catch (error) {
      console.error('Erreur création offre:', error);
    }
  };

  // Gestion participant quitté
  const handleParticipantLeft = (participantId: string) => {
    const connection = peerConnectionsRef.current.get(participantId);
    if (connection) {
      connection.close();
      peerConnectionsRef.current.delete(participantId);
    }

    setParticipants(prev => {
      const newParticipants = new Map(prev);
      newParticipants.delete(participantId);
      return newParticipants;
    });
  };

  // Gestion des offres WebRTC
  const handleOffer = async (offer: RTCSessionDescriptionInit, from: string) => {
    const peerConnection = peerConnectionsRef.current.get(from);
    if (!peerConnection) return;

    await peerConnection.setRemoteDescription(offer);
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    wsRef.current?.send(JSON.stringify({
      type: 'answer',
      answer,
      to: from
    }));
  };

  // Gestion des réponses WebRTC
  const handleAnswer = async (answer: RTCSessionDescriptionInit, from: string) => {
    const peerConnection = peerConnectionsRef.current.get(from);
    if (peerConnection) {
      await peerConnection.setRemoteDescription(answer);
    }
  };

  // Gestion des candidats ICE
  const handleIceCandidate = async (candidate: RTCIceCandidateInit, from: string) => {
    const peerConnection = peerConnectionsRef.current.get(from);
    if (peerConnection) {
      await peerConnection.addIceCandidate(candidate);
    }
  };

  // Gestion des messages chat
  const handleChatMessage = (message: any) => {
    setChatMessages(prev => [...prev, {
      id: Date.now().toString(),
      sender: message.sender,
      message: message.text,
      timestamp: new Date()
    }]);
  };

  // Gestion mise à jour participant
  const handleParticipantUpdate = (participant: any) => {
    setParticipants(prev => {
      const newParticipants = new Map(prev);
      const existing = newParticipants.get(participant.id);
      if (existing) {
        newParticipants.set(participant.id, {
          ...existing,
          ...participant
        });
      }
      return newParticipants;
    });
  };

  // Contrôles audio/vidéo
  const toggleAudio = async () => {
    try {
      if (!localStreamRef.current) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });
        
        if (!localStreamRef.current) {
          localStreamRef.current = audioStream;
        } else {
          audioStream.getAudioTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
          });
        }
        
        setIsAudioEnabled(true);
        
        peerConnectionsRef.current.forEach(pc => {
          audioStream.getAudioTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
          });
        });
        
        toast({ title: "Microphone activé" });
      } else {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = !audioTrack.enabled;
          setIsAudioEnabled(audioTrack.enabled);
          toast({ title: audioTrack.enabled ? "Microphone activé" : "Microphone désactivé" });
        } else {
          const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
          audioStream.getAudioTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
            peerConnectionsRef.current.forEach(pc => {
              pc.addTrack(track, localStreamRef.current!);
            });
          });
          setIsAudioEnabled(true);
          toast({ title: "Microphone activé" });
        }
      }
      
      wsRef.current?.send(JSON.stringify({
        type: 'participant-update',
        participant: {
          id: authUser?.id.toString(),
          audioEnabled: isAudioEnabled
        }
      }));
      
    } catch (error) {
      console.error('Erreur toggle audio:', error);
      toast({
        title: "Erreur microphone",
        description: "Impossible d'accéder au microphone",
        variant: "destructive"
      });
    }
  };

  const toggleVideo = async () => {
    try {
      if (!localStreamRef.current) {
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            frameRate: { ideal: 30 }
          }
        });
        
        localStreamRef.current = videoStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        setIsVideoEnabled(true);
        
        peerConnectionsRef.current.forEach(pc => {
          videoStream.getVideoTracks().forEach(track => {
            pc.addTrack(track, localStreamRef.current!);
          });
        });
        
        toast({ title: "Caméra activée" });
      } else {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !videoTrack.enabled;
          setIsVideoEnabled(videoTrack.enabled);
          toast({ title: videoTrack.enabled ? "Caméra activée" : "Caméra désactivée" });
        } else {
          const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStream.getVideoTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
            peerConnectionsRef.current.forEach(pc => {
              pc.addTrack(track, localStreamRef.current!);
            });
          });
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = localStreamRef.current;
          }
          
          setIsVideoEnabled(true);
          toast({ title: "Caméra activée" });
        }
      }
      
      wsRef.current?.send(JSON.stringify({
        type: 'participant-update',
        participant: {
          id: authUser?.id.toString(),
          videoEnabled: isVideoEnabled
        }
      }));
      
    } catch (error) {
      console.error('Erreur toggle vidéo:', error);
      toast({
        title: "Erreur caméra",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive"
      });
    }
  };

  const startScreenShare = async () => {
    if (isScreenSharing) {
      // Arrêter le partage d'écran
      await stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 }
        },
        audio: true
      });

      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const screenTrack = screenStream.getVideoTracks()[0];
        
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === videoTrack);
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        if (videoTrack) {
          localStreamRef.current.removeTrack(videoTrack);
        }
        localStreamRef.current.addTrack(screenTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      setIsScreenSharing(true);
      
      // Gérer l'arrêt automatique quand l'utilisateur arrête le partage
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      toast({
        title: "Partage d'écran démarré",
        description: "Votre écran est maintenant partagé avec les participants"
      });

    } catch (error) {
      console.error('Erreur partage écran:', error);
      toast({
        title: "Erreur partage d'écran",
        description: "Impossible de partager l'écran. Vérifiez les permissions.",
        variant: "destructive"
      });
    }
  };

  const stopScreenShare = async () => {
    try {
      setIsScreenSharing(false);
      
      // Restaurer la caméra
      if (isVideoEnabled) {
        await restoreCamera();
      } else {
        // Si la vidéo était désactivée, juste arrêter le partage
        if (localStreamRef.current) {
          const screenTrack = localStreamRef.current.getVideoTracks()[0];
          if (screenTrack && screenTrack.kind === 'video') {
            screenTrack.stop();
            localStreamRef.current.removeTrack(screenTrack);
          }
        }
      }

      toast({
        title: "Partage d'écran arrêté",
        description: "Le partage d'écran a été interrompu"
      });

    } catch (error) {
      console.error('Erreur arrêt partage:', error);
    }
  };

  const restoreCamera = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      const videoTrack = cameraStream.getVideoTracks()[0];
      
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      if (localStreamRef.current) {
        const oldTrack = localStreamRef.current.getVideoTracks()[0];
        localStreamRef.current.removeTrack(oldTrack);
        localStreamRef.current.addTrack(videoTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

    } catch (error) {
      console.error('Erreur restauration caméra:', error);
    }
  };

  const sendChatMessage = () => {
    if (newMessage.trim() && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'chat-message',
        message: {
          sender: authUser?.displayName || authUser?.username || 'Anonyme',
          text: newMessage,
          timestamp: new Date()
        }
      }));
      setNewMessage('');
    }
  };

  const toggleRecording = () => {
    setIsRecording(!isRecording);
    toast({
      title: isRecording ? "Enregistrement arrêté" : "Enregistrement démarré",
      description: isRecording ? "L'enregistrement a été sauvegardé" : "L'enregistrement est en cours"
    });
  };

  const leaveRoom = () => {
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    wsRef.current?.close();
    
    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  // Raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      
      switch (event.key.toLowerCase()) {
        case 'm':
          event.preventDefault();
          toggleAudio();
          break;
        case 'v':
          event.preventDefault();
          toggleVideo();
          break;
        case 's':
          event.preventDefault();
          startScreenShare();
          break;
        case 'r':
          event.preventDefault();
          setIsHandRaised(!isHandRaised);
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isHandRaised]);

  // Initialisation immédiate
  useEffect(() => {
    if (roomCode && authUser) {
      initializeLocalStream();
      initializeWebSocket();
    }

    return () => {
      peerConnectionsRef.current.forEach(pc => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      wsRef.current?.close();
    };
  }, [roomCode, authUser, initializeWebSocket]);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Code de réunion manquant</h2>
          <p className="text-gray-600 mb-6">Un code de réunion valide est requis</p>
          <Button onClick={() => setLocation('/')} className="w-full">
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className={`h-screen w-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 text-white flex flex-col overflow-hidden ${
        isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-xl shadow-2xl border border-gray-600' : ''
      } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
        
        {/* Barre de navigation supérieure moderne */}
        <div className="bg-black/40 backdrop-blur-xl px-6 py-4 flex items-center justify-between border-b border-gray-700/50 flex-shrink-0 z-20">
          <div className="flex items-center space-x-6">
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full animate-pulse shadow-lg ${
                connectionStatus === 'connected' ? 'bg-green-500 shadow-green-500/50' : 
                connectionStatus === 'connecting' ? 'bg-yellow-500 shadow-yellow-500/50' : 'bg-red-500 shadow-red-500/50'
              }`}></div>
              <h1 className="font-bold text-lg bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
                RonyMeet Pro
              </h1>
            </div>
            
            <Separator orientation="vertical" className="h-6 bg-gray-600" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={copyRoomCode}
                  className="text-xs border-gray-600 hover:bg-gray-700/50 hover:border-blue-500 transition-all duration-200"
                >
                  <Copy className="h-3 w-3 mr-2" />
                  {roomCode}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Copier le code de la réunion</TooltipContent>
            </Tooltip>
            
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-600/20 border-blue-600 text-blue-200 px-3 py-1">
                <Users className="h-3 w-3 mr-1" />
                {participants.size + 1}
              </Badge>
              
              <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200 px-3 py-1">
                <Crown className="h-3 w-3 mr-1" />
                WebRTC Pro
              </Badge>
              
              {isRecording && (
                <Badge variant="outline" className="bg-red-600/20 border-red-600 text-red-200 px-3 py-1 animate-pulse">
                  <Circle className="h-3 w-3 mr-1 fill-current" />
                  LIVE
                </Badge>
              )}
              
              {isLocked && (
                <Badge variant="outline" className="bg-yellow-600/20 border-yellow-600 text-yellow-200 px-3 py-1">
                  <Lock className="h-3 w-3 mr-1" />
                  Verrouillée
                </Badge>
              )}
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
                  className="hover:bg-gray-700/50"
                >
                  {layoutMode === 'grid' ? <PictureInPicture className="h-4 w-4" /> : <Grid3X3 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Changer la disposition</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsFullscreen(!isFullscreen)}
                  className="hover:bg-gray-700/50"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Plein écran</TooltipContent>
            </Tooltip>
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => setIsMinimized(!isMinimized)}
                  className="hover:bg-gray-700/50"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Réduire</TooltipContent>
            </Tooltip>
            
            <Separator orientation="vertical" className="h-6 bg-gray-600" />
            
            <Tooltip>
              <TooltipTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={leaveRoom} 
                  className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Quitter la réunion</TooltipContent>
            </Tooltip>
          </div>
        </div>

        <div className="flex-1 flex relative h-full">
          {/* Zone vidéo principale avec mosaïque dynamique */}
          <div className="flex-1 relative bg-gradient-to-br from-gray-900 to-black overflow-hidden">
            {/* Grille des participants en mosaïque */}
            <div className={`h-full p-4 ${getGridLayout()}`}>
              {/* Vidéo locale */}
              <div className="relative group">
                <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700/50 hover:border-blue-500/50 transition-all duration-300 aspect-video">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Overlay des informations */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
                    <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                      <div className="bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full">
                        <span className="text-sm font-medium text-white">
                          {localParticipant?.name} (Vous)
                        </span>
                      </div>
                      {isHandRaised && (
                        <div className="bg-yellow-500/20 backdrop-blur-sm px-2 py-1 rounded-full border border-yellow-500">
                          <Hand className="h-3 w-3 text-yellow-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Indicateurs d'état */}
                  <div className="absolute top-4 right-4 flex space-x-2">
                    {!isAudioEnabled && (
                      <div className="bg-red-600/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                        <MicOff className="h-4 w-4 text-white" />
                      </div>
                    )}
                    {isScreenSharing && (
                      <div className="bg-blue-600/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                        <ScreenShare className="h-4 w-4 text-white" />
                      </div>
                    )}
                    {pinnedParticipant === 'local' && (
                      <div className="bg-green-600/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                        <Pin className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Placeholder vidéo désactivée */}
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                      <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                        <Camera className="h-10 w-10 text-gray-400" />
                      </div>
                      <p className="text-gray-400 text-sm">Caméra désactivée</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Vidéos des participants distants */}
              {Array.from(participants.values()).map((participant) => (
                <div key={participant.id} className="relative group">
                  <div className="relative bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden shadow-2xl border border-gray-700/50 hover:border-green-500/50 transition-all duration-300 aspect-video">
                    <video
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                      ref={(video) => {
                        if (video && participant.stream) {
                          video.srcObject = participant.stream;
                        }
                      }}
                    />
                    
                    {/* Overlay des informations */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none">
                      <div className="absolute bottom-4 left-4 flex items-center space-x-2">
                        <div className="bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full">
                          <span className="text-sm font-medium text-white">
                            {participant.name}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Indicateurs d'état */}
                    <div className="absolute top-4 right-4 flex space-x-2">
                      {!participant.audioEnabled && (
                        <div className="bg-red-600/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                          <MicOff className="h-4 w-4 text-white" />
                        </div>
                      )}
                      {pinnedParticipant === participant.id && (
                        <div className="bg-green-600/90 backdrop-blur-sm p-2 rounded-full shadow-lg">
                          <Pin className="h-4 w-4 text-white" />
                        </div>
                      )}
                    </div>
                    
                    {/* Placeholder vidéo désactivée */}
                    {!participant.videoEnabled && (
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                        <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                          <Users className="h-10 w-10 text-gray-400" />
                        </div>
                        <p className="text-gray-400 text-sm">{participant.name}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Barre de contrôles principale moderne */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
              <div className="bg-black/60 backdrop-blur-xl rounded-2xl px-8 py-4 border border-gray-700/50 shadow-2xl">
                <div className="flex items-center space-x-4">
                  {/* Contrôles principaux */}
                  <div className="flex items-center space-x-3">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isAudioEnabled ? "secondary" : "destructive"}
                          size="lg"
                          onClick={toggleAudio}
                          className="rounded-full w-14 h-14 p-0 shadow-lg transition-all duration-200 hover:scale-105"
                        >
                          {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isAudioEnabled ? "Désactiver le micro" : "Activer le micro"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isVideoEnabled ? "secondary" : "destructive"}
                          size="lg"
                          onClick={toggleVideo}
                          className="rounded-full w-14 h-14 p-0 shadow-lg transition-all duration-200 hover:scale-105"
                        >
                          {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isVideoEnabled ? "Désactiver la caméra" : "Activer la caméra"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <Separator orientation="vertical" className="h-10 bg-gray-600" />
                  
                  {/* Contrôles secondaires */}
                  <div className="flex items-center space-x-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isScreenSharing ? "default" : "secondary"}
                          size="sm"
                          onClick={startScreenShare}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105"
                        >
                          {isScreenSharing ? <ScreenShareOff className="h-5 w-5" /> : <ScreenShare className="h-5 w-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isRecording ? "destructive" : "secondary"}
                          size="sm"
                          onClick={toggleRecording}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105"
                        >
                          <Circle className={`h-5 w-5 ${isRecording ? 'animate-pulse' : ''}`} />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isRecording ? "Arrêter l'enregistrement" : "Démarrer l'enregistrement"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isHandRaised ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setIsHandRaised(!isHandRaised)}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105"
                        >
                          <Hand className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {isHandRaised ? "Baisser la main" : "Lever la main"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <Separator orientation="vertical" className="h-10 bg-gray-600" />
                  
                  {/* Contrôles d'interface */}
                  <div className="flex items-center space-x-2">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showParticipants ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setShowParticipants(!showParticipants)}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105"
                        >
                          <Users className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Participants</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showChat ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setShowChat(!showChat)}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 relative"
                        >
                          <MessageSquare className="h-5 w-5" />
                          {chatMessages.length > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                              {chatMessages.length}
                            </div>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Chat</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setShowReactions(!showReactions)}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 relative"
                        >
                          <span className="text-lg">👍</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Réactions</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showWhiteboard ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setShowWhiteboard(!showWhiteboard)}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105"
                        >
                          <FileText className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Tableau blanc</TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={showSettings ? "default" : "secondary"}
                          size="sm"
                          onClick={() => setShowSettings(!showSettings)}
                          className="rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105"
                        >
                          <Settings className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Paramètres</TooltipContent>
                    </Tooltip>
                  </div>
                  
                  <Separator orientation="vertical" className="h-10 bg-gray-600" />
                  
                  {/* Bouton de sortie */}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={leaveRoom}
                        className="rounded-full w-14 h-14 p-0 shadow-lg transition-all duration-200 hover:scale-105"
                      >
                        <PhoneOff className="h-6 w-6" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Quitter la réunion</TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Panneau des participants avec écrans verticaux comme Jitsi */}
          {showParticipants && (
            <div className="w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="font-semibold flex items-center text-lg">
                  <Users className="h-5 w-5 mr-2 text-green-400" />
                  Participants ({participants.size + 1})
                </h3>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-3">
                {/* Participant local */}
                <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                      <span className="text-sm font-bold text-white">
                        {(localParticipant?.name || 'Vous').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white">{localParticipant?.name} (Vous)</div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <div className={`w-2 h-2 rounded-full ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>{isAudioEnabled ? 'Micro activé' : 'Micro coupé'}</span>
                        <div className={`w-2 h-2 rounded-full ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>{isVideoEnabled ? 'Caméra activée' : 'Caméra coupée'}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      {isHandRaised && (
                        <div className="bg-yellow-500/20 p-1 rounded">
                          <Hand className="h-3 w-3 text-yellow-400" />
                        </div>
                      )}
                      {isScreenSharing && (
                        <div className="bg-blue-500/20 p-1 rounded">
                          <ScreenShare className="h-3 w-3 text-blue-400" />
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Écran vertical du participant local */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{aspectRatio: '9/16', height: '120px'}}>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                        <Camera className="h-6 w-6 text-gray-500" />
                      </div>
                    )}
                    {!isAudioEnabled && (
                      <div className="absolute top-2 right-2 bg-red-600 p-1 rounded">
                        <MicOff className="h-2 w-2 text-white" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants distants */}
                {Array.from(participants.values()).map((participant) => (
                  <div key={participant.id} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-10 h-10 bg-green-600 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">
                          {participant.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white">{participant.name}</div>
                        <div className="flex items-center space-x-2 text-xs text-gray-400">
                          <div className={`w-2 h-2 rounded-full ${participant.audioEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span>{participant.audioEnabled ? 'Micro activé' : 'Micro coupé'}</span>
                          <div className={`w-2 h-2 rounded-full ${participant.videoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                          <span>{participant.videoEnabled ? 'Caméra activée' : 'Caméra coupée'}</span>
                        </div>
                      </div>
                      <div className="flex space-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setPinnedParticipant(pinnedParticipant === participant.id ? null : participant.id)}
                              className="h-6 w-6 p-0"
                            >
                              {pinnedParticipant === participant.id ? 
                                <PinOff className="h-3 w-3 text-green-400" /> : 
                                <Pin className="h-3 w-3 text-gray-400" />
                              }
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Épingler le participant</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                    
                    {/* Écran vertical du participant distant */}
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{aspectRatio: '9/16', height: '120px'}}>
                      <video
                        autoPlay
                        playsInline
                        className="w-full h-full object-cover"
                        ref={(video) => {
                          if (video && participant.stream) {
                            video.srcObject = participant.stream;
                          }
                        }}
                      />
                      {!participant.videoEnabled && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                          <Users className="h-6 w-6 text-gray-500" />
                        </div>
                      )}
                      {!participant.audioEnabled && (
                        <div className="absolute top-2 right-2 bg-red-600 p-1 rounded">
                          <MicOff className="h-2 w-2 text-white" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Panneau de chat moderne */}
          {showChat && (
            <div className="w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="font-semibold flex items-center text-lg">
                  <MessageSquare className="h-5 w-5 mr-2 text-blue-400" />
                  Chat
                  {chatMessages.length > 0 && (
                    <Badge variant="secondary" className="ml-2 bg-blue-600/20 text-blue-200">
                      {chatMessages.length}
                    </Badge>
                  )}
                </h3>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
                {chatMessages.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Aucun message pour le moment</p>
                    <p className="text-sm mt-2">Soyez le premier à écrire quelque chose!</p>
                  </div>
                ) : (
                  chatMessages.map((msg) => (
                    <div key={msg.id} className="bg-gray-800/50 rounded-lg p-3 hover:bg-gray-800/70 transition-colors">
                      <div className="font-medium text-blue-300 text-sm">{msg.sender}</div>
                      <div className="text-gray-200 mt-1 break-words">{msg.message}</div>
                      <div className="text-xs text-gray-500 mt-2">
                        {msg.timestamp.toLocaleTimeString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              <div className="p-4 border-t border-gray-700/50">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Tapez votre message..."
                    className="flex-1 bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none placeholder-gray-500"
                  />
                  <Button 
                    size="sm" 
                    onClick={sendChatMessage} 
                    disabled={!newMessage.trim()}
                    className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Panneau de paramètres avancés */}
          {showSettings && (
            <div className="w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col">
              <div className="p-4 border-b border-gray-700/50">
                <h3 className="font-semibold flex items-center text-lg">
                  <Settings className="h-5 w-5 mr-2 text-purple-400" />
                  Paramètres
                </h3>
              </div>
              
              <div className="flex-1 p-4 overflow-y-auto space-y-6">
                {/* Paramètres audio */}
                <div className="space-y-3">
                  <h4 className="font-medium text-white flex items-center">
                    <Volume2 className="h-4 w-4 mr-2 text-green-400" />
                    Audio
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Suppression du bruit</span>
                      <Button
                        variant={isNoiseSuppressionEnabled ? "default" : "outline"}
                        size="sm"
                        onClick={() => setIsNoiseSuppressionEnabled(!isNoiseSuppressionEnabled)}
                        className="h-6 text-xs"
                      >
                        {isNoiseSuppressionEnabled ? "Activé" : "Désactivé"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Paramètres vidéo */}
                <div className="space-y-3">
                  <h4 className="font-medium text-white flex items-center">
                    <Video className="h-4 w-4 mr-2 text-blue-400" />
                    Vidéo
                  </h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Qualité vidéo</span>
                      <select
                        value={videoQuality}
                        onChange={(e) => setVideoQuality(e.target.value as 'low' | 'medium' | 'high')}
                        className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-xs text-white"
                      >
                        <option value="low">Faible</option>
                        <option value="medium">Moyenne</option>
                        <option value="high">Haute</option>
                      </select>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">Arrière-plan virtuel</span>
                      <Button
                        variant={virtualBackground ? "default" : "outline"}
                        size="sm"
                        onClick={() => setVirtualBackground(virtualBackground ? null : 'blur')}
                        className="h-6 text-xs"
                      >
                        {virtualBackground ? "Activé" : "Désactivé"}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Paramètres de disposition */}
                <div className="space-y-3">
                  <h4 className="font-medium text-white flex items-center">
                    <Layout className="h-4 w-4 mr-2 text-orange-400" />
                    Disposition
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={layoutMode === 'grid' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLayoutMode('grid')}
                      className="text-xs"
                    >
                      <Grid3X3 className="h-3 w-3 mr-1" />
                      Grille
                    </Button>
                    <Button
                      variant={layoutMode === 'speaker' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLayoutMode('speaker')}
                      className="text-xs"
                    >
                      <PictureInPicture className="h-3 w-3 mr-1" />
                      Orateur
                    </Button>
                    <Button
                      variant={layoutMode === 'presentation' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLayoutMode('presentation')}
                      className="text-xs"
                    >
                      <Presentation className="h-3 w-3 mr-1" />
                      Présentation
                    </Button>
                    <Button
                      variant={layoutMode === 'filmstrip' ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLayoutMode('filmstrip')}
                      className="text-xs"
                    >
                      <Tv className="h-3 w-3 mr-1" />
                      Pellicule
                    </Button>
                  </div>
                </div>

                {/* Raccourcis clavier */}
                <div className="space-y-3">
                  <h4 className="font-medium text-white">Raccourcis clavier</h4>
                  <div className="space-y-2 text-xs text-gray-400">
                    <div className="flex justify-between">
                      <span>Couper/Activer micro</span>
                      <span className="font-mono bg-gray-800 px-2 py-1 rounded">M</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Couper/Activer caméra</span>
                      <span className="font-mono bg-gray-800 px-2 py-1 rounded">V</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Partager écran</span>
                      <span className="font-mono bg-gray-800 px-2 py-1 rounded">S</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Lever la main</span>
                      <span className="font-mono bg-gray-800 px-2 py-1 rounded">R</span>
                    </div>
                  </div>
                </div>

                {/* Statistiques de connexion */}
                <div className="space-y-3">
                  <h4 className="font-medium text-white flex items-center">
                    <Signal className="h-4 w-4 mr-2 text-cyan-400" />
                    Statistiques
                  </h4>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between text-gray-400">
                      <span>Statut de connexion:</span>
                      <span className={`font-medium ${
                        connectionStatus === 'connected' ? 'text-green-400' : 
                        connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {connectionStatus === 'connected' ? 'Connecté' : 
                         connectionStatus === 'connecting' ? 'Connexion...' : 'Déconnecté'}
                      </span>
                    </div>
                    <div className="flex justify-between text-gray-400">
                      <span>Participants:</span>
                      <span className="text-white">{participants.size + 1}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Panneau de réactions flottantes */}
          {showReactions && (
            <div className="absolute bottom-32 right-8 bg-black/80 backdrop-blur-xl rounded-2xl p-4 border border-gray-700/50 shadow-2xl">
              <div className="grid grid-cols-4 gap-3">
                {['👍', '👏', '❤️', '😊', '😂', '😮', '👎', '🔥'].map((emoji) => (
                  <Button
                    key={emoji}
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      // Envoyer la réaction
                      wsRef.current?.send(JSON.stringify({
                        type: 'reaction',
                        emoji,
                        sender: authUser?.displayName || authUser?.username || 'Anonyme'
                      }));
                      setShowReactions(false);
                    }}
                    className="text-2xl p-2 h-12 w-12 hover:bg-gray-700/50 rounded-xl transition-all duration-200 hover:scale-110"
                  >
                    {emoji}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Overlay de chargement amélioré */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="text-center">
              <div className="relative">
                <Loader2 className="h-20 w-20 animate-spin text-blue-500 mx-auto mb-8" />
                <div className="absolute inset-0 h-20 w-20 border-4 border-blue-500/20 rounded-full animate-ping mx-auto"></div>
              </div>
              <h3 className="text-2xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
                RonyMeet Pro
              </h3>
              <p className="text-gray-300 text-lg mb-6">Initialisation de la vidéoconférence avancée...</p>
              <div className="flex justify-center space-x-6 mb-6">
                <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200 px-4 py-2">
                  <Crown className="h-4 w-4 mr-2" />
                  WebRTC Pro
                </Badge>
                <Badge variant="outline" className="bg-blue-600/20 border-blue-600 text-blue-200 px-4 py-2">
                  Enregistrement HD
                </Badge>
                <Badge variant="outline" className="bg-purple-600/20 border-purple-600 text-purple-200 px-4 py-2">
                  IA Intégrée
                </Badge>
              </div>
              <div className="w-80 bg-gray-800 rounded-full h-3 mx-auto overflow-hidden">
                <div className="bg-gradient-to-r from-blue-500 via-green-500 to-purple-500 h-3 rounded-full animate-pulse transition-all duration-1000" style={{width: '92%'}}></div>
              </div>
              <p className="text-gray-500 text-sm mt-4">Technologies autonomes • Aucune dépendance externe</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoConferenceWebRTC;