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
  Monitor, 
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

  // Récupérer les réunions actives avec refetch automatique et gestion des transitions
  const { data: activeRoomsData, isLoading: loadingActive, refetch: refetchActive } = useQuery({
    queryKey: ['/api/meetings/active'],
    enabled: !!user,
    refetchInterval: 30000, // Refetch automatique toutes les 30 secondes pour vérifier les transitions
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

  // Créer une réunion programmée
  const createMeetingMutation = useMutation({
    mutationFn: async (meetingData: any) => {
      const response = await fetch("/api/meetings/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(meetingData),
      });
      
      if (!response.ok) {
        throw new Error('Failed to create meeting');
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
        description: "Impossible de créer la réunion. Veuillez réessayer.",
        variant: "destructive"
      });
    }
  });

  // Supprimer une réunion
  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete meeting');
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
        description: "Impossible de supprimer la réunion",
        variant: "destructive"
      });
    }
  });

  // Générer un code de réunion unique
  const generateRoomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 2; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    result += Math.random().toString(36).substr(2, 7).toUpperCase();
    return result;
  };

  // Programmer une réunion
  const scheduleMeeting = () => {
    if (!newMeetingTitle.trim()) return;

    const roomCode = generateRoomCode();
    const startDateTime = newMeetingDate && newMeetingTime 
      ? new Date(`${newMeetingDate}T${newMeetingTime}:00`)
      : new Date();

    const meetingData = {
      title: newMeetingTitle,
      description: newMeetingDescription,
      roomCode,
      startTime: startDateTime.toISOString(),
      duration: parseInt(newMeetingDuration) || 60
    };

    createMeetingMutation.mutate(meetingData);

    // Réinitialiser le formulaire
    setNewMeetingTitle("");
    setNewMeetingDescription("");
    setNewMeetingDate("");
    setNewMeetingTime("");
    setNewMeetingDuration("60");
  };

  // Créer une réunion instantanée
  const createInstantMeeting = () => {
    const roomCode = generateRoomCode();
    const meetingUrl = `https://meet.jit.si/${roomCode}`;
    window.open(meetingUrl, '_blank');
  };

  // Rejoindre une réunion avec code
  const joinMeetingWithCode = () => {
    if (!joinCode.trim()) return;
    const meetingUrl = `https://meet.jit.si/${joinCode}`;
    window.open(meetingUrl, '_blank');
    setShowJoinDialog(false);
    setJoinCode("");
  };

  // Supprimer une réunion
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
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Video className="h-4 w-4 mr-2" />
              Nouvelle réunion
            </Button>
          </div>
        </div>

        <div className="flex-1" style={{ height: 'calc(100vh - 100px)' }}>
          <Tabs defaultValue="active" className="h-full">
            <div className="px-6 pt-4 pb-2" style={{ height: '60px' }}>
              <TabsList className="grid w-full grid-cols-3">
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

            <TabsContent value="active" style={{ height: 'calc(100vh - 160px)' }}>
              <div className="px-6 pb-2" style={{ height: '50px' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Réunions en cours</h2>
                  <Badge variant="secondary" className="text-xs">
                    {activeRooms.length} active{activeRooms.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              <div 
                className="overflow-y-auto overflow-x-hidden px-6" 
                style={{ 
                  height: 'calc(100vh - 210px)',
                  maxHeight: 'calc(100vh - 210px)',
                  minHeight: '300px'
                }}
              >
                {loadingActive ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-24">
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
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center justify-center">
                      <Monitor className="h-16 w-16 text-gray-400 mb-4" />
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        Aucune réunion active
                      </h3>
                      <p className="text-gray-500 text-center mb-6 max-w-md">
                        Créez une nouvelle réunion pour commencer
                      </p>
                      <Button onClick={createInstantMeeting}>
                        <Plus className="h-4 w-4 mr-2" />
                        Nouvelle réunion
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-24">
                    {activeRooms.map((room: ActiveRoom) => (
                      <Card key={room.roomCode} className="hover:shadow-lg transition-all duration-200 border border-green-200 dark:border-green-700">
                        <CardContent className="p-6">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 dark:text-white text-base mb-1 truncate">
                                {room.title}
                              </h3>
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Users className="h-4 w-4 mr-2 text-green-600" />
                                <span>{room.participants} participant{room.participants !== 1 ? 's' : ''}</span>
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
                              <Monitor className="h-4 w-4 mr-2" />
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
              </div>
            </TabsContent>

            <TabsContent value="scheduled" style={{ height: 'calc(100vh - 160px)' }}>
              <div className="px-6 pb-2" style={{ height: '50px' }}>
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-medium">Réunions programmées</h2>
                  <Badge variant="secondary" className="text-xs">
                    {scheduledMeetings.length} programmée{scheduledMeetings.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>

              <div 
                className="overflow-y-auto overflow-x-hidden px-6" 
                style={{ 
                  height: 'calc(100vh - 210px)',
                  maxHeight: 'calc(100vh - 210px)',
                  minHeight: '300px'
                }}
              >
                {loadingScheduled ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-24">
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
                  <div className="flex items-center justify-center h-full">
                    <div className="flex flex-col items-center justify-center">
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
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pb-24">
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
                                  })} à {new Date(meeting.startTime).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>

                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                                <Clock className="h-4 w-4 mr-2 text-green-600" />
                                <span>Durée: {meeting.duration || 60} minutes</span>
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
            </TabsContent>

            <TabsContent value="schedule" style={{ height: 'calc(100vh - 160px)' }}>
              <div className="h-8 flex items-center px-6 border-b bg-white dark:bg-gray-900" style={{ height: '40px' }}>
                <CalendarDays className="h-3 w-3 text-blue-600 mr-2" />
                <h2 className="text-xs font-semibold">Programmer une réunion</h2>
              </div>

              <div 
                className="overflow-y-auto overflow-x-hidden" 
                style={{ 
                  height: 'calc(100vh - 200px)',
                  maxHeight: 'calc(100vh - 200px)',
                  minHeight: '300px'
                }}
              >
                <div className="p-4">
                  <div className="space-y-2 max-w-lg mx-auto pb-40">
                    <div className="space-y-3">
                    <div>
                      <Label htmlFor="newMeetingTitle" className="text-xs">Titre de la réunion</Label>
                      <Input
                        id="newMeetingTitle"
                        value={newMeetingTitle}
                        onChange={(e) => setNewMeetingTitle(e.target.value)}
                        placeholder="Nom de la réunion"
                        className="h-8 text-sm"
                      />
                    </div>

                    <div>
                      <Label htmlFor="newMeetingDescription" className="text-xs">Description (optionnel)</Label>
                      <Textarea
                        id="newMeetingDescription"
                        value={newMeetingDescription}
                        onChange={(e) => setNewMeetingDescription(e.target.value)}
                        placeholder="Description de la réunion..."
                        className="h-16 text-sm resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label htmlFor="newMeetingDate" className="text-xs">Date</Label>
                        <Input
                          id="newMeetingDate"
                          type="date"
                          value={newMeetingDate}
                          onChange={(e) => setNewMeetingDate(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <div>
                        <Label htmlFor="newMeetingTime" className="text-xs">Heure</Label>
                        <Input
                          id="newMeetingTime"
                          type="time"
                          value={newMeetingTime}
                          onChange={(e) => setNewMeetingTime(e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="newMeetingDuration" className="text-xs">Durée (minutes)</Label>
                      <Input
                        id="newMeetingDuration"
                        type="number"
                        value={newMeetingDuration}
                        onChange={(e) => setNewMeetingDuration(e.target.value)}
                        placeholder="60"
                        className="h-8 text-sm"
                      />
                    </div>

                    <Button 
                      onClick={scheduleMeeting}
                      disabled={createMeetingMutation.isPending || !newMeetingTitle.trim()}
                      className="w-full h-8 text-sm bg-blue-600 hover:bg-blue-700"
                    >
                      {createMeetingMutation.isPending ? (
                        <>
                          <Clock className="h-3 w-3 mr-2 animate-spin" />
                          Programmation...
                        </>
                      ) : (
                        <>
                          <CalendarDays className="h-3 w-3 mr-2" />
                          Programmer la réunion
                        </>
                      )}
                    </Button>
                    </div>
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