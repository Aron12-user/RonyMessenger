import React, { useState, useRef } from "react";
import EmptyState from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { ScrollArea } from "@/components/ui/scroll-area";
import { API_ENDPOINTS } from "@/lib/constants";
import { User } from "@shared/schema";
import MeetingRoom from "@/components/MeetingRoom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Calendar,
  Video,
  Users,
  ClipboardCheck,
  Clock,
  CalendarClock,
  Loader2,
  Edit,
  Trash2,
  Share,
  Plus
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Types pour les réunions programmées
interface ScheduledMeeting {
  id: number;
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  organizerId: number;
  roomName: string;
  isRecurring: boolean;
  waitingRoom: boolean;
  recordMeeting: boolean;
  createdAt: string;
}

// Interface pour une réunion active
interface ActiveMeeting {
  friendlyCode: string;
  roomName: string;
  createdAt: Date;
  expiresAt: Date;
  createdBy: number;
  participantsCount: number;
}

export default function MeetingsNew() {
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const joinInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Récupérer l'utilisateur courant
  const { data: currentUser, isLoading: isLoadingUser } = useQuery<User>({
    queryKey: [API_ENDPOINTS.USER],
  });

  // Récupérer les réunions actives
  const { data: activeMeetings, isLoading: isLoadingMeetings } = useQuery<{success: boolean, rooms: ActiveMeeting[]}>({
    queryKey: ['/api/meetings/active'],
    // Rafraîchir toutes les 30 secondes
    refetchInterval: 30000,
  });

  // Récupérer les réunions programmées
  const { data: scheduledMeetings, isLoading: isLoadingScheduled } = useQuery<{success: boolean, meetings: ScheduledMeeting[]}>({
    queryKey: ['/api/meetings/scheduled'],
    // Rafraîchir toutes les 30 secondes
    refetchInterval: 30000,
  });

  // Ouvrir la boîte de dialogue pour rejoindre une réunion
  const openJoinDialog = () => {
    setJoinCode('');
    setValidationError('');
    setJoinDialogOpen(true);
    // Focus après le rendu du dialogue
    setTimeout(() => {
      if (joinInputRef.current) {
        joinInputRef.current.focus();
      }
    }, 100);
  };

  // Fermer la boîte de dialogue
  const closeJoinDialog = () => {
    setJoinDialogOpen(false);
  };

  // Valider le code de réunion
  const validateMeetingCode = async (code: string) => {
    if (!code.trim()) {
      setValidationError('Veuillez entrer un code de réunion');
      return false;
    }

    try {
      setIsValidatingCode(true);
      const response = await apiRequest('GET', `/api/meetings/validate/${code.trim()}`);
      const data = await response.json();

      if (!data.valid) {
        setValidationError(data.message || 'Code de réunion invalide ou expiré');
        return false;
      }

      return true;
    } catch (error) {
      setValidationError('Erreur lors de la validation du code');
      return false;
    } finally {
      setIsValidatingCode(false);
    }
  };

  // Rejoindre une réunion avec un code
  const handleJoinWithCode = async () => {
    const isValid = await validateMeetingCode(joinCode.trim());

    if (isValid) {
      setActiveCode(joinCode.trim());
      closeJoinDialog();
    }
  };

  // Démarrer une nouvelle réunion
  const handleStartMeeting = () => {
    setActiveCode(''); // Code vide indique une nouvelle réunion
  };

  // Rejoindre une réunion existante
  const handleJoinMeeting = (code: string) => {
    setActiveCode(code);
  };

  // Quitter une réunion
  const handleEndMeeting = () => {
    setActiveCode(null);
    // Rafraîchir la liste des réunions actives
    queryClient.invalidateQueries({ queryKey: ['/api/meetings/active'] });

    toast({
      title: "Réunion terminée",
      description: "Vous avez quitté la réunion"
    });
  };

  // Formatter la date
  const formatDate = (date: Date) => {
    if (!(date instanceof Date)) {
      date = new Date(date);
    }
    return date.toLocaleString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit'
    });
  };

  // Si utilisateur non chargé, afficher un indicateur de chargement
  if (isLoadingUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Si l'utilisateur n'est pas connecté, afficher un message
  if (!currentUser) {
    return (
      <div className="flex h-full items-center justify-center">
        <p>Veuillez vous connecter pour accéder aux réunions</p>
      </div>
    );
  }

  // Afficher la réunion si active
  if (activeCode !== null) {
    return (
      <MeetingRoom
        roomCode={activeCode || undefined}
        userName={currentUser.displayName || currentUser.username}
        userId={currentUser.id}
        onClose={handleEndMeeting}
      />
    );
  }

  return (
    <section className="flex-1 p-1 flex flex-col overflow-hidden">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow flex-1 flex flex-col">
        {/* Header fixe */}
        <div className="sticky top-0 z-20 bg-white dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold">Réunions Vidéo</h2>
              <div className="flex gap-2">
                <Button
                  onClick={openJoinDialog}
                  variant="outline"
                  className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-2 px-4 rounded-lg flex items-center space-x-2"
                >
                  <ClipboardCheck className="h-4 w-4 mr-2" />
                  <span>Rejoindre avec code</span>
                </Button>
                <Button 
                  onClick={handleStartMeeting}
                  className="bg-primary hover:bg-primary/90 text-white py-2 px-4 rounded-lg flex items-center space-x-2"
                >
                  <Video className="h-4 w-4 mr-2" />
                  <span>Nouvelle réunion</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
        
        {/* Contenu scrollable */}
        <div className="flex-1 overflow-y-auto p-2" style={{ height: 'calc(100vh - 120px)' }}>
          <div className="max-w-4xl mx-auto">

            <Tabs defaultValue="active" className="w-full">
              <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 pb-2 border-b border-gray-200 dark:border-gray-700 mb-4">
                <TabsList className="mb-2">
                  <TabsTrigger value="active" className="flex items-center">
                    <Video className="h-4 w-4 mr-2" />
                    <span>Réunions actives</span>
                  </TabsTrigger>
                  <TabsTrigger value="scheduled" className="flex items-center">
                    <Calendar className="h-4 w-4 mr-2" />
                    <span>Réunions programmées</span>
                  </TabsTrigger>
                </TabsList>
              </div>

            <TabsContent value="active" className="space-y-4 h-full overflow-y-auto pb-4">
              {(isLoadingMeetings || isLoadingScheduled) ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Afficher les réunions programmées */}
                  {scheduledMeetings?.meetings && scheduledMeetings.meetings.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                        Réunions programmées
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {scheduledMeetings.meetings.map((meeting, index) => (
                          <Card key={meeting.id} className={`overflow-hidden border ${
                            index % 2 === 0 
                              ? 'border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/10' 
                              : 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                          }`}>
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-base font-medium">
                                    {meeting.title}
                                  </CardTitle>
                                  {meeting.description && (
                                    <CardDescription className="text-xs mt-1">
                                      {meeting.description}
                                    </CardDescription>
                                  )}
                                </div>
                                <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  index % 2 === 0 
                                    ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                    : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                                }`}>
                                  Programmée
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4">
                              <div className="space-y-3">
                                <div className="text-sm">
                                  <div className="flex items-center text-gray-600 dark:text-gray-400">
                                    <Calendar className="h-4 w-4 mr-2" />
                                    <span>
                                      {new Date(meeting.startTime).toLocaleDateString('fr-FR', {
                                        weekday: 'long',
                                        day: 'numeric',
                                        month: 'long',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <div className="flex items-center text-gray-600 dark:text-gray-400 mt-1">
                                    <Clock className="h-4 w-4 mr-2" />
                                    <span>
                                      Durée: {Math.round((new Date(meeting.endTime).getTime() - new Date(meeting.startTime).getTime()) / (1000 * 60))} min
                                    </span>
                                  </div>
                                </div>
                                
                                {(meeting.waitingRoom || meeting.recordMeeting) && (
                                  <div className="flex items-center gap-2">
                                    {meeting.waitingRoom && (
                                      <span className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-2 py-1 rounded">
                                        Salle d'attente
                                      </span>
                                    )}
                                    {meeting.recordMeeting && (
                                      <span className="text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-2 py-1 rounded">
                                        Enregistrement
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </CardContent>
                            <CardFooter className="bg-gray-50 dark:bg-gray-700 px-4 py-3">
                              <div className="flex gap-2 w-full">
                                <Button 
                                  onClick={() => handleJoinMeeting(meeting.roomName)}
                                  className="flex-1 bg-primary hover:bg-primary/90"
                                  size="sm"
                                >
                                  <Video className="h-4 w-4 mr-2" />
                                  <span>Démarrer</span>
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => {
                                    const meetingLink = `${window.location.origin}/meeting/${meeting.roomName}`;
                                    navigator.clipboard.writeText(meetingLink);
                                    toast({
                                      title: "Lien copié",
                                      description: "Le lien de la réunion a été copié"
                                    });
                                  }}
                                >
                                  <Share className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={async () => {
                                    try {
                                      // Mise à jour optimistique
                                      queryClient.setQueryData(['/api/meetings/scheduled'], (oldData: any) => {
                                        if (!oldData) return oldData;
                                        return {
                                          ...oldData,
                                          meetings: oldData.meetings.filter((m: any) => m.id !== meeting.id)
                                        };
                                      });
                                      
                                      await apiRequest('DELETE', `/api/meetings/scheduled/${meeting.id}`);
                                      toast({
                                        title: "Réunion supprimée",
                                        description: "La réunion a été supprimée avec succès"
                                      });
                                    } catch (error) {
                                      // Restaurer en cas d'erreur
                                      queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
                                      toast({
                                        title: "Erreur",
                                        description: "Impossible de supprimer la réunion",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Afficher les réunions instantanées actives */}
                  {activeMeetings?.rooms && activeMeetings.rooms.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 border-b pb-2">
                        Réunions instantanées en cours
                      </h4>
                      <div className="grid md:grid-cols-2 gap-4">
                        {activeMeetings.rooms.map((meeting) => (
                          <Card key={meeting.friendlyCode} className="overflow-hidden border border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-900/10">
                            <CardHeader className="pb-3">
                              <div className="flex justify-between items-start">
                                <div>
                                  <CardTitle className="text-base font-medium">
                                    Réunion #{meeting.friendlyCode}
                                  </CardTitle>
                                  <CardDescription className="text-xs mt-1">
                                    Créée le {formatDate(meeting.createdAt)}
                                  </CardDescription>
                                </div>
                                <div className="bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300 px-2 py-1 rounded-full text-xs font-medium">
                                  En cours
                                </div>
                              </div>
                            </CardHeader>
                            <CardContent className="p-4">
                              <div className="grid grid-cols-2 gap-4 mb-4">
                                <div className="text-center">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Code</p>
                                  <p className="text-sm font-mono font-bold tracking-wider bg-gray-100 dark:bg-gray-700 p-2 rounded">
                                    {meeting.friendlyCode}
                                  </p>
                                </div>
                                <div className="text-center">
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Participants</p>
                                  <p className="text-lg font-semibold flex items-center justify-end mt-1">
                                    <Users className="h-4 w-4 mr-2 text-gray-500" />
                                    {meeting.participantsCount}
                                  </p>
                                </div>
                              </div>
                              <div className="text-sm text-gray-500 flex items-center">
                                <CalendarClock className="h-4 w-4 mr-2" />
                                <span>Expire le: {formatDate(meeting.expiresAt)}</span>
                              </div>
                            </CardContent>
                            <CardFooter className="bg-gray-50 dark:bg-gray-700 px-6 py-4">
                              <Button 
                                onClick={() => handleJoinMeeting(meeting.friendlyCode)}
                                className="w-full bg-primary hover:bg-primary/90"
                              >
                                <Video className="h-4 w-4 mr-2" />
                                <span>Rejoindre la réunion</span>
                              </Button>
                            </CardFooter>
                          </Card>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Message quand aucune réunion */}
                  {(!scheduledMeetings?.meetings || scheduledMeetings.meetings.length === 0) && 
                   (!activeMeetings?.rooms || activeMeetings.rooms.length === 0) && (
                    <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center border border-gray-200 dark:border-gray-600">
                      <Users className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                      <h3 className="text-base font-semibold mb-2">Aucune réunion active</h3>
                      <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto text-sm">
                        Programmez une réunion ou démarrez une réunion instantanée pour commencer.
                      </p>
                      <Button onClick={handleStartMeeting} className="mx-auto h-8 text-sm">
                        <Video className="h-3 w-3 mr-2" />
                        <span>Démarrer une réunion</span>
                      </Button>
                    </div>
                  )}
                </div>
              )}


            </TabsContent>

            <TabsContent value="scheduled">
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Programmer une nouvelle réunion</CardTitle>
                    <CardDescription>
                      Planifiez une réunion et invitez des participants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[35vh] overflow-y-auto">
                      <form className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="title" className="text-sm">Titre de la réunion</Label>
                        <Input id="title" name="title" placeholder="Réunion hebdomadaire" className="h-8" />
                      </div>

                      <div className="space-y-1">
                        <Label htmlFor="description" className="text-xs">Description (optionnel)</Label>
                        <Textarea id="description" name="description" placeholder="Ordre du jour..." className="h-12 text-xs" />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">Début</Label>
                          <input
                            type="datetime-local"
                            name="startTime"
                            className="w-full rounded-md border border-gray-200 p-1 h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fin</Label>
                          <input
                            type="datetime-local"
                            name="endTime"
                            className="w-full rounded-md border border-gray-200 p-1 h-7 text-xs"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Paramètres</Label>
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <Switch id="recurring" name="recurring" className="scale-75"/>
                            <Label htmlFor="recurring" className="text-xs">Récurrente</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="waitingRoom" name="waitingRoom" className="scale-75"/>
                            <Label htmlFor="waitingRoom" className="text-xs">Salle d'attente</Label>
                          </div>
                          <div className="flex items-center space-x-2">
                            <Switch id="recordMeeting" name="recordMeeting" className="scale-75"/>
                            <Label htmlFor="recordMeeting" className="text-xs">Enregistrer</Label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Inviter</Label>
                        <div className="flex gap-1">
                          <Button variant="outline" className="h-6 text-xs px-2 flex-1">
                            <Users className="h-2 w-2 mr-1" />
                            Contacts
                          </Button>
                          <Button variant="outline" className="h-6 text-xs px-2 flex-1">
                            Email
                          </Button>
                        </div>
                      </div>
                    </form>
                  </CardContent>
                  <CardFooter>
                    <div className="flex gap-2">
                      <Button 
                        onClick={async () => {
                          try {
                            const form = document.querySelector('form') as HTMLFormElement;
                            const formData = new FormData(form);
                            
                            const title = formData.get('title') as string;
                            const startTime = formData.get('startTime') as string;
                            const endTime = formData.get('endTime') as string;
                            
                            // Validation côté client
                            if (!title?.trim()) {
                              toast({
                                title: "Erreur de validation",
                                description: "Le titre de la réunion est requis",
                                variant: "destructive"
                              });
                              return;
                            }
                            
                            if (!startTime || !endTime) {
                              toast({
                                title: "Erreur de validation",
                                description: "Les heures de début et fin sont requises",
                                variant: "destructive"
                              });
                              return;
                            }
                            
                            if (new Date(startTime) >= new Date(endTime)) {
                              toast({
                                title: "Erreur de validation",
                                description: "L'heure de fin doit être après l'heure de début",
                                variant: "destructive"
                              });
                              return;
                            }
                            
                            // Créer une réunion temporaire pour l'affichage optimistique
                            const tempMeeting = {
                              id: Date.now(), // ID temporaire
                              title: title.trim(),
                              description: (formData.get('description') as string) || '',
                              startTime,
                              endTime,
                              organizerId: currentUser?.id || 1,
                              roomName: `scheduled-${Date.now()}`,
                              isRecurring: formData.get('recurring') === 'on',
                              waitingRoom: formData.get('waitingRoom') === 'on',
                              recordMeeting: formData.get('recordMeeting') === 'on',
                              createdAt: new Date().toISOString()
                            };

                            // Mise à jour optimistique
                            queryClient.setQueryData(['/api/meetings/scheduled'], (oldData: any) => {
                              if (!oldData) return { success: true, meetings: [tempMeeting] };
                              return {
                                ...oldData,
                                meetings: [...oldData.meetings, tempMeeting]
                              };
                            });

                            const response = await apiRequest('POST', '/api/meetings/schedule', {
                              title: title.trim(),
                              description: (formData.get('description') as string) || '',
                              startTime,
                              endTime,
                              isRecurring: formData.get('recurring') === 'on',
                              waitingRoom: formData.get('waitingRoom') === 'on',
                              recordMeeting: formData.get('recordMeeting') === 'on'
                            });

                            if (!response.ok) {
                              const errorData = await response.json();
                              // Restaurer l'état en cas d'erreur
                              queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
                              throw new Error(errorData.message || 'Erreur lors de la programmation');
                            }

                            const data = await response.json();
                            toast({
                              title: "Réunion programmée",
                              description: "La réunion a été programmée avec succès"
                            });
                            
                            // Reset form
                            form.reset();
                            // Mettre à jour avec les vraies données du serveur
                            queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
                          } catch (error: any) {
                            console.error('Error scheduling meeting:', error);
                            toast({
                              title: "Erreur",
                              description: error.message || "Impossible de programmer la réunion",
                              variant: "destructive"
                            });
                          }
                        }}
                        className="flex-1 h-8 text-xs"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        Programmer
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          (document.querySelector('form') as HTMLFormElement)?.reset();
                        }}
                        className="h-8 text-xs px-3"
                      >
                        Effacer
                      </Button>
                    </div>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span>Réunions programmées</span>
                      <span className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-md">
                        Prochaines
                      </span>
                    </CardTitle>
                    <CardDescription>
                      Gérez vos réunions planifiées
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="max-h-[40vh] overflow-y-auto">
                    <div className="space-y-3">
                      {isLoadingScheduled ? (
                        <div className="flex justify-center py-6">
                          <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                      ) : !scheduledMeetings?.meetings || scheduledMeetings.meetings.length === 0 ? (
                        <div className="text-center py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                          <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                          <p className="text-sm text-gray-500">Aucune réunion programmée</p>
                          <p className="text-xs text-gray-400 mt-1">
                            Utilisez le formulaire ci-dessus pour programmer une nouvelle réunion
                          </p>
                        </div>
                      ) : (
                        scheduledMeetings.meetings.map((meeting, index) => (
                          <div key={meeting.id} className={`border rounded-lg p-3 ${
                            index % 2 === 0 
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                              : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                          }`}>
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <h4 className="font-medium text-sm">{meeting.title}</h4>
                                {meeting.description && (
                                  <p className="text-xs text-gray-600 dark:text-gray-400">{meeting.description}</p>
                                )}
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-6 w-6 p-0 text-red-600"
                                  onClick={async () => {
                                    try {
                                      await apiRequest('DELETE', `/api/meetings/scheduled/${meeting.id}`);
                                      toast({
                                        title: "Réunion supprimée",
                                        description: "La réunion a été supprimée avec succès"
                                      });
                                      queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
                                    } catch (error) {
                                      toast({
                                        title: "Erreur",
                                        description: "Impossible de supprimer la réunion",
                                        variant: "destructive"
                                      });
                                    }
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex justify-between items-center text-xs">
                              <span className={`flex items-center ${
                                index % 2 === 0 ? 'text-blue-600' : 'text-green-600'
                              }`}>
                                <Calendar className="h-3 w-3 mr-1" />
                                {new Date(meeting.startTime).toLocaleDateString('fr-FR', {
                                  weekday: 'short',
                                  day: 'numeric',
                                  month: 'short',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })} - {new Date(meeting.endTime).toLocaleTimeString('fr-FR', {
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </span>
                              <div className="flex items-center gap-2 text-gray-500">
                                {meeting.waitingRoom && (
                                  <span className="text-xs bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 px-1 py-0.5 rounded">
                                    Salle d'attente
                                  </span>
                                )}
                                {meeting.recordMeeting && (
                                  <span className="text-xs bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 px-1 py-0.5 rounded">
                                    Enregistrement
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 flex gap-1">
                              <Button 
                                size="sm" 
                                className="h-6 text-xs flex-1"
                                onClick={() => handleJoinMeeting(meeting.roomName)}
                              >
                                <Video className="h-3 w-3 mr-1" />
                                Démarrer
                              </Button>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-6 text-xs"
                                onClick={() => {
                                  const meetingLink = `${window.location.origin}/meeting/${meeting.roomName}`;
                                  navigator.clipboard.writeText(meetingLink);
                                  toast({
                                    title: "Lien copié",
                                    description: "Le lien de la réunion a été copié"
                                  });
                                }}
                              >
                                <Share className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogue pour rejoindre une réunion avec un code */}
      <Dialog open={joinDialogOpen} onOpenChange={setJoinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Rejoindre une réunion</DialogTitle>
            <DialogDescription>
              Entrez le code de la réunion qui vous a été communiqué pour rejoindre une salle existante.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-2">
              <Label htmlFor="meeting-code">Code de réunion</Label>
              <Input
                id="meeting-code"
                ref={joinInputRef}
                value={joinCode}
                onChange={(e) => {
                  setJoinCode(e.target.value);
                  setValidationError('');
                }}
                placeholder="Exemple: ABC-123"
                className={validationError ? "border-red-500" : ""}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !isValidatingCode) {
                    handleJoinWithCode();
                  }
                }}
              />
              {validationError && (
                <p className="text-sm text-red-500">{validationError}</p>
              )}
            </div>
          </div>
          <DialogFooter className="sm:justify-between">
            <Button variant="ghost" onClick={closeJoinDialog} disabled={isValidatingCode}>
              Annuler
            </Button>
            <Button 
              onClick={handleJoinWithCode} 
              disabled={isValidatingCode || !joinCode.trim()}
              className="relative"
            >
              {isValidatingCode ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  <span>Vérification...</span>
                </>
              ) : (
                <>
                  <Video className="h-4 w-4 mr-2" />
                  <span>Rejoindre la réunion</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}