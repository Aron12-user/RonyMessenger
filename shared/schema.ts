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

// Folders Table
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  userId: integer("user_id").notNull().references(() => users.id),
  parentId: integer("parent_id"),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  path: text("path").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  isShared: boolean("is_shared").default(false),
}, (table) => {
  return {
    // Index pour accélérer la recherche des dossiers par utilisateur
    ownerIdIdx: index("folder_owner_id_idx").on(table.ownerId),
    // Index pour la recherche de dossiers par parent
    parentIdIdx: index("parent_id_idx").on(table.parentId),
    // Index pour la recherche rapide par chemin
    pathIdx: index("path_idx").on(table.path),
    // Index pour le tri chronologique des dossiers
    createdAtIdx: index("folder_created_at_idx").on(table.createdAt),
    // Index pour rechercher les dossiers partagés
    isSharedIdx: index("folder_is_shared_idx").on(table.isShared),
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
  folderId: integer("folder_id").references(() => folders.id),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  isShared: boolean("is_shared").default(false),
  sharedWithId: integer("shared_with_id").references(() => users.id),
  shareLink: text("share_link"),
  shareLinkExpiry: timestamp("share_link_expiry"),
  isPublic: boolean("is_public").default(false),
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
    // Index pour recherche par dossier
    folderIdIdx: index("folder_id_idx").on(table.folderId),
    // Index pour rechercher les fichiers partagés
    isSharedIdx: index("file_is_shared_idx").on(table.isShared),
    // Index pour rechercher les fichiers partagés avec un utilisateur spécifique
    sharedWithIdIdx: index("shared_with_id_idx").on(table.sharedWithId),
  }
});

// Shared Access Table (pour garder trace des droits d'accès)
export const fileSharing = pgTable("file_sharing", {
  id: serial("id").primaryKey(),
  fileId: integer("file_id").references(() => files.id).notNull(),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  sharedWithId: integer("shared_with_id").references(() => users.id).notNull(),
  permission: text("permission").notNull(), // 'read', 'write', etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    fileIdIdx: index("sharing_file_id_idx").on(table.fileId),
    sharedWithIdIdx: index("sharing_with_id_idx").on(table.sharedWithId),
    // Index composite pour rechercher efficacement les partages
    fileUserIdx: uniqueIndex("file_user_idx").on(table.fileId, table.sharedWithId),
  }
});

// Scheduled Meetings Table
export const scheduledMeetings = pgTable("scheduled_meetings", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time").notNull(),
  organizerId: integer("organizer_id").notNull().references(() => users.id),
  roomName: text("room_name").notNull(),
  isRecurring: boolean("is_recurring").default(false),
  recurringPattern: text("recurring_pattern"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    organizerIdIdx: index("scheduled_meeting_organizer_idx").on(table.organizerId),
    startTimeIdx: index("scheduled_meeting_start_time_idx").on(table.startTime),
  }
});

// Meeting Participants Table
export const meetingParticipants = pgTable("meeting_participants", {
  id: serial("id").primaryKey(),
  meetingId: integer("meeting_id").notNull().references(() => scheduledMeetings.id),
  userId: integer("user_id").notNull().references(() => users.id),
  status: text("status").notNull(), // 'pending', 'accepted', 'declined'
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    meetingIdIdx: index("participant_meeting_idx").on(table.meetingId),
    userIdIdx: index("participant_user_idx").on(table.userId),
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
export const insertFolderSchema = createInsertSchema(folders).omit({ id: true });
export const insertFileSharingSchema = createInsertSchema(fileSharing).omit({ id: true });
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

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type FileSharing = typeof fileSharing.$inferSelect;
export type InsertFileSharing = z.infer<typeof insertFileSharingSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
