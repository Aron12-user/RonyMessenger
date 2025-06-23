import React, { useEffect, useState, useRef } from 'react';
import { useLocation, useRoute } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { AlertCircle, ArrowLeft, Camera, Mic, CheckCircle, XCircle, Monitor } from 'lucide-react';

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

const JitsiDirect = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();
  const [step, setStep] = useState<'media' | 'loading' | 'meeting'>('media');
  const [mediaStatus, setMediaStatus] = useState({
    camera: 'checking',
    microphone: 'checking',
    ready: false
  });
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [jitsiApi, setJitsiApi] = useState<any>(null);
  const [loadingMessage, setLoadingMessage] = useState('Initialisation...');
  const videoRef = useRef<HTMLVideoElement>(null);
  const jitsiContainerRef = useRef<HTMLDivElement>(null);

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  const roomCode = params?.roomCode;

  // Test d'accès aux médias simplifié et forcé
  const testMediaAccess = async () => {
    console.log('=== DÉBUT TEST MÉDIA ===');
    setLoadingMessage('Test d\'accès aux périphériques...');

    try {
      // Stratégie agressive pour forcer l'accès
      const constraints = [
        // Stratégie 1: HD complète
        { video: { width: 1280, height: 720, frameRate: 30 }, audio: true },
        // Stratégie 2: Standard
        { video: { width: 640, height: 480 }, audio: true },
        // Stratégie 3: Basique
        { video: true, audio: true },
        // Stratégie 4: Vidéo seulement
        { video: true, audio: false },
        // Stratégie 5: Audio seulement
        { video: false, audio: true }
      ];

      let mediaStream: MediaStream | null = null;

      for (let i = 0; i < constraints.length; i++) {
        try {
          console.log(`Tentative ${i + 1} avec contraintes:`, constraints[i]);
          mediaStream = await navigator.mediaDevices.getUserMedia(constraints[i]);
          console.log(`✅ Succès avec la stratégie ${i + 1}`);
          break;
        } catch (error) {
          console.log(`❌ Échec stratégie ${i + 1}:`, error);
          if (i === constraints.length - 1) {
            throw error;
          }
        }
      }

      if (mediaStream) {
        setStream(mediaStream);
        
        const videoTracks = mediaStream.getVideoTracks();
        const audioTracks = mediaStream.getAudioTracks();
        
        console.log(`Pistes vidéo: ${videoTracks.length}, Pistes audio: ${audioTracks.length}`);
        
        // Activer explicitement les pistes
        videoTracks.forEach((track, index) => {
          track.enabled = true;
          console.log(`Piste vidéo ${index} activée:`, track.label);
        });
        
        audioTracks.forEach((track, index) => {
          track.enabled = true;
          console.log(`Piste audio ${index} activée:`, track.label);
        });

        setMediaStatus({
          camera: videoTracks.length > 0 ? 'granted' : 'denied',
          microphone: audioTracks.length > 0 ? 'granted' : 'denied',
          ready: true
        });

        // Afficher la prévisualisation
        if (videoRef.current && videoTracks.length > 0) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
          console.log('✅ Prévisualisation vidéo affichée');
        }

        toast({
          title: "Périphériques détectés",
          description: `Caméra: ${videoTracks.length > 0 ? 'Oui' : 'Non'}, Micro: ${audioTracks.length > 0 ? 'Oui' : 'Non'}`,
        });

        return true;
      }
    } catch (error) {
      console.error('❌ Toutes les stratégies d\'accès média ont échoué:', error);
      setMediaStatus({
        camera: 'denied',
        microphone: 'denied',
        ready: true
      });
      
      toast({
        title: "Accès limité aux périphériques",
        description: "Continuez vers Jitsi Meet",
        variant: "destructive"
      });
      
      return false;
    }
  };

  // Initialisation Jitsi simplifiée
  const initializeJitsi = async () => {
    if (!roomCode || !authUser || !jitsiContainerRef.current) {
      console.error('❌ Données manquantes pour Jitsi:', { roomCode, authUser: !!authUser, container: !!jitsiContainerRef.current });
      return;
    }

    console.log('=== DÉBUT INITIALISATION JITSI ===');
    setStep('loading');
    setLoadingMessage('Chargement de Jitsi Meet...');

    try {
      // Nettoyer le container
      jitsiContainerRef.current.innerHTML = '';
      console.log('Container nettoyé');

      // Charger l'API Jitsi
      if (!window.JitsiMeetExternalAPI) {
        console.log('Chargement de l\'API Jitsi...');
        setLoadingMessage('Téléchargement des composants Jitsi...');
        
        const script = document.createElement('script');
        script.src = 'https://meet.jit.si/external_api.js';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
        
        await new Promise((resolve, reject) => {
          script.onload = () => {
            console.log('✅ API Jitsi chargée');
            resolve(true);
          };
          script.onerror = (error) => {
            console.error('❌ Erreur chargement API Jitsi:', error);
            reject(new Error('Échec chargement API Jitsi'));
          };
          
          setTimeout(() => {
            reject(new Error('Timeout chargement API'));
          }, 15000);
        });
      } else {
        console.log('✅ API Jitsi déjà disponible');
      }

      const displayName = authUser.displayName || authUser.username || 'Participant';
      console.log('Nom d\'affichage:', displayName);
      console.log('Code de salle:', roomCode);

      setLoadingMessage('Configuration de la réunion...');

      // Configuration Jitsi minimaliste
      const options = {
        roomName: roomCode,
        width: '100%',
        height: '100%',
        parentNode: jitsiContainerRef.current,
        
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
          enableWelcomePage: false,
          enableClosePage: false,
          disableDeepLinking: true,
          resolution: 720,
          enableP2P: true,
          enableLipSync: true
        },
        
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_BRAND_WATERMARK: false,
          SHOW_POWERED_BY: false,
          PROVIDER_NAME: 'RonyMeet',
          MOBILE_APP_PROMO: false
        },
        
        userInfo: {
          displayName: displayName
        }
      };

      console.log('Configuration Jitsi:', options);
      setLoadingMessage('Création de la réunion...');

      // Créer l'instance Jitsi
      console.log('Création de l\'instance JitsiMeetExternalAPI...');
      const api = new window.JitsiMeetExternalAPI('meet.jit.si', options);
      setJitsiApi(api);
      console.log('✅ Instance Jitsi créée');

      // Event listeners avec logs détaillés
      api.addEventListener('ready', () => {
        console.log('🎉 JITSI EST PRÊT !');
        setStep('meeting');
        setLoadingMessage('');
        
        toast({
          title: "Jitsi Meet prêt",
          description: "Interface chargée avec succès",
        });
      });

      api.addEventListener('videoConferenceJoined', (info: any) => {
        console.log('🎉 RÉUNION REJOINTE:', info);
        toast({
          title: "Réunion rejointe",
          description: "Vous êtes dans la réunion",
        });
      });

      api.addEventListener('videoConferenceLeft', () => {
        console.log('👋 Réunion quittée');
        setLocation('/');
      });

      api.addEventListener('readyToClose', () => {
        console.log('🚪 Prêt à fermer');
        setLocation('/');
      });

      api.addEventListener('error', (error: any) => {
        console.error('❌ ERREUR JITSI:', error);
        toast({
          title: "Erreur Jitsi",
          description: `Erreur: ${error.message || 'Inconnue'}`,
          variant: "destructive"
        });
      });

      api.addEventListener('participantJoined', (participant: any) => {
        console.log('👤 Participant rejoint:', participant.displayName);
      });

      api.addEventListener('participantLeft', (participant: any) => {
        console.log('👤 Participant parti:', participant.displayName);
      });

      // Timeout de sécurité
      setTimeout(() => {
        if (step === 'loading') {
          console.warn('⚠️ Timeout détecté, Jitsi prend trop de temps');
          toast({
            title: "Chargement lent",
            description: "Jitsi prend plus de temps que prévu...",
            variant: "destructive"
          });
        }
      }, 30000);

    } catch (error) {
      console.error('❌ ERREUR INITIALISATION JITSI:', error);
      setStep('media');
      toast({
        title: "Erreur d'initialisation",
        description: `Impossible de démarrer Jitsi: ${error instanceof Error ? error.message : 'Erreur inconnue'}`,
        variant: "destructive"
      });
    }
  };

  const startMeeting = async () => {
    console.log('=== DÉMARRAGE RÉUNION ===');
    await initializeJitsi();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'granted': return <CheckCircle className="h-4 w-4 text-green-400" />;
      case 'denied': return <XCircle className="h-4 w-4 text-red-400" />;
      default: return <div className="animate-spin w-4 h-4 border-2 border-gray-400 border-t-blue-400 rounded-full" />;
    }
  };

  useEffect(() => {
    if (roomCode && authUser) {
      console.log('=== COMPOSANT MONTÉ ===');
      console.log('Room code:', roomCode);
      console.log('User:', authUser);
      testMediaAccess();
    }

    return () => {
      console.log('=== NETTOYAGE COMPOSANT ===');
      if (jitsiApi) {
        try {
          jitsiApi.dispose();
          console.log('✅ API Jitsi nettoyée');
        } catch (e) {
          console.log('⚠️ Erreur nettoyage API:', e);
        }
      }
      if (stream) {
        stream.getTracks().forEach(track => {
          try {
            track.stop();
            console.log('✅ Piste arrêtée:', track.kind);
          } catch (e) {
            console.log('⚠️ Erreur arrêt piste:', e);
          }
        });
      }
    };
  }, [roomCode, authUser]);

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

  // Étape 1: Test des médias
  if (step === 'media') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-4xl w-full bg-gray-800 border-gray-700">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4 text-white">Test des périphériques</h2>
            <p className="text-gray-300">
              Vérification de l'accès à votre caméra et microphone
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Prévisualisation vidéo */}
            <div className="space-y-4">
              <div className="bg-gray-700 rounded-lg overflow-hidden aspect-video relative">
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
                {mediaStatus.camera === 'granted' && (
                  <div className="absolute top-2 right-2 bg-green-500 rounded-full p-1">
                    <Camera className="h-4 w-4 text-white" />
                  </div>
                )}
              </div>
              <div className="text-center text-sm text-gray-400">
                Aperçu de votre caméra
              </div>
            </div>

            {/* Panneau de statut */}
            <div className="space-y-6">
              <div className="bg-gray-700/50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">État des périphériques</h3>
                
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Camera className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-300">Caméra</span>
                    </div>
                    {getStatusIcon(mediaStatus.camera)}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Mic className="h-5 w-5 text-gray-400" />
                      <span className="text-gray-300">Microphone</span>
                    </div>
                    {getStatusIcon(mediaStatus.microphone)}
                  </div>
                </div>
              </div>

              <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
                <p className="text-sm text-blue-300 mb-2">
                  <strong>Salle:</strong> {roomCode}
                </p>
                <p className="text-sm text-blue-300">
                  <strong>Participant:</strong> {authUser?.displayName || authUser?.username}
                </p>
              </div>

              <div className="space-y-3">
                <Button 
                  onClick={startMeeting} 
                  className="w-full"
                  size="lg"
                  disabled={!mediaStatus.ready}
                >
                  <Monitor className="h-4 w-4 mr-2" />
                  Démarrer la réunion
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
        </Card>
      </div>
    );
  }

  // Étape 2: Chargement Jitsi
  if (step === 'loading') {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
        <Card className="p-8 max-w-lg w-full text-center bg-gray-800 border-gray-700">
          <div className="animate-spin w-16 h-16 border-4 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold mb-4 text-white">Chargement de Jitsi Meet</h2>
          <p className="text-gray-300 mb-6">{loadingMessage}</p>
          
          <div className="bg-gray-700/50 rounded-lg p-4 mb-6">
            <p className="text-sm text-gray-300 mb-2">
              <strong>Salle:</strong> {roomCode}
            </p>
            <p className="text-sm text-gray-300">
              <strong>Participant:</strong> {authUser?.displayName || authUser?.username}
            </p>
          </div>

          <Button 
            onClick={() => setLocation('/')} 
            variant="ghost" 
            className="w-full"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Annuler
          </Button>
        </Card>
      </div>
    );
  }

  // Étape 3: Réunion Jitsi
  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h1 className="text-xl font-bold text-white">RonyMeet - {roomCode}</h1>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <div className="flex items-center space-x-1">
              <Camera className="h-4 w-4" />
              {getStatusIcon(mediaStatus.camera)}
            </div>
            <div className="flex items-center space-x-1">
              <Mic className="h-4 w-4" />
              {getStatusIcon(mediaStatus.microphone)}
            </div>
          </div>
        </div>
        
        <Button 
          onClick={() => {
            if (jitsiApi) {
              jitsiApi.dispose();
            }
            setLocation('/');
          }} 
          variant="destructive" 
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Quitter
        </Button>
      </div>

      {/* Container Jitsi */}
      <div className="flex-1 p-4">
        <div 
          ref={jitsiContainerRef} 
          className="w-full h-full bg-gray-800 rounded-lg border border-gray-600"
          style={{ minHeight: 'calc(100vh - 120px)' }}
        >
          {step === 'meeting' && !jitsiApi && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full mx-auto mb-4"></div>
                <p className="text-gray-300">Finalisation du chargement...</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JitsiDirect;