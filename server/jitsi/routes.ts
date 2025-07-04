import { Express } from 'express';
import { JitsiRoomInfo, createMeetingRoom, generateJitsiToken, getRoomByCode, getAllActiveRooms, addParticipantToRoom, removeParticipantFromRoom } from './config';

export function registerJitsiRoutes(app: Express, requireAuth: any, activeMeetings: Map<string, any>) {
  // Créer une nouvelle salle de réunion
  app.post('/api/meetings/create', requireAuth, (req, res) => {
    try {
      const userId = (req.user as Express.User).id;
      const userName = (req.user as Express.User).displayName || (req.user as Express.User).username;

      // Créer une nouvelle salle
      const roomInfo = createMeetingRoom(userId, userName);

      // Générer un token JWT pour cette salle
      const token = generateJitsiToken(roomInfo.roomName, userId, userName);

      res.status(201).json({
        success: true,
        room: {
          ...roomInfo,
          token
        }
      });
    } catch (error) {
      console.error('Error creating meeting room:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create meeting room' 
      });
    }
  });

  // Rejoindre une salle de réunion
  app.post('/api/meetings/join', requireAuth, (req, res) => {
    try {
      const { code } = req.body;
      const userId = (req.user as Express.User).id;
      const userName = (req.user as Express.User).displayName || (req.user as Express.User).username;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Meeting code is required'
        });
      }

      // Récupérer les informations de la salle
      const roomInfo = getRoomByCode(code);

      if (!roomInfo) {
        return res.status(404).json({
          success: false,
          message: 'Meeting room not found or has expired'
        });
      }

      // Ajouter l'utilisateur aux participants
      addParticipantToRoom(code, userId);

      // Générer un token JWT pour cette salle
      const token = generateJitsiToken(roomInfo.roomName, userId, userName);

      res.json({
        success: true,
        room: {
          ...roomInfo,
          token
        }
      });
    } catch (error) {
      console.error('Error joining meeting room:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to join meeting room' 
      });
    }
  });

  // Quitter une salle de réunion
  app.post('/api/meetings/leave', requireAuth, (req, res) => {
    try {
      const { code } = req.body;
      const userId = (req.user as Express.User).id;

      if (!code) {
        return res.status(400).json({
          success: false,
          message: 'Meeting code is required'
        });
      }

      // Supprimer l'utilisateur des participants
      const success = removeParticipantFromRoom(code, userId);

      if (!success) {
        return res.status(404).json({
          success: false,
          message: 'Meeting room not found'
        });
      }

      res.json({
        success: true,
        message: 'Successfully left the meeting'
      });
    } catch (error) {
      console.error('Error leaving meeting room:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to leave meeting room' 
      });
    }
  });

  // Get active meetings
  app.get('/api/meetings/active', requireAuth, async (req, res) => {
    try {
      const now = new Date();
      const activeRooms = Array.from(activeMeetings.values())
        .filter(meeting => meeting.expiresAt > now)
        .map(meeting => ({
          friendlyCode: meeting.friendlyCode,
          roomName: meeting.roomName,
          title: meeting.title || `Réunion ${meeting.friendlyCode}`,
          createdBy: meeting.createdBy,
          expiresAt: meeting.expiresAt,
          createdAt: meeting.createdAt
        }));

      res.json({ success: true, rooms: activeRooms });
    } catch (error) {
      console.error('Error fetching active meetings:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch active meetings' });
    }
  });

  // Route pour rafraîchir un token expiré
  app.post('/api/meetings/refresh-token', requireAuth, (req, res) => {
    try {
      const { roomName } = req.body;
      const userId = (req.user as Express.User).id;
      const userName = (req.user as Express.User).displayName || (req.user as Express.User).username;

      if (!roomName) {
        return res.status(400).json({
          success: false,
          message: 'Room name is required'
        });
      }

      // Générer un nouveau token JWT
      const token = generateJitsiToken(roomName, userId, userName);

      res.json({
        success: true,
        token
      });
    } catch (error) {
      console.error('Error refreshing JWT token:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to refresh token' 
      });
    }
  });

  // Route pour vérifier la validité d'un code de réunion
  app.get('/api/meetings/validate/:code', requireAuth, (req, res) => {
    try {
      const { code } = req.params;

      // Récupérer les informations de la salle
      const roomInfo = getRoomByCode(code);

      if (!roomInfo) {
        return res.json({
          success: false,
          valid: false,
          message: 'Invalid or expired meeting code'
        });
      }

      res.json({
        success: true,
        valid: true,
        message: 'Valid meeting code',
        roomInfo: {
          friendlyCode: roomInfo.friendlyCode,
          createdAt: roomInfo.createdAt,
          expiresAt: roomInfo.expiresAt,
          participantsCount: roomInfo.participants.length
        }
      });
    } catch (error) {
      console.error('Error validating meeting code:', error);
      res.status(500).json({ 
        success: false, 
        valid: false,
        message: 'Failed to validate meeting code' 
      });
    }
  });

  console.log('Jitsi meeting routes registered');
}