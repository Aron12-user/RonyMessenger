
import UserAvatar from "./UserAvatar";
import { User } from "@shared/schema";

interface ConversationListProps {
  conversations: any[];
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
  return (
    <div 
      className="w-80 border-r flex flex-col"
      style={{ 
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)'
      }}
    >
      {/* Header */}
      <div 
        className="p-4 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <h2 
          className="text-lg font-semibold"
          style={{ color: 'var(--color-text)' }}
        >
          Messages
        </h2>
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => {
          const user = users[conversation.participantId];
          if (!user) return null;

          const isActive = activeConversationId === conversation.id;

          return (
            <div
              key={conversation.id}
              onClick={() => onSelectConversation(conversation.id)}
              className={`p-4 cursor-pointer transition-all duration-200 hover:opacity-80 ${
                isActive ? 'opacity-100' : 'opacity-90'
              }`}
              style={{
                background: isActive 
                  ? 'var(--color-sidebarActive)' 
                  : 'transparent',
                borderBottom: '1px solid var(--color-border)'
              }}
            >
              <div className="flex items-center gap-3">
                <UserAvatar
                  size="md"
                  initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()}
                  color={getColorForUser(user.id)}
                />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 
                      className="font-medium truncate"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {user.displayName || user.username}
                    </h3>
                    {conversation.lastMessageTime && (
                      <span 
                        className="text-xs"
                        style={{ color: 'var(--color-textMuted)' }}
                      >
                        {getMessageTime(conversation.lastMessageTime)}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between mt-1">
                    <p 
                      className="text-sm truncate"
                      style={{ color: 'var(--color-textMuted)' }}
                    >
                      {conversation.lastMessage || "Aucun message"}
                    </p>
                    {conversation.unreadCount > 0 && (
                      <span 
                        className="text-xs px-2 py-1 rounded-full text-white min-w-[20px] text-center"
                        style={{ background: 'var(--color-primary)' }}
                      >
                        {conversation.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {conversations.length === 0 && (
          <div 
            className="flex flex-col items-center justify-center h-full p-6 text-center"
            style={{ color: 'var(--color-textMuted)' }}
          >
            <span className="material-icons text-4xl mb-2 opacity-30">chat</span>
            <p>Aucune conversation</p>
            <p className="text-sm mt-1">Allez dans Contacts pour commencer à discuter</p>
          </div>
        )}
      </div>
    </div>
  );
}

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
    return 'Hier';
  }
  
  // If this week
  const daysDiff = Math.floor((now.getTime() - messageDate.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return messageDate.toLocaleDateString('fr-FR', { weekday: 'long' });
  }
  
  // Otherwise show date
  return messageDate.toLocaleDateString('fr-FR', { month: 'short', day: 'numeric' });
}
