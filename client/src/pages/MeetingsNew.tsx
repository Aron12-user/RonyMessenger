import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
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
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Loader2
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
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
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
            
            <TabsContent value="active" className="space-y-6">
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
                <div className="grid md:grid-cols-2 gap-6">
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
                  <CardContent>
                    <form className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="title">Titre de la réunion</Label>
                        <Input id="title" placeholder="Réunion hebdomadaire" />
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor="description">Description</Label>
                        <Textarea id="description" placeholder="Ordre du jour..." />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>Date et heure de début</Label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-md border border-gray-200 p-2"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Date et heure de fin</Label>
                          <input
                            type="datetime-local"
                            className="w-full rounded-md border border-gray-200 p-2"
                          />
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Participants</Label>
                        <div className="flex flex-wrap gap-2">
                          <Button variant="outline" className="h-8">
                            <Users className="h-4 w-4 mr-2" />
                            Ajouter des participants
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex space-x-2">
                        <Switch id="recurring" />
                        <Label htmlFor="recurring">Réunion récurrente</Label>
                      </div>
                    </form>
                  </CardContent>
                  <CardFooter>
                    <Button className="w-full">
                      <Calendar className="h-4 w-4 mr-2" />
                      Programmer la réunion
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Réunions programmées</CardTitle>
                    <CardDescription>
                      Vos prochaines réunions planifiées
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Liste des réunions programmées */}
                      <EmptyState />
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