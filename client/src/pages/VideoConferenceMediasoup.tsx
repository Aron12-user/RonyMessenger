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
  MessageSquare, Users, Hand, Copy, X, Send, Camera, AlertCircle, 
  PictureInPicture, Grid3X3
} from 'lucide-react';
import { Device } from 'mediasoup-client';
import { Transport, Producer, Consumer } from 'mediasoup-client/lib/types';

interface User {
  id: number;
  username: string;
  displayName?: string;
}

interface MediasoupPeer {
  id: string;
  name: string;
  producers: Map<string, string>; // kind -> producerId
  videoElement?: HTMLVideoElement;
  audioElement?: HTMLAudioElement;
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

const VideoConferenceMediasoup = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // Références
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<Transport | null>(null);
  const recvTransportRef = useRef<Transport | null>(null);
  const producersRef = useRef<Map<string, Producer>>(new Map());
  const consumersRef = useRef<Map<string, Consumer>>(new Map());

  // États
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [peers, setPeers] = useState<Map<string, MediasoupPeer>>(new Map());
  const [isAudioEnabled, setIsAudioEnabled] = useState(false);
  const [isVideoEnabled, setIsVideoEnabled] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [layoutMode, setLayoutMode] = useState<'grid' | 'speaker'>('grid');
  const [showControlBar, setShowControlBar] = useState(true);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const roomCode = params?.roomCode;

  // Initialisation Mediasoup
  const initializeMediasoup = useCallback(async () => {
    try {
      console.log('🚀 Initialisation Mediasoup Device...');
      
      // Créer le device Mediasoup
      const device = new Device();
      deviceRef.current = device;

      // Obtenir les capacités du router
      const response = await fetch(`/api/mediasoup/room/${roomCode}/router-capabilities`);
      const { rtpCapabilities } = await response.json();

      // Charger le device avec les capacités du router
      await device.load({ routerRtpCapabilities: rtpCapabilities });
      
      console.log('✅ Device Mediasoup initialisé');
      
      // Créer les transports
      await createTransports();
      
    } catch (error) {
      console.error('❌ Erreur initialisation Mediasoup:', error);
      toast({
        title: "Erreur de connexion",
        description: "Impossible d'initialiser la vidéoconférence",
        variant: "destructive"
      });
    }
  }, [roomCode]);

  // Créer les transports WebRTC
  const createTransports = async () => {
    if (!deviceRef.current || !authUser) return;

    try {
      // Transport d'envoi
      const sendResponse = await fetch(`/api/mediasoup/room/${roomCode}/create-transport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: authUser.id.toString() })
      });
      const sendTransportData = await sendResponse.json();

      const sendTransport = deviceRef.current.createSendTransport(sendTransportData);
      sendTransportRef.current = sendTransport;

      sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await fetch(`/api/mediasoup/room/${roomCode}/connect-transport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              peerId: authUser.id.toString(),
              dtlsParameters
            })
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
        try {
          const response = await fetch(`/api/mediasoup/room/${roomCode}/produce`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              peerId: authUser.id.toString(),
              kind,
              rtpParameters
            })
          });
          const { id } = await response.json();
          callback({ id });
        } catch (error) {
          errback(error);
        }
      });

      // Transport de réception
      const recvResponse = await fetch(`/api/mediasoup/room/${roomCode}/create-transport`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ peerId: `${authUser.id}-recv` })
      });
      const recvTransportData = await recvResponse.json();

      const recvTransport = deviceRef.current.createRecvTransport(recvTransportData);
      recvTransportRef.current = recvTransport;

      recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
        try {
          await fetch(`/api/mediasoup/room/${roomCode}/connect-transport`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              peerId: `${authUser.id}-recv`,
              dtlsParameters
            })
          });
          callback();
        } catch (error) {
          errback(error);
        }
      });

      console.log('✅ Transports créés');
      setConnectionStatus('connected');

    } catch (error) {
      console.error('❌ Erreur création transports:', error);
      setConnectionStatus('disconnected');
    }
  };

  // Initialiser WebSocket
  const initializeWebSocket = useCallback(() => {
    if (!roomCode || !authUser) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/mediasoup`;
    
    console.log('🔌 Connexion WebSocket Mediasoup:', wsUrl);
    
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('✅ WebSocket Mediasoup connecté');
      
      // Rejoindre la room
      wsRef.current?.send(JSON.stringify({
        type: 'join-room',
        roomCode,
        peerId: authUser.id.toString(),
        name: authUser.displayName || authUser.username
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        handleWebSocketMessage(data);
      } catch (error) {
        console.error('❌ Erreur message WebSocket:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('❌ WebSocket fermé');
      setConnectionStatus('disconnected');
    };

  }, [roomCode, authUser]);

  // Gestion des messages WebSocket
  const handleWebSocketMessage = async (data: any) => {
    switch (data.type) {
      case 'room-joined':
        console.log('🏠 Room rejointe:', data);
        // Gérer les peers existants
        for (const peerData of data.existingPeers) {
          setPeers(prev => {
            const newPeers = new Map(prev);
            newPeers.set(peerData.id, {
              id: peerData.id,
              name: peerData.name,
              producers: new Map()
            });
            return newPeers;
          });
        }
        
        // Charger l'historique du chat
        setChatMessages(data.chatHistory.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        break;

      case 'peer-joined':
        console.log('👤 Nouveau peer:', data.peer);
        setPeers(prev => {
          const newPeers = new Map(prev);
          newPeers.set(data.peer.id, {
            id: data.peer.id,
            name: data.peer.name,
            producers: new Map()
          });
          return newPeers;
        });
        toast({ title: `${data.peer.name} a rejoint la réunion` });
        break;

      case 'peer-left':
        console.log('👋 Peer parti:', data.peerId);
        setPeers(prev => {
          const newPeers = new Map(prev);
          newPeers.delete(data.peerId);
          return newPeers;
        });
        break;

      case 'new-producer':
        console.log('🎬 Nouveau producer:', data);
        await consumeProducer(data.producerId, data.peerId);
        break;

      case 'chat-message':
        console.log('💬 Message chat reçu:', data.message);
        setChatMessages(prev => [...prev, {
          ...data.message,
          timestamp: new Date(data.message.timestamp)
        }]);
        
        setTimeout(() => {
          if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
          }
        }, 100);
        break;
    }
  };

  // Consommer un producer distant
  const consumeProducer = async (producerId: string, peerId: string) => {
    if (!deviceRef.current || !recvTransportRef.current || !authUser) return;

    try {
      const response = await fetch(`/api/mediasoup/room/${roomCode}/consume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          peerId: authUser.id.toString(),
          producerId,
          rtpCapabilities: deviceRef.current.rtpCapabilities
        })
      });

      const consumerData = await response.json();
      
      const consumer = await recvTransportRef.current.consume({
        id: consumerData.id,
        producerId: consumerData.producerId,
        kind: consumerData.kind,
        rtpParameters: consumerData.rtpParameters
      });

      consumersRef.current.set(consumer.id, consumer);

      // Attacher le stream à l'élément vidéo approprié
      const { track } = consumer;
      const stream = new MediaStream([track]);

      // Trouver l'élément vidéo du peer
      const peerVideoElement = document.querySelector(`[data-peer-id="${peerId}"]`) as HTMLVideoElement;
      if (peerVideoElement) {
        peerVideoElement.srcObject = stream;
      }

      console.log(`✅ Consumer créé pour ${consumerData.kind} de ${peerId}`);

    } catch (error) {
      console.error('❌ Erreur création consumer:', error);
    }
  };

  // Contrôles média
  const toggleVideo = async () => {
    if (!sendTransportRef.current) return;

    try {
      if (!isVideoEnabled) {
        // Activer la vidéo
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 }
          }
        });

        const videoTrack = stream.getVideoTracks()[0];
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        const producer = await sendTransportRef.current.produce({
          track: videoTrack,
          encodings: [
            { maxBitrate: 100000 },
            { maxBitrate: 300000 },
            { maxBitrate: 900000 }
          ],
          codecOptions: {
            videoGoogleStartBitrate: 1000
          }
        });

        producersRef.current.set('video', producer);
        setIsVideoEnabled(true);
        
        toast({ title: "Caméra activée" });

      } else {
        // Désactiver la vidéo
        const producer = producersRef.current.get('video');
        if (producer) {
          producer.close();
          producersRef.current.delete('video');
        }

        if (localVideoRef.current) {
          const stream = localVideoRef.current.srcObject as MediaStream;
          if (stream) {
            stream.getTracks().forEach(track => track.stop());
          }
          localVideoRef.current.srcObject = null;
        }

        setIsVideoEnabled(false);
        toast({ title: "Caméra désactivée" });
      }
    } catch (error) {
      console.error('❌ Erreur toggle vidéo:', error);
      toast({
        title: "Erreur caméra",
        description: "Impossible d'accéder à la caméra",
        variant: "destructive"
      });
    }
  };

  const toggleAudio = async () => {
    if (!sendTransportRef.current) return;

    try {
      if (!isAudioEnabled) {
        // Activer l'audio
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          }
        });

        const audioTrack = stream.getAudioTracks()[0];

        const producer = await sendTransportRef.current.produce({
          track: audioTrack
        });

        producersRef.current.set('audio', producer);
        setIsAudioEnabled(true);
        
        toast({ title: "Microphone activé" });

      } else {
        // Désactiver l'audio
        const producer = producersRef.current.get('audio');
        if (producer) {
          producer.close();
          producersRef.current.delete('audio');
        }

        setIsAudioEnabled(false);
        toast({ title: "Microphone désactivé" });
      }
    } catch (error) {
      console.error('❌ Erreur toggle audio:', error);
      toast({
        title: "Erreur microphone",
        description: "Impossible d'accéder au microphone",
        variant: "destructive"
      });
    }
  };

  // Chat
  const sendChatMessage = () => {
    if (!newMessage.trim() || !wsRef.current || !authUser) return;

    const messageId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const message = {
      id: messageId,
      sender: authUser.displayName || authUser.username,
      message: newMessage.trim(),
      timestamp: new Date().toISOString()
    };

    wsRef.current.send(JSON.stringify({
      type: 'chat-message',
      roomCode,
      message
    }));

    setNewMessage('');
  };

  // Utilitaires
  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code copié" });
  };

  const leaveRoom = () => {
    // Fermer tous les producers
    for (const producer of producersRef.current.values()) {
      producer.close();
    }

    // Fermer tous les consumers
    for (const consumer of consumersRef.current.values()) {
      consumer.close();
    }

    // Fermer les transports
    sendTransportRef.current?.close();
    recvTransportRef.current?.close();

    // Fermer WebSocket
    wsRef.current?.close();

    setLocation('/');
    toast({ title: "Réunion quittée" });
  };

  // Gestion automatique des contrôles
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

  // Initialisation
  useEffect(() => {
    if (roomCode && authUser) {
      initializeWebSocket();
      initializeMediasoup();
    }

    return () => {
      // Nettoyage
      for (const producer of producersRef.current.values()) {
        producer.close();
      }
      for (const consumer of consumersRef.current.values()) {
        consumer.close();
      }
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      wsRef.current?.close();
    };
  }, [roomCode, authUser, initializeWebSocket, initializeMediasoup]);

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
        
        {/* Barre de navigation */}
        <div className={`absolute top-0 left-0 right-0 z-30 transition-all duration-500 ${
          showControlBar ? 'opacity-100 bg-black/10 backdrop-blur-sm' : 'opacity-0 pointer-events-none'
        }`}>
          <div className="px-4 py-2 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected' ? 'bg-green-400' : 
                  connectionStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                }`}></div>
                <h1 className="font-medium text-sm text-white/90">RonyMeet Mediasoup</h1>
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                onClick={copyRoomCode}
                className="text-xs border border-white/20 hover:bg-white/10 h-7 px-3 text-white/70"
              >
                <Copy className="h-3 w-3 mr-1" />
                {roomCode}
              </Button>
              
              <div className="bg-white/10 px-2 py-1 rounded text-xs text-white/70">
                <Users className="h-3 w-3 mr-1 inline" />
                {peers.size + 1}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => setLayoutMode(layoutMode === 'grid' ? 'speaker' : 'grid')}
                className="hover:bg-white/10 h-7 w-7 p-0 text-white/70"
              >
                {layoutMode === 'grid' ? <PictureInPicture className="h-3 w-3" /> : <Grid3X3 className="h-3 w-3" />}
              </Button>
              
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={leaveRoom}
                className="hover:bg-red-500/20 h-7 w-7 p-0 text-red-400"
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>

        {/* Zone vidéo principale */}
        <div className="absolute inset-0 bg-black">
          <div className={`h-full ${layoutMode === 'grid' ? 'grid grid-cols-1 lg:grid-cols-2 gap-2' : 'flex flex-col'}`} 
               style={{padding: peers.size === 0 ? '20px' : '4px'}}>
            
            {/* Vidéo locale */}
            <div className="relative group">
              <div className="main-video-container relative bg-gray-900 overflow-hidden h-full rounded-lg">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute bottom-2 left-2">
                  <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-sm">
                    <span className="text-white font-medium">
                      Vous ({authUser?.displayName || authUser?.username})
                    </span>
                  </div>
                </div>
                
                <div className="absolute top-2 right-2 flex space-x-1">
                  {!isAudioEnabled && (
                    <div className="bg-red-500/80 p-1 rounded">
                      <MicOff className="h-3 w-3 text-white" />
                    </div>
                  )}
                  {isHandRaised && (
                    <div className="bg-yellow-500/80 p-1 rounded">
                      <Hand className="h-3 w-3 text-white" />
                    </div>
                  )}
                </div>
                
                {!isVideoEnabled && (
                  <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-2">
                      <Camera className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400">Caméra désactivée</p>
                  </div>
                )}
              </div>
            </div>

            {/* Vidéos des participants */}
            {Array.from(peers.values()).map((peer) => (
              <div key={peer.id} className="relative group">
                <div className="participant-video-container relative bg-gray-900 overflow-hidden h-full rounded-lg">
                  <video
                    data-peer-id={peer.id}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  
                  <div className="absolute bottom-2 left-2">
                    <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-sm">
                      <span className="text-white font-medium">{peer.name}</span>
                    </div>
                  </div>
                  
                  <div className="absolute inset-0 bg-gray-800 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center mb-2">
                      <Users className="h-8 w-8 text-gray-400" />
                    </div>
                    <p className="text-gray-400">{peer.name}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Barre de contrôles */}
          <div className={`absolute bottom-0 left-0 right-0 z-40 transition-all duration-500 ${
            showControlBar ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0 pointer-events-none'
          }`}>
            <div className="bg-gradient-to-t from-black/60 via-black/30 to-transparent pt-20 pb-6">
              <div className="flex justify-center">
                <div className="bg-black/40 backdrop-blur-lg rounded-full px-6 py-3 border border-white/20 shadow-2xl">
                  <div className="flex items-center space-x-3">
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant={isAudioEnabled ? "ghost" : "destructive"}
                          size="lg"
                          onClick={toggleAudio}
                          className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                            isAudioEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
                          size="lg"
                          onClick={toggleVideo}
                          className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                            isVideoEnabled ? 'bg-white/10 hover:bg-white/20 text-white' : 'bg-red-500 hover:bg-red-600'
                          }`}
                        >
                          {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isVideoEnabled ? "Désactiver la caméra" : "Activer la caméra"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-8 bg-white/30 mx-2"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => setIsHandRaised(!isHandRaised)}
                          className={`rounded-full w-10 h-10 p-0 transition-all duration-200 hover:scale-105 ${
                            isHandRaised ? 'bg-yellow-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <Hand className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        {isHandRaised ? "Baisser la main" : "Lever la main"}
                      </TooltipContent>
                    </Tooltip>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="lg"
                          onClick={() => setShowChat(!showChat)}
                          className={`rounded-full w-10 h-10 p-0 transition-all duration-200 hover:scale-105 ${
                            showChat ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <MessageSquare className="h-4 w-4" />
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
                          size="lg"
                          onClick={() => setShowParticipants(!showParticipants)}
                          className={`rounded-full w-10 h-10 p-0 transition-all duration-200 hover:scale-105 ${
                            showParticipants ? 'bg-blue-500 text-white' : 'bg-white/10 hover:bg-white/20 text-white'
                          }`}
                        >
                          <Users className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="bg-black/80 text-white border-white/20">
                        Participants
                      </TooltipContent>
                    </Tooltip>
                    
                    <div className="w-px h-8 bg-white/30 mx-2"></div>
                    
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="destructive"
                          size="lg"
                          onClick={leaveRoom}
                          className="rounded-full w-12 h-12 p-0 bg-red-500 hover:bg-red-600 transition-all duration-200 hover:scale-105"
                        >
                          <Phone className="h-5 w-5" />
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
          <div className="absolute top-0 right-0 w-80 h-full bg-black/30 backdrop-blur-lg border-l border-white/20 z-20">
            <div className="p-4 border-b border-white/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">Chat</h3>
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
            
            <div className="flex flex-col h-[calc(100%-80px)]">
              <ScrollArea className="flex-1" ref={chatContainerRef}>
                <div className="p-4 space-y-4">
                  {chatMessages.map((msg) => (
                    <div key={msg.id} className="text-sm">
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
              
              <div className="p-4 border-t border-white/20">
                <div className="flex space-x-2">
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

        {/* Indicateur de statut de connexion */}
        {connectionStatus !== 'connected' && (
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-black/90 p-8 rounded-lg text-center border border-white/20">
              <div className="animate-spin w-12 h-12 border-2 border-white/20 border-t-white rounded-full mx-auto mb-4"></div>
              <p className="text-white text-lg mb-2">
                {connectionStatus === 'connecting' ? 'Connexion en cours...' : 'Reconnexion...'}
              </p>
              <p className="text-white/70 text-sm">
                Initialisation de la vidéoconférence Mediasoup
              </p>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default VideoConferenceMediasoup;