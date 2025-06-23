import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, Hand, 
  Copy, X, Send, Camera, AlertCircle, Grid3X3
} from 'lucide-react';

interface User {
  id: number;
  username: string;
  displayName?: string;
}

interface Participant {
  id: string;
  name: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

const VideoConferenceSimple = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  // States
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showControlBar, setShowControlBar] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const roomCode = params?.roomCode;

  // Initialize WebSocket connection
  const initializeWebSocket = () => {
    if (!roomCode || !authUser) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    console.log('Connecting to WebSocket:', wsUrl);
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WebSocket connected');
      setConnectionStatus('connected');
      
      // Join room
      wsRef.current?.send(JSON.stringify({
        type: 'join-room',
        roomCode,
        userId: authUser.id.toString(),
        userInfo: {
          name: authUser.displayName || authUser.username,
          id: authUser.id.toString()
        }
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('WebSocket closed');
      setConnectionStatus('disconnected');
      
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (roomCode && authUser) {
          initializeWebSocket();
        }
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  };

  // Handle WebSocket messages
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'room-joined':
        console.log('Room joined successfully');
        break;
        
      case 'participant-joined':
        const newParticipant: Participant = {
          id: data.participant.id,
          name: data.participant.name || 'Unknown',
          videoEnabled: false,
          audioEnabled: false
        };
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(data.participant.id, newParticipant);
          return newMap;
        });
        
        toast({
          title: `${newParticipant.name} a rejoint la réunion`
        });
        break;
        
      case 'participant-left':
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.participantId);
          return newMap;
        });
        break;
        
      case 'chat_message':
        const messageData = data.data || data.message;
        if (messageData) {
          setChatMessages(prev => [...prev, {
            id: messageData.id,
            sender: messageData.sender,
            message: messageData.message || messageData.text,
            timestamp: new Date(messageData.timestamp)
          }]);
          
          // Auto scroll chat
          setTimeout(() => {
            if (chatContainerRef.current) {
              chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
          }, 100);
        }
        break;
    }
  };

  // Media controls
  const toggleVideo = async () => {
    try {
      if (!isVideoEnabled) {
        // Enable video
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1080, max: 2160 },
            frameRate: { ideal: 30, max: 60 }
          }
        });

        localStreamRef.current = stream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        setIsVideoEnabled(true);
        toast({ title: "Caméra activée" });

      } else {
        // Disable video
        if (localStreamRef.current) {
          localStreamRef.current.getVideoTracks().forEach(track => {
            track.stop();
          });
        }

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = null;
        }

        localStreamRef.current = null;
        setIsVideoEnabled(false);
        toast({ title: "Caméra désactivée" });
      }
    } catch (error) {
      console.error('Error toggling video:', error);
      toast({
        title: "Erreur caméra",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive"
      });
    }
  };

  const toggleAudio = async () => {
    try {
      if (!isAudioEnabled) {
        // Enable audio
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        // If we already have a video stream, add audio track to it
        if (localStreamRef.current) {
          const audioTrack = stream.getAudioTracks()[0];
          localStreamRef.current.addTrack(audioTrack);
        } else {
          localStreamRef.current = stream;
        }

        setIsAudioEnabled(true);
        toast({ title: "Microphone activé" });

      } else {
        // Disable audio
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach(track => {
            track.stop();
            localStreamRef.current?.removeTrack(track);
          });
        }

        setIsAudioEnabled(false);
        toast({ title: "Microphone désactivé" });
      }
    } catch (error) {
      console.error('Error toggling audio:', error);
      toast({
        title: "Erreur microphone",
        description: "Impossible d'accéder au microphone",
        variant: "destructive"
      });
    }
  };

  // Chat functions
  const sendChatMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !authUser) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message = {
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

    wsRef.current.send(JSON.stringify(message));
    setNewMessage('');
  };

  // Utility functions
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  const leaveRoom = () => {
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close WebSocket
    wsRef.current?.close();

    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  // Auto-hide controls
  useEffect(() => {
    let hideTimeout: NodeJS.Timeout;
    
    const showControls = () => {
      setShowControlBar(true);
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(() => setShowControlBar(false), 3000);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (e.clientY > window.innerHeight * 0.7) {
        showControls();
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    showControls();

    return () => {
      clearTimeout(hideTimeout);
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  // Initialize on mount
  useEffect(() => {
    if (roomCode && authUser) {
      initializeWebSocket();
    }

    return () => {
      // Cleanup
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
    <TooltipProvider>
      <div className="h-screen w-screen bg-black text-white overflow-hidden relative">
        
        {/* Top navigation bar */}
        <div className={`absolute top-0 left-0 right-0 z-30 transition-all duration-500 ${
          showControlBar ? 'opacity-100 bg-black/20 backdrop-blur-sm' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="px-6 py-3 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <h1 className="font-semibold text-white">RonyMeet</h1>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomCode}
                className="text-sm border border-white/30 hover:bg-white/10 text-white/90"
              >
                <Copy className="h-4 w-4 mr-2" />
                {roomCode}
              </Button>
              
              <div className="bg-white/10 px-3 py-1 rounded text-sm text-white/90">
                <Users className="h-4 w-4 mr-1 inline" />
                {participants.size + 1} participants
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={leaveRoom}
              className="hover:bg-red-500/20 text-red-400"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main video area */}
        <div className="absolute inset-0 bg-black">
          <div className="h-full grid grid-cols-1 lg:grid-cols-2 gap-4 p-6">
            
            {/* Local video */}
            <div className="relative group">
              <div className="video-container relative bg-gray-900 overflow-hidden h-full rounded-xl shadow-2xl">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute bottom-4 left-4">
                  <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg">
                    <span className="text-white font-medium">
                      Vous ({authUser?.displayName || authUser?.username})
                    </span>
                  </div>
                </div>
                
                <div className="absolute top-4 right-4 flex space-x-2">
                  {!isAudioEnabled && (
                    <div className="bg-red-500/90 p-2 rounded-lg">
                      <MicOff className="h-4 w-4 text-white" />
                    </div>
                  )}
                  {isHandRaised && (
                    <div className="bg-yellow-500/90 p-2 rounded-lg">
                      <Hand className="h-4 w-4 text-white" />
                    </div>
                  )}
                </div>
                
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                      <Camera className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-gray-300 text-lg">Caméra désactivée</p>
                  </div>
                )}
              </div>
            </div>

            {/* Remote participants */}
            {Array.from(participants.values()).map((participant) => (
              <div key={participant.id} className="relative group">
                <div className="participant-video-container relative bg-gray-900 overflow-hidden h-full rounded-xl shadow-2xl">
                  <div className="absolute bottom-4 left-4">
                    <div className="bg-black/60 backdrop-blur-md px-3 py-2 rounded-lg">
                      <span className="text-white font-medium">{participant.name}</span>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-gradient-to-br from-gray-800 to-gray-900 flex flex-col items-center justify-center">
                    <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mb-4">
                      <Users className="h-10 w-10 text-gray-400" />
                    </div>
                    <p className="text-gray-300 text-lg">{participant.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Control bar */}
          <div className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-500 ${
            showControlBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          }`}>
            <div className="bg-gradient-to-t from-black/80 via-black/40 to-transparent pt-24 pb-8">
              <div className="flex justify-center">
                <div className="bg-black/50 backdrop-blur-lg rounded-2xl px-8 py-4 border border-white/20 shadow-2xl">
                  <div className="flex items-center space-x-4">
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isAudioEnabled ? "ghost" : "destructive"}
                          size="lg"
                          onClick={toggleAudio}
                          className={`rounded-full w-14 h-14 p-0 transition-all duration-200 hover:scale-105 ${
                            isAudioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          {isAudioEnabled ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/30">
                        {isAudioEnabled ? "Désactiver le micro" : "Activer le micro"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isVideoEnabled ? "ghost" : "destructive"}
                          size="lg"
                          onClick={toggleVideo}
                          className={`rounded-full w-14 h-14 p-0 transition-all duration-200 hover:scale-105 ${
                            isVideoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          {isVideoEnabled ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/30">
                        {isVideoEnabled ? "Désactiver la caméra" : "Activer la caméra"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-10 bg-white/30 mx-2"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => setIsHandRaised(!isHandRaised)}
                          className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                            isHandRaised ? 'bg-yellow-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <Hand className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/30">
                        {isHandRaised ? "Baisser la main" : "Lever la main"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => setShowChat(!showChat)}
                          className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                            showChat ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <MessageSquare className="h-5 w-5" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/30">
                        Chat
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-10 bg-white/30 mx-2"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="lg"
                          onClick={leaveRoom}
                          className="rounded-full w-14 h-14 p-0 bg-red-500 hover:bg-red-600 transition-all duration-200 hover:scale-105"
                        >
                          <Phone className="h-6 w-6" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/90 text-white border-white/30">
                        Quitter la réunion
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        {showChat && (
          <div className="absolute top-0 right-0 w-96 h-full bg-black/40 backdrop-blur-xl border-l border-white/20 z-20">
            <div className="p-6 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Chat</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowChat(false)}
                  className="hover:bg-white/10 h-8 w-8 p-0 text-white/70"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            
            <div className="flex flex-col h-[calc(100%-100px)]">
              <ScrollArea className="flex-1" ref={chatContainerRef}>
                <div className="p-6 space-y-4">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="bg-white/5 rounded-lg p-3">
                      <div className="flex items-baseline space-x-2 mb-1">
                        <span className="font-semibold text-white">{msg.sender}</span>
                        <span className="text-white/50 text-xs">
                          {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                      <p className="text-white/90 break-words">{msg.message}</p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
              
              <div className="p-6 border-t border-white/20">
                <div className="flex space-x-3">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Tapez votre message..."
                    className="flex-1 bg-white/10 border-white/30 text-white placeholder-white/50"
                    onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
                  />
                  <Button 
                    size="sm" 
                    onClick={sendChatMessage}
                    disabled={!newMessage.trim()}
                    className="bg-blue-500 hover:bg-blue-600 h-10 w-10 p-0"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Connection status overlay */}
        {connectionStatus !== 'connected' && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-black/90 p-8 rounded-xl text-center border border-white/20">
              <div className="animate-spin w-12 h-12 border-2 border-white/20 border-t-white rounded-full mx-auto mb-6"></div>
              <p className="text-white text-xl mb-2">
                {connectionStatus === 'connecting' ? 'Connexion en cours...' : 'Reconnexion...'}
              </p>
              <p className="text-white/70">
                Préparation de votre vidéoconférence
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoConferenceSimple;