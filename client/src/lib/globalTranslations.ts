// ✅ SYSTÈME DE TRADUCTION GLOBAL SIMPLE ET EFFICACE
let currentLanguage = 'fr';

// Base de données de traductions globales
export const globalTranslations = {
  fr: {
    // Navigation
    messages: 'Conversations',
    assistant: 'Assistant IA',
    calls: 'Appels',
    meetings: 'Réunions',
    files: 'Fichiers',
    contacts: 'Contacts',
    settings: 'Paramètres',
    planning: 'Planification',
    cloud: 'Cloud',
    courrier: 'Courrier',
    
    // Actions communes
    upload: 'Télécharger',
    download: 'Télécharger',
    share: 'Partager',
    delete: 'Supprimer',
    edit: 'Modifier',
    create: 'Créer',
    search: 'Rechercher',
    save: 'Enregistrer',
    cancel: 'Annuler',
    loading: 'Chargement...',
    
    // Cloud Storage
    cloudStorage: 'Stockage Cloud',
    uploadFiles: 'Upload Fichiers',
    createFolder: 'Nouveau Dossier',
    myFiles: 'Mes fichiers',
    actionsCloud: 'Actions Cloud',
    
    // Notifications
    notifications: 'Notifications',
    markAllRead: 'Tout marquer comme lu',
    noNotifications: 'Aucune notification',
    
    // Thèmes
    lightMode: 'Mode Clair',
    darkMode: 'Mode Sombre',
    skyMode: 'Mode Grille Ciel',
    
    // Messages
    newMessage: 'Nouveau message',
    typeMessage: 'Tapez votre message...',
    sendMessage: 'Envoyer',
    
    // Général
    help: 'Aide',
    close: 'Fermer',
    open: 'Ouvrir',
    back: 'Retour'
  },
  
  en: {
    // Navigation
    messages: 'Conversations',
    assistant: 'AI Assistant',
    calls: 'Calls',
    meetings: 'Meetings',
    files: 'Files',
    contacts: 'Contacts',
    settings: 'Settings',
    planning: 'Planning',
    cloud: 'Cloud',
    courrier: 'Mail',
    
    // Actions communes
    upload: 'Upload',
    download: 'Download',
    share: 'Share',
    delete: 'Delete',
    edit: 'Edit',
    create: 'Create',
    search: 'Search',
    save: 'Save',
    cancel: 'Cancel',
    loading: 'Loading...',
    
    // Cloud Storage
    cloudStorage: 'Cloud Storage',
    uploadFiles: 'Upload Files',
    createFolder: 'New Folder',
    myFiles: 'My Files',
    actionsCloud: 'Cloud Actions',
    
    // Notifications
    notifications: 'Notifications',
    markAllRead: 'Mark All as Read',
    noNotifications: 'No notifications',
    
    // Thèmes
    lightMode: 'Light Mode',
    darkMode: 'Dark Mode',
    skyMode: 'Sky Grid Mode',
    
    // Messages
    newMessage: 'New Message',
    typeMessage: 'Type a message...',
    sendMessage: 'Send',
    
    // Général
    help: 'Help',
    close: 'Close',
    open: 'Open',
    back: 'Back'
  },
  
  es: {
    // Navigation
    messages: 'Conversaciones',
    assistant: 'Asistente IA',
    calls: 'Llamadas',
    meetings: 'Reuniones',
    files: 'Archivos',
    contacts: 'Contactos',
    settings: 'Configuración',
    planning: 'Planificación',
    cloud: 'Nube',
    courrier: 'Correo',
    
    // Actions communes
    upload: 'Subir',
    download: 'Descargar',
    share: 'Compartir',
    delete: 'Eliminar',
    edit: 'Editar',
    create: 'Crear',
    search: 'Buscar',
    save: 'Guardar',
    cancel: 'Cancelar',
    loading: 'Cargando...',
    
    // Cloud Storage
    cloudStorage: 'Almacenamiento en la Nube',
    uploadFiles: 'Subir Archivos',
    createFolder: 'Nueva Carpeta',
    myFiles: 'Mis Archivos',
    actionsCloud: 'Acciones de Nube',
    
    // Notifications
    notifications: 'Notificaciones',
    markAllRead: 'Marcar Todo como Leído',
    noNotifications: 'Sin notificaciones',
    
    // Thèmes
    lightMode: 'Modo Claro',
    darkMode: 'Modo Oscuro',
    skyMode: 'Modo Cielo',
    
    // Messages
    newMessage: 'Nuevo Mensaje',
    typeMessage: 'Escribe un mensaje...',
    sendMessage: 'Enviar',
    
    // Général
    help: 'Ayuda',
    close: 'Cerrar',
    open: 'Abrir',
    back: 'Atrás'
  },
  
  de: {
    // Navigation
    messages: 'Gespräche',
    assistant: 'KI-Assistent',
    calls: 'Anrufe',
    meetings: 'Besprechungen',
    files: 'Dateien',
    contacts: 'Kontakte',
    settings: 'Einstellungen',
    planning: 'Planung',
    cloud: 'Cloud',
    courrier: 'Post',
    
    // Actions communes
    upload: 'Hochladen',
    download: 'Herunterladen',
    share: 'Teilen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    create: 'Erstellen',
    search: 'Suchen',
    save: 'Speichern',
    cancel: 'Abbrechen',
    loading: 'Wird geladen...',
    
    // Cloud Storage
    cloudStorage: 'Cloud-Speicher',
    uploadFiles: 'Dateien hochladen',
    createFolder: 'Neuer Ordner',
    myFiles: 'Meine Dateien',
    actionsCloud: 'Cloud-Aktionen',
    
    // Notifications
    notifications: 'Benachrichtigungen',
    markAllRead: 'Alle als gelesen markieren',
    noNotifications: 'Keine Benachrichtigungen',
    
    // Thèmes
    lightMode: 'Heller Modus',
    darkMode: 'Dunkler Modus',
    skyMode: 'Himmel Modus',
    
    // Messages
    newMessage: 'Neue Nachricht',
    typeMessage: 'Nachricht eingeben...',
    sendMessage: 'Senden',
    
    // Général
    help: 'Hilfe',
    close: 'Schließen',
    open: 'Öffnen',
    back: 'Zurück'
  }
};

// Fonction pour obtenir la langue actuelle
export const getCurrentLanguage = () => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('rony-language') || 'fr';
  }
  return 'fr';
};

// Fonction pour changer la langue
export const setCurrentLanguage = (lang: string) => {
  currentLanguage = lang;
  if (typeof window !== 'undefined') {
    localStorage.setItem('rony-language', lang);
    document.documentElement.lang = lang;
    
    // Déclencher un événement pour rafraîchir tous les composants
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }));
  }
};

// Fonction de traduction globale
export const t = (key: string): string => {
  const lang = getCurrentLanguage();
  const translations = globalTranslations[lang as keyof typeof globalTranslations] || globalTranslations.fr;
  return translations[key as keyof typeof translations] || key;
};

// Hook pour les composants React
export const useGlobalTranslation = () => {
  const [currentLang, setCurrentLang] = React.useState(getCurrentLanguage());
  
  React.useEffect(() => {
    const handleLanguageChange = (event: CustomEvent) => {
      setCurrentLang(event.detail);
    };
    
    window.addEventListener('languageChange', handleLanguageChange as EventListener);
    return () => window.removeEventListener('languageChange', handleLanguageChange as EventListener);
  }, []);
  
  return {
    t: (key: string) => {
      const translations = globalTranslations[currentLang as keyof typeof globalTranslations] || globalTranslations.fr;
      return translations[key as keyof typeof translations] || key;
    },
    currentLanguage: currentLang,
    setLanguage: setCurrentLanguage
  };
};

// Import React pour le hook
import React from 'react';