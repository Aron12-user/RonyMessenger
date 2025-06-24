import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Settings,
  Trash2,
  CalendarDays,
  MapPin,
  FileText,
  Globe
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
  const [newMeetingDescription, setNewMeetingDescription] = useState("");
  const [newMeetingDate, setNewMeetingDate] = useState("");
  const [newMeetingTime, setNewMeetingTime] = useState("");
  const [newMeetingDuration, setNewMeetingDuration] = useState("60");
  const [isCreating, setIsCreating] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoinDialog, setShowJoinDialog] = useState(false);

  // Récupérer les réunions actives avec refetch automatique
  const { data: activeRoomsData, isLoading: loadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['/api/meetings/active'],
    enabled: !!user,
    refetchInterval: 5000, // Refetch automatique toutes les 5 secondes
    staleTime: 0 // Considérer les données comme obsolètes immédiatement
  });

  // Récupérer les réunions programmées avec refetch immédiat
  const { data: scheduledMeetingsData, isLoading: loadingScheduled, refetch: refetchScheduled } = useQuery({
    queryKey: ['/api/meetings/scheduled'],
    enabled: !!user,
    refetchInterval: 2000, // Refetch automatique toutes les 2 secondes
    staleTime: 0, // Considérer les données comme obsolètes immédiatement
    cacheTime: 0, // Ne pas garder de cache
    refetchOnWindowFocus: true // Refetch quand la fenêtre reprend le focus
  });

  const activeRooms = (activeRoomsData as any)?.rooms || [];
  const scheduledMeetings = (scheduledMeetingsData as any)?.meetings || [];

  // Mutation pour créer une réunion
  const createMeetingMutation = useMutation({
    mutationFn: async (meetingData: { 
      title: string; 
      description?: string; 
      roomCode: string; 
      startTime?: string; 
      duration?: number; 
    }) => {
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
      // Mise à jour optimiste immédiate du cache local
      queryClient.setQueryData(['/api/meetings/scheduled'], (oldData: any) => {
        if (!oldData) return { success: true, meetings: [data.meeting] };
        return {
          ...oldData,
          meetings: [data.meeting, ...oldData.meetings]
        };
      });
      
      // Invalider et refetch pour garantir la synchronisation
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/active'] });
      
      // Forcer un refetch immédiat
      setTimeout(() => {
        refetchScheduled();
        refetchActive();
      }, 100);
      
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

    if (!newMeetingDate || !newMeetingTime) {
      toast({
        title: "Erreur",
        description: "La date et l'heure sont requises",
        variant: "destructive"
      });
      return;
    }

    const roomCode = generateRoomCode();
    const startDateTime = new Date(`${newMeetingDate}T${newMeetingTime}`);
    
    await createMeetingMutation.mutateAsync({
      title: newMeetingTitle,
      description: newMeetingDescription,
      roomCode,
      startTime: startDateTime.toISOString(),
      duration: parseInt(newMeetingDuration)
    });
    
    // Reset form et rediriger vers l'onglet programmées
    setNewMeetingTitle("");
    setNewMeetingDescription("");
    setNewMeetingDate("");
    setNewMeetingTime("");
    setNewMeetingDuration("60");
  };

  // Mutation pour supprimer une réunion
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        throw new Error('Erreur lors de la suppression de la réunion');
      }
      
      return response.json();
    },
    onSuccess: () => {
      // Invalider et refetch immédiat pour mise à jour instantanée
      queryClient.invalidateQueries({ queryKey: ['/api/meetings'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/active'] });
      refetchScheduled();
      refetchActive();
      
      toast({
        title: "Réunion supprimée",
        description: "La réunion a été supprimée avec succès"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de supprimer la réunion",
        variant: "destructive"
      });
    }
  });

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

  // Supprimer une réunion programmée
  const deleteMeeting = (meetingId: string) => {
    deleteMeetingMutation.mutate(meetingId);
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

            <TabsContent value="scheduled" className="h-full">
              <div className="p-6 pb-2">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Réunions programmées</h2>
                  <Badge variant="secondary" className="text-xs">
                    {scheduledMeetings.length} programmée{scheduledMeetings.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              <ScrollArea className="h-[calc(100%-5rem)] px-6">
                <div className="pb-6">
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
                        Vous n'avez pas encore de réunions programmées. Utilisez l'onglet "Programmer une Réunion" pour commencer.
                      </p>
                      <Button onClick={createInstantMeeting}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle réunion
                      </Button>
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {scheduledMeetings.map((meeting: Meeting) => (
                        <Card key={meeting.id} className="hover:shadow-lg transition-all duration-200 border border-gray-200 dark:border-gray-700">
                          <CardContent className="p-6">
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1 truncate">
                                  {meeting.title}
                                </h3>
                                {meeting.description && (
                                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-2">
                                    {meeting.description}
                                  </p>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs ml-2 shrink-0">
                                {meeting.status}
                              </Badge>
                            </div>

                            <div className="space-y-3 mb-4">
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                                <span className="font-medium">
                                  {new Date(meeting.startTime).toLocaleDateString('fr-FR', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                  })}
                                </span>
                              </div>
                              
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Clock className="h-4 w-4 mr-2 text-green-600" />
                                <span>
                                  {new Date(meeting.startTime).toLocaleTimeString('fr-FR', {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                  })}
                                </span>
                              </div>

                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Settings className="h-4 w-4 mr-2 text-purple-600" />
                                <span className="font-mono text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                                  {meeting.roomCode}
                                </span>
                              </div>
                            </div>

                            <div className="flex gap-2">
                              <Button 
                                onClick={() => joinMeeting(meeting.roomCode)}
                                className="flex-1 bg-blue-600 hover:bg-blue-700 h-9"
                                size="sm"
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Démarrer
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => copyMeetingLink(meeting.roomCode)}
                                className="h-9 px-3"
                              >
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => deleteMeeting(meeting.id)}
                                disabled={deleteMeetingMutation.isPending}
                                className="h-9 px-3 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="schedule" className="h-full">
              {/* Conteneur avec hauteurs fixes optimisées */}
              <div className="h-full flex flex-col" style={{ height: 'calc(100vh - 160px)' }}>
                {/* Header minimaliste */}
                <div className="flex-shrink-0 h-8 px-2 py-1 border-b bg-white dark:bg-gray-900 flex items-center">
                  <CalendarDays className="h-3 w-3 text-blue-600 mr-2" />
                  <h2 className="text-xs font-semibold">Programmer une réunion</h2>
                </div>

                {/* Zone de défilement sans débordement */}
                <div 
                  className="flex-1 overflow-y-auto overflow-x-hidden p-2" 
                  style={{ 
                    height: 'calc(100vh - 220px)', 
                    maxHeight: 'calc(100vh - 220px)',
                    minHeight: '280px' 
                  }}
                >
                  <div className="space-y-2 max-w-lg mx-auto pb-16">
                    <Card className="border border-blue-200 dark:border-blue-800 shadow-sm">
                      <CardHeader className="pb-3 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                        <CardTitle className="flex items-center text-base text-blue-900 dark:text-blue-100">
                          <CalendarDays className="h-4 w-4 mr-2 text-blue-600" />
                          Nouvelle réunion programmée
                        </CardTitle>
                      </CardHeader>
                      
                      <CardContent className="p-3 space-y-3">
                        {/* Informations de base */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="meetingTitle" className="text-xs text-gray-700 dark:text-gray-300">
                                Titre *
                              </Label>
                              <Input
                                id="meetingTitle"
                                value={newMeetingTitle}
                                onChange={(e) => setNewMeetingTitle(e.target.value)}
                                placeholder="Réunion équipe"
                                className="h-7 text-xs"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label htmlFor="meetingDuration" className="text-xs text-gray-700 dark:text-gray-300">
                                Durée (min)
                              </Label>
                              <Input
                                id="meetingDuration"
                                type="number"
                                value={newMeetingDuration}
                                onChange={(e) => setNewMeetingDuration(e.target.value)}
                                placeholder="60"
                                min="15"
                                max="480"
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <Label htmlFor="meetingDescription" className="text-xs text-gray-700 dark:text-gray-300">
                              Description
                            </Label>
                            <Textarea
                              id="meetingDescription"
                              value={newMeetingDescription}
                              onChange={(e) => setNewMeetingDescription(e.target.value)}
                              placeholder="Objectif de la réunion..."
                              rows={2}
                              className="resize-none text-xs"
                            />
                          </div>
                        </div>

                        {/* Planification */}
                        <div className="space-y-2">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            <div className="space-y-1">
                              <Label htmlFor="meetingDate" className="text-xs text-gray-700 dark:text-gray-300">
                                Date *
                              </Label>
                              <Input
                                id="meetingDate"
                                type="date"
                                value={newMeetingDate}
                                onChange={(e) => setNewMeetingDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="h-7 text-xs"
                              />
                            </div>
                            
                            <div className="space-y-1">
                              <Label htmlFor="meetingTime" className="text-xs text-gray-700 dark:text-gray-300">
                                Heure *
                              </Label>
                              <Input
                                id="meetingTime"
                                type="time"
                                value={newMeetingTime}
                                onChange={(e) => setNewMeetingTime(e.target.value)}
                                className="h-7 text-xs"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 border-t">
                          <Button 
                            onClick={createScheduledMeeting}
                            disabled={createMeetingMutation.isPending || !newMeetingTitle.trim() || !newMeetingDate || !newMeetingTime}
                            className="flex-1 h-7 bg-blue-600 hover:bg-blue-700 text-xs"
                            size="sm"
                          >
                            <Calendar className="h-3 w-3 mr-1" />
                            {createMeetingMutation.isPending ? "Création..." : "Programmer"}
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => {
                              setNewMeetingTitle("");
                              setNewMeetingDescription("");
                              setNewMeetingDate("");
                              setNewMeetingTime("");
                              setNewMeetingDuration("60");
                            }}
                            disabled={createMeetingMutation.isPending}
                            className="px-3 h-7 text-xs"
                            size="sm"
                          >
                            Effacer
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}