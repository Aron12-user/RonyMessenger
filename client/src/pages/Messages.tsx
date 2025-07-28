import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { getQueryFn, apiRequest } from "@/lib/queryClient";
import { API_ENDPOINTS } from "@/lib/constants";
import { Message, User, Conversation } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

// Enhanced messaging components
import MessageList from '@/components/messaging/MessageList';
import MessageInput from '@/components/messaging/MessageInput';
import ConversationList from '@/components/ConversationList';
import { Button } from "@/components/ui/button";

import { 
  Plus, 
  Settings, 
  Users, 
  Phone, 
  Video, 
  Info,
  Archive,
  Star,
  MoreVertical
} from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Messages() {
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null);

  const [showNewConversation, setShowNewConversation] = useState(false);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [replyToMessage, setReplyToMessage] = useState<Message | null>(null);
  const [typingUsers, setTypingUsers] = useState<User[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<number>>(new Set());

  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch conversations
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery<Conversation[]>({
    queryKey: [API_ENDPOINTS.CONVERSATIONS],
    queryFn: () => fetch(API_ENDPOINTS.CONVERSATIONS, { credentials: 'include' }).then(res => res.json()),
  });

  // Fetch all users
  const { data: usersResponse } = useQuery<{data: User[]}>({
    queryKey: [API_ENDPOINTS.USERS],
    queryFn: () => fetch(API_ENDPOINTS.USERS, { credentials: 'include' }).then(res => res.json()),
  });

  const users = usersResponse?.data || [];
  const usersRecord = users.reduce((acc, user) => {
    acc[user.id] = user;
    return acc;
  }, {} as Record<number, User>);

  // Get active conversation data
  const activeConversation = conversations.find(c => c.id === activeConversationId);
  const activeUser = activeConversation ? (
    usersRecord[activeConversation.creatorId === currentUser?.id 
      ? activeConversation.participantId 
      : activeConversation.creatorId]
  ) : null;

  // Fetch typing indicators for active conversation
  const { data: typingData } = useQuery({
    queryKey: ['/api/conversations', activeConversationId, 'typing'],
    queryFn: () => fetch(`/api/conversations/${activeConversationId}/typing`, { credentials: 'include' }).then(res => res.json()),
    enabled: !!activeConversationId,
    refetchInterval: 1000, // Poll every second
  });

  useEffect(() => {
    if (typingData && Array.isArray(typingData)) {
      setTypingUsers(typingData.filter((user: User) => user.id !== currentUser?.id));
    }
  }, [typingData, currentUser?.id]);

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (participantId: number) => {
      return apiRequest("POST", API_ENDPOINTS.CONVERSATIONS, { participantId });
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
      setActiveConversationId(data.id);
      setShowNewConversation(false);
      setSelectedUser('');
      toast({
        title: "Nouvelle conversation",
        description: "Conversation créée avec succès"
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la conversation",
        variant: "destructive"
      });
    }
  });

  // Handle typing indicators
  const handleStartTyping = () => {
    if (activeConversationId) {
      apiRequest("POST", `/api/conversations/${activeConversationId}/typing`, { isTyping: true });
    }
  };

  const handleStopTyping = () => {
    if (activeConversationId) {
      apiRequest("POST", `/api/conversations/${activeConversationId}/typing`, { isTyping: false });
    }
  };

  const handleReply = (message: Message) => {
    setReplyToMessage(message);
  };

  const handleCancelReply = () => {
    setReplyToMessage(null);
  };

  const handleNewConversation = () => {
    if (!selectedUser) return;
    
    const participantId = parseInt(selectedUser);
    createConversationMutation.mutate(participantId);
  };

  // Use all conversations without filtering
  const filteredConversations = conversations;

  // Available users for new conversations (excluding current user and existing conversations)
  const availableUsers = users.filter(user => {
    if (user.id === currentUser?.id) return false;
    
    const hasConversation = conversations.some(conv => 
      conv.creatorId === user.id || conv.participantId === user.id
    );
    
    return !hasConversation;
  });

  if (!currentUser) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-gray-500">Vous devez être connecté pour accéder aux messages</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full soft-card" data-theme-target="content">
      {/* Sidebar - Conversations */}
      <div className="w-80 border-r soft-border flex flex-col">
        {/* Header */}
        <div className="p-4 border-b soft-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-light text-theme-text">
              Messages
            </h1>
            
            <div className="flex items-center gap-2">
              {/* New conversation dialog */}
              <Dialog open={showNewConversation} onOpenChange={setShowNewConversation}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 soft-button">
                    <Plus className="h-4 w-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Nouvelle conversation</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-medium">Choisir un utilisateur</label>
                      <Select value={selectedUser} onValueChange={setSelectedUser}>
                        <SelectTrigger className="mt-1">
                          <SelectValue placeholder="Sélectionner un utilisateur" />
                        </SelectTrigger>
                        <SelectContent>
                          {availableUsers.map(user => (
                            <SelectItem key={user.id} value={user.id.toString()}>
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-green-500 rounded-full" />
                                <span>{user.displayName || user.username}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowNewConversation(false)}>
                        Annuler
                      </Button>
                      <Button 
                        onClick={handleNewConversation}
                        disabled={!selectedUser || createConversationMutation.isPending}
                      >
                        Créer
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <Button size="sm" variant="ghost" className="h-8 w-8 p-0">
                <Settings className="h-4 w-4" />
              </Button>
            </div>
          </div>


        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto">
          {conversationsLoading ? (
            <div className="flex items-center justify-center p-8">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-500"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-16 h-16 soft-card rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-theme-text-muted" />
              </div>
              <h3 className="text-lg font-light text-theme-text mb-2">
                Aucune conversation
              </h3>
              <p className="text-theme-text-muted mb-4">
                Commencez une nouvelle conversation
              </p>
              <Button onClick={() => setShowNewConversation(true)} className="soft-button">
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle conversation
              </Button>
            </div>
          ) : (
            <ConversationList
              conversations={filteredConversations}
              activeConversationId={activeConversationId}
              onSelectConversation={setActiveConversationId}
              users={usersRecord}
            />
          )}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {activeConversationId && activeUser ? (
          <>
            {/* Chat header */}
            <div className="p-4 border-b soft-border soft-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-medium">
                        {(activeUser.displayName || activeUser.username).charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className={`absolute -bottom-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${
                      onlineUsers.has(activeUser.id) ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  </div>
                  
                  <div>
                    <h2 className="font-light text-theme-text">
                      {activeUser.displayName || activeUser.username}
                    </h2>
                    <p className="text-sm text-theme-text-muted">
                      {onlineUsers.has(activeUser.id) ? 'En ligne' : 'Hors ligne'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 soft-button">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 soft-button">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 soft-button">
                    <Info className="h-4 w-4" />
                  </Button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 soft-button">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Star className="h-4 w-4 mr-2" />
                        Marquer comme favori
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Archive className="h-4 w-4 mr-2" />
                        Archiver la conversation
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>

            {/* Messages */}
            <MessageList
              conversationId={activeConversationId}
              currentUser={currentUser}
              users={usersRecord}
              onReply={handleReply}
              typingUsers={typingUsers}
              className="flex-1 min-h-0"
            />

            {/* Message input */}
            <MessageInput
              conversationId={activeConversationId}
              onMessageSent={() => {
                queryClient.invalidateQueries({ queryKey: [API_ENDPOINTS.CONVERSATIONS] });
              }}
              replyToMessage={replyToMessage as any}
              onCancelReply={handleCancelReply}
              onStartTyping={handleStartTyping}
              onStopTyping={handleStopTyping}
            />
          </>
        ) : (
          /* No conversation selected */
          <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-800">
            <div className="text-center">
              <div className="w-20 h-20 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="h-10 w-10 text-gray-400" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Sélectionnez une conversation
              </h2>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
                Choisissez une conversation existante ou créez-en une nouvelle
              </p>
              <Button onClick={() => setShowNewConversation(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Nouvelle conversation
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}