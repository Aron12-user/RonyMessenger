import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Camera, Mic, CheckCircle, XCircle, Maximize2, Minimize2 } from 'lucide-react';

// Déclaration globale pour Jitsi
declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

interface User {
  id: number;
  username: string;
  displayName?: string;
}

const JitsiEmbedded = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();
  const [isInitializing, setIsInitializing] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [mediaStatus, setMediaStatus] = useState({
    camera: 'checking',
    microphone: 'checking',
    ready: false
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [jitsiApi, setJitsiApi] = useState<any>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  // Force l'accès aux médias avec stratégies multiples
  const forceMediaAccess = async () => {
    try {
      console.log('Forcing media access with aggressive approach...');
      
      // Permissions d'abord
      try {
        const permissions = await navigator.permissions.query({ name: 'camera' as PermissionName });
        console.log('Camera permission:', permissions.state);
      } catch (e) {
        console.log('Permission API not supported');
      }

      // Stratégies multiples pour forcer l'accès
      const strategies = [
        // Stratégie 1: Accès complet avec contraintes élevées
        {
          video: {
            width: { min: 640, ideal: 1280, max: 1920 },
            height: { min: 480, ideal: 720, max: 1080 },
            frameRate: { min: 15, ideal: 30, max: 60 },
            facingMode: 'user'
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: { ideal: 48000 }
          }
        },
        // Stratégie 2: Contraintes moyennes
        {
          video: { width: 1280, height: 720, frameRate: 30 },
          audio: true
        },
        // Stratégie 3: Contraintes minimales
        {
          video: true,
          audio: true
        },
        // Stratégie 4: Vidéo seulement
        {
          video: true,
          audio: false
        },
        // Stratégie 5: Audio seulement
        {
          video: false,
          audio: true
        }
      ];

      let mediaStream: MediaStream | null = null;
      let lastError: any = null;

      for (let i = 0; i < strategies.length; i++) {
        try {
          console.log(`Trying strategy ${i + 1}...`);
          mediaStream = await navigator.mediaDevices.getUserMedia(strategies[i]);
          console.log(`Strategy ${i + 1} successful!`);
          break;
        } catch (error) {
          console.log(`Strategy ${i + 1} failed:`, error);
          lastError = error;
          continue;
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        
        const videoTracks = mediaStream.getVideoTracks();
        const audioTracks = mediaStream.getAudioTracks();
        
        // Forcer l'activation des tracks
        videoTracks.forEach(track => {
          track.enabled = true;
          console.log('Video track enabled:', track.label);
        });
        
        audioTracks.forEach(track => {
          track.enabled = true;
          console.log('Audio track enabled:', track.label);
        });

        setMediaStatus({
          camera: videoTracks.length > 0 ? 'granted' : 'denied',
          microphone: audioTracks.length > 0 ? 'granted' : 'denied',
          ready: true
        });

        // Afficher la prévisualisation
        if (videoRef.current && videoTracks.length > 0) {
          videoRef.current.srcObject = mediaStream;
          try {
            await videoRef.current.play();
          } catch (playError) {
            console.log('Video play error:', playError);
          }
        }

        toast({
          title: "Accès aux périphériques forcé",
          description: `Caméra: ${videoTracks.length > 0 ? 'Activée' : 'Désactivée'}, Micro: ${audioTracks.length > 0 ? 'Activé' : 'Désactivé'}`,
        });

        return true;
      } else {
        throw lastError || new Error('Toutes les stratégies ont échoué');
      }
      
    } catch (error) {
      console.error('All media access strategies failed:', error);
      setMediaStatus({
        camera: 'denied',
        microphone: 'denied',
        ready: true
      });
      
      toast({
        title: "Accès aux périphériques limité",
        description: "Continuez vers Jitsi, il tentera d'accéder aux périphériques",
        variant: "destructive"
      });
      
      return false;
    }
  };

  // Initialiser Jitsi Meet embarqué
  const initializeJitsi = async () => {
    if (!roomCode || !authUser || !jitsiContainerRef.current) return;

    try {
      console.log('Initializing embedded Jitsi Meet...');

      // Nettoyer le container
      jitsiContainerRef.current.innerHTML = '';

      // Charger l'API Jitsi si nécessaire
      if (!window.JitsiMeetExternalAPI) {
        console.log('Loading Jitsi External API...');
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('Jitsi External API loaded successfully');
            resolve(true);
          };
          script.onerror = () => {
            console.error('Failed to load Jitsi External API');
            reject(new Error('Failed to load Jitsi External API'));
          };
          
          // Timeout de 10 secondes
          setTimeout(() => {
            reject(new Error('Timeout loading Jitsi API'));
          }, 10000);
        });
      }

      const displayName = authUser.displayName || authUser.username || 'Participant';
      
      // Configuration Jitsi pour intégration complète
      const options = {
        roomName: roomCode,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        // Configuration pour forcer l'embedding
        configOverwrite: {
          // Désactiver toutes les redirections
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          enableClosePage: false,
          prejoinPageEnabled: false,
          enableLobbyChat: false,
          
          // Qualité vidéo
          resolution: 1080,
          maxFullResolutionParticipants: 4,
          channelLastN: 20,
          
          // Fonctionnalités audio/vidéo
          enableLipSync: true,
          enableNoiseCancellation: true,
          enableSpeakerStats: true,
          enableP2P: true,
          
          // Empêcher les redirections
          requireDisplayName: false,
          disableDeepLinking: true,
          disableInviteFunctions: false,
          
          // Forcer l'utilisation dans iframe
          enableNoAudioDetection: false,
          enableNoisyMicDetection: false,
          
          // Toolbar complète
          toolbarButtons: [
            'camera', 'microphone', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats', 'shortcuts',
            'tileview', 'videobackgroundblur', 'download', 'help', 'mute-everyone'
          ]
        },
        
        // Configuration interface pour embedding complet
        interfaceConfigOverwrite: {
          // Branding
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          PROVIDER_NAME: 'RonyMeet',
          
          // Interface
          TOOLBAR_ALWAYS_VISIBLE: false,
          TOOLBAR_TIMEOUT: 4000,
          CHAT_ENABLED: true,
          MOBILE_APP_PROMO: false,
          VERTICAL_FILMSTRIP: true,
          DEFAULT_BACKGROUND: '#474747',
          
          // Empêcher les popups et redirections
          DISABLE_VIDEO_BACKGROUND: false,
          ENABLE_FEEDBACK_ANIMATION: true,
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
          
          // Forcer l'embedding
          JITSI_WATERMARK_LINK: '',
          SHOW_CHROME_EXTENSION_BANNER: false,
          
          // Désactiver les liens externes
          HIDE_INVITE_MORE_HEADER: false,
          
          // Configuration complète pour éviter les redirections
          SETTINGS_SECTIONS: ['devices', 'language', 'moderator', 'profile', 'calendar'],
          
          // Empêcher l'ouverture de nouveaux onglets
          ENFORCE_NOTIFICATION_AUTO_DISMISS_TIMEOUT: 15000
        },
        
        // Info utilisateur
        userInfo: {
          displayName: displayName,
          email: authUser.username
        },
        
        // Contraintes pour embedding
        onload: () => {
          console.log('Jitsi iframe loaded');
        }
      };

      console.log('Creating Jitsi API instance...');
      
      // Créer l'instance Jitsi avec gestion d'erreur
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', options);
      setJitsiApi(api);

      // Event listeners détaillés
      api.addEventListener('ready', () => {
        console.log('Jitsi Meet is ready!');
        setIsInitializing(false);
        
        // Nettoyer le stream de prévisualisation
        if (stream) {
          console.log('Cleaning up preview stream...');
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        
        toast({
          title: "Jitsi Meet prêt",
          description: "Interface de conférence chargée",
        });
      });

      api.addEventListener('participantJoined', (participant: any) => {
        console.log('Participant joined:', participant.displayName);
      });

      api.addEventListener('participantLeft', (participant: any) => {
        console.log('Participant left:', participant.displayName);
      });

      api.addEventListener('videoConferenceJoined', (info: any) => {
        console.log('Successfully joined conference:', info);
        toast({
          title: "Réunion rejointe",
          description: "Vous êtes maintenant dans la réunion",
        });
      });

      api.addEventListener('videoConferenceLeft', () => {
        console.log('Left the conference');
        toast({
          title: "Réunion quittée",
          description: "Vous avez quitté la réunion",
        });
        setLocation('/');
      });

      api.addEventListener('readyToClose', () => {
        console.log('Jitsi ready to close');
        setLocation('/');
      });

      // Gestion des erreurs
      api.addEventListener('error', (error: any) => {
        console.error('Jitsi error:', error);
        toast({
          title: "Erreur Jitsi",
          description: error.message || "Une erreur est survenue",
          variant: "destructive"
        });
      });

    } catch (error) {
      console.error('Error initializing Jitsi:', error);
      setIsInitializing(false);
      toast({
        title: "Erreur d'initialisation",
        description: "Impossible de charger Jitsi Meet",
        variant: "destructive"
      });
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const leaveRoom = () => {
    if (jitsiApi) {
      jitsiApi.dispose();
    }
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    setLocation('/');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'denied': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-blue-400 rounded-full" />;
    }
  };

  useEffect(() => {
    if (roomCode && authUser) {
      const init = async () => {
        console.log('Starting initialization sequence...');
        
        // D'abord forcer l'accès aux médias
        const mediaSuccess = await forceMediaAccess();
        console.log('Media access result:', mediaSuccess);
        
        // Attendre un peu pour que les permissions soient bien établies
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Puis initialiser Jitsi
        await initializeJitsi();
      };
      init();
    }

    return () => {
      console.log('Cleaning up JitsiEmbedded component...');
      if (jitsiApi) {
        try {
          jitsiApi.dispose();
        } catch (e) {
          console.log('Error disposing Jitsi API:', e);
        }
      }
      if (stream) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.log('Error stopping track:', e);
          }
        });
      }
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
        <Card className="p-8 max-w-2xl w-full bg-gray-800 border-gray-700">
          <div className="text-center mb-8">
            <div className="animate-spin w-12 h-12 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
            <h2 className="text-3xl font-bold mb-4 text-white">Initialisation de la réunion</h2>
            <p className="text-gray-300 mb-6">
              Test d'accès aux périphériques et chargement de Jitsi Meet...
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Video Preview */}
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg overflow-hidden aspect-video">
                {stream && mediaStatus.camera === 'granted' ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Camera className="h-16 w-16 text-gray-500" />
                  </div>
                )}
              </div>
              <div className="text-center text-sm text-gray-400">
                Test de votre caméra
              </div>
            </div>

            {/* Status Panel */}
            <div className="space-y-6">
              <div className="bg-gray-700/50 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">État des périphériques</h3>
                
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Camera className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Caméra</span>
                    </div>
                    {getStatusIcon(mediaStatus.camera)}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Mic className="h-4 w-4 text-gray-400" />
                      <span className="text-gray-300">Microphone</span>
                    </div>
                    {getStatusIcon(mediaStatus.microphone)}
                  </div>
                </div>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-4">
                <p className="text-sm text-gray-300 mb-2">
                  <strong>Salle:</strong> {roomCode}
                </p>
                <p className="text-sm text-gray-300">
                  <strong>Participant:</strong> {authUser?.displayName || authUser?.username}
                </p>
              </div>
            </div>
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
            <div className="flex items-center space-x-1">
              <Camera className="h-4 w-4" />
              {getStatusIcon(mediaStatus.camera)}
            </div>
            <div className="flex items-center space-x-1">
              <Mic className="h-4 w-4" />
              {getStatusIcon(mediaStatus.microphone)}
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button onClick={toggleFullscreen} variant="outline" size="sm">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button onClick={leaveRoom} variant="destructive" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quitter
          </Button>
        </div>
      </div>

      {/* Jitsi Container */}
      <div className="flex-1 relative bg-gray-800">
        <div 
          ref={jitsiContainerRef} 
          className="w-full h-full rounded-lg overflow-hidden border border-gray-600"
          style={{ 
            minHeight: isFullscreen ? 'calc(100vh - 80px)' : 'calc(100vh - 80px)',
            backgroundColor: '#1f2937'
          }}
        >
          {!jitsiApi && isInitializing && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-300">Chargement de Jitsi Meet...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JitsiEmbedded;