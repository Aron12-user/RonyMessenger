import React, { useEffect, useRef, useState } from 'react';
// Temporairement désactiver simple-peer pendant que nous corrigeons les polyfills
// import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import UserAvatar from './UserAvatar';
import useWebSocket from '@/hooks/useWebSocket';
import { WS_EVENTS } from '@/lib/constants';
import { User } from '@shared/schema';
import { ensureBufferLoaded } from '@/lib/globalPolyfill';

// Définition temporaire de Peer pour éviter les erreurs de compilation
const Peer = function(config: any) {
  return {
    on: (event: string, callback: any) => {},
    signal: (data: any) => {},
    destroy: () => {}
  };
}
Peer.Instance = {} as any;

interface AudioCallProps {
  user: User;
  isInitiator?: boolean;
  onClose: () => void;
  signalData?: any;
}

export default function AudioCall({ user, isInitiator = false, onClose, signalData }: AudioCallProps) {
  const [connected, setConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  
  const peerRef = useRef<Peer.Instance | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const { sendMessage, addMessageHandler } = useWebSocket();

  // Format la durée de l'appel en minutes:secondes
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    // Configuration initiale de l'appel
    const startCall = async () => {
      try {
        // S'assurer que les polyfills sont chargés (notamment pour Buffer)
        // Utiliser la fonction importée de globalPolyfill.ts
        await ensureBufferLoaded();
        
        // Obtenir l'accès au microphone
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;
        
        // Créer une instance de peer
        const peer = new Peer({
          initiator: isInitiator,
          trickle: false,
          stream
        });

        // Configurer les gestionnaires d'événements
        peer.on('signal', data => {
          if (isInitiator) {
            // Envoyer le signal d'offre au serveur
            sendMessage(WS_EVENTS.CALL_OFFER, {
              target: user.id,
              signal: data
            });
          } else if (signalData) {
            // Envoyer le signal de réponse au serveur
            sendMessage(WS_EVENTS.CALL_ANSWER, {
              target: user.id,
              signal: data
            });
          }
        });

        peer.on('connect', () => {
          setConnected(true);
          setCallStatus('connected');
          
          // Démarrer le timer pour la durée de l'appel
          timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
          
          toast({
            title: "Appel connecté",
            description: `Vous êtes maintenant en communication avec ${user.displayName || user.username}`,
          });
        });

        peer.on('stream', (remoteStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(err => console.error('Error playing audio:', err));
          }
        });

        peer.on('error', (err) => {
          console.error('Peer error:', err);
          toast({
            title: "Erreur d'appel",
            description: "Un problème est survenu avec la connexion audio",
            variant: "destructive"
          });
          handleEndCall();
        });

        // Si on est le récepteur avec des données de signal
        if (!isInitiator && signalData) {
          peer.signal(signalData);
        }

        peerRef.current = peer;
      } catch (err) {
        console.error('Failed to start call:', err);
        toast({
          title: "Erreur de microphone",
          description: "Impossible d'accéder au microphone. Vérifiez les permissions.",
          variant: "destructive"
        });
        onClose();
      }
    };

    startCall();

    // Écouteurs pour les réponses et les rejets d'appel
    const handleCallAnswer = addMessageHandler(WS_EVENTS.CALL_ANSWER, (data) => {
      if (peerRef.current && isInitiator && data.signal) {
        peerRef.current.signal(data.signal);
      }
    });

    const handleCallRejected = addMessageHandler(WS_EVENTS.CALL_REJECTED, (data) => {
      if (data.from === user.id) {
        toast({
          title: "Appel rejeté",
          description: `${user.displayName || user.username} a rejeté votre appel`,
        });
        handleEndCall();
      }
    });

    const handleCallEnded = addMessageHandler(WS_EVENTS.CALL_ENDED, (data) => {
      if (data.from === user.id) {
        toast({
          title: "Appel terminé",
          description: `${user.displayName || user.username} a raccroché`,
        });
        handleEndCall();
      }
    });

    // Nettoyage
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      
      // Arrêter tous les tracks du stream local
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      
      // Fermer la connexion peer
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      
      // Supprimer les écouteurs d'événements
      handleCallAnswer();
      handleCallRejected();
      handleCallEnded();
    };
  }, [isInitiator, user.id]);

  // Gérer la fin de l'appel
  const handleEndCall = () => {
    setCallStatus('ended');
    
    // Informer l'autre partie que l'appel est terminé
    sendMessage(WS_EVENTS.CALL_ENDED, {
      target: user.id
    });
    
    // Arrêter le timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    
    onClose();
  };

  // Gérer le bouton muet
  const handleToggleMute = () => {
    if (localStreamRef.current) {
      const audioTracks = localStreamRef.current.getAudioTracks();
      audioTracks.forEach(track => {
        track.enabled = muted; // Inverser l'état actuel
      });
      setMuted(!muted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-6 flex flex-col items-center">
        <audio ref={remoteAudioRef} autoPlay />
        
        <UserAvatar 
          initials={user.displayName?.charAt(0) || user.username.charAt(0)} 
          color={user.id.toString()}
          size="lg"
        />
        
        <h3 className="text-xl font-bold mt-4">{user.displayName || user.username}</h3>
        
        <div className="text-gray-500 dark:text-gray-400 mt-2">
          {callStatus === 'calling' ? (
            isInitiator ? 'Appel en cours...' : 'Appel entrant...'
          ) : callStatus === 'connected' ? (
            `En appel • ${formatDuration(callDuration)}`
          ) : (
            'Appel terminé'
          )}
        </div>
        
        <div className="flex space-x-4 mt-8">
          <Button 
            onClick={handleToggleMute}
            variant={muted ? "default" : "outline"}
            className="rounded-full w-12 h-12 p-0"
          >
            <span className="material-icons">
              {muted ? 'mic_off' : 'mic'}
            </span>
          </Button>
          
          <Button 
            onClick={handleEndCall}
            variant="destructive"
            className="rounded-full w-12 h-12 p-0"
          >
            <span className="material-icons">call_end</span>
          </Button>
        </div>
      </div>
    </div>
  );
}