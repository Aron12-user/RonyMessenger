// Configuration spécifique pour Google Cloud Run
export const productionConfig = {
  // Configuration du serveur
  port: parseInt(process.env.PORT || '8080', 10), // Cloud Run utilise le port 8080 par défaut
  host: '0.0.0.0', // Important pour Cloud Run
  
  // Configuration de la base de données
  database: {
    url: process.env.DATABASE_URL || '',
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connectionLimit: 20,
    idleTimeout: 30000,
    connectionTimeout: 60000
  },

  // Configuration des sessions
  session: {
    secret: process.env.SESSION_SECRET || 'rony-default-secret-change-in-production',
    name: 'rony.sid',
    maxAge: parseInt(process.env.SESSION_MAX_AGE || '86400000', 10), // 24h
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
  },

  // Configuration CORS
  cors: {
    origin: process.env.ALLOWED_ORIGINS?.split(',') || ['https://localhost:5000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  },

  // Configuration des uploads
  uploads: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '100000000', 10), // 100MB
    maxFiles: parseInt(process.env.MAX_FILES_PER_UPLOAD || '20', 10),
    allowedMimeTypes: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv', 'application/json',
      'audio/mpeg', 'audio/wav', 'audio/ogg',
      'video/mp4', 'video/webm', 'video/ogg',
      'application/zip', 'application/x-rar-compressed'
    ]
  },

  // Configuration du logging
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: 'json' // Pour Cloud Logging
  },

  // Configuration de santé
  health: {
    checkInterval: 30000, // 30 secondes
    timeout: 5000 // 5 secondes
  }
};

// Validation de la configuration
export const validateConfig = () => {
  const errors: string[] = [];
  
  if (!process.env.DATABASE_URL) {
    errors.push('DATABASE_URL is required in production');
  }
  
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET === 'rony-default-secret-change-in-production') {
    errors.push('SESSION_SECRET must be set to a secure value in production');
  }
  
  if (errors.length > 0) {
    throw new Error(`Configuration validation failed:\n${errors.join('\n')}`);
  }
  
  return true;
};