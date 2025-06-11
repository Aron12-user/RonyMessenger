
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
import MeetingWindow from '@/components/MeetingWindow';
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
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  Video,
  Users,
  ClipboardCheck,
  Clock,
  CalendarClock,
  Loader2,
  Trash2,
  MoreVertical,
  Play,
  X
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { apiRequest, queryClient } from "@/lib/queryClient";

// Interface pour une réunion active
interface ActiveMeeting {
  friendlyCode: string;
  roomName: string;
  createdAt: Date;
  expiresAt: Date;
  createdBy: number;
  participantsCount: number;
}

// Interface pour une réunion programmée
interface ScheduledMeeting {
  id: number;
  title: string;
  description: string;
  startTime: Date;
  endTime: Date;
  organizerId: number;
  roomName: string;
  isRecurring: boolean;
  recurringPattern?: string;
  createdAt: Date;
  updatedAt: Date;
}

export default function MeetingsNew() {
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [joinDialogOpen, setJoinDialogOpen] = useState<boolean>(false);
  const [joinCode, setJoinCode] = useState<string>('');
  const [isValidatingCode, setIsValidatingCode] = useState<boolean>(false);
  const [validationError, setValidationError] = useState<string>('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    isRecurring: false
  });
  const joinInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Récupérer l'utilisateur courant
  const { data: currentUser, isLoading: isLoadingUser } = useQuery<User>({
    queryKey: [API_ENDPOINTS.USER],
  });

  // Récupérer les réunions actives
  const { data: activeMeetings, isLoading: isLoadingMeetings } = useQuery<{success: boolean, rooms: ActiveMeeting[]}>({
    queryKey: ['/api/meetings/active'],
    refetchInterval: 30000,
  });

  // Récupérer les réunions programmées
  const { data: scheduledMeetings, isLoading: isLoadingScheduled } = useQuery<{success: boolean, meetings: ScheduledMeeting[]}>({
    queryKey: ['/api/meetings/scheduled'],
    refetchInterval: 60000,
  });

  // Ouvrir la boîte de dialogue pour rejoindre une réunion
  const openJoinDialog = () => {
    setJoinCode('');
    setValidationError('');
    setJoinDialogOpen(true);
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
    setActiveCode('');
  };

  // Rejoindre une réunion existante
  const handleJoinMeeting = (code: string) => {
    setActiveCode(code);
  };

  // Supprimer une réunion active
  const handleDeleteActiveMeeting = async (code: string) => {
    try {
      await apiRequest('DELETE', `/api/meetings/active/${code}`);
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/active'] });
      toast({
        title: "Réunion supprimée",
        description: "La réunion a été supprimée avec succès"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la réunion",
        variant: "destructive"
      });
    }
  };

  // Démarrer une réunion programmée
  const handleStartScheduledMeeting = async (meeting: ScheduledMeeting) => {
    try {
      const response = await apiRequest('POST', `/api/meetings/start-scheduled/${meeting.id}`);
      const data = await response.json();
      
      if (data.success) {
        setActiveCode(data.friendlyCode);
        queryClient.invalidateQueries({ queryKey: ['/api/meetings/active'] });
        queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de démarrer la réunion programmée",
        variant: "destructive"
      });
    }
  };

  // Supprimer une réunion programmée
  const handleDeleteScheduledMeeting = async (id: number) => {
    try {
      await apiRequest('DELETE', `/api/meetings/scheduled/${id}`);
      queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
      toast({
        title: "Réunion supprimée",
        description: "La réunion programmée a été supprimée"
      });
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer la réunion programmée",
        variant: "destructive"
      });
    }
  };

  // Programmer une réunion
  const handleScheduleMeeting = async () => {
    try {
      if (!formData.title || !formData.startTime || !formData.endTime) {
        toast({
          title: "Erreur",
          description: "Veuillez remplir tous les champs obligatoires",
          variant: "destructive"
        });
        return;
      }

      const response = await apiRequest('POST', '/api/meetings/schedule', formData);
      const data = await response.json();

      if (data.success) {
        toast({
          title: "Réunion programmée",
          description: "La réunion a été programmée avec succès"
        });
        setFormData({
          title: '',
          description: '',
          startTime: '',
          endTime: '',
          isRecurring: false
        });
        queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
      } else {
        throw new Error(data.message);
      }
    } catch (error) {
      toast({
        title: "Erreur",
        description: "Impossible de programmer la réunion",
        variant: "destructive"
      });
    }
  };

  // Quitter une réunion
  const handleEndMeeting = () => {
    setActiveCode(null);
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

  // Vérifier si une réunion programmée doit démarrer
  const shouldAutoStart = (meeting: ScheduledMeeting) => {
    const now = new Date();
    const startTime = new Date(meeting.startTime);
    return now >= startTime && now <= new Date(meeting.endTime);
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
      <MeetingWindow
        roomCode={activeCode || undefined}
        userName={currentUser.displayName || currentUser.username}
        userId={currentUser.id}
        onClose={handleEndMeeting}
      />
    );
  }

  return (
    <section className="flex-1 p-6 flex flex-col max-h-screen">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1 flex flex-col">
        <div className="max-w-4xl mx-auto flex-1 flex flex-col">
          <div className="flex justify-between items-center mb-6 flex-shrink-0">
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

          <Tabs defaultValue="active" className="w-full flex-1 flex flex-col">
            <TabsList className="mb-6 flex-shrink-0">
              <TabsTrigger value="active" className="flex items-center">
                <Video className="h-4 w-4 mr-2" />
                <span>Réunions actives</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Réunions programmées</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-6 flex-1 flex flex-col">
              {isLoadingMeetings ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !activeMeetings?.rooms || activeMeetings.rooms.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-8 text-center border border-gray-200 dark:border-gray-600">
                  <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Aucune réunion active</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md mx-auto">
                    Il n'y a actuellement aucune réunion en cours. Démarrez une nouvelle réunion ou rejoignez-en une avec un code.
                  </p>
                  <Button onClick={handleStartMeeting} className="mx-auto">
                    <Video className="h-4 w-4 mr-2" />
                    <span>Démarrer une réunion</span>
                  </Button>
                </div>
              ) : (
                <ScrollArea className="flex-1">
                  <div className="grid md:grid-cols-2 gap-6 pr-4">
                    {activeMeetings.rooms.map((meeting) => (
                      <Card key={meeting.friendlyCode} className="overflow-hidden border border-gray-200 dark:border-gray-600">
                        <CardHeader className="bg-gray-50 dark:bg-gray-700 pb-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <CardTitle className="text-lg">Réunion en cours</CardTitle>
                              <CardDescription className="flex items-center mt-1">
                                <Clock className="h-3.5 w-3.5 mr-1 text-gray-500" />
                                <span>Début: {formatDate(meeting.createdAt)}</span>
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center">
                                <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                                Active
                              </span>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                        <Trash2 className="h-4 w-4 mr-2" />
                                        Supprimer
                                      </DropdownMenuItem>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Supprimer la réunion</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Êtes-vous sûr de vouloir supprimer cette réunion active ? Tous les participants seront déconnectés.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Annuler</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteActiveMeeting(meeting.friendlyCode)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Supprimer
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-4">
                          <div className="flex justify-between items-center mb-4">
                            <div>
                              <p className="text-sm font-medium">Code d'accès</p>
                              <p className="text-lg font-mono bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded mt-1">
                                {meeting.friendlyCode}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-medium">Participants</p>
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
                </ScrollArea>
              )}

              <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600 flex-shrink-0">
                <h3 className="font-bold text-lg mb-4">Réunion Instantanée</h3>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Démarrez une réunion vidéo instantanée pour collaborer en temps réel avec votre équipe. Les réunions sont sécurisées avec un accès par code unique.
                </p>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="flex items-center space-x-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex-shrink-0 h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Video className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Vidéo et audio HD</h4>
                      <p className="text-sm text-gray-500">Communication fluide et claire</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                    <div className="flex-shrink-0 h-12 w-12 bg-primary/10 rounded-full flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h4 className="font-medium">Réunions illimitées</h4>
                      <p className="text-sm text-gray-500">Sans restriction de durée</p>
                    </div>
                  </div>
                </div>
                <div className="mt-6">
                  <Button
                    onClick={handleStartMeeting}
                    size="lg"
                    className="w-full md:w-auto bg-primary hover:bg-primary/90"
                  >
                    <Video className="h-4 w-4 mr-2" />
                    <span>Démarrer une nouvelle réunion</span>
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="scheduled" className="space-y-6 flex-1 flex flex-col">
              <div className="grid lg:grid-cols-2 gap-6 flex-1">
                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle>Programmer une nouvelle réunion</CardTitle>
                    <CardDescription>
                      Planifiez une réunion et invitez des participants
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <ScrollArea className="h-[400px] pr-4">
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="title">Titre de la réunion *</Label>
                          <Input 
                            id="title" 
                            value={formData.title}
                            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Réunion hebdomadaire" 
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea 
                            id="description" 
                            value={formData.description}
                            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                            placeholder="Ordre du jour..." 
                          />
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                          <div className="space-y-2">
                            <Label>Date et heure de début *</Label>
                            <input
                              type="datetime-local"
                              value={formData.startTime}
                              onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                              className="w-full rounded-md border border-gray-200 dark:border-gray-600 p-2 bg-white dark:bg-gray-800"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label>Date et heure de fin *</Label>
                            <input
                              type="datetime-local"
                              value={formData.endTime}
                              onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                              className="w-full rounded-md border border-gray-200 dark:border-gray-600 p-2 bg-white dark:bg-gray-800"
                            />
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Switch 
                            id="recurring" 
                            checked={formData.isRecurring}
                            onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isRecurring: checked }))}
                          />
                          <Label htmlFor="recurring">Réunion récurrente</Label>
                        </div>
                      </div>
                    </ScrollArea>
                  </CardContent>
                  <CardFooter>
                    <Button 
                      onClick={handleScheduleMeeting}
                      className="w-full"
                    >
                      <Calendar className="h-4 w-4 mr-2" />
                      Programmer la réunion
                    </Button>
                  </CardFooter>
                </Card>

                <Card className="flex flex-col">
                  <CardHeader>
                    <CardTitle>Réunions programmées</CardTitle>
                    <CardDescription>
                      Vos prochaines réunions planifiées
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex-1">
                    {isLoadingScheduled ? (
                      <div className="flex justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                      </div>
                    ) : !scheduledMeetings?.meetings || scheduledMeetings.meetings.length === 0 ? (
                      <div className="text-center py-8">
                        <Calendar className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500">Aucune réunion programmée</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[400px] pr-4">
                        <div className="space-y-4">
                          {scheduledMeetings.meetings.map((meeting) => (
                            <Card key={meeting.id} className="border border-gray-200 dark:border-gray-600">
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <div className="flex-1">
                                    <CardTitle className="text-base">{meeting.title}</CardTitle>
                                    <CardDescription className="text-sm mt-1">
                                      {meeting.description}
                                    </CardDescription>
                                  </div>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      {shouldAutoStart(meeting) && (
                                        <DropdownMenuItem onClick={() => handleStartScheduledMeeting(meeting)}>
                                          <Play className="h-4 w-4 mr-2" />
                                          Démarrer maintenant
                                        </DropdownMenuItem>
                                      )}
                                      <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                          <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                                            <Trash2 className="h-4 w-4 mr-2" />
                                            Supprimer
                                          </DropdownMenuItem>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                          <AlertDialogHeader>
                                            <AlertDialogTitle>Supprimer la réunion programmée</AlertDialogTitle>
                                            <AlertDialogDescription>
                                              Êtes-vous sûr de vouloir supprimer cette réunion programmée ?
                                            </AlertDialogDescription>
                                          </AlertDialogHeader>
                                          <AlertDialogFooter>
                                            <AlertDialogCancel>Annuler</AlertDialogCancel>
                                            <AlertDialogAction
                                              onClick={() => handleDeleteScheduledMeeting(meeting.id)}
                                              className="bg-red-600 hover:bg-red-700"
                                            >
                                              Supprimer
                                            </AlertDialogAction>
                                          </AlertDialogFooter>
                                        </AlertDialogContent>
                                      </AlertDialog>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </CardHeader>
                              <CardContent className="pt-2">
                                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                                  <div className="flex items-center">
                                    <Clock className="h-4 w-4 mr-2" />
                                    <span>Début: {formatDate(meeting.startTime)}</span>
                                  </div>
                                  <div className="flex items-center">
                                    <CalendarClock className="h-4 w-4 mr-2" />
                                    <span>Fin: {formatDate(meeting.endTime)}</span>
                                  </div>
                                  {meeting.isRecurring && (
                                    <div className="flex items-center">
                                      <Calendar className="h-4 w-4 mr-2" />
                                      <span>Récurrente</span>
                                    </div>
                                  )}
                                </div>
                                {shouldAutoStart(meeting) && (
                                  <div className="mt-2">
                                    <Button 
                                      onClick={() => handleStartScheduledMeeting(meeting)}
                                      size="sm"
                                      className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                      <Play className="h-4 w-4 mr-2" />
                                      Démarrer maintenant
                                    </Button>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </ScrollArea>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
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
