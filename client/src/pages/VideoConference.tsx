import React, { useState, useEffect, useRef } from "react";
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
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2
} from "lucide-react";

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
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
  const [errorMsg, setErrorMsg] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [participantCount, setParticipantCount] = useState(1);
  const [isJitsiLoaded, setIsJitsiLoaded] = useState(false);
  
  // Contrôles - états synchronisés avec Jitsi
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  
  // Refs
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const jitsiApiRef = useRef<any>(null);
  
  const roomCode = params?.roomCode;

  // Charger Jitsi Meet API
  const loadJitsiScript = () => {
    return new Promise((resolve, reject) => {
      if (window.JitsiMeetExternalAPI) {
        resolve(true);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => resolve(true);
      script.onerror = () => reject(new Error('Impossible de charger Jitsi'));
      document.head.appendChild(script);
    });
  };

  // Initialiser Jitsi Meet
  const initJitsiMeet = async () => {
    if (!roomCode || !jitsiContainerRef.current) return;

    try {
      console.log('Initialisation Jitsi Meet pour room:', roomCode);
      
      const domain = 'meet.jit.si';
      const options = {
        roomName: `RonyApp_${roomCode}`,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        userInfo: {
          displayName: authUser?.displayName || authUser?.username || 'Utilisateur',
        },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          prejoinPageEnabled: false,
          disableInviteFunctions: true,
          toolbarButtons: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone',
            'mute-video-everyone', 'security'
          ],
          defaultLocalDisplayName: authUser?.displayName || authUser?.username || 'Utilisateur'
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          DEFAULT_BACKGROUND: '#1a1a1a',
          DISABLE_VIDEO_BACKGROUND: false,
          ENABLE_FEEDBACK_ANIMATION: false,
          FILM_STRIP_MAX_HEIGHT: 120,
          GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
          HIDE_INVITE_MORE_HEADER: true,
          JITSI_WATERMARK_LINK: '',
          LANG_DETECTION: true,
          LIVE_STREAMING_HELP_LINK: '',
          MOBILE_APP_PROMO: false,
          NATIVE_APP_NAME: 'RonyApp Meeting',
          PROVIDER_NAME: 'RonyApp',
          RECENT_LIST_ENABLED: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_CHROME_EXTENSION_BANNER: false,
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          TOOLBAR_ALWAYS_VISIBLE: false,
          TOOLBAR_TIMEOUT: 4000
        }
      };

      jitsiApiRef.current = new window.JitsiMeetExternalAPI(domain, options);

      // Événements Jitsi
      jitsiApiRef.current.addEventListeners({
        readyToClose: () => {
          console.log('Jitsi prêt à fermer');
          leaveRoom();
        },
        participantJoined: (participant: any) => {
          console.log('Participant rejoint:', participant);
          setParticipantCount(prev => prev + 1);
          toast({
            title: "Participant rejoint",
            description: `${participant.displayName || 'Quelqu\'un'} a rejoint la réunion`
          });
        },
        participantLeft: (participant: any) => {
          console.log('Participant parti:', participant);
          setParticipantCount(prev => Math.max(1, prev - 1));
        },
        audioMuteStatusChanged: (data: any) => {
          console.log('Audio mute changé:', data);
          setIsMuted(data.muted);
        },
        videoMuteStatusChanged: (data: any) => {
          console.log('Vidéo mute changé:', data);
          setIsVideoOn(!data.muted);
        },
        screenSharingStatusChanged: (data: any) => {
          console.log('Partage écran changé:', data);
          setIsScreenSharing(data.on);
        }
      });

      console.log('Jitsi Meet initialisé avec succès');
      setStatus('ready');
      setIsJitsiLoaded(true);
      
    } catch (error) {
      console.error('Erreur initialisation Jitsi:', error);
      setErrorMsg('Impossible d\'initialiser la vidéoconférence');
      setStatus('error');
    }
  };

  // Actions
  const toggleMute = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleAudio');
    }
  };

  const toggleVideo = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleVideo');
    }
  };

  const startScreenShare = () => {
    if (jitsiApiRef.current) {
      jitsiApiRef.current.executeCommand('toggleShareScreen');
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  const leaveRoom = () => {
    console.log('Quitter la réunion');
    
    if (jitsiApiRef.current) {
      jitsiApiRef.current.dispose();
      jitsiApiRef.current = null;
    }
    
    toast({ title: "Réunion quittée" });
    setLocation('/');
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen().catch(console.error);
    } else {
      document.exitFullscreen().catch(console.error);
    }
  };

  // Initialisation
  useEffect(() => {
    if (!roomCode) return;
    
    const init = async () => {
      try {
        await loadJitsiScript();
        console.log('Script Jitsi chargé');
        await initJitsiMeet();
      } catch (error) {
        console.error('Erreur chargement Jitsi:', error);
        setErrorMsg('Impossible de charger la vidéoconférence');
        setStatus('error');
      }
    };
    
    init();
    
    return () => {
      if (jitsiApiRef.current) {
        jitsiApiRef.current.dispose();
      }
    };
  }, [roomCode, authUser]);

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
          <h2 className="text-2xl font-bold mb-4">Code de réunion manquant</h2>
          <p className="text-gray-600 mb-6">Un code de réunion valide est requis</p>
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
          <h2 className="text-2xl font-bold mb-4">Connexion en cours...</h2>
          <p className="text-gray-600">Initialisation de la vidéoconférence</p>
          <div className="mt-4 space-y-2 text-sm text-gray-500">
            <p>• Chargement de l'interface</p>
            <p>• Préparation audio/vidéo</p>
            <p>• Connexion au serveur</p>
          </div>
        </Card>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Erreur de connexion</h2>
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
              Retour à l'accueil
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Interface principale vidéoconférence
  return (
    <div className={`h-screen bg-gray-900 text-white flex flex-col ${
      isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-lg overflow-hidden shadow-2xl' : ''
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Barre de contrôle supérieure */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h1 className="font-semibold">Réunion Teams-like</h1>
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
            {participantCount} participant{participantCount > 1 ? 's' : ''}
          </Badge>
          
          {isJitsiLoaded && (
            <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
              Connecté
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
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

      <div className="flex-1 relative">
        {/* Container Jitsi Meet */}
        <div 
          ref={jitsiContainerRef} 
          className="w-full h-full bg-black"
          style={{ minHeight: isMinimized ? '200px' : '400px' }}
        />
        
        {/* Overlay de contrôles personnalisés */}
        {!isMinimized && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-20">
            <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-6 py-3 flex items-center space-x-4 border border-gray-600">
              
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="rounded-full w-12 h-12 hover:scale-110 transition-transform"
                title={isMuted ? "Activer le micro" : "Couper le micro"}
              >
                {isMuted ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={!isVideoOn ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-12 h-12 hover:scale-110 transition-transform"
                title={isVideoOn ? "Désactiver la caméra" : "Activer la caméra"}
              >
                {isVideoOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={startScreenShare}
                className="rounded-full w-12 h-12 hover:scale-110 transition-transform"
                title="Partager l'écran"
              >
                <Share2 className="h-5 w-5" />
              </Button>
              
              <div className="h-6 w-px bg-gray-600"></div>
              
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-12 h-12 hover:scale-110 transition-transform"
                title="Quitter la réunion"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
              
            </div>
          </div>
        )}
      </div>
      
      {/* Indicateur mode minimisé */}
      {isMinimized && (
        <div className="absolute top-2 left-2 z-20">
          <Badge variant="secondary" className="bg-blue-600 text-xs">
            Réunion en cours
          </Badge>
        </div>
      )}
    </div>
  );
};

export default VideoConference;