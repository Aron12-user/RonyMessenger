interface UserAvatarProps {
  initials: string;
  color?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function UserAvatar({ 
  initials, 
  color = 'blue', 
  size = 'md' 
}: UserAvatarProps) {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base'
  };

  const colorClasses = {
    blue: 'bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200',
    green: 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200',
    purple: 'bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200',
    red: 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200',
    yellow: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200',
    gray: 'bg-gray-300 dark:bg-gray-600 text-gray-800 dark:text-gray-200',
    primary: 'bg-primary text-white'
  };

  return (
    <div className={`${sizeClasses[size]} rounded-full ${colorClasses[color as keyof typeof colorClasses]} flex items-center justify-center font-medium`}>
      {initials}
    </div>
  );
}
