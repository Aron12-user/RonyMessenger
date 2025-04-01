import { eq, and, or, desc, sql } from 'drizzle-orm';
import { db } from './db';
import { 
  users, User, InsertUser, 
  conversations, Conversation, InsertConversation,
  messages, Message, InsertMessage,
  files, File, InsertFile,
  contacts, Contact, InsertContact
} from '@shared/schema';
import { IStorage } from './storage';

export class PgStorage implements IStorage {
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.id, id));
    return results.length > 0 ? results[0] : undefined;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const results = await db.select().from(users).where(eq(users.username, username));
    return results.length > 0 ? results[0] : undefined;
  }
  
  async createUser(userData: InsertUser): Promise<User> {
    const results = await db.insert(users).values(userData).returning();
    return results[0];
  }
  
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }
  
  async updateUserStatus(userId: number, status: string): Promise<void> {
    await db.update(users)
      .set({ 
        status, 
        lastSeen: new Date() 
      })
      .where(eq(users.id, userId));
  }
  
  // Conversation methods
  async getConversation(id: number): Promise<Conversation | undefined> {
    const results = await db.select().from(conversations).where(eq(conversations.id, id));
    return results.length > 0 ? results[0] : undefined;
  }
  
  async getConversationsForUser(userId: number): Promise<Conversation[]> {
    return await db.select()
      .from(conversations)
      .where(
        or(
          eq(conversations.creatorId, userId),
          eq(conversations.participantId, userId)
        )
      )
      .orderBy(desc(conversations.lastMessageTime));
  }
  
  async createConversation(conversationData: InsertConversation): Promise<Conversation> {
    const results = await db.insert(conversations).values(conversationData).returning();
    return results[0];
  }
  
  async updateConversationLastMessage(conversationId: number, lastMessage: string, timestamp: Date, senderId: number): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (conversation) {
      let unreadCount = conversation.unreadCount || 0;
      
      // Increment unread count if the message is for the participant
      if (senderId === conversation.creatorId) {
        unreadCount += 1;
      }
      
      await db.update(conversations)
        .set({
          lastMessage,
          lastMessageTime: timestamp,
          unreadCount
        })
        .where(eq(conversations.id, conversationId));
    }
  }
  
  async markConversationAsRead(conversationId: number, userId: number): Promise<void> {
    const conversation = await this.getConversation(conversationId);
    if (conversation) {
      // Only reset unread count if the reader is not the creator
      if (conversation.creatorId !== userId) {
        await db.update(conversations)
          .set({ unreadCount: 0 })
          .where(eq(conversations.id, conversationId));
      }
      
      // Mark all messages from other users as read
      await db.update(messages)
        .set({ isRead: true })
        .where(
          and(
            eq(messages.conversationId, conversationId),
            sql`${messages.senderId} != ${userId}`,
            eq(messages.isRead, false)
          )
        );
    }
  }
  
  // Message methods
  async getMessagesForConversation(conversationId: number): Promise<Message[]> {
    return await db.select()
      .from(messages)
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.timestamp);
  }
  
  async createMessage(messageData: InsertMessage): Promise<Message> {
    const results = await db.insert(messages).values(messageData).returning();
    return results[0];
  }
  
  // File methods
  async getFilesForUser(userId: number): Promise<File[]> {
    return await db.select()
      .from(files)
      .where(eq(files.uploaderId, userId))
      .orderBy(desc(files.uploadedAt));
  }
  
  async createFile(fileData: InsertFile): Promise<File> {
    const results = await db.insert(files).values(fileData).returning();
    return results[0];
  }
  
  // Contact methods
  async getContactsForUser(userId: number): Promise<User[]> {
    // Query pour obtenir les IDs des contacts de l'utilisateur
    const contactRelationships = await db.select()
      .from(contacts)
      .where(eq(contacts.userId, userId));
    
    // Si l'utilisateur n'a pas de contacts, retourner un tableau vide
    if (contactRelationships.length === 0) {
      return [];
    }
    
    // Extraire les IDs des contacts
    const contactIds = contactRelationships.map(contact => contact.contactId);
    
    // Obtenir les utilisateurs correspondants
    const contactUsers = await db.select()
      .from(users)
      .where(
        sql`${users.id} IN (${contactIds.join(', ')})`
      );
    
    return contactUsers;
  }
  
  async addContact(contactData: InsertContact): Promise<Contact> {
    // Vérifier si le contact existe déjà
    const existingContacts = await db.select()
      .from(contacts)
      .where(
        and(
          eq(contacts.userId, contactData.userId),
          eq(contacts.contactId, contactData.contactId)
        )
      );
    
    if (existingContacts.length > 0) {
      return existingContacts[0];
    }
    
    // Créer un nouveau contact
    const results = await db.insert(contacts).values(contactData).returning();
    return results[0];
  }
}