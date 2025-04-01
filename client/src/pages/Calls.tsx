import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import UserAvatar from "@/components/UserAvatar";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { API_ENDPOINTS } from "@/lib/constants";
import AudioCall from "@/components/AudioCall";
import VideoCall from "@/components/VideoCall";
import useWebSocket from "@/hooks/useWebSocket";
import { WS_EVENTS } from "@/lib/constants";
import { useToast } from "@/hooks/use-toast";

interface CallHistoryItem {
  id: number;
  userId: number; 
  type: "audio" | "video";
  direction: "outgoing" | "incoming";
  timestamp: Date;
  duration: number;
}

// En situation réelle, cette donnée viendrait de la base de données
const MOCK_CALL_HISTORY: CallHistoryItem[] = [
  {
    id: 1,
    userId: 2,
    type: "audio",
    direction: "outgoing",
    timestamp: new Date(Date.now() - 3600000), // 1 heure
    duration: 45 * 60 // 45 minutes
  },
  {
    id: 2,
    userId: 3,
    type: "audio",
    direction: "incoming",
    timestamp: new Date(Date.now() - 86400000), // 1 jour
    duration: 12 * 60 // 12 minutes
  }
];

export default function Calls() {
  const [callType, setCallType] = useState<"audio" | "video" | null>(null);
  const [callStatus, setCallStatus] = useState<"idle" | "calling" | "receiving">("idle");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [incomingCall, setIncomingCall] = useState<{from: User, signal: any, type: "audio" | "video"} | null>(null);
  const [isContactsOpen, setIsContactsOpen] = useState(false);
  const [callHistory] = useState<CallHistoryItem[]>(MOCK_CALL_HISTORY);
  
  const { toast } = useToast();
  const { addMessageHandler, sendMessage } = useWebSocket();

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

  // Gérer le début d'un appel
  const handleStartCall = (type: "audio" | "video") => {
    setCallType(type);
    setIsContactsOpen(true);
  };

  // Sélectionner un contact à appeler
  const handleSelectContact = (user: User) => {
    setSelectedUser(user);
    setCallStatus("calling");
    setIsContactsOpen(false);
    
    // Envoyer une offre d'appel via WebSocket
    sendMessage(WS_EVENTS.CALL_OFFER, {
      target: user.id,
      caller: currentUser,
      type: callType
    });
    
    toast({
      title: `Appel ${callType === "audio" ? "audio" : "vidéo"}`,
      description: `Appel en cours vers ${user.displayName || user.username}...`
    });
  };

  // Gérer la fin d'un appel
  const handleEndCall = () => {
    setCallType(null);
    setSelectedUser(null);
    setCallStatus("idle");
    setIncomingCall(null);
  };

  // Rejeter un appel entrant
  const handleRejectCall = () => {
    if (incomingCall) {
      sendMessage(WS_EVENTS.CALL_REJECTED, {
        target: incomingCall.from.id
      });
      setIncomingCall(null);
    }
  };

  // Accepter un appel entrant
  const handleAcceptCall = () => {
    if (incomingCall) {
      setCallType(incomingCall.type);
      setSelectedUser(incomingCall.from);
      setCallStatus("receiving");
    }
  };

  // Écouteurs d'événements WebSocket pour les appels
  // Dans une application réelle, ces écouteurs seraient dans un contexte global
  useEffect(() => {
    // Gérer les offres d'appel entrantes
    const handleCallOffer = addMessageHandler(WS_EVENTS.CALL_OFFER, (data) => {
      setIncomingCall({
        from: data.caller,
        signal: data.signal,
        type: data.type
      });
      
      toast({
        title: `Appel ${data.type === "audio" ? "audio" : "vidéo"} entrant`,
        description: `${data.caller.displayName || data.caller.username} vous appelle`
      });
    });
    
    // Gérer les rejets d'appel
    const handleCallRejected = addMessageHandler(WS_EVENTS.CALL_REJECTED, () => {
      toast({
        title: "Appel rejeté",
        description: `${selectedUser?.displayName || selectedUser?.username} a rejeté votre appel`,
        variant: "destructive"
      });
      
      handleEndCall();
    });
    
    return () => {
      handleCallOffer();
      handleCallRejected();
    };
  }, [selectedUser, addMessageHandler, toast]);

  // Formatter la durée d'un appel
  const formatCallDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    if (mins < 60) {
      return `${mins} min`;
    } else {
      const hours = Math.floor(mins / 60);
      const remainingMins = mins % 60;
      return `${hours} h ${remainingMins} min`;
    }
  };

  // Formatter la date d'un appel
  const formatCallTime = (timestamp: Date) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (timestamp >= today) {
      return `Today, ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (timestamp >= yesterday) {
      return `Yesterday, ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
        ` ${timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };

  return (
    <section className="flex-1 p-6 flex flex-col">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6 flex-1">
        <div className="text-center max-w-md mx-auto">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="material-icons text-4xl text-primary">call</span>
          </div>
          <h2 className="text-2xl font-bold mb-2">Voice & Video Calls</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-6">Connect with your team through high-quality voice and video calls</p>
          <div className="grid grid-cols-2 gap-4">
            <Button 
              onClick={() => handleStartCall("audio")} 
              className="bg-primary hover:bg-primary/90 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
            >
              <span className="material-icons">call</span>
              <span>Start Voice Call</span>
            </Button>
            <Button 
              onClick={() => handleStartCall("video")} 
              className="bg-secondary hover:bg-secondary/90 text-white py-3 px-4 rounded-lg flex items-center justify-center space-x-2"
            >
              <span className="material-icons">videocam</span>
              <span>Start Video Call</span>
            </Button>
          </div>
          
          <div className="mt-8 border-t border-gray-200 dark:border-gray-700 pt-6">
            <h3 className="font-medium mb-4 text-gray-700 dark:text-gray-300">Recent Calls</h3>
            <div className="space-y-4">
              {callHistory.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="flex items-center">
                    <UserAvatar 
                      initials={usersMap[call.userId]?.displayName?.charAt(0) || usersMap[call.userId]?.username.charAt(0) || "U"} 
                      color={call.userId.toString()} 
                    />
                    <div className="ml-3">
                      <p className="font-medium">{usersMap[call.userId]?.displayName || usersMap[call.userId]?.username}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatCallTime(call.timestamp)} • {formatCallDuration(call.duration)}
                      </p>
                    </div>
                  </div>
                  <span className="material-icons text-green-500">
                    {call.direction === "outgoing" ? "call_made" : "call_received"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
      
      {/* Dialog pour sélectionner un contact à appeler */}
      <Dialog open={isContactsOpen} onOpenChange={setIsContactsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Sélectionner un contact</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto p-1">
            {users.filter(user => user.id !== currentUser?.id).map((user) => (
              <div 
                key={user.id}
                onClick={() => handleSelectContact(user)}
                className="flex items-center p-3 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer"
              >
                <UserAvatar 
                  initials={user.displayName?.charAt(0) || user.username.charAt(0)} 
                  color={user.id.toString()} 
                />
                <span className="ml-3 font-medium">{user.displayName || user.username}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      
      {/* Dialog pour un appel entrant */}
      <Dialog open={!!incomingCall && callStatus === "idle"} onOpenChange={(open) => !open && handleRejectCall()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Appel entrant</DialogTitle>
          </DialogHeader>
          {incomingCall && (
            <div className="flex flex-col items-center p-4">
              <UserAvatar 
                initials={incomingCall.from.displayName?.charAt(0) || incomingCall.from.username.charAt(0)} 
                color={incomingCall.from.id.toString()} 
                size="lg"
              />
              <h3 className="text-lg font-semibold mt-3">{incomingCall.from.displayName || incomingCall.from.username}</h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                {incomingCall.type === "audio" ? "Appel audio" : "Appel vidéo"}
              </p>
              
              <div className="flex space-x-4">
                <Button 
                  onClick={handleRejectCall}
                  variant="destructive"
                  className="rounded-full w-12 h-12 p-0"
                >
                  <span className="material-icons">call_end</span>
                </Button>
                <Button 
                  onClick={handleAcceptCall}
                  variant="default"
                  className="rounded-full w-12 h-12 p-0 bg-green-600 hover:bg-green-700"
                >
                  <span className="material-icons">call</span>
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
      
      {/* Composant d'appel audio */}
      {callType === "audio" && selectedUser && (
        <AudioCall 
          user={selectedUser}
          isInitiator={callStatus === "calling"}
          onClose={handleEndCall}
          signalData={callStatus === "receiving" && incomingCall ? incomingCall.signal : undefined}
        />
      )}
      
      {/* Composant d'appel vidéo */}
      {callType === "video" && selectedUser && currentUser && (
        <VideoCall 
          userName={currentUser.displayName || currentUser.username}
          onClose={handleEndCall}
        />
      )}
    </section>
  );
}
