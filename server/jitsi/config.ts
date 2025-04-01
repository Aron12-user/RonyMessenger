import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

// Configuration du serveur Jitsi
export const JITSI_CONFIG = {
  // Domaine du serveur auto-hébergé (VPS)
  // Pour l'auto-hébergement, il faut configurer un domaine avec DNS et SSL
  DOMAIN: process.env.JITSI_DOMAIN || 'jitsi.rony.app',
  
  // Clé secrète pour la génération des JWT 
  // Cette clé DOIT être la même que celle configurée dans prosody et jicofo
  JWT_SECRET: process.env.JITSI_JWT_SECRET || 'rony_secure_jitsi_jwt_secret',
  
  // Durée de validité du token (24 heures pour éviter les déconnexions)
  JWT_EXPIRY: '24h',
  
  // Préfixe pour les noms de salles
  ROOM_PREFIX: 'rony-meet-',
  
  // Configuration Jicofo (Jitsi Conference Focus - composant qui gère les salles)
  JICOFO: {
    // L'utilisateur focus de Prosody qui se connecte à XMPP
    FOCUS_USER: process.env.JICOFO_FOCUS_USER || 'focus',
    // Le secret pour l'authentification du composant
    COMPONENT_SECRET: process.env.JICOFO_COMPONENT_SECRET || 'jicofo_component_secret',
    // Temps maximal d'inactivité avant de fermer une salle (en secondes) - désactivé (0)
    MAX_IDLE_TIME: 0, // Désactivé pour permettre des réunions de durée illimitée
    // Désactiver la restriction des 5 minutes pour les réunions publiques
    ENABLE_AUTO_OWNER: true, // Tous les utilisateurs sont automatiquement propriétaires
    DISABLE_MEETING_LIMITS: true // Désactive toutes les limitations de durée
  },
  
  // Durée des réunions (en minutes) - valeurs très élevées pour désactiver en pratique
  DEFAULT_MEETING_DURATION: 10080, // 7 jours
  EXTENDED_MEETING_DURATION: 40320, // 28 jours
  
  // Configuration des serveurs TURN/STUN pour les connexions WebRTC
  ICE_SERVERS: [
    // Serveurs STUN publics (pour la découverte NAT)
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    
    // Serveur TURN auto-hébergé (pour contourner les firewalls restrictifs)
    // Nécessite l'installation de coturn sur le VPS
    { 
      urls: process.env.TURN_SERVER_URL || 'turn:turn.rony.app:443',
      username: process.env.TURN_USERNAME || 'ronyuser',
      credential: process.env.TURN_CREDENTIAL || 'ronypassword'
    }
  ]
};

// Générer un code de salle simple à lire et à communiquer
export function generateFriendlyRoomCode(): string {
  // Définir des caractères qui sont faciles à distinguer visuellement et à prononcer
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  
  // Générer un code de 6 caractères
  for (let i = 0; i < 6; i++) {
    if (i > 0 && i % 3 === 0) {
      code += '-'; // Ajouter un tiret tous les 3 caractères pour la lisibilité
    }
    const randomIndex = Math.floor(Math.random() * chars.length);
    code += chars[randomIndex];
  }
  
  return code;
}

// Fonction utilitaire pour contourner les problèmes de typage avec jsonwebtoken
function signJWT(payload: any, secret: string, options: any): string {
  // Utiliser l'import direct plutôt que require
  return jwt.sign(payload, secret, options);
}

// Générer un token JWT pour une salle spécifique
export function generateJitsiToken(roomName: string, userId: number, userName: string, email?: string): string {
  const payload = {
    aud: 'jitsi', // Audience
    iss: 'rony_app', // Émetteur
    sub: JITSI_CONFIG.DOMAIN, // Sujet (domaine Jitsi)
    room: roomName, // Nom de la salle
    context: {
      user: {
        id: userId.toString(),
        name: userName,
        email: email || `user-${userId}@rony.app`,
        moderator: true, // Définir si l'utilisateur est modérateur
      },
    },
  };

  // Générer le JWT avec le secret
  return signJWT(payload, JITSI_CONFIG.JWT_SECRET, {
    expiresIn: JITSI_CONFIG.JWT_EXPIRY,
  });
}

// Interface pour les métadonnées d'une salle
export interface JitsiRoomInfo {
  roomName: string;
  friendlyCode: string;
  createdAt: Date;
  createdBy: number;
  participants: number[];
  expiresAt: Date;
}

// Cache temporaire des salles actives (à remplacer par une persistance en base de données)
const activeRooms = new Map<string, JitsiRoomInfo>();

// Créer une nouvelle salle de réunion
export function createMeetingRoom(userId: number, userName: string): JitsiRoomInfo {
  // Générer un code convivial pour la salle
  const friendlyCode = generateFriendlyRoomCode();
  
  // Créer un identifiant unique pour la salle
  const roomName = `${JITSI_CONFIG.ROOM_PREFIX}${randomBytes(16).toString('hex')}`;
  
  // Définir la date d'expiration
  const now = new Date();
  const expiresAt = new Date(now.getTime() + JITSI_CONFIG.DEFAULT_MEETING_DURATION * 60 * 1000);
  
  // Créer l'information sur la salle
  const roomInfo: JitsiRoomInfo = {
    roomName,
    friendlyCode,
    createdAt: now,
    createdBy: userId,
    participants: [userId],
    expiresAt,
  };
  
  // Stocker l'information de la salle
  activeRooms.set(friendlyCode, roomInfo);
  
  return roomInfo;
}

// Récupérer les informations d'une salle par son code
export function getRoomByCode(code: string): JitsiRoomInfo | undefined {
  return activeRooms.get(code);
}

// Ajouter un participant à une salle
export function addParticipantToRoom(code: string, userId: number): boolean {
  const room = activeRooms.get(code);
  if (!room) return false;
  
  if (!room.participants.includes(userId)) {
    room.participants.push(userId);
    activeRooms.set(code, room);
  }
  
  return true;
}

// Supprimer un participant d'une salle
export function removeParticipantFromRoom(code: string, userId: number): boolean {
  const room = activeRooms.get(code);
  if (!room) return false;
  
  room.participants = room.participants.filter(id => id !== userId);
  
  // Si la salle est vide, la supprimer après un certain délai
  if (room.participants.length === 0) {
    setTimeout(() => {
      const currentRoom = activeRooms.get(code);
      if (currentRoom && currentRoom.participants.length === 0) {
        activeRooms.delete(code);
        console.log(`Salle vide supprimée: ${code}`);
      }
    }, 60000); // 1 minute de délai avant suppression
  } else {
    activeRooms.set(code, room);
  }
  
  return true;
}

// Obtenir toutes les salles actives
export function getAllActiveRooms(): JitsiRoomInfo[] {
  return Array.from(activeRooms.values()).filter(room => room.expiresAt > new Date());
}

// Nettoyer les salles expirées (à exécuter périodiquement)
export function cleanupExpiredRooms(): void {
  const now = new Date();
  // Utilisation d'un tableau intermédiaire pour éviter l'erreur d'itération
  const entries = Array.from(activeRooms.entries());
  
  for (const [code, room] of entries) {
    if (room.expiresAt < now) {
      activeRooms.delete(code);
      console.log(`Salle expirée supprimée: ${code}`);
    }
  }
}