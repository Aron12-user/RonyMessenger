
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, 
  MicOff, 
  Video, 
  VideoOff, 
  PhoneOff, 
  MonitorUp, 
  Copy,
  Users,
  Settings
} from 'lucide-react';
import useWebSocket from '@/hooks/useWebSocket';
import { WS_EVENTS } from '@/lib/constants';

interface WebRTCRoomProps {
  roomCode: string;
  userName: string;
  userId: number;
  onClose: () => void;
  isMinimized?: boolean;
  onToggleMinimize?: () => void;
}

interface Participant {
  id: number;
  name: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

const iceServers = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];

export default function WebRTCRoom({ 
  roomCode, 
  userName, 
  userId, 
  onClose, 
  isMinimized = false,
  onToggleMinimize 
}: WebRTCRoomProps) {
  const { toast } = useToast();
  const { sendMessage, addMessageHandler } = useWebSocket();
  
  // États locaux
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [participants, setParticipants] = useState<Map<number, Participant>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  
  // Références
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<number, RTCPeerConnection>>(new Map());
  
  // Configuration WebRTC
  const peerConnectionConfig = {
    iceServers,
    iceCandidatePoolSize: 10,
  };

  // Initialiser le stream local
  const initializeLocalStream = useCallback(async () => {
    try {
      // Vérifier si on est en HTTPS
      const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
      
      if (!isSecure) {
        throw new Error('HTTPS_REQUIRED');
      }

      // Vérifier la disponibilité des médias
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_NOT_SUPPORTED');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 1280, height: 720 },
        audio: true
      });
      
      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      
      return stream;
    } catch (error: any) {
      console.error('Erreur d\'accès aux médias:', error);
      
      let title = "Erreur d'accès aux médias";
      let description = "Impossible d'accéder à la caméra ou au microphone";
      
      if (error.message === 'HTTPS_REQUIRED') {
        title = "Connexion sécurisée requise";
        description = "Les réunions vidéo nécessitent une connexion HTTPS. Veuillez déployer l'application.";
      } else if (error.message === 'MEDIA_NOT_SUPPORTED') {
        title = "Navigateur non supporté";
        description = "Votre navigateur ne supporte pas l'accès aux médias.";
      } else if (error.name === 'NotAllowedError') {
        title = "Autorisation refusée";
        description = "Veuillez autoriser l'accès à la caméra et au microphone dans les paramètres du navigateur.";
      } else if (error.name === 'NotFoundError') {
        title = "Équipement introuvable";
        description = "Aucune caméra ou microphone détecté sur cet appareil.";
      }
      
      toast({
        title,
        description,
        variant: "destructive"
      });
      throw error;
    }
  }, [toast]);

  // Créer une connexion peer
  const createPeerConnection = useCallback((participantId: number) => {
    const peerConnection = new RTCPeerConnection(peerConnectionConfig);
    
    // Ajouter le stream local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
      });
    }
    
    // Gérer les événements ICE
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        sendMessage(WS_EVENTS.WEBRTC_ICE_CANDIDATE, {
          roomCode,
          targetId: participantId,
          candidate: event.candidate
        });
      }
    };
    
    // Gérer les streams entrants
    peerConnection.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setParticipants(prev => {
        const newParticipants = new Map(prev);
        const participant = newParticipants.get(participantId);
        if (participant) {
          participant.stream = remoteStream;
          newParticipants.set(participantId, participant);
        }
        return newParticipants;
      });
    };
    
    // Gérer les changements de connexion
    peerConnection.onconnectionstatechange = () => {
      console.log(`Connexion avec ${participantId}:`, peerConnection.connectionState);
      if (peerConnection.connectionState === 'failed') {
        // Tentative de reconnexion
        peerConnection.restartIce();
      }
    };
    
    peerConnectionsRef.current.set(participantId, peerConnection);
    return peerConnection;
  }, [roomCode, sendMessage]);

  // Rejoindre la salle
  const joinRoom = useCallback(async () => {
    try {
      await initializeLocalStream();
      
      // Notifier l'arrivée dans la salle
      sendMessage(WS_EVENTS.JOIN_WEBRTC_ROOM, {
        roomCode,
        userId,
        userName
      });
      
      setIsConnected(true);
      
      toast({
        title: "Connexion établie",
        description: "Vous avez rejoint la réunion"
      });
    } catch (error: any) {
      console.error('Erreur lors de la connexion:', error);
      
      // Tentative de connexion audio seulement
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false
        });
        
        localStreamRef.current = audioStream;
        setIsVideoMuted(true);
        
        sendMessage(WS_EVENTS.JOIN_WEBRTC_ROOM, {
          roomCode,
          userId,
          userName
        });
        
        setIsConnected(true);
        
        toast({
          title: "Connexion audio établie",
          description: "Vous avez rejoint la réunion en mode audio seulement"
        });
      } catch (audioError) {
        toast({
          title: "Échec de la connexion",
          description: "Impossible d'accéder aux médias. Vérifiez vos autorisations.",
          variant: "destructive"
        });
        onClose();
      }
    }
  }, [initializeLocalStream, sendMessage, roomCode, userId, userName, toast, onClose]);

  // Quitter la salle
  const leaveRoom = useCallback(() => {
    // Arrêter le stream local
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }
    
    // Fermer toutes les connexions peer
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    // Notifier le départ
    sendMessage(WS_EVENTS.LEAVE_WEBRTC_ROOM, {
      roomCode,
      userId
    });
    
    setIsConnected(false);
    onClose();
  }, [sendMessage, roomCode, userId, onClose]);

  // Basculer le micro
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = isAudioMuted;
        setIsAudioMuted(!isAudioMuted);
      }
    }
  };

  // Basculer la vidéo
  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = isVideoMuted;
        setIsVideoMuted(!isVideoMuted);
      }
    }
  };

  // Partage d'écran
  const toggleScreenShare = async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });
        
        // Remplacer le track vidéo dans toutes les connexions
        const videoTrack = screenStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        // Mettre à jour le stream local
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = screenStream;
        }
        
        setIsScreenSharing(true);
        
        // Gérer l'arrêt du partage d'écran
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          // Revenir à la caméra
          initializeLocalStream();
        };
      } else {
        // Revenir à la caméra
        const cameraStream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true
        });
        
        const videoTrack = cameraStream.getVideoTracks()[0];
        peerConnectionsRef.current.forEach((pc) => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          if (sender) {
            sender.replaceTrack(videoTrack);
          }
        });
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = cameraStream;
        }
        
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Erreur lors du partage d\'écran:', error);
      toast({
        title: "Erreur",
        description: "Impossible de partager l'écran",
        variant: "destructive"
      });
    }
  };

  // Copier le code de la salle
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast({
      title: "Code copié",
      description: "Le code de la réunion a été copié"
    });
  };

  // Gestionnaires WebSocket
  useEffect(() => {
    const handlers = [
      // Nouveau participant
      addMessageHandler(WS_EVENTS.USER_JOINED_WEBRTC_ROOM, async ({ userId: newUserId, userName: newUserName }) => {
        if (newUserId === userId) return;
        
        setParticipants(prev => {
          const newParticipants = new Map(prev);
          newParticipants.set(newUserId, {
            id: newUserId,
            name: newUserName
          });
          return newParticipants;
        });
        
        // Créer une offre pour le nouveau participant
        const peerConnection = createPeerConnection(newUserId);
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        sendMessage(WS_EVENTS.WEBRTC_OFFER, {
          roomCode,
          targetId: newUserId,
          offer
        });
      }),
      
      // Participant quitté
      addMessageHandler(WS_EVENTS.USER_LEFT_WEBRTC_ROOM, ({ userId: leftUserId }) => {
        setParticipants(prev => {
          const newParticipants = new Map(prev);
          newParticipants.delete(leftUserId);
          return newParticipants;
        });
        
        // Fermer la connexion peer
        const peerConnection = peerConnectionsRef.current.get(leftUserId);
        if (peerConnection) {
          peerConnection.close();
          peerConnectionsRef.current.delete(leftUserId);
        }
      }),
      
      // Offre WebRTC reçue
      addMessageHandler(WS_EVENTS.WEBRTC_OFFER, async ({ fromId, offer }) => {
        const peerConnection = createPeerConnection(fromId);
        await peerConnection.setRemoteDescription(offer);
        
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        
        sendMessage(WS_EVENTS.WEBRTC_ANSWER, {
          roomCode,
          targetId: fromId,
          answer
        });
      }),
      
      // Réponse WebRTC reçue
      addMessageHandler(WS_EVENTS.WEBRTC_ANSWER, async ({ fromId, answer }) => {
        const peerConnection = peerConnectionsRef.current.get(fromId);
        if (peerConnection) {
          await peerConnection.setRemoteDescription(answer);
        }
      }),
      
      // Candidat ICE reçu
      addMessageHandler(WS_EVENTS.WEBRTC_ICE_CANDIDATE, async ({ fromId, candidate }) => {
        const peerConnection = peerConnectionsRef.current.get(fromId);
        if (peerConnection) {
          await peerConnection.addIceCandidate(candidate);
        }
      })
    ];
    
    return () => {
      handlers.forEach(remove => remove());
    };
  }, [addMessageHandler, createPeerConnection, sendMessage, roomCode, userId]);

  // Initialisation
  useEffect(() => {
    joinRoom();
    
    return () => {
      leaveRoom();
    };
  }, []);

  if (isMinimized) {
    return (
      <div 
        className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg border p-4 z-50 cursor-pointer"
        onClick={onToggleMinimize}
        style={{ background: 'var(--color-surface)' }}
      >
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Réunion en cours</span>
          <span className="text-xs text-gray-500">{participants.size + 1} participants</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 bg-black z-50 flex flex-col"
      style={{ background: 'var(--color-background)' }}
    >
      {/* Warning Banner for HTTP */}
      {window.location.protocol === 'http:' && window.location.hostname !== 'localhost' && (
        <div className="bg-yellow-500 text-black p-2 text-center text-sm">
          ⚠️ Les réunions vidéo nécessitent HTTPS. Déployez l'application pour une utilisation complète.
        </div>
      )}
      
      {/* Header */}
      <div 
        className="flex items-center justify-between p-4 border-b"
        style={{ 
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Réunion {roomCode}</h3>
          <Button
            onClick={copyRoomCode}
            variant="outline"
            size="sm"
            className="flex items-center space-x-2"
          >
            <Copy className="h-4 w-4" />
            <span>Copier le code</span>
          </Button>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Users className="h-4 w-4" />
            <span>{participants.size + 1} participants</span>
          </div>
          
          {onToggleMinimize && (
            <Button
              onClick={onToggleMinimize}
              variant="outline"
              size="sm"
            >
              Réduire
            </Button>
          )}
          
          <Button
            onClick={leaveRoom}
            variant="destructive"
            size="sm"
            className="flex items-center space-x-2"
          >
            <PhoneOff className="h-4 w-4" />
            <span>Quitter</span>
          </Button>
        </div>
      </div>

      {/* Zone vidéo */}
      <div className="flex-1 flex">
        {/* Vidéos des participants */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
          {/* Vidéo locale */}
          <div className="relative bg-gray-900 rounded-lg overflow-hidden">
            <video
              ref={localVideoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover"
            />
            <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
              {userName} (Vous)
            </div>
            {isVideoMuted && (
              <div className="absolute inset-0 bg-gray-800 flex items-center justify-center">
                <VideoOff className="h-8 w-8 text-gray-400" />
              </div>
            )}
          </div>

          {/* Vidéos des autres participants */}
          {Array.from(participants.values()).map((participant) => (
            <ParticipantVideo
              key={participant.id}
              participant={participant}
            />
          ))}
        </div>
      </div>

      {/* Contrôles */}
      <div 
        className="p-4 border-t"
        style={{ 
          background: 'var(--color-surface)',
          borderColor: 'var(--color-border)'
        }}
      >
        <div className="flex items-center justify-center space-x-4">
          <Button
            onClick={toggleAudio}
            variant={isAudioMuted ? "destructive" : "outline"}
            size="lg"
            className="w-12 h-12 rounded-full"
          >
            {isAudioMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={toggleVideo}
            variant={isVideoMuted ? "destructive" : "outline"}
            size="lg"
            className="w-12 h-12 rounded-full"
          >
            {isVideoMuted ? <VideoOff className="h-6 w-6" /> : <Video className="h-6 w-6" />}
          </Button>
          
          <Button
            onClick={toggleScreenShare}
            variant={isScreenSharing ? "default" : "outline"}
            size="lg"
            className="w-12 h-12 rounded-full"
          >
            <MonitorUp className="h-6 w-6" />
          </Button>
        </div>
      </div>
    </div>
  );
}

// Composant pour afficher la vidéo d'un participant
function ParticipantVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  
  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);
  
  return (
    <div className="relative bg-gray-900 rounded-lg overflow-hidden">
      {participant.stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mx-auto mb-2">
              <span className="text-2xl font-bold text-white">
                {participant.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm text-gray-400">Connexion...</span>
          </div>
        </div>
      )}
      <div className="absolute bottom-2 left-2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-sm">
        {participant.name}
      </div>
    </div>
  );
}
