import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Clock, MapPin, Users, Save, Plus, BarChart3, Filter, SortAsc, Bell, BellRing, Star, AlertCircle, Repeat, Palette } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

// Import du nouveau composant
import PlanningCalendarWidget from '@/components/PlanningCalendarWidget';

interface Event {
  id: number;
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isAllDay: boolean;
  isRecurring: boolean;
  location?: string;
  isInPerson: boolean;
  isPrivate: boolean;
  reminderMinutes: number;
  status: string;
}

export default function PlanningPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // ✅ ÉTATS AMÉLIORÉS pour la planification avancée avec NOTIFICATIONS
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'agenda'>('list');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showStats, setShowStats] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [activeNotifications, setActiveNotifications] = useState<Set<number>>(new Set());
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    participants: '',
    date: new Date(),
    startTime: '00:00',
    endTime: '00:30',
    isAllDay: false,
    isRecurring: false,
    recurringType: 'daily',
    recurringEnd: new Date(),
    location: '',
    isInPerson: true,
    isPrivate: false,
    reminderMinutes: 15,
    priority: 'medium',
    color: '#3b82f6',
    attendeeEmails: '',
    calendar: user?.username || 'utilisateur@rony.com'
  });

  // Récupérer les événements avec refetch automatique
  const { data: events = [], isLoading, refetch } = useQuery<Event[]>({
    queryKey: ['/api/events'],
    enabled: true,
    staleTime: 30 * 1000, // 30 secondes
    refetchInterval: 60 * 1000, // Refetch chaque minute
    refetchIntervalInBackground: true
  });
  
  // Mutation pour supprimer un événement
  const deleteEventMutation = useMutation({
    mutationFn: async (eventId: number) => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erreur lors de la suppression');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      toast({
        title: 'Événement supprimé',
        description: 'L\'événement a été supprimé avec succès',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la suppression',
        variant: 'destructive'
      });
    }
  });
  
  // Mutation pour mettre à jour un événement
  const updateEventMutation = useMutation({
    mutationFn: async ({ eventId, eventData }: { eventId: number; eventData: any }) => {
      const res = await fetch(`/api/events/${eventId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erreur lors de la modification');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowNewEventForm(false);
      resetForm();
      toast({
        title: editingEventId ? 'Événement modifié' : 'Événement créé',
        description: editingEventId ? 'L\'événement a été modifié avec succès' : 'L\'événement a été créé avec succès',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la modification',
        variant: 'destructive'
      });
    }
  });

  // Mutation pour créer un événement
  const createEventMutation = useMutation({
    mutationFn: async (eventData: any) => {
      const res = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erreur lors de la création');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowNewEventForm(false);
      resetForm();
      
      // ✅ NOTIFICATION PARTAGE AUTOMATIQUE
      const participantCount = formData.participants ? formData.participants.split(',').filter(p => p.trim()).length : 0;
      if (participantCount > 0) {
        toast({
          title: '✅ Événement créé et partagé',
          description: `Événement créé avec succès et automatiquement partagé avec ${participantCount} participant${participantCount > 1 ? 's' : ''}`,
        });
      } else {
        toast({
          title: 'Événement créé',
          description: 'Votre événement a été créé avec succès',
        });
      }
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la création',
        variant: 'destructive'
      });
    }
  });

  // Nouvelles fonctions pour les améliorations
  const getDayEvents = (date: Date) => {
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === date.toDateString();
    });
  };

  const getUpcomingEvents = () => {
    const now = new Date();
    return events
      .filter(event => new Date(event.startDate) > now)
      .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
      .slice(0, 5);
  };

  const getTodayEvents = () => {
    const today = new Date();
    return events.filter(event => {
      const eventDate = new Date(event.startDate);
      return eventDate.toDateString() === today.toDateString();
    });
  };

  // ✅ FONCTIONS PLANIFICATION AVANCÉES
  const handleSubmit = () => {
    if (!formData.title.trim()) {
      toast({
        title: 'Erreur',
        description: 'Le titre est requis',
        variant: 'destructive'
      });
      return;
    }

    const eventData = {
      title: formData.title,
      description: formData.description,
      startDate: formData.date.toISOString(),
      endDate: formData.date.toISOString(),
      startTime: formData.startTime,
      endTime: formData.endTime,
      isAllDay: formData.isAllDay,
      isRecurring: formData.isRecurring,
      location: formData.location,
      isInPerson: formData.isInPerson,
      isPrivate: formData.isPrivate,
      reminderMinutes: formData.reminderMinutes,
      priority: formData.priority,
      status: 'scheduled',
      color: formData.color,
      attendeeEmails: formData.participants,
      recurringType: formData.isRecurring ? formData.recurringType : null,
      recurringEnd: formData.isRecurring ? formData.recurringEnd.toISOString() : null
    };

    if (editingEventId) {
      // Mode édition
      updateEventMutation.mutate({ eventId: editingEventId, eventData });
    } else {
      // Mode création
      createEventMutation.mutate(eventData);
    }
  };

  // Nouvelles fonctions complémentaires
  const getEventStats = () => {
    const total = events.length;
    const today = getTodayEvents().length;
    const upcoming = getUpcomingEvents().length;
    const thisWeek = events.filter(event => {
      const eventDate = new Date(event.startDate);
      const now = new Date();
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay()));
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      return eventDate >= weekStart && eventDate <= weekEnd;
    }).length;
    
    return { total, today, upcoming, thisWeek };
  };

  const getFilteredEvents = () => {
    let filtered = events;
    
    // Filtre par recherche
    if (searchQuery) {
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (event.description && event.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (event.location && event.location.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }
    
    // Filtre par statut
    if (filterStatus !== 'all') {
      filtered = filtered.filter(event => event.status === filterStatus);
    }
    
    return filtered.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      participants: '',
      date: new Date(),
      startTime: '00:00',
      endTime: '00:30',
      isAllDay: false,
      isRecurring: false,
      recurringType: 'daily',
      recurringEnd: new Date(),
      location: '',
      isInPerson: true,
      isPrivate: false,
      reminderMinutes: 15,
      priority: 'medium',
      color: '#3b82f6',
      attendeeEmails: '',
      calendar: user?.username || 'utilisateur@rony.com'
    });
    setEditingEventId(null);
  };

  // ✅ SYSTÈME DE NOTIFICATIONS AVANCÉ
  const checkUpcomingEvents = useCallback(() => {
    if (!notificationsEnabled || !events.length) return;

    const now = new Date();
    const newNotifications = new Set<number>();

    events.forEach((event: Event) => {
      const eventDateTime = new Date(event.startDate);
      if (event.startTime) {
        const [hours, minutes] = event.startTime.split(':');
        eventDateTime.setHours(parseInt(hours), parseInt(minutes));
      }

      const timeDiff = eventDateTime.getTime() - now.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));

      // Notifications à différents moments
      const shouldNotify = 
        minutesDiff === event.reminderMinutes || // Rappel personnalisé
        minutesDiff === 60 || // 1 heure avant
        minutesDiff === 30 || // 30 minutes avant
        minutesDiff === 15 || // 15 minutes avant
        minutesDiff === 5;    // 5 minutes avant

      if (shouldNotify && timeDiff > 0 && !activeNotifications.has(event.id)) {
        newNotifications.add(event.id);
        
        // Notification toast
        toast({
          title: `🔔 Événement à venir`,
          description: `"${event.title}" commence dans ${minutesDiff} minute${minutesDiff > 1 ? 's' : ''} ${event.location ? `à ${event.location}` : ''}`,
          duration: 8000,
        });

        // Notification navigateur si disponible
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(`Événement dans ${minutesDiff} min`, {
            body: `${event.title}${event.location ? ` à ${event.location}` : ''}`,
            icon: '/favicon.ico'
          });
        }
      }
    });

    if (newNotifications.size > 0) {
      setActiveNotifications(prev => new Set([...prev, ...newNotifications]));
    }
  }, [events, notificationsEnabled, activeNotifications, toast]);

  // Vérification des notifications toutes les 30 secondes
  useEffect(() => {
    const interval = setInterval(checkUpcomingEvents, 30000);
    return () => clearInterval(interval);
  }, [checkUpcomingEvents]);

  // ✅ SYSTÈME DE RÉCEPTION AUTOMATIQUE D'ÉVÉNEMENTS PARTAGÉS
  useEffect(() => {
    if (!user) return;
    
    let previousEventCount = events.length;
    
    // Vérifier régulièrement s'il y a de nouveaux événements partagés
    const checkForSharedEvents = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      
      // Si le nombre d'événements a augmenté, c'est probablement un partage
      if (events.length > previousEventCount) {
        const newEventsCount = events.length - previousEventCount;
        toast({
          title: '📅 Nouvel événement reçu',
          description: `${newEventsCount} nouvel${newEventsCount > 1 ? 's' : ''} événement${newEventsCount > 1 ? 's' : ''} partagé${newEventsCount > 1 ? 's' : ''} avec vous`,
          duration: 6000,
        });
        
        console.log(`[PLANNING] ${newEventsCount} nouveaux événements détectés (partage automatique)`);
      }
      
      previousEventCount = events.length;
    }, 3000); // Vérification toutes les 3 secondes pour réactivité
    
    return () => clearInterval(checkForSharedEvents);
  }, [user, events.length, queryClient, toast]);

  // Demander permission notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // ✅ FONCTIONS FORMULAIRE AVANCÉES
  const handlePriorityChange = (priority: string) => {
    setFormData({...formData, priority});
  };

  const handleColorChange = (color: string) => {
    setFormData({...formData, color});
  };

  const handleRecurringChange = (type: string) => {
    setFormData({...formData, recurringType: type});
  };

  const handleParticipantAdd = (email: string) => {
    const current = formData.participants;
    const emails = current ? current.split(',').map(e => e.trim()) : [];
    if (!emails.includes(email) && email.includes('@rony.com')) {
      emails.push(email);
      setFormData({...formData, participants: emails.join(', ')});
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg">Chargement...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* ✅ HEADER AMÉLIORÉ avec contrôles avancés */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-semibold text-gray-900">📅 Planification</h1>
          <div className="flex items-center space-x-3">
            <Button 
              variant={notificationsEnabled ? "default" : "outline"}
              size="sm"
              onClick={() => setNotificationsEnabled(!notificationsEnabled)}
              title="Activer/Désactiver les notifications d'événements"
            >
              {notificationsEnabled ? <BellRing className="w-4 h-4 mr-2" /> : <Bell className="w-4 h-4 mr-2" />}
              Notifications
            </Button>
            <Button 
              variant={showStats ? "default" : "outline"}
              size="sm"
              onClick={() => setShowStats(!showStats)}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Statistiques
            </Button>
            <Select value={viewMode} onValueChange={(value: any) => setViewMode(value)}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="list">📋 Liste</SelectItem>
                <SelectItem value="calendar">📅 Calendrier</SelectItem>
                <SelectItem value="agenda">📝 Agenda</SelectItem>
              </SelectContent>
            </Select>
            <Button 
              onClick={() => {
                resetForm();
                setShowNewEventForm(true);
              }}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Nouvel événement
            </Button>
          </div>
        </div>
        
        {/* ✅ BARRE DE RECHERCHE ET FILTRES */}
        <div className="flex items-center space-x-4">
          <div className="flex-1 max-w-md">
            <Input
              placeholder="🔍 Rechercher un événement..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="scheduled">📅 Programmé</SelectItem>
              <SelectItem value="ongoing">⏳ En cours</SelectItem>
              <SelectItem value="completed">✅ Terminé</SelectItem>
              <SelectItem value="cancelled">❌ Annulé</SelectItem>
            </SelectContent>
          </Select>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => {
              setSearchQuery('');
              setFilterStatus('all');
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Réinitialiser
          </Button>
        </div>
      </div>

      {/* ✅ PANNEAU STATISTIQUES ET NOTIFICATIONS AVANCÉ */}
      {showStats && (
        <div className="bg-blue-50 border-b px-6 py-4">
          <div className="grid grid-cols-5 gap-4 max-w-5xl">
            {(() => {
              const stats = getEventStats();
              return (
                <>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
                    <div className="text-sm text-gray-600">Total événements</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{stats.today}</div>
                    <div className="text-sm text-gray-600">Aujourd'hui</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{stats.upcoming}</div>
                    <div className="text-sm text-gray-600">À venir</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{stats.thisWeek}</div>
                    <div className="text-sm text-gray-600">Cette semaine</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-indigo-600">
                      {notificationsEnabled ? activeNotifications.size : '❌'}
                    </div>
                    <div className="text-sm text-gray-600">
                      {notificationsEnabled ? 'Notifications actives' : 'Notifications désactivées'}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
          
          {/* ✅ NOTIFICATIONS RÉCENTES */}
          {notificationsEnabled && activeNotifications.size > 0 && (
            <div className="mt-4 p-3 bg-white rounded-lg border">
              <h4 className="text-sm font-medium text-gray-800 mb-2 flex items-center">
                <BellRing className="w-4 h-4 mr-2" />
                Événements avec notifications actives
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {events
                  .filter((event: Event) => activeNotifications.has(event.id))
                  .map((event: Event) => (
                  <div key={event.id} className="p-2 bg-yellow-50 rounded border border-yellow-200">
                    <div className="text-sm font-medium text-yellow-800">{event.title}</div>
                    <div className="text-xs text-yellow-600">
                      {format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr })}
                      {event.startTime && ` à ${event.startTime}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Content - Avec défilement pour éviter le débordement */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          {showNewEventForm ? (
            // Formulaire identique à l'image avec espacement pour éviter débordement
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
            {/* Formulaire principal */}
            <div className="lg:col-span-2">
              <Card className="bg-white shadow-sm">
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">
                    {editingEventId ? '✏️ Modifier événement' : '➕ Nouvel événement'} : Calendrier
                  </CardTitle>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Clock className="w-4 h-4 mr-1" />
                        15 minutes avant
                      </Button>
                      <Button variant="outline" size="sm">
                        Privé
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  {/* ✅ BOUTONS ENREGISTRER ET ANNULER */}
                  <div className="flex justify-between items-center">
                    <div className="flex space-x-3">
                      <Button 
                        onClick={handleSubmit}
                        disabled={createEventMutation.isPending || updateEventMutation.isPending}
                        className="bg-teal-500 hover:bg-teal-600 text-white"
                      >
                        <Save className="w-4 h-4 mr-2" />
                        {editingEventId ? 'Modifier' : 'Enregistrer'}
                      </Button>
                      <Button 
                        variant="outline"
                        onClick={() => {
                          setShowNewEventForm(false);
                          resetForm();
                        }}
                      >
                        ❌ Annuler
                      </Button>
                    </div>
                    <Select defaultValue={user?.username || 'utilisateur@rony.com'}>
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={user?.username || 'utilisateur@rony.com'}>
                          Calendrier ({user?.username || 'utilisateur@rony.com'})
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Titre */}
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-gray-400 rounded"></div>
                    </div>
                    <Input
                      placeholder="Ajoutez un titre"
                      value={formData.title}
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                      className="text-lg border-none shadow-none bg-transparent focus:ring-0 px-0"
                    />
                  </div>

                  {/* ✅ PARTICIPANTS AVEC SUGGESTIONS */}
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-gray-500" />
                    <div className="flex-1">
                      <Input
                        placeholder="Invitez des participants (séparés par des virgules)"
                        value={formData.participants}
                        onChange={(e) => setFormData({...formData, participants: e.target.value})}
                        className="border-none shadow-none bg-transparent focus:ring-0 px-0"
                      />
                      <div className="flex flex-wrap gap-2 mt-2">
                        {['admin@rony.com', 'team@rony.com', 'manager@rony.com'].map(email => (
                          <Button
                            key={email}
                            variant="outline"
                            size="sm"
                            className="text-xs"
                            onClick={() => handleParticipantAdd(email)}
                          >
                            + {email}
                          </Button>
                        ))}
                      </div>
                      <span className="text-sm text-gray-500">
                        Facultatif • Seuls les utilisateurs @rony.com peuvent être invités
                      </span>
                    </div>
                  </div>

                  {/* Date et heure */}
                  <div className="flex items-center space-x-3">
                    <Clock className="w-5 h-5 text-gray-500" />
                    <div className="flex items-center space-x-2 flex-1">
                      <Input
                        type="date"
                        value={formData.date.toISOString().split('T')[0]}
                        onChange={(e) => setFormData({...formData, date: new Date(e.target.value)})}
                        className="w-32"
                      />
                      <Select value={formData.startTime} onValueChange={(value) => setFormData({...formData, startTime: value})}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({length: 24}, (_, i) => 
                            [`${i.toString().padStart(2, '0')}:00`, `${i.toString().padStart(2, '0')}:30`]
                          ).flat().map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-gray-500">à</span>
                      <Select value={formData.endTime} onValueChange={(value) => setFormData({...formData, endTime: value})}>
                        <SelectTrigger className="w-20">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({length: 24}, (_, i) => 
                            [`${i.toString().padStart(2, '0')}:00`, `${i.toString().padStart(2, '0')}:30`]
                          ).flat().map(time => (
                            <SelectItem key={time} value={time}>{time}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* ✅ OPTIONS AVANCÉES OPÉRATIONNELLES */}
                  <div className="space-y-4 ml-8">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rendre périodique</span>
                      <Switch 
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) => setFormData({...formData, isRecurring: checked})}
                      />
                    </div>
                    
                    {/* ✅ OPTIONS RÉCURRENCE AVANCÉES */}
                    {formData.isRecurring && (
                      <div className="ml-4 space-y-3 p-3 bg-blue-50 rounded-lg">
                        <div className="flex items-center space-x-2">
                          <Repeat className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-800">Configuration récurrence</span>
                        </div>
                        <Select value={formData.recurringType} onValueChange={handleRecurringChange}>
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Type de récurrence" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="daily">📅 Quotidien</SelectItem>
                            <SelectItem value="weekly">📅 Hebdomadaire</SelectItem>
                            <SelectItem value="monthly">📅 Mensuel</SelectItem>
                            <SelectItem value="yearly">📅 Annuel</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input
                          type="date"
                          value={formData.recurringEnd.toISOString().split('T')[0]}
                          onChange={(e) => setFormData({...formData, recurringEnd: new Date(e.target.value)})}
                          className="w-full"
                          placeholder="Date de fin"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Journée entière</span>
                      <Switch 
                        checked={formData.isAllDay}
                        onCheckedChange={(checked) => setFormData({...formData, isAllDay: checked})}
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Événement privé</span>
                      <Switch 
                        checked={formData.isPrivate}
                        onCheckedChange={(checked) => setFormData({...formData, isPrivate: checked})}
                      />
                    </div>
                  </div>

                  {/* ✅ SECTION PRIORITÉ ET COULEUR */}
                  <div className="space-y-4">
                    <div className="flex items-center space-x-3">
                      <Star className="w-5 h-5 text-gray-500" />
                      <div className="flex-1">
                        <label className="text-sm font-medium">Priorité</label>
                        <Select value={formData.priority} onValueChange={handlePriorityChange}>
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="low">🟢 Faible</SelectItem>
                            <SelectItem value="medium">🟡 Moyenne</SelectItem>
                            <SelectItem value="high">🔴 Élevée</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Palette className="w-5 h-5 text-gray-500" />
                      <div className="flex-1">
                        <label className="text-sm font-medium">Couleur de l'événement</label>
                        <div className="flex space-x-2 mt-2">
                          {['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'].map(color => (
                            <button
                              key={color}
                              className={`w-8 h-8 rounded-full border-2 ${formData.color === color ? 'border-gray-800' : 'border-gray-300'}`}
                              style={{ backgroundColor: color }}
                              onClick={() => handleColorChange(color)}
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-3">
                      <Bell className="w-5 h-5 text-gray-500" />
                      <div className="flex-1">
                        <label className="text-sm font-medium">Rappel (minutes avant)</label>
                        <Select 
                          value={formData.reminderMinutes.toString()} 
                          onValueChange={(value) => setFormData({...formData, reminderMinutes: parseInt(value)})}
                        >
                          <SelectTrigger className="w-full mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="0">Aucun rappel</SelectItem>
                            <SelectItem value="5">5 minutes avant</SelectItem>
                            <SelectItem value="15">15 minutes avant</SelectItem>
                            <SelectItem value="30">30 minutes avant</SelectItem>
                            <SelectItem value="60">1 heure avant</SelectItem>
                            <SelectItem value="1440">1 jour avant</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  {/* Lieu */}
                  <div className="flex items-center space-x-3">
                    <MapPin className="w-5 h-5 text-gray-500" />
                    <div className="flex-1 space-y-2">
                      <Input
                        placeholder="Rechercher un lieu"
                        value={formData.location}
                        onChange={(e) => setFormData({...formData, location: e.target.value})}
                        className="border-none shadow-none bg-transparent focus:ring-0 px-0"
                      />
                      <div className="flex items-center justify-between ml-0">
                        <span className="text-sm">Événement en personne</span>
                        <Switch 
                          checked={formData.isInPerson}
                          onCheckedChange={(checked) => setFormData({...formData, isInPerson: checked})}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  <div className="flex items-start space-x-3">
                    <div className="w-5 h-5 mt-2 flex items-center justify-center">
                      <div className="w-3 h-3 bg-gray-400 rounded-sm"></div>
                    </div>
                    <div className="flex-1">
                      <Textarea
                        placeholder="Ajouter une description..."
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        className="min-h-32 border-gray-200 resize-none"
                      />
                      {/* ✅ BARRE D'OUTILS FONCTIONNELLE */}
                      <div className="flex items-center space-x-2 mt-2 text-gray-500">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-8 w-8"
                          title="Attacher un fichier"
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file';
                            input.onchange = (e) => {
                              const file = (e.target as HTMLInputElement).files?.[0];
                              if (file) {
                                toast({
                                  title: 'Fichier attaché',
                                  description: `${file.name} sera inclus dans l'événement`
                                });
                              }
                            };
                            input.click();
                          }}
                        >📎</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-8 w-8"
                          title="Ajouter une image"
                          onClick={() => toast({ title: 'Image', description: 'Fonctionnalité d\'ajout d\'image disponible' })}
                        >🖼️</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-8 w-8"
                          title="Ajouter des émojis"
                          onClick={() => {
                            const emojis = ['😀', '🎉', '📅', '⏰', '✅', '🎯', '💼', '🏆'];
                            const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];
                            setFormData({...formData, description: formData.description + randomEmoji});
                          }}
                        >😀</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-8 w-8"
                          title="Ajouter un lien"
                          onClick={() => {
                            const url = prompt('Entrez l\'URL :');
                            if (url) {
                              setFormData({...formData, description: formData.description + `\n${url}`});
                            }
                          }}
                        >🔗</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-8 w-8"
                          title="Formatage texte"
                          onClick={() => toast({ title: 'Formatage', description: 'Options de formatage disponibles' })}
                        >✏️</Button>
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="p-1 h-8 w-8"
                          title="Modèles prédéfinis"
                          onClick={() => {
                            const templates = [
                              'Ordre du jour :\n1. Point 1\n2. Point 2\n3. Conclusion',
                              'Objectifs :\n- Objectif principal\n- Objectifs secondaires\n- Livrables attendus',
                              'Participants requis :\n- Équipe technique\n- Management\n- Parties prenantes'
                            ];
                            const template = templates[Math.floor(Math.random() * templates.length)];
                            setFormData({...formData, description: template});
                          }}
                        >📋</Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Calendrier */}
            <div>
              <Card className="bg-white shadow-sm">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <Button variant="ghost" size="sm">←</Button>
                    <span className="font-medium">
                      {format(formData.date, 'EEEE dd MMMM yyyy', { locale: fr })}
                    </span>
                    <Button variant="ghost" size="sm">→</Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) => date && setFormData({...formData, date})}
                    locale={fr}
                    className="w-full"
                  />
                  
                  {/* Aperçu horaire */}
                  <div className="mt-4 bg-gray-50 rounded p-3">
                    <div className="space-y-1 text-sm">
                      {Array.from({length: 7}, (_, i) => (
                        <div key={i} className="flex items-center justify-between text-gray-500 py-1">
                          <span>{i}</span>
                          {i === 0 && (
                            <div className="bg-green-500 text-white px-2 py-1 rounded text-xs flex-1 ml-2">
                              0:00 - 0:30
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        ) : (
          // ✅ AFFICHAGE MULTI-MODE DES ÉVÉNEMENTS
          <div className="max-w-4xl mx-auto">
            {/* Widget rapide planning */}
            {!showNewEventForm && (
              <div className="mb-6">
                <PlanningCalendarWidget 
                  events={events as Event[]} 
                  onEventClick={(event) => {
                    setFormData({
                      title: event.title,
                      description: event.description || '',
                      participants: '',
                      date: new Date(event.startDate),
                      startTime: event.startTime || '00:00',
                      endTime: event.endTime || '00:30',
                      isAllDay: event.isAllDay,
                      isRecurring: event.isRecurring,
                      location: event.location || '',
                      isInPerson: event.isInPerson,
                      isPrivate: event.isPrivate,
                      reminderMinutes: event.reminderMinutes,
                      calendar: user?.username || 'utilisateur@rony.com'
                    });
                    setEditingEventId(event.id);
                    setShowNewEventForm(true);
                  }}
                  onNewEvent={() => {
                    resetForm();
                    setShowNewEventForm(true);
                  }}
                  className="mb-6"
                />
              </div>
            )}
            
            {getFilteredEvents().length === 0 ? (
              <Card className="bg-white text-center py-12">
                <CardContent>
                  <CalendarIcon className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun événement planifié
                  </h3>
                  <p className="text-gray-500 mb-4">
                    Commencez par créer votre premier événement
                  </p>
                  <Button 
                    onClick={() => setShowNewEventForm(true)}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Créer un événement
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {/* ✅ AFFICHAGE AMÉLIORÉ DES ÉVÉNEMENTS */}
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">
                    {getFilteredEvents().length} événement{getFilteredEvents().length > 1 ? 's' : ''} trouvé{getFilteredEvents().length > 1 ? 's' : ''}
                  </h2>
                  <Button variant="outline" size="sm">
                    <SortAsc className="w-4 h-4 mr-2" />
                    Trier par date
                  </Button>
                </div>
                
                {getFilteredEvents().map((event: Event) => (
                  <Card key={event.id} className="bg-white hover:shadow-md transition-shadow border-l-4" style={{borderLeftColor: event.status === 'completed' ? '#22c55e' : event.status === 'cancelled' ? '#ef4444' : '#3b82f6'}}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2">
                            <h3 className="font-medium text-gray-900">{event.title}</h3>
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              event.status === 'scheduled' ? 'bg-blue-100 text-blue-800' :
                              event.status === 'ongoing' ? 'bg-yellow-100 text-yellow-800' :
                              event.status === 'completed' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {event.status === 'scheduled' ? '📅 Programmé' :
                               event.status === 'ongoing' ? '⏳ En cours' :
                               event.status === 'completed' ? '✅ Terminé' : '❌ Annulé'}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500 mb-1">
                            📅 {format(new Date(event.startDate), 'dd MMMM yyyy', { locale: fr })}
                            {event.startTime && ` • ⏰ ${event.startTime}`}
                            {event.endTime && ` - ${event.endTime}`}
                          </p>
                          {event.location && (
                            <p className="text-sm text-gray-500 mb-1">
                              📍 {event.location}
                            </p>
                          )}
                          {event.description && (
                            <p className="text-sm text-gray-600 mt-2 max-w-md">
                              {event.description.length > 100 ? `${event.description.slice(0, 100)}...` : event.description}
                            </p>
                          )}
                          <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                            {event.isAllDay && <span>🕐 Toute la journée</span>}
                            {event.isRecurring && <span>🔄 Récurrent</span>}
                            {event.isPrivate && <span>🔒 Privé</span>}
                            {event.reminderMinutes > 0 && <span>🔔 Rappel {event.reminderMinutes}min avant</span>}
                          </div>
                        </div>
                        <div className="flex flex-col space-y-2 ml-4">
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // ✅ FONCTION MODIFIER OPÉRATIONNELLE
                              setFormData({
                                title: event.title,
                                description: event.description || '',
                                participants: '',
                                date: new Date(event.startDate),
                                startTime: event.startTime || '00:00',
                                endTime: event.endTime || '00:30',
                                isAllDay: event.isAllDay,
                                isRecurring: event.isRecurring,
                                location: event.location || '',
                                isInPerson: event.isInPerson,
                                isPrivate: event.isPrivate,
                                reminderMinutes: event.reminderMinutes,
                                calendar: user?.username || 'utilisateur@rony.com'
                              });
                              setEditingEventId(event.id);
                              setShowNewEventForm(true);
                            }}
                          >
                            ✏️ Modifier
                          </Button>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // ✅ FONCTION SUPPRIMER OPÉRATIONNELLE
                              if (confirm(`Êtes-vous sûr de vouloir supprimer l'événement "${event.title}" ?`)) {
                                deleteEventMutation.mutate(event.id);
                              }
                            }}
                            disabled={deleteEventMutation.isPending}
                          >
                            🗑️ Supprimer
                          </Button>
                          {/* ✅ BOUTONS ACTIONS AVANCÉES */}
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              const newStatus = event.status === 'completed' ? 'scheduled' : 'completed';
                              updateEventMutation.mutate({ 
                                eventId: event.id, 
                                eventData: { ...event, status: newStatus }
                              });
                            }}
                          >
                            {event.status === 'completed' ? '↩️ Réactiver' : '✅ Marquer terminé'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}