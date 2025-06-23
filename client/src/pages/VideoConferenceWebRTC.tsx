import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { MediaDiagnostic } from "@/components/MediaDiagnostic";
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
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high' | '4k'>('4k');
  const [showControlBar, setShowControlBar] = useState(true);
  const [controlBarTimeout, setControlBarTimeout] = useState<NodeJS.Timeout | null>(null);
  const [participantsPanelWidth, setParticipantsPanelWidth] = useState(320);
  const [isDraggingSeparator, setIsDraggingSeparator] = useState(false);
  
  // Diagnostic vidéo en temps réel
  const [videoStatus, setVideoStatus] = useState<{
    trackState: string;
    streamActive: boolean;
    lastError: string | null;
    trackId: string | null;
  }>({
    trackState: 'none',
    streamActive: false,
    lastError: null,
    trackId: null
  });
  
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

  // Surveillance automatique de l'état vidéo
  useEffect(() => {
    if (!isVideoEnabled) return;

    const checkVideoHealth = () => {
      if (localStreamRef.current) {
        const videoTracks = localStreamRef.current.getVideoTracks();
        const videoElement = localVideoRef.current;
        
        if (videoTracks.length === 0) {
          console.log('⚠️ Aucun track vidéo trouvé, caméra supposée active');
          setVideoStatus(prev => ({
            ...prev,
            trackState: 'missing',
            lastError: 'Track vidéo manquant'
          }));
          
          // Relancer automatiquement
          toast({
            title: "Reconnexion caméra",
            description: "Tentative de reconnexion automatique..."
          });
          
          setTimeout(() => {
            addVideoTrack();
          }, 1000);
          
          return;
        }

        const activeTrack = videoTracks[0];
        const isTrackLive = activeTrack.readyState === 'live';
        const isTrackEnabled = activeTrack.enabled;
        
        // Vérifier si l'élément vidéo affiche bien quelque chose
        let hasVideo = false;
        if (videoElement) {
          hasVideo = videoElement.videoWidth > 0 && videoElement.videoHeight > 0;
        }

        console.log('🔍 État caméra:', {
          trackId: activeTrack.id,
          readyState: activeTrack.readyState,
          enabled: isTrackEnabled,
          hasVideo,
          videoWidth: videoElement?.videoWidth,
          videoHeight: videoElement?.videoHeight
        });

        // Détecter les problèmes
        if (!isTrackLive || !isTrackEnabled || !hasVideo) {
          console.log('🚨 Problème détecté avec la caméra');
          setVideoStatus(prev => ({
            ...prev,
            trackState: !isTrackLive ? 'ended' : !isTrackEnabled ? 'disabled' : 'no-video',
            lastError: !isTrackLive ? 'Track arrêté' : !isTrackEnabled ? 'Track désactivé' : 'Pas de signal vidéo'
          }));

          if (!isTrackLive) {
            // Track mort, relancer
            toast({
              title: "Caméra reconnectée",
              description: "Redémarrage automatique en cours..."
            });
            addVideoTrack();
          }
        } else {
          // Tout va bien
          setVideoStatus(prev => ({
            ...prev,
            trackState: 'live',
            streamActive: true,
            lastError: null
          }));
        }
      }
    };

    // Vérification initiale après 2 secondes
    const initialCheck = setTimeout(checkVideoHealth, 2000);
    
    // Vérification périodique toutes les 5 secondes
    const healthInterval = setInterval(checkVideoHealth, 5000);

    return () => {
      clearTimeout(initialCheck);
      clearInterval(healthInterval);
    };
  }, [isVideoEnabled]);

  // Diagnostic complet des périphériques média
  const performMediaDiagnostic = async () => {
    const results = {
      hasCamera: false,
      hasMicrophone: false,
      permissions: { camera: 'unknown', microphone: 'unknown' },
      devices: { cameras: 0, microphones: 0 },
      errors: [] as any[]
    };

    try {
      // Vérifier les périphériques disponibles
      const devices = await navigator.mediaDevices.enumerateDevices();
      results.devices.cameras = devices.filter(d => d.kind === 'videoinput').length;
      results.devices.microphones = devices.filter(d => d.kind === 'audioinput').length;
      results.hasCamera = results.devices.cameras > 0;
      results.hasMicrophone = results.devices.microphones > 0;

      // Vérifier les permissions
      if (navigator.permissions) {
        try {
          const cameraPermission = await navigator.permissions.query({ name: 'camera' as PermissionName });
          const micPermission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
          results.permissions.camera = cameraPermission.state;
          results.permissions.microphone = micPermission.state;
        } catch (e) {
          console.log('Permissions API non supportée');
        }
      }

      // Test rapide d'accès
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 320, height: 240 }, 
          audio: true 
        });
        testStream.getTracks().forEach(track => track.stop());
        console.log('✅ Accès média confirmé');
      } catch (e) {
        results.errors.push(e);
      }

    } catch (error) {
      results.errors.push(error);
      console.error('Erreur diagnostic:', error);
    }

    return results;
  };

  // Gestion unifiée des erreurs média
  const handleMediaError = (error: any, mediaType: string) => {
    console.error(`Erreur ${mediaType}:`, error);
    
    let message = `Impossible d'accéder à votre ${mediaType}`;
    let description = '';
    let canRetry = false;
    
    switch (error.name) {
      case 'NotAllowedError':
        message = `Autorisation ${mediaType} requise`;
        description = `Cliquez sur l'icône de cadenas dans la barre d'adresse pour autoriser`;
        break;
      case 'NotFoundError':
        message = `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} introuvable`;
        description = `Vérifiez qu'un ${mediaType} est connecté`;
        break;
      case 'NotReadableError':
        message = `${mediaType.charAt(0).toUpperCase() + mediaType.slice(1)} occupé`;
        description = `Fermez les autres applications utilisant votre ${mediaType}`;
        canRetry = true;
        break;
      case 'OverconstrainedError':
        message = `Qualité ${mediaType} trop élevée`;
        description = `Réduction automatique de la qualité...`;
        canRetry = true;
        break;
      case 'SecurityError':
        message = `Connexion non sécurisée`;
        description = `Utilisez HTTPS pour accéder aux médias`;
        break;
      case 'AbortError':
        message = `Connexion ${mediaType} interrompue`;
        description = `Tentative de reconnexion...`;
        canRetry = true;
        break;
      default:
        description = `Erreur: ${error.message || 'Erreur inconnue'}`;
    }
    
    toast({
      title: message,
      description: description,
      variant: "destructive",
      duration: canRetry ? 5000 : 8000
    });

    if (canRetry && mediaType === 'caméra' && error.name === 'OverconstrainedError') {
      setTimeout(() => {
        setVideoQuality('low');
        toast({
          title: "Qualité réduite",
          description: "Nouvelle tentative avec qualité standard..."
        });
      }, 2000);
    }
  };



  // Initialisation avec diagnostic automatique
  const initializeLocalStream = async () => {
    try {
      // Effectuer diagnostic
      const diagnostic = await performMediaDiagnostic();
      
      console.log('Diagnostic média:', diagnostic);
      
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

      // Messages d'information basés sur le diagnostic
      if (!diagnostic.hasCamera && !diagnostic.hasMicrophone) {
        toast({
          title: "Aucun périphérique détecté",
          description: "Connectez une caméra et un microphone pour participer",
          variant: "destructive",
          duration: 10000
        });
      } else if (!diagnostic.hasCamera) {
        toast({
          title: "Caméra non détectée",
          description: "Vous pourrez participer en audio uniquement",
          duration: 8000
        });
      } else if (!diagnostic.hasMicrophone) {
        toast({
          title: "Microphone non détecté",
          description: "Vous pourrez participer en vidéo uniquement",
          duration: 8000
        });
      } else {
        toast({
          title: "Vidéoconférence prête",
          description: `${diagnostic.devices.cameras} caméra(s) et ${diagnostic.devices.microphones} micro(s) détecté(s)`
        });
      }

      // Afficher les permissions si nécessaire
      if (diagnostic.permissions.camera === 'denied' || diagnostic.permissions.microphone === 'denied') {
        setTimeout(() => {
          toast({
            title: "Permissions refusées",
            description: "Actualisez la page après avoir autorisé l'accès aux médias",
            variant: "destructive",
            duration: 10000
          });
        }, 3000);
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

  // Contrôles audio améliorés avec gestion robuste
  const toggleAudio = async () => {
    try {
      if (!isAudioEnabled) {
        // Activer l'audio
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = true;
            setIsAudioEnabled(true);
            toast({ title: "Microphone activé" });
          } else {
            // Ajouter track audio s'il n'existe pas
            await addAudioTrack();
          }
        } else {
          // Créer nouveau stream
          await addAudioTrack();
        }
      } else {
        // Désactiver l'audio (garder le track mais désactiver)
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
            setIsAudioEnabled(false);
            toast({ title: "Microphone désactivé" });
          }
        }
      }
      
      // Notifier les autres participants
      wsRef.current?.send(JSON.stringify({
        type: 'participant-update',
        participant: {
          id: authUser?.id.toString(),
          audioEnabled: !isAudioEnabled
        }
      }));
      
    } catch (error) {
      console.error('Erreur toggle audio:', error);
      handleMediaError(error, 'microphone');
    }
  };

  // Fonction pour ajouter un track audio
  const addAudioTrack = async () => {
    try {
      const audioStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: isNoiseSuppressionEnabled,
          autoGainControl: true,
          sampleRate: 48000
        }
      });
      
      const audioTrack = audioStream.getAudioTracks()[0];
      
      if (localStreamRef.current) {
        localStreamRef.current.addTrack(audioTrack);
      } else {
        localStreamRef.current = audioStream;
      }
      
      setIsAudioEnabled(true);
      
      // Ajouter aux connexions peer
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'audio');
        if (sender) {
          sender.replaceTrack(audioTrack);
        } else {
          pc.addTrack(audioTrack, localStreamRef.current!);
        }
      });
      
      toast({ title: "Microphone activé" });
      
    } catch (error) {
      console.error('Erreur microphone:', error);
      toast({
        title: "Microphone inaccessible",
        description: "Vérifiez les permissions dans votre navigateur",
        variant: "destructive"
      });
    }
  };

  // Contrôles vidéo robustes avec debugging
  const toggleVideo = async () => {
    console.log('Toggle vidéo - État actuel:', isVideoEnabled);
    
    try {
      if (!isVideoEnabled) {
        console.log('Activation de la vidéo...');
        await addVideoTrack();
      } else {
        console.log('Désactivation de la vidéo...');
        // Désactiver complètement la vidéo
        if (localStreamRef.current) {
          const videoTracks = localStreamRef.current.getVideoTracks();
          videoTracks.forEach(track => {
            console.log('Arrêt du track vidéo:', track.id);
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
          
          // Notifier les peer connections
          peerConnectionsRef.current.forEach(pc => {
            const videoSenders = pc.getSenders().filter(s => s.track?.kind === 'video');
            videoSenders.forEach(sender => {
              pc.removeTrack(sender);
            });
          });
        }
        
        // Vider la vidéo locale
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
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
      toast({
        title: "Problème caméra",
        description: "Erreur lors de l'activation/désactivation",
        variant: "destructive"
      });
    }
  };

  // Fonction pour ajouter un track vidéo avec gestion stable
  const addVideoTrack = async () => {
    console.log('Début addVideoTrack - Qualité demandée:', videoQuality);
    
    // Contraintes basées sur la qualité sélectionnée avec fallbacks 4K
    const getConstraintsByQuality = () => {
      switch (videoQuality) {
        case '4k':
          return [
            // 4K Ultra HD
            {
              width: { ideal: 3840, max: 3840 },
              height: { ideal: 2160, max: 2160 },
              frameRate: { ideal: 60, max: 60 },
              facingMode: 'user'
            },
            // 4K Standard
            {
              width: { ideal: 3840, max: 3840 },
              height: { ideal: 2160, max: 2160 },
              frameRate: { ideal: 30, max: 30 },
              facingMode: 'user'
            },
            // 1440p fallback
            {
              width: { ideal: 2560, max: 2560 },
              height: { ideal: 1440, max: 1440 },
              frameRate: { ideal: 30 },
              facingMode: 'user'
            }
          ];
        case 'high':
          return [
            // Full HD 60fps
            {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 60 },
              facingMode: 'user'
            },
            // Full HD 30fps
            {
              width: { ideal: 1920, max: 1920 },
              height: { ideal: 1080, max: 1080 },
              frameRate: { ideal: 30 },
              facingMode: 'user'
            }
          ];
        case 'medium':
          return [
            {
              width: { ideal: 1280, max: 1280 },
              height: { ideal: 720, max: 720 },
              frameRate: { ideal: 30 },
              facingMode: 'user'
            }
          ];
        default:
          return [
            {
              width: { ideal: 640, max: 640 },
              height: { ideal: 480, max: 480 },
              frameRate: { ideal: 30 },
              facingMode: 'user'
            }
          ];
      }
    };

    const constraints = [
      ...getConstraintsByQuality(),
      // Fallbacks universels
      {
        width: { ideal: 1920, min: 640 },
        height: { ideal: 1080, min: 480 },
        frameRate: { ideal: 30, min: 15 },
        facingMode: 'user'
      },
      {
        width: 640,
        height: 480,
        frameRate: 15
      },
      true
    ];

    for (let i = 0; i < constraints.length; i++) {
      try {
        console.log(`Tentative vidéo ${i + 1}:`, constraints[i]);
        
        // Obtenir le stream vidéo
        const videoStream = await navigator.mediaDevices.getUserMedia({ 
          video: constraints[i]
        });
        
        const videoTrack = videoStream.getVideoTracks()[0];
        console.log('Track vidéo obtenu:', {
          id: videoTrack.id,
          label: videoTrack.label,
          readyState: videoTrack.readyState,
          enabled: videoTrack.enabled
        });
        
        // Vérifier que le track est utilisable
        if (videoTrack.readyState === 'ended') {
          console.error('Track vidéo déjà terminé');
          videoTrack.stop();
          continue;
        }
        
        // Gérer le stream local
        if (localStreamRef.current) {
          // Nettoyer les anciens tracks vidéo
          const oldVideoTracks = localStreamRef.current.getVideoTracks();
          oldVideoTracks.forEach(track => {
            console.log('Suppression ancien track:', track.id);
            localStreamRef.current?.removeTrack(track);
            track.stop();
          });
          
          // Ajouter le nouveau track
          localStreamRef.current.addTrack(videoTrack);
        } else {
          // Créer un nouveau stream avec tous les tracks nécessaires
          localStreamRef.current = new MediaStream();
          localStreamRef.current.addTrack(videoTrack);
          
          // Ajouter les tracks audio existants si disponibles
          if (localStreamRef.current.getAudioTracks().length === 0) {
            // Pas d'audio pour l'instant, juste la vidéo
          }
        }
        
        // Configurer la vidéo locale avec vérifications
        if (localVideoRef.current) {
          console.log('Attribution du stream à la vidéo locale');
          localVideoRef.current.srcObject = localStreamRef.current;
          
          // Forcer le chargement
          try {
            await localVideoRef.current.play();
            console.log('Lecture vidéo démarrée avec succès');
          } catch (playError) {
            console.warn('Erreur lecture automatique (normal):', playError);
          }
        }
        
        // Mettre à jour l'état et le diagnostic
        setIsVideoEnabled(true);
        setVideoStatus({
          trackState: 'live',
          streamActive: true,
          lastError: null,
          trackId: videoTrack.id
        });
        
        // Ajouter aux connexions peer existantes
        peerConnectionsRef.current.forEach((pc, peerId) => {
          console.log(`Ajout track vidéo à peer ${peerId}`);
          try {
            const existingSenders = pc.getSenders();
            const videoSender = existingSenders.find(s => s.track?.kind === 'video');
            
            if (videoSender) {
              videoSender.replaceTrack(videoTrack);
            } else {
              pc.addTrack(videoTrack, localStreamRef.current!);
            }
          } catch (peerError) {
            console.error(`Erreur ajout track peer ${peerId}:`, peerError);
          }
        });
        
        // Surveiller l'état du track avec diagnostic
        videoTrack.addEventListener('ended', () => {
          console.log('🔴 Track vidéo terminé de manière inattendue');
          setVideoStatus(prev => ({
            ...prev,
            trackState: 'ended',
            lastError: 'Track terminé de manière inattendue',
            streamActive: false
          }));
          
          setIsVideoEnabled(false);
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = null;
          }
          
          toast({
            title: "Caméra interrompue",
            description: "La caméra s'est arrêtée de manière inattendue",
            variant: "destructive"
          });
        });

        videoTrack.addEventListener('mute', () => {
          console.log('🔇 Track vidéo mis en sourdine');
          setVideoStatus(prev => ({ ...prev, trackState: 'muted' }));
        });

        videoTrack.addEventListener('unmute', () => {
          console.log('🔊 Track vidéo réactivé');
          setVideoStatus(prev => ({ ...prev, trackState: 'live' }));
        });
        
        const settings = videoTrack.getSettings();
        console.log('Caméra activée avec succès:', settings);
        
        toast({ 
          title: "Caméra activée", 
          description: `${settings.width}x${settings.height} @ ${settings.frameRate}fps`
        });
        
        return; // Succès complet
        
      } catch (error) {
        console.error(`Tentative ${i + 1} échouée:`, error);
        
        // Si dernière tentative
        if (i === constraints.length - 1) {
          console.error('Toutes les tentatives ont échoué');
          setIsVideoEnabled(false);
          
          toast({
            title: "Caméra inaccessible",
            description: "Impossible d'accéder à votre caméra. Vérifiez les permissions.",
            variant: "destructive"
          });
        }
      }
    }
  };

  // Référence pour le stream de partage d'écran
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Partage d'écran corrigé avec gestion complète
  const startScreenShare = async () => {
    console.log('Toggle partage écran - État actuel:', isScreenSharing);
    
    if (isScreenSharing) {
      await stopScreenShare();
      return;
    }

    try {
      console.log('Démarrage partage d\'écran...');
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: { 
          width: { ideal: 1920, max: 3840 }, 
          height: { ideal: 1080, max: 2160 }, 
          frameRate: { ideal: 30, max: 60 } 
        },
        audio: true
      });

      screenStreamRef.current = screenStream;
      const screenTrack = screenStream.getVideoTracks()[0];
      
      console.log('Stream de partage obtenu:', {
        id: screenTrack.id,
        label: screenTrack.label,
        settings: screenTrack.getSettings()
      });

      // Remplacer la vidéo dans le stream local
      if (localStreamRef.current) {
        const oldVideoTrack = localStreamRef.current.getVideoTracks()[0];
        if (oldVideoTrack) {
          console.log('Remplacement du track vidéo par le partage d\'écran');
          localStreamRef.current.removeTrack(oldVideoTrack);
        }
        localStreamRef.current.addTrack(screenTrack);
        
        // Mettre à jour l'affichage local
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      // Remplacer dans toutes les connexions peer
      peerConnectionsRef.current.forEach((pc, peerId) => {
        console.log(`Remplacement track vidéo pour peer ${peerId}`);
        const videoSender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (videoSender) {
          videoSender.replaceTrack(screenTrack);
        } else {
          pc.addTrack(screenTrack, localStreamRef.current!);
        }
      });

      setIsScreenSharing(true);
      
      // Gérer l'arrêt automatique du partage
      screenTrack.addEventListener('ended', () => {
        console.log('Partage d\'écran arrêté par l\'utilisateur');
        stopScreenShare();
      });

      toast({ 
        title: "Partage d'écran activé",
        description: "Votre écran est maintenant partagé avec les participants"
      });
      
    } catch (error) {
      console.error('Erreur partage écran:', error);
      setIsScreenSharing(false);
      toast({
        title: "Partage d'écran impossible",
        description: "Vérifiez les permissions de partage d'écran",
        variant: "destructive"
      });
    }
  };

  const stopScreenShare = async () => {
    console.log('Arrêt du partage d\'écran...');
    
    try {
      // Arrêter le stream de partage
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach(track => {
          console.log('Arrêt du track de partage:', track.id);
          track.stop();
        });
        screenStreamRef.current = null;
      }

      // Nettoyer le stream local
      if (localStreamRef.current) {
        const screenTracks = localStreamRef.current.getVideoTracks();
        screenTracks.forEach(track => {
          console.log('Suppression track de partage du stream local:', track.id);
          localStreamRef.current?.removeTrack(track);
          track.stop();
        });
      }

      setIsScreenSharing(false);

      // Restaurer la caméra si elle était active
      if (isVideoEnabled) {
        console.log('Restauration de la caméra...');
        await addVideoTrack();
      } else {
        // Vider l'affichage vidéo local
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        
        // Supprimer les tracks vidéo des connexions peer
        peerConnectionsRef.current.forEach((pc, peerId) => {
          console.log(`Suppression track vidéo pour peer ${peerId}`);
          const videoSenders = pc.getSenders().filter(s => s.track?.kind === 'video');
          videoSenders.forEach(sender => {
            if (sender.track) {
              sender.track.stop();
              pc.removeTrack(sender);
            }
          });
        });
      }

      toast({ 
        title: "Partage d'écran arrêté",
        description: "Le partage d'écran a été interrompu"
      });
      
    } catch (error) {
      console.error('Erreur arrêt partage écran:', error);
      toast({
        title: "Erreur",
        description: "Problème lors de l'arrêt du partage d'écran",
        variant: "destructive"
      });
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

        {/* Zone vidéo principale avec panneau participants intégré */}
        <div className="absolute inset-0 bg-black flex">
          {/* Grille vidéo principale */}
          <div className={`flex-1 ${getGridLayout()}`} style={{
            padding: participants.size === 0 ? '20px' : '4px',
            marginRight: showParticipants ? `${participantsPanelWidth}px` : '0',
            transition: 'margin-right 0.3s ease-in-out'
          }}>
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

          {/* Séparateur vertical ajustable */}
          {showParticipants && (
            <div 
              className="absolute top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-gray-400/60 to-transparent shadow-lg cursor-col-resize z-30 hover:bg-blue-400/60 transition-colors"
              style={{ right: `${participantsPanelWidth - 1}px` }}
              onMouseDown={(e) => {
                setIsDraggingSeparator(true);
                const startX = e.clientX;
                const startWidth = participantsPanelWidth;
                
                const handleMouseMove = (e: MouseEvent) => {
                  const newWidth = startWidth + (startX - e.clientX);
                  const clampedWidth = Math.max(250, Math.min(500, newWidth));
                  setParticipantsPanelWidth(clampedWidth);
                };
                
                const handleMouseUp = () => {
                  setIsDraggingSeparator(false);
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
              }}
            />
          )}

          {/* Panneau participants sans couleur verte */}
          {showParticipants && (
            <div 
              className="absolute right-0 top-0 bottom-0 bg-black/60 backdrop-blur-md border-l border-gray-400/30 flex flex-col z-40"
              style={{ width: `${participantsPanelWidth}px` }}
            >
              {/* En-tête */}
              <div className="p-4 border-b border-gray-400/30 bg-black/40">
                <h3 className="font-semibold flex items-center text-lg text-white">
                  <Users className="h-5 w-5 mr-2 text-blue-400" />
                  Participants ({participants.size + 1})
                </h3>
              </div>
              
              <div className="flex-1 p-3 overflow-y-auto space-y-2 custom-scrollbar">
                {/* Participant local */}
                <div className="bg-gray-800/40 rounded-lg p-3 border border-gray-600/30 backdrop-blur-sm">
                  <div className="flex items-center space-x-3 mb-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-xs font-bold text-white">
                        {(localParticipant?.name || 'Vous').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-white text-sm">{localParticipant?.name} (Vous)</div>
                      <div className="flex items-center space-x-2 text-xs text-gray-300">
                        <div className={`w-1.5 h-1.5 rounded-full ${isAudioEnabled ? 'bg-green-400' : 'bg-red-400'} shadow-sm`}></div>
                        <span>{isAudioEnabled ? 'Micro' : 'Muet'}</span>
                        <div className={`w-1.5 h-1.5 rounded-full ${isVideoEnabled ? 'bg-green-400' : 'bg-red-400'} shadow-sm`}></div>
                        <span>{isVideoEnabled ? 'Vidéo' : 'Cam off'}</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Écran vertical avec effet miroir */}
                  <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-600/30" style={{aspectRatio: '9/16', height: '120px'}}>
                    <video
                      ref={localVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover rounded-lg"
                      style={{
                        transform: 'scaleX(-1)' // Effet miroir
                      }}
                    />
                    
                    {!isVideoEnabled && (
                      <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                        <Camera className="h-6 w-6 text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>

                {/* Participants distants */}
                {Array.from(participants.values()).map((participant) => (
                  <div key={participant.id} className="bg-gray-800/40 rounded-lg p-3 border border-gray-600/30 backdrop-blur-sm">
                    <div className="flex items-center space-x-3 mb-3">
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                        <span className="text-xs font-bold text-white">
                          {participant.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1">
                        <div className="font-medium text-white text-sm">{participant.name}</div>
                        <div className="flex items-center space-x-2 text-xs text-gray-300">
                          <div className={`w-1.5 h-1.5 rounded-full ${participant.audioEnabled ? 'bg-green-400' : 'bg-red-400'} shadow-sm`}></div>
                          <span>{participant.audioEnabled ? 'Micro' : 'Muet'}</span>
                          <div className={`w-1.5 h-1.5 rounded-full ${participant.videoEnabled ? 'bg-green-400' : 'bg-red-400'} shadow-sm`}></div>
                          <span>{participant.videoEnabled ? 'Vidéo' : 'Cam off'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Écran vertical avec effet miroir */}
                    <div className="relative bg-gray-900 rounded-lg overflow-hidden border border-gray-600/30" style={{aspectRatio: '9/16', height: '120px'}}>
                      <video
                        autoPlay
                        playsInline
                        muted
                        className="w-full h-full object-cover rounded-lg"
                        style={{
                          transform: 'scaleX(-1)' // Effet miroir
                        }}
                        ref={(video) => {
                          if (video && participant.stream) {
                            console.log(`Attribution stream participant ${participant.id}:`, participant.stream);
                            video.srcObject = participant.stream;
                            
                            // Forcer la lecture
                            video.play().catch(e => {
                              console.log('Lecture automatique bloquée (normal):', e);
                            });
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          const video = e.target as HTMLVideoElement;
                          console.log(`Métadonnées chargées pour ${participant.id}:`, {
                            videoWidth: video.videoWidth,
                            videoHeight: video.videoHeight,
                            duration: video.duration
                          });
                        }}
                        onError={(e) => {
                          console.error(`Erreur vidéo participant ${participant.id}:`, e);
                        }}
                      />
                      
                      {!participant.videoEnabled && (
                        <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                          <Users className="h-6 w-6 text-gray-400" />
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panneau de chat */}
        {showChat && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col z-50">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold flex items-center text-lg">
                <MessageSquare className="h-5 w-5 mr-2 text-blue-400" />
                Chat
              </h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-3 min-h-0 custom-scrollbar">
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

        {/* Panneau de paramètres fonctionnel */}
        {showSettings && (
          <div className="absolute right-0 top-0 bottom-0 w-80 bg-black/60 backdrop-blur-xl border-l border-gray-700/50 flex flex-col z-50">
            <div className="p-4 border-b border-gray-700/50">
              <h3 className="font-semibold flex items-center text-lg">
                <Settings className="h-5 w-5 mr-2 text-purple-400" />
                Paramètres
              </h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-4 custom-scrollbar">
              {/* Qualité vidéo fonctionnelle */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Qualité vidéo</label>
                <select 
                  value={videoQuality}
                  onChange={async (e) => {
                    const newQuality = e.target.value as 'low' | 'medium' | 'high' | '4k';
                    setVideoQuality(newQuality);
                    
                    // Redémarrer la vidéo avec la nouvelle qualité si activée
                    if (isVideoEnabled && localStreamRef.current) {
                      const videoTrack = localStreamRef.current.getVideoTracks()[0];
                      if (videoTrack) {
                        videoTrack.stop();
                        localStreamRef.current.removeTrack(videoTrack);
                        await addVideoTrack();
                      }
                    }
                    
                    toast({
                      title: "Qualité vidéo mise à jour",
                      description: newQuality === '4k' ? '4K Ultra HD (3840x2160)' :
                                  newQuality === 'high' ? 'Full HD (1920x1080)' : 
                                  newQuality === 'medium' ? 'HD (1280x720)' : 'Standard (640x480)'
                    });
                  }}
                  className="w-full bg-gray-800/50 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:border-purple-500 focus:outline-none text-white"
                >
                  <option value="low">Standard (640x480)</option>
                  <option value="medium">HD (1280x720)</option>
                  <option value="high">Full HD (1920x1080)</option>
                  <option value="4k">4K Ultra HD (3840x2160)</option>
                </select>
              </div>

              {/* Suppression de bruit fonctionnelle */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Suppression de bruit</label>
                <Button
                  variant={isNoiseSuppressionEnabled ? "default" : "outline"}
                  size="sm"
                  onClick={async () => {
                    setIsNoiseSuppressionEnabled(!isNoiseSuppressionEnabled);
                    
                    // Redémarrer l'audio avec les nouveaux paramètres si activé
                    if (isAudioEnabled && localStreamRef.current) {
                      const audioTrack = localStreamRef.current.getAudioTracks()[0];
                      if (audioTrack) {
                        audioTrack.stop();
                        localStreamRef.current.removeTrack(audioTrack);
                        await addAudioTrack();
                      }
                    }
                    
                    toast({
                      title: `Suppression de bruit ${!isNoiseSuppressionEnabled ? 'activée' : 'désactivée'}`
                    });
                  }}
                  className="h-8"
                >
                  {isNoiseSuppressionEnabled ? 'Activé' : 'Désactivé'}
                </Button>
              </div>

              {/* Arrière-plan virtuel */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Arrière-plan virtuel</label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={virtualBackground === null ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setVirtualBackground(null);
                      toast({ title: "Arrière-plan désactivé" });
                    }}
                    className="h-12 text-xs"
                  >
                    Aucun
                  </Button>
                  <Button
                    variant={virtualBackground === 'blur' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setVirtualBackground('blur');
                      toast({ title: "Flou d'arrière-plan activé" });
                    }}
                    className="h-12 text-xs"
                  >
                    Flou
                  </Button>
                  <Button
                    variant={virtualBackground === 'office' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setVirtualBackground('office');
                      toast({ title: "Arrière-plan bureau activé" });
                    }}
                    className="h-12 text-xs"
                  >
                    Bureau
                  </Button>
                </div>
              </div>

              {/* Mode présentation */}
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-gray-300">Mode présentation</label>
                <Button
                  variant={isPresentationMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => {
                    setIsPresentationMode(!isPresentationMode);
                    setLayoutMode(isPresentationMode ? 'grid' : 'presentation');
                    toast({
                      title: `Mode présentation ${!isPresentationMode ? 'activé' : 'désactivé'}`
                    });
                  }}
                  className="h-8"
                >
                  {isPresentationMode ? 'Activé' : 'Désactivé'}
                </Button>
              </div>

              {/* Enregistrement fonctionnel */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-gray-300">Enregistrement</label>
                  <Button
                    variant={isRecording ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsRecording(!isRecording);
                      if (!isRecording) {
                        toast({
                          title: "Enregistrement démarré",
                          description: "L'enregistrement local est en cours"
                        });
                      } else {
                        toast({
                          title: "Enregistrement arrêté",
                          description: "L'enregistrement a été sauvegardé"
                        });
                      }
                    }}
                    className="h-8"
                  >
                    <Circle className={`h-3 w-3 mr-1 ${isRecording ? 'animate-pulse' : ''}`} />
                    {isRecording ? 'Arrêter' : 'Démarrer'}
                  </Button>
                </div>
                {isRecording && (
                  <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                    🔴 Enregistrement en cours - {Math.floor(Date.now() / 60000)} min
                  </div>
                )}
              </div>

              {/* Disposition des écrans */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Disposition</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={layoutMode === 'grid' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setLayoutMode('grid');
                      toast({ title: "Vue en grille activée" });
                    }}
                    className="h-10 text-xs"
                  >
                    <Grid3X3 className="h-3 w-3 mr-1" />
                    Grille
                  </Button>
                  <Button
                    variant={layoutMode === 'speaker' ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      setLayoutMode('speaker');
                      toast({ title: "Vue orateur activée" });
                    }}
                    className="h-10 text-xs"
                  >
                    <Crown className="h-3 w-3 mr-1" />
                    Orateur
                  </Button>
                </div>
              </div>

              {/* Statistiques en temps réel */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Statistiques</label>
                <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">État:</span>
                    <span className={`${
                      connectionStatus === 'connected' ? 'text-green-400' : 
                      connectionStatus === 'connecting' ? 'text-yellow-400' : 'text-red-400'
                    }`}>
                      {connectionStatus === 'connected' ? 'Connecté' : 
                       connectionStatus === 'connecting' ? 'Connexion...' : 'Déconnecté'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Participants:</span>
                    <span className="text-white">{participants.size + 1}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Qualité:</span>
                    <span className="text-white">
                      {videoQuality === '4k' ? '4K Ultra HD' : videoQuality === 'high' ? 'Full HD' : videoQuality === 'medium' ? 'HD' : 'SD'}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Durée:</span>
                    <span className="text-white">{Math.floor(Date.now() / 60000)} min</span>
                  </div>
                </div>
              </div>

              {/* État vidéo en temps réel */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">État caméra</label>
                <div className="bg-gray-800/30 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">État:</span>
                    <span className={`${
                      videoStatus.trackState === 'live' ? 'text-green-400' : 
                      videoStatus.trackState === 'missing' ? 'text-red-400' : 'text-yellow-400'
                    }`}>
                      {videoStatus.trackState === 'live' ? 'Actif' : 
                       videoStatus.trackState === 'missing' ? 'Manquant' :
                       videoStatus.trackState === 'ended' ? 'Arrêté' : videoStatus.trackState}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-400">Stream:</span>
                    <span className={videoStatus.streamActive ? 'text-green-400' : 'text-red-400'}>
                      {videoStatus.streamActive ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  {videoStatus.trackId && (
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-400">Track ID:</span>
                      <span className="text-gray-300 font-mono text-[10px]">
                        {videoStatus.trackId.substring(0, 8)}...
                      </span>
                    </div>
                  )}
                  {videoStatus.lastError && (
                    <div className="text-xs text-red-400 bg-red-900/20 p-2 rounded">
                      {videoStatus.lastError}
                    </div>
                  )}
                </div>
              </div>

              {/* Diagnostic des périphériques */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Diagnostic complet</label>
                <div className="p-3 border border-gray-600 rounded-lg">
                  <MediaDiagnostic />
                </div>
              </div>

              {/* Actions rapides */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Actions rapides</label>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyRoomCode}
                    className="w-full justify-start"
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copier le code ({roomCode})
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (navigator.share) {
                        navigator.share({
                          title: 'Rejoindre ma réunion RonyMeet',
                          text: `Code de réunion: ${roomCode}`,
                          url: window.location.href
                        });
                      } else {
                        copyRoomCode();
                      }
                    }}
                    className="w-full justify-start"
                  >
                    <UserPlus className="h-3 w-3 mr-2" />
                    Inviter des participants
                  </Button>

                  <Button
                    variant={isLocked ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => {
                      setIsLocked(!isLocked);
                      toast({
                        title: `Réunion ${!isLocked ? 'verrouillée' : 'déverrouillée'}`,
                        description: !isLocked ? 'Nouveaux participants bloqués' : 'Nouveaux participants autorisés'
                      });
                    }}
                    className="w-full justify-start"
                  >
                    {isLocked ? <Lock className="h-3 w-3 mr-2" /> : <Unlock className="h-3 w-3 mr-2" />}
                    {isLocked ? 'Déverrouiller' : 'Verrouiller'} la réunion
                  </Button>
                </div>
              </div>

              {/* Raccourcis clavier */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Raccourcis clavier</label>
                <div className="bg-gray-800/30 rounded-lg p-3 space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Micro:</span>
                    <kbd className="bg-gray-700 px-1 rounded">M</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Caméra:</span>
                    <kbd className="bg-gray-700 px-1 rounded">V</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Partage d'écran:</span>
                    <kbd className="bg-gray-700 px-1 rounded">S</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Lever la main:</span>
                    <kbd className="bg-gray-700 px-1 rounded">R</kbd>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Plein écran:</span>
                    <kbd className="bg-gray-700 px-1 rounded">F</kbd>
                  </div>
                </div>
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