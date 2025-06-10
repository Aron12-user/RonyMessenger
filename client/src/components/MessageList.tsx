
import { useEffect, useRef } from "react";
import UserAvatar from "./UserAvatar";
import { Message, User } from "@shared/schema";
import AttachmentPreview from './AttachmentPreview';

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  users: Record<number, User>;
  onMessageRead: (messageId: number) => void;
  onlineUsers: number[];
}

export default function MessageList({ messages, currentUserId, users, onMessageRead, onlineUsers }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Group messages by date for separators
  const messagesByDate: { [date: string]: Message[] } = {};

  messages.forEach(message => {
    const date = new Date(message.timestamp).toDateString();
    if (!messagesByDate[date]) {
      messagesByDate[date] = [];
    }
    messagesByDate[date].push(message);
  });

  useEffect(() => {
    // Mark visible messages as read
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const messageId = Number(entry.target.getAttribute('data-message-id'));
          if (messageId && onMessageRead) onMessageRead(messageId);
        }
      });
    });

    document.querySelectorAll('.message-item').forEach(msg => observer.observe(msg));
    return () => observer.disconnect();
  }, [messages, onMessageRead]);

  return (
    <div 
      className="flex-1 overflow-y-auto p-4 space-y-2"
      style={{ 
        background: 'var(--color-background)',
        backgroundImage: 'url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"%3E%3Cg fill="none" fill-rule="evenodd"%3E%3Cg fill="%23ffffff" fill-opacity="0.03"%3E%3Cpath d="M20 20c0-16.569-13.431-30-30-30s-30 13.431-30 30 13.431 30 30 30 30-13.431 30-30zM0 0h40v40H0V0z"/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")'
      }}
    >
      {/* Render messages grouped by date */}
      {Object.entries(messagesByDate).map(([date, dateMessages]) => (
        <div key={date}>
          {/* Date Separator */}
          <div className="flex items-center justify-center my-6">
            <div 
              className="text-xs px-3 py-1 rounded-full shadow-sm"
              style={{
                background: 'var(--color-surface)',
                color: 'var(--color-textMuted)',
                border: '1px solid var(--color-border)'
              }}
            >
              {formatMessageDate(date)}
            </div>
          </div>

          {/* Messages for this date */}
          {dateMessages.map((message, index) => {
            const isCurrentUser = message.senderId === currentUserId;
            const user = users[message.senderId];
            const prevMessage = dateMessages[index - 1];
            const nextMessage = dateMessages[index + 1];
            
            const isFirstInGroup = !prevMessage || prevMessage.senderId !== message.senderId;
            const isLastInGroup = !nextMessage || nextMessage.senderId !== message.senderId;

            if (!user) return null;

            return (
              <div 
                key={message.id}
                data-message-id={message.id}
                className={`flex items-end gap-2 mb-1 message-item ${
                  isCurrentUser ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                {/* Avatar - only show for last message in group and not current user */}
                {!isCurrentUser && isLastInGroup ? (
                  <UserAvatar 
                    size="sm"
                    initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()}
                    color={getColorForUser(user.id)}
                  />
                ) : !isCurrentUser ? (
                  <div className="w-8" />
                ) : null}

                <div className={`flex flex-col max-w-[70%] ${isCurrentUser ? 'items-end' : 'items-start'}`}>
                  {/* Message bubble */}
                  <div 
                    className={`px-3 py-2 break-words relative shadow-sm ${
                      isFirstInGroup && isLastInGroup ? 'rounded-lg' :
                      isFirstInGroup ? (isCurrentUser ? 'rounded-l-lg rounded-t-lg rounded-br-md' : 'rounded-r-lg rounded-t-lg rounded-bl-md') :
                      isLastInGroup ? (isCurrentUser ? 'rounded-l-lg rounded-b-lg rounded-tr-md' : 'rounded-r-lg rounded-b-lg rounded-tl-md') :
                      (isCurrentUser ? 'rounded-l-lg rounded-tr-md rounded-br-md' : 'rounded-r-lg rounded-tl-md rounded-bl-md')
                    }`}
                    style={{
                      background: isCurrentUser 
                        ? 'var(--color-primary)' 
                        : 'var(--color-surface)',
                      color: isCurrentUser 
                        ? 'white' 
                        : 'var(--color-text)',
                      border: !isCurrentUser ? '1px solid var(--color-border)' : 'none'
                    }}
                  >
                    {/* Show sender name for group messages */}
                    {!isCurrentUser && isFirstInGroup && (
                      <div 
                        className="text-xs font-medium mb-1"
                        style={{ color: getColorForUser(user.id) === 'blue' ? '#3B82F6' : '#10B981' }}
                      >
                        {user.displayName || user.username}
                      </div>
                    )}

                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {message.content}
                    </p>

                    {/* File attachment */}
                    {message.fileUrl && (
                      <div className="mt-2 max-w-[250px]">
                        <AttachmentPreview 
                          fileUrl={message.fileUrl}
                          fileName={message.fileName || 'Fichier'}
                          fileType={message.fileType || 'application/octet-stream'}
                          timestamp={message.timestamp}
                          senderId={message.senderId}
                          currentUserId={currentUserId}
                          onRemove={() => {}}
                          file={null}
                        />
                      </div>
                    )}

                    {/* Time and status */}
                    <div className={`flex items-center gap-1 mt-1 ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                      <span 
                        className="text-xs"
                        style={{ 
                          color: isCurrentUser ? 'rgba(255,255,255,0.7)' : 'var(--color-textMuted)' 
                        }}
                      >
                        {formatMessageTime(message.timestamp)}
                      </span>
                      {isCurrentUser && (
                        <span className="text-xs text-white/70">
                          <span className="material-icons text-sm">
                            {message.seen ? 'done_all' : 'done'}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}

      {messages.length === 0 && (
        <div 
          className="flex flex-col items-center justify-center h-full text-center"
          style={{ color: 'var(--color-textMuted)' }}
        >
          <span className="material-icons text-6xl mb-4 opacity-30">chat</span>
          <h3 className="text-xl font-medium mb-2">Aucun message</h3>
          <p className="text-sm">Commencez une conversation</p>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
}

// Helper functions
function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}

function formatMessageTime(timestamp: Date): string {
  return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatMessageDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();

  if (date.toDateString() === now.toDateString()) {
    return "Aujourd'hui";
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Hier';
  }

  // If within the last 7 days, show the day name
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return date.toLocaleDateString('fr-FR', { weekday: 'long' });
  }

  // Otherwise show the full date
  return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
}
