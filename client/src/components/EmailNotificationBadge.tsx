import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface EmailNotificationBadgeProps {
  unreadCount: number;
  className?: string;
}

export default function EmailNotificationBadge({ unreadCount, className = '' }: EmailNotificationBadgeProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    if (unreadCount > 0) {
      setIsAnimating(true);
      const timer = setTimeout(() => setIsAnimating(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [unreadCount]);

  if (unreadCount === 0) {
    return <Bell className={`h-5 w-5 ${className}`} />;
  }

  return (
    <div className="relative">
      <Bell className={`h-5 w-5 ${className} ${isAnimating ? 'animate-pulse' : ''}`} />
      <Badge 
        className={`absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center text-xs font-bold bg-red-500 text-white rounded-full ${isAnimating ? 'animate-bounce' : ''}`}
      >
        {unreadCount > 99 ? '99+' : unreadCount}
      </Badge>
    </div>
  );
}