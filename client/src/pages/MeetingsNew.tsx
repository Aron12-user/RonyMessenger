import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Video, Plus, Users, Clock, Calendar, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";

interface Meeting {
  id: string;
  title: string;
  description?: string;
  roomCode: string;
  participants: number;
  maxParticipants: number;
  startTime: Date;
  isActive: boolean;
  createdBy: string;
}

export default function MeetingsNew() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Générer un code de réunion aléatoire
  const generateRoomCode = () => {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  // Créer une nouvelle réunion instantanée
  const createInstantMeeting = async () => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      const roomCode = `instant-${Date.now()}-${generateRoomCode()}`;
      const meetingUrl = `https://meet.jit.si/${roomCode}`;
      
      // Ouvrir Jitsi Meet dans un nouvel onglet
      window.open(meetingUrl, '_blank');
      
      toast({
        title: "Réunion créée",
        description: `Code de la réunion: ${roomCode}`,
      });
      
      // Ajouter à la liste des réunions actives
      const newMeeting: Meeting = {
        id: roomCode,
        title: newMeetingTitle || "Réunion instantanée",
        roomCode,
        participants: 0,
        maxParticipants: 50,
        startTime: new Date(),
        isActive: true,
        createdBy: user.displayName || user.username
      };
      
      setMeetings(prev => [newMeeting, ...prev]);
      setNewMeetingTitle("");
      setShowCreateForm(false);
      
    } catch (error) {
      console.error('Erreur lors de la création de la réunion:', error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la réunion",
        variant: "destructive"
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Rejoindre une réunion existante
  const joinMeeting = (roomCode: string) => {
    const meetingUrl = `https://meet.jit.si/${roomCode}`;
    window.open(meetingUrl, '_blank');
    
    toast({
      title: "Rejoindre la réunion",
      description: `Redirection vers ${roomCode}`,
    });
  };

  // Charger les réunions actives (simulation)
  useEffect(() => {
    // Simulation de réunions actives
    const mockMeetings: Meeting[] = [
      {
        id: "demo-1",
        title: "Réunion d'équipe hebdomadaire",
        description: "Point hebdomadaire sur les projets en cours",
        roomCode: "TEAM-WEEKLY",
        participants: 3,
        maxParticipants: 10,
        startTime: new Date(Date.now() - 1000 * 60 * 30), // Il y a 30 minutes
        isActive: true,
        createdBy: "Manager"
      }
    ];
    
    setMeetings(mockMeetings);
  }, []);

  return (
    <div className="flex-1 p-6 space-y-6">
      {/* En-tête */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Réunions</h1>
          <p className="text-gray-600 dark:text-gray-400">Créez et rejoignez des réunions vidéo</p>
        </div>
        <Button 
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Nouvelle réunion
        </Button>
      </div>

      {/* Formulaire de création rapide */}
      {showCreateForm && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              Créer une réunion
            </CardTitle>
            <CardDescription>
              Créez une réunion instantanée avec Jitsi Meet
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Titre de la réunion (optionnel)</Label>
              <Input
                id="title"
                placeholder="Ex: Réunion d'équipe"
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={createInstantMeeting}
                disabled={isCreating}
                className="flex items-center gap-2"
              >
                <Video className="h-4 w-4" />
                {isCreating ? "Création..." : "Créer et rejoindre"}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
              >
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Liste des réunions actives */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Réunions actives
          </CardTitle>
          <CardDescription>
            Rejoignez une réunion en cours ou créez-en une nouvelle
          </CardDescription>
        </CardHeader>
        <CardContent>
          {meetings.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              <Video className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Aucune réunion active</p>
              <p className="text-sm">Créez votre première réunion pour commencer</p>
            </div>
          ) : (
            <div className="space-y-4">
              {meetings.map((meeting) => (
                <div 
                  key={meeting.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {meeting.title}
                      </h3>
                      {meeting.isActive && (
                        <Badge variant="default" className="bg-green-500">
                          En cours
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {meeting.participants}/{meeting.maxParticipants}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {meeting.startTime.toLocaleTimeString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {meeting.createdBy}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                      Code: {meeting.roomCode}
                    </p>
                  </div>
                  <Button 
                    onClick={() => joinMeeting(meeting.roomCode)}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Rejoindre
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section d'aide */}
      <Card>
        <CardHeader>
          <CardTitle>À propos des réunions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
            <p>• Les réunions utilisent Jitsi Meet, une solution de visioconférence gratuite et sécurisée</p>
            <p>• Aucune installation requise - fonctionne directement dans votre navigateur</p>
            <p>• Partagez le code de la réunion avec vos participants</p>
            <p>• Jusqu'à 50 participants par réunion</p>
            <p>• Fonctionnalités: vidéo, audio, partage d'écran, chat</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}