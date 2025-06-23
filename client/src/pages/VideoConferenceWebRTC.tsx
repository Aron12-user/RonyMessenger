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
  const [showControlBar, setShowControlBar] = useState(true);
  const [controlBarTimeout, setControlBarTimeout] = useState<NodeJS.Timeout | null>(null);
  
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
      return 'grid grid-cols-1 lg:grid-cols-6 gap-2';
    }
    
    // Mode grille automatique - plus compact
    if (totalParticipants === 1) return 'grid grid-cols-1 gap-2 p-4';
    if (totalParticipants === 2) return 'grid grid-cols-1 lg:grid-cols-2 gap-2 p-4';
    if (totalParticipants <= 4) return 'grid grid-cols-2 gap-2 p-2';
    if (totalParticipants <= 6) return 'grid grid-cols-2 lg:grid-cols-3 gap-2 p-2';
    if (totalParticipants <= 9) return 'grid grid-cols-3 gap-1 p-2';
    if (totalParticipants <= 12) return 'grid grid-cols-3 lg:grid-cols-4 gap-1 p-1';
    return 'grid grid-cols-4 lg:grid-cols-5 gap-1 p-1';
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
      
      wsRef.current?.send(JSON.stringify({
        type: 'user-info',
        info: {
          userId: authUser.id,
          displayName: authUser.displayName || authUser.username,
          username: authUser.username
        }
      }));

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

  // Initialisation du stream local avec demande automatique d'autorisation
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

      // Demander automatiquement les autorisations au démarrage
      try {
        // Demander d'abord l'autorisation caméra avec qualité maximale
        const videoConstraints = {
          width: { ideal: 3840, max: 3840, min: 640 },
          height: { ideal: 2160, max: 2160, min: 480 },
          frameRate: { ideal: 60, max: 60, min: 15 },
          facingMode: 'user'
        };

        let stream;
        try {
          // Tentative 4K
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true,
              sampleRate: 48000
            }
          });
        } catch (e) {
          // Fallback Full HD
          const hdConstraints = {
            width: { ideal: 1920, max: 1920, min: 640 },
            height: { ideal: 1080, max: 1080, min: 480 },
            frameRate: { ideal: 30, max: 30, min: 15 },
            facingMode: 'user'
          };
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: hdConstraints,
            audio: {
              echoCancellation: true,
              noiseSuppression: true,
              autoGainControl: true
            }
          });
        }

        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Désactiver par défaut mais autorisation obtenue
        stream.getAudioTracks().forEach(track => track.enabled = false);
        stream.getVideoTracks().forEach(track => track.enabled = false);
        
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);

        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack ? videoTrack.getSettings() : null;
        
        toast({
          title: "Vidéoconférence prête",
          description: settings ? `Résolution: ${settings.width}x${settings.height}` : "Cliquez sur les boutons pour activer micro/caméra"
        });

      } catch (permissionError) {
        console.log('Autorisation refusée au démarrage:', permissionError);
        
        // Continuer sans stream, l'utilisateur pourra activer manuellement
        setIsAudioEnabled(false);
        setIsVideoEnabled(false);
        
        toast({
          title: "Autorisations requises",
          description: "Cliquez sur micro/caméra pour autoriser l'accès",
          variant: "default"
        });
      }

    } catch (error) {
      console.error('Erreur initialisation:', error);
      toast({
        title: "Erreur d'initialisation",
        description: "Impossible d'initialiser la vidéoconférence",
        variant: "destructive"
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

  // Contrôles audio améliorés
  const toggleAudio = async () => {
    try {
      if (!localStreamRef.current) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: isNoiseSuppressionEnabled,
            autoGainControl: true,
            sampleRate: 48000
          }
        });
        
        localStreamRef.current = audioStream;
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
          const audioStream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
              echoCancellation: true,
              noiseSuppression: isNoiseSuppressionEnabled,
              autoGainControl: true
            }
          });
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
    } catch (error) {
      console.error('Erreur toggle audio:', error);
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast({
          title: "Permission refusée",
          description: "Autorisez l'accès au microphone dans votre navigateur",
          variant: "destructive"
        });
      }
    }
  };

  // Contrôles vidéo améliorés avec autorisation forcée
  const toggleVideo = async () => {
    try {
      if (!isVideoEnabled) {
        // Demande explicite d'autorisation avec contraintes 4K
        const videoConstraints = {
          width: { ideal: 3840, max: 3840, min: 640 },
          height: { ideal: 2160, max: 2160, min: 480 },
          frameRate: { ideal: 60, max: 60, min: 15 },
          facingMode: 'user'
        };

        // Première tentative avec 4K
        let stream;
        try {
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: videoConstraints,
            audio: false 
          });
        } catch (e) {
          // Fallback vers Full HD si 4K échoue
          const hdConstraints = {
            width: { ideal: 1920, max: 1920, min: 640 },
            height: { ideal: 1080, max: 1080, min: 480 },
            frameRate: { ideal: 30, max: 30, min: 15 },
            facingMode: 'user'
          };
          stream = await navigator.mediaDevices.getUserMedia({ 
            video: hdConstraints,
            audio: false 
          });
        }
        
        // Remplacer ou ajouter le track vidéo
        if (localStreamRef.current) {
          const existingVideoTrack = localStreamRef.current.getVideoTracks()[0];
          if (existingVideoTrack) {
            localStreamRef.current.removeTrack(existingVideoTrack);
            existingVideoTrack.stop();
          }
          
          stream.getVideoTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
          });
        } else {
          localStreamRef.current = stream;
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
        
        setIsVideoEnabled(true);
        
        // Ajouter aux connexions peer
        peerConnectionsRef.current.forEach(pc => {
          stream.getVideoTracks().forEach(track => {
            const sender = pc.getSenders().find(s => s.track?.kind === 'video');
            if (sender) {
              sender.replaceTrack(track);
            } else {
              pc.addTrack(track, localStreamRef.current!);
            }
          });
        });
        
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        
        toast({ 
          title: "Caméra activée", 
          description: `${settings.width}x${settings.height} @ ${settings.frameRate}fps`
        });
        
      } else {
        // Désactiver la vidéo
        if (localStreamRef.current) {
          const videoTrack = localStreamRef.current.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.stop();
            localStreamRef.current.removeTrack(videoTrack);
          }
        }
        
        setIsVideoEnabled(false);
        toast({ title: "Caméra désactivée" });
      }
      
      // Notifier les autres participants
      wsRef.current?.send(JSON.stringify({
        type: 'participant-update',
        participant: {
          id: authUser?.id.toString(),
          videoEnabled: !isVideoEnabled
        }
      }));
      
    } catch (error) {
      console.error('Erreur toggle vidéo:', error);
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          // Guide l'utilisateur pour autoriser la caméra
          toast({
            title: "Autorisation caméra requise",
            description: "Cliquez sur l'icône caméra dans la barre d'adresse pour autoriser l'accès",
            variant: "destructive"
          });
          
          // Tentative de redirection vers les paramètres
          if (navigator.permissions) {
            navigator.permissions.query({name: 'camera' as PermissionName}).then(result => {
              if (result.state === 'denied') {
                toast({
                  title: "Caméra bloquée",
                  description: "Débloquez la caméra dans les paramètres du navigateur",
                  variant: "destructive"
                });
              }
            });
          }
        } else if (error.name === 'NotFoundError') {
          toast({
            title: "Caméra non trouvée",
            description: "Aucune caméra détectée sur cet appareil",
            variant: "destructive"
          });
        } else if (error.name === 'NotReadableError') {
          toast({
            title: "Caméra occupée",
            description: "La caméra est utilisée par une autre application",
            variant: "destructive"
          });
        }
      }
    }
  };

  // Partage d'écran avec arrêt fonctionnel
  const startScreenShare = async () => {
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
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
      
      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      toast({ title: "Partage d'écran démarré" });
    } catch (error) {
      console.error('Erreur partage écran:', error);
      toast({
        title: "Erreur partage d'écran",
        description: "Impossible de partager l'écran",
        variant: "destructive"
      });
    }
  };

  const stopScreenShare = async () => {
    try {
      setIsScreenSharing(false);
      
      if (isVideoEnabled) {
        await restoreCamera();
      } else {
        if (localStreamRef.current) {
          const screenTrack = localStreamRef.current.getVideoTracks()[0];
          if (screenTrack) {
            screenTrack.stop();
            localStreamRef.current.removeTrack(screenTrack);
          }
        }
      }

      toast({ title: "Partage d'écran arrêté" });
    } catch (error) {
      console.error('Erreur arrêt partage:', error);
    }
  };

  const restoreCamera = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 } },
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
        if (oldTrack) {
          localStreamRef.current.removeTrack(oldTrack);
        }
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
      title: isRecording ? "Enregistrement arrêté" : "Enregistrement démarré"
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

  // Gestion automatique de la barre de contrôles comme Jitsi
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;
    
    const hideControlBar = () => {
      hideTimeout = setTimeout(() => {
        setShowControlBar(false);
      }, 3000);
    };
    
    const showControlBar = () => {
      setShowControlBar(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setShowControlBar(false);
      }, 3000);
    };

    // Afficher au début puis cacher
    setShowControlBar(true);
    hideControlBar();
    
    // Écouter les mouvements de souris
    const handleMouseMove = (e: MouseEvent) => {
      // Afficher seulement si la souris est dans le tiers inférieur
      if (e.clientY > window.innerHeight * 0.7) {
        showControlBar();
      }
    };

    const handleMouseLeave = () => {
      setShowControlBar(false);
      clearTimeout(hideTimeout);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseleave', handleMouseLeave);
    
    return () => {
      clearTimeout(hideTimeout);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, []);

  // Mode plein écran système (pas navigateur)
  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        // Entrer en mode plein écran système
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
          await elem.requestFullscreen();
        } else if ((elem as any).webkitRequestFullscreen) {
          await (elem as any).webkitRequestFullscreen();
        } else if ((elem as any).mozRequestFullScreen) {
          await (elem as any).mozRequestFullScreen();
        } else if ((elem as any).msRequestFullscreen) {
          await (elem as any).msRequestFullscreen();
        }
        setIsFullscreen(true);
        toast({ title: "Mode plein écran activé" });
      } else {
        // Sortir du mode plein écran
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          await (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          await (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          await (document as any).msExitFullscreen();
        }
        setIsFullscreen(false);
        toast({ title: "Mode plein écran désactivé" });
      }
    } catch (error) {
      console.error('Erreur plein écran:', error);
      toast({
        title: "Erreur plein écran",
        description: "Impossible d'activer le mode plein écran",
        variant: "destructive"
      });
    }
  };

  // Écouter les changements de plein écran
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

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
        case 'f':
          event.preventDefault();
          toggleFullscreen();
          break;
        case 'escape':
          if (isFullscreen) {
            event.preventDefault();
            toggleFullscreen();
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [isHandRaised, isFullscreen]);

  // Initialisation
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
      <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
        
        {/* Barre de navigation ultra-transparente - invisible par défaut */}
        <div className={`absolute top-0 left-0 right-0 z-30 transition-all duration-500 ${
          showControlBar ? 'opacity-100 bg-black/10 backdrop-blur-sm' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-1.5 h-1.5 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <h1 className="font-medium text-xs text-white/80">
                  RonyMeet Pro
                </h1>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomCode}
                className="text-xs border border-white/20 hover:bg-white/10 h-6 px-2 text-white/70"
              >
                <Copy className="h-2.5 w-2.5 mr-1" />
                {roomCode}
              </Button>
              
              <div className="bg-white/10 px-2 py-1 rounded text-xs text-white/70">
                <Users className="h-2.5 w-2.5 mr-1 inline" />
                {participants.size + 1}
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
                className="hover:bg-white/10 h-6 w-6 p-0 text-white/70"
              >
                {layoutMode === 'grid' ? <PictureInPicture className="h-2.5 w-2.5" /> : <Grid3X3 className="h-2.5 w-2.5" />}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={toggleFullscreen}
                className="hover:bg-white/10 h-6 w-6 p-0 text-white/70"
              >
                {isFullscreen ? <Minimize2 className="h-2.5 w-2.5" /> : <Maximize2 className="h-2.5 w-2.5" />}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={leaveRoom} 
                className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-6 w-6 p-0"
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Zone vidéo principale - ultra-transparente et légère */}
        <div className="absolute inset-0 bg-black">
          {/* Grille des participants - interface minimale */}
          <div className={`h-full ${getGridLayout()}`} style={{padding: participants.size === 0 ? '20px' : '4px'}}>
            {/* Vidéo locale - ultra-légère */}
            <div className="relative group">
              <div className="relative bg-transparent overflow-hidden h-full rounded-sm">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover rounded-sm"
                  style={{
                    filter: 'brightness(1.1) contrast(1.05)',
                    transform: 'scale(1.01)'
                  }}
                />
                
                {/* Overlay ultra-transparent - n'apparaît qu'au survol */}
                <div className={`absolute inset-0 transition-all duration-300 ${
                  showControlBar ? 'bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-100' : 'opacity-0'
                }`}>
                  <div className="absolute bottom-1 left-1">
                    <div className="bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs">
                      <span className="text-white/90 font-medium text-xs">
                        {localParticipant?.name} (Vous)
                      </span>
                    </div>
                  </div>
                </div>
                
                {/* Indicateurs d'état ultra-minimalistes */}
                <div className={`absolute top-1 right-1 flex space-x-0.5 transition-opacity duration-300 ${
                  showControlBar ? 'opacity-100' : 'opacity-30'
                }`}>
                  {!isAudioEnabled && (
                    <div className="bg-red-500/80 p-0.5 rounded-sm">
                      <MicOff className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  {isScreenSharing && (
                    <div className="bg-blue-500/80 p-0.5 rounded-sm">
                      <ScreenShare className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                  {isHandRaised && (
                    <div className="bg-yellow-500/80 p-0.5 rounded-sm">
                      <Hand className="h-2.5 w-2.5 text-white" />
                    </div>
                  )}
                </div>
                
                {/* Placeholder vidéo désactivée - ultra-minimaliste */}
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center">
                    <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mb-1">
                      <Camera className="h-6 w-6 text-gray-400" />
                    </div>
                    <p className="text-gray-400 text-xs">Caméra désactivée</p>
                  </div>
                )}
              </div>
            </div>

            {/* Vidéos des participants distants - ultra-légères */}
            {Array.from(participants.values()).map((participant) => (
              <div key={participant.id} className="relative group">
                <div className="relative bg-transparent overflow-hidden h-full rounded-sm">
                  <video
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover rounded-sm"
                    style={{
                      filter: 'brightness(1.1) contrast(1.05)',
                      transform: 'scale(1.01)'
                    }}
                    ref={(video) => {
                      if (video && participant.stream) {
                        video.srcObject = participant.stream;
                      }
                    }}
                  />
                  
                  {/* Overlay ultra-transparent */}
                  <div className={`absolute inset-0 transition-all duration-300 ${
                    showControlBar ? 'bg-gradient-to-t from-black/20 via-transparent to-transparent opacity-100' : 'opacity-0'
                  }`}>
                    <div className="absolute bottom-1 left-1">
                      <div className="bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded text-xs">
                        <span className="text-white/90 font-medium text-xs">
                          {participant.name}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Indicateurs d'état minimalistes */}
                  <div className={`absolute top-1 right-1 flex space-x-0.5 transition-opacity duration-300 ${
                    showControlBar ? 'opacity-100' : 'opacity-30'
                  }`}>
                    {!participant.audioEnabled && (
                      <div className="bg-red-500/80 p-0.5 rounded-sm">
                        <MicOff className="h-2.5 w-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {/* Placeholder vidéo désactivée - minimaliste */}
                  {!participant.videoEnabled && (
                    <div className="absolute inset-0 bg-gray-900/90 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 bg-gray-700/50 rounded-full flex items-center justify-center mb-1">
                        <Users className="h-6 w-6 text-gray-400" />
                      </div>
                      <p className="text-gray-400 text-xs">{participant.name}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Barre de contrôles ultra-transparente comme Jitsi */}
          <div 
            className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out ${
              showControlBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <div className="bg-gradient-to-t from-black/40 via-black/20 to-transparent pt-16 pb-4">
              <div className="flex justify-center">
                <div className="bg-black/20 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-xl">
                  <div className="flex items-center space-x-2">
                    {/* Contrôles principaux ultra-compacts */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isAudioEnabled ? "ghost" : "destructive"}
                          size="sm"
                          onClick={toggleAudio}
                          className={`rounded-full w-9 h-9 p-0 transition-all duration-200 hover:scale-110 ${
                            isAudioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/80 hover:bg-red-500'
                          }`}
                        >
                          {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isAudioEnabled ? "Désactiver le micro (M)" : "Activer le micro (M)"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isVideoEnabled ? "ghost" : "destructive"}
                          size="sm"
                          onClick={toggleVideo}
                          className={`rounded-full w-9 h-9 p-0 transition-all duration-200 hover:scale-110 ${
                            isVideoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500/80 hover:bg-red-500'
                          }`}
                        >
                          {isVideoEnabled ? <Video className="h-4 w-4" /> : <VideoOff className="h-4 w-4" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isVideoEnabled ? "Désactiver la caméra (V)" : "Activer la caméra (V)"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-6 bg-white/20"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={startScreenShare}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                            isScreenSharing ? 'bg-blue-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
                          }`}
                        >
                          {isScreenSharing ? <ScreenShareOff className="h-3.5 w-3.5" /> : <ScreenShare className="h-3.5 w-3.5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isScreenSharing ? "Arrêter le partage (S)" : "Partager l'écran (S)"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsHandRaised(!isHandRaised)}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                            isHandRaised ? 'bg-yellow-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
                          }`}
                        >
                          <Hand className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isHandRaised ? "Baisser la main (R)" : "Lever la main (R)"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowParticipants(!showParticipants)}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                            showParticipants ? 'bg-green-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
                          }`}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Participants ({participants.size + 1})
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowChat(!showChat)}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 relative ${
                            showChat ? 'bg-blue-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white/80'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          {chatMessages.length > 0 && (
                            <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-3 h-3 flex items-center justify-center">
                              {chatMessages.length > 9 ? '9+' : chatMessages.length}
                            </div>
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Chat {chatMessages.length > 0 && `(${chatMessages.length})`}
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-6 bg-white/20"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={leaveRoom}
                          className="rounded-full w-9 h-9 p-0 transition-all duration-200 hover:scale-110 bg-red-500/80 hover:bg-red-500"
                        >
                          <PhoneOff className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Quitter la réunion
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau des participants avec écrans verticaux */}
        {showParticipants && (
          <div className="absolute right-0 top-12 bottom-0 w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col z-50">
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
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-xs font-bold text-white">
                      {(localParticipant?.name || 'Vous').charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1">
                    <div className="font-medium text-white text-sm">{localParticipant?.name} (Vous)</div>
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <div className={`w-1.5 h-1.5 rounded-full ${isAudioEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>{isAudioEnabled ? 'Micro' : 'Muet'}</span>
                      <div className={`w-1.5 h-1.5 rounded-full ${isVideoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                      <span>{isVideoEnabled ? 'Vidéo' : 'Cam off'}</span>
                    </div>
                  </div>
                </div>
                
                {/* Écran vertical du participant local */}
                <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{aspectRatio: '9/16', height: '100px'}}>
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                      <Camera className="h-4 w-4 text-gray-500" />
                    </div>
                  )}
                </div>
              </div>

              {/* Participants distants */}
              {Array.from(participants.values()).map((participant) => (
                <div key={participant.id} className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-white">
                        {participant.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{participant.name}</div>
                      <div className="flex items-center space-x-2 text-xs text-gray-400">
                        <div className={`w-1.5 h-1.5 rounded-full ${participant.audioEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>{participant.audioEnabled ? 'Micro' : 'Muet'}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${participant.videoEnabled ? 'bg-green-500' : 'bg-red-500'}`}></div>
                        <span>{participant.videoEnabled ? 'Vidéo' : 'Cam off'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Écran vertical du participant distant */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden" style={{aspectRatio: '9/16', height: '100px'}}>
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
                        <Users className="h-4 w-4 text-gray-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Panneau de chat */}
        {showChat && (
          <div className="absolute right-0 top-12 bottom-0 w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col z-50">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold flex items-center text-lg">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-400" />
                Chat
              </h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0">
              {chatMessages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Aucun message</p>
                </div>
              ) : (
                chatMessages.map((msg) => (
                  <div key={msg.id} className="bg-gray-800/50 rounded-lg p-3">
                    <div className="font-medium text-blue-300 text-sm">{msg.sender}</div>
                    <div className="text-gray-200 mt-1 text-sm">{msg.message}</div>
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
                  className="flex-1 bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                />
                <Button 
                  size="sm" 
                  onClick={sendChatMessage} 
                  disabled={!newMessage.trim()}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Overlay de chargement */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/90 flex items-center justify-center z-50">
            <div className="text-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-6" />
              <h3 className="text-xl font-bold mb-3 bg-gradient-to-r from-blue-400 to-green-400 bg-clip-text text-transparent">
                RonyMeet Pro
              </h3>
              <p className="text-gray-300 mb-4">Initialisation...</p>
              <div className="w-64 bg-gray-800 rounded-full h-2 mx-auto">
                <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full animate-pulse" style={{width: '85%'}}></div>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoConferenceWebRTC;