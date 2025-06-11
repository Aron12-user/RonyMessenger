// Status options for users
export const USER_STATUSES = {
  ONLINE: 'online',
  AWAY: 'away',
  BUSY: 'busy',
  OFFLINE: 'offline'
} as const;

// API endpoints
export const API_ENDPOINTS = {
  LOGIN: '/api/login',
  REGISTER: '/api/register',
  LOGOUT: '/api/logout',
  USER: '/api/user',
  USERS: '/api/users',
  CONVERSATIONS: '/api/conversations',
  MESSAGES: '/api/messages',
  FILES: '/api/files',
  CONTACTS: '/api/contacts'
};

// WebSocket message types
export const WS_EVENTS = {
  NEW_MESSAGE: 'new_message',
  USER_STATUS: 'user_status',
  USER_TYPING: 'user_typing',
  MESSAGE_READ: 'message_read',
  CALL_OFFER: 'call_offer',
  CALL_ANSWER: 'call_answer',
  CALL_REJECTED: 'call_rejected',
  CALL_ENDED: 'call_ended',
  JOIN_MEETING: 'join_meeting',
  LEAVE_MEETING: 'leave_meeting',
  // Appels audio/vidéo
  CALL_INVITE: 'call:invite',
  CALL_ACCEPT: 'call:accept',
  CALL_REJECT: 'call:reject',
  CALL_ENDED: 'call:ended',
  CALL_CANDIDATE: 'call:candidate',
  CALL_OFFER: 'call:offer',
  CALL_ANSWER: 'call:answer',

  // WebRTC Room
  JOIN_WEBRTC_ROOM: 'join:webrtc_room',
  LEAVE_WEBRTC_ROOM: 'leave:webrtc_room',
  WEBRTC_OFFER: 'webrtc:offer',
  WEBRTC_ANSWER: 'webrtc:answer',
  WEBRTC_CANDIDATE: 'webrtc:candidate',
  WEBRTC_USER_JOINED: 'webrtc:user_joined',
  WEBRTC_USER_LEFT: 'webrtc:user_left',

  // Meeting events
  JOIN_MEETING: 'join:meeting',
  LEAVE_MEETING: 'leave:meeting',
  MEETING_UPDATE: 'meeting:update',

  // Meeting Room events
  MEETING_ROOM_JOIN: 'meeting_room:join',
  MEETING_ROOM_LEAVE: 'meeting_room:leave',
  MEETING_ROOM_OFFER: 'meeting_room:offer',
  MEETING_ROOM_ANSWER: 'meeting_room:answer',
  MEETING_ROOM_CANDIDATE: 'meeting_room:candidate',
  MEETING_ROOM_USER_JOINED: 'meeting_room:user_joined',
  MEETING_ROOM_USER_LEFT: 'meeting_room:user_left',

  // Error handling
  ERROR: 'error',
  CONNECTION_ERROR: 'connection:error',
};

// Local storage keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_ID: 'user_id',
  THEME: 'theme'
};

// Default colors for user avatars
export const AVATAR_COLORS = [
  'blue',
  'green',
  'purple',
  'red',
  'yellow'
];