import { pgTable, text, serial, integer, boolean, timestamp, index, pgEnum, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Status enum pour garantir des valeurs cohérentes
export const userStatusEnum = pgEnum('user_status', ['online', 'offline', 'away', 'busy']);

// Users Table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  email: text("email"),
  phone: text("phone"),
  title: text("title"),
  status: text("status").default("offline").notNull(),
  lastSeen: timestamp("last_seen").defaultNow(),
}, (table) => {
  return {
    // Index pour les recherches par username (déjà une contrainte unique mais expliciter l'index)
    usernameIdx: uniqueIndex("username_idx").on(table.username),
    // Index pour les recherches par email
    emailIdx: index("email_idx").on(table.email),
    // Index pour les recherches par status (pour trouver rapidement les utilisateurs en ligne)
    statusIdx: index("status_idx").on(table.status),
    // Index pour les recherches par lastSeen (pour les tris chronologiques d'activité)
    lastSeenIdx: index("last_seen_idx").on(table.lastSeen),
  }
});

// Conversations Table
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  creatorId: integer("creator_id").notNull().references(() => users.id),
  participantId: integer("participant_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastMessageTime: timestamp("last_message_time"),
  lastMessage: text("last_message"),
  unreadCount: integer("unread_count").default(0),
}, (table) => {
  return {
    // Index pour accélérer la recherche des conversations par utilisateur
    creatorIdIdx: index("creator_id_idx").on(table.creatorId),
    participantIdIdx: index("participant_id_idx").on(table.participantId),
    // Index pour le tri des conversations par dernier message
    lastMessageTimeIdx: index("last_message_time_idx").on(table.lastMessageTime),
    // Index composite pour trouver rapidement les conversations entre deux utilisateurs
    participantsIdx: index("participants_idx").on(table.creatorId, table.participantId),
  }
});

// Messages Table
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isRead: boolean("is_read").default(false),
}, (table) => {
  return {
    // Index pour accélérer la recherche des messages par conversation
    conversationIdIdx: index("conversation_id_idx").on(table.conversationId),
    // Index pour trouver les messages par expéditeur
    senderIdIdx: index("sender_id_idx").on(table.senderId),
    // Index pour le tri chronologique des messages
    timestampIdx: index("timestamp_idx").on(table.timestamp),
    // Index pour filtrer rapidement les messages non lus
    isReadIdx: index("is_read_idx").on(table.isRead),
    // Index composite pour la pagination efficace des messages par conversation
    convTimestampIdx: index("conv_timestamp_idx").on(table.conversationId, table.timestamp),
  }
});

// Files Table
export const files = pgTable("files", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  size: integer("size").notNull(),
  url: text("url").notNull(),
  uploaderId: integer("uploader_id").notNull().references(() => users.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
}, (table) => {
  return {
    // Index pour accélérer la recherche des fichiers par utilisateur
    uploaderIdIdx: index("uploader_id_idx").on(table.uploaderId),
    // Index pour filtrer par type de fichier
    typeIdx: index("type_idx").on(table.type),
    // Index pour le tri chronologique des fichiers
    uploadedAtIdx: index("uploaded_at_idx").on(table.uploadedAt),
    // Index pour la gestion des expirations
    expiresAtIdx: index("expires_at_idx").on(table.expiresAt),
  }
});

// Contacts Table
export const contacts = pgTable("contacts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  contactId: integer("contact_id").notNull().references(() => users.id),
  isFavorite: boolean("is_favorite").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Index pour accélérer la recherche des contacts d'un utilisateur
    userIdIdx: index("contact_user_id_idx").on(table.userId),
    // Index pour identifier qui a ajouté un utilisateur comme contact
    contactIdIdx: index("contact_id_idx").on(table.contactId),
    // Index composite unique pour éviter les doublons de contacts
    uniqueContactIdx: uniqueIndex("unique_contact_idx").on(table.userId, table.contactId),
    // Index pour filtrer les contacts favoris
    favoriteIdx: index("favorite_idx").on(table.isFavorite),
  }
});

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertConversationSchema = createInsertSchema(conversations).omit({ id: true });
export const insertMessageSchema = createInsertSchema(messages).omit({ id: true });
export const insertFileSchema = createInsertSchema(files).omit({ id: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Conversation = typeof conversations.$inferSelect;
export type InsertConversation = z.infer<typeof insertConversationSchema>;

export type Message = typeof messages.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
