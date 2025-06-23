import React from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  MicOff, VideoOff, Hand, Monitor, Crown, MoreVertical, 
  Users, Volume2, VolumeX 
} from 'lucide-react';

interface Participant {
  id: string;
  name: string;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isHandRaised?: boolean;
  isSpeaking?: boolean;
  isScreenSharing?: boolean;
  isAdmin?: boolean;
}

interface ParticipantsListProps {
  participants: Map<string, Participant>;
  localUser: {
    id: string;
    name: string;
    videoEnabled: boolean;
    audioEnabled: boolean;
    isHandRaised?: boolean;
    isAdmin?: boolean;
  };
  onMuteParticipant?: (participantId: string) => void;
  onRemoveParticipant?: (participantId: string) => void;
}

export const ParticipantsList: React.FC<ParticipantsListProps> = ({
  participants,
  localUser,
  onMuteParticipant,
  onRemoveParticipant
}) => {
  const totalParticipants = participants.size + 1;

  return (
    <div className="flex-1 p-4">
      <div className="mb-4">
        <h3 className="text-white font-semibold text-lg mb-2">
          Participants ({totalParticipants})
        </h3>
        <p className="text-gray-400 text-sm">
          {Array.from(participants.values()).filter(p => p.isSpeaking).length} personne(s) en train de parler
        </p>
      </div>

      <ScrollArea className="h-full">
        <div className="space-y-3">
          
          {/* Local user - always first */}
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-blue-600/20 border border-blue-500/30">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center relative">
              <span className="text-white font-semibold text-sm">
                {localUser.name.charAt(0).toUpperCase()}
              </span>
              {localUser.isAdmin && (
                <Crown className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400" />
              )}
            </div>
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <p className="text-white font-medium text-sm">
                  {localUser.name}
                </p>
                <Badge variant="secondary" className="text-xs bg-blue-600/30 text-blue-200">
                  Vous
                </Badge>
                {localUser.isAdmin && (
                  <Badge variant="secondary" className="text-xs bg-yellow-600/30 text-yellow-200">
                    Organisateur
                  </Badge>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-1">
              {!localUser.audioEnabled && (
                <div className="p-1 rounded bg-red-500/20">
                  <MicOff className="h-3 w-3 text-red-400" />
                </div>
              )}
              {!localUser.videoEnabled && (
                <div className="p-1 rounded bg-red-500/20">
                  <VideoOff className="h-3 w-3 text-red-400" />
                </div>
              )}
              {localUser.isHandRaised && (
                <div className="p-1 rounded bg-yellow-500/20">
                  <Hand className="h-3 w-3 text-yellow-400" />
                </div>
              )}
            </div>
          </div>

          {/* Remote participants */}
          {Array.from(participants.values())
            .sort((a, b) => {
              // Admins first, then speaking, then alphabetical
              if (a.isAdmin && !b.isAdmin) return -1;
              if (!a.isAdmin && b.isAdmin) return 1;
              if (a.isSpeaking && !b.isSpeaking) return -1;
              if (!a.isSpeaking && b.isSpeaking) return 1;
              return a.name.localeCompare(b.name);
            })
            .map((participant) => (
              <div 
                key={participant.id} 
                className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  participant.isSpeaking 
                    ? 'bg-green-600/20 border border-green-500/30' 
                    : 'hover:bg-gray-700/30'
                }`}
              >
                <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center relative">
                  <span className="text-white font-semibold text-sm">
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                  {participant.isAdmin && (
                    <Crown className="absolute -top-1 -right-1 h-4 w-4 text-yellow-400" />
                  )}
                  {participant.isSpeaking && (
                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                  )}
                </div>
                
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-medium text-sm">{participant.name}</p>
                    {participant.isAdmin && (
                      <Badge variant="secondary" className="text-xs bg-yellow-600/30 text-yellow-200">
                        Organisateur
                      </Badge>
                    )}
                  </div>
                  {participant.isSpeaking && (
                    <p className="text-green-400 text-xs">En train de parler</p>
                  )}
                  {participant.isScreenSharing && (
                    <p className="text-blue-400 text-xs">Partage d'écran actif</p>
                  )}
                </div>
                
                <div className="flex items-center space-x-1">
                  {!participant.audioEnabled && (
                    <div className="p-1 rounded bg-red-500/20">
                      <MicOff className="h-3 w-3 text-red-400" />
                    </div>
                  )}
                  {!participant.videoEnabled && (
                    <div className="p-1 rounded bg-red-500/20">
                      <VideoOff className="h-3 w-3 text-red-400" />
                    </div>
                  )}
                  {participant.isHandRaised && (
                    <div className="p-1 rounded bg-yellow-500/20">
                      <Hand className="h-3 w-3 text-yellow-400" />
                    </div>
                  )}
                  {participant.isScreenSharing && (
                    <div className="p-1 rounded bg-blue-500/20">
                      <Monitor className="h-3 w-3 text-blue-400" />
                    </div>
                  )}
                  
                  {/* Admin controls */}
                  {localUser.isAdmin && (
                    <div className="flex space-x-1">
                      {participant.audioEnabled && onMuteParticipant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onMuteParticipant(participant.id)}
                          className="h-6 w-6 p-0 hover:bg-red-500/20"
                        >
                          <VolumeX className="h-3 w-3 text-red-400" />
                        </Button>
                      )}
                      
                      {onRemoveParticipant && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveParticipant(participant.id)}
                          className="h-6 w-6 p-0 hover:bg-gray-600"
                        >
                          <MoreVertical className="h-3 w-3 text-gray-400" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          
          {/* Empty state */}
          {participants.size === 0 && (
            <div className="text-center py-8">
              <Users className="h-12 w-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                En attente d'autres participants...
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};