import { Express, Request, Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { mediasoupService } from './mediasoup-config';

interface MediasoupPeer {
  id: string;
  name: string;
  ws: WebSocket;
  producers: Map<string, string>; // kind -> producerId
  consumers: Map<string, string>; // consumerId -> producerId
}

interface MediasoupRoomState {
  peers: Map<string, MediasoupPeer>;
  chatMessages: any[];
}

const rooms: Map<string, MediasoupRoomState> = new Map();

export async function setupMediasoupRoutes(app: Express, httpServer: Server) {
  console.log('🎬 Configuration des routes Mediasoup...');

  // Initialiser Mediasoup
  await mediasoupService.initialize();

  // Routes API Mediasoup
  app.get('/api/mediasoup/room/:roomCode/router-capabilities', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      
      // Créer la room si elle n'existe pas
      await mediasoupService.createRoom(roomCode);
      
      const rtpCapabilities = mediasoupService.getRouterRtpCapabilities(roomCode);
      
      res.json({ rtpCapabilities });
    } catch (error) {
      console.error('❌ Erreur router capabilities:', error);
      res.status(500).json({ error: 'Erreur interne du serveur' });
    }
  });

  app.post('/api/mediasoup/room/:roomCode/create-transport', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const { peerId } = req.body;
      
      if (!peerId) {
        return res.status(400).json({ error: 'peerId requis' });
      }

      const transportParams = await mediasoupService.createWebRtcTransport(roomCode, peerId);
      
      res.json(transportParams);
    } catch (error) {
      console.error('❌ Erreur création transport:', error);
      res.status(500).json({ error: 'Erreur création transport' });
    }
  });

  app.post('/api/mediasoup/room/:roomCode/connect-transport', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const { peerId, dtlsParameters } = req.body;
      
      await mediasoupService.connectTransport(roomCode, peerId, dtlsParameters);
      
      res.json({ success: true });
    } catch (error) {
      console.error('❌ Erreur connexion transport:', error);
      res.status(500).json({ error: 'Erreur connexion transport' });
    }
  });

  app.post('/api/mediasoup/room/:roomCode/produce', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const { peerId, kind, rtpParameters } = req.body;
      
      const result = await mediasoupService.createProducer(roomCode, peerId, rtpParameters, kind);
      
      // Notifier les autres peers via WebSocket
      broadcastToRoom(roomCode, {
        type: 'new-producer',
        peerId,
        producerId: result.id,
        kind
      }, getPeerWebSocket(roomCode, peerId));
      
      res.json(result);
    } catch (error) {
      console.error('❌ Erreur création producer:', error);
      res.status(500).json({ error: 'Erreur création producer' });
    }
  });

  app.post('/api/mediasoup/room/:roomCode/consume', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const { peerId, producerId, rtpCapabilities } = req.body;
      
      const result = await mediasoupService.createConsumer(roomCode, peerId, producerId, rtpCapabilities);
      
      res.json(result);
    } catch (error) {
      console.error('❌ Erreur création consumer:', error);
      res.status(500).json({ error: 'Erreur création consumer' });
    }
  });

  // WebSocket Server pour Mediasoup
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws/mediasoup' 
  });

  wss.on('connection', (ws: WebSocket, req) => {
    console.log('🔌 Nouvelle connexion WebSocket Mediasoup');
    
    ws.on('message', async (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        await handleMediasoupMessage(ws, data);
      } catch (error) {
        console.error('❌ Erreur message WebSocket Mediasoup:', error);
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Erreur traitement message' 
        }));
      }
    });

    ws.on('close', () => {
      console.log('❌ Connexion WebSocket Mediasoup fermée');
      handlePeerDisconnection(ws);
    });
  });

  async function handleMediasoupMessage(ws: WebSocket, data: any) {
    switch (data.type) {
      case 'join-room':
        await handleJoinRoom(ws, data);
        break;
        
      case 'chat-message':
        handleChatMessage(data);
        break;
        
      case 'producer-pause':
        await handleProducerPause(data);
        break;
        
      case 'producer-resume':
        await handleProducerResume(data);
        break;
        
      case 'producer-close':
        await handleProducerClose(data);
        break;
        
      default:
        console.warn('⚠️ Type de message non reconnu:', data.type);
    }
  }

  async function handleJoinRoom(ws: WebSocket, data: any) {
    const { roomCode, peerId, name } = data;
    
    if (!roomCode || !peerId || !name) {
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'roomCode, peerId et name requis' 
      }));
      return;
    }

    console.log(`👤 Peer ${peerId} (${name}) rejoint la room ${roomCode}`);

    // Créer la room si elle n'existe pas
    if (!rooms.has(roomCode)) {
      rooms.set(roomCode, {
        peers: new Map(),
        chatMessages: []
      });
      await mediasoupService.createRoom(roomCode);
    }

    const room = rooms.get(roomCode)!;
    
    // Ajouter le peer
    const peer: MediasoupPeer = {
      id: peerId,
      name,
      ws,
      producers: new Map(),
      consumers: new Map()
    };
    
    room.peers.set(peerId, peer);

    // Envoyer la confirmation de jointure
    ws.send(JSON.stringify({
      type: 'room-joined',
      roomCode,
      peerId,
      existingPeers: Array.from(room.peers.values())
        .filter(p => p.id !== peerId)
        .map(p => ({
          id: p.id,
          name: p.name,
          producers: Array.from(p.producers.entries()).map(([kind, producerId]) => ({
            id: producerId,
            kind
          }))
        })),
      chatHistory: room.chatMessages
    }));

    // Notifier les autres peers
    broadcastToRoom(roomCode, {
      type: 'peer-joined',
      peer: {
        id: peerId,
        name
      }
    }, ws);
  }

  function handleChatMessage(data: any) {
    const { roomCode, message } = data;
    const room = rooms.get(roomCode);
    
    if (!room) return;

    const chatMessage = {
      ...message,
      timestamp: new Date().toISOString()
    };

    room.chatMessages.push(chatMessage);

    // Garder seulement les 100 derniers messages
    if (room.chatMessages.length > 100) {
      room.chatMessages = room.chatMessages.slice(-100);
    }

    broadcastToRoom(roomCode, {
      type: 'chat-message',
      message: chatMessage
    });
  }

  async function handleProducerPause(data: any) {
    const { roomCode, producerId } = data;
    await mediasoupService.pauseProducer(roomCode, producerId);
    
    broadcastToRoom(roomCode, {
      type: 'producer-paused',
      producerId
    });
  }

  async function handleProducerResume(data: any) {
    const { roomCode, producerId } = data;
    await mediasoupService.resumeProducer(roomCode, producerId);
    
    broadcastToRoom(roomCode, {
      type: 'producer-resumed',
      producerId
    });
  }

  async function handleProducerClose(data: any) {
    const { roomCode, producerId } = data;
    await mediasoupService.closeProducer(roomCode, producerId);
    
    broadcastToRoom(roomCode, {
      type: 'producer-closed',
      producerId
    });
  }

  function handlePeerDisconnection(ws: WebSocket) {
    // Trouver et supprimer le peer de toutes les rooms
    for (const [roomCode, room] of rooms.entries()) {
      for (const [peerId, peer] of room.peers.entries()) {
        if (peer.ws === ws) {
          console.log(`👋 Peer ${peerId} a quitté la room ${roomCode}`);
          
          // Fermer les producers du peer
          for (const producerId of peer.producers.values()) {
            mediasoupService.closeProducer(roomCode, producerId);
          }
          
          room.peers.delete(peerId);
          
          // Notifier les autres peers
          broadcastToRoom(roomCode, {
            type: 'peer-left',
            peerId
          });
          
          // Supprimer la room si elle est vide
          if (room.peers.size === 0) {
            rooms.delete(roomCode);
            mediasoupService.closeRoom(roomCode);
            console.log(`🗑️ Room ${roomCode} supprimée (vide)`);
          }
          
          return;
        }
      }
    }
  }

  function broadcastToRoom(roomCode: string, message: any, excludeWs?: WebSocket) {
    const room = rooms.get(roomCode);
    if (!room) return;

    const messageStr = JSON.stringify(message);
    
    for (const peer of room.peers.values()) {
      if (peer.ws !== excludeWs && peer.ws.readyState === WebSocket.OPEN) {
        peer.ws.send(messageStr);
      }
    }
  }

  function getPeerWebSocket(roomCode: string, peerId: string): WebSocket | undefined {
    const room = rooms.get(roomCode);
    if (!room) return undefined;
    
    const peer = room.peers.get(peerId);
    return peer?.ws;
  }

  // Route pour les statistiques
  app.get('/api/mediasoup/room/:roomCode/stats', (req: Request, res: Response) => {
    const { roomCode } = req.params;
    const room = rooms.get(roomCode);
    const mediasoupStats = mediasoupService.getRoomStats(roomCode);
    
    if (!room || !mediasoupStats) {
      return res.status(404).json({ error: 'Room non trouvée' });
    }

    res.json({
      roomCode,
      ...mediasoupStats,
      chatMessagesCount: room.chatMessages.length
    });
  });

  console.log('✅ Routes Mediasoup configurées');
}