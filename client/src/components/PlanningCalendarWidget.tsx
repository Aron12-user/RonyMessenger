import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, MapPin, Users, Plus, ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
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
  location?: string;
  status: string;
}

interface PlanningCalendarWidgetProps {
  events: Event[];
  onEventClick?: (event: Event) => void;
  onNewEvent?: () => void;
  className?: string;
}

export default function PlanningCalendarWidget({ 
  events, 
  onEventClick, 
  onNewEvent,
  className = '' 
}: PlanningCalendarWidgetProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  
  const today = new Date();
  const todayEvents = events.filter(event => {
    const eventDate = new Date(event.startDate);
    return eventDate.toDateString() === today.toDateString();
  });

  const upcomingEvents = events
    .filter(event => new Date(event.startDate) > today)
    .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime())
    .slice(0, 3);

  const getEventsByDay = () => {
    const eventsByDay: Record<string, Event[]> = {};
    events.forEach(event => {
      const day = new Date(event.startDate).toDateString();
      if (!eventsByDay[day]) {
        eventsByDay[day] = [];
      }
      eventsByDay[day].push(event);
    });
    return eventsByDay;
  };

  const eventsByDay = getEventsByDay();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'cancelled':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'completed':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
      default:
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
    }
  };

  return (
    <Card className={`w-full ${className}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center text-lg">
            <Calendar className="h-5 w-5 mr-2" />
            Planning
          </CardTitle>
          {onNewEvent && (
            <Button onClick={onNewEvent} size="sm" variant="outline">
              <Plus className="h-4 w-4 mr-1" />
              Nouveau
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Événements d'aujourd'hui */}
        {todayEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              Aujourd'hui ({todayEvents.length})
            </h4>
            <div className="space-y-2">
              {todayEvents.map(event => (
                <div
                  key={event.id}
                  className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-blue-900 dark:text-blue-100 truncate">
                        {event.title}
                      </p>
                      <div className="flex items-center mt-1 text-xs text-blue-700 dark:text-blue-300">
                        {!event.isAllDay && event.startTime && (
                          <span className="flex items-center mr-2">
                            <Clock className="h-3 w-3 mr-1" />
                            {event.startTime}
                          </span>
                        )}
                        {event.location && (
                          <span className="flex items-center truncate">
                            <MapPin className="h-3 w-3 mr-1" />
                            {event.location}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className={`ml-2 ${getStatusColor(event.status)}`}>
                      {event.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Événements à venir */}
        {upcomingEvents.length > 0 && (
          <div className="space-y-2">
            <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 flex items-center">
              <ChevronRight className="h-4 w-4 mr-1" />
              À venir
            </h4>
            <div className="space-y-2">
              {upcomingEvents.map(event => (
                <div
                  key={event.id}
                  className="p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  onClick={() => onEventClick?.(event)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">
                        {event.title}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                        {format(new Date(event.startDate), 'dd MMM yyyy', { locale: fr })}
                        {!event.isAllDay && event.startTime && ` à ${event.startTime}`}
                      </p>
                    </div>
                    <Badge variant="outline" className="ml-2 text-xs">
                      {event.status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Statistiques rapides */}
        <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded">
              <div className="font-semibold text-sm text-green-700 dark:text-green-300">
                {events.filter(e => e.status === 'active').length}
              </div>
              <div className="text-xs text-green-600 dark:text-green-400">Actifs</div>
            </div>
            <div className="p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
              <div className="font-semibold text-sm text-blue-700 dark:text-blue-300">
                {upcomingEvents.length}
              </div>
              <div className="text-xs text-blue-600 dark:text-blue-400">À venir</div>
            </div>
            <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded">
              <div className="font-semibold text-sm text-gray-700 dark:text-gray-300">
                {events.filter(e => e.status === 'completed').length}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400">Terminés</div>
            </div>
          </div>
        </div>

        {/* Message si aucun événement */}
        {events.length === 0 && (
          <div className="text-center py-6 text-gray-500 dark:text-gray-400">
            <Calendar className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Aucun événement planifié</p>
            {onNewEvent && (
              <Button onClick={onNewEvent} size="sm" variant="ghost" className="mt-2">
                Créer votre premier événement
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}