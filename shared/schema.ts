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
  avatar: text("avatar"), // URL or path to avatar image
  theme: text("theme").default("ocean"), // Selected theme
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

// Messages Table avec fonctionnalités avancées
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  senderId: integer("sender_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  fileUrl: text("file_url"),
  fileName: text("file_name"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  messageType: text("message_type").default("text").notNull(), // text, file, image, audio, video, system
  replyToId: integer("reply_to_id").references(() => messages.id), // Pour les threads/réponses
  isEdited: boolean("is_edited").default(false),
  editedAt: timestamp("edited_at"),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  isRead: boolean("is_read").default(false),
  isDeleted: boolean("is_deleted").default(false),
  deletedAt: timestamp("deleted_at"),
  isPinned: boolean("is_pinned").default(false),
  mentions: text("mentions").array(), // IDs des utilisateurs mentionnés
  metadata: text("metadata"), // JSON pour stocker des métadonnées additionnelles
}, (table) => {
  return {
    conversationIdIdx: index("conversation_id_idx").on(table.conversationId),
    senderIdIdx: index("sender_id_idx").on(table.senderId),
    timestampIdx: index("timestamp_idx").on(table.timestamp),
    isReadIdx: index("is_read_idx").on(table.isRead),
    convTimestampIdx: index("conv_timestamp_idx").on(table.conversationId, table.timestamp),
    replyToIdIdx: index("reply_to_id_idx").on(table.replyToId),
    messageTypeIdx: index("message_type_idx").on(table.messageType),
    isPinnedIdx: index("is_pinned_idx").on(table.isPinned),
    isDeletedIdx: index("is_deleted_idx").on(table.isDeleted),
  }
});

// Table pour les réactions aux messages
export const messageReactions = pgTable("message_reactions", {
  id: serial("id").primaryKey(),
  messageId: integer("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  emoji: text("emoji").notNull(), // 👍, ❤️, 😂, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    messageIdIdx: index("message_reactions_message_id_idx").on(table.messageId),
    userIdIdx: index("message_reactions_user_id_idx").on(table.userId),
    // Contrainte unique pour éviter les réactions dupliquées
    uniqueReaction: uniqueIndex("unique_message_user_emoji").on(table.messageId, table.userId, table.emoji),
  }
});

// Table pour les indicateurs de frappe
export const typingIndicators = pgTable("typing_indicators", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => conversations.id),
  userId: integer("user_id").notNull().references(() => users.id),
  isTyping: boolean("is_typing").default(true),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
}, (table) => {
  return {
    conversationIdIdx: index("typing_conversation_id_idx").on(table.conversationId),
    userIdIdx: index("typing_user_id_idx").on(table.userId),
    lastActivityIdx: index("typing_last_activity_idx").on(table.lastActivity),
    uniqueTyping: uniqueIndex("unique_conversation_user_typing").on(table.conversationId, table.userId),
  }
});

// Folders Table
export const folders = pgTable("folders", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id").notNull().references(() => users.id),
  parentId: integer("parent_id"),
  path: text("path").notNull(),
  iconType: text("icon_type").default("default"), // "default", "orange", "blue", "archive"
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

// Meeting tables removed - using native WebRTC solution without database persistence

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
export const insertMessageReactionSchema = createInsertSchema(messageReactions).omit({ id: true });
export const insertTypingIndicatorSchema = createInsertSchema(typingIndicators).omit({ id: true });
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

export type MessageReaction = typeof messageReactions.$inferSelect;
export type InsertMessageReaction = z.infer<typeof insertMessageReactionSchema>;

export type TypingIndicator = typeof typingIndicators.$inferSelect;
export type InsertTypingIndicator = z.infer<typeof insertTypingIndicatorSchema>;

export type File = typeof files.$inferSelect;
export type InsertFile = z.infer<typeof insertFileSchema>;

export type Folder = typeof folders.$inferSelect;
export type InsertFolder = z.infer<typeof insertFolderSchema>;

export type FileSharing = typeof fileSharing.$inferSelect;
export type InsertFileSharing = z.infer<typeof insertFileSharingSchema>;

export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;

// Folder Sharing Table
export const folderSharing = pgTable("folder_sharing", {
  id: serial("id").primaryKey(),
  folderId: integer("folder_id").references(() => folders.id).notNull(),
  ownerId: integer("owner_id").references(() => users.id).notNull(),
  sharedWithId: integer("shared_with_id").references(() => users.id).notNull(),
  permission: text("permission").notNull(), // 'read', 'write', etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => {
  return {
    folderIdIdx: index("folder_sharing_folder_id_idx").on(table.folderId),
    sharedWithIdIdx: index("folder_sharing_with_id_idx").on(table.sharedWithId),
    folderUserIdx: uniqueIndex("folder_user_idx").on(table.folderId, table.sharedWithId),
  }
});

// Events/Planning Table - Système de planification complet
export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  creatorId: integer("creator_id").notNull().references(() => users.id),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  startTime: text("start_time"), // "09:00" format
  endTime: text("end_time"), // "17:30" format
  isAllDay: boolean("is_all_day").default(false),
  isRecurring: boolean("is_recurring").default(false),
  recurrencePattern: text("recurrence_pattern"), // "daily", "weekly", "monthly", "yearly"
  recurrenceInterval: integer("recurrence_interval").default(1), // every X days/weeks/months
  recurrenceEndDate: timestamp("recurrence_end_date"),
  location: text("location"),
  isInPerson: boolean("is_in_person").default(true),
  isPrivate: boolean("is_private").default(false),
  reminderMinutes: integer("reminder_minutes").default(15), // 15 minutes avant
  calendar: text("calendar").default("default"), // nom du calendrier
  status: text("status").default("confirmed"), // confirmed, cancelled, tentative
  attendeeResponse: text("attendee_response").default("needs_action"), // needs_action, accepted, declined, tentative
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    creatorIdIdx: index("event_creator_id_idx").on(table.creatorId),
    startDateIdx: index("event_start_date_idx").on(table.startDate),
    endDateIdx: index("event_end_date_idx").on(table.endDate),
    statusIdx: index("event_status_idx").on(table.status),
    calendarIdx: index("event_calendar_idx").on(table.calendar),
    isRecurringIdx: index("event_is_recurring_idx").on(table.isRecurring),
  }
});

// Event Participants Table
export const eventParticipants = pgTable("event_participants", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  response: text("response").default("pending"), // pending, accepted, declined, maybe
  isOrganizer: boolean("is_organizer").default(false),
  invitedAt: timestamp("invited_at").defaultNow().notNull(),
  respondedAt: timestamp("responded_at"),
}, (table) => {
  return {
    eventIdIdx: index("event_participants_event_id_idx").on(table.eventId),
    userIdIdx: index("event_participants_user_id_idx").on(table.userId),
    uniqueParticipant: uniqueIndex("unique_event_participant").on(table.eventId, table.userId),
    responseIdx: index("event_participants_response_idx").on(table.response),
  }
});

// Schemas pour les nouveaux modèles
export const insertFolderSharingSchema = createInsertSchema(folderSharing).omit({ id: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertEventParticipantSchema = createInsertSchema(eventParticipants).omit({ id: true });

// Types pour les nouveaux modèles
export type FolderSharing = typeof folderSharing.$inferSelect;
export type InsertFolderSharing = z.infer<typeof insertFolderSharingSchema>;

export type Event = typeof events.$inferSelect;
export type InsertEvent = z.infer<typeof insertEventSchema>;

export type EventParticipant = typeof eventParticipants.$inferSelect;
export type InsertEventParticipant = z.infer<typeof insertEventParticipantSchema>;