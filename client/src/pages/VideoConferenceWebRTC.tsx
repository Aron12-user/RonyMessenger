import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2,
  Maximize2, Minimize2, X, Crown, Settings, MessageSquare,
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2,
  Send, Hand, Grid3X3, MoreVertical, Circle, FileText
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
  const [isLoading, setIsLoading] = useState(false); // Démarrage instantané
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'failed'>('connecting');
  
  // États des participants
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<Participant | null>(null);
  
  // États des contrôles
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // États de l'interface
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker' | 'presentation'>('grid');
  
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isHandRaised, setIsHandRaised] = useState(false);

  const roomCode = params?.roomCode;

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
        // Initier les connexions avec les participants existants
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
      // Créer le participant local même sans stream
      const local: Participant = {
        id: authUser?.id.toString() || 'local',
        name: authUser?.displayName || authUser?.username || 'Vous',
        stream: undefined, // Pas de stream au départ
        audioEnabled: false, // Désactivé par défaut
        videoEnabled: false, // Désactivé par défaut
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
      // Même en cas d'erreur, on continue sans média
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

    // Ajouter le stream local s'il existe
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }

    // Gestion des tracks distants
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

    // Gestion des candidats ICE
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          to: participant.id
        }));
      }
    };

    // Gestion de l'état de connexion
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connexion avec ${participant.id}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        toast({ title: `Connecté à ${participant.name || participant.id}` });
      }
    };

    try {
      // Créer une offre
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
        // Créer un nouveau stream audio
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
          // Ajouter la piste audio au stream existant
          audioStream.getAudioTracks().forEach(track => {
            localStreamRef.current?.addTrack(track);
          });
        }
        
        setIsAudioEnabled(true);
        
        // Ajouter aux connexions existantes
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
          // Pas de piste audio, en créer une
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
      
      // Notifier les autres participants
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
        // Créer un nouveau stream vidéo
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
        
        // Ajouter aux connexions existantes
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
          // Pas de piste vidéo, en créer une
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
      
      // Notifier les autres participants
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
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

      // Remplacer le track vidéo existant
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        const screenTrack = screenStream.getVideoTracks()[0];
        
        // Remplacer dans toutes les connexions
        peerConnectionsRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track === videoTrack);
          if (sender) {
            sender.replaceTrack(screenTrack);
          }
        });

        // Remplacer localement
        localStreamRef.current.removeTrack(videoTrack);
        localStreamRef.current.addTrack(screenTrack);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }
      }

      setIsScreenSharing(true);
      
      // Gérer l'arrêt du partage d'écran
      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        // Rétablir la caméra
        restoreCamera();
      };

    } catch (error) {
      console.error('Erreur partage écran:', error);
      toast({
        title: "Erreur",
        description: "Impossible de partager l'écran",
        variant: "destructive"
      });
    }
  };

  const restoreCamera = async () => {
    try {
      const cameraStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: false
      });

      const videoTrack = cameraStream.getVideoTracks()[0];
      
      // Remplacer dans toutes les connexions
      peerConnectionsRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        }
      });

      // Remplacer localement
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
    // Fermer toutes les connexions
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    // Arrêter les streams
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Fermer WebSocket
    wsRef.current?.close();
    
    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  // Initialisation immédiate
  useEffect(() => {
    if (roomCode && authUser) {
      // Démarrer immédiatement sans attendre les autorisations média
      initializeLocalStream();
      initializeWebSocket();
    }

    return () => {
      // Nettoyage
      peerConnectionsRef.current.forEach(pc => pc.close());
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      wsRef.current?.close();
    };
  }, [roomCode, authUser]);

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
    <div className={`h-screen bg-gray-900 text-white flex flex-col ${
      isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-lg overflow-hidden shadow-2xl' : ''
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Barre de contrôle supérieure */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              connectionStatus === 'connected' ? 'bg-green-500' : 
              connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <h1 className="font-semibold">Vidéoconférence WebRTC</h1>
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
            {participants.size + 1} participants
          </Badge>
          
          <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
            <Crown className="h-3 w-3 mr-1" />
            Autonome
          </Badge>
          
          {isRecording && (
            <Badge variant="outline" className="bg-red-600/20 border-red-600 text-red-200">
              <Circle className="h-3 w-3 mr-1 animate-pulse fill-current" />
              REC
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={leaveRoom} className="text-red-400 hover:text-red-300">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 flex">
        {/* Zone vidéo principale */}
        <div className="flex-1 relative bg-black">
          {/* Indicateur de chargement */}
          {isLoading && (
            <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center z-20">
              <div className="text-center">
                <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-6" />
                <h3 className="text-xl font-semibold mb-3">Initialisation WebRTC</h3>
                <p className="text-gray-400 text-sm mb-4">Configuration autonome sans dépendances...</p>
                <div className="flex justify-center space-x-4 mb-4">
                  <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
                    P2P Direct
                  </Badge>
                  <Badge variant="outline" className="bg-blue-600/20 border-blue-600 text-blue-200">
                    HD Vidéo
                  </Badge>
                  <Badge variant="outline" className="bg-purple-600/20 border-purple-600 text-purple-200">
                    Audio Spatial
                  </Badge>
                </div>
                <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto">
                  <div className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full animate-pulse" style={{width: '75%'}}></div>
                </div>
              </div>
            </div>
          )}

          {/* Grille des participants */}
          <div className={`h-full p-4 ${
            layoutMode === 'grid' ? 'grid gap-4' : 'flex flex-col'
          } ${
            participants.size === 0 ? 'grid-cols-1' : 
            participants.size === 1 ? 'grid-cols-2' :
            participants.size <= 4 ? 'grid-cols-2' : 
            'grid-cols-3'
          }`}>
            {/* Vidéo locale */}
            <div className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
              <video
                ref={localVideoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
                {localParticipant?.name} (Vous)
              </div>
              {!isVideoEnabled && (
                <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                  <Camera className="h-12 w-12 text-gray-500" />
                </div>
              )}
              {!isAudioEnabled && (
                <div className="absolute top-2 right-2 bg-red-600 p-1 rounded">
                  <MicOff className="h-3 w-3" />
                </div>
              )}
            </div>

            {/* Vidéos des participants */}
            {Array.from(participants.values()).map((participant) => (
              <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden aspect-video">
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
                <div className="absolute bottom-2 left-2 bg-black/50 px-2 py-1 rounded text-xs">
                  {participant.name}
                </div>
                {!participant.videoEnabled && (
                  <div className="absolute inset-0 bg-gray-900 flex items-center justify-center">
                    <Camera className="h-12 w-12 text-gray-500" />
                  </div>
                )}
                {!participant.audioEnabled && (
                  <div className="absolute top-2 right-2 bg-red-600 p-1 rounded">
                    <MicOff className="h-3 w-3" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Contrôles de réunion */}
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-30">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-6 py-3 border border-gray-600 flex items-center space-x-4">
              <Button
                variant={isAudioEnabled ? "secondary" : "destructive"}
                size="sm"
                onClick={toggleAudio}
                className="rounded-full w-12 h-12 p-0"
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={isVideoEnabled ? "secondary" : "destructive"}
                size="sm"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12 p-0"
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="sm"
                onClick={startScreenShare}
                className="rounded-full w-12 h-12 p-0"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              
              <Button
                variant={isRecording ? "destructive" : "secondary"}
                size="sm"
                onClick={toggleRecording}
                className="rounded-full w-12 h-12 p-0"
              >
                <Circle className="h-5 w-5" />
              </Button>
              
              <Button
                variant={isHandRaised ? "default" : "secondary"}
                size="sm"
                onClick={() => setIsHandRaised(!isHandRaised)}
                className="rounded-full w-12 h-12 p-0"
              >
                <Hand className="h-5 w-5" />
              </Button>
              
              <Button
                variant={showChat ? "default" : "secondary"}
                size="sm"
                onClick={() => setShowChat(!showChat)}
                className="rounded-full w-12 h-12 p-0"
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
              
              <Button
                variant="destructive"
                size="sm"
                onClick={leaveRoom}
                className="rounded-full w-12 h-12 p-0"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Panneau de chat */}
        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat de la réunion
              </h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <div className="font-medium text-blue-300">{msg.sender}</div>
                  <div className="text-gray-300">{msg.message}</div>
                  <div className="text-xs text-gray-500">
                    {msg.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  placeholder="Tapez votre message..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm"
                />
                <Button size="sm" onClick={sendChatMessage}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConferenceWebRTC;