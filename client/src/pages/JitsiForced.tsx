import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Camera, Mic, CheckCircle, XCircle, Monitor, Play } from 'lucide-react';

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

const JitsiForced = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();
  const [mediaReady, setMediaReady] = useState(false);
  const [jitsiLoaded, setJitsiLoaded] = useState(false);
  const [jitsiApi, setJitsiApi] = useState<any>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [forceStart, setForceStart] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  // Force l'accès aux médias de manière agressive
  const forceMediaAccess = async () => {
    console.log('🚀 FORÇAGE ACCÈS MÉDIA - DÉBUT');
    
    try {
      // Essayer de forcer l'accès même si refusé précédemment
      let mediaStream: MediaStream | null = null;
      
      // Stratégie 1: Demande normale
      try {
        console.log('Tentative accès normal...');
        mediaStream = await navigator.mediaDevices.getUserMedia({ 
          video: { width: 640, height: 480 }, 
          audio: true 
        });
        console.log('✅ Accès normal réussi');
      } catch (e) {
        console.log('❌ Accès normal échoué, tentative fallback...');
        
        // Stratégie 2: Vidéo seulement
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          console.log('✅ Accès vidéo seule réussi');
        } catch (e2) {
          console.log('❌ Accès vidéo échoué, tentative audio...');
          
          // Stratégie 3: Audio seulement
          try {
            mediaStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
            console.log('✅ Accès audio seul réussi');
          } catch (e3) {
            console.log('❌ Tous les accès média ont échoué');
          }
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        
        const videoTracks = mediaStream.getVideoTracks();
        const audioTracks = mediaStream.getAudioTracks();
        
        console.log(`Pistes trouvées - Vidéo: ${videoTracks.length}, Audio: ${audioTracks.length}`);
        
        // Afficher la prévisualisation si vidéo disponible
        if (videoRef.current && videoTracks.length > 0) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play().catch(e => console.log('Play error:', e));
        }
        
        toast({
          title: "Périphériques activés",
          description: `Vidéo: ${videoTracks.length > 0 ? 'Oui' : 'Non'}, Audio: ${audioTracks.length > 0 ? 'Oui' : 'Non'}`,
        });
      } else {
        console.log('⚠️ Aucun média disponible mais on continue');
        toast({
          title: "Aucun périphérique",
          description: "Démarrage de la réunion sans média local",
          variant: "destructive"
        });
      }
      
      setMediaReady(true);
      return true;
      
    } catch (error) {
      console.error('Erreur accès média:', error);
      setMediaReady(true); // On continue même en cas d'erreur
      return false;
    }
  };

  // Chargement forcé de l'API Jitsi
  const loadJitsiAPI = async () => {
    console.log('🚀 CHARGEMENT API JITSI - DÉBUT');
    
    if (window.JitsiMeetExternalAPI) {
      console.log('✅ API Jitsi déjà chargée');
      setJitsiLoaded(true);
      return true;
    }

    try {
      console.log('Téléchargement API Jitsi...');
      
      const script = document.createElement('script');
      script.src = 'https://meet.jit.si/external_api.js';
      script.async = true;
      document.head.appendChild(script);
      
      await new Promise((resolve, reject) => {
        script.onload = () => {
          console.log('✅ API Jitsi chargée avec succès');
          setJitsiLoaded(true);
          resolve(true);
        };
        script.onerror = () => {
          console.error('❌ Erreur chargement API Jitsi');
          reject(new Error('Erreur chargement API'));
        };
        
        // Timeout 20 secondes
        setTimeout(() => {
          reject(new Error('Timeout chargement API'));
        }, 20000);
      });
      
      return true;
    } catch (error) {
      console.error('Erreur chargement API:', error);
      toast({
        title: "Erreur de chargement",
        description: "Impossible de charger Jitsi Meet",
        variant: "destructive"
      });
      return false;
    }
  };

  // Démarrage forcé de Jitsi
  const startJitsiMeeting = async () => {
    if (!roomCode || !authUser || !jitsiContainerRef.current) {
      console.error('❌ Données manquantes');
      return;
    }

    console.log('🚀 DÉMARRAGE JITSI - DÉBUT');
    setForceStart(true);

    try {
      // Nettoyer le container
      jitsiContainerRef.current.innerHTML = '';
      
      const displayName = authUser.displayName || authUser.username || 'Participant';
      
      console.log('Configuration Jitsi avec:', {
        roomName: roomCode,
        displayName: displayName,
        container: !!jitsiContainerRef.current
      });

      // Configuration ultra-simplifiée
      const options = {
        roomName: roomCode,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        
        // Configuration minimale pour forcer le démarrage
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,  // TRÈS IMPORTANT: pas de page de pré-connexion
          enableWelcomePage: false,
          enableClosePage: false,
          disableDeepLinking: true,
          enableP2P: false,  // Forcer le serveur
          resolution: 480,   // Résolution plus basse pour forcer
        },
        
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          PROVIDER_NAME: 'RonyMeet',
          MOBILE_APP_PROMO: false,
          TOOLBAR_ALWAYS_VISIBLE: true  // Toujours visible
        },
        
        userInfo: {
          displayName: displayName
        }
      };

      console.log('Création instance Jitsi...');
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', options);
      setJitsiApi(api);
      
      console.log('✅ Instance Jitsi créée, attente des événements...');

      // Events simplifiés
      api.addEventListener('ready', () => {
        console.log('🎉 JITSI READY !');
        setForceStart(false);
        
        // Nettoyer le stream de prévisualisation
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
        
        toast({
          title: "Jitsi Meet prêt",
          description: "Réunion démarrée avec succès",
        });
      });

      api.addEventListener('videoConferenceJoined', () => {
        console.log('🎉 CONFÉRENCE REJOINTE !');
        toast({
          title: "Réunion rejointe",
          description: "Vous êtes dans la réunion",
        });
      });

      api.addEventListener('videoConferenceLeft', () => {
        console.log('👋 Conférence quittée');
        setLocation('/');
      });

      api.addEventListener('readyToClose', () => {
        console.log('🚪 Prêt à fermer');
        setLocation('/');
      });

      // Timeout de sécurité plus long
      setTimeout(() => {
        if (forceStart) {
          console.warn('⚠️ TIMEOUT DÉTECTÉ - Jitsi ne répond pas');
          toast({
            title: "Timeout détecté",
            description: "Jitsi prend plus de temps que prévu",
            variant: "destructive"
          });
        }
      }, 45000);

    } catch (error) {
      console.error('❌ ERREUR DÉMARRAGE JITSI:', error);
      setForceStart(false);
      toast({
        title: "Erreur de démarrage",
        description: `Erreur: ${error instanceof Error ? error.message : 'Inconnue'}`,
        variant: "destructive"
      });
    }
  };

  // Démarrage automatique
  useEffect(() => {
    if (roomCode && authUser) {
      console.log('=== INITIALISATION AUTOMATIQUE ===');
      
      const init = async () => {
        // 1. Forcer accès média
        await forceMediaAccess();
        
        // 2. Charger API Jitsi
        await loadJitsiAPI();
        
        // 3. Attendre un peu
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 4. Démarrer automatiquement
        await startJitsiMeeting();
      };
      
      init();
    }

    return () => {
      console.log('=== NETTOYAGE ===');
      if (jitsiApi) {
        try {
          jitsiApi.dispose();
        } catch (e) {
          console.log('Erreur dispose:', e);
        }
      }
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [roomCode, authUser]);

  if (!roomCode) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center bg-gray-800 border-gray-700">
          <AlertCircle className="h-16 w-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4 text-white">Code de réunion manquant</h2>
          <Button onClick={() => setLocation('/')} className="w-full">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  // Écran de démarrage automatique
  if (!jitsiApi || forceStart) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-4xl w-full bg-gray-800 border-gray-700">
          <div className="grid md:grid-cols-2 gap-8">
            {/* Prévisualisation */}
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg overflow-hidden aspect-video relative">
                {stream ? (
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
                {mediaReady && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <CheckCircle className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div className="text-center text-sm text-gray-400">
                Aperçu de votre caméra
              </div>
            </div>

            {/* Status */}
            <div className="space-y-6">
              <div className="text-center">
                <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <h2 className="text-2xl font-bold mb-2 text-white">Démarrage automatique</h2>
                <p className="text-gray-300">
                  {!mediaReady ? 'Activation des périphériques...' :
                   !jitsiLoaded ? 'Chargement de Jitsi Meet...' :
                   'Création de la réunion...'}
                </p>
              </div>

              <div className="bg-gray-700/50 rounded-lg p-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Périphériques</span>
                    {mediaReady ? <CheckCircle className="h-5 w-5 text-green-400" /> : 
                     <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-blue-400 rounded-full" />}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">API Jitsi</span>
                    {jitsiLoaded ? <CheckCircle className="h-5 w-5 text-green-400" /> : 
                     <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-blue-400 rounded-full" />}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-300">Réunion</span>
                    {jitsiApi && !forceStart ? <CheckCircle className="h-5 w-5 text-green-400" /> : 
                     <div className="animate-spin w-5 h-5 border-2 border-gray-400 border-t-blue-400 rounded-full" />}
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-1">
                  <strong>Salle:</strong> {roomCode}
                </p>
                <p className="text-sm text-blue-300">
                  <strong>Participant:</strong> {authUser?.displayName || authUser?.username}
                </p>
              </div>

              <div className="space-y-2">
                {mediaReady && jitsiLoaded && (
                  <Button 
                    onClick={startJitsiMeeting}
                    className="w-full"
                    disabled={forceStart}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Forcer le démarrage
                  </Button>
                )}
                
                <Button 
                  onClick={() => setLocation('/')} 
                  variant="ghost" 
                  className="w-full"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  // Interface de réunion
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header simple */}
      <div className="bg-gray-800 border-b border-gray-700 p-3 flex items-center justify-between">
        <h1 className="text-lg font-bold text-white">RonyMeet - {roomCode}</h1>
        <Button 
          onClick={() => {
            if (jitsiApi) jitsiApi.dispose();
            setLocation('/');
          }} 
          variant="destructive" 
          size="sm"
        >
          Quitter
        </Button>
      </div>

      {/* Container Jitsi */}
      <div className="flex-1 p-2">
        <div 
          ref={jitsiContainerRef} 
          className="w-full h-full bg-black rounded border border-gray-600"
          style={{ minHeight: 'calc(100vh - 80px)' }}
        />
      </div>
    </div>
  );
};

export default JitsiForced;