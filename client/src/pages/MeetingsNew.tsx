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
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-2 flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex justify-between items-center mb-6">
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

          <Tabs defaultValue="active" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="active" className="flex items-center">
                <Video className="h-4 w-4 mr-2" />
                <span>Réunions actives</span>
              </TabsTrigger>
              <TabsTrigger value="scheduled" className="flex items-center">
                <Calendar className="h-4 w-4 mr-2" />
                <span>Réunions programmées</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4 max-h-[70vh] overflow-y-auto">
              {isLoadingMeetings ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : !activeMeetings?.rooms || activeMeetings.rooms.length === 0 ? (
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6 text-center border border-gray-200 dark:border-gray-600">
                  <Users className="h-10 w-10 mx-auto text-gray-400 mb-3" />
                  <h3 className="text-base font-semibold mb-2">Aucune réunion active</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4 max-w-md mx-auto text-sm">
                    Il n'y a actuellement aucune réunion en cours. Démarrez une nouvelle réunion ou rejoignez-en une avec un code.
                  </p>
                  <Button onClick={handleStartMeeting} className="mx-auto h-8 text-sm">
                    <Video className="h-3 w-3 mr-2" />
                    <span>Démarrer une réunion</span>
                  </Button>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
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
                          <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 flex items-center">
                            <span className="h-2 w-2 rounded-full bg-green-500 mr-1.5"></span>
                            Active
                          </span>
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
              )}

              <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
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
                            const formData = new FormData(document.querySelector('form')!);
                            const response = await apiRequest('POST', '/api/meetings/schedule', {
                              title: formData.get('title'),
                              description: formData.get('description'),
                              startTime: formData.get('startTime'),
                              endTime: formData.get('endTime'),
                              isRecurring: formData.get('recurring') === 'on',
                              waitingRoom: formData.get('waitingRoom') === 'on',
                              recordMeeting: formData.get('recordMeeting') === 'on'
                            });

                            const data = await response.json();
                            toast({
                              title: "Réunion programmée",
                              description: "La réunion a été programmée avec succès"
                            });
                            // Reset form
                            (document.querySelector('form') as HTMLFormElement)?.reset();
                            queryClient.invalidateQueries({ queryKey: ['/api/meetings/scheduled'] });
                          } catch (error) {
                            toast({
                              title: "Erreur",
                              description: "Impossible de programmer la réunion",
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
                      {/* Exemple de réunions programmées */}
                      <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-sm">Réunion équipe marketing</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Révision campagne Q1</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center text-blue-600">
                            <Calendar className="h-3 w-3 mr-1" />
                            Demain 14:00 - 15:30
                          </span>
                          <span className="flex items-center text-gray-500">
                            <Users className="h-3 w-3 mr-1" />
                            5 invités
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          <Button size="sm" className="h-6 text-xs flex-1">
                            <Video className="h-3 w-3 mr-1" />
                            Démarrer
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 text-xs">
                            <Share className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-medium text-sm">Stand-up développement</h4>
                            <p className="text-xs text-gray-600 dark:text-gray-400">Point quotidien équipe tech</p>
                          </div>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-600">
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex justify-between items-center text-xs">
                          <span className="flex items-center text-green-600">
                            <Calendar className="h-3 w-3 mr-1" />
                            Lundi-Vendredi 09:00
                          </span>
                          <span className="flex items-center text-gray-500">
                            <Users className="h-3 w-3 mr-1" />
                            8 invités
                          </span>
                        </div>
                        <div className="mt-2 flex gap-1">
                          <Button size="sm" className="h-6 text-xs flex-1">
                            <Video className="h-3 w-3 mr-1" />
                            Démarrer
                          </Button>
                          <Button variant="outline" size="sm" className="h-6 text-xs">
                            <Share className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>

                      <div className="text-center py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                        <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                        <p className="text-sm text-gray-500">Aucune autre réunion programmée</p>
                        <Button variant="ghost" size="sm" className="mt-2 text-xs">
                          <Plus className="h-3 w-3 mr-1" />
                          Programmer une réunion
                        </Button>
                      </div>
                    </div>
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