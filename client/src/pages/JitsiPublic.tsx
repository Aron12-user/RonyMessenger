import React, { useEffect, useRef, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft } from 'lucide-react';

interface User {
  id: number;
  username: string;
  displayName?: string;
}

declare global {
  interface Window {
    JitsiMeetExternalAPI: any;
  }
}

const JitsiPublic = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();
  const jitsiContainerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  // Load Jitsi Meet External API
  useEffect(() => {
    const loadJitsiScript = () => {
      if (window.JitsiMeetExternalAPI) {
        initializeJitsi();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      script.onload = () => {
        console.log('Jitsi External API loaded');
        initializeJitsi();
      };
      script.onerror = () => {
        setError('Erreur lors du chargement de Jitsi Meet');
        setIsLoading(false);
      };
      document.head.appendChild(script);
    };

    if (roomCode && authUser) {
      loadJitsiScript();
    }

    return () => {
      if (apiRef.current) {
        apiRef.current.dispose();
        apiRef.current = null;
      }
    };
  }, [roomCode, authUser]);

  const initializeJitsi = () => {
    if (!jitsiContainerRef.current || !window.JitsiMeetExternalAPI || !roomCode || !authUser) {
      return;
    }

    try {
      const domain = 'meet.jit.si';
      const options = {
        roomName: roomCode,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        configOverwrite: {
          // Interface moderne et professionnelle
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          enableWelcomePage: false,
          enableClosePage: false,
          prejoinPageEnabled: false,
          
          // Fonctionnalités avancées
          enableLipSync: true,
          enableNoiseCancellation: true,
          enableTalkWhileMuted: false,
          enableNoAudioDetection: true,
          enableSpeakerStats: true,
          
          // Chat et collaboration
          disablePrivateChat: false,
          enableInsecureRoomNameWarning: false,
          enableLobbyChat: true,
          
          // Qualité vidéo ultra-haute
          resolution: 1080,
          maxFullResolutionParticipants: 4,
          channelLastN: 20,
          
          // Interface utilisateur
          toolbarButtons: [
            'microphone', 'camera', 'closedcaptions', 'desktop', 'fullscreen',
            'fodeviceselection', 'hangup', 'profile', 'chat', 'recording',
            'livestreaming', 'etherpad', 'sharedvideo', 'settings', 'raisehand',
            'videoquality', 'filmstrip', 'invite', 'feedback', 'stats',
            'shortcuts', 'tileview', 'download', 'help', 'mute-everyone',
            'security'
          ],
          
          // Fonctionnalités de modération
          enableUserRolesBasedOnToken: false,
          enableFeaturesBasedOnToken: false,
          
          // Performance
          enableP2P: true,
          p2p: {
            enabled: true,
            stunServers: [
              { urls: 'stun:meet-jit-si-turnrelay.jitsi.net:443' }
            ]
          },
          
          // Analytics et qualité
          analytics: {
            disabled: false
          },
          
          // Interface responsive
          filmstrip: {
            disableStageFilmstrip: false,
            disableTopPanel: false
          }
        },
        interfaceConfigOverwrite: {
          // Interface minimaliste et moderne
          BRAND_WATERMARK_LINK: '',
          SHOW_BRAND_WATERMARK: false,
          SHOW_JITSI_WATERMARK: false,
          SHOW_POWERED_BY: false,
          SHOW_PROMOTIONAL_CLOSE_PAGE: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          
          // Boutons et contrôles
          TOOLBAR_ALWAYS_VISIBLE: false,
          TOOLBAR_TIMEOUT: 4000,
          
          // Chat
          CHAT_ENABLED: true,
          
          // Qualité vidéo
          VIDEO_QUALITY_LABEL_DISABLED: false,
          
          // Interface mobile
          MOBILE_APP_PROMO: false,
          
          // Paramètres avancés
          SETTINGS_SECTIONS: [
            'devices', 'language', 'moderator', 'profile', 'calendar', 'sounds', 'more'
          ],
          
          // Affichage
          DISPLAY_WELCOME_PAGE_CONTENT: false,
          DISPLAY_WELCOME_PAGE_TOOLBAR_ADDITIONAL_CONTENT: false,
          
          // Notifications
          DISABLE_PRESENCE_STATUS: false,
          DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
          
          // Performance
          OPTIMAL_BROWSERS: ['chrome', 'chromium', 'firefox', 'electron', 'safari'],
          UNSUPPORTED_BROWSERS: [],
          
          // Interface responsive
          VERTICAL_FILMSTRIP: true,
          filmStripOnly: false,
          
          // Couleurs et thème
          DEFAULT_BACKGROUND: '#474747',
          DISABLE_VIDEO_BACKGROUND: false,
          
          // Fonctionnalités avancées
          ENABLE_DIAL_OUT: true,
          ENABLE_FEEDBACK_ANIMATION: true,
          GENERATE_ROOMNAMES_ON_WELCOME_PAGE: false,
          HIDE_INVITE_MORE_HEADER: false,
          INITIAL_TOOLBAR_TIMEOUT: 20000,
          LANG_DETECTION: true,
          LIVE_STREAMING_HELP_LINK: 'https://jitsi.org/live',
          LOCAL_THUMBNAIL_RATIO: 16 / 9,
          MAXIMUM_ZOOMING_COEFFICIENT: 1.3,
          PROVIDER_NAME: 'RonyMeet',
          RECENT_LIST_ENABLED: true,
          REMOTE_THUMBNAIL_RATIO: 1,
          SUPPORT_URL: 'https://community.jitsi.org/',
          
          // Sécurité
          ENFORCE_NOTIFICATION_AUTO_DISMISS_TIMEOUT: 15000
        },
        userInfo: {
          displayName: authUser.displayName || authUser.username || 'Participant',
          email: authUser.username || ''
        }
      };

      console.log('Initializing Jitsi with options:', options);
      
      apiRef.current = new window.JitsiMeetExternalAPI(domain, options);
      
      // Event listeners
      apiRef.current.addEventListener('videoConferenceJoined', () => {
        console.log('Joined Jitsi conference');
        setIsLoading(false);
        setError(null);
        
        toast({
          title: "Réunion rejointe",
          description: "Vous êtes maintenant connecté à la vidéoconférence"
        });
      });

      apiRef.current.addEventListener('videoConferenceLeft', () => {
        console.log('Left Jitsi conference');
        setLocation('/');
        toast({
          title: "Réunion quittée",
          description: "Vous avez quitté la vidéoconférence"
        });
      });

      apiRef.current.addEventListener('readyToClose', () => {
        console.log('Jitsi ready to close');
        setLocation('/');
      });

      apiRef.current.addEventListener('participantJoined', (participant: any) => {
        console.log('Participant joined:', participant);
        toast({
          title: "Nouveau participant",
          description: `${participant.displayName || 'Un participant'} a rejoint la réunion`
        });
      });

      apiRef.current.addEventListener('participantLeft', (participant: any) => {
        console.log('Participant left:', participant);
        toast({
          title: "Participant parti",
          description: `${participant.displayName || 'Un participant'} a quitté la réunion`
        });
      });

      apiRef.current.addEventListener('chatUpdated', (message: any) => {
        console.log('Chat message:', message);
      });

      apiRef.current.addEventListener('errorOccurred', (error: any) => {
        console.error('Jitsi error:', error);
        setError('Erreur lors de la connexion à la réunion');
        setIsLoading(false);
      });

      // Set audio/video state
      setTimeout(() => {
        try {
          // Enable audio by default
          apiRef.current?.executeCommand('toggleAudio');
          
          // Enable video by default  
          apiRef.current?.executeCommand('toggleVideo');
        } catch (err) {
          console.log('Could not set initial media state:', err);
        }
      }, 2000);

    } catch (err) {
      console.error('Error initializing Jitsi:', err);
      setError('Erreur lors de l\'initialisation de Jitsi Meet');
      setIsLoading(false);
    }
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center bg-gray-800 border-gray-700">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-white">Erreur de connexion</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <div className="space-y-3">
            <Button onClick={() => window.location.reload()} className="w-full">
              Réessayer
            </Button>
            <Button variant="outline" onClick={() => setLocation('/')} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour à l'accueil
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-gray-900 relative">
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gray-900 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-8 rounded-xl text-center border border-gray-700 shadow-2xl">
            <div className="animate-spin w-12 h-12 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
            <h2 className="text-white text-xl mb-2">Connexion à Jitsi Meet...</h2>
            <p className="text-gray-400">Chargement de la vidéoconférence</p>
            <div className="mt-4">
              <p className="text-sm text-gray-500">Salle: {roomCode}</p>
            </div>
          </div>
        </div>
      )}

      {/* Jitsi container */}
      <div 
        ref={jitsiContainerRef}
        className="w-full h-full"
        style={{ minHeight: '100vh' }}
      />

      {/* Back button for emergency exit */}
      {!isLoading && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation('/')}
          className="absolute top-4 left-4 z-40 bg-black/60 hover:bg-black/80 text-white border border-white/20"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Retour
        </Button>
      )}
    </div>
  );
};

export default JitsiPublic;