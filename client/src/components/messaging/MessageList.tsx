import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Message, User } from "@shared/schema";
import { API_ENDPOINTS } from "@/lib/constants";
import MessageItem from './MessageItem';
import TypingIndicator from './TypingIndicator';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Pin, ArrowDown } from 'lucide-react';

interface MessageListProps {
  conversationId: number;
  currentUser: User;
  users: Record<number, User>;
  onReply: (message: Message) => void;
  typingUsers: User[];
  className?: string;
}

export default function MessageList({
  conversationId,
  currentUser,
  users,
  onReply,
  typingUsers,
  className = ""
}: MessageListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState<number | null>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [expandedThreads, setExpandedThreads] = useState<Set<number>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch messages
  const { data: messagesData, isLoading } = useQuery({
    queryKey: [API_ENDPOINTS.MESSAGES, conversationId],
    queryFn: getQueryFn(`${API_ENDPOINTS.MESSAGES}/${conversationId}`),
    enabled: !!conversationId,
    refetchInterval: 3000, // Poll for new messages
  });

  // Fetch pinned messages
  const { data: pinnedMessages } = useQuery({
    queryKey: [API_ENDPOINTS.MESSAGES, conversationId, 'pinned'],
    queryFn: getQueryFn(`${API_ENDPOINTS.MESSAGES}/${conversationId}/pinned`),
    enabled: !!conversationId,
  });

  const messages = messagesData || [];
  const pinned = pinnedMessages || [];

  // Scroll to bottom on new messages
  useEffect(() => {
    const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    if (messages.length > 0) {
      const timer = setTimeout(scrollToBottom, 100);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  // Handle scroll to show/hide scroll button
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 100;
      setShowScrollButton(!isNearBottom);
    };

    container.addEventListener('scroll', handleScroll);
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Filter messages based on search
  const filteredMessages = searchQuery
    ? messages.filter((message: Message) =>
        message.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
        message.fileName?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : messages;

  // Group messages by threads
  const groupedMessages = filteredMessages.reduce((acc: any[], message: Message) => {
    if (!message.replyToId) {
      // Main message
      const messageWithReplies = {
        ...message,
        replies: filteredMessages.filter(m => m.replyToId === message.id)
      };
      acc.push(messageWithReplies);
    }
    return acc;
  }, []);

  const handleScrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleToggleThread = (messageId: number) => {
    setExpandedThreads(prev => {
      const newSet = new Set(prev);
      if (newSet.has(messageId)) {
        newSet.delete(messageId);
      } else {
        newSet.add(messageId);
      }
      return newSet;
    });
  };

  const handleSearchMessage = (messageId: number) => {
    setHighlightedMessageId(messageId);
    const messageElement = document.getElementById(`message-${messageId}`);
    if (messageElement) {
      messageElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => setHighlightedMessageId(null), 3000);
    }
  };

  const renderMessage = (message: any, isReply = false) => {
    const messageUser = users[message.senderId] || {
      id: message.senderId,
      username: 'Utilisateur inconnu',
      displayName: 'Utilisateur inconnu'
    };

    const messageWithSender = {
      ...message,
      sender: messageUser,
      reactions: message.reactions || [],
      replyTo: message.replyTo ? {
        ...message.replyTo,
        sender: users[message.replyTo.senderId] || messageUser
      } : undefined
    };

    return (
      <div
        key={message.id}
        id={`message-${message.id}`}
        className={`${
          highlightedMessageId === message.id ? 'bg-yellow-100 dark:bg-yellow-900/20' : ''
        } transition-colors duration-300`}
      >
        <MessageItem
          message={messageWithSender}
          currentUser={currentUser}
          users={users}
          onReply={onReply}
          isThread={isReply}
          showThread={expandedThreads.has(message.id)}
          onToggleThread={handleToggleThread}
        />
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Search bar */}
      {showSearch && (
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher dans les messages..."
              className="pl-10"
              autoFocus
            />
          </div>
          {searchQuery && (
            <div className="mt-2 text-sm text-gray-600">
              {filteredMessages.length} message(s) trouvé(s)
            </div>
          )}
        </div>
      )}

      {/* Pinned messages */}
      {pinned.length > 0 && !searchQuery && (
        <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-b">
          <div className="flex items-center gap-2 mb-2">
            <Pin className="h-4 w-4 text-yellow-600" />
            <span className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
              Messages épinglés
            </span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {pinned.map((message: Message) => (
              <div
                key={message.id}
                className="p-2 bg-white dark:bg-gray-800 rounded border cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                onClick={() => handleSearchMessage(message.id)}
              >
                <p className="text-sm truncate">{message.content}</p>
                <span className="text-xs text-gray-500">
                  {users[message.senderId]?.displayName || users[message.senderId]?.username}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Header with actions */}
      <div className="flex items-center justify-between p-4 border-b">
        <span className="text-sm text-gray-600">
          {messages.length} message(s)
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setShowSearch(!showSearch)}
          className="h-8"
        >
          <Search className="h-4 w-4" />
        </Button>
      </div>

      {/* Messages container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <Search className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              {searchQuery ? 'Aucun message trouvé' : 'Aucun message'}
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery 
                ? 'Essayez d\'autres mots-clés'
                : 'Soyez le premier à envoyer un message'
              }
            </p>
          </div>
        ) : (
          <>
            {groupedMessages.map((message) => (
              <div key={message.id} className="space-y-2">
                {/* Main message */}
                {renderMessage(message)}
                
                {/* Thread replies */}
                {expandedThreads.has(message.id) && message.replies?.length > 0 && (
                  <div className="ml-8 space-y-2 border-l-2 border-gray-200 dark:border-gray-700 pl-4">
                    {message.replies.map((reply: Message) => renderMessage(reply, true))}
                  </div>
                )}
                
                {/* Thread toggle for messages with replies */}
                {message.replies?.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleThread(message.id)}
                    className="ml-8 text-blue-600 hover:text-blue-800"
                  >
                    {expandedThreads.has(message.id) 
                      ? `Masquer ${message.replies.length} réponse(s)`
                      : `Voir ${message.replies.length} réponse(s)`
                    }
                  </Button>
                )}
              </div>
            ))}
          </>
        )}

        {/* Typing indicator */}
        {typingUsers.length > 0 && (
          <TypingIndicator users={typingUsers} />
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollButton && (
        <div className="absolute bottom-20 right-6">
          <Button
            size="sm"
            onClick={handleScrollToBottom}
            className="rounded-full w-10 h-10 p-0 shadow-lg"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}