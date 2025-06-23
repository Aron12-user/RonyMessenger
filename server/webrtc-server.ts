import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { v4 as uuidv4 } from 'uuid';

interface User {
  id: string;
  name: string;
  ws: WebSocket;
  roomCode: string;
  joinTime: Date;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface Room {
  code: string;
  users: Map<string, User>;
  createdAt: Date;
  chatHistory: ChatMessage[];
}

interface ChatMessage {
  id: string;
  sender: string;
  message: string;
  timestamp: Date;
}

export class WebRTCServer {
  private wss: WebSocketServer;
  private rooms: Map<string, Room> = new Map();
  private userToRoom: Map<string, string> = new Map();

  constructor(server: Server) {
    console.log('🚀 Initialisation du serveur WebRTC...');
    
    this.wss = new WebSocketServer({ 
      server,
      path: '/ws'
    });

    this.wss.on('connection', (ws: WebSocket, req) => {
      console.log('🔌 Nouvelle connexion WebSocket');
      this.handleConnection(ws, req);
    });

    // Nettoyage périodique des salles vides
    setInterval(() => {
      this.cleanupEmptyRooms();
    }, 30000); // Toutes les 30 secondes

    console.log('✅ Serveur WebRTC initialisé');
  }

  private handleConnection(ws: WebSocket, req: any) {
    let userId: string | null = null;
    let currentRoom: string | null = null;

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message, userId, currentRoom);
      } catch (error) {
        console.error('❌ Erreur parsing message:', error);
        this.sendError(ws, 'Message invalide');
      }
    });

    ws.on('close', () => {
      console.log('🔌 Connexion fermée');
      if (userId && currentRoom) {
        this.handleUserLeave(userId, currentRoom);
      }
    });

    ws.on('error', (error) => {
      console.error('❌ Erreur WebSocket:', error);
    });

    // Ping périodique pour maintenir la connexion
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000);
  }

  private handleMessage(ws: WebSocket, message: any, userId: string | null, currentRoom: string | null) {
    console.log('📨 Message reçu:', message.type);

    switch (message.type) {
      case 'join-room':
        const newUserId = this.handleJoinRoom(ws, message);
        userId = newUserId;
        currentRoom = message.roomCode;
        break;

      case 'offer':
        this.handleOffer(message, userId, currentRoom);
        break;

      case 'answer':
        this.handleAnswer(message, userId, currentRoom);
        break;

      case 'ice-candidate':
        this.handleIceCandidate(message, userId, currentRoom);
        break;

      case 'chat-message':
        this.handleChatMessage(message, userId, currentRoom);
        break;

      case 'media-state-changed':
        this.handleMediaStateChanged(message, userId, currentRoom);
        break;

      case 'get-room-info':
        this.handleGetRoomInfo(ws, message.roomCode);
        break;

      default:
        console.warn('⚠️ Type de message inconnu:', message.type);
        this.sendError(ws, 'Type de message non supporté');
    }
  }

  private handleJoinRoom(ws: WebSocket, message: any): string {
    const { roomCode, userData } = message;
    
    if (!roomCode || !userData) {
      this.sendError(ws, 'Données manquantes pour rejoindre la salle');
      return '';
    }

    console.log(`👤 ${userData.name} rejoint la salle ${roomCode}`);

    // Créer la salle si elle n'existe pas
    if (!this.rooms.has(roomCode)) {
      const newRoom: Room = {
        code: roomCode,
        users: new Map(),
        createdAt: new Date(),
        chatHistory: []
      };
      this.rooms.set(roomCode, newRoom);
      console.log(`🏠 Nouvelle salle créée: ${roomCode}`);
    }

    const room = this.rooms.get(roomCode)!;
    const userId = userData.id || uuidv4();

    // Créer l'utilisateur
    const user: User = {
      id: userId,
      name: userData.name,
      ws,
      roomCode,
      joinTime: new Date(),
      audioEnabled: true,
      videoEnabled: true
    };

    // Ajouter l'utilisateur à la salle
    room.users.set(userId, user);
    this.userToRoom.set(userId, roomCode);

    // Notifier l'utilisateur qu'il a rejoint
    this.sendToUser(ws, {
      type: 'joined-room',
      roomCode,
      userId,
      users: Array.from(room.users.values()).map(u => ({
        id: u.id,
        name: u.name,
        audioEnabled: u.audioEnabled,
        videoEnabled: u.videoEnabled,
        joinTime: u.joinTime
      })),
      chatHistory: room.chatHistory
    });

    // Notifier les autres utilisateurs
    this.broadcastToRoom(roomCode, {
      type: 'user-joined',
      userData: {
        id: userId,
        name: userData.name,
        audioEnabled: true,
        videoEnabled: true,
        joinTime: new Date()
      }
    }, userId);

    console.log(`✅ ${userData.name} a rejoint la salle ${roomCode} (${room.users.size} participants)`);
    return userId;
  }

  private handleOffer(message: any, userId: string | null, roomCode: string | null) {
    if (!userId || !roomCode) return;

    const { offer, targetUserId } = message;
    
    if (!offer || !targetUserId) {
      console.warn('⚠️ Offre invalide');
      return;
    }

    console.log(`📤 Transfert d'offre de ${userId} vers ${targetUserId}`);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const targetUser = room.users.get(targetUserId);
    if (!targetUser) {
      console.warn(`⚠️ Utilisateur cible ${targetUserId} introuvable`);
      return;
    }

    this.sendToUser(targetUser.ws, {
      type: 'offer',
      offer,
      senderUserId: userId
    });
  }

  private handleAnswer(message: any, userId: string | null, roomCode: string | null) {
    if (!userId || !roomCode) return;

    const { answer, targetUserId } = message;
    
    if (!answer || !targetUserId) {
      console.warn('⚠️ Réponse invalide');
      return;
    }

    console.log(`📤 Transfert de réponse de ${userId} vers ${targetUserId}`);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const targetUser = room.users.get(targetUserId);
    if (!targetUser) {
      console.warn(`⚠️ Utilisateur cible ${targetUserId} introuvable`);
      return;
    }

    this.sendToUser(targetUser.ws, {
      type: 'answer',
      answer,
      senderUserId: userId
    });
  }

  private handleIceCandidate(message: any, userId: string | null, roomCode: string | null) {
    if (!userId || !roomCode) return;

    const { candidate, targetUserId } = message;
    
    if (!candidate || !targetUserId) {
      console.warn('⚠️ Candidat ICE invalide');
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const targetUser = room.users.get(targetUserId);
    if (!targetUser) return;

    this.sendToUser(targetUser.ws, {
      type: 'ice-candidate',
      candidate,
      senderUserId: userId
    });
  }

  private handleChatMessage(message: any, userId: string | null, roomCode: string | null) {
    if (!userId || !roomCode) return;

    const { message: chatText } = message;
    
    if (!chatText || typeof chatText !== 'string') {
      console.warn('⚠️ Message de chat invalide');
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const user = room.users.get(userId);
    if (!user) return;

    console.log(`💬 Message de chat de ${user.name}: ${chatText}`);

    const chatMessage: ChatMessage = {
      id: uuidv4(),
      sender: user.name,
      message: chatText,
      timestamp: new Date()
    };

    // Ajouter à l'historique
    room.chatHistory.push(chatMessage);
    
    // Limiter l'historique à 100 messages
    if (room.chatHistory.length > 100) {
      room.chatHistory = room.chatHistory.slice(-100);
    }

    // Diffuser le message
    this.broadcastToRoom(roomCode, {
      type: 'chat-message',
      senderName: user.name,
      message: chatText,
      timestamp: chatMessage.timestamp
    });
  }

  private handleMediaStateChanged(message: any, userId: string | null, roomCode: string | null) {
    if (!userId || !roomCode) return;

    const { audioEnabled, videoEnabled } = message;
    
    if (typeof audioEnabled !== 'boolean' || typeof videoEnabled !== 'boolean') {
      console.warn('⚠️ État média invalide');
      return;
    }

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const user = room.users.get(userId);
    if (!user) return;

    // Mettre à jour l'état
    user.audioEnabled = audioEnabled;
    user.videoEnabled = videoEnabled;

    console.log(`🎤📹 ${user.name} - Audio: ${audioEnabled}, Vidéo: ${videoEnabled}`);

    // Notifier les autres utilisateurs
    this.broadcastToRoom(roomCode, {
      type: 'media-state-changed',
      userId,
      audioEnabled,
      videoEnabled
    }, userId);
  }

  private handleGetRoomInfo(ws: WebSocket, roomCode: string) {
    if (!roomCode) {
      this.sendError(ws, 'Code de salle manquant');
      return;
    }

    const room = this.rooms.get(roomCode);
    
    this.sendToUser(ws, {
      type: 'room-info',
      exists: !!room,
      participantCount: room ? room.users.size : 0,
      createdAt: room ? room.createdAt : null
    });
  }

  private handleUserLeave(userId: string, roomCode: string) {
    console.log(`👋 ${userId} quitte la salle ${roomCode}`);

    const room = this.rooms.get(roomCode);
    if (!room) return;

    const user = room.users.get(userId);
    if (!user) return;

    // Supprimer l'utilisateur
    room.users.delete(userId);
    this.userToRoom.delete(userId);

    // Notifier les autres utilisateurs
    this.broadcastToRoom(roomCode, {
      type: 'user-left',
      userId
    });

    console.log(`✅ ${user.name} a quitté la salle ${roomCode} (${room.users.size} participants restants)`);

    // Supprimer la salle si elle est vide
    if (room.users.size === 0) {
      this.rooms.delete(roomCode);
      console.log(`🗑️ Salle ${roomCode} supprimée (vide)`);
    }
  }

  private broadcastToRoom(roomCode: string, message: any, excludeUserId?: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.users.forEach((user, userId) => {
      if (userId !== excludeUserId && user.ws.readyState === WebSocket.OPEN) {
        this.sendToUser(user.ws, message);
      }
    });
  }

  private sendToUser(ws: WebSocket, message: any) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('❌ Erreur envoi message:', error);
      }
    }
  }

  private sendError(ws: WebSocket, error: string) {
    this.sendToUser(ws, {
      type: 'error',
      message: error
    });
  }

  private cleanupEmptyRooms() {
    const emptyRooms: string[] = [];
    
    this.rooms.forEach((room, roomCode) => {
      // Nettoyer les connexions fermées
      room.users.forEach((user, userId) => {
        if (user.ws.readyState !== WebSocket.OPEN) {
          room.users.delete(userId);
          this.userToRoom.delete(userId);
        }
      });

      // Marquer les salles vides pour suppression
      if (room.users.size === 0) {
        emptyRooms.push(roomCode);
      }
    });

    // Supprimer les salles vides
    emptyRooms.forEach(roomCode => {
      this.rooms.delete(roomCode);
      console.log(`🧹 Salle nettoyée: ${roomCode}`);
    });

    if (emptyRooms.length > 0) {
      console.log(`🧹 ${emptyRooms.length} salle(s) vide(s) nettoyée(s)`);
    }
  }

  // Méthodes publiques pour les statistiques
  public getRoomCount(): number {
    return this.rooms.size;
  }

  public getTotalUsers(): number {
    let total = 0;
    this.rooms.forEach(room => {
      total += room.users.size;
    });
    return total;
  }

  public getRoomInfo(roomCode: string) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    return {
      code: roomCode,
      participantCount: room.users.size,
      participants: Array.from(room.users.values()).map(user => ({
        id: user.id,
        name: user.name,
        joinTime: user.joinTime,
        audioEnabled: user.audioEnabled,
        videoEnabled: user.videoEnabled
      })),
      createdAt: room.createdAt,
      chatMessageCount: room.chatHistory.length
    };
  }

  public getAllRoomsInfo() {
    const rooms: any[] = [];
    
    this.rooms.forEach((room, roomCode) => {
      rooms.push({
        code: roomCode,
        participantCount: room.users.size,
        createdAt: room.createdAt,
        lastActivity: new Date() // Pour l'instant, utiliser l'heure actuelle
      });
    });

    return {
      totalRooms: this.rooms.size,
      totalUsers: this.getTotalUsers(),
      rooms
    };
  }
}