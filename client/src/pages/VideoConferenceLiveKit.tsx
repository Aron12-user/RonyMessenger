import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import type { User } from "@shared/schema";
import { 
  Mic, MicOff, Video, VideoOff, PhoneOff, Users, Share2,
  Maximize2, Minimize2, X, Crown, Settings, MessageSquare,
  Monitor, AlertCircle, Loader2, Copy, Camera, Volume2
} from "lucide-react";
import { 
  Room, 
  RoomEvent, 
  Track, 
  LocalTrack, 
  RemoteTrack,
  LocalVideoTrack, 
  LocalAudioTrack,
  RemoteVideoTrack,
  RemoteAudioTrack,
  Participant,
  ParticipantEvent,
  TrackEvent,
  VideoPresets,
  AudioPresets,
  RoomOptions,
  TrackPublication,
  createLocalVideoTrack,
  createLocalAudioTrack,
  createLocalScreenTracks
} from 'livekit-client';

interface ParticipantInfo {
  participant: Participant;
  videoTrack?: RemoteVideoTrack | LocalVideoTrack;
  audioTrack?: RemoteAudioTrack | LocalAudioTrack;
  isLocal: boolean;
}

const VideoConferenceLiveKit: React.FC = () => {
  const [location, setLocation] = useLocation();
  const [match, params] = useRoute("/meeting/:roomCode");
  const { toast } = useToast();

  const { data: authUser } = useQuery<User>({
    queryKey: ['/api/user'],
  });

  // États de connexion
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<ParticipantInfo[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string>('');

  // États des contrôles
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [showParticipants, setShowParticipants] = useState(true);

  // Refs pour les éléments vidéo
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const roomCode = params?.roomCode;

  // Configuration LiveKit optimisée
  const roomOptions: RoomOptions = {
    adaptiveStream: true,
    dynacast: true,
    videoCaptureDefaults: {
      resolution: VideoPresets.h720.resolution,
      frameRate: 30,
    },
    audioCaptureDefaults: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    publishDefaults: {
      videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360, VideoPresets.h720],
    },
  };

  // Fonction pour obtenir le token d'accès
  const getAccessToken = async (): Promise<{token: string, wsUrl: string}> => {
    try {
      const response = await fetch('/api/livekit/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomName: roomCode,
          isAdmin: true // Premier utilisateur est admin
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return { token: data.token, wsUrl: data.wsUrl };
    } catch (error: any) {
      console.error('Erreur obtention token:', error);
      throw new Error(`Impossible d'obtenir le token d'accès: ${error.message}`);
    }
  };

  // Connexion à la salle LiveKit
  const connectToRoom = useCallback(async () => {
    if (!roomCode || !authUser) return;

    setIsConnecting(true);
    setConnectionError('');

    try {
      console.log('Connexion à la salle LiveKit:', roomCode);

      // Obtenir le token d'accès
      const { token, wsUrl } = await getAccessToken();
      console.log('Token obtenu, connexion à:', wsUrl);

      // Créer la room
      const newRoom = new Room(roomOptions);

      // Configuration des événements
      newRoom.on(RoomEvent.Connected, () => {
        console.log('Connecté à la salle LiveKit');
        setIsConnected(true);
        setIsConnecting(false);
        toast({
          title: "Connexion réussie",
          description: "Connecté au serveur de vidéoconférence"
        });
      });

      newRoom.on(RoomEvent.Disconnected, (reason) => {
        console.log('Déconnecté de la salle:', reason);
        setIsConnected(false);
        toast({
          title: "Déconnexion",
          description: "Connexion fermée"
        });
      });

      newRoom.on(RoomEvent.ParticipantConnected, (participant) => {
        console.log('Participant connecté:', participant.identity);
        updateParticipants(newRoom);
        toast({
          title: "Nouveau participant",
          description: `${participant.name || participant.identity} a rejoint`
        });
      });

      newRoom.on(RoomEvent.ParticipantDisconnected, (participant) => {
        console.log('Participant déconnecté:', participant.identity);
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackPublished, (publication, participant) => {
        console.log('Track publié:', publication.trackSid, participant.identity);
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnpublished, (publication, participant) => {
        console.log('Track dépublié:', publication.trackSid, participant.identity);
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackSubscribed, (track, publication, participant) => {
        console.log('Track souscrit:', track.kind, participant.identity);
        attachTrackToElement(track, participant);
        updateParticipants(newRoom);
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication, participant) => {
        console.log('Track désouscrit:', track.kind, participant.identity);
        track.detach();
        updateParticipants(newRoom);
      });

      // Connexion à la salle
      await newRoom.connect(wsUrl, token);
      setRoom(newRoom);

      // Publier les pistes locales
      await publishLocalTracks(newRoom);

    } catch (error: any) {
      console.error('Erreur connexion:', error);
      setConnectionError(error.message);
      setIsConnecting(false);
      toast({
        title: "Erreur de connexion",
        description: error.message,
        variant: "destructive"
      });
    }
  }, [roomCode, authUser, toast]);

  // Publier les pistes audio/vidéo locales
  const publishLocalTracks = async (room: Room) => {
    try {
      // Créer les pistes locales
      const videoTrack = await LocalVideoTrack.createCameraTrack({
        resolution: VideoPresets.h720.resolution,
        frameRate: 30,
      });

      const audioTrack = await LocalAudioTrack.createMicrophoneTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      // Publier les pistes
      await room.localParticipant.publishTrack(videoTrack);
      await room.localParticipant.publishTrack(audioTrack);

      // Attacher la vidéo locale
      if (localVideoRef.current) {
        videoTrack.attach(localVideoRef.current);
      }

      console.log('Pistes locales publiées');
      updateParticipants(room);

    } catch (error: any) {
      console.error('Erreur publication pistes:', error);
      
      // Fallback: essayer avec vidéo seulement
      try {
        const videoTrack = await LocalVideoTrack.createCameraTrack();
        await room.localParticipant.publishTrack(videoTrack);
        
        if (localVideoRef.current) {
          videoTrack.attach(localVideoRef.current);
        }
        
        setIsMuted(true);
        toast({
          title: "Microphone indisponible",
          description: "Mode vidéo seulement activé"
        });
        
      } catch (videoError: any) {
        console.error('Erreur vidéo:', videoError);
        toast({
          title: "Erreur média",
          description: "Impossible d'accéder à la caméra",
          variant: "destructive"
        });
      }
    }
  };

  // Attacher une piste à un élément vidéo
  const attachTrackToElement = (track: Track, participant: Participant) => {
    if (track.kind === Track.Kind.Video) {
      const videoElement = remoteVideoRefs.current.get(participant.identity);
      if (videoElement) {
        track.attach(videoElement);
      }
    }
  };

  // Mettre à jour la liste des participants
  const updateParticipants = (room: Room) => {
    const participantInfos: ParticipantInfo[] = [];

    // Participant local
    const localParticipant = room.localParticipant;
    participantInfos.push({
      participant: localParticipant,
      videoTrack: localParticipant.getTrack(Track.Source.Camera)?.videoTrack as LocalVideoTrack,
      audioTrack: localParticipant.getTrack(Track.Source.Microphone)?.audioTrack as LocalAudioTrack,
      isLocal: true
    });

    // Participants distants
    room.remoteParticipants.forEach((participant) => {
      participantInfos.push({
        participant,
        videoTrack: participant.getTrack(Track.Source.Camera)?.videoTrack as RemoteVideoTrack,
        audioTrack: participant.getTrack(Track.Source.Microphone)?.audioTrack as RemoteAudioTrack,
        isLocal: false
      });
    });

    setParticipants(participantInfos);
  };

  // Contrôles média
  const toggleMute = async () => {
    if (!room) return;

    const audioTrack = room.localParticipant.getTrack(Track.Source.Microphone);
    if (audioTrack) {
      await audioTrack.setMuted(!isMuted);
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = async () => {
    if (!room) return;

    const videoTrack = room.localParticipant.getTrack(Track.Source.Camera);
    if (videoTrack) {
      await videoTrack.setMuted(isVideoOn);
      setIsVideoOn(!isVideoOn);
    }
  };

  const shareScreen = async () => {
    if (!room) return;

    try {
      if (!isScreenSharing) {
        const screenTrack = await LocalVideoTrack.createScreenShareTrack();
        await room.localParticipant.publishTrack(screenTrack);
        setIsScreenSharing(true);
        
        screenTrack.on(TrackEvent.Ended, () => {
          setIsScreenSharing(false);
        });
        
        toast({ title: "Partage d'écran démarré" });
      } else {
        const screenTrack = room.localParticipant.getTrack(Track.Source.ScreenShare);
        if (screenTrack) {
          await room.localParticipant.unpublishTrack(screenTrack.track!);
          setIsScreenSharing(false);
        }
      }
    } catch (error: any) {
      console.error('Erreur partage écran:', error);
      toast({
        title: "Erreur partage d'écran",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const leaveRoom = async () => {
    if (room) {
      room.disconnect();
      setRoom(null);
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

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode || '');
    toast({ title: "Code de réunion copié" });
  };

  // Initialisation
  useEffect(() => {
    if (roomCode && authUser && !room) {
      connectToRoom();
    }

    return () => {
      if (room) {
        room.disconnect();
      }
    };
  }, [roomCode, authUser, connectToRoom]);

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
          <h2 className="text-2xl font-bold mb-4">Code manquant</h2>
          <p className="text-gray-600 mb-6">Code de réunion requis</p>
          <Button onClick={() => setLocation('/')} className="w-full">
            Retour
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
            <Button onClick={connectToRoom} className="w-full">
              Réessayer
            </Button>
            <Button onClick={() => setLocation('/')} variant="outline" className="w-full">
              Retour
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (isConnecting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="h-16 w-16 animate-spin text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Connexion...</h2>
          <p className="text-gray-600">Initialisation de la vidéoconférence</p>
        </Card>
      </div>
    );
  }

  // Interface principale
  return (
    <div className={`h-screen bg-gray-900 text-white flex flex-col ${
      isMinimized ? 'fixed bottom-4 right-4 w-96 h-64 z-50 rounded-lg overflow-hidden shadow-2xl' : ''
    } ${isFullscreen ? 'fixed inset-0 z-50' : ''}`}>
      
      {/* Barre de titre */}
      <div className="bg-gray-800 px-4 py-3 flex items-center justify-between border-b border-gray-700 flex-shrink-0">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <h1 className="font-semibold">Vidéoconférence Autonome</h1>
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
            {participants.length} participant{participants.length > 1 ? 's' : ''}
          </Badge>
          
          <Badge variant="outline" className="bg-green-600/20 border-green-600 text-green-200">
            Illimité
          </Badge>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button variant="ghost" size="sm" onClick={toggleFullscreen}>
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setIsMinimized(!isMinimized)}>
            <Minimize2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={leaveRoom} className="text-red-400">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        
        {/* Zone vidéo principale */}
        <div className="flex-1 flex flex-col">
          
          {/* Grille vidéo */}
          <div className="flex-1 bg-black p-4">
            <div className="h-full grid gap-4" style={{
              gridTemplateColumns: participants.length <= 1 ? '1fr' : 
                                 participants.length <= 2 ? 'repeat(2, 1fr)' :
                                 participants.length <= 4 ? 'repeat(2, 1fr)' :
                                 'repeat(3, 1fr)'
            }}>
              
              {participants.map((participantInfo, index) => {
                const { participant, videoTrack, isLocal } = participantInfo;
                const participantId = participant.identity;
                
                return (
                  <div key={participantId} className={`relative bg-gray-800 rounded-lg overflow-hidden border-2 ${
                    isLocal ? 'border-blue-500' : 'border-gray-600'
                  }`}>
                    
                    <video
                      ref={isLocal ? localVideoRef : (el) => {
                        if (el) {
                          remoteVideoRefs.current.set(participantId, el);
                          if (videoTrack) {
                            videoTrack.attach(el);
                          }
                        }
                      }}
                      autoPlay
                      muted={isLocal}
                      playsInline
                      className="w-full h-full object-cover"
                    />
                    
                    <div className="absolute bottom-3 left-3 bg-black/70 px-3 py-1 rounded-full text-sm font-medium">
                      <div className="flex items-center space-x-2">
                        <span>{isLocal ? 'Vous' : (participant.name || participant.identity)}</span>
                        {participant.isMicrophoneEnabled ? 
                          <Mic className="h-4 w-4 text-green-400" /> : 
                          <MicOff className="h-4 w-4 text-red-400" />
                        }
                      </div>
                    </div>
                    
                    {!participant.isCameraEnabled && (
                      <div className="absolute inset-0 bg-gray-700 flex items-center justify-center">
                        <Avatar className="w-24 h-24">
                          <AvatarFallback className="text-3xl bg-blue-600">
                            {(participant.name || participant.identity).charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Contrôles */}
          <div className="bg-gray-800 px-6 py-4 border-t border-gray-700 flex-shrink-0">
            <div className="flex items-center justify-center space-x-6">
              
              <Button
                variant={isMuted ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleMute}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={!isVideoOn ? "destructive" : "secondary"}
                size="lg"
                onClick={toggleVideo}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                {isVideoOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
              </Button>
              
              <Button
                variant={isScreenSharing ? "default" : "secondary"}
                size="lg"
                onClick={shareScreen}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                <Share2 className="h-6 w-6" />
              </Button>
              
              <Button
                variant="secondary"
                size="lg"
                onClick={() => setShowParticipants(!showParticipants)}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                <Users className="h-6 w-6" />
              </Button>
              
              <Button
                variant="destructive"
                size="lg"
                onClick={leaveRoom}
                className="rounded-full w-14 h-14 hover:scale-110 transition-transform"
              >
                <PhoneOff className="h-6 w-6" />
              </Button>
              
            </div>
          </div>
        </div>

        {/* Panneau participants */}
        {showParticipants && !isMinimized && (
          <div className="w-80 bg-gray-800 border-l border-gray-700 flex flex-col">
            
            <div className="p-4 border-b border-gray-700 flex-shrink-0">
              <h3 className="font-semibold text-lg">Participants</h3>
              <p className="text-sm text-gray-400">{participants.length} connecté{participants.length > 1 ? 's' : ''}</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              
              {participants.map((participantInfo) => {
                const { participant, isLocal } = participantInfo;
                
                return (
                  <div key={participant.identity} className={`flex items-center space-x-3 p-3 rounded-lg ${
                    isLocal ? 'bg-blue-600/20' : 'hover:bg-gray-700'
                  } transition-colors`}>
                    <Avatar className="w-10 h-10">
                      <AvatarFallback className={isLocal ? "bg-blue-600" : "bg-green-600"}>
                        {(participant.name || participant.identity).charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1">
                      <p className="font-medium">
                        {isLocal ? 'Vous' : (participant.name || participant.identity)}
                      </p>
                      <p className="text-xs text-gray-400">
                        {isLocal ? 'Organisateur' : 'Participant'}
                      </p>
                    </div>
                    
                    <div className="flex items-center space-x-1">
                      {isLocal && <Crown className="w-4 h-4 text-yellow-400" />}
                      {participant.isMicrophoneEnabled ? 
                        <Mic className="w-4 h-4 text-green-400" /> : 
                        <MicOff className="w-4 h-4 text-red-400" />
                      }
                    </div>
                  </div>
                );
              })}
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default VideoConferenceLiveKit;