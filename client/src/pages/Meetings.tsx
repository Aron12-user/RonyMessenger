import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  Video, 
  Plus, 
  Users, 
  Clock, 
  Calendar, 
  Settings, 
  Phone,
  Monitor,
  Mic,
  MicOff,
  VideoOff,
  MoreVertical,
  Copy,
  Share2,
  ExternalLink
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface Meeting {
  id: string;
  title: string;
  description?: string;
  roomCode: string;
  participants: number;
  maxParticipants: number;
  startTime: Date;
  endTime?: Date;
  isActive: boolean;
  createdBy: string;
  status: 'scheduled' | 'active' | 'ended';
}

interface ActiveRoom {
  roomCode: string;
  participants: number;
  title: string;
  startTime: Date;
}

export default function Meetings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newMeetingTitle, setNewMeetingTitle] = useState("");
  const [newMeetingDescription, setNewMeetingDescription] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeTab, setActiveTab] = useState("active");

  // Récupérer les réunions actives
  const { data: activeRoomsData, isLoading: loadingActive } = useQuery({
    queryKey: ['/api/meetings/active'],
    enabled: !!user
  });

  // Récupérer les réunions programmées
  const { data: scheduledMeetingsData, isLoading: loadingScheduled } = useQuery({
    queryKey: ['/api/meetings/scheduled'],
    enabled: !!user
  });

  const activeRooms = (activeRoomsData as any)?.rooms || [];
  const scheduledMeetings = (scheduledMeetingsData as any)?.meetings || [];

  // Mutation pour créer une réunion
  const createMeetingMutation = useMutation({
    mutationFn: async (meetingData: { title: string; description?: string; roomCode: string }) => {
      const response = await fetch('/api/meetings/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(meetingData),
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la création de la réunion');
      }
      
      return response.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      toast({
        title: "Réunion créée",
        description: `La réunion "${data.meeting.title}" a été créée avec succès.`
      });
      setShowCreateForm(false);
      setNewMeetingTitle("");
      setNewMeetingDescription("");
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer la réunion",
        variant: "destructive"
      });
    }
  });

  // Générer un code de réunion unique
  const generateRoomCode = () => {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 6);
    return `${timestamp}-${random}`.toUpperCase();
  };

  // Créer une réunion instantanée
  const createInstantMeeting = async () => {
    if (!user) return;
    
    setIsCreating(true);
    try {
      const roomCode = generateRoomCode();
      const meetingUrl = `https://meet.jit.si/${roomCode}`;
      
      // Créer la réunion dans l'API
      await createMeetingMutation.mutateAsync({
        title: "Réunion instantanée",
        roomCode
      });
      
      // Ouvrir Jitsi Meet
      window.open(meetingUrl, '_blank');
      
    } catch (error) {
      console.error('Erreur lors de la création de la réunion:', error);
    } finally {
      setIsCreating(false);
    }
  };

  // Créer une réunion programmée
  const createScheduledMeeting = async () => {
    if (!newMeetingTitle.trim()) {
      toast({
        title: "Erreur",
        description: "Le titre de la réunion est requis",
        variant: "destructive"
      });
      return;
    }

    const roomCode = generateRoomCode();
    await createMeetingMutation.mutateAsync({
      title: newMeetingTitle,
      description: newMeetingDescription,
      roomCode
    });
  };

  // Rejoindre une réunion
  const joinMeeting = (roomCode: string) => {
    const meetingUrl = `https://meet.jit.si/${roomCode}`;
    window.open(meetingUrl, '_blank');
  };

  // Copier le lien de la réunion
  const copyMeetingLink = (roomCode: string) => {
    const meetingUrl = `https://meet.jit.si/${roomCode}`;
    navigator.clipboard.writeText(meetingUrl);
    toast({
      title: "Lien copié",
      description: "Le lien de la réunion a été copié dans le presse-papiers"
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* En-tête */}
      <div className="flex items-center justify-between p-6 border-b">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Video className="h-6 w-6" />
            Réunions
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez vos réunions et visioconférences
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={createInstantMeeting}
            disabled={isCreating}
            className="flex items-center gap-2"
          >
            <Video className="h-4 w-4" />
            {isCreating ? "Création..." : "Réunion instantanée"}
          </Button>
          
          <Button
            variant="outline"
            onClick={() => setShowCreateForm(!showCreateForm)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Programmer
          </Button>
        </div>
      </div>

      {/* Formulaire de création */}
      {showCreateForm && (
        <div className="p-6 border-b bg-muted/50">
          <Card>
            <CardHeader>
              <CardTitle>Programmer une réunion</CardTitle>
              <CardDescription>
                Créez une nouvelle réunion programmée
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Titre de la réunion</Label>
                <Input
                  id="title"
                  value={newMeetingTitle}
                  onChange={(e) => setNewMeetingTitle(e.target.value)}
                  placeholder="Entrez le titre de la réunion"
                />
              </div>
              
              <div>
                <Label htmlFor="description">Description (optionnelle)</Label>
                <Input
                  id="description"
                  value={newMeetingDescription}
                  onChange={(e) => setNewMeetingDescription(e.target.value)}
                  placeholder="Description de la réunion"
                />
              </div>
              
              <div className="flex items-center gap-2">
                <Button
                  onClick={createScheduledMeeting}
                  disabled={createMeetingMutation.isPending}
                >
                  {createMeetingMutation.isPending ? "Création..." : "Créer la réunion"}
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
        </div>
      )}

      {/* Contenu principal avec onglets */}
      <div className="flex-1 p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="active">Réunions actives</TabsTrigger>
            <TabsTrigger value="scheduled">Réunions programmées</TabsTrigger>
          </TabsList>
          
          <TabsContent value="active" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Réunions en cours</h2>
              <Badge variant="secondary">
                {activeRooms.length} active{activeRooms.length > 1 ? 's' : ''}
              </Badge>
            </div>
            
            {loadingActive ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-10 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : activeRooms.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Video className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune réunion active</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Créez une réunion instantanée ou programmez une nouvelle réunion
                  </p>
                  <Button onClick={createInstantMeeting} disabled={isCreating}>
                    <Video className="h-4 w-4 mr-2" />
                    Créer une réunion
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {activeRooms.map((room: ActiveRoom) => (
                  <Card key={room.roomCode} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{room.title}</CardTitle>
                        <Badge className="bg-green-100 text-green-800">En cours</Badge>
                      </div>
                      <CardDescription className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        {room.participants} participant{room.participants > 1 ? 's' : ''}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Commencée à {new Date(room.startTime).toLocaleTimeString()}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => joinMeeting(room.roomCode)}
                          className="flex-1"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Rejoindre
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyMeetingLink(room.roomCode)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          
          <TabsContent value="scheduled" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Réunions programmées</h2>
              <Badge variant="secondary">
                {scheduledMeetings.length} programmée{scheduledMeetings.length > 1 ? 's' : ''}
              </Badge>
            </div>
            
            {loadingScheduled ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader className="pb-3">
                      <div className="h-4 bg-muted rounded w-3/4"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-10 bg-muted rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : scheduledMeetings.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune réunion programmée</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Programmez votre première réunion pour commencer
                  </p>
                  <Button onClick={() => setShowCreateForm(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Programmer une réunion
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {scheduledMeetings.map((meeting: Meeting) => (
                  <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">{meeting.title}</CardTitle>
                        <Badge variant="outline">{meeting.status}</Badge>
                      </div>
                      {meeting.description && (
                        <CardDescription>{meeting.description}</CardDescription>
                      )}
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {new Date(meeting.startTime).toLocaleDateString()} à{' '}
                        {new Date(meeting.startTime).toLocaleTimeString()}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Button
                          onClick={() => joinMeeting(meeting.roomCode)}
                          className="flex-1"
                        >
                          <Video className="h-4 w-4 mr-2" />
                          Démarrer
                        </Button>
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={() => copyMeetingLink(meeting.roomCode)}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}