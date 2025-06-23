import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { 
  AlertCircle, ArrowLeft, Camera, Mic, Monitor, Phone, PhoneOff,
  MicOff, CameraOff, Settings, Users, MessageSquare, MoreVertical,
  Maximize2, Minimize2, Grid3X3, ScreenShare, ScreenShareOff,
  Volume2, VolumeX, Square, Play, Pause, Circle
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  displayName?: string;
}

interface Participant {
  id: string;
  name: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isLocal: boolean;
  joinTime: Date;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

const VideoConferenceNative = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();
  
  // États principaux
  const [isConnected, setIsConnected] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [connectionQuality, setConnectionQuality] = useState<'excellent' | 'good' | 'poor'>('excellent');
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  // Configuration WebRTC optimisée
  const rtcConfig: RTCConfiguration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
      { urls: 'stun:stun3.l.google.com:19302' },
      { urls: 'stun:stun4.l.google.com:19302' }
    ],
    iceCandidatePoolSize: 10,
    bundlePolicy: 'max-bundle',
    rtcpMuxPolicy: 'require'
  };

  // Initialisation des médias avec stratégies multiples
  const initializeMedia = useCallback(async () => {
    console.log('🚀 Initialisation des médias...');
    
    try {
      const strategies = [
        // Stratégie 1: HD avec audio
        { video: { width: 1280, height: 720, frameRate: 30 }, audio: { echoCancellation: true, noiseSuppression: true } },
        // Stratégie 2: Standard avec audio
        { video: { width: 854, height: 480, frameRate: 24 }, audio: true },
        // Stratégie 3: Basique avec audio
        { video: { width: 640, height: 360, frameRate: 15 }, audio: true },
        // Stratégie 4: Vidéo seulement HD
        { video: { width: 1280, height: 720, frameRate: 30 }, audio: false },
        // Stratégie 5: Vidéo seulement standard
        { video: { width: 640, height: 480, frameRate: 24 }, audio: false },
        // Stratégie 6: Audio seulement
        { video: false, audio: true }
      ];

      let stream: MediaStream | null = null;

      for (const constraints of strategies) {
        try {
          console.log('Tentative avec contraintes:', constraints);
          stream = await navigator.mediaDevices.getUserMedia(constraints);
          console.log('✅ Succès avec contraintes:', constraints);
          break;
        } catch (error) {
          console.log('❌ Échec avec contraintes:', constraints, error);
        }
      }

      if (stream) {
        setLocalStream(stream);
        
        const videoTracks = stream.getVideoTracks();
        const audioTracks = stream.getAudioTracks();
        
        setIsVideoEnabled(videoTracks.length > 0);
        setIsAudioEnabled(audioTracks.length > 0);
        
        // Afficher la vidéo locale
        if (localVideoRef.current && videoTracks.length > 0) {
          localVideoRef.current.srcObject = stream;
        }

        // Ajouter le participant local
        const localParticipant: Participant = {
          id: 'local',
          name: authUser?.displayName || authUser?.username || 'Vous',
          stream,
          audioEnabled: audioTracks.length > 0,
          videoEnabled: videoTracks.length > 0,
          isLocal: true,
          joinTime: new Date()
        };

        setParticipants(prev => new Map(prev.set('local', localParticipant)));

        toast({
          title: "Médias initialisés",
          description: `Vidéo: ${videoTracks.length > 0 ? 'Activée' : 'Désactivée'}, Audio: ${audioTracks.length > 0 ? 'Activé' : 'Désactivé'}`,
        });

        return stream;
      } else {
        throw new Error('Aucun média disponible');
      }
    } catch (error) {
      console.error('Erreur initialisation médias:', error);
      toast({
        title: "Erreur d'accès aux médias",
        description: "Impossible d'accéder à la caméra ou au microphone",
        variant: "destructive"
      });
      
      // Créer un participant local sans média
      const localParticipant: Participant = {
        id: 'local',
        name: authUser?.displayName || authUser?.username || 'Vous',
        audioEnabled: false,
        videoEnabled: false,
        isLocal: true,
        joinTime: new Date()
      };
      
      setParticipants(prev => new Map(prev.set('local', localParticipant)));
      return null;
    }
  }, [authUser, toast]);

  // Connexion WebSocket
  const connectWebSocket = useCallback(() => {
    if (!roomCode) return;

    console.log('🔌 Connexion WebSocket...');
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('✅ WebSocket connecté');
      setIsConnected(true);
      
      // Rejoindre la salle
      ws.send(JSON.stringify({
        type: 'join-room',
        roomCode,
        userData: {
          id: `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          name: authUser?.displayName || authUser?.username || 'Participant'
        }
      }));
    };

    ws.onmessage = async (event) => {
      try {
        const message = JSON.parse(event.data);
        await handleWebSocketMessage(message);
      } catch (error) {
        console.error('Erreur traitement message:', error);
      }
    };

    ws.onclose = () => {
      console.log('❌ WebSocket fermé');
      setIsConnected(false);
      
      // Tentative de reconnexion
      setTimeout(() => {
        if (wsRef.current?.readyState === WebSocket.CLOSED) {
          connectWebSocket();
        }
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('❌ Erreur WebSocket:', error);
      toast({
        title: "Erreur de connexion",
        description: "Problème de connexion au serveur",
        variant: "destructive"
      });
    };
  }, [roomCode, authUser]);

  // Gestion des messages WebSocket
  const handleWebSocketMessage = async (message: any) => {
    console.log('📨 Message reçu:', message.type);

    switch (message.type) {
      case 'user-joined':
        await handleUserJoined(message.userData);
        break;
      case 'user-left':
        handleUserLeft(message.userId);
        break;
      case 'offer':
        await handleOffer(message);
        break;
      case 'answer':
        await handleAnswer(message);
        break;
      case 'ice-candidate':
        await handleIceCandidate(message);
        break;
      case 'chat-message':
        handleChatMessage(message);
        break;
      case 'media-state-changed':
        handleMediaStateChanged(message);
        break;
    }
  };

  // Gestion d'un nouvel utilisateur
  const handleUserJoined = async (userData: any) => {
    console.log('👤 Utilisateur rejoint:', userData.name);
    
    const newParticipant: Participant = {
      id: userData.id,
      name: userData.name,
      audioEnabled: true,
      videoEnabled: true,
      isLocal: false,
      joinTime: new Date()
    };

    setParticipants(prev => new Map(prev.set(userData.id, newParticipant)));
    
    // Créer une connexion peer-to-peer
    await createPeerConnection(userData.id, true);
  };

  // Création d'une connexion peer-to-peer
  const createPeerConnection = async (userId: string, createOffer: boolean) => {
    console.log(`🔗 Création connexion P2P avec ${userId}`);
    
    const peerConnection = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(userId, peerConnection);

    // Ajouter le stream local si disponible
    if (localStream) {
      localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
      });
    }

    // Gestion du stream distant
    peerConnection.ontrack = (event) => {
      console.log(`📺 Stream reçu de ${userId}`);
      const [remoteStream] = event.streams;
      
      setParticipants(prev => {
        const updated = new Map(prev);
        const participant = updated.get(userId);
        if (participant) {
          updated.set(userId, { ...participant, stream: remoteStream });
        }
        return updated;
      });
    };

    // Gestion des candidats ICE
    peerConnection.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          candidate: event.candidate,
          targetUserId: userId
        }));
      }
    };

    // Surveillance de la connexion
    peerConnection.onconnectionstatechange = () => {
      console.log(`🔌 État connexion avec ${userId}:`, peerConnection.connectionState);
      
      if (peerConnection.connectionState === 'connected') {
        setConnectionQuality('excellent');
      } else if (peerConnection.connectionState === 'disconnected') {
        setConnectionQuality('poor');
      }
    };

    // Créer une offre si nécessaire
    if (createOffer) {
      try {
        const offer = await peerConnection.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true
        });
        
        await peerConnection.setLocalDescription(offer);
        
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            type: 'offer',
            offer,
            targetUserId: userId
          }));
        }
      } catch (error) {
        console.error('Erreur création offre:', error);
      }
    }
  };

  // Gestion d'une offre
  const handleOffer = async (message: any) => {
    console.log('📩 Offre reçue');
    
    const peerConnection = peerConnectionsRef.current.get(message.senderUserId) || 
                           await createPeerConnectionForUser(message.senderUserId);
    
    try {
      await peerConnection.setRemoteDescription(message.offer);
      
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'answer',
          answer,
          targetUserId: message.senderUserId
        }));
      }
    } catch (error) {
      console.error('Erreur traitement offre:', error);
    }
  };

  // Création d'une connexion pour un utilisateur existant
  const createPeerConnectionForUser = async (userId: string) => {
    await createPeerConnection(userId, false);
    return peerConnectionsRef.current.get(userId)!;
  };

  // Gestion d'une réponse
  const handleAnswer = async (message: any) => {
    console.log('📨 Réponse reçue');
    
    const peerConnection = peerConnectionsRef.current.get(message.senderUserId);
    if (peerConnection) {
      try {
        await peerConnection.setRemoteDescription(message.answer);
      } catch (error) {
        console.error('Erreur traitement réponse:', error);
      }
    }
  };

  // Gestion des candidats ICE
  const handleIceCandidate = async (message: any) => {
    const peerConnection = peerConnectionsRef.current.get(message.senderUserId);
    if (peerConnection) {
      try {
        await peerConnection.addIceCandidate(message.candidate);
      } catch (error) {
        console.error('Erreur ajout candidat ICE:', error);
      }
    }
  };

  // Gestion de la sortie d'un utilisateur
  const handleUserLeft = (userId: string) => {
    console.log('👋 Utilisateur parti:', userId);
    
    // Fermer la connexion
    const peerConnection = peerConnectionsRef.current.get(userId);
    if (peerConnection) {
      peerConnection.close();
      peerConnectionsRef.current.delete(userId);
    }
    
    // Supprimer le participant
    setParticipants(prev => {
      const updated = new Map(prev);
      updated.delete(userId);
      return updated;
    });
  };

  // Gestion des messages de chat
  const handleChatMessage = (message: any) => {
    const chatMsg: ChatMessage = {
      id: Date.now().toString(),
      sender: message.senderName,
      message: message.message,
      timestamp: new Date()
    };
    
    setChatMessages(prev => [...prev, chatMsg]);
  };

  // Gestion des changements d'état média
  const handleMediaStateChanged = (message: any) => {
    setParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(message.userId);
      if (participant) {
        updated.set(message.userId, {
          ...participant,
          audioEnabled: message.audioEnabled,
          videoEnabled: message.videoEnabled
        });
      }
      return updated;
    });
  };

  // Contrôles média
  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTracks = localStream.getAudioTracks();
      const newEnabled = !isAudioEnabled;
      
      audioTracks.forEach(track => {
        track.enabled = newEnabled;
      });
      
      setIsAudioEnabled(newEnabled);
      
      // Notifier les autres participants
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'media-state-changed',
          audioEnabled: newEnabled,
          videoEnabled: isVideoEnabled
        }));
      }
    }
  }, [localStream, isAudioEnabled, isVideoEnabled]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTracks = localStream.getVideoTracks();
      const newEnabled = !isVideoEnabled;
      
      videoTracks.forEach(track => {
        track.enabled = newEnabled;
      });
      
      setIsVideoEnabled(newEnabled);
      
      // Notifier les autres participants
      if (wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'media-state-changed',
          audioEnabled: isAudioEnabled,
          videoEnabled: newEnabled
        }));
      }
    }
  }, [localStream, isAudioEnabled, isVideoEnabled]);

  // Partage d'écran
  const toggleScreenShare = useCallback(async () => {
    try {
      if (!isScreenSharing) {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: 30 },
          audio: true
        });
        
        // Remplacer les pistes vidéo dans toutes les connexions
        const videoTrack = screenStream.getVideoTracks()[0];
        
        peerConnectionsRef.current.forEach(async (peerConnection) => {
          const sender = peerConnection.getSenders().find(
            s => s.track && s.track.kind === 'video'
          );
          
          if (sender) {
            await sender.replaceTrack(videoTrack);
          }
        });
        
        setIsScreenSharing(true);
        
        // Arrêter le partage quand l'utilisateur clique sur "arrêter"
        videoTrack.onended = () => {
          setIsScreenSharing(false);
          // Revenir à la caméra
          if (localStream) {
            const cameraTrack = localStream.getVideoTracks()[0];
            peerConnectionsRef.current.forEach(async (peerConnection) => {
              const sender = peerConnection.getSenders().find(
                s => s.track && s.track.kind === 'video'
              );
              
              if (sender && cameraTrack) {
                await sender.replaceTrack(cameraTrack);
              }
            });
          }
        };
        
      } else {
        // Revenir à la caméra
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          
          peerConnectionsRef.current.forEach(async (peerConnection) => {
            const sender = peerConnection.getSenders().find(
              s => s.track && s.track.kind === 'video'
            );
            
            if (sender && cameraTrack) {
              await sender.replaceTrack(cameraTrack);
            }
          });
        }
        
        setIsScreenSharing(false);
      }
    } catch (error) {
      console.error('Erreur partage d\'écran:', error);
      toast({
        title: "Erreur de partage d'écran",
        description: "Impossible de partager l'écran",
        variant: "destructive"
      });
    }
  }, [isScreenSharing, localStream, toast]);

  // Enregistrement
  const toggleRecording = useCallback(async () => {
    try {
      if (!isRecording) {
        if (localStream) {
          const mediaRecorder = new MediaRecorder(localStream, {
            mimeType: 'video/webm;codecs=vp9'
          });
          
          mediaRecorderRef.current = mediaRecorder;
          recordedChunksRef.current = [];
          
          mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              recordedChunksRef.current.push(event.data);
            }
          };
          
          mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunksRef.current, {
              type: 'video/webm'
            });
            
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `reunion-${roomCode}-${new Date().toISOString()}.webm`;
            a.click();
            
            URL.revokeObjectURL(url);
          };
          
          mediaRecorder.start();
          setIsRecording(true);
          
          toast({
            title: "Enregistrement démarré",
            description: "La réunion est en cours d'enregistrement",
          });
        }
      } else {
        if (mediaRecorderRef.current) {
          mediaRecorderRef.current.stop();
          setIsRecording(false);
          
          toast({
            title: "Enregistrement arrêté",
            description: "Le fichier va être téléchargé",
          });
        }
      }
    } catch (error) {
      console.error('Erreur enregistrement:', error);
      toast({
        title: "Erreur d'enregistrement",
        description: "Impossible d'enregistrer la réunion",
        variant: "destructive"
      });
    }
  }, [isRecording, localStream, roomCode, toast]);

  // Envoi de message de chat
  const sendChatMessage = useCallback(() => {
    if (newMessage.trim() && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'chat-message',
        message: newMessage.trim()
      }));
      
      setNewMessage('');
    }
  }, [newMessage]);

  // Quitter la réunion
  const leaveRoom = useCallback(() => {
    console.log('👋 Quitter la réunion');
    
    // Fermer toutes les connexions
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();
    
    // Fermer WebSocket
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    // Arrêter les streams
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    // Arrêter l'enregistrement
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    setLocation('/');
  }, [localStream, isRecording, setLocation]);

  // Initialisation
  useEffect(() => {
    if (roomCode && authUser) {
      const init = async () => {
        console.log('🚀 Initialisation complète...');
        setIsInitializing(true);
        
        try {
          await initializeMedia();
          connectWebSocket();
          
          setTimeout(() => {
            setIsInitializing(false);
          }, 2000);
          
        } catch (error) {
          console.error('Erreur initialisation:', error);
          setIsInitializing(false);
        }
      };
      
      init();
    }

    return () => {
      leaveRoom();
    };
  }, [roomCode, authUser, initializeMedia, connectWebSocket, leaveRoom]);

  // Gestion des raccourcis clavier
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === 'm' && event.ctrlKey) {
        event.preventDefault();
        toggleAudio();
      } else if (event.key === 'v' && event.ctrlKey) {
        event.preventDefault();
        toggleVideo();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [toggleAudio, toggleVideo]);

  // Rendu des participants
  const renderParticipants = () => {
    const participantArray = Array.from(participants.values());
    const gridCols = participantArray.length <= 2 ? 'grid-cols-1 md:grid-cols-2' :
                     participantArray.length <= 4 ? 'grid-cols-2' :
                     participantArray.length <= 6 ? 'grid-cols-2 md:grid-cols-3' :
                     'grid-cols-2 md:grid-cols-4';

    return (
      <div className={`grid ${gridCols} gap-4 h-full`}>
        {participantArray.map((participant) => (
          <div
            key={participant.id}
            className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600"
          >
            {participant.stream && participant.videoEnabled ? (
              <video
                ref={participant.isLocal ? localVideoRef : undefined}
                autoPlay
                muted={participant.isLocal}
                playsInline
                className="w-full h-full object-cover"
                onLoadedMetadata={(e) => {
                  if (!participant.isLocal) {
                    const video = e.target as HTMLVideoElement;
                    video.srcObject = participant.stream!;
                  }
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-700">
                <div className="text-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center mb-2 mx-auto">
                    <span className="text-2xl font-bold text-white">
                      {participant.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm">{participant.name}</p>
                </div>
              </div>
            )}
            
            {/* Overlay avec info participant */}
            <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-white text-xs flex items-center space-x-1">
              <span>{participant.name}</span>
              {!participant.audioEnabled && <MicOff className="h-3 w-3" />}
              {!participant.videoEnabled && <CameraOff className="h-3 w-3" />}
              {participant.isLocal && <span className="text-blue-400">(Vous)</span>}
            </div>
            
            {/* Indicateur de qualité de connexion */}
            <div className="absolute top-2 right-2">
              <div className={`w-2 h-2 rounded-full ${
                connectionQuality === 'excellent' ? 'bg-green-400' :
                connectionQuality === 'good' ? 'bg-yellow-400' : 'bg-red-400'
              }`} />
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center bg-gray-800 border-gray-700">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-white">Code de réunion manquant</h2>
          <Button onClick={() => setLocation('/')} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-lg w-full text-center bg-gray-800 border-gray-700">
          <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-4 text-white">Initialisation de la réunion</h2>
          <p className="text-gray-300 mb-6">
            Configuration des médias et connexion au serveur...
          </p>
          
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-300 mb-1">
              <strong>Salle:</strong> {roomCode}
            </p>
            <p className="text-sm text-blue-300">
              <strong>Participant:</strong> {authUser?.displayName || authUser?.username}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-gray-900 flex flex-col`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-white">RonyMeet - {roomCode}</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Users className="h-4 w-4" />
            <span>{participants.size}</span>
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            onClick={() => setIsFullscreen(!isFullscreen)}
            variant="outline"
            size="sm"
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          
          <Button onClick={leaveRoom} variant="destructive" size="sm">
            <PhoneOff className="h-4 w-4 mr-2" />
            Quitter
          </Button>
        </div>
      </div>

      {/* Zone principale */}
      <div className="flex-1 flex">
        {/* Zone vidéo */}
        <div className="flex-1 p-4">
          {renderParticipants()}
        </div>
        
        {/* Chat (optionnel) */}
        {showChat && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700">
              <h3 className="font-semibold text-white">Chat</h3>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto space-y-2">
              {chatMessages.map((msg) => (
                <div key={msg.id} className="text-sm">
                  <div className="text-gray-400 text-xs">
                    {msg.sender} - {msg.timestamp.toLocaleTimeString()}
                  </div>
                  <div className="text-white">{msg.message}</div>
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
                  className="flex-1 px-3 py-2 bg-gray-700 text-white rounded border border-gray-600"
                />
                <Button onClick={sendChatMessage} size="sm">
                  Envoyer
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Barre de contrôles */}
      <div className="bg-gray-800 border-t border-gray-700 p-4">
        <div className="flex items-center justify-center space-x-4">
          {/* Contrôles audio/vidéo */}
          <Button
            onClick={toggleAudio}
            variant={isAudioEnabled ? "default" : "destructive"}
            size="sm"
          >
            {isAudioEnabled ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}
          </Button>
          
          <Button
            onClick={toggleVideo}
            variant={isVideoEnabled ? "default" : "destructive"}
            size="sm"
          >
            {isVideoEnabled ? <Camera className="h-4 w-4" /> : <CameraOff className="h-4 w-4" />}
          </Button>
          
          {/* Partage d'écran */}
          <Button
            onClick={toggleScreenShare}
            variant={isScreenSharing ? "secondary" : "outline"}
            size="sm"
          >
            {isScreenSharing ? <ScreenShareOff className="h-4 w-4" /> : <ScreenShare className="h-4 w-4" />}
          </Button>
          
          {/* Enregistrement */}
          <Button
            onClick={toggleRecording}
            variant={isRecording ? "destructive" : "outline"}
            size="sm"
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
          </Button>
          
          {/* Chat */}
          <Button
            onClick={() => setShowChat(!showChat)}
            variant={showChat ? "secondary" : "outline"}
            size="sm"
          >
            <MessageSquare className="h-4 w-4" />
          </Button>
          
          {/* Paramètres */}
          <Button
            onClick={() => setShowSettings(!showSettings)}
            variant="outline"
            size="sm"
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>
        
        {/* Raccourcis clavier */}
        <div className="text-center text-xs text-gray-500 mt-2">
          Ctrl+M: Audio | Ctrl+V: Vidéo
        </div>
      </div>
    </div>
  );
};

export default VideoConferenceNative;