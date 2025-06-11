import React, { useState } from 'react';
import MeetingRoom from './MeetingRoom';
import { Button } from '@/components/ui/button';
import { Minimize2, Maximize2 } from 'lucide-react';

interface MeetingWindowProps {
  roomCode: string;
  userName: string;
  userId: number;
  onClose: () => void;
}

export default function MeetingWindow({ roomCode, userName, userId, onClose }: MeetingWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);

  const handleToggleMinimize = () => {
    setIsMinimized(!isMinimized);
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-gray-900 rounded-lg shadow-2xl border border-gray-700 overflow-hidden">
          <div className="bg-gray-800 p-3 flex items-center justify-between min-w-[250px]">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-white text-sm font-medium">Réunion en cours</span>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggleMinimize}
                className="h-6 w-6 p-0 text-gray-400 hover:text-white"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="p-3 bg-gray-900">
            <p className="text-gray-300 text-xs">Code: {roomCode}</p>
            <p className="text-gray-400 text-xs">{userName}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* En-tête avec contrôles */}
      <div className="bg-gray-900 p-2 flex justify-between items-center flex-shrink-0">
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-white text-sm font-medium">Réunion Rony</span>
          </div>
          <span className="text-gray-400 text-sm">Code: {roomCode}</span>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleToggleMinimize}
            className="text-gray-400 hover:text-white"
          >
            <Minimize2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Zone de réunion */}
      <div className="flex-1 overflow-hidden">
        <MeetingRoom
          roomCode={roomCode}
          userName={userName}
          userId={userId}
          onClose={onClose}
          showControls={false}
        />
      </div>
    </div>
  );
}