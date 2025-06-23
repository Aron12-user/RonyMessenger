import * as mediasoup from 'mediasoup';

export interface MediasoupRoom {
  id: string;
  router: any;
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
  peers: Map<string, any>;
}

class MediasoupService {
  private workers: any[] = [];
  private rooms: Map<string, MediasoupRoom> = new Map();
  private nextWorkerIndex = 0;

  // Codec configurations pour ultra-haute qualité
  private readonly mediaCodecs: any[] = [
    {
      kind: 'audio',
      mimeType: 'audio/opus',
      clockRate: 48000,
      channels: 2,
    },
    {
      kind: 'video',
      mimeType: 'video/VP8',
      clockRate: 90000,
      parameters: {
        'x-google-start-bitrate': 2000000,
        'x-google-max-bitrate': 8000000,
        'x-google-min-bitrate': 500000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/VP9',
      clockRate: 90000,
      parameters: {
        'profile-id': 2,
        'x-google-start-bitrate': 3000000,
        'x-google-max-bitrate': 12000000,
        'x-google-min-bitrate': 1000000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/h264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '4d0032',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 2500000,
        'x-google-max-bitrate': 10000000,
        'x-google-min-bitrate': 800000,
      },
    },
    {
      kind: 'video',
      mimeType: 'video/h264',
      clockRate: 90000,
      parameters: {
        'packetization-mode': 1,
        'profile-level-id': '42e01f',
        'level-asymmetry-allowed': 1,
        'x-google-start-bitrate': 1500000,
        'x-google-max-bitrate': 6000000,
        'x-google-min-bitrate': 500000,
      },
    },
  ];

  async initialize() {
    console.log('🚀 Initialisation Mediasoup...');
    
    // Créer 4 workers pour la haute disponibilité
    for (let i = 0; i < 4; i++) {
      const worker = await mediasoup.createWorker({
        logLevel: 'warn',
        rtcMinPort: 40000 + (i * 1000),
        rtcMaxPort: 40000 + ((i + 1) * 1000) - 1,
      });

      worker.on('died', () => {
        console.error(`💀 Mediasoup worker ${i} died, exiting...`);
        setTimeout(() => process.exit(1), 2000);
      });

      this.workers.push(worker);
      console.log(`✅ Worker ${i} créé`);
    }

    console.log('🎯 Mediasoup initialisé avec succès');
  }

  private getNextWorker(): Worker {
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRoom(roomId: string): Promise<MediasoupRoom> {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId)!;
    }

    console.log(`🏠 Création de la room Mediasoup: ${roomId}`);

    const worker = this.getNextWorker();
    const router = await worker.createRouter({ mediaCodecs: this.mediaCodecs });

    const room: MediasoupRoom = {
      id: roomId,
      router,
      transports: new Map(),
      producers: new Map(),
      consumers: new Map(),
      peers: new Map(),
    };

    this.rooms.set(roomId, room);
    console.log(`✅ Room ${roomId} créée avec succès`);

    return room;
  }

  async closeRoom(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`🗑️ Fermeture de la room: ${roomId}`);

    // Fermer tous les transports
    for (const transport of room.transports.values()) {
      transport.close();
    }

    // Fermer le router
    room.router.close();

    this.rooms.delete(roomId);
    console.log(`✅ Room ${roomId} fermée`);
  }

  getRoom(roomId: string): MediasoupRoom | undefined {
    return this.rooms.get(roomId);
  }

  async createWebRtcTransport(roomId: string, peerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} n'existe pas`);
    }

    console.log(`🚚 Création transport WebRTC pour peer ${peerId} dans room ${roomId}`);

    const transport = await room.router.createWebRtcTransport({
      listenIps: [
        {
          ip: '0.0.0.0',
          announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
        },
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true,
      // Configuration ultra-haute qualité
      maxIncomingBitrate: 15000000, // 15 Mbps
      maxOutgoingBitrate: 15000000, // 15 Mbps
      initialAvailableOutgoingBitrate: 8000000, // 8 Mbps initial
    });

    transport.on('dtlsstatechange', (dtlsState) => {
      if (dtlsState === 'closed') {
        console.log(`🔒 Transport fermé pour peer ${peerId}`);
        transport.close();
        room.transports.delete(peerId);
      }
    });

    room.transports.set(peerId, transport);

    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
    };
  }

  async connectTransport(roomId: string, peerId: string, dtlsParameters: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} n'existe pas`);
    }

    const transport = room.transports.get(peerId);
    if (!transport) {
      throw new Error(`Transport pour peer ${peerId} n'existe pas`);
    }

    console.log(`🔌 Connexion transport pour peer ${peerId}`);
    await transport.connect({ dtlsParameters });
  }

  async createProducer(roomId: string, peerId: string, rtpParameters: any, kind: 'audio' | 'video') {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} n'existe pas`);
    }

    const transport = room.transports.get(peerId);
    if (!transport) {
      throw new Error(`Transport pour peer ${peerId} n'existe pas`);
    }

    console.log(`🎬 Création producer ${kind} pour peer ${peerId}`);

    const producer = await transport.produce({
      kind,
      rtpParameters,
      // Configuration haute qualité pour la vidéo
      ...(kind === 'video' && {
        keyFrameRequestDelay: 5000,
        appData: { peerId, kind },
      }),
    });

    room.producers.set(producer.id, producer);

    // Notifier les autres peers de ce nouveau producer
    this.notifyNewProducer(roomId, peerId, producer.id, kind);

    return { id: producer.id };
  }

  async createConsumer(roomId: string, peerId: string, producerId: string, rtpCapabilities: any) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} n'existe pas`);
    }

    const transport = room.transports.get(peerId);
    if (!transport) {
      throw new Error(`Transport pour peer ${peerId} n'existe pas`);
    }

    const producer = room.producers.get(producerId);
    if (!producer) {
      throw new Error(`Producer ${producerId} n'existe pas`);
    }

    if (!room.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error(`Impossible de consommer le producer ${producerId}`);
    }

    console.log(`🍿 Création consumer pour peer ${peerId}, producer ${producerId}`);

    const consumer = await transport.consume({
      producerId,
      rtpCapabilities,
      paused: false,
      // Configuration optimisée pour la qualité
      preferredLayers: { spatialLayer: 2, temporalLayer: 2 },
    });

    room.consumers.set(consumer.id, consumer);

    return {
      id: consumer.id,
      producerId,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
      type: consumer.type,
      producerPaused: consumer.producerPaused,
    };
  }

  private notifyNewProducer(roomId: string, peerId: string, producerId: string, kind: string) {
    // Cette méthode sera appelée par le WebSocket handler pour notifier les autres peers
    console.log(`📢 Nouveau producer ${kind} ${producerId} de ${peerId} dans room ${roomId}`);
  }

  getRouterRtpCapabilities(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error(`Room ${roomId} n'existe pas`);
    }

    return room.router.rtpCapabilities;
  }

  async pauseProducer(roomId: string, producerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const producer = room.producers.get(producerId);
    if (producer) {
      await producer.pause();
      console.log(`⏸️ Producer ${producerId} en pause`);
    }
  }

  async resumeProducer(roomId: string, producerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const producer = room.producers.get(producerId);
    if (producer) {
      await producer.resume();
      console.log(`▶️ Producer ${producerId} repris`);
    }
  }

  async closeProducer(roomId: string, producerId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const producer = room.producers.get(producerId);
    if (producer) {
      producer.close();
      room.producers.delete(producerId);
      console.log(`❌ Producer ${producerId} fermé`);
    }
  }

  getRoomStats(roomId: string) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      peersCount: room.peers.size,
      transportsCount: room.transports.size,
      producersCount: room.producers.size,
      consumersCount: room.consumers.size,
    };
  }
}

export const mediasoupService = new MediasoupService();