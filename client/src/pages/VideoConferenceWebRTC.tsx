import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, MicOff, Video, VideoOff, ScreenShare, ScreenShareOff, Phone, 
  MessageSquare, Users, Settings, MoreVertical, Hand, Copy, X, Send,
  Camera, AlertCircle, PictureInPicture, Grid3X3, Maximize2
} from 'lucide-react';
import { performMediaDiagnostic } from '@/components/MediaDiagnostic';

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
  connection?: RTCPeerConnection;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

const VideoConferenceWebRTC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Références
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

  // États de l'interface
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [isHandRaised, setIsHandRaised] = useState(false);
  
  // États de l'interface
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');
  const [videoQuality, setVideoQuality] = useState<'low' | 'medium' | 'high' | '4k' | '8k'>('8k');
  const [showControlBar, setShowControlBar] = useState(true);
  
  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const roomCode = params?.roomCode;

  // Configuration WebRTC ultra-haute qualité
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Contraintes vidéo 8K Ultra HD avec gestion intelligente des bugs
  const getVideoConstraints = (quality: string) => {
    switch (quality) {
      case '8k':
        return [
          // 8K Ultra HD avec gestion ultra-intelligente des bugs
          {
            width: { ideal: 7680, max: 7680, min: 3840 },
            height: { ideal: 4320, max: 4320, min: 2160 },
            frameRate: { ideal: 120, max: 120, min: 60 },
            facingMode: 'user',
            aspectRatio: 1.777777778
          },
          {
            width: { ideal: 7680, max: 7680, min: 3840 },
            height: { ideal: 4320, max: 4320, min: 2160 },
            frameRate: { ideal: 60, max: 60, min: 30 },
            facingMode: 'user',
            aspectRatio: 1.777777778
          },
          // 6K fallback intelligent
          {
            width: { ideal: 6144, max: 6144, min: 3840 },
            height: { ideal: 3456, max: 3456, min: 2160 },
            frameRate: { ideal: 60, min: 30 },
            facingMode: 'user'
          },
          // 5K fallback
          {
            width: { ideal: 5120, max: 5120, min: 2560 },
            height: { ideal: 2880, max: 2880, min: 1440 },
            frameRate: { ideal: 60, min: 30 },
            facingMode: 'user'
          },
          // 4K fallback robuste
          {
            width: { ideal: 3840, max: 3840, min: 1920 },
            height: { ideal: 2160, max: 2160, min: 1080 },
            frameRate: { ideal: 60, min: 30 },
            facingMode: 'user'
          }
        ];
      case '4k':
        return [
          {
            width: { ideal: 3840, max: 3840, min: 1920 },
            height: { ideal: 2160, max: 2160, min: 1080 },
            frameRate: { ideal: 60, max: 60, min: 30 },
            facingMode: 'user',
            aspectRatio: 1.777777778
          }
        ];
      case 'high':
        return [
          {
            width: { ideal: 1920, max: 1920, min: 1280 },
            height: { ideal: 1080, max: 1080, min: 720 },
            frameRate: { ideal: 120, max: 120, min: 60 },
            facingMode: 'user',
            aspectRatio: 1.777777778
          }
        ];
      default:
        return [
          {
            width: { ideal: 1280, max: 1920 },
            height: { ideal: 720, max: 1080 },
            frameRate: { ideal: 30 },
            facingMode: 'user'
          }
        ];
    }
  };

  // Initialisation WebSocket avec gestion chat
  const initializeWebSocket = useCallback(() => {
    if (!roomCode) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    console.log('🔌 Connexion WebSocket:', wsUrl);
    
    try {
      wsRef.current = new WebSocket(wsUrl);
      
      wsRef.current.onopen = () => {
        console.log('✅ WebSocket connecté');
        setConnectionStatus('connected');
        
        // Rejoindre la salle
        wsRef.current?.send(JSON.stringify({
          type: 'join-room',
          roomCode,
          userId: authUser?.id.toString(),
          userInfo: {
            name: authUser?.displayName || authUser?.username || 'Utilisateur',
            id: authUser?.id.toString()
          }
        }));
      };

      wsRef.current.onmessage = async (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📨 Message WebSocket reçu:', data);
          await handleWebSocketMessage(data);
        } catch (error) {
          console.error('❌ Erreur parsing message WebSocket:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('❌ WebSocket fermé');
        setConnectionStatus('disconnected');
        
        setTimeout(() => {
          if (roomCode && authUser) {
            console.log('🔄 Reconnexion WebSocket...');
            initializeWebSocket();
          }
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('❌ Erreur WebSocket:', error);
        setConnectionStatus('failed');
      };

    } catch (error) {
      console.error('❌ Erreur création WebSocket:', error);
      setConnectionStatus('failed');
    }
  }, [roomCode, authUser]);

  // Gestion des messages WebSocket
  const handleWebSocketMessage = async (data: any) => {
    switch (data.type) {
      case 'chat_message':
        console.log('📨 Message chat reçu via WebSocket:', data);
        const incomingMsg = data.data || data.message;
        if (incomingMsg) {
          setChatMessages(prev => {
            const messageExists = prev.some(msg => msg.id === incomingMsg.id);
            if (messageExists) return prev;
            
            return [...prev, {
              id: incomingMsg.id,
              sender: incomingMsg.sender,
              message: incomingMsg.message || incomingMsg.text,
              timestamp: new Date(incomingMsg.timestamp)
            }];
          });
          
          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
          }, 100);
        }
        break;
    }
  };

  // Initialisation du stream local
  const initializeLocalStream = async () => {
    try {
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

      if (!diagnostic.hasCamera && !diagnostic.hasMicrophone) {
        toast({
          title: "Aucun périphérique détecté",
          description: "Connectez une caméra et un microphone pour participer",
          variant: "destructive",
          duration: 10000
        });
      } else {
        toast({
          title: "Vidéoconférence prête",
          description: `${diagnostic.devices.cameras} caméra(s) et ${diagnostic.devices.microphones} micro(s) détecté(s)`
        });
      }

    } catch (error) {
      console.error('❌ Erreur initialisation stream local:', error);
    }
  };

  // Contrôles audio/vidéo
  const toggleAudio = async () => {
    try {
      if (!isAudioEnabled) {
        const audioStream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
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
        toast({ title: "Microphone activé" });
      } else {
        if (localStreamRef.current) {
          const audioTrack = localStreamRef.current.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
            setIsAudioEnabled(false);
            toast({ title: "Microphone désactivé" });
          }
        }
      }
    } catch (error) {
      console.error('❌ Erreur toggle audio:', error);
      toast({
        title: "Microphone inaccessible",
        description: "Vérifiez les permissions dans votre navigateur",
        variant: "destructive"
      });
    }
  };

  const toggleVideo = async () => {
    try {
      if (!isVideoEnabled) {
        const constraints = getVideoConstraints(videoQuality);
        
        for (let i = 0; i < constraints.length; i++) {
          try {
            const videoStream = await navigator.mediaDevices.getUserMedia({ 
              video: constraints[i]
            });
            
            const videoTrack = videoStream.getVideoTracks()[0];
            console.log('✅ Vidéo activée avec contraintes:', constraints[i]);
            console.log('📹 Settings vidéo:', videoTrack.getSettings());
            
            if (localStreamRef.current) {
              localStreamRef.current.addTrack(videoTrack);
            } else {
              localStreamRef.current = videoStream;
            }
            
            if (localVideoRef.current) {
              localVideoRef.current.srcObject = localStreamRef.current;
            }
            
            setIsVideoEnabled(true);
            toast({ 
              title: "Caméra activée",
              description: `Qualité: ${videoTrack.getSettings().width}x${videoTrack.getSettings().height} @ ${videoTrack.getSettings().frameRate}fps`
            });
            
            break;
          } catch (error) {
            console.warn(`❌ Tentative ${i + 1} échouée:`, error);
            if (i === constraints.length - 1) {
              setIsVideoEnabled(false);
              toast({
                title: "Caméra inaccessible",
                description: "Impossible d'accéder à votre caméra. Vérifiez les permissions.",
                variant: "destructive"
              });
            }
          }
        }
      } else {
        if (localStreamRef.current) {
          const videoTracks = localStreamRef.current.getVideoTracks();
          videoTracks.forEach(track => {
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }
        
        setIsVideoEnabled(false);
        toast({ title: "Caméra désactivée" });
      }
    } catch (error) {
      console.error('❌ Erreur toggle vidéo:', error);
    }
  };

  // Chat fonctionnel
  const sendChatMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !authUser) {
      console.warn('Chat: message vide, WebSocket manquant ou utilisateur non authentifié');
      return;
    }
    
    if (wsRef.current.readyState !== WebSocket.OPEN) {
      console.error('Chat WebSocket fermé - état:', wsRef.current.readyState);
      toast({
        title: "Connexion interrompue",
        description: "Reconnexion automatique en cours...",
        variant: "destructive"
      });
      return;
    }
    
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const chatMessage = {
      type: 'chat_message',
      roomCode,
      data: {
        id: messageId,
        sender: authUser.displayName || authUser.username,
        message: newMessage.trim(),
        timestamp: new Date().toISOString(),
        userId: authUser.id
      }
    };
    
    console.log('📤 Envoi message chat WebSocket:', chatMessage);
    
    try {
      wsRef.current.send(JSON.stringify(chatMessage));
      
      const newChatMessage = {
        id: messageId,
        sender: chatMessage.data.sender,
        message: chatMessage.data.message,
        timestamp: new Date()
      };
      
      setChatMessages(prev => {
        const messageExists = prev.some(msg => msg.id === messageId);
        if (messageExists) return prev;
        return [...prev, newChatMessage];
      });
      
      setNewMessage('');
      
      setTimeout(() => {
        if (chatContainerRef.current) {
          const container = chatContainerRef.current;
          container.scrollTop = container.scrollHeight;
        }
      }, 150);
      
    } catch (error) {
      console.error('❌ Erreur envoi message chat:', error);
      toast({
        title: "Erreur d'envoi",
        description: "Impossible d'envoyer le message",
        variant: "destructive"
      });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
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

  // Gestion automatique de la barre de contrôles
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;
    
    const hideControlBar = () => {
      hideTimeout = setTimeout(() => {
        setShowControlBar(false);
      }, 3000);
    };
    
    const showControlBarFunc = () => {
      setShowControlBar(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => {
        setShowControlBar(false);
      }, 3000);
    };

    setShowControlBar(true);
    hideControlBar();
    
    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight * 0.7) {
        showControlBarFunc();
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
        
        {/* Barre de navigation ultra-transparente */}
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
                <h1 className="font-medium text-xs text-white/80">RonyMeet Pro</h1>
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
                onClick={leaveRoom}
                className="hover:bg-red-500/20 h-6 w-6 p-0 text-red-400"
              >
                <X className="h-2.5 w-2.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Zone vidéo principale */}
        <div className="absolute inset-0 bg-black">
          <div className={`h-full ${layoutMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'flex flex-col'}`} style={{padding: participants.size === 0 ? '20px' : '4px'}}>
            
            {/* Vidéo locale */}
            <div className="relative group">
              <div className="main-video-container relative bg-transparent overflow-hidden h-full rounded-sm">
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

            {/* Participants distants */}
            {Array.from(participants.values()).map((participant) => (
              <div key={participant.id} className="relative group">
                <div className="participant-video-container relative bg-transparent overflow-hidden h-full rounded-sm">
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

          {/* Barre de contrôles ultra-transparente */}
          <div 
            className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-500 ease-in-out ${
              showControlBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
            }`}
          >
            <div className="bg-gradient-to-t from-black/40 via-black/20 to-transparent pt-16 pb-4">
              <div className="flex justify-center">
                <div className="bg-black/20 backdrop-blur-md rounded-full px-4 py-2 border border-white/10 shadow-xl">
                  <div className="flex items-center space-x-2">
                    
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
                        {isAudioEnabled ? "Désactiver le micro" : "Activer le micro"}
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
                        {isVideoEnabled ? "Désactiver la caméra" : "Activer la caméra"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsHandRaised(!isHandRaised)}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                            isHandRaised ? 'bg-yellow-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <Hand className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isHandRaised ? "Baisser la main" : "Lever la main"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-6 bg-white/20 mx-1"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowChat(!showChat)}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                            showChat ? 'bg-blue-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Chat
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setShowParticipants(!showParticipants)}
                          className={`rounded-full w-8 h-8 p-0 transition-all duration-200 hover:scale-110 ${
                            showParticipants ? 'bg-blue-500/80 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <Users className="h-3.5 w-3.5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Participants
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-6 bg-white/20 mx-1"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={leaveRoom}
                          className="rounded-full w-9 h-9 p-0 bg-red-500/80 hover:bg-red-500 transition-all duration-200 hover:scale-110"
                        >
                          <Phone className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Quitter
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Panneau de chat */}
        {showChat && (
          <div className="absolute top-0 right-0 w-80 h-full bg-black/20 backdrop-blur-md border-l border-white/10 z-20">
            <div className="p-3 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white/90">Chat</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(false)}
                  className="hover:bg-white/10 h-6 w-6 p-0 text-white/70"
                >
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col h-[calc(100%-60px)]">
              <ScrollArea className="flex-1 custom-scrollbar" ref={chatContainerRef}>
                <div className="p-3 space-y-3">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-xs">
                      <div className="flex items-baseline space-x-2">
                        <span className="font-medium text-white/90">{msg.sender}:</span>
                        <span className="text-white/60 text-xs">
                          {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-white/80 mt-0.5 break-words">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="p-3 border-t border-white/10">
                <div className="flex space-x-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 bg-white/10 border-white/20 text-white placeholder-white/50 text-xs"
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  />
                  <Button 
                    size="sm" 
                    onClick={sendChatMessage}
                    disabled={!newMessage.trim()}
                    className="bg-blue-500/80 hover:bg-blue-500 h-8 w-8 p-0"
                  >
                    <Send className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Overlay de chargement */}
        {isLoading && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-black/80 p-6 rounded-lg text-center">
              <div className="animate-spin w-8 h-8 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
              <p className="text-white/90">Connexion en cours...</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoConferenceWebRTC;