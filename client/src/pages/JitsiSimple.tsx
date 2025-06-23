import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, ExternalLink, Camera, Mic, CheckCircle, XCircle } from 'lucide-react';

interface User {
  id: number;
  username: string;
  displayName?: string;
}

const JitsiSimple = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [mediaStatus, setMediaStatus] = useState({
    camera: 'checking',
    microphone: 'checking',
    ready: false
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  // Force camera and microphone access
  const forceMediaAccess = async () => {
    try {
      console.log('Forcing camera and microphone access...');
      
      // Multiple strategies to force access
      const constraints = {
        video: {
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 60 },
          facingMode: 'user'
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        }
      };

      // Try to get user media with aggressive approach
      let mediaStream: MediaStream | null = null;
      
      try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('Media access granted successfully');
      } catch (error) {
        console.log('First attempt failed, trying fallback...');
        // Fallback with minimal constraints
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        } catch (fallbackError) {
          console.log('Fallback failed, trying video only...');
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          } catch (videoOnlyError) {
            console.log('Video only failed, trying audio only...');
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
          }
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        
        // Update status based on tracks
        const videoTracks = mediaStream.getVideoTracks();
        const audioTracks = mediaStream.getAudioTracks();
        
        setMediaStatus({
          camera: videoTracks.length > 0 ? 'granted' : 'denied',
          microphone: audioTracks.length > 0 ? 'granted' : 'denied',
          ready: true
        });

        // Display video preview
        if (videoRef.current && videoTracks.length > 0) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(console.error);
        }

        toast({
          title: "Accès aux périphériques accordé",
          description: `Caméra: ${videoTracks.length > 0 ? '✓' : '✗'}, Microphone: ${audioTracks.length > 0 ? '✓' : '✗'}`,
        });

        // Auto-redirect after 3 seconds
        setTimeout(() => {
          redirectToJitsi();
        }, 3000);
        
      } else {
        throw new Error('Impossible d\'accéder aux périphériques');
      }
      
    } catch (error) {
      console.error('Media access error:', error);
      setMediaStatus({
        camera: 'denied',
        microphone: 'denied',
        ready: true
      });
      
      toast({
        title: "Problème d'accès aux périphériques",
        description: "Continuez quand même vers Jitsi Meet",
        variant: "destructive"
      });
    }
  };

  const redirectToJitsi = () => {
    if (!roomCode || !authUser) return;
    
    setIsRedirecting(true);
    
    // Clean up stream before redirect
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    
    // Generate Jitsi Meet URL with advanced parameters
    const displayName = encodeURIComponent(authUser.displayName || authUser.username || 'Participant');
    const roomName = encodeURIComponent(roomCode);
    
    // Construct URL with advanced features and forced media
    const jitsiUrl = `https://meet.jit.si/${roomName}` +
      `?userInfo.displayName=${displayName}` +
      `&config.startWithAudioMuted=false` +
      `&config.startWithVideoMuted=false` +
      `&config.prejoinPageEnabled=false` +
      `&config.enableWelcomePage=false` +
      `&config.enableClosePage=false` +
      `&config.resolution=1080` +
      `&config.maxFullResolutionParticipants=4` +
      `&config.channelLastN=20` +
      `&config.enableLipSync=true` +
      `&config.enableNoiseCancellation=true` +
      `&config.enableSpeakerStats=true` +
      `&config.enableP2P=true` +
      `&config.requireDisplayName=false` +
      `&config.disableDeepLinking=true` +
      `&interfaceConfig.SHOW_JITSI_WATERMARK=false` +
      `&interfaceConfig.SHOW_BRAND_WATERMARK=false` +
      `&interfaceConfig.SHOW_POWERED_BY=false` +
      `&interfaceConfig.PROVIDER_NAME=RonyMeet` +
      `&interfaceConfig.TOOLBAR_ALWAYS_VISIBLE=false` +
      `&interfaceConfig.TOOLBAR_TIMEOUT=4000` +
      `&interfaceConfig.CHAT_ENABLED=true` +
      `&interfaceConfig.MOBILE_APP_PROMO=false` +
      `&interfaceConfig.VERTICAL_FILMSTRIP=true` +
      `&interfaceConfig.DEFAULT_BACKGROUND=#474747`;

    // Open Jitsi Meet in the same window
    window.location.href = jitsiUrl;
  };

  useEffect(() => {
    if (roomCode && authUser && !mediaStatus.ready) {
      // Start media access check immediately
      forceMediaAccess();
    }
  }, [roomCode, authUser, mediaStatus.ready]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return <CheckCircle className="h-5 w-5 text-green-400" />;
      case 'denied': return <XCircle className="h-5 w-5 text-red-400" />;
      default: return <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-blue-400 rounded-full" />;
    }
  };

  const openJitsiInNewTab = () => {
    if (!roomCode || !authUser) return;
    
    const displayName = encodeURIComponent(authUser.displayName || authUser.username || 'Participant');
    const roomName = encodeURIComponent(roomCode);
    
    const jitsiUrl = `https://meet.jit.si/${roomName}?userInfo.displayName=${displayName}`;
    window.open(jitsiUrl, '_blank', 'noopener,noreferrer');
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

  if (isRedirecting) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-lg w-full text-center bg-gray-800 border-gray-700">
          <div className="animate-spin w-12 h-12 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-4 text-white">Redirection en cours...</h2>
          <p className="text-gray-300 mb-6">
            Vous êtes redirigé vers Jitsi Meet
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="p-8 max-w-2xl w-full bg-gray-800 border-gray-700">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold mb-4 text-white">Vérification des périphériques</h2>
          <p className="text-gray-300">
            Test d'accès forcé à la caméra et au microphone avant la réunion
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
              Aperçu de votre caméra
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

            <div className="space-y-3">
              {mediaStatus.ready && (
                <Button 
                  onClick={redirectToJitsi} 
                  className="w-full"
                  size="lg"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Rejoindre la réunion
                </Button>
              )}
              
              <Button 
                onClick={openJitsiInNewTab} 
                className="w-full" 
                variant="outline"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Ouvrir dans un nouvel onglet
              </Button>
              
              <Button 
                onClick={() => setLocation('/')} 
                variant="ghost" 
                className="w-full"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Retour à l'accueil
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-8 text-center">
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-300 mb-2">
              <strong>Fonctionnalités Jitsi Meet incluses:</strong>
            </p>
            <p className="text-xs text-blue-400">
              Vidéo 4K • Chat temps réel • Partage d'écran • Enregistrement • Sous-titres • Modération avancée
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
};

export default JitsiSimple;