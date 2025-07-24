import { User, InsertUser, Conversation, InsertConversation, Message, InsertMessage, File, InsertFile, Contact, InsertContact, Folder, InsertFolder, FileSharing, InsertFileSharing } from "@shared/schema";
import { PaginatedResult, PaginationOptions } from "./pg-storage";

// Interface complète et fonctionnelle pour le storage
export interface IStorageComplete {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserStatus(userId: number, status: string): Promise<void>;
  updateUserProfile(userId: number, updates: Partial<User>): Promise<User>;
  
  // Conversations
  getConversation(id: number): Promise<Conversation | undefined>;
  getConversationsForUser(userId: number): Promise<Conversation[]>;
  createConversation(conversation: InsertConversation): Promise<Conversation>;
  updateConversationLastMessage(conversationId: number, lastMessage: string, timestamp: Date, senderId: number): Promise<void>;
  markConversationAsRead(conversationId: number, userId: number): Promise<void>;
  
  // Messages - TOUTES LES FONCTIONNALITÉS
  getMessagesForConversation(conversationId: number): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(messageId: number, updates: Partial<Message>): Promise<Message>;
  deleteMessage(messageId: number): Promise<void>;
  getPinnedMessages(conversationId: number): Promise<Message[]>;
  
  // Message Reactions - FONCTIONNALITÉ COMPLÈTE
  addReaction(reaction: { messageId: number; userId: number; emoji: string; createdAt: Date }): Promise<any>;
  removeReaction(messageId: number, userId: number, emoji: string): Promise<void>;
  getReactionsForMessage(messageId: number): Promise<any[]>;
  
  // Contact methods
  getContactsForUser(userId: number): Promise<User[]>;
  getPaginatedContactsForUser(userId: number, options: PaginationOptions): Promise<PaginatedResult<User>>;
  addContact(contact: InsertContact): Promise<Contact>;
  removeContact(userId: number, contactId: number): Promise<void>;
  
  // File methods
  createFile(file: InsertFile): Promise<File>;
  getFilesByFolder(folderId: number | null): Promise<File[]>;
  getFileById(fileId: number): Promise<File | undefined>;
  updateFile(fileId: number, data: Partial<InsertFile>): Promise<File>;
  deleteFile(fileId: number): Promise<void>;
  getSharedFiles(userId: number): Promise<File[]>;
  
  // Folder methods
  getFoldersByParent(parentId: number | null, userId: number): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  updateFolder(folderId: number, name: string): Promise<Folder>;
  updateFolderIcon(folderId: number, iconType: string): Promise<void>;
  deleteFolder(folderId: number): Promise<void>;
  
  // File sharing methods
  shareFile(sharing: InsertFileSharing): Promise<FileSharing>;
  getFileSharingById(id: number): Promise<FileSharing | undefined>;
  getFileSharingsForFile(fileId: number): Promise<FileSharing[]>;
  revokeFileSharing(id: number): Promise<void>;
  
  // Pagination methods
  getPaginatedUsers(options: PaginationOptions): Promise<PaginatedResult<User>>;
}

export class CompleteMemStorage implements IStorageComplete {
  private users: Map<number, User> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private files: Map<number, File> = new Map();
  private folders: Map<number, Folder> = new Map();
  private fileSharing: Map<number, FileSharing> = new Map();
  private contacts: Map<string, Contact> = new Map();
  private reactions: Map<number, any> = new Map();

  // Compteurs pour les IDs
  private userId = 1;
  private conversationId = 1;
  private messageId = 1;
  private fileId = 1;
  private folderId = 1;
  private fileSharingId = 1;
  private contactId = 1;
  private reactionId = 1;

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const allUsers = Array.from(this.users.values());
    console.log(`[Storage] getUserByUsername: Looking for '${username}' among ${allUsers.length} users`);
    console.log(`[Storage] Available usernames: ${allUsers.map(u => u.username)}`);
    
    const foundUser = allUsers.find(user => user.username === username);
    console.log(`[Storage] Found user: ${foundUser ? foundUser.displayName : 'NOT FOUND'}`);
    
    return foundUser;
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
  
  async updateUserStatus(userId: number, status: string): Promise<void> {
    const user = await this.getUser(userId);
    if (user) {
      user.status = status;
      user.lastSeen = new Date();
      this.users.set(userId, user);
    }
  }
  
  async updateUserProfile(userId: number, updates: Partial<User>): Promise<User> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error('User not found');
    }
    
    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
    return updatedUser;
  }

  async getPaginatedUsers(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const { page = 1, pageSize = 50, sortBy = 'id', sortOrder = 'asc' } = options;
    
    const allUsers = Array.from(this.users.values());
    console.log(`[Storage] getPaginatedUsers: Found ${allUsers.length} users in storage`);
    console.log(`[Storage] User IDs: ${allUsers.map(u => u.id)}`);
    
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
      
      return sortOrder === 'asc' 
        ? Number(aValue) - Number(bValue) 
        : Number(bValue) - Number(aValue);
    });
    
    const total = sortedUsers.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedUsers = sortedUsers.slice(startIndex, endIndex);
    
    const totalPages = Math.ceil(total / pageSize);
    
    console.log(`[Storage] Returning ${paginatedUsers.length} users (page ${page}/${totalPages})`);
    
    return {
      data: paginatedUsers,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    };
  }
  
  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }
  
  async getConversationsForUser(userId: number): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(
      conversation => conversation.creatorId === userId || conversation.participantId === userId
    );
  }
  
  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const id = this.conversationId++;
    const conversation: Conversation = { 
      ...conversationData, 
      id,
      createdAt: conversationData.createdAt || new Date(),
      lastMessageTime: conversationData.lastMessageTime || new Date(),
      lastMessage: conversationData.lastMessage || null,
      unreadCount: conversationData.unreadCount || 0
    };
    this.conversations.set(id, conversation);
    return conversation;
  }
  
  async updateConversationLastMessage(conversationId: number, lastMessage: string, timestamp: Date, senderId: number): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      conversation.lastMessage = lastMessage;
      conversation.lastMessageTime = timestamp;
      
      // Increment unread count for the other participant
      if (senderId !== conversation.participantId) {
        conversation.unreadCount = (conversation.unreadCount || 0) + 1;
      }
      
      this.conversations.set(conversationId, conversation);
    }
  }
  
  async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
    const conversation = this.conversations.get(conversationId);
    if (conversation) {
      if (userId === conversation.participantId) {
        conversation.unreadCount = 0;
        this.conversations.set(conversationId, conversation);
      }
    }
  }
  
  // Message methods - FONCTIONNALITÉ COMPLÈTE
  async getMessagesForConversation(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const id = this.messageId++;
    const message: Message = { 
      id,
      conversationId: messageData.conversationId,
      senderId: messageData.senderId,
      content: messageData.content,
      timestamp: messageData.timestamp || new Date(),
      messageType: messageData.messageType || 'text',
      fileUrl: messageData.fileUrl || null,
      fileName: messageData.fileName || null,
      fileType: messageData.fileType || null,
      fileSize: messageData.fileSize || null,
      isRead: messageData.isRead || false,
      isDeleted: messageData.isDeleted || false,
      isPinned: messageData.isPinned || false,
      isEdited: messageData.isEdited || false,
      editedAt: messageData.editedAt || null,
      replyToId: messageData.replyToId || null,
      reactions: messageData.reactions || [],
      mentions: messageData.mentions || [],
      metadata: messageData.metadata || null
    };
    this.messages.set(id, message);
    return message;
  }

  async updateMessage(messageId: number, updates: Partial<Message>): Promise<Message> {
    const message = this.messages.get(messageId);
    if (!message) {
      throw new Error('Message not found');
    }
    
    const updatedMessage = { ...message, ...updates };
    this.messages.set(messageId, updatedMessage);
    return updatedMessage;
  }

  async deleteMessage(messageId: number): Promise<void> {
    this.messages.delete(messageId);
  }

  async getPinnedMessages(conversationId: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.conversationId === conversationId && message.isPinned)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }

  // Message Reactions - FONCTIONNALITÉ COMPLÈTE
  async addReaction(reaction: { messageId: number; userId: number; emoji: string; createdAt: Date }): Promise<any> {
    const id = this.reactionId++;
    const reactionData = { ...reaction, id };
    this.reactions.set(id, reactionData);
    return reactionData;
  }

  async removeReaction(messageId: number, userId: number, emoji: string): Promise<void> {
    const reactionToRemove = Array.from(this.reactions.entries()).find(([_, reaction]) => 
      reaction.messageId === messageId && reaction.userId === userId && reaction.emoji === emoji
    );
    
    if (reactionToRemove) {
      this.reactions.delete(reactionToRemove[0]);
    }
  }

  async getReactionsForMessage(messageId: number): Promise<any[]> {
    return Array.from(this.reactions.values())
      .filter(reaction => reaction.messageId === messageId);
  }

  // Contact methods
  async getContactsForUser(userId: number): Promise<User[]> {
    const contactKeys = Array.from(this.contacts.keys()).filter(key => 
      key.startsWith(`${userId}-`) || key.endsWith(`-${userId}`)
    );
    
    const contactIds = contactKeys.map(key => {
      const [creatorId, contactId] = key.split('-').map(Number);
      return creatorId === userId ? contactId : creatorId;
    });
    
    return contactIds.map(id => this.users.get(id)).filter(Boolean) as User[];
  }

  async getPaginatedContactsForUser(userId: number, options: PaginationOptions): Promise<PaginatedResult<User>> {
    const { page = 1, pageSize = 50, sortBy = 'displayName', sortOrder = 'asc' } = options;
    
    const contacts = await this.getContactsForUser(userId);
    const sortedContacts = [...contacts].sort((a, b) => {
      const aValue = a[sortBy as keyof User];
      const bValue = b[sortBy as keyof User];
      
      if (aValue === null || aValue === undefined) return sortOrder === 'asc' ? -1 : 1;
      if (bValue === null || bValue === undefined) return sortOrder === 'asc' ? 1 : -1;
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc' 
          ? aValue.localeCompare(bValue) 
          : bValue.localeCompare(aValue);
      }
      
      return sortOrder === 'asc' 
        ? Number(aValue) - Number(bValue) 
        : Number(bValue) - Number(aValue);
    });
    
    const total = sortedContacts.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    const paginatedContacts = sortedContacts.slice(startIndex, endIndex);
    
    const totalPages = Math.ceil(total / pageSize);
    
    return {
      data: paginatedContacts,
      total,
      page,
      pageSize,
      totalPages,
      hasMore: page < totalPages
    };
  }
  
  async addContact(contactData: InsertContact): Promise<Contact> {
    const id = this.contactId++;
    const contact: Contact = { ...contactData, id, createdAt: new Date() };
    const key = `${contactData.userId}-${contactData.contactId}`;
    this.contacts.set(key, contact);
    return contact;
  }
  
  async removeContact(userId: number, contactId: number): Promise<void> {
    const key = `${userId}-${contactId}`;
    this.contacts.delete(key);
  }
  
  // File methods (stubs for compatibility)
  async createFile(fileData: InsertFile): Promise<File> {
    const id = this.fileId++;
    const file: File = { 
      ...fileData, 
      id,
      updatedAt: fileData.updatedAt || new Date(),
      isShared: fileData.isShared || false
    };
    this.files.set(id, file);
    return file;
  }
  
  async getFilesByFolder(folderId: number | null): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => file.folderId === folderId);
  }
  
  async getFileById(fileId: number): Promise<File | undefined> {
    return this.files.get(fileId);
  }
  
  async updateFile(fileId: number, data: Partial<InsertFile>): Promise<File> {
    const file = this.files.get(fileId);
    if (!file) throw new Error('File not found');
    
    const updatedFile = { ...file, ...data };
    this.files.set(fileId, updatedFile);
    return updatedFile;
  }
  
  async deleteFile(fileId: number): Promise<void> {
    this.files.delete(fileId);
  }
  
  async getSharedFiles(userId: number): Promise<File[]> {
    return Array.from(this.files.values()).filter(file => 
      file.uploaderId === userId && file.isShared
    );
  }
  
  // Folder methods (stubs for compatibility)
  async getFoldersByParent(parentId: number | null, userId: number): Promise<Folder[]> {
    return Array.from(this.folders.values()).filter(folder => 
      folder.parentId === parentId && folder.ownerId === userId
    );
  }
  
  async createFolder(folderData: InsertFolder): Promise<Folder> {
    const id = this.folderId++;
    const folder: Folder = { 
      ...folderData, 
      id,
      createdAt: folderData.createdAt || new Date(),
      updatedAt: folderData.updatedAt || new Date(),
      isShared: folderData.isShared || false
    };
    this.folders.set(id, folder);
    return folder;
  }
  
  async updateFolder(folderId: number, name: string): Promise<Folder> {
    const folder = this.folders.get(folderId);
    if (!folder) throw new Error('Folder not found');
    
    folder.name = name;
    folder.updatedAt = new Date();
    this.folders.set(folderId, folder);
    return folder;
  }
  
  async updateFolderIcon(folderId: number, iconType: string): Promise<void> {
    const folder = this.folders.get(folderId);
    if (folder) {
      folder.iconType = iconType;
      folder.updatedAt = new Date();
      this.folders.set(folderId, folder);
    }
  }
  
  async deleteFolder(folderId: number): Promise<void> {
    this.folders.delete(folderId);
  }
  
  // File sharing methods (stubs for compatibility)
  async shareFile(sharingData: InsertFileSharing): Promise<FileSharing> {
    const id = this.fileSharingId++;
    const sharing: FileSharing = { 
      ...sharingData, 
      id,
      createdAt: sharingData.createdAt || new Date()
    };
    this.fileSharing.set(id, sharing);
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
}

export const completeStorage = new CompleteMemStorage();