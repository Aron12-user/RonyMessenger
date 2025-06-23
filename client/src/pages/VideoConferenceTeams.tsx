import React, { useState, useRef, useEffect } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { 
  Mic, MicOff, Video, VideoOff, Phone, MessageSquare, Users, Hand, 
  Copy, X, Send, Camera, AlertCircle, Grid3X3, Monitor, Settings,
  PhoneOff, UserPlus, FileText, MoreHorizontal, Maximize, Minimize,
  Pin, PinOff, Volume2, VolumeX, Share, Download, Upload
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
  isHandRaised: boolean;
  isSpeaking: boolean;
  isScreenSharing: boolean;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
  type: 'message' | 'system';
}

const VideoConferenceTeams = () => {
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
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [viewMode, setViewMode] = useState<'gallery' | 'speaker' | 'focus'>('gallery');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isPinned, setIsPinned] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const roomCode = params?.roomCode;

  // Timer for meeting duration
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const timer = setInterval(() => {
        setMeetingDuration(prev => prev + 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [connectionStatus]);

  // Format duration
  const formatDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` 
                   : `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
          audioEnabled: false,
          isHandRaised: false,
          isSpeaking: false,
          isScreenSharing: false
        };
        
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(data.participant.id, newParticipant);
          return newMap;
        });
        
        setChatMessages(prev => [...prev, {
          id: `sys-${Date.now()}`,
          sender: 'System',
          message: `${newParticipant.name} a rejoint la réunion`,
          timestamp: new Date(),
          type: 'system'
        }]);
        break;
        
      case 'participant-left':
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(data.participantId);
          newMap.delete(data.participantId);
          
          if (participant) {
            setChatMessages(prevMessages => [...prevMessages, {
              id: `sys-${Date.now()}`,
              sender: 'System',
              message: `${participant.name} a quitté la réunion`,
              timestamp: new Date(),
              type: 'system'
            }]);
          }
          
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
            timestamp: new Date(messageData.timestamp),
            type: 'message'
          }]);
          
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
  const initializeMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920, max: 3840 },
          height: { ideal: 1080, max: 2160 },
          frameRate: { ideal: 30, max: 60 }
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      localStreamRef.current = stream;
      
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      setIsVideoEnabled(true);
      setIsAudioEnabled(true);
      console.log('Media initialized successfully');

    } catch (error) {
      console.error('Error initializing media:', error);
      
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        localStreamRef.current = videoStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = videoStream;
        }
        
        setIsVideoEnabled(true);
        console.log('Video-only stream initialized');
      } catch (videoError) {
        console.error('Error initializing video:', videoError);
        toast({
          title: "Permissions médias refusées",
          description: "Réunion démarrée sans caméra/microphone",
          variant: "default"
        });
      }
    }
  };

  const toggleVideo = async () => {
    if (!isVideoEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920, max: 3840 },
            height: { ideal: 1080, max: 2160 },
            frameRate: { ideal: 30, max: 60 }
          }
        });

        if (localStreamRef.current) {
          const videoTrack = stream.getVideoTracks()[0];
          localStreamRef.current.addTrack(videoTrack);
        } else {
          localStreamRef.current = stream;
        }
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current;
        }

        setIsVideoEnabled(true);
        toast({ title: "Caméra activée" });

      } catch (error) {
        console.error('Error enabling video:', error);
        toast({
          title: "Erreur caméra",
          description: "Impossible d'accéder à la caméra",
          variant: "destructive"
        });
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getVideoTracks().forEach(track => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }

      setIsVideoEnabled(false);
      toast({ title: "Caméra désactivée" });
    }
  };

  const toggleAudio = async () => {
    if (!isAudioEnabled) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        if (localStreamRef.current) {
          const audioTrack = stream.getAudioTracks()[0];
          localStreamRef.current.addTrack(audioTrack);
        } else {
          localStreamRef.current = stream;
        }

        setIsAudioEnabled(true);
        toast({ title: "Microphone activé" });

      } catch (error) {
        console.error('Error enabling audio:', error);
        toast({
          title: "Erreur microphone",
          description: "Impossible d'accéder au microphone",
          variant: "destructive"
        });
      }
    } else {
      if (localStreamRef.current) {
        localStreamRef.current.getAudioTracks().forEach(track => {
          track.stop();
          localStreamRef.current?.removeTrack(track);
        });
      }

      setIsAudioEnabled(false);
      toast({ title: "Microphone désactivé" });
    }
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        setIsScreenSharing(true);
        toast({ title: "Partage d'écran démarré" });

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          toast({ title: "Partage d'écran arrêté" });
        };

      } catch (error) {
        console.error('Error starting screen share:', error);
        toast({
          title: "Erreur partage d'écran",
          description: "Impossible de partager l'écran",
          variant: "destructive"
        });
      }
    } else {
      setIsScreenSharing(false);
      toast({ title: "Partage d'écran arrêté" });
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

  const copyMeetingLink = () => {
    const meetingLink = `${window.location.origin}/meeting/${roomCode}`;
    navigator.clipboard.writeText(meetingLink);
    toast({ title: "Lien de réunion copié" });
  };

  const leaveRoom = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    wsRef.current?.close();
    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  // Initialize on mount
  useEffect(() => {
    if (roomCode && authUser) {
      initializeWebSocket();
      setTimeout(() => {
        initializeMedia();
      }, 1000);
      
      // Force connection after 3 seconds
      setTimeout(() => {
        if (connectionStatus === 'connecting') {
          setConnectionStatus('connected');
        }
      }, 3000);
    }

    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      wsRef.current?.close();
    };
  }, [roomCode, authUser]);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center bg-gray-800 border-gray-700">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-white">Code de réunion manquant</h2>
          <p className="text-gray-300 mb-6">Un code de réunion valide est requis</p>
          <Button onClick={() => setLocation('/')} className="w-full">
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="h-screen w-screen bg-gray-900 text-white overflow-hidden flex flex-col">
        
        {/* Top header */}
        <div className="bg-gray-800 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-3 h-3 rounded-full ${
                connectionStatus === 'connected' ? 'bg-green-400' : 
                connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
              }`}></div>
              <h1 className="font-semibold text-white">RonyMeet Teams</h1>
            </div>
            
            <Separator orientation="vertical" className="h-6 bg-gray-600" />
            
            <div className="flex items-center space-x-3">
              <Badge variant="secondary" className="bg-blue-600 text-white">
                {roomCode}
              </Badge>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomCode}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <Copy className="h-4 w-4 mr-2" />
                Copier le code
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={copyMeetingLink}
                className="text-gray-300 hover:text-white hover:bg-gray-700"
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Inviter
              </Button>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-300">
              <span className="font-mono">{formatDuration(meetingDuration)}</span>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="text-gray-300 hover:text-white hover:bg-gray-700"
            >
              {isFullscreen ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}
            </Button>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={leaveRoom}
              className="hover:bg-red-600 text-red-400 hover:text-white"
            >
              <PhoneOff className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Main content area */}
        <div className="flex-1 flex">
          
          {/* Main video area */}
          <div className="flex-1 relative bg-black">
            
            {/* View mode switcher */}
            <div className="absolute top-4 left-4 z-20 flex space-x-2">
              <Button
                variant={viewMode === 'gallery' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('gallery')}
                className="bg-black/60 hover:bg-black/80"
              >
                <Grid3X3 className="h-4 w-4 mr-2" />
                Galerie
              </Button>
              <Button
                variant={viewMode === 'speaker' ? 'default' : 'secondary'}
                size="sm"
                onClick={() => setViewMode('speaker')}
                className="bg-black/60 hover:bg-black/80"
              >
                <Users className="h-4 w-4 mr-2" />
                Orateur
              </Button>
            </div>

            {/* Video grid */}
            <div className={`h-full p-4 ${
              viewMode === 'gallery' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex items-center justify-center'
            }`}>
              
              {/* Local video */}
              <div className={`relative group ${
                viewMode === 'speaker' ? 'w-full max-w-4xl' : ''
              }`}>
                <div className="video-container relative bg-gray-800 overflow-hidden h-full min-h-[200px] rounded-xl shadow-2xl">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute bottom-4 left-4">
                    <div className="bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center space-x-2">
                      <span className="text-white font-medium text-sm">
                        {authUser?.displayName || authUser?.username} (Vous)
                      </span>
                      {isPinned && <Pin className="h-3 w-3 text-yellow-400" />}
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
                    {isScreenSharing && (
                      <div className="bg-blue-500/90 p-2 rounded-lg">
                        <Monitor className="h-4 w-4 text-white" />
                      </div>
                    )}
                  </div>
                  
                  {!isVideoEnabled && (
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-4">
                        <Camera className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-300 text-lg font-medium">Caméra désactivée</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Remote participants */}
              {Array.from(participants.values()).map((participant) => (
                <div key={participant.id} className="relative group">
                  <div className="participant-video-container relative bg-gray-800 overflow-hidden h-full min-h-[200px] rounded-xl shadow-2xl">
                    <div className="absolute bottom-4 left-4">
                      <div className="bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center space-x-2">
                        <span className="text-white font-medium text-sm">{participant.name}</span>
                        {participant.isSpeaking && (
                          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        )}
                      </div>
                    </div>
                    
                    <div className="absolute top-4 right-4 flex space-x-2">
                      {!participant.audioEnabled && (
                        <div className="bg-red-500/90 p-2 rounded-lg">
                          <MicOff className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {participant.isHandRaised && (
                        <div className="bg-yellow-500/90 p-2 rounded-lg">
                          <Hand className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {participant.isScreenSharing && (
                        <div className="bg-blue-500/90 p-2 rounded-lg">
                          <Monitor className="h-3 w-3 text-white" />
                        </div>
                      )}
                    </div>
                    
                    <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-4">
                        <Users className="h-8 w-8 text-gray-400" />
                      </div>
                      <p className="text-gray-300 text-lg font-medium">{participant.name}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Control bar */}
            <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
              <div className="bg-gray-800/95 backdrop-blur-lg rounded-2xl px-6 py-4 border border-gray-700 shadow-2xl">
                <div className="flex items-center space-x-4">
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isAudioEnabled ? "ghost" : "destructive"}
                        size="lg"
                        onClick={toggleAudio}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          isAudioEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : ''
                        }`}
                      >
                        {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      {isAudioEnabled ? "Couper le micro" : "Activer le micro"}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isVideoEnabled ? "ghost" : "destructive"}
                        size="lg"
                        onClick={toggleVideo}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          isVideoEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : ''
                        }`}
                      >
                        {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      {isVideoEnabled ? "Arrêter la vidéo" : "Démarrer la vidéo"}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Separator orientation="vertical" className="h-8 bg-gray-600" />
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={isScreenSharing ? "default" : "ghost"}
                        size="lg"
                        onClick={toggleScreenShare}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <Monitor className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      Partager l'écran
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={() => setIsHandRaised(!isHandRaised)}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          isHandRaised ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <Hand className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
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
                          showChat ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <MessageSquare className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      Chat
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={() => setShowParticipants(!showParticipants)}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          showParticipants ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <Users className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      Participants
                    </TooltipContent>
                  </Tooltip>
                  
                  <Separator orientation="vertical" className="h-8 bg-gray-600" />
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="lg"
                        className="rounded-full w-12 h-12 p-0 bg-gray-700 hover:bg-gray-600 transition-all duration-200 hover:scale-105"
                      >
                        <MoreHorizontal className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      Plus d'options
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="destructive"
                        size="lg"
                        onClick={leaveRoom}
                        className="rounded-full w-12 h-12 p-0 bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105"
                      >
                        <PhoneOff className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      Raccrocher
                    </TooltipContent>
                  </Tooltip>
                </div>
              </div>
            </div>
          </div>

          {/* Right sidebar - Participants & Chat */}
          {(showParticipants || showChat) && (
            <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
              
              {/* Sidebar tabs */}
              <div className="flex border-b border-gray-700">
                <Button
                  variant={showParticipants && !showChat ? "default" : "ghost"}
                  onClick={() => { setShowParticipants(true); setShowChat(false); }}
                  className="flex-1 rounded-none"
                >
                  <Users className="h-4 w-4 mr-2" />
                  Participants ({participants.size + 1})
                </Button>
                <Button
                  variant={showChat && !showParticipants ? "default" : "ghost"}
                  onClick={() => { setShowChat(true); setShowParticipants(false); }}
                  className="flex-1 rounded-none"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Chat ({chatMessages.length})
                </Button>
              </div>

              {/* Participants panel */}
              {showParticipants && !showChat && (
                <div className="flex-1 p-4">
                  <ScrollArea className="h-full">
                    <div className="space-y-3">
                      
                      {/* Local user */}
                      <div className="flex items-center space-x-3 p-3 rounded-lg bg-gray-700/50">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {(authUser?.displayName || authUser?.username || 'U').charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            {authUser?.displayName || authUser?.username} (Vous)
                          </p>
                        </div>
                        <div className="flex space-x-1">
                          {!isAudioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
                          {!isVideoEnabled && <VideoOff className="h-4 w-4 text-red-400" />}
                          {isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
                        </div>
                      </div>

                      {/* Remote participants */}
                      {Array.from(participants.values()).map((participant) => (
                        <div key={participant.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700/30">
                          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center">
                            <span className="text-white font-semibold text-sm">
                              {participant.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <p className="text-white font-medium text-sm">{participant.name}</p>
                            {participant.isSpeaking && (
                              <p className="text-green-400 text-xs">En train de parler</p>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            {!participant.audioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
                            {!participant.videoEnabled && <VideoOff className="h-4 w-4 text-red-400" />}
                            {participant.isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
                            {participant.isScreenSharing && <Monitor className="h-4 w-4 text-blue-400" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Chat panel */}
              {showChat && !showParticipants && (
                <div className="flex-1 flex flex-col">
                  <ScrollArea className="flex-1 p-4" ref={chatContainerRef}>
                    <div className="space-y-4">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className={`${
                          msg.type === 'system' ? 'text-center' : ''
                        }`}>
                          {msg.type === 'system' ? (
                            <div className="bg-gray-700/50 rounded-lg p-2">
                              <p className="text-gray-300 text-sm">{msg.message}</p>
                              <p className="text-gray-500 text-xs mt-1">
                                {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                              </p>
                            </div>
                          ) : (
                            <div className="bg-gray-700/30 rounded-lg p-3">
                              <div className="flex items-baseline space-x-2 mb-1">
                                <span className="font-semibold text-white text-sm">{msg.sender}</span>
                                <span className="text-gray-400 text-xs">
                                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </span>
                              </div>
                              <p className="text-gray-200 break-words">{msg.message}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                  
                  <div className="p-4 border-t border-gray-700">
                    <div className="flex space-x-3">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Tapez votre message..."
                        className="flex-1 bg-gray-700 border-gray-600 text-white placeholder-gray-400"
                        onKeyPress={(e) => e.key === 'Enter' && sendChatMessage()}
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
            </div>
          )}
        </div>

        {/* Connection status overlay */}
        {connectionStatus === 'connecting' && (
          <div className="absolute inset-0 bg-gray-900/90 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-gray-800 p-8 rounded-xl text-center border border-gray-700 shadow-2xl">
              <div className="animate-spin w-12 h-12 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
              <p className="text-white text-xl mb-2">Connexion à la réunion...</p>
              <p className="text-gray-400">Initialisation des médias</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoConferenceTeams;