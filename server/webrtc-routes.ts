import { Express } from 'express';
import { WebRTCServer } from './webrtc-server';

export function setupWebRTCRoutes(app: Express, webrtcServer: WebRTCServer) {
  // API pour obtenir les statistiques des salles
  app.get('/api/webrtc/stats', (req, res) => {
    try {
      const stats = {
        totalRooms: webrtcServer.getRoomCount(),
        totalUsers: webrtcServer.getTotalUsers(),
        timestamp: new Date().toISOString()
      };
      
      res.json({ success: true, stats });
    } catch (error) {
      console.error('Erreur récupération stats WebRTC:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur serveur' 
      });
    }
  });

  // API pour obtenir les informations d'une salle spécifique
  app.get('/api/webrtc/room/:roomCode', (req, res) => {
    try {
      const { roomCode } = req.params;
      
      if (!roomCode) {
        return res.status(400).json({
          success: false,
          error: 'Code de salle requis'
        });
      }

      const roomInfo = webrtcServer.getRoomInfo(roomCode);
      
      if (!roomInfo) {
        return res.status(404).json({
          success: false,
          error: 'Salle non trouvée'
        });
      }

      res.json({ 
        success: true, 
        room: roomInfo 
      });
    } catch (error) {
      console.error('Erreur récupération info salle:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur serveur' 
      });
    }
  });

  // API pour obtenir toutes les salles actives
  app.get('/api/webrtc/rooms', (req, res) => {
    try {
      const roomsInfo = webrtcServer.getAllRoomsInfo();
      res.json({ 
        success: true, 
        ...roomsInfo 
      });
    } catch (error) {
      console.error('Erreur récupération salles:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Erreur serveur' 
      });
    }
  });

  // API pour vérifier si une salle existe
  app.head('/api/webrtc/room/:roomCode', (req, res) => {
    try {
      const { roomCode } = req.params;
      const roomInfo = webrtcServer.getRoomInfo(roomCode);
      
      if (roomInfo) {
        res.status(200).end();
      } else {
        res.status(404).end();
      }
    } catch (error) {
      res.status(500).end();
    }
  });

  console.log('WebRTC API routes configurées');
}