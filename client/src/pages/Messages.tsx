import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import ConversationList from "@/components/ConversationList";
import MessageList from "@/components/MessageList";
import ChatHeader from "@/components/ChatHeader";
import MessageInput from "@/components/MessageInput";
import useWebSocket from "@/hooks/useWebSocket";
import { API_ENDPOINTS, WS_EVENTS } from "@/lib/constants";
import { apiRequest, getQueryFn } from "@/lib/queryClient";
import { fileToDataUrl } from "@/lib/utils";
import { User, Message } from "@shared/schema";

export default function Messages() {
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
  const queryClient = useQueryClient();
  const { status: wsStatus, sendMessage, addMessageHandler } = useWebSocket();

  // Fetch conversations
  const { data: conversations = [] as any[] } = useQuery<any[]>({
    queryKey: [API_ENDPOINTS.CONVERSATIONS],
  });

  // Fetch all users
  const { data: usersResponse } = useQuery({
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

  // Fetch messages for active conversation
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
      // Invalidate messages query to refresh the list
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES, variables.conversationId] });
      
      // Send websocket notification
      sendMessage(WS_EVENTS.NEW_MESSAGE, {
        message: data,
        conversationId: variables.conversationId,
      });
    },
  });

  // Handle sending a new message
  const handleSendMessage = (text: string, file: File | null = null) => {
    if (!activeConversationId || !text.trim()) return;
    
    sendMessageMutation.mutate({
      text,
      file,
      conversationId: activeConversationId,
    });
  };

  // WebSocket handler for new messages
  useEffect(() => {
    const removeHandler = addMessageHandler(WS_EVENTS.NEW_MESSAGE, (data) => {
      // If the message is for the active conversation, refresh messages
      if (data.conversationId === activeConversationId) {
        queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES, activeConversationId] });
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
    <section className="flex-1 flex overflow-hidden">
      {/* Contacts/Conversations List */}
      <ConversationList 
        conversations={conversations}
        activeConversationId={activeConversationId}
        onSelectConversation={setActiveConversationId}
        users={users}
      />
      
      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Chat Header */}
        <ChatHeader user={activeUser} />
        
        {/* Messages Container */}
        {activeConversationId ? (
          <>
            <MessageList 
              messages={messages as any}
              currentUserId={currentUser?.id || 0}
              users={users}
            />
            
            {/* Message Input Area */}
            <MessageInput onSendMessage={handleSendMessage} />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400 p-6">
            <div className="text-center">
              <span className="material-icons text-6xl mb-4">chat</span>
              <h3 className="text-xl font-medium mb-2">Sélectionnez une conversation</h3>
              <p>Choisissez un contact dans la liste pour commencer à échanger</p>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
