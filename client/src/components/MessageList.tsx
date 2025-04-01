import { useEffect, useRef } from "react";
import UserAvatar from "./UserAvatar";
import { Message, User } from "@shared/schema";
import AttachmentPreview from './AttachmentPreview'; // Assuming this component exists

interface MessageListProps {
  messages: Message[];
  currentUserId: number;
  users: Record<number, User>;
}

export default function MessageList({ messages, currentUserId, users }: MessageListProps) {
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

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
      {/* Render messages grouped by date */}
      {Object.entries(messagesByDate).map(([date, dateMessages]) => (
        <div key={date}>
          {/* Date Separator */}
          <div className="flex items-center justify-center my-4">
            <div className="bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 text-xs px-3 py-1 rounded-full">
              {formatMessageDate(date)}
            </div>
          </div>

          {/* Messages for this date */}
          {dateMessages.map(message => {
            const isCurrentUser = message.senderId === currentUserId;
            const user = users[message.senderId];

            if (!user) return null;

            return (
              <div 
                key={message.id}
                className={`flex items-start gap-2 mb-4 ${isCurrentUser ? 'ml-auto max-w-[80%]' : 'max-w-[80%]'}`}
              >
                {!isCurrentUser && (
                  <UserAvatar 
                    size="sm"
                    initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()}
                    color={getColorForUser(user.id)}
                  />
                )}

                <div className={`flex flex-col ${isCurrentUser ? 'items-end' : ''}`}>
                  <div className={`${
                    isCurrentUser 
                      ? 'bg-primary text-white' 
                      : 'bg-white dark:bg-gray-800 shadow-sm'
                    } rounded-lg px-4 py-2 break-words`}
                  >
                    {message.content}
                  </div>

                  {message.fileUrl && message.encryptionKey && (
                    <div className="mt-2 max-w-[300px]">
                      <AttachmentPreview 
                        fileUrl={message.fileUrl}
                        encryptionKey={message.encryptionKey}
                        fileName={message.fileName}
                        fileType={message.fileType}
                      />
                    </div>
                  )}
                  
                  <span className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {formatMessageTime(message.timestamp)}
                  </span>
                </div>

                {isCurrentUser && (
                  <UserAvatar 
                    size="sm"
                    initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()}
                    color="primary"
                  />
                )}
              </div>
            );
          })}
        </div>
      ))}

      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
          <span className="material-icons text-4xl mb-2">chat</span>
          <p>No messages yet</p>
          <p className="text-sm">Start a conversation</p>
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
    return 'Today';
  }

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday';
  }

  // If within the last 7 days, show the day name
  const daysDiff = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (daysDiff < 7) {
    return date.toLocaleDateString([], { weekday: 'long' });
  }

  // Otherwise show the full date
  return date.toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
}