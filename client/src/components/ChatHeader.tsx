import UserAvatar from "./UserAvatar";
import StatusIndicator from "./StatusIndicator";
import { User } from "@shared/schema";

interface ChatHeaderProps {
  user: User | null;
}

export default function ChatHeader({ user }: ChatHeaderProps) {
  if (!user) {
    return (
      <div className="py-3 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center">
        <div className="flex-1">
          <h3 className="font-medium">Select a conversation</h3>
        </div>
      </div>
    );
  }

  const getStatusText = (status: string) => {
    switch(status) {
      case 'online': return 'Online • Last seen just now';
      case 'away': return 'Away • Last seen recently';
      case 'busy': return 'Busy • Last seen recently';
      case 'offline': return 'Offline • Last seen a while ago';
      default: return 'Offline';
    }
  };

  return (
    <div className="py-3 px-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex items-center">
      <div className="flex items-center flex-1">
        <div className="relative">
          <UserAvatar 
            initials={`${user.username.charAt(0)}${user.username.charAt(Math.min(1, user.username.length - 1))}`.toUpperCase()} 
            color={getColorForUser(user.id)}
          />
          <StatusIndicator status={user.status} />
        </div>
        <div className="ml-3">
          <h3 className="font-medium">{user.displayName || user.username}</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">{getStatusText(user.status)}</p>
        </div>
      </div>
      
      <div className="flex space-x-2">
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <span className="material-icons">call</span>
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <span className="material-icons">videocam</span>
        </button>
        <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full">
          <span className="material-icons">more_vert</span>
        </button>
      </div>
    </div>
  );
}

// Helper function
function getColorForUser(userId: number): 'blue' | 'green' | 'purple' | 'red' | 'yellow' {
  const colors = ['blue', 'green', 'purple', 'red', 'yellow'];
  return colors[userId % colors.length] as 'blue' | 'green' | 'purple' | 'red' | 'yellow';
}
