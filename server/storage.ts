import { User, InsertUser, Conversation, InsertConversation, Message, InsertMessage, File, InsertFile, Contact, InsertContact, Folder, InsertFolder, FileSharing, InsertFileSharing } from "@shared/schema";
import { PaginatedResult, PaginationOptions } from "./pg-storage";

// Define the storage interface
export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  getPaginatedUsers(options: PaginationOptions): Promise<PaginatedResult<User>>;
  updateUserStatus(userId: number, status: string): Promise<void>;
  updateUserProfile(userId: number, profileData: { displayName?: string; email?: string; phone?: string; title?: string; avatar?: string; theme?: string }): Promise<void>;

  // Conversations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsForUser(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationLastMessage(conversationId: number, lastMessage: string, timestamp: Date, senderId: number): Promise<void>;
  markConversationAsRead(conversationId: number, userId: number): Promise<void>;

  // Messages
  getMessagesForConversation(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;

  // Folders
  getFoldersForUser(userId: number): Promise<Folder[]>;
  getFolderById(folderId: number): Promise<Folder | undefined>;
  getFoldersByParent(parentId: number | null, userId: number): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(folderId: number, name: string): Promise<Folder>;
  deleteFolder(folderId: number): Promise<void>;

  // Files
  getFilesForUser(userId: number): Promise<File[]>;
  getFilesByFolder(folderId: number | null): Promise<File[]>;
  getFileById(fileId: number): Promise<File | undefined>;
  createFile(file: InsertFile): Promise<File>;
  updateFile(fileId: number, data: Partial<InsertFile>): Promise<File>;
  deleteFile(fileId: number): Promise<void>;
  getSharedFiles(userId: number): Promise<File[]>;

  // File Sharing
  shareFile(sharing: InsertFileSharing): Promise<FileSharing>;
  getFileSharingById(id: number): Promise<FileSharing | undefined>;
  getFileSharingsForFile(fileId: number): Promise<FileSharing[]>;
  revokeFileSharing(id: number): Promise<void>;

  // Contacts
  getContactsForUser(userId: number): Promise<User[]>;
  addContact(contact: InsertContact): Promise<Contact>;

    // Scheduled meetings methods
  getScheduledMeetings(userId: number): Promise<any[]>;
  createScheduledMeeting(meetingData: any): Promise<any>;
  getScheduledMeeting(meetingId: number): Promise<any | undefined>;
  deleteScheduledMeeting(meetingId: number): Promise<void>;
  createActiveMeeting(meetingData: any): Promise<any>;
  getActiveMeetingByCode(friendlyCode: string): Promise<any | undefined>;
  deleteActiveMeeting(friendlyCode: string): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private conversations: Map<number, Conversation>;
  private messages: Map<number, Message>;
  private files: Map<number, File>;
  private contacts: Map<number, Contact>;

  private userId: number = 1;
  private conversationId: number = 1;
  private messageId: number = 1;
  private fileId: number = 1;
  private contactId: number = 1;

  constructor() {
    this.users = new Map();
    this.conversations = new Map();
    this.messages = new Map();
    this.files = new Map();
    this.contacts = new Map();

    // Add some seed data
    this.seedData();
  }

  private seedData() {
    // Create some users
    const users = [
      { username: 'john', password: 'password', displayName: 'John Doe', status: 'online', email: 'john@example.com', phone: '+1 (555) 123-4567', title: 'Software Engineer' },
      { username: 'sarah', password: 'password', displayName: 'Sarah Anderson', status: 'online', email: 'sarah@example.com', phone: '+1 (555) 987-6543', title: 'Product Designer' },
      { username: 'michael', password: 'password', displayName: 'Michael Moore', status: 'away', email: 'michael@example.com', phone: '+1 (555) 456-7890', title: 'Senior Developer' },
      { username: 'jessica', password: 'password', displayName: 'Jessica Wong', status: 'offline', email: 'jessica@example.com', phone: '+1 (555) 321-7654', title: 'Marketing Manager' }
    ];

    users.forEach(userData => this.createUser(userData));

    // Create conversations for the first user
    const user1 = this.getUser(1);
    if (user1) {
      for (let i = 2; i <= 4; i++) {
        const otherUser = this.getUser(i);
        if (otherUser) {
          const conversation = this.createConversation({
            creatorId: 1,
            participantId: i,
            createdAt: new Date(),
            lastMessageTime: new Date(),
            lastMessage: `This is a sample conversation with ${otherUser.displayName || otherUser.username}`,
            unreadCount: i === 3 ? 2 : 0, // Make one conversation have unread messages
          });

          // Add some messages
          this.createMessage({
            conversationId: conversation.id,
            senderId: 1,
            content: `Hi ${otherUser.displayName || otherUser.username}! How are you?`,
            timestamp: new Date(Date.now() - 3600000), // 1 hour ago
            isRead: true
          });

          this.createMessage({
            conversationId: conversation.id,
            senderId: i,
            content: "I'm doing great, thanks for asking! How about you?",
            timestamp: new Date(Date.now() - 1800000), // 30 minutes ago
            isRead: true
          });

          this.createMessage({
            conversationId: conversation.id,
            senderId: 1,
            content: "I'm doing well too. Just working on this new messaging app.",
            timestamp: new Date(),
            isRead: i !== 3 // Only read if not user 3
          });
        }
      }
    }
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(userData: InsertUser): Promise<User> {
    const id = this.userId++;
    const user: User = { 
      ...userData, 
      id, 
      displayName: userData.displayName || userData.username,
      lastSeen: new Date(),
      status: userData.status || 'offline',
    };
    this.users.set(id, user);
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getPaginatedUsers(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const { page = 1, pageSize = 50, sortBy = 'id', sortOrder = 'asc' } = options;

    // Récupérer tous les utilisateurs
    const allUsers = Array.from(this.users.values());

    // Appliquer le tri
    const sortedUsers = [...allUsers].sort((a, b) => {
      const aValue = a[sortBy as keyof User];
      const bValue = b[sortBy as keyof User];

      if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? 1 : -1;

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }

      if (aValue instanceof Date && bValue instanceof Date) {
        return sortOrder === 'asc' 
          ? aValue.getTime() - bValue.getTime() 
          : bValue.getTime() - aValue.getTime();
      }

      // Comparer comme des nombres
      return sortOrder === 'asc' 
        ? Number(aValue) - Number(bValue) 
        : Number(bValue) - Number(aValue);
    });

    // Appliquer la pagination
    const total = sortedUsers.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = sortedUsers.slice(startIndex, endIndex);

    const totalPages = Math.ceil(total / pageSize);

    return {
      data: paginatedUsers,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    };
  }

  async updateUserStatus(userId: number, status: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.status = status;
      user.lastSeen = new Date();
      this.users.set(userId, user);
    }
  }

  async updateUserProfile(userId: number, profileData: { displayName?: string; email?: string; phone?: string; title?: string }): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      // Mettre à jour uniquement les champs fournis
      if (profileData.displayName !== undefined) user.displayName = profileData.displayName;
      if (profileData.email !== undefined) user.email = profileData.email;
      if (profileData.phone !== undefined) user.phone = profileData.phone;
      if (profileData.title !== undefined) user.title = profileData.title;

      this.users.set(userId, user);
    }
  }

  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationsForUser(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      (conversation) => conversation.creatorId === userId || conversation.participantId === userId
    );
  }

  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const id = this.conversationId++;
    const conversation: Conversation = { ...conversationData, id };
    this.conversations.set(id, conversation);
    return conversation;
  }

  async updateConversationLastMessage(conversationId: number, lastMessage: string, timestamp: Date, senderId: number): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (conversation) {
      conversation.lastMessage = lastMessage;
      conversation.lastMessageTime = timestamp;

      // Increment unread count for the recipient
      if (senderId !== conversation.participantId) {
        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      }

      this.conversations.set(conversationId, conversation);
    }
  }

  async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (conversation) {
      // Only reset unread count if the reader is the participant (not the creator)
      if (userId === conversation.participantId) {
        conversation.unreadCount = 0;
        this.conversations.set(conversationId, conversation);
      }

      // Mark all messages as read
      const messages = await this.getMessagesForConversation(conversationId);
      for (const message of messages) {
        if (!message.isRead && message.senderId !== userId) {
          message.isRead = true;
          this.messages.set(message.id, message);
        }
      }
    }
  }

  // Message methods
  async getMessagesForConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  async createMessage(messageData: InsertMessage): Promise<Message> {
    const id = this.messageId++;
    const message: Message = { ...messageData, id };
    this.messages.set(id, message);
    return message;
  }

  // File methods
  async getFilesForUser(userId: number): Promise<File[]> {
    return Array.from(this.files.values())
      .filter(file => file.uploaderId === userId)
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  }

  async createFile(fileData: InsertFile): Promise<File> {
    const id = this.fileId++;
    const file: File = { ...fileData, id };
    this.files.set(id, file);
    return file;
  }

  // Contact methods
  async getContactsForUser(userId: number): Promise<User[]> {
    // Get all contact relationships for this user
    const contactRelationships = Array.from(this.contacts.values())
      .filter(contact => contact.userId === userId);

    // Get the actual user objects for those contacts
    const contactUsers: User[] = [];
    for (const relationship of contactRelationships) {
      const user = await this.getUser(relationship.contactId);
      if (user) {
        contactUsers.push(user);
      }
    }

    return contactUsers;
  }

  async addContact(contactData: InsertContact): Promise<Contact> {
    const id = this.contactId++;
    const contact: Contact = { ...contactData, id };
    this.contacts.set(id, contact);
    return contact;
  }

    // Scheduled meetings methods
    async getScheduledMeetings(userId: number): Promise<any[]> {
      return [];
    }

    async createScheduledMeeting(meetingData: any): Promise<any> {
      return {};
    }

    async getScheduledMeeting(meetingId: number): Promise<any | undefined> {
      return undefined;
    }

    async deleteScheduledMeeting(meetingId: number): Promise<void> {
      // No implementation for MemStorage
    }

    async createActiveMeeting(meetingData: any): Promise<any> {
      return {};
    }

    async getActiveMeetingByCode(friendlyCode: string): Promise<any | undefined> {
      return undefined;
    }

    async deleteActiveMeeting(friendlyCode: string): Promise<void> {
      // No implementation for MemStorage
    }
}

import { PgStorage } from './pg-storage';

// Exporter l'instance PgStorage par défaut, avec MemStorage comme fallback si nécessaire
export const storage = new PgStorage();