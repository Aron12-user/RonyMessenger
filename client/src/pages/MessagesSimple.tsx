import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Phone, Video, Send, Paperclip } from "lucide-react";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { API_ENDPOINTS } from "@/lib/constants";

export default function MessagesSimple() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const { user: currentUser } = useAuth();
  const queryClient = useQueryClient();

  // Fetch conversations and users
  const { data: conversations } = useQuery({
    queryKey: [API_ENDPOINTS.CONVERSATIONS],
    queryFn: getQueryFn(API_ENDPOINTS.CONVERSATIONS),
  });

  const { data: users } = useQuery({
    queryKey: [API_ENDPOINTS.USERS],
    queryFn: getQueryFn(API_ENDPOINTS.USERS),
  });

  const { data: messages } = useQuery({
    queryKey: [API_ENDPOINTS.MESSAGES, activeConversationId],
    queryFn: getQueryFn(`${API_ENDPOINTS.MESSAGES}/${activeConversationId}`),
    enabled: !!activeConversationId,
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: (data: { text: string; conversationId: number }) =>
      apiRequest(API_ENDPOINTS.MESSAGES, {
        method: "POST",
        body: data,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.MESSAGES, activeConversationId] });
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
      setNewMessage("");
    },
  });

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversationId) return;

    sendMessageMutation.mutate({
      text: newMessage,
      conversationId: activeConversationId,
    });
  };

  // Get active user for header
  const activeUser = conversations && activeConversationId && users
    ? (() => {
        const conversation = conversations.find((c: any) => c.id === activeConversationId);
        if (!conversation) return null;
        
        const otherUserId = conversation.creatorId === currentUser?.id 
          ? conversation.participantId 
          : conversation.creatorId;
        
        return users.data?.find((u: any) => u.id === otherUserId) || null;
      })()
    : null;

  return (
    <div className="flex h-full bg-gray-900">
      {/* Conversations Sidebar */}
      <div className="w-80 border-r border-gray-700 bg-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-700">
          <h2 className="text-lg font-semibold text-gray-100">Messages</h2>
        </div>
        
        {/* Conversations List */}
        <div className="flex-1 overflow-y-auto">
          {conversations?.map((conversation: any) => {
            const otherUserId = conversation.creatorId === currentUser?.id 
              ? conversation.participantId 
              : conversation.creatorId;
            const user = users?.data?.find((u: any) => u.id === otherUserId);
            const isActive = activeConversationId === conversation.id;

            if (!user) return null;

            return (
              <div
                key={conversation.id}
                onClick={() => setActiveConversationId(conversation.id)}
                className={`p-4 cursor-pointer border-b border-gray-700 hover:bg-gray-700 ${
                  isActive ? 'bg-gray-700' : ''
                }`}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {(user.displayName || user.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-baseline">
                      <h3 className="font-medium text-gray-100 truncate">
                        {user.displayName || user.username}
                      </h3>
                      <span className="text-xs text-gray-400">
                        {new Date(conversation.lastMessageTime).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate">
                      {conversation.lastMessage || "Aucun message"}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-gray-900">
        {activeConversationId && activeUser ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-700 bg-gray-800">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {(activeUser.displayName || activeUser.username).charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-100">
                      {activeUser.displayName || activeUser.username}
                    </h3>
                    <p className="text-xs text-gray-400">En ligne</p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-700">
                    <Phone size={18} />
                  </Button>
                  <Button variant="ghost" size="sm" className="text-gray-400 hover:text-white hover:bg-gray-700">
                    <Video size={18} />
                  </Button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages?.map((message: any) => {
                const isOwn = message.senderId === currentUser?.id;
                const sender = users?.data?.find((u: any) => u.id === message.senderId);

                return (
                  <div
                    key={message.id}
                    className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isOwn 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-700 text-gray-100'
                      }`}
                    >
                      {!isOwn && (
                        <p className="text-xs text-gray-400 mb-1">
                          {sender?.displayName || sender?.username}
                        </p>
                      )}
                      <p className="text-sm">{message.content}</p>
                      <p className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-gray-400'}`}>
                        {new Date(message.timestamp).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-gray-700 bg-gray-800">
              <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
                <Button type="button" variant="ghost" size="sm" className="text-gray-400 hover:text-white">
                  <Paperclip size={18} />
                </Button>
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Tapez votre message..."
                  className="flex-1 bg-gray-700 border-gray-600 text-gray-100 placeholder-gray-400 focus:border-blue-500"
                />
                <Button 
                  type="submit" 
                  disabled={!newMessage.trim() || sendMessageMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Send size={18} />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <div className="text-center">
              <MessageCircle size={48} className="mx-auto mb-4 text-gray-500" />
              <h3 className="text-lg font-medium mb-2 text-gray-300">Sélectionnez une conversation</h3>
              <p>Choisissez un contact dans la liste pour commencer à discuter</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}