import { IStorage } from './storage';
import {
  User,
  InsertUser,
  Conversation,
  InsertConversation,
  Message,
  InsertMessage,
  File,
  InsertFile,
  Folder,
  InsertFolder,
  FileSharing,
  InsertFileSharing,
  Contact,
  InsertContact
} from '@shared/schema';

export interface PaginationOptions {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export class SimpleStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private files: Map<number, File> = new Map();
  private folders: Map<number, Folder> = new Map();
  private fileSharing: Map<number, FileSharing> = new Map();
  private contacts: Map<number, Contact> = new Map();

  private userId = 1;
  private conversationId = 1;
  private messageId = 1;
  private fileId = 1;
  private folderId = 1;
  private fileSharingId = 1;
  private contactId = 1;

  constructor() {
    // Environnement vide pour tests réels - pas de données fictives
  }

  private seedData() {
    // Create test users with hashed passwords (password = "password")
    const testUsers = [
      {
        username: 'admin@rony.com',
        password: '$2b$10$b8bhXVHeZbs42eXqSnaLguVguVcCmRVD0jufmfbwjgKtkPPaUXpeq',
        displayName: 'Administrateur',
        status: 'online',
        email: 'admin@rony.com',
        phone: '+1 (555) 123-4567',
        title: 'Administrateur Système'
      },
      {
        username: 'john@rony.com',
        password: '$2b$10$b8bhXVHeZbs42eXqSnaLguVguVcCmRVD0jufmfbwjgKtkPPaUXpeq',
        displayName: 'John Doe',
        status: 'away',
        email: 'john@rony.com',
        phone: '+1 (555) 987-6543',
        title: 'Développeur Senior'
      },
      {
        username: 'sarah@rony.com',
        password: '$2b$10$b8bhXVHeZbs42eXqSnaLguVguVcCmRVD0jufmfbwjgKtkPPaUXpeq',
        displayName: 'Sarah Johnson',
        status: 'busy',
        email: 'sarah@rony.com',
        phone: '+1 (555) 456-7890',
        title: 'Chef de Projet'
      }
    ];

    testUsers.forEach(userData => {
      const user: User = {
        id: this.userId++,
        username: userData.username,
        password: userData.password,
        displayName: userData.displayName,
        email: userData.email,
        phone: userData.phone,
        title: userData.title,
        avatar: null,
        theme: null,
        status: userData.status,
        lastSeen: new Date()
      };
      this.users.set(user.id, user);
    });

    // Créer des fichiers de démonstration partagés
    this.createDemoSharedFiles();
  }

  private createDemoSharedFiles() {
    // Créer des fichiers de démonstration pour partage
    const demoFiles = [
      {
        name: 'Rapport_Analyse_Marche.pdf',
        type: 'application/pdf',
        size: 2457600,
        url: 'http://localhost:5000/uploads/demo-rapport.pdf',
        uploaderId: 1, // admin
        sharedWithId: 4
      },
      {
        name: 'Presentation_Strategie.pptx',
        type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        size: 5242880,
        url: 'http://localhost:5000/uploads/demo-presentation.pptx',
        uploaderId: 2, // john
        sharedWithId: 4
      },
      {
        name: 'Dashboard_Analytics.xlsx',
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1048576,
        url: 'http://localhost:5000/uploads/demo-budget.xlsx',
        uploaderId: 3, // sarah
        sharedWithId: 4
      },
      {
        name: 'Design_Guidelines.pdf',
        type: 'application/pdf',
        size: 3145728,
        url: 'http://localhost:5000/uploads/demo-guidelines.pdf',
        uploaderId: 1,
        sharedWithId: 4
      },
      {
        name: 'Video_Tutorial.mp4',
        type: 'video/mp4',
        size: 52428800,
        url: 'http://localhost:5000/uploads/demo-video.mp4',
        uploaderId: 2,
        sharedWithId: 4
      }
    ];

    // Créer des dossiers de démonstration pour partage
    const demoFolders = [
      {
        name: 'Projet_Marketing_Q1',
        uploaderId: 1,
        sharedWithId: 4,
        description: 'Dossier complet du projet marketing Q1 avec ressources'
      },
      {
        name: 'Documentation_Technique',
        uploaderId: 2,
        sharedWithId: 4,
        description: 'Documentation technique complète avec guides et API'
      },
      {
        name: 'Assets_Design',
        uploaderId: 3,
        sharedWithId: 4,
        description: 'Ressources de design et éléments graphiques'
      }
    ];

    // Créer les fichiers
    demoFiles.forEach(fileData => {
      const file: File = {
        id: this.fileId++,
        name: fileData.name,
        type: fileData.type,
        size: fileData.size,
        url: fileData.url,
        uploaderId: fileData.uploaderId,
        folderId: null,
        uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000), // Random dans les 7 derniers jours
        updatedAt: new Date(),
        isShared: true,
        sharedWithId: fileData.sharedWithId,
        expiresAt: null,
        shareLink: null,
        shareLinkExpiry: null,
        isPublic: false
      };
      this.files.set(file.id, file);
    });

    // Créer les dossiers partagés
    demoFolders.forEach(folderData => {
      const folder: Folder = {
        id: this.folderId++,
        name: folderData.name,
        path: `/${folderData.name}`,
        parentId: null,
        ownerId: folderData.uploaderId,
        createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
        iconType: 'folder',
        isShared: true
      };
      this.folders.set(folder.id, folder);

      // Créer quelques fichiers dans chaque dossier
      for (let i = 0; i < Math.floor(Math.random() * 8) + 3; i++) {
        const fileInFolder: File = {
          id: this.fileId++,
          name: `Document_${i + 1}.pdf`,
          type: 'application/pdf',
          size: Math.floor(Math.random() * 5000000) + 100000,
          url: `http://localhost:5000/uploads/folder-${folder.id}-file-${i}.pdf`,
          uploaderId: folderData.uploaderId,
          folderId: folder.id,
          uploadedAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
          updatedAt: new Date(),
          isShared: true,
          sharedWithId: folderData.sharedWithId,
          expiresAt: null,
          shareLink: null,
          shareLinkExpiry: null,
          isPublic: false
        };
        this.files.set(fileInFolder.id, fileInFolder);
      }
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    for (const user of this.users.values()) {
      if (user.username === username) {
        return user;
      }
    }
    return undefined;
  }

  async createUser(userData: InsertUser): Promise<User> {
    const user: User = {
      id: this.userId++,
      username: userData.username,
      password: userData.password,
      displayName: userData.displayName || null,
      email: userData.email || null,
      phone: userData.phone || null,
      title: userData.title || null,
      avatar: userData.avatar || null,
      theme: userData.theme || null,
      status: userData.status || 'offline',
      lastSeen: new Date()
    };
    this.users.set(user.id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getPaginatedUsers(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const allUsers = Array.from(this.users.values());
    const total = allUsers.length;
    const totalPages = Math.ceil(total / options.pageSize);
    const start = (options.page - 1) * options.pageSize;
    const end = start + options.pageSize;
    const data = allUsers.slice(start, end);

    return {
      data,
      total,
      page: options.page,
      pageSize: options.pageSize,
      totalPages,
      hasMore: options.page < totalPages
    };
  }

  async updateUserStatus(userId: number, status: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      user.status = status;
      user.lastSeen = new Date();
    }
  }

  async updateUserProfile(userId: number, profileData: { displayName?: string; email?: string; phone?: string; title?: string; avatar?: string; theme?: string }): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      if (profileData.displayName !== undefined) user.displayName = profileData.displayName;
      if (profileData.email !== undefined) user.email = profileData.email;
      if (profileData.phone !== undefined) user.phone = profileData.phone;
      if (profileData.title !== undefined) user.title = profileData.title;
      if (profileData.avatar !== undefined) user.avatar = profileData.avatar;
      if (profileData.theme !== undefined) user.theme = profileData.theme;
    }
  }

  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsForUser(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(conv => 
      conv.creatorId === userId || conv.participantId === userId
    );
  }

  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const conversation: Conversation = {
      id: this.conversationId++,
      creatorId: conversationData.creatorId,
      participantId: conversationData.participantId,
      createdAt: conversationData.createdAt || new Date(),
      lastMessageTime: conversationData.lastMessageTime || null,
      lastMessage: conversationData.lastMessage || null,
      unreadCount: conversationData.unreadCount || 0
    };
    this.conversations.set(conversation.id, conversation);
    return conversation;
  }

  async updateConversationLastMessage(conversationId: number, lastMessage: string, timestamp: Date, senderId: number): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.lastMessage = lastMessage;
      conversation.lastMessageTime = timestamp;
    }
  }

  async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.unreadCount = 0;
    }
  }

  async getMessagesForConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(msg => msg.conversationId === conversationId);
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const message: Message = {
      id: this.messageId++,
      conversationId: messageData.conversationId,
      senderId: messageData.senderId,
      content: messageData.content,
      timestamp: messageData.timestamp || new Date(),
      isRead: messageData.isRead || null,
      fileUrl: messageData.fileUrl || null
    };
    this.messages.set(message.id, message);
    return message;
  }

  async getFilesForUser(userId: number): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.uploaderId === userId);
  }

  async getFilesByFolder(folderId: number | null): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.folderId === folderId);
  }

  async getFileById(fileId: number): Promise<File | undefined> {
    return this.files.get(fileId);
  }

  async createFile(fileData: InsertFile): Promise<File> {
    const file: File = {
      id: this.fileId++,
      name: fileData.name,
      type: fileData.type,
      size: fileData.size,
      url: fileData.url,
      uploaderId: fileData.uploaderId,
      folderId: fileData.folderId || null,
      uploadedAt: fileData.uploadedAt || new Date(),
      updatedAt: fileData.updatedAt || new Date(),
      expiresAt: fileData.expiresAt || null,
      isShared: fileData.isShared || null,
      sharedWithId: fileData.sharedWithId || null,
      shareLink: fileData.shareLink || null,
      shareLinkExpiry: fileData.shareLinkExpiry || null,
      isPublic: fileData.isPublic || null
    };
    this.files.set(file.id, file);
    return file;
  }

  async updateFile(fileId: number, data: Partial<InsertFile>): Promise<File> {
    const file = this.files.get(fileId);
    if (!file) throw new Error('File not found');
    Object.assign(file, data);
    return file;
  }

  async deleteFile(fileId: number): Promise<void> {
    this.files.delete(fileId);
  }

  async getSharedFiles(userId: number): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.sharedWithId === userId);
  }

  async getFoldersForUser(userId: number): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(folder => folder.ownerId === userId);
  }

  async getFolderById(folderId: number): Promise<Folder | undefined> {
    return this.folders.get(folderId);
  }

  async getFoldersByParent(parentId: number | null, userId: number): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(folder => 
      folder.parentId === parentId && folder.ownerId === userId
    );
  }

  async createFolder(folderData: InsertFolder): Promise<Folder> {
    const folder: Folder = {
      id: this.folderId++,
      name: folderData.name,
      path: folderData.path || '/',
      ownerId: folderData.ownerId,
      parentId: folderData.parentId || null,
      iconType: folderData.iconType || null,
      createdAt: folderData.createdAt || new Date(),
      updatedAt: folderData.updatedAt || new Date(),
      isShared: folderData.isShared || null
    };
    this.folders.set(folder.id, folder);
    return folder;
  }

  async updateFolder(folderId: number, name: string): Promise<Folder> {
    const folder = this.folders.get(folderId);
    if (!folder) throw new Error('Folder not found');
    folder.name = name;
    folder.updatedAt = new Date();
    return folder;
  }

  async updateFolderIcon(folderId: number, iconType: string): Promise<void> {
    const folder = this.folders.get(folderId);
    if (!folder) throw new Error('Folder not found');
    folder.iconType = iconType;
    folder.updatedAt = new Date();
  }

  async deleteFolder(folderId: number): Promise<void> {
    this.folders.delete(folderId);
  }

  async shareFile(sharingData: InsertFileSharing): Promise<FileSharing> {
    const sharing: FileSharing = {
      id: this.fileSharingId++,
      ownerId: sharingData.ownerId,
      sharedWithId: sharingData.sharedWithId,
      fileId: sharingData.fileId,
      permission: sharingData.permission,
      createdAt: sharingData.createdAt || new Date()
    };
    this.fileSharing.set(sharing.id, sharing);
    return sharing;
  }

  async getFileSharingById(id: number): Promise<FileSharing | undefined> {
    return this.fileSharing.get(id);
  }

  async getFileSharingsForFile(fileId: number): Promise<FileSharing[]> {
    return Array.from(this.fileSharing.values()).filter(sharing => sharing.fileId === fileId);
  }

  async revokeFileSharing(id: number): Promise<void> {
    this.fileSharing.delete(id);
  }

  async getContactsForUser(userId: number): Promise<User[]> {
    const userContacts = Array.from(this.contacts.values()).filter(contact => contact.userId === userId);
    const contactUsers: User[] = [];
    for (const contact of userContacts) {
      const user = await this.getUser(contact.contactId);
      if (user) {
        contactUsers.push(user);
      }
    }
    return contactUsers;
  }

  async addContact(contactData: InsertContact): Promise<Contact> {
    const contact: Contact = {
      id: this.contactId++,
      userId: contactData.userId,
      contactId: contactData.contactId,
      createdAt: contactData.createdAt || new Date(),
      isFavorite: contactData.isFavorite || null
    };
    this.contacts.set(contact.id, contact);
    return contact;
  }

  async getPaginatedContactsForUser(userId: number, options: PaginationOptions): Promise<PaginatedResult<User>> {
    const userContacts = Array.from(this.contacts.values()).filter(contact => contact.userId === userId);
    const contactUsers: User[] = [];
    for (const contact of userContacts) {
      const user = await this.getUser(contact.contactId);
      if (user) {
        contactUsers.push(user);
      }
    }

    // Apply sorting
    const sortedContacts = contactUsers.sort((a, b) => {
      const field = options.sortBy as keyof User;
      const aValue = a[field] || '';
      const bValue = b[field] || '';
      
      if (options.sortOrder === 'desc') {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
      return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
    });

    // Apply pagination
    const start = (options.page - 1) * options.pageSize;
    const end = start + options.pageSize;
    const paginatedContacts = sortedContacts.slice(start, end);

    return {
      data: paginatedContacts,
      total: contactUsers.length,
      page: options.page,
      pageSize: options.pageSize,
      totalPages: Math.ceil(contactUsers.length / options.pageSize),
      hasMore: end < contactUsers.length
    };
  }

  async removeContact(userId: number, contactId: number): Promise<void> {
    const contactToRemove = Array.from(this.contacts.values())
      .find(contact => contact.userId === userId && contact.contactId === contactId);
    
    if (contactToRemove) {
      this.contacts.delete(contactToRemove.id);
    }
  }
}