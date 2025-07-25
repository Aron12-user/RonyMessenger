import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { CalendarIcon, Clock, MapPin, Users, Save, Plus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

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
  const queryClient = useQueryClient();

  // Form state - identique à l'image
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    participants: '',
    date: new Date(),
    startTime: '00:00',
    endTime: '00:30',
    isAllDay: false,
    isRecurring: false,
    location: '',
    isInPerson: true,
    isPrivate: false,
    reminderMinutes: 15,
    calendar: 'aronadit323@gmail.com'
  });

  // Récupérer les événements
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['/api/events'],
    enabled: true
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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/events'] });
      setShowNewEventForm(false);
      setFormData({
        title: '',
        description: '',
        participants: '',
        date: new Date(),
        startTime: '00:00',
        endTime: '00:30',
        isAllDay: false,
        isRecurring: false,
        location: '',
        isInPerson: true,
        isPrivate: false,
        reminderMinutes: 15,
        calendar: 'aronadit323@gmail.com'
      });
      toast({
        title: 'Événement créé',
        description: 'Votre événement a été créé avec succès',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Erreur',
        description: error.message || 'Erreur lors de la création',
        variant: 'destructive'
      });
    }
  });

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
      reminderMinutes: formData.reminderMinutes
    };

    createEventMutation.mutate(eventData);
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
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex justify-between items-center">
        <h1 className="text-2xl font-semibold text-gray-900">Planification</h1>
        <Button 
          onClick={() => setShowNewEventForm(true)}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nouvel événement
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 p-6">
        {showNewEventForm ? (
          // Formulaire identique à l'image
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Formulaire principal */}
            <div className="lg:col-span-2">
              <Card className="bg-white shadow-sm">
                <CardHeader className="border-b bg-gray-50">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Nouvel événement : Calendrier</CardTitle>
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
                  {/* Bouton Enregistrer */}
                  <div className="flex justify-between items-center">
                    <Button 
                      onClick={handleSubmit}
                      disabled={createEventMutation.isPending}
                      className="bg-teal-500 hover:bg-teal-600 text-white"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Enregistrer
                    </Button>
                    <Select defaultValue="aronadit323@gmail.com">
                      <SelectTrigger className="w-64">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="aronadit323@gmail.com">
                          Calendrier (aronadit323@gmail.com)
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

                  {/* Participants */}
                  <div className="flex items-center space-x-3">
                    <Users className="w-5 h-5 text-gray-500" />
                    <div className="flex-1">
                      <Input
                        placeholder="Invitez des participants"
                        value={formData.participants}
                        onChange={(e) => setFormData({...formData, participants: e.target.value})}
                        className="border-none shadow-none bg-transparent focus:ring-0 px-0"
                      />
                      <span className="text-sm text-gray-500">Facultatif</span>
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

                  {/* Options */}
                  <div className="space-y-4 ml-8">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Rendre périodique</span>
                      <Switch 
                        checked={formData.isRecurring}
                        onCheckedChange={(checked) => setFormData({...formData, isRecurring: checked})}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Journée entière</span>
                      <Switch 
                        checked={formData.isAllDay}
                        onCheckedChange={(checked) => setFormData({...formData, isAllDay: checked})}
                      />
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
                      {/* Barre d'outils simulée */}
                      <div className="flex items-center space-x-2 mt-2 text-gray-500">
                        <Button variant="ghost" size="sm" className="p-1 h-8 w-8">📎</Button>
                        <Button variant="ghost" size="sm" className="p-1 h-8 w-8">🖼️</Button>
                        <Button variant="ghost" size="sm" className="p-1 h-8 w-8">😀</Button>
                        <Button variant="ghost" size="sm" className="p-1 h-8 w-8">🔗</Button>
                        <Button variant="ghost" size="sm" className="p-1 h-8 w-8">✏️</Button>
                        <Button variant="ghost" size="sm" className="p-1 h-8 w-8">📋</Button>
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
          // Liste des événements
          <div className="max-w-4xl mx-auto">
            {events.length === 0 ? (
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
                {events.map((event: Event) => (
                  <Card key={event.id} className="bg-white">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-medium text-gray-900">{event.title}</h3>
                          <p className="text-sm text-gray-500">
                            {format(new Date(event.startDate), 'dd MMMM yyyy', { locale: fr })}
                            {event.startTime && ` à ${event.startTime}`}
                          </p>
                        </div>
                        <div className="flex space-x-2">
                          <Button variant="outline" size="sm">
                            Modifier
                          </Button>
                          <Button variant="outline" size="sm">
                            Supprimer
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
  );
}