
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConversationList from "@/components/ConversationList";
import MessageList from "@/components/MessageList";
import ChatHeader from "@/components/ChatHeader";
import MessageInput from "@/components/MessageInput";
import useWebSocket from "@/hooks/useWebSocket";
import { API_ENDPOINTS, WS_EVENTS } from "@/lib/constants";
import { apiRequest } from "@/lib/queryClient";
import { fileToDataUrl } from "@/lib/utils";
import { User, Message } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function Messages() {
  const { toast } = useToast();
  
  // Obtenir l'ID de conversation depuis les paramètres d'URL s'il existe
  const getConversationParam = () => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const conversationId = urlParams.get('conversation');
      return conversationId ? parseInt(conversationId, 10) : null;
    }
    return null;
  };

  const [activeConversationId, setActiveConversationId] = useState<number | null>(getConversationParam());

  // Surveiller les changements d'URL pour détecter les nouveaux paramètres de conversation
  useEffect(() => {
    const handleLocationChange = () => {
      const newConversationId = getConversationParam();
      if (newConversationId && newConversationId !== activeConversationId) {
        setActiveConversationId(newConversationId);
        // Nettoyer l'URL après avoir activé la conversation (optionnel)
        setTimeout(() => {
          window.history.replaceState({}, '', '/');
        }, 1000);
      }
    };

    // Écouter les changements de l'historique du navigateur
    window.addEventListener('popstate', handleLocationChange);
    
    // Vérifier immédiatement si il y a un paramètre de conversation
    handleLocationChange();

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
    };
  }, [activeConversationId]);

  // Effet pour détecter les nouveaux paramètres quand le composant se monte
  useEffect(() => {
    const urlConversationId = getConversationParam();
    if (urlConversationId && urlConversationId !== activeConversationId) {
      setActiveConversationId(urlConversationId);
    }
  }, []);

  const queryClient = useQueryClient();
  const { status: wsStatus, sendMessage, addMessageHandler } = useWebSocket();

  // Fetch conversations
  const { data: conversations = [] as any[] } = useQuery<any[]>({
    queryKey: [API_ENDPOINTS.CONVERSATIONS],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Fetch all users
  const { data: usersResponse } = useQuery<{data: User[]}>({
    queryKey: [API_ENDPOINTS.USERS],
  });

  // Extraire les données des utilisateurs de la réponse paginée
  const usersData = usersResponse?.data || [];

  // Fetch current user
  const { data: currentUser = {} as User } = useQuery<User>({
    queryKey: [API_ENDPOINTS.USER],
  });

  // Convert users array to map for easy access
  const users: Record<number, User> = usersData.reduce((acc: Record<number, User>, user: User) => {
    acc[user.id] = user;
    return acc;
  }, {});

  // Fetch messages for active conversation with real-time updates
  const { data: messages = [] as any[] } = useQuery<any[]>({
    queryKey: [API_ENDPOINTS.MESSAGES, activeConversationId],
    queryFn: async () => {
      if (!activeConversationId) return [];
      const res = await fetch(`${API_ENDPOINTS.MESSAGES}/${activeConversationId}`);
      if (!res.ok) {
        if (res.status === 401) throw new Error('Non authentifié');
        throw new Error('Erreur lors de la récupération des messages');
      }
      return res.json();
    },
    enabled: !!activeConversationId,
    refetchInterval: 2000, // Refresh every 2 seconds for real-time feel
  });

  // Get active conversation partner
  const activeUser = activeConversationId 
    ? users[conversations.find((c: any) => c.id === activeConversationId)?.participantId] 
    : null;

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async ({ text, file, conversationId }: { text: string, file: File | null, conversationId: number }) => {
      let fileUrl = null;

      if (file) {
        // In a real app, you'd upload the file to a server and get back a URL
        // For this example, we'll just convert it to a data URL
        fileUrl = await fileToDataUrl(file);
      }

      const res = await apiRequest("POST", `${API_ENDPOINTS.MESSAGES}/${conversationId}`, {
        content: text,
        fileUrl,
      });

      return res.json();
    },
    onSuccess: (data, variables) => {
      // Immediately update messages to show the new message
      queryClient.setQueryData([API_ENDPOINTS.MESSAGES, variables.conversationId], (oldMessages: any[] = []) => {
        return [...oldMessages, data];
      });

      // Update conversations list
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });

      // Send websocket notification
      sendMessage(WS_EVENTS.NEW_MESSAGE, {
        message: data,
        conversationId: variables.conversationId,
      });
    },
  });

  // Handle sending a new message
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [typingUsers, setTypingUsers] = useState<{[key: number]: boolean}>({});
  const [activeCall, setActiveCall] = useState<{
    type: "audio" | "video";
    user: User;
  } | null>(null);

  useEffect(() => {
    addMessageHandler(WS_EVENTS.USER_STATUS, ({userId, status}) => {
      setOnlineUsers(prev => 
        status === 'online' 
          ? [...prev, userId]
          : prev.filter(id => id !== userId)
      );
    });

    addMessageHandler(WS_EVENTS.USER_TYPING, ({userId, isTyping}) => {
      setTypingUsers(prev => ({...prev, [userId]: isTyping}));
    });
  }, [addMessageHandler]);

  const handleStartCall = (type: "audio" | "video") => {
    if (!activeUser) return;
    setActiveCall({ type, user: activeUser });
  };

  const handleEndCall = () => {
    setActiveCall(null);
    sendMessage(WS_EVENTS.CALL_ENDED, {
      target: activeUser?.id
    });
  };

  const handleSendMessage = async (text: string, file: File | null = null) => {
    if (!activeConversationId) return;

    try {
      sendMessageMutation.mutate({
        text,
        file,
        conversationId: activeConversationId,
      });
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer le message",
        variant: "destructive"
      });
    }
  };

  const handleMessageRead = async (messageId: number) => {
    try {
      await apiRequest("PUT", `${API_ENDPOINTS.MESSAGES}/${messageId}/read`, {});
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
    } catch (error) {
      console.error('Error marking message as read:', error);
    }
  };

  // WebSocket handler for new messages - Real-time updates
  useEffect(() => {
    const removeHandler = addMessageHandler(WS_EVENTS.NEW_MESSAGE, (data) => {
      // If the message is for the active conversation, immediately add it
      if (data.conversationId === activeConversationId) {
        queryClient.setQueryData([API_ENDPOINTS.MESSAGES, activeConversationId], (oldMessages: any[] = []) => {
          // Check if message already exists to avoid duplicates
          const messageExists = oldMessages.some(msg => msg.id === data.message.id);
          if (!messageExists) {
            return [...oldMessages, data.message];
          }
          return oldMessages;
        });
      }

      // Always refresh conversations list to update last message and unread count
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
    });

    return () => removeHandler();
  }, [addMessageHandler, activeConversationId, queryClient]);

  // Mark messages as read when opening a conversation
  useEffect(() => {
    if (activeConversationId) {
      apiRequest("PUT", `${API_ENDPOINTS.CONVERSATIONS}/${activeConversationId}/read`, {})
        .then(() => {
          // Refresh conversations list to update unread counts
          queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
        });
    }
  }, [activeConversationId, queryClient]);

  return (
    <section 
      className="flex-1 flex overflow-hidden"
      style={{ background: 'var(--color-background)' }}
    >
      {/* Contacts/Conversations List */}
      <ConversationList 
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        users={users}
      />

      {/* Chat Area */}
      <div 
        className="flex-1 flex flex-col"
        style={{ background: 'var(--color-background)' }}
      >
        {/* Chat Header */}
        {activeUser && (
          <ChatHeader 
            user={activeUser} 
            onlineUsers={onlineUsers}
            isOnline={onlineUsers.includes(activeUser.id)}
          />
        )}

        {/* Messages Container */}
        {activeConversationId ? (
          <>
            <MessageList 
              messages={messages as any}
              currentUserId={currentUser?.id || 0}
              users={users}
              onMessageRead={handleMessageRead}
              onlineUsers={onlineUsers}
            />

            {/* Message Input Area */}
            <MessageInput 
              onSendMessage={handleSendMessage} 
              onStartCall={handleStartCall} 
              onEndCall={handleEndCall} 
              activeCall={activeCall}
            />
          </>
        ) : (
          <div 
            className="flex-1 flex items-center justify-center p-6"
            style={{ color: 'var(--color-textMuted)' }}
          >
            <div className="text-center">
              <span className="material-icons text-6xl mb-4 opacity-30">chat</span>
              <h3 className="text-xl font-medium mb-2">Sélectionnez une conversation</h3>
              <p>Choisissez un contact dans la liste pour commencer à échanger</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
