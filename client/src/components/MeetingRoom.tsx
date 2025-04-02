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
            disableModeratorIndicator: true,
            enableEmailInStats: false,
            prejoinPageEnabled: false,
            disableSimulcast: false,
            enableClosePage: false,
            hideConferenceSubject: true,
            hideConferenceTimer: false,
            hideParticipantsStats: false,
            toolbarButtons: [
              'microphone', 'camera', 'desktop', 'chat',
              'raisehand', 'tileview', 'hangup', 'settings'
            ],
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: false,
            TOOLBAR_ALWAYS_VISIBLE: true,
            HIDE_INVITE_MORE_HEADER: false,
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
              // Tentative de rafraîchir le token
              if (room?.roomName) {
                refreshTokenMutation.mutate(room.roomName);
              }
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