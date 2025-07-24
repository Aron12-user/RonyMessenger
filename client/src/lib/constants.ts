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
  MESSAGE_REACTION: 'message_reaction',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  MESSAGE_PINNED: 'message_pinned',
  USER_STATUS: 'user_status',
  USER_TYPING: 'user_typing',
  USER_STOP_TYPING: 'user_stop_typing',
  MESSAGE_READ: 'message_read',
  CALL_OFFER: 'call_offer',
  CALL_ANSWER: 'call_answer',
  CALL_REJECTED: 'call_rejected',
  CALL_ENDED: 'call_ended',
  JOIN_MEETING: 'join_meeting',
  LEAVE_MEETING: 'leave_meeting'
};

// Message types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  FILE: 'file',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  SYSTEM: 'system'
};

// Common emoji reactions
export const EMOJI_REACTIONS = [
  '👍', '❤️', '😂', '😮', '😢', '😡', '👎', '🎉', '✅', '❌'
];

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
