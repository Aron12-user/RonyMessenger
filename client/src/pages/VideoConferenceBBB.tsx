import React, { useState, useEffect, useRef } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { User } from "@shared/schema";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2,
  Maximize2, Minimize2, X, Crown, Settings, MessageSquare,
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2, ExternalLink
} from "lucide-react";

const VideoConferenceBBB: React.FC = () => {
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
  const [isCreating, setIsCreating] = useState(false);
  const [connectionError, setConnectionError] = useState('');
  const [joinUrl, setJoinUrl] = useState('');
  const [meetingCreated, setMeetingCreated] = useState(false);
  
  const roomCode = params?.roomCode;
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Créer la réunion BigBlueButton
  const createBBBMeeting = async () => {
    if (!roomCode || !authUser) return;

    setIsCreating(true);
    try {
      console.log('Création réunion BBB pour:', roomCode);
      
      const response = await fetch('/api/bbb/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          meetingName: `Réunion Professionnelle ${roomCode}`
        })
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error('Échec création réunion');
      }

      console.log('✓ Réunion BBB créée');
      setMeetingCreated(true);
      
      // Générer l'URL de participation
      await joinBBBMeeting(true); // Premier utilisateur = modérateur
      
    } catch (error: any) {
      console.error('Erreur création BBB:', error);
      setConnectionError(`Erreur création: ${error.message}`);
      toast({
        title: "Erreur de création",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Rejoindre la réunion BigBlueButton
  const joinBBBMeeting = async (isModerator: boolean = false) => {
    if (!roomCode || !authUser) return;

    try {
      console.log('Génération URL participation BBB');
      
      const response = await fetch('/api/bbb/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomCode,
          isModerator
        })
      });

      const data = await response.json();
      if (!data.success || !data.joinUrl) {
        throw new Error('Impossible de générer l\'URL de participation');
      }

      console.log('✓ URL participation BBB générée');
      setJoinUrl(data.joinUrl);
      setIsLoading(false);
      
      toast({
        title: "Connexion réussie",
        description: "Interface BigBlueButton chargée"
      });
      
    } catch (error: any) {
      console.error('Erreur participation BBB:', error);
      setConnectionError(`Erreur participation: ${error.message}`);
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  // Vérifier si la réunion existe et rejoindre
  const checkAndJoinMeeting = async () => {
    if (!roomCode) return;

    try {
      console.log('Vérification réunion existante:', roomCode);
      
      // Vérifier si la réunion existe
      const response = await fetch(`/api/bbb/meeting/${roomCode}`);
      const data = await response.json();
      
      if (data.success && data.isRunning) {
        console.log('✓ Réunion active trouvée');
        await joinBBBMeeting(false); // Rejoindre comme participant
      } else {
        console.log('Réunion inexistante, création...');
        await createBBBMeeting();
      }
    } catch (error: any) {
      console.log('Réunion inexistante, création d\'une nouvelle...');
      await createBBBMeeting();
    }
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  const openInNewTab = () => {
    if (joinUrl) {
      window.open(joinUrl, '_blank', 'width=1200,height=800');
      toast({ title: "Réunion ouverte dans une nouvelle fenêtre" });
    }
  };

  const leaveRoom = async () => {
    console.log('Quitter la réunion BBB');
    
    try {
      // Optionnel: terminer la réunion si modérateur
      await fetch(`/api/bbb/meeting/${roomCode}`, {
        method: 'DELETE'
      });
    } catch (error) {
      // Ignorer les erreurs de fin de réunion
    }
    
    setLocation('/');
    toast({ title: "Réunion quittée" });
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
    console.log('✓ Interface BBB chargée');
    setIsLoading(false);
    setConnectionError('');
  };

  const handleIframeError = () => {
    console.error('Erreur chargement interface BBB');
    setConnectionError('Erreur de chargement de l\'interface');
  };

  // Initialisation
  useEffect(() => {
    if (roomCode && authUser && !joinUrl && !isCreating) {
      checkAndJoinMeeting();
    }
  }, [roomCode, authUser]);

  // Gestion plein écran
  useEffect(() => {
    const handleFullscreen = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    
    document.addEventListener('fullscreenchange', handleFullscreen);
    return () => document.removeEventListener('fullscreenchange', handleFullscreen);
  }, []);

  // Écrans d'erreur
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

  if (connectionError) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Erreur de connexion</h2>
          <p className="text-gray-600 mb-6">{connectionError}</p>
          <div className="space-y-3">
            <Button 
              onClick={() => {
                setConnectionError('');
                setIsLoading(true);
                setJoinUrl('');
                setMeetingCreated(false);
                checkAndJoinMeeting();
              }}
              className="w-full"
            >
              Réessayer
            </Button>
            <Button 
              onClick={() => setLocation('/')}
              variant="outline"
              className="w-full"
            >
              Retour
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isLoading || isCreating || !joinUrl) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">
            {isCreating ? 'Création de la réunion' : 'Connexion en cours'}
          </h2>
          <p className="text-gray-600 mb-2">
            {isCreating 
              ? 'Configuration du serveur BigBlueButton autonome...'
              : 'Chargement de l\'interface de vidéoconférence...'
            }
          </p>
          <div className="w-64 bg-gray-200 rounded-full h-2 mx-auto">
            <div className="bg-blue-500 h-2 rounded-full animate-pulse" style={{width: isCreating ? '60%' : '85%'}}></div>
          </div>
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
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <h1 className="font-semibold">BigBlueButton Pro</h1>
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
          
          <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
            ∞ Autonome
          </Badge>
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
        {/* IFrame BigBlueButton */}
        <iframe
          ref={iframeRef}
          src={joinUrl}
          width="100%"
          height="100%"
          frameBorder="0"
          allow="camera; microphone; fullscreen; display-capture; autoplay; clipboard-read; clipboard-write; web-share"
          allowFullScreen
          onLoad={handleIframeLoad}
          onError={handleIframeError}
          className="w-full h-full border-0"
          title={`Réunion BigBlueButton ${roomCode}`}
          style={{ border: 'none' }}
        />
      </div>
      
      {/* Overlay mode minimisé */}
      {isMinimized && (
        <div className="absolute top-2 left-2 z-30">
          <Badge variant="secondary" className="bg-blue-600 text-xs font-medium">
            🎥 BBB Pro - Réunion active
          </Badge>
        </div>
      )}

      {/* Indicateur de statut */}
      {!isMinimized && (
        <div className="absolute bottom-4 right-4 z-30">
          <div className="bg-gray-800/90 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-600 flex items-center space-x-3">
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-gray-300 font-medium">
                BigBlueButton autonome actif
              </span>
            </div>
            <div className="w-px h-4 bg-gray-600"></div>
            <div className="text-xs text-gray-400">
              Illimité • Milliers d'utilisateurs
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VideoConferenceBBB;