import React from 'react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Separator } from '@/components/ui/separator';
import { 
  Mic, MicOff, Video, VideoOff, Monitor, Hand, MessageSquare, 
  Users, PhoneOff, MoreHorizontal, Settings, Volume2, Share
} from 'lucide-react';

interface MeetingControlsProps {
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
  isHandRaised: boolean;
  showChat: boolean;
  showParticipants: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleHandRaise: () => void;
  onToggleChat: () => void;
  onToggleParticipants: () => void;
  onLeaveRoom: () => void;
  onMoreOptions?: () => void;
}

export const MeetingControls: React.FC<MeetingControlsProps> = ({
  isAudioEnabled,
  isVideoEnabled,
  isScreenSharing,
  isHandRaised,
  showChat,
  showParticipants,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleHandRaise,
  onToggleChat,
  onToggleParticipants,
  onLeaveRoom,
  onMoreOptions
}) => {
  return (
    <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-30">
      <div className="bg-gray-800/95 backdrop-blur-lg rounded-2xl px-6 py-4 border border-gray-700 shadow-2xl">
        <div className="flex items-center space-x-4">
          
          {/* Audio Control */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isAudioEnabled ? "ghost" : "destructive"}
                size="lg"
                onClick={onToggleAudio}
                className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                  isAudioEnabled ? 'hover:bg-gray-600 text-white' : ''
                }`}
              >
                {isAudioEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              {isAudioEnabled ? "Couper le micro" : "Activer le micro"}
            </TooltipContent>
          </Tooltip>
          
          {/* Video Control */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isVideoEnabled ? "ghost" : "destructive"}
                size="lg"
                onClick={onToggleVideo}
                className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                  isVideoEnabled ? 'hover:bg-gray-600 text-white' : ''
                }`}
              >
                {isVideoEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              {isVideoEnabled ? "Arrêter la vidéo" : "Démarrer la vidéo"}
            </TooltipContent>
          </Tooltip>
          
          <Separator orientation="vertical" className="h-8 bg-gray-600" />
          
          {/* Screen Share */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={isScreenSharing ? "default" : "ghost"}
                size="lg"
                onClick={onToggleScreenShare}
                className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                  isScreenSharing ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <Monitor className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              {isScreenSharing ? "Arrêter le partage" : "Partager l'écran"}
            </TooltipContent>
          </Tooltip>
          
          {/* Raise Hand */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={onToggleHandRaise}
                className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                  isHandRaised ? 'bg-yellow-600 hover:bg-yellow-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <Hand className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              {isHandRaised ? "Baisser la main" : "Lever la main"}
            </TooltipContent>
          </Tooltip>
          
          {/* Chat */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={onToggleChat}
                className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                  showChat ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <MessageSquare className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              Chat
            </TooltipContent>
          </Tooltip>
          
          {/* Participants */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="lg"
                onClick={onToggleParticipants}
                className={`rounded-full w-12 h-12 p-0 transition-all duration-200 hover:scale-105 ${
                  showParticipants ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                }`}
              >
                <Users className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              Participants
            </TooltipContent>
          </Tooltip>
          
          <Separator orientation="vertical" className="h-8 bg-gray-600" />
          
          {/* More Options */}
          {onMoreOptions && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={onMoreOptions}
                  className="rounded-full w-12 h-12 p-0 bg-gray-700 hover:bg-gray-600 transition-all duration-200 hover:scale-105"
                >
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
                Plus d'options
              </TooltipContent>
            </Tooltip>
          )}
          
          {/* Leave Meeting */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="destructive"
                size="lg"
                onClick={onLeaveRoom}
                className="rounded-full w-12 h-12 p-0 bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105"
              >
                <PhoneOff className="h-5 w-5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="bg-gray-800 text-white border-gray-600">
              Raccrocher
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  );
};