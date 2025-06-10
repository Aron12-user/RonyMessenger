
import UserAvatar from "./UserAvatar";
import { User } from "@shared/schema";

interface ChatHeaderProps {
  user: User | null;
  onlineUsers?: number[];
  isOnline?: boolean;
}

export default function ChatHeader({ user, onlineUsers = [], isOnline = false }: ChatHeaderProps) {
  if (!user) return null;

  return (
    <div 
      className="flex items-center justify-between p-4 border-b"
      style={{ 
        background: 'var(--color-surface)',
        borderColor: 'var(--color-border)'
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <UserAvatar
            size="md"
            initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()}
            color={getColorForUser(user.id)}
          />
          {isOnline && (
            <div 
              className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2"
              style={{ 
                background: '#10B981',
                borderColor: 'var(--color-surface)'
              }}
            />
          )}
        </div>

        <div>
          <h3 
            className="font-semibold"
            style={{ color: 'var(--color-text)' }}
          >
            {user.displayName || user.username}
          </h3>
          <p 
            className="text-sm"
            style={{ color: 'var(--color-textMuted)' }}
          >
            {isOnline ? 'En ligne' : 'Hors ligne'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button 
          className="p-2 rounded-full hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-textMuted)' }}
        >
          <span className="material-icons">videocam</span>
        </button>
        <button 
          className="p-2 rounded-full hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-textMuted)' }}
        >
          <span className="material-icons">call</span>
        </button>
        <button 
          className="p-2 rounded-full hover:opacity-70 transition-opacity"
          style={{ color: 'var(--color-textMuted)' }}
        >
          <span className="material-icons">more_vert</span>
        </button>
      </div>
    </div>
  );
}

function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}
