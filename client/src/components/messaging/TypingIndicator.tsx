import React from 'react';
import { User } from "@shared/schema";

interface TypingIndicatorProps {
  users: User[];
}

export default function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const formatTypingText = () => {
    if (users.length === 1) {
      return `${users[0].displayName || users[0].username} est en train d'écrire...`;
    } else if (users.length === 2) {
      return `${users[0].displayName || users[0].username} et ${users[1].displayName || users[1].username} sont en train d'écrire...`;
    } else {
      return `${users.length} personnes sont en train d'écrire...`;
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 text-sm text-gray-500">
      <div className="flex gap-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
      </div>
      <span>{formatTypingText()}</span>
    </div>
  );
}