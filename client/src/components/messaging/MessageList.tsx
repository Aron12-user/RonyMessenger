import React, { useEffect, useRef, useState } from 'react';
import { useQuery } from "@tanstack/react-query";
import { getQueryFn } from "@/lib/queryClient";
import { Message, User } from "@shared/schema";
import { API_ENDPOINTS } from "@/lib/constants";
import MessageItem from './MessageItem';
// import TypingIndicator from './TypingIndicator'; // Commenté temporairement
import { Button } from "@/components/ui/button";

import { ArrowDown } from 'lucide-react';

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



  const messages = messagesData || [];

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

  // Use all messages without search filtering
  const filteredMessages = messages;

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


      {/* Messages container */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        style={{ scrollBehavior: 'smooth' }}
      >
        {groupedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
              <ArrowDown className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
              Aucun message
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Soyez le premier à envoyer un message
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
          <div className="p-2 text-sm text-gray-500 italic">
            {typingUsers.map(u => u.displayName || u.username).join(', ')} {typingUsers.length === 1 ? 'écrit' : 'écrivent'}...
          </div>
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