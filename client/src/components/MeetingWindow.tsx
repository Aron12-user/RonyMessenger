
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import WebRTCRoom from './WebRTCRoom';

interface MeetingWindowProps {
  roomCode: string;
  userName: string;
  userId: number;
  onClose: () => void;
}

export default function MeetingWindow({ roomCode, userName, userId, onClose }: MeetingWindowProps) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [windowRef, setWindowRef] = useState<Window | null>(null);

  // Ouvrir dans un nouvel onglet
  useEffect(() => {
    const newWindow = window.open(
      `about:blank`,
      `meeting-${roomCode}`,
      'width=1200,height=800,resizable=yes,scrollbars=yes'
    );

    if (newWindow) {
      // Configuration de la nouvelle fenêtre
      newWindow.document.title = `Réunion ${roomCode} - Rony`;
      newWindow.document.head.innerHTML = `
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background: #000;
            color: #fff;
            overflow: hidden;
          }
          
          #meeting-root {
            width: 100vw;
            height: 100vh;
          }
        </style>
        <link rel="stylesheet" href="${window.location.origin}/src/index.css">
      `;
      
      // Créer le conteneur pour React
      const meetingRoot = newWindow.document.createElement('div');
      meetingRoot.id = 'meeting-root';
      newWindow.document.body.appendChild(meetingRoot);
      
      setWindowRef(newWindow);
      
      // Gérer la fermeture de la fenêtre
      newWindow.addEventListener('beforeunload', () => {
        onClose();
      });
    } else {
      // Fallback : utiliser le mode réduit dans la fenêtre principale
      setIsMinimized(true);
    }

    return () => {
      if (newWindow && !newWindow.closed) {
        newWindow.close();
      }
    };
  }, [roomCode, onClose]);

  // Gérer la minimisation/maximisation
  const handleToggleMinimize = () => {
    if (windowRef && !windowRef.closed) {
      if (windowRef.document.visibilityState === 'visible') {
        windowRef.blur();
        setIsMinimized(true);
      } else {
        windowRef.focus();
        setIsMinimized(false);
      }
    } else {
      setIsMinimized(!isMinimized);
    }
  };

  // Rendu dans la nouvelle fenêtre ou en mode réduit
  if (windowRef && !windowRef.closed) {
    const meetingRoot = windowRef.document.getElementById('meeting-root');
    if (meetingRoot) {
      return createPortal(
        <WebRTCRoom
          roomCode={roomCode}
          userName={userName}
          userId={userId}
          onClose={onClose}
          isMinimized={false}
        />,
        meetingRoot
      );
    }
  }

  // Fallback : mode réduit dans la fenêtre principale
  return (
    <WebRTCRoom
      roomCode={roomCode}
      userName={userName}
      userId={userId}
      onClose={onClose}
      isMinimized={isMinimized}
      onToggleMinimize={handleToggleMinimize}
    />
  );
}
