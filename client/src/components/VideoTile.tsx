import React from 'react';
import { Camera, MicOff, Hand, Monitor, Pin, Users } from 'lucide-react';

interface VideoTileProps {
  participant: {
    id: string;
    name: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
    isHandRaised?: boolean;
    isSpeaking?: boolean;
    isScreenSharing?: boolean;
    stream?: MediaStream;
  };
  isLocal?: boolean;
  videoRef?: React.RefObject<HTMLVideoElement>;
  isPinned?: boolean;
  className?: string;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  participant,
  isLocal = false,
  videoRef,
  isPinned = false,
  className = ""
}) => {
  return (
    <div className={`relative group ${className}`}>
      <div className="video-container relative bg-gray-800 overflow-hidden h-full min-h-[200px] rounded-xl shadow-2xl">
        {participant.videoEnabled && participant.stream ? (
          <video
            ref={videoRef}
            autoPlay
            muted={isLocal}
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-gray-600 rounded-full flex items-center justify-center mb-4">
              {isLocal ? (
                <Camera className="h-8 w-8 text-gray-400" />
              ) : (
                <Users className="h-8 w-8 text-gray-400" />
              )}
            </div>
            <p className="text-gray-300 text-lg font-medium">
              {participant.videoEnabled ? 'Chargement...' : 'Caméra désactivée'}
            </p>
          </div>
        )}
        
        {/* Participant info */}
        <div className="absolute bottom-4 left-4">
          <div className="bg-black/80 backdrop-blur-sm px-3 py-2 rounded-lg flex items-center space-x-2">
            <span className="text-white font-medium text-sm">
              {participant.name}{isLocal ? ' (Vous)' : ''}
            </span>
            {participant.isSpeaking && (
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            )}
            {isPinned && <Pin className="h-3 w-3 text-yellow-400" />}
          </div>
        </div>
        
        {/* Status indicators */}
        <div className="absolute top-4 right-4 flex space-x-2">
          {!participant.audioEnabled && (
            <div className="bg-red-500/90 p-2 rounded-lg">
              <MicOff className="h-4 w-4 text-white" />
            </div>
          )}
          {participant.isHandRaised && (
            <div className="bg-yellow-500/90 p-2 rounded-lg">
              <Hand className="h-4 w-4 text-white" />
            </div>
          )}
          {participant.isScreenSharing && (
            <div className="bg-blue-500/90 p-2 rounded-lg">
              <Monitor className="h-4 w-4 text-white" />
            </div>
          )}
        </div>
        
        {/* Speaking indicator border */}
        {participant.isSpeaking && (
          <div className="absolute inset-0 border-4 border-green-400 rounded-xl pointer-events-none animate-pulse"></div>
        )}
      </div>
    </div>
  );
};