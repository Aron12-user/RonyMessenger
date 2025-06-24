import { useState } from "react";
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
  Copy,
  ExternalLink,
  Play,
  Pause,
  MoreVertical,
  UserPlus,
  Settings
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import EmptyState from "@/components/EmptyState";

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
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);
  const [showScheduleForm, setShowScheduleForm] = useState(false);

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
    mutationFn: async (meetingData: { title: string; roomCode: string }) => {
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
      roomCode
    });
    setNewMeetingTitle("");
    setShowScheduleForm(false);
  };

  // Rejoindre une réunion avec un code
  const joinMeetingWithCode = () => {
    if (!joinCode.trim()) {
      toast({
        title: "Erreur",
        description: "Veuillez entrer un code de réunion",
        variant: "destructive"
      });
      return;
    }

    const meetingUrl = `https://meet.jit.si/${joinCode}`;
    window.open(meetingUrl, '_blank');
    setJoinCode("");
    setShowJoinDialog(false);
    
    toast({
      title: "Rejoindre la réunion",
      description: "Ouverture de la réunion dans un nouvel onglet"
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
    <div className="flex-1 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-white dark:bg-gray-900">
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Réunions</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Gérez vos réunions et visioconférences
            </p>
          </div>
          <div className="flex gap-3">
            <Dialog open={showJoinDialog} onOpenChange={setShowJoinDialog}>
              <DialogTrigger asChild>
                <Button variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Rejoindre
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Rejoindre une réunion</DialogTitle>
                  <DialogDescription>
                    Entrez le code de la réunion pour la rejoindre
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="joinCode">Code de réunion</Label>
                    <Input
                      id="joinCode"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value)}
                      placeholder="Entrez le code de réunion"
                      onKeyPress={(e) => e.key === 'Enter' && joinMeetingWithCode()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={joinMeetingWithCode} className="flex-1">
                      <Video className="h-4 w-4 mr-2" />
                      Rejoindre
                    </Button>
                    <Button variant="outline" onClick={() => setShowJoinDialog(false)}>
                      Annuler
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>

            <Button 
              onClick={createInstantMeeting}
              disabled={isCreating}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Video className="h-4 w-4 mr-2" />
              {isCreating ? "Création..." : "Nouvelle réunion"}
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto">
          <Tabs defaultValue="active" className="h-full">
            <div className="border-b px-6">
              <TabsList className="h-10">
                <TabsTrigger value="active" className="text-sm">
                  Réunions actives
                </TabsTrigger>
                <TabsTrigger value="scheduled" className="text-sm">
                  Réunions programmées
                </TabsTrigger>
                <TabsTrigger value="schedule" className="text-sm">
                  Programmer une Réunion
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="active" className="p-6 space-y-6 h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Réunions en cours</h2>
                <Badge variant="secondary" className="text-xs">
                  {activeRooms.length} active{activeRooms.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {loadingActive ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                        <div className="h-9 bg-gray-200 rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : activeRooms.length === 0 ? (
                <EmptyState
                  title="Aucune réunion active"
                  description="Créez une nouvelle réunion pour commencer"
                  action={{
                    label: "Nouvelle réunion",
                    onClick: createInstantMeeting
                  }}
                />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {activeRooms.map((room: ActiveRoom) => (
                    <Card key={room.roomCode} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {room.title}
                            </h3>
                            <div className="flex items-center text-sm text-gray-500 mt-1">
                              <Users className="h-4 w-4 mr-1" />
                              {room.participants} participant{room.participants !== 1 ? 's' : ''}
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800 text-xs">
                            En cours
                          </Badge>
                        </div>

                        <div className="flex items-center text-sm text-gray-500 mb-4">
                          <Clock className="h-4 w-4 mr-1" />
                          Commencée à {new Date(room.startTime).toLocaleTimeString()}
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => joinMeeting(room.roomCode)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
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

            <TabsContent value="scheduled" className="p-6 space-y-6 h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Réunions programmées</h2>
                <Badge variant="secondary" className="text-xs">
                  {scheduledMeetings.length} programmée{scheduledMeetings.length !== 1 ? 's' : ''}
                </Badge>
              </div>

              {loadingScheduled ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="animate-pulse">
                      <CardContent className="p-6">
                        <div className="h-4 bg-gray-200 rounded mb-2"></div>
                        <div className="h-3 bg-gray-200 rounded w-2/3 mb-4"></div>
                        <div className="h-9 bg-gray-200 rounded"></div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : scheduledMeetings.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Calendar className="h-16 w-16 text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Aucune réunion programmée
                  </h3>
                  <p className="text-gray-500 text-center mb-6 max-w-md">
                    Vous n'avez pas encore de réunions programmées. Créez votre première réunion pour commencer.
                  </p>
                  <Button onClick={createInstantMeeting}>
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle réunion
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {scheduledMeetings.map((meeting: Meeting) => (
                    <Card key={meeting.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="font-medium text-gray-900 dark:text-white">
                              {meeting.title}
                            </h3>
                            {meeting.description && (
                              <p className="text-sm text-gray-500 mt-1">
                                {meeting.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs">
                            {meeting.status}
                          </Badge>
                        </div>

                        <div className="flex items-center text-sm text-gray-500 mb-4">
                          <Calendar className="h-4 w-4 mr-1" />
                          {new Date(meeting.startTime).toLocaleDateString()} à{' '}
                          {new Date(meeting.startTime).toLocaleTimeString()}
                        </div>

                        <div className="flex gap-2">
                          <Button 
                            onClick={() => joinMeeting(meeting.roomCode)}
                            className="flex-1 bg-blue-600 hover:bg-blue-700"
                          >
                            <Play className="h-4 w-4 mr-2" />
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

            <TabsContent value="schedule" className="p-6 space-y-6 h-full">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-medium">Programmer une nouvelle réunion</h2>
                <Badge variant="secondary" className="text-xs">
                  <Calendar className="h-3 w-3 mr-1" />
                  Planification
                </Badge>
              </div>

              <Card className="max-w-2xl">
                <CardContent className="p-6">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-lg font-semibold mb-4">Détails de la réunion</h3>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="meetingTitle">Titre de la réunion *</Label>
                          <Input
                            id="meetingTitle"
                            value={newMeetingTitle}
                            onChange={(e) => setNewMeetingTitle(e.target.value)}
                            placeholder="Ex: Réunion équipe projet..."
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="border-t pt-6">
                      <h4 className="font-medium mb-3 flex items-center">
                        <Settings className="h-4 w-4 mr-2" />
                        Code de réunion
                      </h4>
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Un code unique sera généré automatiquement pour cette réunion.
                        </p>
                        <p className="text-sm font-medium text-blue-600">
                          Les participants pourront rejoindre avec ce code via le bouton "Rejoindre"
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4 border-t">
                      <Button 
                        onClick={createScheduledMeeting}
                        disabled={createMeetingMutation.isPending || !newMeetingTitle.trim()}
                        className="flex-1 bg-blue-600 hover:bg-blue-700"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        {createMeetingMutation.isPending ? "Création..." : "Programmer la réunion"}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => setNewMeetingTitle("")}
                        disabled={createMeetingMutation.isPending}
                      >
                        Effacer
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 max-w-2xl">
                <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                  Comment ça fonctionne ?
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                  <li>• Un code unique est généré automatiquement</li>
                  <li>• Partagez ce code avec les participants</li>
                  <li>• Les participants utilisent le bouton "Rejoindre" avec le code</li>
                  <li>• La réunion s'ouvre directement dans Jitsi Meet</li>
                </ul>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}