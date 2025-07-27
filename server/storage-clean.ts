import { User, InsertUser, Conversation, InsertConversation, Message, InsertMessage, File, InsertFile, Contact, InsertContact, Folder, InsertFolder, FileSharing, InsertFileSharing, Event, InsertEvent, EventParticipant, InsertEventParticipant, ConversationGroup, InsertConversationGroup, GroupMember, InsertGroupMember, EventShare, InsertEventShare } from "@shared/schema";
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
  
  // Folder sharing methods
  getSharedFolders(userId: number): Promise<any[]>;
  
  // Event methods - Système de planification
  createEvent(event: InsertEvent): Promise<Event>;
  getEventsForUser(userId: number): Promise<Event[]>;
  getEventById(eventId: number): Promise<Event | undefined>;
  updateEvent(eventId: number, updates: Partial<Event>): Promise<Event>;
  deleteEvent(eventId: number): Promise<void>;
  
  // Event participants methods
  addEventParticipant(participant: InsertEventParticipant): Promise<EventParticipant>;
  getEventParticipants(eventId: number): Promise<EventParticipant[]>;
  updateParticipantResponse(eventId: number, userId: number, response: string): Promise<void>;
  
  // ✅ EVENT SHARING METHODS - Partage automatique d'événements
  shareEventWithUsers(eventId: number, userEmails: string[], sharedById: number): Promise<void>;
  getSharedEventsForUser(userId: number): Promise<Event[]>;
  isEventSharedWithUser(eventId: number, userId: number): Promise<boolean>;
  
  // Pagination methods
  getPaginatedUsers(options: PaginationOptions): Promise<PaginatedResult<User>>;
  
  // Group methods - Fonctionnalités de groupe complètes
  createConversationGroup(group: InsertConversationGroup): Promise<ConversationGroup>;
  getConversationGroups(userId: number): Promise<ConversationGroup[]>;
  getGroupById(groupId: number): Promise<ConversationGroup | undefined>;
  updateConversationGroup(groupId: number, updates: Partial<ConversationGroup>): Promise<ConversationGroup>;
  deleteConversationGroup(groupId: number): Promise<void>;
  
  // Group member methods
  addGroupMember(member: InsertGroupMember): Promise<GroupMember>;
  getGroupMembers(groupId: number): Promise<GroupMember[]>;
  removeGroupMember(groupId: number, userId: number): Promise<void>;
  updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<void>;

  // Internal Mail methods - SYSTÈME DE COURRIER INTERNE
  createInternalMail(mail: InsertInternalMail): Promise<InternalMail>;
  getInternalMailsForUser(userId: number): Promise<InternalMail[]>;
  markInternalMailAsRead(mailId: number, userId: number): Promise<void>;
}

export class CompleteMemStorage implements IStorageComplete {
  private users: Map<number, User> = new Map();
  private conversations: Map<number, Conversation> = new Map();
  private messages: Map<number, Message> = new Map();
  private files: Map<number, File> = new Map();
  private folders: Map<number, Folder> = new Map();
  private fileSharing: Map<number, FileSharing> = new Map();
  private folderSharing: Map<number, any> = new Map(); // Stockage pour les dossiers partagés
  private contacts: Map<string, Contact> = new Map();
  private events: Map<number, Event> = new Map();
  private eventParticipants: Map<number, EventParticipant> = new Map();
  private reactions: Map<number, any> = new Map();
  private conversationGroups: Map<number, ConversationGroup> = new Map();
  private groupMembers: Map<number, GroupMember> = new Map();
  private eventShares: Map<number, any> = new Map();


  // Compteurs pour les IDs
  private userId = 1;
  private conversationId = 1;
  private messageId = 1;
  private fileId = 1;
  private folderId = 1;
  private fileSharingId = 1;
  private contactId = 1;
  private reactionId = 1;
  private groupId = 1;
  private groupMemberId = 1;
  private eventId = 1;
  private eventParticipantId = 1;
  private eventShareId = 1;


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
  
  async getFilesByFolder(folderId: number | null, userId?: number): Promise<File[]> {
    const files = Array.from(this.files.values()).filter(file => file.folderId === folderId);
    
    // SÉCURITÉ CRITIQUE : Filtrer seulement les fichiers de l'utilisateur connecté
    if (userId) {
      return files.filter(file => file.uploaderId === userId);
    }
    
    return files;
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
    console.log(`[STORAGE] Deleting file ${fileId} and cleaning related shares`);
    
    // Supprimer le fichier
    this.files.delete(fileId);
    
    // Nettoyer automatiquement tous les partages liés à ce fichier
    const sharingToDelete = [];
    for (const [shareId, sharing] of this.fileSharing.entries()) {
      if (sharing.fileId === fileId) {
        sharingToDelete.push(shareId);
      }
    }
    
    for (const shareId of sharingToDelete) {
      this.fileSharing.delete(shareId);
      console.log(`[STORAGE] ✅ Cleaned file sharing ${shareId} for deleted file ${fileId}`);
    }
  }
  
  async getSharedFiles(userId: number): Promise<File[]> {
    console.log(`[STORAGE] Getting files shared WITH user ${userId}`);
    console.log(`[STORAGE] Total fileSharing entries:`, this.fileSharing.size);
    console.log(`[STORAGE] Total files:`, this.files.size);
    console.log(`[STORAGE] All fileSharing data:`, Array.from(this.fileSharing.values()));
    console.log(`[STORAGE] All files data:`, Array.from(this.files.values()));
    
    // Trouver tous les partages où l'utilisateur est destinataire
    const userSharings = Array.from(this.fileSharing.values()).filter(sharing => {
      console.log(`[STORAGE] Checking sharing: fileId=${sharing.fileId}, sharedWithId=${sharing.sharedWithId}, ownerId=${sharing.ownerId}, looking for userId=${userId}`);
      return sharing.sharedWithId === userId;
    });
    
    console.log(`[STORAGE] Found ${userSharings.length} sharings for user ${userId}:`, userSharings);
    
    const sharedFiles = [];
    for (const sharing of userSharings) {
      const file = this.files.get(sharing.fileId);
      console.log(`[STORAGE] Looking for file ID ${sharing.fileId}:`, file ? 'FOUND' : 'NOT FOUND');
      if (file) {
        const sharedByUser = this.users.get(sharing.ownerId);
        console.log(`[STORAGE] Looking for owner ID ${sharing.ownerId}:`, sharedByUser ? 'FOUND' : 'NOT FOUND');
        sharedFiles.push({
          ...file,
          sharedBy: sharedByUser ? {
            id: sharedByUser.id,
            username: sharedByUser.username,
            displayName: sharedByUser.displayName
          } : null,
          permission: sharing.permission,
          sharedAt: sharing.createdAt
        });
      } else {
        console.log(`[STORAGE] ERROR: File ${sharing.fileId} not found - CLEANING ORPHANED SHARE`);
        // Nettoyer automatiquement les partages orphelins
        this.fileSharing.delete(sharing.id);
        console.log(`[STORAGE] ✅ Cleaned orphaned file sharing record ${sharing.id}`);
      }
    }
    
    console.log(`[STORAGE] Returning ${sharedFiles.length} shared files`);
    return sharedFiles;
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

  // Méthode pour récupérer les dossiers partagés avec un utilisateur
  async getSharedFolders(userId: number): Promise<any[]> {
    console.log(`[STORAGE] getSharedFolders for user ${userId}`);
    console.log(`[STORAGE] folderSharing map size: ${this.folderSharing.size}`);
    
    const sharedFolders = [];
    const allFolderSharings = Array.from(this.folderSharing.values());
    console.log(`[STORAGE] All folder sharing entries:`, allFolderSharings);
    
    // Filtrer les partages pour cet utilisateur
    const userFolderSharings = allFolderSharings.filter((sharing: any) => {
      const isMatch = sharing.sharedWithId === userId;
      console.log(`[STORAGE] Checking sharing folderId=${sharing.folderId}, sharedWithId=${sharing.sharedWithId}, userId=${userId}, match=${isMatch}`);
      return isMatch;
    });
    
    console.log(`[STORAGE] Found ${userFolderSharings.length} folder sharings for user ${userId}`);
    
    // Pour chaque partage, récupérer le dossier et ses fichiers
    for (const sharing of userFolderSharings) {
      const folder = this.folders.get(sharing.folderId);
      console.log(`[STORAGE] Folder for ID ${sharing.folderId}:`, folder);
      
      if (folder) {
        // Récupérer l'utilisateur qui a partagé
        const sharedByUser = this.users.get(sharing.ownerId);
        console.log(`[STORAGE] Shared by user:`, sharedByUser);
        
        // Récupérer les fichiers dans ce dossier
        const folderFiles = Array.from(this.files.values()).filter((f: any) => f.folderId === folder.id);
        console.log(`[STORAGE] Files in folder ${folder.id}:`, folderFiles.length);
        
        const sharedFolder = {
          ...folder,
          sharedBy: sharedByUser ? {
            id: sharedByUser.id,
            username: sharedByUser.username,
            displayName: sharedByUser.displayName
          } : null,
          permission: sharing.permission,
          sharedAt: sharing.createdAt,
          fileCount: folderFiles.length,
          files: folderFiles.map((f: any) => ({
            id: f.id,
            name: f.name,
            type: f.type,
            size: f.size,
            url: f.url,
            uploadedAt: f.uploadedAt
          }))
        };
        
        sharedFolders.push(sharedFolder);
        console.log(`[STORAGE] Added shared folder: ${folder.name} with ${folderFiles.length} files`);
      }
    }
    
    console.log(`[STORAGE] Returning ${sharedFolders.length} shared folders`);
    return sharedFolders;
  }

  // Event methods - Système de planification complet
  private eventId = 1;
  private eventParticipantId = 1;

  async createEvent(eventData: InsertEvent): Promise<Event> {
    const id = this.eventId++;
    const event: Event = {
      ...eventData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.events.set(id, event);
    return event;
  }

  // Méthode remplacée par la nouvelle version ci-dessous avec partage automatique

  async getEventById(eventId: number): Promise<Event | undefined> {
    return this.events.get(eventId);
  }

  async updateEvent(eventId: number, updates: Partial<Event>): Promise<Event> {
    const event = this.events.get(eventId);
    if (!event) throw new Error('Event not found');
    
    const updatedEvent = { ...event, ...updates, updatedAt: new Date() };
    this.events.set(eventId, updatedEvent);
    return updatedEvent;
  }

  async deleteEvent(eventId: number): Promise<void> {
    this.events.delete(eventId);
    // Supprimer aussi tous les participants
    for (const [id, participant] of this.eventParticipants.entries()) {
      if (participant.eventId === eventId) {
        this.eventParticipants.delete(id);
      }
    }
  }

  async addEventParticipant(participantData: InsertEventParticipant): Promise<EventParticipant> {
    const id = this.eventParticipantId++;
    const participant: EventParticipant = {
      ...participantData,
      id,
      invitedAt: new Date()
    };
    this.eventParticipants.set(id, participant);
    return participant;
  }

  async getEventParticipants(eventId: number): Promise<EventParticipant[]> {
    return Array.from(this.eventParticipants.values()).filter(p => p.eventId === eventId);
  }

  async updateParticipantResponse(eventId: number, userId: number, response: string): Promise<void> {
    for (const [id, participant] of this.eventParticipants.entries()) {
      if (participant.eventId === eventId && participant.userId === userId) {
        const updatedParticipant = { ...participant, response, respondedAt: new Date() };
        this.eventParticipants.set(id, updatedParticipant);
        break;
      }
    }
  }

  // Group methods implementation
  async createConversationGroup(groupData: InsertConversationGroup): Promise<ConversationGroup> {
    const id = this.groupId++;
    const group: ConversationGroup = {
      ...groupData,
      id,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    this.conversationGroups.set(id, group);
    return group;
  }

  async getConversationGroups(userId: number): Promise<ConversationGroup[]> {
    // Récupérer les groupes où l'utilisateur est membre ou créateur
    const userGroups: ConversationGroup[] = [];
    
    // Groupes créés par l'utilisateur
    for (const group of this.conversationGroups.values()) {
      if (group.createdBy === userId) {
        userGroups.push(group);
      }
    }
    
    // Groupes où l'utilisateur est membre
    for (const member of this.groupMembers.values()) {
      if (member.userId === userId) {
        const group = this.conversationGroups.get(member.groupId);
        if (group && !userGroups.some(g => g.id === group.id)) {
          userGroups.push(group);
        }
      }
    }
    
    return userGroups.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }

  async getGroupById(groupId: number): Promise<ConversationGroup | undefined> {
    return this.conversationGroups.get(groupId);
  }

  async updateConversationGroup(groupId: number, updates: Partial<ConversationGroup>): Promise<ConversationGroup> {
    const group = this.conversationGroups.get(groupId);
    if (!group) throw new Error('Group not found');
    
    const updatedGroup = { ...group, ...updates, updatedAt: new Date() };
    this.conversationGroups.set(groupId, updatedGroup);
    return updatedGroup;
  }

  async deleteConversationGroup(groupId: number): Promise<void> {
    this.conversationGroups.delete(groupId);
    // Supprimer tous les membres du groupe
    for (const [id, member] of this.groupMembers.entries()) {
      if (member.groupId === groupId) {
        this.groupMembers.delete(id);
      }
    }
  }

  async addGroupMember(memberData: InsertGroupMember): Promise<GroupMember> {
    const id = this.groupMemberId++;
    const member: GroupMember = {
      ...memberData,
      id,
      joinedAt: new Date()
    };
    this.groupMembers.set(id, member);
    return member;
  }

  async getGroupMembers(groupId: number): Promise<GroupMember[]> {
    return Array.from(this.groupMembers.values()).filter(m => m.groupId === groupId);
  }

  async removeGroupMember(groupId: number, userId: number): Promise<void> {
    for (const [id, member] of this.groupMembers.entries()) {
      if (member.groupId === groupId && member.userId === userId) {
        this.groupMembers.delete(id);
        break;
      }
    }
  }

  async updateGroupMemberRole(groupId: number, userId: number, role: string): Promise<void> {
    for (const [id, member] of this.groupMembers.entries()) {
      if (member.groupId === groupId && member.userId === userId) {
        const updatedMember = { ...member, role };
        this.groupMembers.set(id, updatedMember);
        break;
      }
    }
  }

  // ✅ EVENT SHARING METHODS - Système de partage automatique d'événements
  async shareEventWithUsers(eventId: number, userEmails: string[], sharedById: number): Promise<void> {
    console.log(`[EVENT-SHARE] Partage événement ${eventId} avec ${userEmails.length} participants`);
    
    for (const email of userEmails) {
      // Nettoyer l'email et vérifier le format @rony.com
      const cleanEmail = email.trim();
      if (!cleanEmail.includes('@')) {
        continue; // Ignore les emails invalides
      }
      
      // Trouver l'utilisateur par email/username
      const targetUser = await this.getUserByUsername(cleanEmail);
      if (!targetUser) {
        console.log(`[EVENT-SHARE] Utilisateur introuvable: ${cleanEmail}`);
        continue;
      }
      
      // Vérifier si déjà partagé
      const existingShare = Array.from(this.eventShares.values()).find(
        (share: any) => share.eventId === eventId && share.sharedWithUserId === targetUser.id
      );
      
      if (!existingShare) {
        // Créer le partage
        const shareId = this.eventShareId++;
        const eventShare = {
          id: shareId,
          eventId,
          sharedWithUserId: targetUser.id,
          sharedByUserId: sharedById,
          sharedAt: new Date(),
          accessLevel: 'read',
          isAutoShared: true,
          emailAddress: cleanEmail
        };
        
        this.eventShares.set(shareId, eventShare);
        console.log(`[EVENT-SHARE] Événement partagé avec ${targetUser.displayName} (${cleanEmail})`);
      }
    }
  }

  async getSharedEventsForUser(userId: number): Promise<Event[]> {
    console.log(`[EVENT-SHARE] Récupération événements partagés pour utilisateur ${userId}`);
    
    // Récupérer tous les partages pour cet utilisateur
    const userShares = Array.from(this.eventShares.values()).filter(
      (share: any) => share.sharedWithUserId === userId
    );
    
    console.log(`[EVENT-SHARE] Trouvé ${userShares.length} partages pour utilisateur ${userId}`);
    
    // Récupérer les événements correspondants
    const sharedEvents: Event[] = [];
    for (const share of userShares) {
      const event = this.events.get(share.eventId);
      if (event) {
        sharedEvents.push(event);
      }
    }
    
    console.log(`[EVENT-SHARE] Retour de ${sharedEvents.length} événements partagés`);
    return sharedEvents;
  }

  async isEventSharedWithUser(eventId: number, userId: number): Promise<boolean> {
    const share = Array.from(this.eventShares.values()).find(
      (share: any) => share.eventId === eventId && share.sharedWithUserId === userId
    );
    return !!share;
  }

  // ✅ MODIFICATION MÉTHODE getEventsForUser - Inclure les événements partagés
  async getEventsForUser(userId: number): Promise<Event[]> {
    console.log(`[EVENTS] Récupérer événements pour utilisateur ${userId}`);
    
    // Événements créés par l'utilisateur
    const ownEvents = Array.from(this.events.values()).filter(
      event => event.creatorId === userId
    );
    
    // Événements partagés avec l'utilisateur
    const sharedEvents = await this.getSharedEventsForUser(userId);
    
    // Combiner et éliminer les doublons
    const allEvents = [...ownEvents];
    for (const sharedEvent of sharedEvents) {
      if (!allEvents.find(e => e.id === sharedEvent.id)) {
        allEvents.push(sharedEvent);
      }
    }
    
    console.log(`[EVENTS] Utilisateur ${userId}: ${ownEvents.length} propres + ${sharedEvents.length} partagés = ${allEvents.length} total`);
    
    return allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
  }


}

export const completeStorage = new CompleteMemStorage();