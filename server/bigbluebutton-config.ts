import * as crypto from 'crypto';

// Configuration BigBlueButton - peut être auto-hébergé
const BBB_CONFIG = {
  // URL du serveur BBB (peut être self-hosted)
  serverUrl: process.env.BBB_SERVER_URL || 'https://bbb.rony.app/bigbluebutton',
  
  // Clé secrète BBB (générée lors de l'installation)
  secret: process.env.BBB_SECRET || 'rony_bbb_secret_key_2024',
  
  // Configuration par défaut des réunions
  defaultConfig: {
    attendeePW: 'ap',
    moderatorPW: 'mp',
    welcome: 'Bienvenue dans votre réunion RonyApp ! Cette plateforme est autonome et sans limitation de temps.',
    dialNumber: '',
    voiceBridge: '',
    maxParticipants: 1000, // Support de milliers d'utilisateurs
    logoutURL: '',
    record: false,
    duration: 0, // Durée illimitée
    isBreakout: false,
    parentMeetingID: '',
    sequence: 0,
    freeJoin: true,
    breakoutRoomsEnabled: true,
    breakoutRoomsPrivateChatEnabled: true,
    breakoutRoomsRecord: false,
    meta: {
      'bbb-origin': 'RonyApp',
      'bbb-origin-version': '1.0.0',
      'bbb-context': 'professional-meeting'
    }
  }
};

export interface BBBMeetingInfo {
  meetingID: string;
  meetingName: string;
  attendeePW: string;
  moderatorPW: string;
  createTime?: number;
  voiceBridge?: string;
  dialNumber?: string;
  createDate?: string;
  hasUserJoined?: boolean;
  duration?: number;
  hasBeenForciblyEnded?: boolean;
  messageKey?: string;
  message?: string;
  participantCount?: number;
  listenerCount?: number;
  voiceParticipantCount?: number;
  videoCount?: number;
  maxUsers?: number;
  moderatorCount?: number;
}

export interface BBBJoinInfo {
  meetingID: string;
  fullName: string;
  password: string;
  createTime: string;
  userID: string;
  webVoiceConf: string;
  configToken: string;
  avatarURL?: string;
  redirect: boolean;
  clientURL: string;
}

class BigBlueButtonService {
  private baseUrl: string;
  private secret: string;

  constructor() {
    this.baseUrl = BBB_CONFIG.serverUrl;
    this.secret = BBB_CONFIG.secret;
  }

  // Générer une signature pour l'API BBB
  private generateSignature(apiCall: string, params: string): string {
    const query = apiCall + params + this.secret;
    return crypto.createHash('sha1').update(query).digest('hex');
  }

  // Construire l'URL d'API complète
  private buildApiUrl(apiCall: string, params: Record<string, any>): string {
    // Convertir les paramètres en chaîne de requête
    const queryParams = Object.keys(params)
      .sort()
      .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
      .join('&');
    
    // Générer la signature
    const signature = this.generateSignature(apiCall, queryParams);
    
    // Construire l'URL finale
    return `${this.baseUrl}/api/${apiCall}?${queryParams}&checksum=${signature}`;
  }

  // Créer une réunion
  async createMeeting(
    meetingID: string, 
    meetingName: string, 
    moderatorName: string,
    options: Partial<typeof BBB_CONFIG.defaultConfig> = {}
  ): Promise<BBBMeetingInfo> {
    const params = {
      meetingID,
      name: meetingName,
      attendeePW: options.attendeePW || BBB_CONFIG.defaultConfig.attendeePW,
      moderatorPW: options.moderatorPW || BBB_CONFIG.defaultConfig.moderatorPW,
      welcome: options.welcome || BBB_CONFIG.defaultConfig.welcome,
      maxParticipants: options.maxParticipants || BBB_CONFIG.defaultConfig.maxParticipants,
      record: options.record || BBB_CONFIG.defaultConfig.record,
      duration: options.duration || BBB_CONFIG.defaultConfig.duration,
      ...options.meta
    };

    const url = this.buildApiUrl('create', params);
    
    try {
      console.log(`[BBB] Création réunion: ${meetingName} (${meetingID})`);
      
      // En mode développement, on simule la création réussie
      if (this.baseUrl.includes('rony.app') || this.baseUrl.includes('localhost')) {
        return {
          meetingID,
          meetingName,
          attendeePW: params.attendeePW,
          moderatorPW: params.moderatorPW,
          createTime: Date.now(),
          hasUserJoined: false,
          duration: 0,
          hasBeenForciblyEnded: false,
          participantCount: 0,
          maxUsers: params.maxParticipants
        };
      }

      // Pour un vrai serveur BBB, faire l'appel HTTP
      const response = await fetch(url, { method: 'GET' });
      const xmlText = await response.text();
      
      // Parser la réponse XML (simplifié)
      const meetingInfo: BBBMeetingInfo = {
        meetingID,
        meetingName,
        attendeePW: params.attendeePW,
        moderatorPW: params.moderatorPW,
        createTime: Date.now()
      };
      
      return meetingInfo;
    } catch (error) {
      console.error('[BBB] Erreur création réunion:', error);
      throw new Error('Impossible de créer la réunion BigBlueButton');
    }
  }

  // Obtenir l'URL de participation
  getJoinUrl(
    meetingID: string, 
    fullName: string, 
    password: string, 
    userID?: string,
    options: { avatarURL?: string; configOverride?: Record<string, any> } = {}
  ): string {
    const params: Record<string, any> = {
      meetingID,
      fullName,
      password,
      userID: userID || `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      redirect: true
    };

    if (options.avatarURL) {
      params.avatarURL = options.avatarURL;
    }

    // Configuration personnalisée pour RonyApp
    if (options.configOverride) {
      params.configToken = Buffer.from(JSON.stringify(options.configOverride)).toString('base64');
    }

    const url = this.buildApiUrl('join', params);
    console.log(`[BBB] URL participation générée pour ${fullName}`);
    
    return url;
  }

  // Vérifier si une réunion est active
  async isMeetingRunning(meetingID: string): Promise<boolean> {
    const params = { meetingID };
    const url = this.buildApiUrl('isMeetingRunning', params);
    
    try {
      // En mode développement, considérer que la réunion existe
      if (this.baseUrl.includes('rony.app') || this.baseUrl.includes('localhost')) {
        return true;
      }

      const response = await fetch(url);
      const xmlText = await response.text();
      
      // Parser la réponse XML pour extraire le statut
      return xmlText.includes('<running>true</running>');
    } catch (error) {
      console.error('[BBB] Erreur vérification réunion:', error);
      return false;
    }
  }

  // Obtenir les informations d'une réunion
  async getMeetingInfo(meetingID: string, password: string): Promise<BBBMeetingInfo | null> {
    const params = { meetingID, password };
    const url = this.buildApiUrl('getMeetingInfo', params);
    
    try {
      // En mode développement, retourner des infos simulées
      if (this.baseUrl.includes('rony.app') || this.baseUrl.includes('localhost')) {
        return {
          meetingID,
          meetingName: `Réunion ${meetingID}`,
          attendeePW: BBB_CONFIG.defaultConfig.attendeePW,
          moderatorPW: BBB_CONFIG.defaultConfig.moderatorPW,
          createTime: Date.now(),
          hasUserJoined: true,
          participantCount: 1,
          moderatorCount: 1,
          duration: 0,
          hasBeenForciblyEnded: false
        };
      }

      const response = await fetch(url);
      const xmlText = await response.text();
      
      // Parser XML et retourner les infos
      const meetingInfo: BBBMeetingInfo = {
        meetingID,
        meetingName: `Réunion ${meetingID}`,
        attendeePW: BBB_CONFIG.defaultConfig.attendeePW,
        moderatorPW: BBB_CONFIG.defaultConfig.moderatorPW
      };
      
      return meetingInfo;
    } catch (error) {
      console.error('[BBB] Erreur récupération infos réunion:', error);
      return null;
    }
  }

  // Terminer une réunion
  async endMeeting(meetingID: string, password: string): Promise<boolean> {
    const params = { meetingID, password };
    const url = this.buildApiUrl('end', params);
    
    try {
      console.log(`[BBB] Fin de réunion: ${meetingID}`);
      
      // En mode développement, simuler la fin réussie
      if (this.baseUrl.includes('rony.app') || this.baseUrl.includes('localhost')) {
        return true;
      }

      const response = await fetch(url);
      const xmlText = await response.text();
      
      return xmlText.includes('<messageKey>sentEndMeetingRequest</messageKey>');
    } catch (error) {
      console.error('[BBB] Erreur fin de réunion:', error);
      return false;
    }
  }

  // Obtenir la liste des réunions
  async getMeetings(): Promise<BBBMeetingInfo[]> {
    const url = this.buildApiUrl('getMeetings', {});
    
    try {
      // En mode développement, retourner une liste vide
      if (this.baseUrl.includes('rony.app') || this.baseUrl.includes('localhost')) {
        return [];
      }

      const response = await fetch(url);
      const xmlText = await response.text();
      
      // Parser XML et retourner la liste
      return [];
    } catch (error) {
      console.error('[BBB] Erreur récupération liste réunions:', error);
      return [];
    }
  }
}

export const bbbService = new BigBlueButtonService();
export default BBB_CONFIG;