import { useState } from "react";
import UserAvatar from "./UserAvatar";
import StatusIndicator from "./StatusIndicator";
import { User, Conversation } from "@shared/schema";
import { useAuth } from "@/hooks/useAuth";

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: number | null;
  onSelectConversation: (id: number) => void;
  users: Record<number, User>;
}

export default function ConversationList({ 
  conversations, 
  activeConversationId, 
  onSelectConversation,
  users
}: ConversationListProps) {
  const { user: currentUser } = useAuth();

  return (
    <div className="w-72 border-r border-gray-200 dark:border-gray-700 overflow-y-auto scrollbar-thin bg-white dark:bg-gray-800">
      {/* Conversations Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
        <h2 className="text-lg font-semibold">Messages</h2>
        <button className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
          <span className="material-icons">add</span>
        </button>
      </div>
      
      {/* Conversations List */}
      <div className="space-y-1 p-2">
        {conversations.map((conversation) => {
          // Déterminer qui est l'autre personne dans la conversation
          const otherUserId = conversation.creatorId === currentUser?.id 
            ? conversation.participantId 
            : conversation.creatorId;
          const user = users[otherUserId];
          const isActive = activeConversationId === conversation.id;
          
          if (!user) return null;
          
          return (
            <div 
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={`p-2 rounded-lg flex items-center cursor-pointer ${
                isActive 
                  ? "bg-gray-100 dark:bg-gray-700" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-700"
              }`}
            >
              <div className="relative">
                <UserAvatar 
                  initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()} 
                  color={getColorForUser(user.id)}
                />
                <StatusIndicator status={user.status} />
              </div>
              <div className="ml-3 flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                  <h3 className="font-medium truncate">{user.displayName || user.username}</h3>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {getMessageTime(conversation.lastMessageTime)}
                  </span>
                </div>
                <p className={`text-sm truncate ${
                  conversation.unreadCount ? "font-semibold text-gray-600 dark:text-gray-300" : "text-gray-500 dark:text-gray-400"
                }`}>
                  {conversation.lastMessage}
                </p>
              </div>
              {conversation.unreadCount > 0 && (
                <div className="ml-2 w-5 h-5 bg-primary rounded-full flex items-center justify-center text-white text-xs">
                  {conversation.unreadCount}
                </div>
              )}
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div className="p-4 text-center text-gray-500 dark:text-gray-400">
            No conversations yet
          </div>
        )}
      </div>
    </div>
  );
}

// Helper functions
function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}

function getMessageTime(timestamp: Date | null): string {
  if (!timestamp) return '';
  
  const now = new Date();
  const messageDate = new Date(timestamp);
  
  // If today
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  
  // If yesterday
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (messageDate.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }
  
  // If this week
  const daysDiff = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return messageDate.toLocaleDateString([], { weekday: 'long' });
  }
  
  // Otherwise show date
  return messageDate.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
