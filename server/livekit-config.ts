import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';

// Configuration LiveKit - peut être hébergé sur un VPS dédié
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_WS_URL = process.env.LIVEKIT_WS_URL || 'ws://localhost:7880';

export class LiveKitService {
  private roomService: RoomServiceClient;

  constructor() {
    this.roomService = new RoomServiceClient(LIVEKIT_WS_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET);
  }

  // Générer un token d'accès pour un utilisateur
  async generateAccessToken(roomName: string, participantName: string, isAdmin: boolean = false): Promise<string> {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: participantName,
      name: participantName,
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      roomAdmin: isAdmin,
      roomCreate: isAdmin,
      // Permissions avancées
      canUpdateOwnMetadata: true,
      recorder: isAdmin,
    });

    return at.toJwt();
  }

  // Créer ou obtenir une salle
  async createRoom(roomName: string, maxParticipants: number = 50): Promise<any> {
    try {
      const room = await this.roomService.createRoom({
        name: roomName,
        maxParticipants: maxParticipants,
        emptyTimeout: 0, // Pas de timeout - salle reste active
        metadata: JSON.stringify({
          created: new Date().toISOString(),
          app: 'RonyApp'
        })
      });
      
      console.log(`[LiveKit] Salle créée: ${roomName}`);
      return room;
    } catch (error: any) {
      if (error.message?.includes('already exists')) {
        console.log(`[LiveKit] Salle existe déjà: ${roomName}`);
        return await this.getRoomInfo(roomName);
      }
      throw error;
    }
  }

  // Obtenir les informations d'une salle
  async getRoomInfo(roomName: string): Promise<any> {
    try {
      const rooms = await this.roomService.listRooms([roomName]);
      return rooms.length > 0 ? rooms[0] : null;
    } catch (error) {
      console.error(`[LiveKit] Erreur récupération salle ${roomName}:`, error);
      return null;
    }
  }

  // Lister les participants d'une salle
  async getParticipants(roomName: string): Promise<any[]> {
    try {
      const participants = await this.roomService.listParticipants(roomName);
      return participants;
    } catch (error) {
      console.error(`[LiveKit] Erreur participants ${roomName}:`, error);
      return [];
    }
  }

  // Supprimer un participant
  async removeParticipant(roomName: string, participantId: string): Promise<void> {
    try {
      await this.roomService.removeParticipant(roomName, participantId);
      console.log(`[LiveKit] Participant retiré: ${participantId} de ${roomName}`);
    } catch (error) {
      console.error(`[LiveKit] Erreur suppression participant:`, error);
    }
  }

  // Fermer une salle
  async deleteRoom(roomName: string): Promise<void> {
    try {
      await this.roomService.deleteRoom(roomName);
      console.log(`[LiveKit] Salle supprimée: ${roomName}`);
    } catch (error) {
      console.error(`[LiveKit] Erreur suppression salle:`, error);
    }
  }

  // Obtenir les statistiques d'une salle
  async getRoomStats(roomName: string): Promise<any> {
    try {
      const room = await this.getRoomInfo(roomName);
      const participants = await this.getParticipants(roomName);
      
      return {
        room,
        participantCount: participants.length,
        participants: participants.map(p => ({
          id: p.identity,
          name: p.name,
          joinedAt: p.joinedAt,
          isConnected: p.state === 'ACTIVE'
        }))
      };
    } catch (error) {
      console.error(`[LiveKit] Erreur stats salle:`, error);
      return null;
    }
  }
}

export const liveKitService = new LiveKitService();