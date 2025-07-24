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

export class MemoryStorage implements IStorage {
  private users: Map<number, User> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private files: Map<number, File> = new Map();
  private folders: Map<number, Folder> = new Map();
  private fileSharing: Map<number, FileSharing> = new Map();
  private contacts: Map<number, Contact> = new Map();

  private userId: number = 1;
  private conversationId: number = 1;
  private messageId: number = 1;
  private fileId: number = 1;
  private folderId: number = 1;
  private fileSharingId: number = 1;
  private contactId: number = 1;

  constructor() {
    // Environnement vide pour tests réels - pas de données fictives
  }

  private async seedData() {
    // Test user creation disabled for security - use registration endpoint instead
    // Hardcoded credentials removed to prevent unauthorized access
    console.log('Test data seeding disabled for security. Use /api/register to create users.');
  }
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
    }

    // Create sample conversations
    const user1 = this.users.get(1);
    if (user1) {
      for (let i = 2; i <= 4; i++) {
        const otherUser = this.users.get(i);
        if (otherUser) {
          const conversationId = this.conversationId++;
          const conversation: Conversation = {
            id: conversationId,
            creatorId: 1,
            participantId: i,
            createdAt: new Date(),
            lastMessageTime: new Date(),
            lastMessage: `Conversation avec ${otherUser.displayName || otherUser.username}`,
            unreadCount: i === 3 ? 2 : 0
          };
          this.conversations.set(conversationId, conversation);

          // Add sample messages
          const messageId1 = this.messageId++;
          const message1: Message = {
            id: messageId1,
            conversationId: conversationId,
            senderId: 1,
            content: `Salut ${otherUser.displayName || otherUser.username}!`,
            timestamp: new Date(Date.now() - 3600000),
            isRead: true,
            fileUrl: null
          };
          this.messages.set(messageId1, message1);
        }
      }
    }
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
      Object.assign(user, profileData);
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
      ...conversationData,
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
      ...messageData,
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
      ...fileData,
      updatedAt: fileData.updatedAt || new Date(),
      isShared: fileData.isShared || null,
      folderId: fileData.folderId || null,
      uploadedAt: fileData.uploadedAt || new Date(),
      expiresAt: fileData.expiresAt || null,
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
      ...folderData,
      createdAt: folderData.createdAt || new Date(),
      updatedAt: folderData.updatedAt || new Date(),
      isShared: folderData.isShared || null,
      parentId: folderData.parentId || null,
      path: folderData.path || '/'
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

  async deleteFolder(folderId: number): Promise<void> {
    this.folders.delete(folderId);
  }

  async shareFile(sharingData: InsertFileSharing): Promise<FileSharing> {
    const sharing: FileSharing = {
      id: this.fileSharingId++,
      ...sharingData,
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
      ...contactData,
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