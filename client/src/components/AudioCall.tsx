import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import UserAvatar from './UserAvatar';
import useWebSocket from '@/hooks/useWebSocket';
import { WS_EVENTS } from '@/lib/constants';
import { User } from '@shared/schema';
import { ensureBufferLoaded } from '@/lib/globalPolyfill';

interface AudioCallProps {
  user: User;
  isInitiator?: boolean;
  onClose: () => void;
}

export default function AudioCall({ user, isInitiator = false, onClose }: AudioCallProps) {
  const [connected, setConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);

  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const { toast } = useToast();
  const { sendMessage, addMessageHandler } = useWebSocket();

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  useEffect(() => {
    const startCall = async () => {
      try {
        await ensureBufferLoaded();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = stream;

        const peer = new Peer({
          initiator: isInitiator,
          trickle: false,
          stream
        });

        peer.on('signal', data => {
          sendMessage(WS_EVENTS.CALL_SIGNAL, {
            target: user.id,
            signal: data
          });
        });

        peer.on('connect', () => {
          setConnected(true);
          setCallStatus('connected');
          timerRef.current = setInterval(() => {
            setCallDuration(prev => prev + 1);
          }, 1000);
        });

        peer.on('stream', (remoteStream: MediaStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(console.error);
          }
        });

        peer.on('error', (err: Error) => {
          console.error('Peer error:', err);
          handleEndCall();
        });

        peerRef.current = peer;
      } catch (err) {
        console.error('Failed to start call:', err);
        toast({
          title: "Erreur de microphone",
          description: "Impossible d'accéder au microphone",
          variant: "destructive"
        });
        onClose();
      }
    };

    const handleCallSignal = addMessageHandler(WS_EVENTS.CALL_SIGNAL, (data) => {
      if (peerRef.current) {
        peerRef.current.signal(data.signal);
      }
    });

    startCall();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (peerRef.current) {
        peerRef.current.destroy();
      }
      handleCallSignal();
    };
  }, []);

  const handleEndCall = () => {
    sendMessage(WS_EVENTS.CALL_ENDED, {
      target: user.id
    });
    onClose();
  };

  const handleToggleMute = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setMuted(!muted);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg w-full max-w-md p-6">
        <audio ref={remoteAudioRef} autoPlay />

        <div className="flex flex-col items-center">
          <UserAvatar 
            initials={user.displayName?.charAt(0) || user.username.charAt(0)} 
            color={user.id.toString()}
            size="lg"
          />

          <h3 className="text-xl font-bold mt-4">
            {user.displayName || user.username}
          </h3>

          <p className="text-gray-500 dark:text-gray-400 mt-2">
            {callStatus === 'calling' ? 'Appel en cours...' : 
             callStatus === 'connected' ? `En appel • ${formatDuration(callDuration)}` :
             'Appel terminé'}
          </p>

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
    </div>
  );
}