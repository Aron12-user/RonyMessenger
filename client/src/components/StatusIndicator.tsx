export type UserStatus = 'online' | 'away' | 'busy' | 'offline';

interface StatusIndicatorProps {
  status: UserStatus;
  size?: 'sm' | 'md';
}

export default function StatusIndicator({ 
  status, 
  size = 'md' 
}: StatusIndicatorProps) {
  const getStatusColor = (status: UserStatus) => {
    switch (status) {
      case 'online': return 'bg-status-online';
      case 'away': return 'bg-status-away';
      case 'busy': return 'bg-status-busy';
      case 'offline': return 'bg-status-offline';
      default: return 'bg-status-offline';
    }
  };

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3'
  };

  return (
    <span className={`absolute bottom-0 right-0 ${sizeClasses[size]} rounded-full ${getStatusColor(status)} animate-status-pulse`}></span>
  );
}
