import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import UserAvatar from "@/components/UserAvatar";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/lib/constants";
import { User } from "@shared/schema";
import VideoCall from "@/components/VideoCall";
import { generateRandomMeetingId } from "@/lib/utils";
import useWebSocket from "@/hooks/useWebSocket";
import { WS_EVENTS } from "@/lib/constants";

interface Meeting {
  id: string;
  title: string;
  description: string;
  status: 'scheduled' | 'active' | 'completed';
  startTime: Date;
  endTime: Date;
  participants: number[];
  createdBy: number;
}

// En situation réelle, cette donnée viendrait de la base de données
const MOCK_MEETINGS: Meeting[] = [
  {
    id: 'abc123',
    title: 'Product Review',
    description: 'Weekly review of product development progress and roadmap updates.',
    status: 'active',
    startTime: new Date(Date.now() - 1800000), // 30 minutes ago
    endTime: new Date(Date.now() + 1800000),   // 30 minutes from now
    participants: [2, 3, 4, 5, 6, 7],
    createdBy: 1
  },
  {
    id: 'def456',
    title: 'Client Presentation',
    description: 'Final presentation of the new website design to the client.',
    status: 'scheduled',
    startTime: new Date(Date.now() + 3600000), // 1 hour from now
    endTime: new Date(Date.now() + 7200000),   // 2 hours from now
    participants: [1, 2, 8],
    createdBy: 2
  }
];

export default function Meetings() {
  const [meetingId, setMeetingId] = useState<string>(generateRandomMeetingId());
  const [activeMeeting, setActiveMeeting] = useState<string | null>(null);
  const [meetings] = useState<Meeting[]>(MOCK_MEETINGS);
  const { toast } = useToast();
  const { sendMessage } = useWebSocket();

  // Fetch current user
  const { data: currentUser } = useQuery<User>({
    queryKey: [API_ENDPOINTS.USER],
  });

  // Fetch all users
  const { data: users = [] as User[] } = useQuery<User[]>({
    queryKey: [API_ENDPOINTS.USERS],
  });

  // Convertir les utilisateurs en une map pour un accès facile
  const usersMap = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<number, User>);

  // Générer un nouveau ID de réunion
  const handleGenerateNewId = () => {
    const newId = generateRandomMeetingId();
    setMeetingId(newId);
  };

  // Copier le lien de réunion
  const handleCopyLink = () => {
    const meetingLink = `${window.location.origin}/meeting/${meetingId}`;
    navigator.clipboard.writeText(meetingLink);
    toast({
      title: "Lien copié",
      description: "Le lien de la réunion a été copié dans le presse-papiers",
    });
  };

  // Démarrer une nouvelle réunion
  const handleStartMeeting = () => {
    setActiveMeeting(meetingId);
    
    // Notifier les autres utilisateurs (simulé)
    if (currentUser) {
      sendMessage(WS_EVENTS.JOIN_MEETING, {
        meetingId,
        user: currentUser
      });
    }
    
    toast({
      title: "Réunion démarrée",
      description: "Votre réunion a été créée avec succès",
    });
  };

  // Rejoindre une réunion existante
  const handleJoinMeeting = (id: string) => {
    setActiveMeeting(id);
    
    // Notifier les autres utilisateurs (simulé)
    if (currentUser) {
      sendMessage(WS_EVENTS.JOIN_MEETING, {
        meetingId: id,
        user: currentUser
      });
    }
  };

  // Terminer une réunion
  const handleEndMeeting = () => {
    // Notifier les autres utilisateurs (simulé)
    if (currentUser && activeMeeting) {
      sendMessage(WS_EVENTS.LEAVE_MEETING, {
        meetingId: activeMeeting,
        user: currentUser
      });
    }
    
    setActiveMeeting(null);
  };

  // Formater l'heure d'une réunion
  const formatMeetingTime = (startTime: Date, endTime: Date) => {
    const formatOptions = { hour: '2-digit', minute: '2-digit' } as const;
    return `${startTime.toLocaleTimeString([], formatOptions)} - ${endTime.toLocaleTimeString([], formatOptions)}`;
  };

  // Vérifier si une réunion est active (en cours)
  const isMeetingActive = (meeting: Meeting) => {
    const now = new Date();
    return meeting.startTime <= now && meeting.endTime >= now;
  };

  // Obtenir le statut d'affichage d'une réunion
  const getMeetingStatusDisplay = (meeting: Meeting) => {
    if (isMeetingActive(meeting)) {
      return {
        text: 'En cours',
        classes: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      };
    } else if (meeting.startTime > new Date()) {
      return {
        text: 'À venir',
        classes: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
      };
    } else {
      return {
        text: 'Terminée',
        classes: 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
      };
    }
  };

  return (
    <>
      <section className="flex-1 p-6 flex flex-col">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Réunions virtuelles</h2>
              <Button 
                onClick={handleStartMeeting}
                className="bg-primary hover:bg-primary/90 text-white py-2 px-4 rounded-lg flex items-center space-x-2"
              >
                <span className="material-icons">add</span>
                <span>Nouvelle réunion</span>
              </Button>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {meetings.map(meeting => {
                const status = getMeetingStatusDisplay(meeting);
                return (
                  <div key={meeting.id} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-5 border border-gray-200 dark:border-gray-600">
                    <div className="flex justify-between items-start mb-4">
                      <h3 className="font-bold text-lg">{meeting.title}</h3>
                      <span className={`px-2 py-1 text-xs rounded-full ${status.classes}`}>
                        {status.text}
                      </span>
                    </div>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">{meeting.description}</p>
                    
                    <div className="flex items-center text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <span className="material-icons text-sm mr-1">schedule</span>
                      <span>{formatMeetingTime(meeting.startTime, meeting.endTime)}</span>
                    </div>
                    
                    <div className="flex items-center flex-wrap gap-2 mb-4">
                      {meeting.participants.slice(0, 4).map(userId => (
                        <UserAvatar 
                          key={userId}
                          initials={usersMap[userId]?.displayName?.charAt(0) || usersMap[userId]?.username.charAt(0) || "U"} 
                          color={userId.toString()} 
                          size="sm" 
                        />
                      ))}
                      {meeting.participants.length > 4 && (
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-600 flex items-center justify-center text-gray-800 dark:text-gray-200 text-sm">
                          +{meeting.participants.length - 4}
                        </div>
                      )}
                    </div>
                    
                    {isMeetingActive(meeting) ? (
                      <Button 
                        onClick={() => handleJoinMeeting(meeting.id)}
                        className="w-full bg-primary hover:bg-primary/90 text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                      >
                        <span className="material-icons">videocam</span>
                        <span>Rejoindre</span>
                      </Button>
                    ) : meeting.startTime > new Date() ? (
                      <Button 
                        variant="outline" 
                        className="w-full bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-2 rounded-lg flex items-center justify-center space-x-2"
                      >
                        <span className="material-icons">calendar_today</span>
                        <span>Ajouter au calendrier</span>
                      </Button>
                    ) : (
                      <Button 
                        variant="outline" 
                        disabled
                        className="w-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 py-2 rounded-lg flex items-center justify-center space-x-2"
                      >
                        <span className="material-icons">event_busy</span>
                        <span>Terminée</span>
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
            
            <div className="mt-8 bg-gray-50 dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
              <h3 className="font-bold text-lg mb-4">Réunion rapide</h3>
              <p className="text-gray-600 dark:text-gray-300 mb-4">Démarrez une réunion instantanée et partagez le lien avec votre équipe.</p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-1 gap-2 items-center">
                  <input 
                    type="text" 
                    value={meetingId} 
                    readOnly 
                    className="flex-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2" 
                  />
                  <Button 
                    onClick={handleGenerateNewId}
                    variant="ghost" 
                    className="p-2"
                  >
                    <span className="material-icons">refresh</span>
                  </Button>
                </div>
                <Button 
                  onClick={handleCopyLink}
                  variant="outline" 
                  className="bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 text-gray-800 dark:text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <span className="material-icons">content_copy</span>
                  <span>Copier</span>
                </Button>
                <Button
                  onClick={handleStartMeeting}
                  className="bg-secondary hover:bg-secondary/90 text-white py-2 px-4 rounded-lg flex items-center justify-center space-x-2"
                >
                  <span className="material-icons">videocam</span>
                  <span>Démarrer</span>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Composant de vidéoconférence */}
      {activeMeeting && currentUser && (
        <VideoCall
          roomName={activeMeeting}
          userName={currentUser.displayName || currentUser.username}
          onClose={handleEndMeeting}
        />
      )}
    </>
  );
}
