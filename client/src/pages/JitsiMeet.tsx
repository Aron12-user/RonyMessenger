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

interface JitsiParticipant {
  id: string;
  name: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isHandRaised: boolean;
  isModerator: boolean;
  stream?: MediaStream;
}

interface ChatMessage {
  id: string;
  participantId: string;
  participantName: string;
  text: string;
  timestamp: string;
  type: 'chat-message';
}

const JitsiMeet = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideosRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const wsRef = useRef<WebSocket | null>(null);

  // States
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [participants, setParticipants] = useState<Map<string, JitsiParticipant>>(new Map());
  const [localParticipant, setLocalParticipant] = useState<JitsiParticipant>({
    id: '',
    name: '',
    audioEnabled: false,
    videoEnabled: false,
    isHandRaised: false,
    isModerator: false
  });
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);
  const [viewMode, setViewMode] = useState<'gallery' | 'speaker'>('gallery');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [meetingDuration, setMeetingDuration] = useState(0);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const roomCode = params?.roomCode;

  // WebRTC Configuration
  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
      { urls: 'stun:stun2.l.google.com:19302' },
    ]
  };

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
  const initializeJitsiConnection = () => {
    if (!roomCode || !authUser) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/jitsi-ws`;
    
    console.log('Connecting to Jitsi WebSocket:', wsUrl);
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('Jitsi WebSocket connected');
      setConnectionStatus('connected');
      
      // Join room
      const participantName = authUser.displayName || authUser.username;
      wsRef.current?.send(JSON.stringify({
        type: 'join-room',
        roomId: roomCode,
        participantName,
        isModerator: false
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleJitsiMessage(data);
      } catch (error) {
        console.error('Error parsing Jitsi message:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('Jitsi WebSocket closed');
      setConnectionStatus('disconnected');
      
      // Reconnect after 3 seconds
      setTimeout(() => {
        if (roomCode && authUser) {
          initializeJitsiConnection();
        }
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('Jitsi WebSocket error:', error);
      setConnectionStatus('disconnected');
    };
  };

  // Handle Jitsi messages
  const handleJitsiMessage = async (data: any) => {
    switch (data.type) {
      case 'room-joined':
        console.log('Joined Jitsi room:', data);
        setLocalParticipant(prev => ({
          ...prev,
          id: data.participantId,
          name: authUser?.displayName || authUser?.username || 'Unknown',
          isModerator: data.participants.length === 0
        }));
        
        // Update participants list
        const participantMap = new Map<string, JitsiParticipant>();
        data.participants.forEach((p: any) => {
          if (p.id !== data.participantId) {
            participantMap.set(p.id, p);
          }
        });
        setParticipants(participantMap);
        
        // Initiate WebRTC connections with existing participants
        for (const participant of data.participants) {
          if (participant.id !== data.participantId) {
            await createPeerConnection(participant.id, true);
          }
        }
        break;
        
      case 'participant-joined':
        console.log('New participant joined:', data.participant);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.set(data.participant.id, data.participant);
          return newMap;
        });
        
        // Create peer connection for new participant
        await createPeerConnection(data.participant.id, false);
        break;
        
      case 'participant-left':
        console.log('Participant left:', data.participantId);
        setParticipants(prev => {
          const newMap = new Map(prev);
          newMap.delete(data.participantId);
          return newMap;
        });
        
        // Clean up peer connection
        const pc = peerConnectionsRef.current.get(data.participantId);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(data.participantId);
        }
        break;
        
      case 'offer':
        await handleWebRTCOffer(data);
        break;
        
      case 'answer':
        await handleWebRTCAnswer(data);
        break;
        
      case 'ice-candidate':
        await handleICECandidate(data);
        break;
        
      case 'chat-message':
        setChatMessages(prev => [...prev, data]);
        break;
        
      case 'participant-audio-changed':
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(data.participantId);
          if (participant) {
            participant.audioEnabled = data.audioEnabled;
          }
          return newMap;
        });
        break;
        
      case 'participant-video-changed':
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(data.participantId);
          if (participant) {
            participant.videoEnabled = data.videoEnabled;
          }
          return newMap;
        });
        break;
        
      case 'participant-hand-changed':
        setParticipants(prev => {
          const newMap = new Map(prev);
          const participant = newMap.get(data.participantId);
          if (participant) {
            participant.isHandRaised = data.isHandRaised;
          }
          return newMap;
        });
        break;
    }
  };

  // Create WebRTC peer connection
  const createPeerConnection = async (participantId: string, isInitiator: boolean) => {
    const pc = new RTCPeerConnection(rtcConfig);
    peerConnectionsRef.current.set(participantId, pc);

    // Add local stream to peer connection
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle remote stream
    pc.ontrack = (event) => {
      console.log('Received remote track from:', participantId);
      const remoteStream = event.streams[0];
      const videoElement = document.getElementById(`remote-video-${participantId}`) as HTMLVideoElement;
      if (videoElement) {
        videoElement.srcObject = remoteStream;
      }
    };

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current) {
        wsRef.current.send(JSON.stringify({
          type: 'ice-candidate',
          targetParticipantId: participantId,
          candidate: event.candidate
        }));
      }
    };

    // Create offer if initiator
    if (isInitiator) {
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        
        wsRef.current?.send(JSON.stringify({
          type: 'offer',
          targetParticipantId: participantId,
          offer
        }));
      } catch (error) {
        console.error('Error creating offer:', error);
      }
    }

    return pc;
  };

  // Handle WebRTC offer
  const handleWebRTCOffer = async (data: any) => {
    const { fromParticipantId, offer } = data;
    let pc = peerConnectionsRef.current.get(fromParticipantId);
    
    if (!pc) {
      pc = await createPeerConnection(fromParticipantId, false);
    }

    try {
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      wsRef.current?.send(JSON.stringify({
        type: 'answer',
        targetParticipantId: fromParticipantId,
        answer
      }));
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  // Handle WebRTC answer
  const handleWebRTCAnswer = async (data: any) => {
    const { fromParticipantId, answer } = data;
    const pc = peerConnectionsRef.current.get(fromParticipantId);
    
    if (pc) {
      try {
        await pc.setRemoteDescription(answer);
      } catch (error) {
        console.error('Error handling answer:', error);
      }
    }
  };

  // Handle ICE candidate
  const handleICECandidate = async (data: any) => {
    const { fromParticipantId, candidate } = data;
    const pc = peerConnectionsRef.current.get(fromParticipantId);
    
    if (pc) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error('Error adding ICE candidate:', error);
      }
    }
  };

  // Initialize media
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

      setLocalParticipant(prev => ({
        ...prev,
        audioEnabled: true,
        videoEnabled: true
      }));

      // Notify server about media state
      wsRef.current?.send(JSON.stringify({
        type: 'toggle-audio',
        enabled: true
      }));
      
      wsRef.current?.send(JSON.stringify({
        type: 'toggle-video',
        enabled: true
      }));

    } catch (error) {
      console.error('Error initializing media:', error);
      
      // Try video only
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
        localStreamRef.current = videoStream;
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = videoStream;
        }
        
        setLocalParticipant(prev => ({ ...prev, videoEnabled: true }));
        
        wsRef.current?.send(JSON.stringify({
          type: 'toggle-video',
          enabled: true
        }));
        
      } catch (videoError) {
        console.error('Error initializing video:', videoError);
        toast({
          title: "Permissions médias refusées",
          description: "Réunion démarrée sans caméra/microphone",
        });
      }
    }
  };

  // Media controls
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      const newState = !localParticipant.audioEnabled;
      
      audioTracks.forEach(track => {
        track.enabled = newState;
      });
      
      setLocalParticipant(prev => ({ ...prev, audioEnabled: newState }));
      
      wsRef.current?.send(JSON.stringify({
        type: 'toggle-audio',
        enabled: newState
      }));
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTracks = localStreamRef.current.getVideoTracks();
      const newState = !localParticipant.videoEnabled;
      
      videoTracks.forEach(track => {
        track.enabled = newState;
      });
      
      setLocalParticipant(prev => ({ ...prev, videoEnabled: newState }));
      
      wsRef.current?.send(JSON.stringify({
        type: 'toggle-video',
        enabled: newState
      }));
    }
  };

  const toggleHandRaise = () => {
    const newState = !localParticipant.isHandRaised;
    setLocalParticipant(prev => ({ ...prev, isHandRaised: newState }));
    
    wsRef.current?.send(JSON.stringify({
      type: 'raise-hand',
      raised: newState
    }));
  };

  const toggleScreenShare = async () => {
    if (!isScreenSharing) {
      try {
        const screenStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true
        });

        setIsScreenSharing(true);
        
        wsRef.current?.send(JSON.stringify({
          type: 'screen-share',
          enabled: true
        }));

        screenStream.getVideoTracks()[0].onended = () => {
          setIsScreenSharing(false);
          wsRef.current?.send(JSON.stringify({
            type: 'screen-share',
            enabled: false
          }));
        };

      } catch (error) {
        console.error('Error starting screen share:', error);
      }
    } else {
      setIsScreenSharing(false);
      wsRef.current?.send(JSON.stringify({
        type: 'screen-share',
        enabled: false
      }));
    }
  };

  // Chat functions
  const sendChatMessage = () => {
    if (newMessage.trim() && wsRef.current) {
      wsRef.current.send(JSON.stringify({
        type: 'chat-message',
        text: newMessage.trim()
      }));
      setNewMessage('');
    }
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
    // Stop all media tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    peerConnectionsRef.current.forEach(pc => pc.close());
    peerConnectionsRef.current.clear();

    // Close WebSocket
    wsRef.current?.close();

    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  // Initialize on mount
  useEffect(() => {
    if (roomCode && authUser) {
      initializeJitsiConnection();
      
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
      peerConnectionsRef.current.forEach(pc => pc.close());
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
              <h1 className="font-semibold text-white">Jitsi Meet</h1>
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
            
            {/* Video grid */}
            <div className={`h-full p-4 ${
              viewMode === 'gallery' 
                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'
                : 'flex items-center justify-center'
            }`}>
              
              {/* Local video */}
              <div className="relative group">
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
                        {localParticipant.name} (Vous)
                      </span>
                      {localParticipant.isModerator && (
                        <Badge variant="secondary" className="text-xs bg-yellow-600/30 text-yellow-200">
                          Modérateur
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="absolute top-4 right-4 flex space-x-2">
                    {!localParticipant.audioEnabled && (
                      <div className="bg-red-500/90 p-2 rounded-lg">
                        <MicOff className="h-4 w-4 text-white" />
                      </div>
                    )}
                    {localParticipant.isHandRaised && (
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
                  
                  {!localParticipant.videoEnabled && (
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
                    <video
                      id={`remote-video-${participant.id}`}
                      autoPlay
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    
                    <div className="absolute bottom-4 left-4">
                      <div className="bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center space-x-2">
                        <span className="text-white font-medium text-sm">{participant.name}</span>
                        {participant.isModerator && (
                          <Badge variant="secondary" className="text-xs bg-yellow-600/30 text-yellow-200">
                            Modérateur
                          </Badge>
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
                    </div>
                    
                    {!participant.videoEnabled && (
                      <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center">
                        <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-4">
                          <Users className="h-8 w-8 text-gray-400" />
                        </div>
                        <p className="text-gray-300 text-lg font-medium">{participant.name}</p>
                      </div>
                    )}
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
                        variant={localParticipant.audioEnabled ? "ghost" : "destructive"}
                        size="lg"
                        onClick={toggleAudio}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          localParticipant.audioEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : ''
                        }`}
                      >
                        {localParticipant.audioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      {localParticipant.audioEnabled ? "Couper le micro" : "Activer le micro"}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant={localParticipant.videoEnabled ? "ghost" : "destructive"}
                        size="lg"
                        onClick={toggleVideo}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          localParticipant.videoEnabled ? 'bg-gray-700 hover:bg-gray-600 text-white' : ''
                        }`}
                      >
                        {localParticipant.videoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      {localParticipant.videoEnabled ? "Arrêter la vidéo" : "Démarrer la vidéo"}
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
                      {isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
                    </TooltipContent>
                  </Tooltip>
                  
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="lg"
                        onClick={toggleHandRaise}
                        className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                          localParticipant.isHandRaised ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                        }`}
                      >
                        <Hand className="h-5 w-5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                      {localParticipant.isHandRaised ? "Baisser la main" : "Lever la main"}
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
                      <div className="flex items-center space-x-3 p-3 rounded-lg bg-blue-600/20 border border-blue-500/30">
                        <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                          <span className="text-white font-semibold text-sm">
                            {localParticipant.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-white font-medium text-sm">
                            {localParticipant.name} (Vous)
                          </p>
                          {localParticipant.isModerator && (
                            <p className="text-yellow-400 text-xs">Modérateur</p>
                          )}
                        </div>
                        <div className="flex space-x-1">
                          {!localParticipant.audioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
                          {!localParticipant.videoEnabled && <VideoOff className="h-4 w-4 text-red-400" />}
                          {localParticipant.isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
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
                            {participant.isModerator && (
                              <p className="text-yellow-400 text-xs">Modérateur</p>
                            )}
                          </div>
                          <div className="flex space-x-1">
                            {!participant.audioEnabled && <MicOff className="h-4 w-4 text-red-400" />}
                            {!participant.videoEnabled && <VideoOff className="h-4 w-4 text-red-400" />}
                            {participant.isHandRaised && <Hand className="h-4 w-4 text-yellow-400" />}
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
                  <ScrollArea className="flex-1 p-4">
                    <div className="space-y-4">
                      {chatMessages.map((msg) => (
                        <div key={msg.id} className="bg-gray-700/30 rounded-lg p-3">
                          <div className="flex items-baseline space-x-2 mb-1">
                            <span className="font-semibold text-white text-sm">{msg.participantName}</span>
                            <span className="text-gray-400 text-xs">
                              {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                            </span>
                          </div>
                          <p className="text-gray-200 break-words">{msg.text}</p>
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
                        className="bg-blue-600 hover:bg-blue-700 h-10 w-10 p-0"
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
              <p className="text-white text-xl mb-2">Connexion à Jitsi Meet...</p>
              <p className="text-gray-400">Initialisation de la vidéoconférence</p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default JitsiMeet;