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
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2, ExternalLink
} from "lucide-react";

const VideoConference: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // États
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [connectionError, setConnectionError] = useState(false);
  
  const roomCode = params?.roomCode;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Construire l'URL Jitsi avec domaine fiable
  const buildJitsiUrl = () => {
    if (!roomCode) return '';
    
    // Utiliser le domaine Jitsi principal mais avec configuration optimisée
    const baseUrl = 'https://meet.jit.si';
    const roomName = `RonyApp_${roomCode}`;
    const displayName = encodeURIComponent(authUser?.displayName || authUser?.username || 'Utilisateur');
    
    // Paramètres pour optimiser l'expérience
    const config = [
      'config.startWithAudioMuted=false',
      'config.startWithVideoMuted=false',
      'config.enableWelcomePage=false',
      'config.prejoinPageEnabled=false',
      'config.requireDisplayName=true',
      'config.disableInviteFunctions=true',
      'config.toolbarButtons=["microphone","camera","desktop","fullscreen","fodeviceselection","hangup","profile","chat","raisehand","videoquality","filmstrip","tileview","select-background","download","help","mute-everyone","mute-video-everyone","security"]',
      'interfaceConfig.SHOW_JITSI_WATERMARK=false',
      'interfaceConfig.SHOW_WATERMARK_FOR_GUESTS=false',
      'interfaceConfig.SHOW_POWERED_BY=false',
      'interfaceConfig.SHOW_PROMOTIONAL_CLOSE_PAGE=false',
      'interfaceConfig.SHOW_CHROME_EXTENSION_BANNER=false',
      'interfaceConfig.MOBILE_APP_PROMO=false',
      `userInfo.displayName=${displayName}`
    ].join('&');
    
    return `${baseUrl}/${roomName}#${config}`;
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  const openInNewTab = () => {
    const url = buildJitsiUrl();
    window.open(url, '_blank', 'width=1200,height=800');
    toast({ title: "Réunion ouverte dans une nouvelle fenêtre" });
  };

  const leaveRoom = () => {
    console.log('Quitter la réunion');
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

  // Gestion chargement iframe
  const handleIframeLoad = () => {
    console.log('Iframe Jitsi chargée avec succès');
    setIsLoading(false);
    setConnectionError(false);
    toast({
      title: "Vidéoconférence prête",
      description: "Interface chargée avec succès"
    });
  };

  const handleIframeError = () => {
    console.error('Erreur chargement iframe Jitsi');
    setIsLoading(false);
    setConnectionError(true);
    toast({
      title: "Erreur de chargement",
      description: "Problème de connexion réseau",
      variant: "destructive"
    });
  };

  // Timer de chargement avec timeout
  useEffect(() => {
    const timer = setTimeout(() => {
      if (isLoading) {
        console.log('Timeout chargement - passage en mode connecté');
        setIsLoading(false);
        // Ne pas marquer comme erreur, juste finir le chargement
      }
    }, 8000); // 8 secondes

    return () => clearTimeout(timer);
  }, [isLoading]);

  // Gestion plein écran
  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  // Écran d'erreur
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

  // Interface principale
  return (
    <div className={`h-screen bg-gray-900 text-white flex flex-col ${
      isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-lg overflow-hidden shadow-2xl' : ''
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Barre de contrôle supérieure */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : connectionError ? 'bg-red-500' : 'bg-green-500 animate-pulse'}`}></div>
            <h1 className="font-semibold">Réunion Professionnelle</h1>
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
            Salle: {roomCode}
          </Badge>
          
          {!isLoading && !connectionError && (
            <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
              ✓ Connecté
            </Badge>
          )}
          
          {connectionError && (
            <Badge variant="outline" className="bg-red-600/20 border-red-600 text-red-200">
              ⚠ Problème réseau
            </Badge>
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={openInNewTab}
            className="text-xs border-blue-600 hover:bg-blue-600/20 text-blue-200"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            Nouvelle fenêtre
          </Button>
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

      <div className="flex-1 relative bg-black">
        {/* Indicateur de chargement */}
        {isLoading && (
          <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center z-20">
            <div className="text-center">
              <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3">Connexion en cours</h3>
              <p className="text-gray-400 text-sm mb-2">Chargement de l'interface vidéo...</p>
              <div className="w-64 bg-gray-700 rounded-full h-2 mx-auto">
                <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: '70%'}}></div>
              </div>
            </div>
          </div>
        )}

        {/* Message d'erreur réseau */}
        {connectionError && !isLoading && (
          <div className="absolute inset-0 bg-gray-900/95 flex items-center justify-center z-20">
            <div className="text-center max-w-md">
              <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-6" />
              <h3 className="text-xl font-semibold mb-3">Problème de connexion</h3>
              <p className="text-gray-400 text-sm mb-6">Vérifiez votre connexion internet ou réessayez</p>
              <div className="space-y-3">
                <Button 
                  onClick={() => {
                    setConnectionError(false);
                    setIsLoading(true);
                    if (iframeRef.current) {
                      iframeRef.current.src = buildJitsiUrl();
                    }
                  }}
                  className="w-full"
                >
                  Réessayer la connexion
                </Button>
                <Button 
                  onClick={openInNewTab}
                  variant="outline"
                  className="w-full"
                >
                  Ouvrir dans une nouvelle fenêtre
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* IFrame Jitsi Meet */}
        <iframe
          ref={iframeRef}
          src={buildJitsiUrl()}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-read; clipboard-write"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className="w-full h-full border-0"
          title={`Réunion ${roomCode}`}
          style={{ border: 'none' }}
        />
      </div>
      
      {/* Overlay mode minimisé */}
      {isMinimized && (
        <div className="absolute top-2 left-2 z-30">
          <Badge variant="secondary" className="bg-blue-600 text-xs font-medium">
            📹 Réunion en cours
          </Badge>
        </div>
      )}

      {/* Barre d'outils rapide en mode normal */}
      {!isMinimized && !isLoading && !connectionError && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600 flex items-center space-x-3">
            <div className="text-xs text-gray-300">
              Utilisez les contrôles intégrés Jitsi
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <Button
              variant="ghost"
              size="sm"
              onClick={openInNewTab}
              className="text-xs h-8 px-3"
            >
              <ExternalLink className="h-3 w-3 mr-1" />
              Détacher
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoConference;