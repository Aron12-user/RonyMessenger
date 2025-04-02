
import React, { useEffect, useRef, useState } from 'react';
import Peer from 'simple-peer';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import useWebSocket from '@/hooks/useWebSocket';
import { WS_EVENTS } from '@/lib/constants';
import { User } from '@shared/schema';
import { ensureBufferLoaded } from '@/lib/globalPolyfill';

interface VideoCallProps {
  user: User;
  isInitiator?: boolean;
  onClose: () => void;
}

export default function VideoCall({ user, isInitiator = false, onClose }: VideoCallProps) {
  const [connected, setConnected] = useState(false);
  const [callStatus, setCallStatus] = useState<'calling' | 'connected' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [videoEnabled, setVideoEnabled] = useState(true);
  
  const peerRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
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
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: true,
          video: true
        });
        
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        
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
          if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
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
          title: "Erreur de caméra",
          description: "Impossible d'accéder à la caméra ou au microphone",
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

  const handleToggleVideo = () => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setVideoEnabled(!videoEnabled);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="relative flex-1 bg-gray-900">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="w-full h-full object-cover"
        />
        
        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="absolute top-4 right-4 w-32 h-48 object-cover rounded-lg shadow-lg"
        />
        
        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
          <div className="flex items-center justify-between">
            <div className="text-white">
              <h3 className="font-medium">{user.displayName || user.username}</h3>
              <p className="text-sm opacity-80">
                {callStatus === 'calling' ? 'Appel en cours...' : 
                 callStatus === 'connected' ? formatDuration(callDuration) :
                 'Appel terminé'}
              </p>
            </div>
            
            <div className="flex space-x-4">
              <Button
                onClick={handleToggleMute}
                variant={muted ? "destructive" : "secondary"}
                size="icon"
                className="rounded-full"
              >
                <span className="material-icons">
                  {muted ? 'mic_off' : 'mic'}
                </span>
              </Button>
              
              <Button
                onClick={handleToggleVideo}
                variant={videoEnabled ? "secondary" : "destructive"}
                size="icon"
                className="rounded-full"
              >
                <span className="material-icons">
                  {videoEnabled ? 'videocam' : 'videocam_off'}
                </span>
              </Button>
              
              <Button
                onClick={handleEndCall}
                variant="destructive"
                size="icon"
                className="rounded-full"
              >
                <span className="material-icons">call_end</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
