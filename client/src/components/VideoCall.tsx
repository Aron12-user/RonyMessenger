import React, { useEffect, useState } from 'react';
// Temporairement désactiver Jitsi pendant que nous corrigeons les problèmes
// import { JitsiMeeting } from '@jitsi/react-sdk';
import { Button } from '@/components/ui/button';
import { generateRandomMeetingId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

// Stub pour JitsiMeeting
const JitsiMeeting = (props: any) => {
  return <div className="w-full h-full bg-gray-900 flex items-center justify-center text-white">
    Réunion vidéo actuellement désactivée. Configuration en cours...
  </div>;
};

interface VideoCallProps {
  roomName?: string;
  userName: string;
  onClose: () => void;
}

export default function VideoCall({ roomName, userName, onClose }: VideoCallProps) {
  const [meetingId, setMeetingId] = useState(roomName || generateRandomMeetingId());
  const { toast } = useToast();

  const handleCopyMeetingId = () => {
    navigator.clipboard.writeText(meetingId);
    toast({
      title: "ID de réunion copié",
      description: "L'ID de réunion a été copié dans le presse-papiers",
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="bg-gray-900 p-4 flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <Button 
            variant="destructive" 
            onClick={onClose}
            className="rounded-full w-10 h-10 p-0 flex items-center justify-center"
          >
            <span className="material-icons">close</span>
          </Button>
          <h3 className="text-white font-medium">Rony Video Call</h3>
        </div>
        
        <div className="flex items-center space-x-2">
          <div className="bg-gray-800 text-white px-3 py-1 rounded flex items-center space-x-2">
            <span className="text-sm truncate max-w-[120px]">{meetingId}</span>
            <Button 
              variant="ghost"
              onClick={handleCopyMeetingId}
              className="h-6 w-6 p-0"
            >
              <span className="material-icons text-sm">content_copy</span>
            </Button>
          </div>
        </div>
      </div>
      
      <div className="flex-1 bg-gray-800">
        <JitsiMeeting
          domain="meet.jit.si"
          roomName={meetingId}
          configOverwrite={{
            startWithAudioMuted: false,
            startWithVideoMuted: false,
            disableModeratorIndicator: true,
            enableEmailInStats: false,
            prejoinPageEnabled: false,
            disableSimulcast: false,
            enableClosePage: false,
            hideConferenceSubject: true,
            hideConferenceTimer: true,
            hideParticipantsStats: true,
            toolbarButtons: [
              'microphone', 'camera', 'desktop', 'chat',
              'raisehand', 'tileview', 'hangup', 'settings'
            ],
          }}
          interfaceConfigOverwrite={{
            DISABLE_JOIN_LEAVE_NOTIFICATIONS: true,
            TOOLBAR_ALWAYS_VISIBLE: true,
            HIDE_INVITE_MORE_HEADER: true,
          }}
          userInfo={{
            displayName: userName,
            email: 'user@rony.app' // Email requis par l'API Jitsi
          }}
          onApiReady={(externalApi) => {
            // Ici, vous pouvez ajouter des écouteurs d'événements à l'instance API
          }}
          getIFrameRef={(node) => {
            node.style.height = '100%';
            node.style.width = '100%';
          }}
        />
      </div>
    </div>
  );
}