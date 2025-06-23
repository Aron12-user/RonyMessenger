import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';

interface JitsiParticipant {
  id: string;
  name: string;
  ws: WebSocket;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isHandRaised: boolean;
  isModerator: boolean;
  joinTime: Date;
}

interface JitsiRoom {
  id: string;
  name: string;
  participants: Map<string, JitsiParticipant>;
  createdAt: Date;
  moderatorPassword?: string;
  config: {
    enableChat: boolean;
    enableScreenShare: boolean;
    enableRecording: boolean;
    maxParticipants: number;
  };
}

class JitsiServer {
  private rooms: Map<string, JitsiRoom> = new Map();
  private wss: WebSocketServer;

  constructor(server: Server) {
    this.wss = new WebSocketServer({
      server,
      path: '/jitsi-ws'
    });

    this.wss.on('connection', this.handleConnection.bind(this));
    console.log('Jitsi Server initialized on /jitsi-ws');
  }

  private handleConnection(ws: WebSocket, request: any) {
    console.log('New Jitsi connection');
    
    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        console.error('Error parsing Jitsi message:', error);
      }
    });

    ws.on('close', () => {
      this.handleDisconnection(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case 'join-room':
        this.handleJoinRoom(ws, message);
        break;
      case 'leave-room':
        this.handleLeaveRoom(ws, message);
        break;
      case 'offer':
        this.handleWebRTCOffer(ws, message);
        break;
      case 'answer':
        this.handleWebRTCAnswer(ws, message);
        break;
      case 'ice-candidate':
        this.handleICECandidate(ws, message);
        break;
      case 'chat-message':
        this.handleChatMessage(ws, message);
        break;
      case 'toggle-audio':
        this.handleToggleAudio(ws, message);
        break;
      case 'toggle-video':
        this.handleToggleVideo(ws, message);
        break;
      case 'raise-hand':
        this.handleRaiseHand(ws, message);
        break;
      case 'screen-share':
        this.handleScreenShare(ws, message);
        break;
      default:
        console.log('Unknown Jitsi message type:', message.type);
    }
  }

  private handleJoinRoom(ws: WebSocket, message: any) {
    const { roomId, participantName, isModerator } = message;
    
    // Create room if it doesn't exist
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name: `Room ${roomId}`,
        participants: new Map(),
        createdAt: new Date(),
        config: {
          enableChat: true,
          enableScreenShare: true,
          enableRecording: false,
          maxParticipants: 50
        }
      });
      console.log(`Created new Jitsi room: ${roomId}`);
    }

    const room = this.rooms.get(roomId)!;
    
    // Check participant limit
    if (room.participants.size >= room.config.maxParticipants) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Room is full'
      }));
      return;
    }

    const participantId = uuidv4();
    const participant: JitsiParticipant = {
      id: participantId,
      name: participantName || `Participant ${participantId.slice(0, 8)}`,
      ws,
      audioEnabled: false,
      videoEnabled: false,
      isHandRaised: false,
      isModerator: isModerator || room.participants.size === 0, // First participant is moderator
      joinTime: new Date()
    };

    room.participants.set(participantId, participant);
    (ws as any).participantId = participantId;
    (ws as any).roomId = roomId;

    // Send room state to new participant
    ws.send(JSON.stringify({
      type: 'room-joined',
      participantId,
      roomConfig: room.config,
      participants: Array.from(room.participants.values()).map(p => ({
        id: p.id,
        name: p.name,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
        isHandRaised: p.isHandRaised,
        isModerator: p.isModerator
      }))
    }));

    // Notify other participants
    this.broadcastToRoom(roomId, {
      type: 'participant-joined',
      participant: {
        id: participant.id,
        name: participant.name,
        audioEnabled: participant.audioEnabled,
        videoEnabled: participant.videoEnabled,
        isHandRaised: participant.isHandRaised,
        isModerator: participant.isModerator
      }
    }, participantId);

    console.log(`Participant ${participant.name} joined room ${roomId}`);
  }

  private handleLeaveRoom(ws: WebSocket, message: any) {
    this.removeParticipantFromRoom(ws);
  }

  private handleWebRTCOffer(ws: WebSocket, message: any) {
    const { targetParticipantId, offer } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const targetParticipant = room.participants.get(targetParticipantId);
        if (targetParticipant) {
          targetParticipant.ws.send(JSON.stringify({
            type: 'offer',
            fromParticipantId: participantId,
            offer
          }));
        }
      }
    }
  }

  private handleWebRTCAnswer(ws: WebSocket, message: any) {
    const { targetParticipantId, answer } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const targetParticipant = room.participants.get(targetParticipantId);
        if (targetParticipant) {
          targetParticipant.ws.send(JSON.stringify({
            type: 'answer',
            fromParticipantId: participantId,
            answer
          }));
        }
      }
    }
  }

  private handleICECandidate(ws: WebSocket, message: any) {
    const { targetParticipantId, candidate } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const targetParticipant = room.participants.get(targetParticipantId);
        if (targetParticipant) {
          targetParticipant.ws.send(JSON.stringify({
            type: 'ice-candidate',
            fromParticipantId: participantId,
            candidate
          }));
        }
      }
    }
  }

  private handleChatMessage(ws: WebSocket, message: any) {
    const { text } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room && room.config.enableChat) {
        const participant = room.participants.get(participantId);
        if (participant) {
          const chatMessage = {
            type: 'chat-message',
            id: uuidv4(),
            participantId,
            participantName: participant.name,
            text,
            timestamp: new Date().toISOString()
          };

          this.broadcastToRoom(roomId, chatMessage);
        }
      }
    }
  }

  private handleToggleAudio(ws: WebSocket, message: any) {
    const { enabled } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const participant = room.participants.get(participantId);
        if (participant) {
          participant.audioEnabled = enabled;
          
          this.broadcastToRoom(roomId, {
            type: 'participant-audio-changed',
            participantId,
            audioEnabled: enabled
          });
        }
      }
    }
  }

  private handleToggleVideo(ws: WebSocket, message: any) {
    const { enabled } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const participant = room.participants.get(participantId);
        if (participant) {
          participant.videoEnabled = enabled;
          
          this.broadcastToRoom(roomId, {
            type: 'participant-video-changed',
            participantId,
            videoEnabled: enabled
          });
        }
      }
    }
  }

  private handleRaiseHand(ws: WebSocket, message: any) {
    const { raised } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const participant = room.participants.get(participantId);
        if (participant) {
          participant.isHandRaised = raised;
          
          this.broadcastToRoom(roomId, {
            type: 'participant-hand-changed',
            participantId,
            isHandRaised: raised
          });
        }
      }
    }
  }

  private handleScreenShare(ws: WebSocket, message: any) {
    const { enabled } = message;
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      this.broadcastToRoom(roomId, {
        type: 'screen-share-changed',
        participantId,
        enabled
      });
    }
  }

  private handleDisconnection(ws: WebSocket) {
    this.removeParticipantFromRoom(ws);
  }

  private removeParticipantFromRoom(ws: WebSocket) {
    const participantId = (ws as any).participantId;
    const roomId = (ws as any).roomId;

    if (roomId && participantId) {
      const room = this.rooms.get(roomId);
      if (room) {
        const participant = room.participants.get(participantId);
        room.participants.delete(participantId);

        // Notify other participants
        this.broadcastToRoom(roomId, {
          type: 'participant-left',
          participantId
        });

        // Clean up empty rooms
        if (room.participants.size === 0) {
          this.rooms.delete(roomId);
          console.log(`Removed empty Jitsi room: ${roomId}`);
        } else if (participant?.isModerator) {
          // Transfer moderator role to oldest participant
          const oldestParticipant = Array.from(room.participants.values())
            .sort((a, b) => a.joinTime.getTime() - b.joinTime.getTime())[0];
          
          if (oldestParticipant) {
            oldestParticipant.isModerator = true;
            this.broadcastToRoom(roomId, {
              type: 'moderator-changed',
              participantId: oldestParticipant.id
            });
          }
        }

        console.log(`Participant ${participantId} left room ${roomId}`);
      }
    }
  }

  private broadcastToRoom(roomId: string, message: any, excludeParticipantId?: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.participants.forEach((participant, id) => {
        if (id !== excludeParticipantId && participant.ws.readyState === WebSocket.OPEN) {
          participant.ws.send(JSON.stringify(message));
        }
      });
    }
  }

  // Public API methods
  public getRoomInfo(roomId: string) {
    const room = this.rooms.get(roomId);
    if (room) {
      return {
        id: room.id,
        name: room.name,
        participantCount: room.participants.size,
        createdAt: room.createdAt,
        config: room.config
      };
    }
    return null;
  }

  public getAllRooms() {
    return Array.from(this.rooms.values()).map(room => ({
      id: room.id,
      name: room.name,
      participantCount: room.participants.size,
      createdAt: room.createdAt
    }));
  }

  public createRoom(roomId: string, config?: Partial<JitsiRoom['config']>) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        name: `Room ${roomId}`,
        participants: new Map(),
        createdAt: new Date(),
        config: {
          enableChat: true,
          enableScreenShare: true,
          enableRecording: false,
          maxParticipants: 50,
          ...config
        }
      });
      return true;
    }
    return false;
  }
}

export { JitsiServer };