import React, { useState, useEffect, useRef } from 'react';
import { JitsiMeeting } from '@jitsi/react-sdk';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { 
  CircleHelp, 
  Copy, 
  UserPlus, 
  Mic, 
  Video, 
  MonitorUp, 
  MessageSquare, 
  Settings, 
  X 
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useQuery, useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface MeetingRoomProps {
  roomCode?: string;
  userName: string;
  userId: number;
  onClose: () => void;
  showControls?: boolean;
}

interface JitsiRoomInfo {
  friendlyCode: string;
  roomName: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  createdBy: number;
  participants: number[];
}

export default function MeetingRoom({ roomCode, userName, userId, onClose, showControls = true }: MeetingRoomProps) {
  const [room, setRoom] = useState<JitsiRoomInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const jitsiApiRef = useRef<any>(null);
  const tokenExpiryTimerRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  // Créer une réunion
  const createMeetingMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/meetings/create');
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.room) {
        setRoom(data.room);
        setIsLoading(false);
        // Programmer le rafraîchissement du token
        scheduleTokenRefresh(data.room.roomName);
      } else {
        setError('Impossible de créer la réunion');
        setIsLoading(false);
      }
    },
    onError: (error) => {
      setError('Erreur lors de la création de la réunion');
      setIsLoading(false);
      toast({
        variant: "destructive", 
        title: "Erreur",
        description: "Impossible de créer la salle de réunion"
      });
    }
  });

  // Rejoindre une réunion
  const joinMeetingMutation = useMutation({
    mutationFn: async (code: string) => {
      const response = await apiRequest('POST', '/api/meetings/join', { code });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.room) {
        setRoom(data.room);
        setIsLoading(false);
        // Programmer le rafraîchissement du token
        scheduleTokenRefresh(data.room.roomName);
      } else {
        setError(data.message || 'Impossible de rejoindre la réunion');
        setIsLoading(false);
      }
    },
    onError: (error) => {
      setError('Erreur lors de la tentative de rejoindre la réunion');
      setIsLoading(false);
      toast({
        variant: "destructive", 
        title: "Erreur",
        description: "Impossible de rejoindre la salle de réunion"
      });
    }
  });

  // Mutation pour rafraîchir le token JWT
  const refreshTokenMutation = useMutation({
    mutationFn: async (roomName: string) => {
      const response = await apiRequest('POST', '/api/meetings/refresh-token', { roomName });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success && data.token && jitsiApiRef.current) {
        // Mettre à jour le token dans Jitsi
        jitsiApiRef.current.executeCommand('token', data.token);
        console.log('Token JWT rafraîchi avec succès');

        // Planifier le prochain rafraîchissement
        if (room?.roomName) {
          scheduleTokenRefresh(room.roomName);
        }
      }
    },
    onError: (error) => {
      console.error('Erreur lors du rafraîchissement du token JWT:', error);
      toast({
        variant: "destructive",
        title: "Erreur de token",
        description: "Impossible de rafraîchir l'authentification de la réunion"
      });
    }
  });

  // Programmer le rafraîchissement du token avant qu'il n'expire
  // Avec un serveur auto-hébergé configuré correctement, le délai est beaucoup plus long
  // (23 heures par défaut pour un token de 24 heures)
  function scheduleTokenRefresh(roomName: string) {
    // Nettoyer le timer précédent si existant
    if (tokenExpiryTimerRef.current) {
      clearTimeout(tokenExpiryTimerRef.current);
    }

    // Vérifier si nous utilisons un serveur auto-hébergé avec une durée de token prolongée
    const isCustomServer = import.meta.env.VITE_JITSI_DOMAIN && 
                           import.meta.env.VITE_JITSI_DOMAIN !== 'meet.jit.si';

    // Délai de rafraîchissement: 23 heures pour serveur auto-hébergé, 50 minutes sinon
    const refreshDelay = isCustomServer 
      ? 23 * 60 * 60 * 1000  // 23 heures pour serveur auto-hébergé (token valide 24h)
      : 50 * 60 * 1000;      // 50 minutes pour meet.jit.si (token valide 1h)

    console.log(`Programmation du rafraîchissement du token dans ${refreshDelay/60/1000} minutes`);

    tokenExpiryTimerRef.current = setTimeout(() => {
      refreshTokenMutation.mutate(roomName);
    }, refreshDelay);
  }

  // Quitter une réunion
  const leaveMeetingMutation = useMutation({
    mutationFn: async () => {
      if (!room) return Promise.resolve();
      return await apiRequest('POST', '/api/meetings/leave', { code: room.friendlyCode });
    },
    onSuccess: () => {
      // Nettoyage avant de fermer
      if (tokenExpiryTimerRef.current) {
        clearTimeout(tokenExpiryTimerRef.current);
      }
      onClose();
    },
    onError: () => {
      // Même en cas d'erreur, fermer la réunion
      onClose();
    }
  });

  // Initialiser la salle de réunion
  useEffect(() => {
    if (roomCode) {
      // Rejoindre une réunion existante
      joinMeetingMutation.mutate(roomCode);
    } else {
      // Créer une nouvelle réunion
      createMeetingMutation.mutate();
    }

    // Nettoyage lors du démontage
    return () => {
      if (tokenExpiryTimerRef.current) {
        clearTimeout(tokenExpiryTimerRef.current);
      }
    };
  }, [roomCode]);

  // Gérer la copie du code de la réunion
  const handleCopyRoomCode = () => {
    if (room) {
      navigator.clipboard.writeText(room.friendlyCode);
      setIsCopied(true);
      toast({
        title: "Code copié",
        description: "Le code de la réunion a été copié dans le presse-papiers"
      });
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  // Gérer la fermeture de la réunion
  const handleCloseRoom = () => {
    leaveMeetingMutation.mutate();
  };

  // Fonction d'optimisation automatique de la qualité
  const optimizeVideoQuality = (connectionQuality: string, bandwidth: number) => {
    if (!jitsiApiRef.current) return;

    let targetResolution = 1080;
    let targetFrameRate = 30;
    let targetBitrate = 4000000;

    // Algorithme adaptatif basé sur la qualité de connexion
    switch (connectionQuality) {
      case 'excellent':
        targetResolution = 1080;
        targetFrameRate = 60;
        targetBitrate = 6000000;
        break;
      case 'good':
        targetResolution = 1080;
        targetFrameRate = 30;
        targetBitrate = 4000000;
        break;
      case 'medium':
        targetResolution = 720;
        targetFrameRate = 30;
        targetBitrate = 2000000;
        break;
      case 'poor':
        targetResolution = 480;
        targetFrameRate = 15;
        targetBitrate = 800000;
        break;
      default:
        targetResolution = 720;
        targetFrameRate = 30;
        targetBitrate = 1500000;
    }

    // Ajustement basé sur la bande passante disponible
    if (bandwidth < 1000000) { // < 1 Mbps
      targetResolution = Math.min(targetResolution, 480);
      targetBitrate = Math.min(targetBitrate, 800000);
    } else if (bandwidth < 3000000) { // < 3 Mbps
      targetResolution = Math.min(targetResolution, 720);
      targetBitrate = Math.min(targetBitrate, 2000000);
    }

    // Appliquer les optimisations
    try {
      jitsiApiRef.current.executeCommand('setVideoQuality', targetResolution);
      jitsiApiRef.current.executeCommand('setVideoFrameRate', targetFrameRate);
      
      console.log(`Qualité optimisée: ${targetResolution}p@${targetFrameRate}fps, ${targetBitrate/1000}kbps`);
      
      toast({
        title: "Qualité optimisée",
        description: `Résolution: ${targetResolution}p, Débit: ${Math.round(targetBitrate/1000)}kbps`,
        variant: "default"
      });
    } catch (error) {
      console.error('Erreur lors de l\'optimisation:', error);
    }
  };

  // Fonction pour forcer la haute qualité
  const forceHighQuality = () => {
    if (!jitsiApiRef.current) return;
    
    try {
      jitsiApiRef.current.executeCommand('setVideoQuality', 1080);
      jitsiApiRef.current.executeCommand('setVideoFrameRate', 60);
      
      toast({
        title: "Haute qualité activée",
        description: "Résolution: 1080p@60fps - Qualité maximale",
        variant: "default"
      });
    } catch (error) {
      console.error('Erreur activation haute qualité:', error);
    }
  };

  // Si en cours de chargement, afficher un indicateur
  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary"></div>
        <p className="text-white mt-4 text-lg">Préparation de la salle de réunion...</p>
      </div>
    );
  }

  // Si erreur, afficher le message
  if (error || !room) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center">
        <div className="bg-gray-800 p-8 rounded-lg max-w-md text-center">
          <CircleHelp className="mx-auto h-16 w-16 text-red-400 mb-4" />
          <h3 className="text-xl font-bold text-white mb-2">Erreur de réunion</h3>
          <p className="text-gray-300 mb-6">{error || "Impossible d'accéder à la salle de réunion"}</p>
          <Button onClick={onClose} variant="default">
            Retour
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="bg-gray-900 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button 
            variant="destructive" 
            onClick={handleCloseRoom}
            className="rounded-full w-10 h-10 p-0 flex items-center justify-center"
            aria-label="Quitter la réunion"
          >
            <X className="h-5 w-5" />
          </Button>
          <div>
            <h3 className="text-white font-medium">Réunion Rony</h3>
            <div className="flex items-center space-x-2">
              <span className="text-xs text-gray-400">Code: {room.friendlyCode}</span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="h-6 w-6 p-0 text-gray-400 hover:text-white"
                      onClick={handleCopyRoomCode}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Copier le code de la réunion</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </div>

        {showControls && (
          <div className="hidden md:flex items-center space-x-2">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700"
                    onClick={() => {
                      const roomLink = `${window.location.origin}/join-meeting/${room.friendlyCode}`;
                      navigator.clipboard.writeText(roomLink);
                      toast({
                        title: "Lien copié",
                        description: "Le lien de la réunion a été copié dans le presse-papiers"
                      });
                    }}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    <span>Inviter</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Copier le lien d'invitation</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        )}
      </div>

      <div className="flex-1 bg-gray-800 overflow-hidden">
        <JitsiMeeting
          domain={import.meta.env.VITE_JITSI_DOMAIN || "meet.jit.si"}
          roomName={room.roomName}
          jwt={room.token}
          onVideoConferenceJoinError={(error) => {
            console.error('Erreur de connexion:', error);
            toast({
              title: "Erreur de connexion",
              description: "Une erreur est survenue lors de la connexion à la réunion. Veuillez réessayer.",
              variant: "destructive"
            });
          }}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: false,
            enableEmailInStats: false,
            prejoinPageEnabled: false,
            disableSimulcast: false,
            enableClosePage: false,
            hideConferenceSubject: false,
            hideConferenceTimer: false,
            hideParticipantsStats: false,
            
            // Configuration vidéo haute qualité
            resolution: 1080,
            constraints: {
              video: {
                height: { ideal: 1080, max: 1080 },
                width: { ideal: 1920, max: 1920 },
                frameRate: { ideal: 30, max: 60 }
              },
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
                sampleRate: 48000,
                channelCount: 2
              }
            },
            
            // Optimisations réseau et performance
            enableLayerSuspension: true,
            enableTalkWhileMuted: false,
            enableNoAudioDetection: true,
            enableNoisyMicDetection: true,
            startScreenSharing: false,
            channelLastN: 25,
            enableWelcomePage: false,
            enableUserRolesBasedOnToken: true,
            
            // Fonctionnalités avancées
            enableLipSync: true,
            disableAP: false,
            enableInsecureRoomNameWarning: false,
            enableAutomaticUrlCopy: false,
            liveStreamingEnabled: false,
            transcribingEnabled: false,
            
            // Interface utilisateur améliorée
            toolbarButtons: [
              'microphone', 'camera', 'desktop', 'fullscreen',
              'fodeviceselection', 'hangup', 'profile', 'chat',
              'raisehand', 'videoquality', 'filmstrip', 'tileview',
              'select-background', 'download', 'help', 'mute-everyone',
              'security', 'livestreaming', 'etherpad', 'sharedvideo',
              'settings', 'toggle-camera', 'videoquality'
            ],
            
            // Paramètres de bande passante optimisés
            videoQuality: {
              maxBitratesVideo: {
                low: 200000,    // 200 kbps
                standard: 500000, // 500 kbps  
                high: 1500000,   // 1.5 Mbps
                ultra: 4000000   // 4 Mbps pour UHD
              }
            },
            
            // Paramètres audio améliorés
            audioQuality: {
              stereo: true,
              opusMaxAverageBitrate: 510000 // 510 kbps pour audio haute qualité
            }
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            TOOLBAR_ALWAYS_VISIBLE: true,
            HIDE_INVITE_MORE_HEADER: false,
            
            // Interface optimisée pour haute qualité
            OPTIMAL_BROWSERS: ['chrome', 'firefox', 'safari', 'edge'],
            UNSUPPORTED_BROWSERS: [],
            
            // Paramètres d'affichage améliorés
            DEFAULT_BACKGROUND: '#1a1a1a',
            DISABLE_VIDEO_BACKGROUND: false,
            INITIAL_TOOLBAR_TIMEOUT: 10000,
            TOOLBAR_TIMEOUT: 4000,
            
            // Options de qualité vidéo dans l'interface
            VIDEO_QUALITY_LABEL_DISABLED: false,
            RESOLUTION_CONTROL_ENABLED: true,
            
            // Fonctionnalités de l'interface
            SETTINGS_SECTIONS: [
              'devices', 'language', 'moderator', 'profile', 'calendar'
            ],
            
            // Configuration du chat
            CHAT_ENABLED: true,
            CHAT_COLLAPS_BUTTON_ENABLED: true,
            
            // Boutons et contrôles
            TOOLBAR_BUTTONS: [
              'microphone', 'camera', 'closedcaptions', 'desktop', 'embedmeeting',
              'fullscreen', 'fodeviceselection', 'hangup', 'profile', 'chat',
              'recording', 'livestreaming', 'etherpad', 'sharedvideo', 'settings',
              'raisehand', 'videoquality', 'filmstrip', 'invite', 'feedback',
              'stats', 'shortcuts', 'tileview', 'select-background', 'download',
              'help', 'mute-everyone', 'mute-video-everyone', 'security'
            ],
            
            // Améliorations visuelles
            SHOW_JITSI_WATERMARK: false,
            SHOW_WATERMARK_FOR_GUESTS: false,
            SHOW_POWERED_BY: false,
            SHOW_PROMOTIONAL_CLOSE_PAGE: false,
            SHOW_CHROME_EXTENSION_BANNER: false,
            
            // Notifications et statistiques
            CONNECTION_INDICATOR_DISABLED: false,
            VIDEO_LAYOUT_FIT: 'both',
            FILM_STRIP_MAX_HEIGHT: 160,
            
            // Mode mobile optimisé
            MOBILE_APP_PROMO: false,
            MOBILE_DOWNLOAD_LINK_ANDROID: '',
            MOBILE_DOWNLOAD_LINK_IOS: '',
            
            // Performance et stabilité
            DISABLE_FOCUS_INDICATOR: false,
            DISABLE_DOMINANT_SPEAKER_INDICATOR: false,
            DISABLE_TRANSCRIPTION_SUBTITLES: false
          }}
          userInfo={{
            displayName: userName,
            email: `user-${userId}@rony.app`
          }}
          onApiReady={(externalApi) => {
            jitsiApiRef.current = externalApi;

            // Écouter les événements spécifiques
            externalApi.addListener('videoConferenceLeft', () => {
              console.log('Utilisateur a quitté la conférence');
              handleCloseRoom();
            });

            externalApi.addListener('participantJoined', (participant: any) => {
              console.log('Participant a rejoint:', participant);
              toast({
                title: "Nouveau participant",
                description: `${participant.displayName} a rejoint la réunion`,
                variant: "default"
              });
            });

            externalApi.addListener('participantLeft', (participant: any) => {
              console.log('Participant a quitté:', participant);
            });

            externalApi.addListener('passwordRequired', () => {
              console.log('Authentification requise');
              if (room?.roomName) {
                refreshTokenMutation.mutate(room.roomName);
              }
            });

            // Événements de monitoring de qualité vidéo avancés
            externalApi.addListener('videoQualityChanged', (quality: any) => {
              console.log('Qualité vidéo changée:', quality);
              if (quality.resolution < 720) {
                toast({
                  title: "Qualité vidéo réduite",
                  description: "Connexion instable détectée",
                  variant: "destructive"
                });
              }
            });

            externalApi.addListener('connectionStatsUpdated', (stats: any) => {
              console.log('Statistiques de connexion:', stats);
              
              // Monitoring de la bande passante
              if (stats.bandwidth && stats.bandwidth.download < 1000000) { // < 1 Mbps
                console.warn('Bande passante faible détectée');
              }
              
              // Monitoring de la latence
              if (stats.transport && stats.transport.rtt > 200) { // > 200ms
                console.warn('Latence élevée détectée:', stats.transport.rtt + 'ms');
              }
            });

            externalApi.addListener('audioMuteStatusChanged', (data: any) => {
              console.log('Statut audio changé:', data);
            });

            externalApi.addListener('videoMuteStatusChanged', (data: any) => {
              console.log('Statut vidéo changé:', data);
            });

            externalApi.addListener('screenSharingStatusChanged', (data: any) => {
              console.log('Partage d\'écran changé:', data);
              if (data.on) {
                toast({
                  title: "Partage d'écran actif",
                  description: `${data.details.sourceType || 'Écran'} partagé`,
                  variant: "default"
                });
              }
            });

            externalApi.addListener('recordingStatusChanged', (data: any) => {
              console.log('Statut enregistrement changé:', data);
              if (data.on) {
                toast({
                  title: "Enregistrement démarré",
                  description: "La réunion est maintenant enregistrée",
                  variant: "default"
                });
              } else if (data.error) {
                toast({
                  title: "Erreur d'enregistrement",
                  description: data.error,
                  variant: "destructive"
                });
              }
            });

            externalApi.addListener('dominantSpeakerChanged', (id: string) => {
              console.log('Orateur principal changé:', id);
            });

            externalApi.addListener('raiseHandUpdated', (data: any) => {
              console.log('Main levée mise à jour:', data);
              if (data.handRaised) {
                toast({
                  title: "Main levée",
                  description: `${data.displayName} a levé la main`,
                  variant: "default"
                });
              }
            });

            // Optimisations automatiques de qualité
            externalApi.addListener('connectionQualityChanged', (data: any) => {
              console.log('Qualité de connexion:', data);
              
              if (data.quality === 'poor') {
                // Réduire automatiquement la qualité si connexion faible
                externalApi.executeCommand('setVideoQuality', 720);
                toast({
                  title: "Optimisation automatique",
                  description: "Qualité vidéo ajustée pour une meilleure stabilité",
                  variant: "default"
                });
              } else if (data.quality === 'good') {
                // Rétablir la haute qualité si connexion stable
                externalApi.executeCommand('setVideoQuality', 1080);
              }
            });

            // Détection et correction automatique des problèmes
            externalApi.addListener('participantKicked', (data: any) => {
              console.log('Participant exclu:', data);
              toast({
                title: "Participant exclu",
                description: `${data.displayName} a été exclu de la réunion`,
                variant: "destructive"
              });
            });

            externalApi.addListener('deviceListChanged', (devices: any) => {
              console.log('Liste des appareils changée:', devices);
            });

            externalApi.addListener('cameraError', (error: any) => {
              console.error('Erreur caméra:', error);
              toast({
                title: "Problème de caméra",
                description: "Vérifiez que votre caméra est connectée et autorisée",
                variant: "destructive"
              });
            });

            externalApi.addListener('micError', (error: any) => {
              console.error('Erreur microphone:', error);
              toast({
                title: "Problème de microphone", 
                description: "Vérifiez que votre microphone est connecté et autorisé",
                variant: "destructive"
              });
            });
          }}
          getIFrameRef={(node) => {
            if (node) {
              node.style.height = '100%';
              node.style.width = '100%';
              node.style.border = 'none';
            }
          }}
        />
      </div>
    </div>
  );
}