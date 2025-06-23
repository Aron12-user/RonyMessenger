import React, { useEffect, useState } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';

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

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  useEffect(() => {
    if (roomCode && authUser && !isRedirecting) {
      setIsRedirecting(true);
      
      // Generate Jitsi Meet URL with advanced parameters
      const displayName = encodeURIComponent(authUser.displayName || authUser.username || 'Participant');
      const roomName = encodeURIComponent(roomCode);
      
      // Construct URL with advanced features
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

      // Open Jitsi Meet in the same window for seamless experience
      window.location.href = jitsiUrl;
    }
  }, [roomCode, authUser, isRedirecting]);

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

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
      <Card className="p-8 max-w-lg w-full text-center bg-gray-800 border-gray-700">
        <div className="animate-spin w-12 h-12 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
        <h2 className="text-2xl font-bold mb-4 text-white">Redirection vers Jitsi Meet</h2>
        <p className="text-gray-300 mb-6">
          Vous êtes redirigé vers la plateforme Jitsi Meet avec toutes les fonctionnalités avancées
        </p>
        
        <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-gray-300 mb-2">
            <strong>Salle:</strong> {roomCode}
          </p>
          <p className="text-sm text-gray-300">
            <strong>Participant:</strong> {authUser?.displayName || authUser?.username}
          </p>
        </div>

        <div className="space-y-3">
          <Button onClick={openJitsiInNewTab} className="w-full" variant="outline">
            <ExternalLink className="h-4 w-4 mr-2" />
            Ouvrir dans un nouvel onglet
          </Button>
          
          <Button onClick={() => setLocation('/')} variant="ghost" className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          <p>Fonctionnalités incluses:</p>
          <p>• Vidéo HD/4K • Chat en temps réel • Partage d'écran</p>
          <p>• Enregistrement • Sous-titres • Modération</p>
        </div>
      </Card>
    </div>
  );
};

export default JitsiSimple;