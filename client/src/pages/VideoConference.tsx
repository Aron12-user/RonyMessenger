import React, { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2,
  Maximize2, Minimize2, X, Crown, Settings, MessageSquare,
  Monitor, AlertCircle, Loader2, Copy
} from "lucide-react";

interface Participant {
  id: string;
  name: string;
  isAdmin: boolean;
  isMuted: boolean;
  hasVideo: boolean;
}

const VideoConference: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // États
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Contrôles
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hasAudioDevice, setHasAudioDevice] = useState(true);
  
  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  
  const roomCode = params?.roomCode;

  // Initialisation des médias
  const initMedia = async () => {
    try {
      console.log('Tentative accès caméra + micro...');
      
      // Essayer d'abord caméra + micro
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1280, height: 720 },
          audio: true
        });
        
        console.log('Accès accordé (vidéo + audio):', stream.getTracks().map(t => t.kind));
        setLocalStream(stream);
        
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
        return true;
      } catch (audioError) {
        console.log('Échec audio, essai caméra seule...');
        
        // Si échec avec audio, essayer seulement la caméra
        try {
          const videoStream = await navigator.mediaDevices.getUserMedia({
            video: { width: 1280, height: 720 },
            audio: false
          });
          
          console.log('Accès accordé (vidéo seulement):', videoStream.getTracks().map(t => t.kind));
          setLocalStream(videoStream);
          setIsMuted(true); // Forcer mute puisque pas d'audio
          setHasAudioDevice(false); // Marquer qu'il n'y a pas d'audio
          
          if (localVideoRef.current) {
            localVideoRef.current.srcObject = videoStream;
          }
          
          toast({
            title: "Caméra activée",
            description: "Micro non disponible - vous êtes en mode muet",
            variant: "default"
          });
          
          return true;
        } catch (videoError) {
          throw videoError; // Relancer l'erreur vidéo
        }
      }
    } catch (err: any) {
      console.error('Erreur média complète:', err);
      let msg = 'Impossible d\'accéder à la caméra';
      
      if (err.name === 'NotAllowedError') {
        msg = 'Accès refusé. Veuillez autoriser l\'accès à la caméra.';
      } else if (err.name === 'NotFoundError') {
        msg = 'Aucune caméra détectée sur cet appareil.';
      } else if (err.name === 'NotReadableError') {
        msg = 'Caméra utilisée par une autre application.';
      } else if (err.name === 'OverconstrainedError') {
        msg = 'Résolution caméra non supportée.';
      }
      
      setErrorMsg(msg);
      return false;
    }
  };

  // Connexion WebSocket
  const connectWS = () => {
    if (!roomCode) return;
    
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws/meeting/${roomCode}`;
    
    console.log('Connexion WS:', wsUrl);
    wsRef.current = new WebSocket(wsUrl);
    
    wsRef.current.onopen = () => {
      console.log('WS connecté');
      setStatus('ready');
      
      wsRef.current?.send(JSON.stringify({
        type: 'user-info',
        info: {
          name: authUser?.displayName || authUser?.username || 'Utilisateur'
        }
      }));
    };
    
    wsRef.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('Message WS:', data.type);
        
        if (data.type === 'user-joined') {
          setParticipants(prev => [...prev, {
            id: data.userId,
            name: data.userInfo?.name || 'Utilisateur',
            isAdmin: data.userInfo?.isAdmin || false,
            isMuted: false,
            hasVideo: true
          }]);
          
          toast({
            title: "Participant rejoint",
            description: `${data.userInfo?.name || 'Quelqu\'un'} a rejoint`
          });
        } else if (data.type === 'user-left') {
          setParticipants(prev => prev.filter(p => p.id !== data.userId));
        } else if (data.type === 'participant-update') {
          setParticipants(prev => prev.map(p => 
            p.id === data.userId ? { ...p, ...data.updates } : p
          ));
        }
      } catch (err) {
        console.error('Erreur message WS:', err);
      }
    };
    
    wsRef.current.onclose = () => {
      console.log('WS fermé');
      setStatus('error');
      setErrorMsg('Connexion fermée');
    };
    
    wsRef.current.onerror = () => {
      console.log('Erreur WS');
      setStatus('error');
      setErrorMsg('Erreur connexion');
    };
  };

  // Actions
  const toggleMute = () => {
    if (!localStream || !hasAudioDevice) {
      toast({
        title: "Micro non disponible",
        description: "Aucun microphone détecté",
        variant: "destructive"
      });
      return;
    }
    
    localStream.getAudioTracks().forEach(track => {
      track.enabled = isMuted;
    });
    setIsMuted(!isMuted);
    
    wsRef.current?.send(JSON.stringify({
      type: 'participant-update',
      updates: { isMuted: !isMuted }
    }));
    
    toast({
      title: isMuted ? "Micro activé" : "Micro coupé"
    });
  };

  const toggleVideo = () => {
    if (!localStream) return;
    
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !isVideoOn;
    });
    setIsVideoOn(!isVideoOn);
    
    wsRef.current?.send(JSON.stringify({
      type: 'participant-update',
      updates: { hasVideo: !isVideoOn }
    }));
    
    toast({
      title: isVideoOn ? "Caméra désactivée" : "Caméra activée"
    });
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });
      
      setIsScreenSharing(true);
      
      screenStream.getVideoTracks()[0].onended = () => {
        setIsScreenSharing(false);
        toast({ title: "Partage écran arrêté" });
      };
      
      toast({ title: "Partage écran démarré" });
    } catch (err) {
      toast({
        title: "Erreur partage écran",
        variant: "destructive"
      });
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code copié" });
  };

  const retryAudio = async () => {
    if (hasAudioDevice || !localStream) return;
    
    try {
      console.log('Tentative ajout audio...');
      const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Ajouter les pistes audio au flux existant
      audioStream.getAudioTracks().forEach(track => {
        localStream.addTrack(track);
      });
      
      setHasAudioDevice(true);
      setIsMuted(false);
      
      toast({
        title: "Microphone activé",
        description: "Audio ajouté avec succès"
      });
    } catch (err) {
      toast({
        title: "Microphone non disponible",
        description: "Impossible d'ajouter l'audio",
        variant: "destructive"
      });
    }
  };

  const leaveRoom = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
    }
    
    if (wsRef.current) {
      wsRef.current.close();
    }
    
    toast({ title: "Réunion quittée" });
    setLocation('/');
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  // Initialisation
  useEffect(() => {
    if (!roomCode) return;
    
    const init = async () => {
      const mediaOk = await initMedia();
      if (mediaOk) {
        connectWS();
      } else {
        setStatus('error');
      }
    };
    
    init();
    
    return () => {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [roomCode]);

  // Gestion plein écran
  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  // Écrans d'état
  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Code manquant</h2>
          <p className="text-gray-600 mb-6">Un code de réunion est requis</p>
          <Button onClick={() => setLocation('/')} className="w-full">
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Initialisation...</h2>
          <p className="text-gray-600">Accès caméra et connexion en cours</p>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Erreur</h2>
          <p className="text-gray-600 mb-6">{errorMsg}</p>
          <div className="space-y-3">
            <Button 
              onClick={() => {
                setStatus('loading');
                setErrorMsg('');
                window.location.reload();
              }}
              className="w-full"
            >
              Réessayer
            </Button>
            <Button 
              onClick={() => setLocation('/')}
              variant="outline"
              className="w-full"
            >
              Retour
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Interface principale
  return (
    <div className={`h-screen bg-gray-900 text-white flex flex-col ${isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-lg overflow-hidden shadow-2xl' : ''}`}>
      
      {/* Barre de titre */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h1 className="font-semibold">Réunion</h1>
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
            {participants.length + 1} participant{participants.length > 0 ? 's' : ''}
          </Badge>
          
          {!hasAudioDevice && (
            <Badge variant="outline" className="bg-yellow-600/20 border-yellow-600 text-yellow-200">
              Caméra seulement
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          {!hasAudioDevice && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={retryAudio}
              className="text-xs border-yellow-600 hover:bg-yellow-600/20 text-yellow-200"
            >
              Réessayer micro
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={leaveRoom} className="text-red-400">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Zone vidéo principale */}
        <div className="flex-1 flex flex-col">
          
          {/* Zone de projection */}
          <div className="flex-1 bg-black p-4">
            <div className="h-full grid gap-4" style={{
              gridTemplateColumns: participants.length === 0 ? '1fr' : 
                                 participants.length === 1 ? 'repeat(2, 1fr)' :
                                 participants.length <= 3 ? 'repeat(2, 1fr)' :
                                 'repeat(3, 1fr)'
            }}>
              
              {/* Ma vidéo */}
              <div className="relative bg-gray-800 rounded-lg overflow-hidden border-2 border-blue-500">
                <video
                  ref={localVideoRef}
                  autoPlay
                  muted
                  playsInline
                  className="w-full h-full object-cover"
                />
                
                <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-sm">
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">Vous</span>
                    {isMuted ? <MicOff className="h-3 w-3 text-red-400" /> : <Mic className="h-3 w-3 text-green-400" />}
                  </div>
                </div>
                
                {!isVideoOn && (
                  <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                    <Avatar className="w-20 h-20">
                      <AvatarFallback className="text-2xl bg-blue-600">
                        {authUser?.displayName?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                )}
              </div>

              {/* Vidéos participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="relative bg-gray-800 rounded-lg overflow-hidden border border-gray-600">
                  <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                    <Avatar className="w-20 h-20">
                      <AvatarFallback className="text-2xl bg-green-600">
                        {participant.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  <div className="absolute bottom-2 left-2 bg-black/70 px-2 py-1 rounded text-sm">
                    <div className="flex items-center space-x-1">
                      {participant.isAdmin && <Crown className="h-3 w-3 text-yellow-400" />}
                      <span className="font-medium">{participant.name}</span>
                      {participant.isMuted ? <MicOff className="h-3 w-3 text-red-400" /> : <Mic className="h-3 w-3 text-green-400" />}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Contrôles */}
          <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-center space-x-4">
              
              <Button
                variant={isMuted || !hasAudioDevice ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className={`rounded-full w-14 h-14 ${!hasAudioDevice ? 'opacity-50 cursor-not-allowed' : ''}`}
                disabled={!hasAudioDevice}
              >
                {isMuted || !hasAudioDevice ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={!isVideoOn ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-14 h-14"
              >
                {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={startScreenShare}
                className="rounded-full w-14 h-14"
              >
                <Share2 className="h-6 w-6" />
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowSidebar(!showSidebar)}
                className="rounded-full w-14 h-14"
              >
                <Users className="h-6 w-6" />
              </Button>
              
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-14 h-14"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              
            </div>
          </div>
        </div>

        {/* Panneau participants */}
        {showSidebar && !isMinimized && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            
            <div className="p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="font-semibold text-lg">Participants</h3>
              <p className="text-sm text-gray-400">{participants.length + 1} connecté{participants.length > 0 ? 's' : ''}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              
              {/* Moi */}
              <div className="flex items-center space-x-3 p-3 bg-blue-600/20 rounded-lg">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-blue-600">
                    {authUser?.displayName?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex-1">
                  <p className="font-medium">Vous</p>
                  <p className="text-xs text-gray-400">Organisateur</p>
                </div>
                
                <div className="flex items-center space-x-1">
                  <Crown className="w-4 h-4 text-yellow-400" />
                  {isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                </div>
              </div>

              {/* Autres participants */}
              {participants.map((participant) => (
                <div key={participant.id} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-700 transition-colors">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-green-600">
                      {participant.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1">
                    <p className="font-medium">{participant.name}</p>
                    <p className="text-xs text-gray-400">
                      {participant.isAdmin ? 'Admin' : 'Participant'}
                    </p>
                  </div>
                  
                  <div className="flex items-center space-x-1">
                    {participant.isAdmin && <Crown className="w-4 h-4 text-yellow-400" />}
                    {participant.isMuted ? <MicOff className="w-4 h-4 text-red-400" /> : <Mic className="w-4 h-4 text-green-400" />}
                  </div>
                </div>
              ))}
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConference;