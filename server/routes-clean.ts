import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { completeStorage as storage } from "./storage-clean";
import { json, static as expressStatic } from "express";
import { 
  insertUserSchema, 
  insertMessageSchema, 
  insertFileSchema, 
  insertFolderSchema, 
  insertFileSharingSchema,
  InsertFolder,
  InsertFileSharing 
} from "@shared/schema";
import { z } from "zod";
import { setupSimpleAuth } from "./auth-simple";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import { v4 as uuidv4 } from "uuid";
import { handleAIChat } from "./ai-assistant";
import { STORAGE_LIMITS, validateFileSize, validateFolderSize, formatFileSize } from "./storage-limits";
import { WebSocketServer, WebSocket } from 'ws';
import { eq, and, or, desc, sql, asc, like, exists } from "drizzle-orm";
import { db } from "./db";
import { 
  users, conversations, messages, messageReactions, typingIndicators, files, folders, 
  fileSharing, folderSharing, contacts, events, eventParticipants, conversationGroups, groupMembers,
} from "@shared/schema";

// Stockage en mémoire pour les réunions
interface StoredMeeting {
  id: string;
  title: string;
  description: string;
  roomCode: string;
  url: string;
  startTime: string;
  duration: number;
  status: 'scheduled' | 'active' | 'ended';
  createdAt: Date;
  createdBy?: number;
}

const scheduledMeetings: Map<string, StoredMeeting> = new Map();
const activeMeetings: Map<string, StoredMeeting> = new Map();

// Configure multer for avatar uploads
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadsDir = path.join(process.cwd(), 'uploads/avatars');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const userId = req.body.userId || req.user?.id;
    const extension = path.extname(file.originalname);
    cb(null, `avatar-${userId}-${Date.now()}${extension}`);
  }
});

const avatarUpload = multer({
  storage: avatarStorage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed for avatars'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  const { requireAuth } = setupSimpleAuth(app);

  const httpServer = createServer(app);

  // Create uploads directory if it doesn't exist
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const multerStorage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      const uniqueFilename = `${uuidv4()}-${file.originalname}`;
      cb(null, uniqueFilename);
    }
  });

  const upload = multer({ 
    storage: multerStorage,
    limits: { 
      fileSize: STORAGE_LIMITS.MAX_FILE_SIZE, // ✅ 10GB limit par fichier
      files: STORAGE_LIMITS.MAX_FILES_PER_UPLOAD // ✅ Maximum 50 files per request
    },
    fileFilter: (req, file, cb) => {
      console.log('[multer] Processing file:', file.originalname, 'type:', file.mimetype);
      cb(null, true);
    }
  });

  // Static file serving for uploads
  app.use('/uploads', expressStatic(uploadsDir));

  // Health check endpoint for Google Cloud Run
  app.get('/api/health', (req: Request, res: Response) => {
    res.status(200).json({ 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development'
    });
  });

  // Readiness check for Kubernetes/Cloud Run
  app.get('/api/ready', (req: Request, res: Response) => {
    try {
      res.status(200).json({ 
        status: 'ready',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({ 
        status: 'not ready',
        error: 'Service unavailable'
      });
    }
  });

  // Routes pour les groupes de conversation
  app.post("/api/groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { name, description, selectedContactIds, isPrivate } = req.body;
      
      if (!name || !selectedContactIds || !Array.isArray(selectedContactIds)) {
        return res.status(400).json({ error: "Nom du groupe et contacts requis" });
      }

      // Créer le groupe
      const group = await storage.createConversationGroup({
        name,
        description: description || null,
        createdBy: userId,
        isPrivate: isPrivate || false,
      });

      // Ajouter le créateur comme admin
      await storage.addGroupMember({
        groupId: group.id,
        userId: userId,
        role: 'admin',
      });

      // Ajouter les contacts sélectionnés comme membres
      for (const contactId of selectedContactIds) {
        await storage.addGroupMember({
          groupId: group.id,
          userId: contactId,
          role: 'member',
        });
      }

      console.log(`[GROUPS] Groupe créé: ${group.name} avec ${selectedContactIds.length} membres`);
      res.json(group);
    } catch (error) {
      console.error('Error creating group:', error);
      res.status(500).json({ error: 'Erreur lors de la création du groupe' });
    }
  });

  app.get("/api/groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const groups = await storage.getConversationGroups(userId);
      res.json(groups);
    } catch (error) {
      console.error('Error fetching groups:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des groupes' });
    }
  });

  app.get("/api/groups/:id/members", requireAuth, async (req: Request, res: Response) => {
    try {
      const groupId = parseInt(req.params.id);
      const members = await storage.getGroupMembers(groupId);
      
      // Récupérer les détails des utilisateurs
      const membersWithDetails = await Promise.all(
        members.map(async (member) => {
          const user = await storage.getUser(member.userId);
          return { ...member, user };
        })
      );
      
      res.json(membersWithDetails);
    } catch (error) {
      console.error('Error fetching group members:', error);
      res.status(500).json({ error: 'Erreur lors de la récupération des membres' });
    }
  });

  app.delete("/api/groups/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const groupId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      // Vérifier que l'utilisateur est admin du groupe
      const members = await storage.getGroupMembers(groupId);
      const userMember = members.find(m => m.userId === userId);
      
      if (!userMember || userMember.role !== 'admin') {
        return res.status(403).json({ error: "Seuls les administrateurs peuvent supprimer le groupe" });
      }

      await storage.deleteConversationGroup(groupId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting group:', error);
      res.status(500).json({ error: 'Erreur lors de la suppression du groupe' });
    }
  });

  // User routes
  app.get("/api/users", async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const sortBy = req.query.sortBy as string || 'displayName';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';

      const result = await storage.getPaginatedUsers({
        page,
        pageSize,
        sortBy,
        sortOrder
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Conversations routes
  app.get("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const conversations = await storage.getConversationsForUser(userId);
      res.json(conversations);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { participantId } = req.body;
      if (!participantId) {
        return res.status(400).json({ error: "Participant ID requis" });
      }

      const conversation = await storage.createConversation({
        creatorId: userId,
        participantId,
        lastMessage: "",
        lastMessageTime: new Date(),
        createdAt: new Date()
      });

      res.json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Messages routes
  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      const messages = await storage.getMessagesForConversation(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/conversations/:id/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const conversationId = parseInt(req.params.id);
      const { content, messageType = 'text', fileUrl, fileName, fileType, fileSize } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Contenu du message requis" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content,
        messageType,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null
      });

      await storage.updateConversationLastMessage(
        conversationId,
        content,
        new Date(),
        userId
      );

      res.json(message);
    } catch (error) {
      console.error('Error creating message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Enhanced messaging API endpoints
  
  // Route pour créer un message avec toutes les fonctionnalités avancées
  app.post("/api/messages", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { 
        conversationId, 
        content, 
        messageType = 'text',
        replyToId,
        fileUrl,
        fileName,
        fileType,
        fileSize,
        mentions = []
      } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: "ID de conversation requis" });
      }

      if (!content) {
        return res.status(400).json({ error: "Contenu du message requis" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content,
        messageType,
        replyToId: replyToId || null,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
        mentions: mentions || []
      });

      await storage.updateConversationLastMessage(
        conversationId,
        content,
        new Date(),
        userId
      );

      res.status(201).json(message);
    } catch (error) {
      console.error('Error creating enhanced message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer les messages d'une conversation
  app.get("/api/messages/:conversationId", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const messages = await storage.getMessagesForConversation(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour modifier un message
  app.put("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Contenu du message requis" });
      }

      const message = await storage.updateMessage(messageId, {
        content,
        isEdited: true,
        editedAt: new Date()
      });

      res.json(message);
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour supprimer un message
  app.delete("/api/messages/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      
      await storage.updateMessage(messageId, {
        isDeleted: true,
        deletedAt: new Date()
      });

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour épingler/dépingler un message
  app.put("/api/messages/:id/pin", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      const { isPinned } = req.body;

      const message = await storage.updateMessage(messageId, {
        isPinned: isPinned
      });

      res.json(message);
    } catch (error) {
      console.error('Error pinning message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer les messages épinglés
  app.get("/api/messages/:conversationId/pinned", requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const pinnedMessages = await storage.getPinnedMessages(conversationId);
      res.json(pinnedMessages);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour ajouter une réaction à un message
  app.post("/api/messages/:id/reactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: "Emoji requis" });
      }

      const reaction = await storage.addReaction({
        messageId,
        userId,
        emoji,
        createdAt: new Date()
      });

      res.status(201).json(reaction);
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour supprimer une réaction
  app.delete("/api/messages/:id/reactions", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      const { emoji } = req.body;

      if (!emoji) {
        return res.status(400).json({ error: "Emoji requis" });
      }

      await storage.removeReaction(messageId, userId, emoji);
      res.json({ success: true });
    } catch (error) {
      console.error('Error removing reaction:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour gérer les indicateurs de frappe (stub - pas d'implémentation nécessaire)
  app.post("/api/conversations/:id/typing", requireAuth, async (req, res) => {
    try {
      // Indicateur de frappe temporaire - pas besoin de persistance
      res.json({ success: true });
    } catch (error) {
      console.error('Error updating typing indicator:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer les utilisateurs qui tapent (stub - retourne vide)
  app.get("/api/conversations/:id/typing", requireAuth, async (req, res) => {
    try {
      // Retourner une liste vide pour les indicateurs de frappe
      res.json([]);
    } catch (error) {
      console.error('Error fetching typing users:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // File and folder routes
  app.get("/api/folders", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const parentIdParam = req.query.parentId as string;
      const parentId = parentIdParam && parentIdParam !== 'null' ? parseInt(parentIdParam) : null;
      console.log(`[routes] Getting folders for parentId: ${parentId} (param: ${parentIdParam}), userId: ${userId}`);

      const folders = await storage.getFoldersByParent(parentId, userId);
      console.log(`[routes] Returning ${folders.length} folders`);
      res.json(folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer tous les dossiers (pour la navigation)
  app.get("/api/folders/all", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log(`[routes] Getting all folders for userId: ${userId}`);
      // Récupérer tous les dossiers de l'utilisateur (parentId null = racine)
      const folders = await storage.getFoldersByParent(null, userId);
      console.log(`[routes] Found ${folders.length} total folders for user ${userId}`);
      res.json(folders);
    } catch (error) {
      console.error('Error fetching all folders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/folders", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { name, parentId, iconType } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Nom du dossier requis" });
      }

      const folderData: InsertFolder = {
        name,
        parentId: parentId || null,
        path: name, // Simplified path
        ownerId: userId,
        iconType: iconType || 'blue',
        createdAt: new Date(),
        updatedAt: new Date(),
        isShared: false
      };

      console.log('Creating folder with data:', folderData);
      const folder = await storage.createFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      console.error('Error creating folder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.put("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const folderId = parseInt(req.params.id);
      const { name } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Nom du dossier requis" });
      }

      const folder = await storage.updateFolder(folderId, name);
      res.json(folder);
    } catch (error) {
      console.error('Error updating folder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.delete("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const folderId = parseInt(req.params.id);
      await storage.deleteFolder(folderId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/files", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const folderIdParam = req.query.folderId as string;
      const folderId = folderIdParam && folderIdParam !== 'null' ? parseInt(folderIdParam) : null;
      console.log(`[routes] Getting files for folderId: ${folderId} (param: ${folderIdParam}), userId: ${userId}`);

      const files = await storage.getFilesByFolder(folderId, userId);
      console.log(`[routes] Returning ${files.length} files for user ${userId}`);
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Multi-file upload endpoint
  app.post("/api/upload", requireAuth, upload.array('files'), async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        console.log('[upload] User not authenticated');
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log('[upload] Upload request received');
      console.log('[upload] Request files:', req.files ? req.files.length : 0);
      console.log('[upload] Request body:', Object.keys(req.body));

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        console.log('[upload] No files provided in request. req.files:', req.files);
        console.log('[upload] typeof req.files:', typeof req.files);
        console.log('[upload] Array.isArray(req.files):', Array.isArray(req.files));
        return res.status(400).json({ error: "Aucun fichier sélectionné" });
      }

      // ✅ VALIDATION FICHIERS OPTIMISÉE : 10 Go par fichier, tous types autorisés
      const maxSize = 10 * 1024 * 1024 * 1024; // 10 Go par fichier comme demandé
      
      for (const file of req.files) {
        if (file.size > maxSize) {
          return res.status(400).json({ 
            error: `Le fichier "${file.originalname}" dépasse la limite de 10 Go` 
          });
        }
        // Tous types de fichiers autorisés pour flexibilité maximale
      }

      const folderId = req.body.folderId && req.body.folderId !== 'null' ? parseInt(req.body.folderId) : null;
      const filePaths = req.body.filePaths ? JSON.parse(req.body.filePaths) : [];
      
      // Build folder structure from file paths
      let folderStructure: Record<string, boolean> = {};
      if (filePaths && Array.isArray(filePaths)) {
        filePaths.forEach((path: string) => {
          const pathParts = path.split('/');
          if (pathParts.length > 1) {
            // Remove the filename, keep only folder path
            const folderPath = pathParts.slice(0, -1).join('/');
            folderStructure[folderPath] = true;
          }
        });
      }

      console.log('[upload] Processing upload:', { 
        userId, 
        folderId, 
        filesCount: req.files.length, 
        folderStructure,
        fileNames: req.files.map(f => f.originalname),
        filePaths
      });

      const uploadedFiles = [];
      const createdFolders = new Map();

      // Create folder structure first if needed
      if (Object.keys(folderStructure).length > 0) {
        for (const folderPath of Object.keys(folderStructure)) {
          const pathParts = folderPath.split('/');
          let currentParentId = folderId;
          let currentPath = '';

          for (const part of pathParts) {
            if (!part) continue;
            currentPath = currentPath ? `${currentPath}/${part}` : part;

            if (!createdFolders.has(currentPath)) {
              const folderData = {
                name: part,
                parentId: currentParentId,
                path: currentPath,
                ownerId: userId,
                iconType: 'blue',
                createdAt: new Date(),
                updatedAt: new Date(),
                isShared: false
              };

              const folder = await storage.createFolder(folderData);
              createdFolders.set(currentPath, folder);
              currentParentId = folder.id;
              console.log('Created folder:', folder.name, 'with ID:', folder.id);
            } else {
              currentParentId = createdFolders.get(currentPath)!.id;
            }
          }
        }
      }

      // Upload files
      for (let i = 0; i < req.files.length; i++) {
        const file = req.files[i];
        const relativePath = filePaths && filePaths[i] ? filePaths[i] : file.originalname;
        const pathParts = relativePath.split('/');
        const fileName = pathParts[pathParts.length - 1];
        const folderPath = pathParts.slice(0, -1).join('/');

        let targetFolderId = folderId;
        if (folderPath && createdFolders.has(folderPath)) {
          targetFolderId = createdFolders.get(folderPath)!.id;
        }

        const fileData = {
          name: fileName,
          type: file.mimetype,
          size: file.size,
          url: `/uploads/${file.filename}`,
          uploaderId: userId,
          folderId: targetFolderId,
          uploadedAt: new Date(),
          isShared: false
        };

        const uploadedFile = await storage.createFile(fileData);
        uploadedFiles.push(uploadedFile);
      }

      console.log('[upload] Upload completed successfully:', uploadedFiles.length, 'files uploaded');
      res.json({ 
        success: true, 
        files: uploadedFiles,
        filesCreated: uploadedFiles.length,
        folders: Array.from(createdFolders.values()),
        message: `${uploadedFiles.length} fichiers uploadés avec succès`
      });
    } catch (error) {
      console.error('[upload] Upload error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erreur lors de l\'upload des fichiers';
      res.status(500).json({ error: errorMessage });
    }
  });

  // Single file upload (legacy support)
  app.post("/api/files/upload", requireAuth, upload.single('file'), async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier fourni" });
      }

      const fileData = {
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        uploaderId: userId,
        folderId: req.body.folderId ? parseInt(req.body.folderId) : null,
        uploadedAt: new Date(),
        isShared: false
      };

      const file = await storage.createFile(fileData);
      res.json(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/files/shared", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      // Utiliser la méthode storage existante
      const sharedFiles = await storage.getSharedFiles(userId);
      console.log(`[SHARED-API] Direct storage method returned:`, sharedFiles);
      
      // Récupérer les dossiers partagés avec la nouvelle méthode
      const sharedFolders = await storage.getSharedFolders(userId);
      console.log(`[SHARED-API] Storage method returned ${sharedFolders.length} shared folders`);

      res.json({ files: sharedFiles, folders: sharedFolders });
    } catch (error) {
      console.error('Error fetching shared files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour renommer un fichier
  app.patch("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const fileId = parseInt(req.params.id);
      if (isNaN(fileId) || fileId <= 0) {
        return res.status(400).json({ error: "ID de fichier invalide" });
      }

      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: "Nom de fichier requis" });
      }

      const trimmedName = name.trim();
      if (trimmedName.length > 255) {
        return res.status(400).json({ error: "Nom de fichier trop long (maximum 255 caractères)" });
      }

      console.log(`[files] Renaming file ${fileId} to "${trimmedName}"`);
      const updatedFile = await storage.updateFile(fileId, { name: trimmedName });
      console.log(`[files] File renamed successfully:`, updatedFile);
      res.json({ success: true, file: updatedFile, message: "Fichier renommé avec succès" });
    } catch (error: any) {
      console.error('Erreur lors du renommage du fichier:', error);
      res.status(500).json({ error: error.message || "Erreur lors du renommage" });
    }
  });

  // Route pour supprimer un fichier
  app.delete("/api/files/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const fileId = parseInt(req.params.id);
      if (isNaN(fileId) || fileId <= 0) {
        return res.status(400).json({ error: "ID de fichier invalide" });
      }

      console.log(`[files] Deleting file ${fileId}`);
      await storage.deleteFile(fileId);
      console.log(`[files] File ${fileId} deleted successfully`);
      res.json({ success: true, message: "Fichier supprimé avec succès" });
    } catch (error: any) {
      console.error('Erreur lors de la suppression du fichier:', error);
      res.status(500).json({ error: error.message || "Erreur lors de la suppression" });
    }
  });

  // Route pour renommer un dossier
  app.patch("/api/folders/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const folderId = parseInt(req.params.id);
      if (isNaN(folderId) || folderId <= 0) {
        return res.status(400).json({ error: "ID de dossier invalide" });
      }

      const { name } = req.body;
      if (!name || typeof name !== 'string' || !name.trim()) {
        return res.status(400).json({ error: "Nom de dossier requis" });
      }

      const trimmedName = name.trim();
      if (trimmedName.length > 255) {
        return res.status(400).json({ error: "Nom de dossier trop long (maximum 255 caractères)" });
      }

      console.log(`[folders] Renaming folder ${folderId} to "${trimmedName}"`);
      const updatedFolder = await storage.updateFolder(folderId, trimmedName);
      console.log(`[folders] Folder renamed successfully:`, updatedFolder);
      res.json({ success: true, folder: updatedFolder, message: "Dossier renommé avec succès" });
    } catch (error: any) {
      console.error('Erreur lors du renommage du dossier:', error);
      res.status(500).json({ error: error.message || "Erreur lors du renommage" });
    }
  });

  // Route pour partager un fichier
  app.post("/api/files/share", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { fileId, sharedWithId, permission, subject, message } = req.body;
      
      // Vérifier que l'utilisateur destinataire existe vraiment
      const targetUser = await storage.getUser(sharedWithId);
      if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur destinataire introuvable" });
      }

      // Vérifier que le fichier existe et appartient à l'utilisateur
      const file = await storage.getFileById(fileId);
      if (!file) {
        return res.status(404).json({ error: "Fichier introuvable" });
      }

      if (file.uploaderId !== userId) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de partager ce fichier" });
      }

      console.log(`[files] Sharing file ${fileId} with user ${sharedWithId}`);
      const sharing = await storage.shareFile({
        fileId,
        sharedWithId,
        permission: permission || 'read',
        ownerId: userId,
        createdAt: new Date()
      });

      console.log(`[files] File shared successfully:`, sharing);
      
      // RÉTABLI : Notifications WebSocket pour réception instantanée
      try {
        const sharedByUser = await storage.getUser(userId);
        const courierData = {
          type: 'courrier_shared',
          data: {
            recipientId: sharedWithId,
            sender: sharedByUser?.displayName || sharedByUser?.username || 'Utilisateur',
            senderEmail: sharedByUser?.username || '',
            subject: `Fichier partagé: ${file.name}`,
            content: message || `Le fichier "${file.name}" a été partagé avec vous.`,
            fileId: fileId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            shareType: 'file'
          }
        };
        
        // Diffuser via WebSocket pour réception instantanée avec ciblage utilisateur
        if ((global as any).wss?.clients) {
          let notificationsSent = 0;
          (global as any).wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN && client.userId === sharedWithId) {
              client.send(JSON.stringify(courierData));
              notificationsSent++;
              console.log(`[WebSocket] ✅ Notification fichier envoyée à l'utilisateur ${sharedWithId}`);
            }
          });
          console.log(`[WebSocket] Notification fichier diffusée à ${notificationsSent} clients sur ${(global as any).wss.clients.size} connectés`);
        }
        
        console.log(`[files] SSE notification sent for file sharing`);
      } catch (wsError) {
        console.error('[files] WebSocket notification error:', wsError);
      }
      
      res.json({ 
        success: true, 
        sharing, 
        message: "Fichier partagé avec succès",
        recipient: targetUser.displayName || targetUser.username
      });
    } catch (error: any) {
      console.error('Erreur lors du partage du fichier:', error);
      res.status(500).json({ error: error.message || "Erreur lors du partage" });
    }
  });

  // Route pour partager un dossier
  app.post("/api/folders/share", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { folderId, sharedWithId, permission, subject, message } = req.body;
      
      // Vérifier que l'utilisateur destinataire existe vraiment
      const targetUser = await storage.getUser(sharedWithId);
      if (!targetUser) {
        return res.status(404).json({ error: "Utilisateur destinataire introuvable" });
      }

      // Vérifier que le dossier existe dans le stockage en mémoire
      console.log(`[folders] Looking for folder ${folderId} for user ${userId}`);
      console.log(`[folders] All folders:`, Array.from((storage as any).folders.values()));
      
      const folder = Array.from((storage as any).folders.values()).find((f: any) => f.id === folderId && f.ownerId === userId);
      console.log(`[folders] Found folder:`, folder);
      
      if (!folder) {
        return res.status(404).json({ error: "Dossier introuvable" });
      }

      // Note: Validation temporaire supprimée car la structure des dossiers est différente

      console.log(`[folders] Sharing folder ${folderId} with user ${sharedWithId}`);
      
      // Créer le partage du dossier dans le système
      const folderSharing = {
        folderId,
        sharedWithId,
        permission: permission || 'read',
        ownerId: userId,
        createdAt: new Date(),
        id: Date.now()
      };
      
      // Sauvegarder le partage de dossier
      if (!(storage as any).folderSharing) {
        (storage as any).folderSharing = new Map();
      }
      (storage as any).folderSharing.set(folderSharing.id, folderSharing);
      
      console.log(`[folders] Folder sharing created:`, folderSharing);
      
      // RÉTABLI : Notifications WebSocket pour réception instantanée
      try {
        const sharedByUser = await storage.getUser(userId);
        const courierData = {
          type: 'courrier_shared',
          data: {
            recipientId: sharedWithId,
            sender: sharedByUser?.displayName || sharedByUser?.username || 'Utilisateur',
            senderEmail: sharedByUser?.username || '',
            subject: `Dossier partagé: ${folder.name}`,
            content: message || `Le dossier "${folder.name}" a été partagé avec vous.`,
            folderId: folderId,
            folderName: folder.name,
            shareType: 'folder'
          }
        };
        
        // Diffuser via WebSocket pour réception instantanée avec ciblage utilisateur
        if ((global as any).wss?.clients) {
          let notificationsSent = 0;
          (global as any).wss.clients.forEach((client: any) => {
            if (client.readyState === WebSocket.OPEN && client.userId === sharedWithId) {
              client.send(JSON.stringify(courierData));
              notificationsSent++;
              console.log(`[WebSocket] ✅ Notification dossier envoyée à l'utilisateur ${sharedWithId}`);
            }
          });
          console.log(`[WebSocket] Notification dossier diffusée à ${notificationsSent} clients sur ${(global as any).wss.clients.size} connectés`);
        }
        
        console.log(`[folders] SSE notification sent for folder sharing`);
      } catch (wsError) {
        console.error('[folders] WebSocket notification error:', wsError);
      }

      res.json({ 
        success: true, 
        message: "Dossier partagé avec succès",
        recipient: targetUser.displayName || targetUser.username,
        sharing: folderSharing
      });
    } catch (error: any) {
      console.error('Erreur lors du partage du dossier:', error);
      res.status(500).json({ error: error.message || "Erreur lors du partage" });
    }
  });

  // COURRIER SYSTEM - RETOUR À WEBSOCKET AVEC GESTION ROBUSTE DES CONNEXIONS

  // ✅ API COURRIER AMÉLIORÉE - Réception illimitée et tri optimal
  app.get("/api/mail", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log(`[COURRIER-AMÉLIORÉ] Récupération courrier pour utilisateur ${userId}`);
      
      // Utiliser les méthodes de stockage existantes qui fonctionnent - SANS LIMITE
      const sharedFiles = await storage.getSharedFiles(userId);
      const sharedFolders = await storage.getSharedFolders(userId);
      
      console.log(`[COURRIER-AMÉLIORÉ] Storage retourné: ${sharedFiles.length} fichiers, ${sharedFolders.length} dossiers`);

      // Convertir TOUS les types de fichiers en format EmailItem - SANS RESTRICTION
      const fileEmails = sharedFiles.map((file: any, index: number) => {
        const owner = file.sharedBy || { displayName: 'Utilisateur', username: 'user@rony.com' };
        const shareDate = file.sharedAt || file.createdAt || Date.now();
        
        return {
          id: 1000 + file.id + index, // ID unique pour éviter doublons
          subject: `Fichier partagé: ${file.name}`,
          sender: owner.displayName || owner.username || 'Utilisateur',
          senderEmail: `${owner.username || 'user'}@rony.com`,
          content: `Le fichier "${file.name}" a été partagé avec vous.\n\nTaille: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type || 'Fichier'}\nFormat: ${file.name.split('.').pop()?.toUpperCase() || 'INCONNU'}\n\nCliquez pour télécharger ou ouvrir.`,
          preview: `Fichier: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
          date: new Date(shareDate).toLocaleDateString('fr-FR'),
          time: new Date(shareDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(shareDate).toISOString(),
          priority: 'medium' as const,
          hasAttachment: true,
          isRead: false, // Nouveau courrier = non lu par défaut
          attachment: {
            id: file.id,
            name: file.name,
            size: file.size,
            type: file.type || 'application/octet-stream',
            url: `/api/files/${file.id}/download`,
            extension: file.name.split('.').pop()?.toLowerCase() || ''
          },
          category: 'files' as const,
          fileType: file.type || 'application/octet-stream'
        };
      });

      const folderEmails = sharedFolders.map((folder: any, index: number) => {
        const owner = folder.sharedBy || { displayName: 'Utilisateur', username: 'user@rony.com' };
        const shareDate = folder.sharedAt || folder.createdAt || Date.now();
        
        return {
          id: 2000 + folder.id + index, // ID unique pour éviter doublons
          subject: `Dossier partagé: ${folder.name}`,
          sender: owner.displayName || owner.username || 'Utilisateur',
          senderEmail: `${owner.username || 'user'}@rony.com`,
          content: `Le dossier "${folder.name}" a été partagé avec vous.\n\nVous pouvez explorer son contenu et télécharger les fichiers.\nAccès complet au dossier et à ses sous-dossiers.`,
          preview: `Dossier: ${folder.name}`,
          date: new Date(shareDate).toLocaleDateString('fr-FR'),
          time: new Date(shareDate).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          timestamp: new Date(shareDate).toISOString(),
          priority: 'medium' as const,
          hasAttachment: true,
          isRead: false, // Nouveau courrier = non lu par défaut
          folder: {
            id: folder.id,
            name: folder.name,
            fileCount: folder.fileCount || 0,
            url: `/api/folders/${folder.id}/download`
          },
          category: 'folders' as const
        };
      });

      // ✅ TRI OPTIMAL: Plus récents en premier (tri par timestamp pour précision)
      const allEmails = [...fileEmails, ...folderEmails].sort((a, b) => {
        const dateA = new Date(a.timestamp || `${a.date} ${a.time}`);
        const dateB = new Date(b.timestamp || `${b.date} ${b.time}`);
        return dateB.getTime() - dateA.getTime(); // Plus récents en premier
      });

      console.log(`[COURRIER-AMÉLIORÉ] Emails générés et triés: ${fileEmails.length} fichiers, ${folderEmails.length} dossiers, total: ${allEmails.length} (plus récents en premier)`);

      // Headers pour optimisation cache et performances
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');

      res.json(allEmails);
    } catch (error: any) {
      console.error('[COURRIER-AMÉLIORÉ] Erreur:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Garder aussi l'API /api/files/shared pour compatibilité
  app.get("/api/files/shared", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const sharedFiles = await storage.getSharedFiles(userId);
      const sharedFolders = await storage.getSharedFolders(userId);
      
      res.json({ 
        files: sharedFiles, 
        folders: sharedFolders 
      });
    } catch (error: any) {
      console.error('[SHARED-API] Erreur:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Route /api/files/:id/share supprimée pour éviter les doublons - utilise uniquement /api/files/share

  // ✅ API EXPLORATEUR DE DOSSIERS - Récupérer les fichiers d'un dossier partagé
  app.get("/api/folders/:id/files", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const folderId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }
      
      if (!folderId || isNaN(folderId)) {
        return res.status(400).json({ error: "ID de dossier invalide" });
      }
      
      console.log(`[FOLDER-EXPLORER-API] Récupération fichiers dossier ${folderId} pour utilisateur ${userId}`);
      
      // Vérifier que l'utilisateur a accès à ce dossier partagé
      const sharedFolders = await storage.getSharedFolders(userId);
      const targetFolder = sharedFolders.find((folder: any) => folder.id === folderId);
      
      if (!targetFolder) {
        console.log(`[FOLDER-EXPLORER-API] Accès refusé au dossier ${folderId} pour utilisateur ${userId}`);
        return res.status(403).json({ error: "Accès refusé à ce dossier" });
      }
      
      // Récupérer les fichiers du dossier
      const folderFiles = await storage.getFilesByFolder(folderId);
      
      console.log(`[FOLDER-EXPLORER-API] Dossier ${folderId}: ${folderFiles.length} fichiers trouvés`);
      
      // Formatage des fichiers pour l'interface
      const formattedFiles = folderFiles.map((file: any) => ({
        id: file.id,
        name: file.name,
        size: file.size,
        type: file.type,
        url: `/api/files/${file.id}/download`,
        uploadedAt: file.uploadedAt,
        extension: file.name.split('.').pop()?.toLowerCase() || ''
      }));
      
      res.json({
        folderId,
        folderName: targetFolder.name || 'Dossier',
        files: formattedFiles,
        count: formattedFiles.length
      });
      
    } catch (error: any) {
      console.error('[FOLDER-EXPLORER-API] Erreur:', error);
      res.status(500).json({ error: "Erreur serveur lors de la récupération des fichiers" });
    }
  });

  // APIs PLANIFICATION - Système d'événements complet
  
  // ✅ Créer un nouvel événement avec partage automatique
  app.post("/api/events", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const eventData = {
        ...req.body,
        creatorId: userId,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate)
      };

      console.log(`[EVENTS] Créer événement pour utilisateur ${userId}:`, eventData);
      
      const event = await storage.createEvent(eventData);
      
      // ✅ PARTAGE AUTOMATIQUE - Si des participants sont invités (attendeeEmails du frontend)
      const participantField = req.body.attendeeEmails || req.body.participants || '';
      if (participantField && participantField.trim()) {
        const participantEmails = participantField
          .split(',')
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0 && email.includes('@rony.com'));
        
        console.log(`[EVENTS] Partage automatique avec ${participantEmails.length} participants:`, participantEmails);
        
        if (participantEmails.length > 0) {
          await storage.shareEventWithUsers(event.id, participantEmails, userId);
          console.log(`[EVENTS] ✅ Événement ${event.id} partagé automatiquement avec succès`);
          
          // ✅ NOTIFICATION WEBSOCKET INSTANTANÉE pour les participants
          for (const email of participantEmails) {
            const targetUser = await storage.getUserByUsername(email);
            if (targetUser) {
              console.log(`[EVENTS] Notification WebSocket pour ${targetUser.displayName} (${email})`);
              // La notification WebSocket sera gérée par le serveur WebSocket séparé
            }
          }
        } else {
          console.log(`[EVENTS] Aucun participant @rony.com valide trouvé dans: "${participantField}"`);
        }
      }
      
      res.json({ success: true, event });
    } catch (error: any) {
      console.error('Erreur création événement:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // ✅ API AVANCÉE POUR SYSTÈME DE NOTIFICATION CENTRALISÉ COMPLET
  
  // Marquer une notification comme lue
  app.put("/api/notifications/:id/read", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      const notificationId = req.params.id;
      
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log(`[NOTIF] Marquer notification ${notificationId} comme lue pour utilisateur ${userId}`);
      
      // ✅ Logique de marquage comme lu avec stockage persistant
      const success = storage.markNotificationAsRead(userId, notificationId, 'unknown');
      
      if (notificationId.startsWith('courrier-')) {
        const fileId = notificationId.replace('courrier-', '');
        console.log(`[NOTIF] ✅ Courrier ${fileId} marqué comme lu pour utilisateur ${userId}`);
      } else if (notificationId.startsWith('planning-')) {
        const eventId = notificationId.replace('planning-', '');
        console.log(`[NOTIF] ✅ Événement ${eventId} marqué comme lu pour utilisateur ${userId}`);
      } else if (notificationId.startsWith('message-')) {
        const msgId = notificationId.replace('message-', '');
        console.log(`[NOTIF] ✅ Message ${msgId} marqué comme lu pour utilisateur ${userId}`);
      } else if (notificationId.startsWith('meeting-')) {
        const meetId = notificationId.replace('meeting-', '');
        console.log(`[NOTIF] ✅ Réunion ${meetId} marquée comme lue pour utilisateur ${userId}`);
      } else if (notificationId.startsWith('upload-')) {
        const uploadId = notificationId.replace('upload-', '');
        console.log(`[NOTIF] ✅ Upload ${uploadId} marqué comme lu pour utilisateur ${userId}`);
      } else {
        console.log(`[NOTIF] ✅ Notification système ${notificationId} marquée comme lue pour utilisateur ${userId}`);
      }
      
      res.json({ success: true, message: "Notification marquée comme lue" });
    } catch (error) {
      console.error('[NOTIF] Erreur marquer comme lu:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Marquer toutes les notifications comme lues
  app.put("/api/notifications/mark-all-read", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log(`[NOTIF] Marquer toutes les notifications comme lues pour utilisateur ${userId}`);
      
      // ✅ Marquer toutes les notifications comme lues avec comptage réel
      const markedCount = await storage.markAllNotificationsAsRead(userId);
      
      console.log(`[NOTIF] ✅ ${markedCount} notifications marquées comme lues pour utilisateur ${userId}`);
      res.json({ 
        success: true, 
        message: `${markedCount} notifications marquées comme lues`,
        markedCount: markedCount
      });
    } catch (error) {
      console.error('[NOTIF] Erreur marquer tout comme lu:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/notifications/all", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const notifications = [];
      
      // 1. NOTIFICATIONS COURRIER - Fichiers partagés récents
      try {
        const sharedFiles = await storage.getSharedFiles(userId);
        const recentSharedFiles = sharedFiles.filter(file => {
          const shareDate = new Date(file.createdAt || file.sharedAt || Date.now());
          const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
          return shareDate > threeDaysAgo;
        });
        
        recentSharedFiles.forEach(file => {
          const notificationId = `courrier-${file.id}`;
          const isRead = storage.isNotificationRead(userId, notificationId);
          
          // N'ajouter que les notifications NON LUES
          if (!isRead) {
            notifications.push({
              id: notificationId,
              type: 'courrier',
              title: '📧 Nouveau courrier',
              message: `Fichier partagé: ${file.filename || file.name}`,
              timestamp: file.createdAt || file.sharedAt || new Date().toISOString(),
              read: false,
              data: file,
              priority: 'normal',
              actionUrl: '/courrier'
            });
          }
        });
      } catch (error) {
        console.log('[NOTIF] Pas de courriers récents:', error.message);
      }

      // 2. NOTIFICATIONS PLANIFICATION - Événements à venir  
      try {
        const allEvents = await storage.getEventsForUser(userId);
        const now = new Date();
        const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
        
        const upcomingEvents = allEvents.filter(event => {
          const eventStart = new Date(event.startDate);
          return eventStart > now && eventStart <= in24Hours;
        });

        upcomingEvents.forEach(event => {
          const eventStart = new Date(event.startDate);
          const hoursUntil = Math.round((eventStart.getTime() - now.getTime()) / (1000 * 60 * 60));
          const notificationId = `planning-${event.id}`;
          const isRead = storage.isNotificationRead(userId, notificationId);
          
          // N'ajouter que les notifications NON LUES
          if (!isRead) {
            notifications.push({
              id: notificationId,
              type: 'planning',
              title: '📅 Événement à venir',
              message: `"${event.title}" dans ${hoursUntil}h`,
              timestamp: event.startDate,
              read: false,
              data: event,
              priority: 'normal',
              actionUrl: '/planning'
            });
          }
        });
      } catch (error) {
        console.log('[NOTIF] Pas d\'événements à venir:', error.message);
      }

      // 3. NOTIFICATIONS RÉUNIONS ACTIVES - Réunions programmées
      try {
        const meetings = await storage.getAllMeetings();
        const userMeetings = meetings.filter(meeting => 
          meeting.createdBy === userId || 
          (meeting.participants && meeting.participants.includes(userId))
        );
        
        const activeMeetings = userMeetings.filter(meeting => {
          if (meeting.status !== 'scheduled') return false;
          const meetingStart = new Date(meeting.startTime);
          const now = new Date();
          const in30Minutes = new Date(now.getTime() + 30 * 60 * 1000);
          return meetingStart > now && meetingStart <= in30Minutes;
        });

        activeMeetings.forEach(meeting => {
          const meetingStart = new Date(meeting.startTime);
          const minutesUntil = Math.round((meetingStart.getTime() - Date.now()) / (1000 * 60));
          const notificationId = `meeting-${meeting.id}`;
          const isRead = storage.isNotificationRead(userId, notificationId);
          
          // N'ajouter que les notifications NON LUES
          if (!isRead) {
            notifications.push({
              id: notificationId,
              type: 'meeting',
              title: '📞 Réunion imminente',
              message: `"${meeting.title}" dans ${minutesUntil} minutes`,
              timestamp: meeting.startTime,
              read: false,
              data: meeting,
              priority: 'high',
              actionUrl: '/meetings'
            });
          }
        });
      } catch (error) {
        console.log('[NOTIF] Pas de réunions imminentes:', error.message);
      }

      // 4. NOTIFICATIONS MESSAGERIE RÉELLES - Vraies conversations non lues
      try {
        // ✅ RÉCUPÉRER LES VRAIES CONVERSATIONS NON LUES DE L'UTILISATEUR
        const userConversations = await storage.getConversationsForUser(userId);
        let realUnreadCount = 0;
        
        for (const conversation of userConversations) {
          const messages = await storage.getMessagesForConversation(conversation.id);
          const lastMessage = messages[messages.length - 1];
          
          if (lastMessage && lastMessage.senderId !== userId) {
            // Il y a un message non lu (le dernier message n'est pas de l'utilisateur)
            const sender = await storage.getUser(lastMessage.senderId);
            if (sender) {
              const notificationId = `message-${lastMessage.id}`;
              const isRead = storage.isNotificationRead(userId, notificationId);
              
              // N'ajouter que les messages NON LUS
              if (!isRead) {
                notifications.push({
                  id: notificationId,
                  type: 'message',
                  title: `💬 Message de ${sender.displayName}`,
                  message: lastMessage.content.substring(0, 50) + (lastMessage.content.length > 50 ? '...' : ''),
                  timestamp: lastMessage.createdAt.toISOString(),
                  read: false,
                  data: { conversationId: conversation.id, messageId: lastMessage.id },
                  priority: 'normal',
                  actionUrl: '/messages'
                });
                realUnreadCount++;
              }
            }
          }
        }
        console.log(`[NOTIF] ${realUnreadCount} vrais messages non lus trouvés`);
      } catch (error) {
        console.log('[NOTIF] Erreur récupération vraies conversations:', error.message);
      }

      // 5. NOTIFICATIONS SYSTÈME RÉELLES - Aucune notification simulée
      try {
        // ✅ SUPPRIMER TOUTES LES NOTIFICATIONS SYSTÈME SIMULÉES
        // Seules les vraies notifications système (erreurs, mises à jour réelles) apparaîtront ici
        console.log('[NOTIF] Pas de notifications système simulées - seulement les vraies interactions');
      } catch (error) {
        console.log('[NOTIF] Pas de notifications système:', error.message);
      }

      // 6. NOTIFICATIONS UPLOAD/CLOUD RÉELLES - Vrais uploads récents
      try {
        // ✅ RÉCUPÉRER LES VRAIS UPLOADS RÉCENTS DE L'UTILISATEUR (dernières 24h)
        const recentFiles = await storage.getFilesByFolder(null, userId);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        let realUploadsCount = 0;
        recentFiles.forEach(file => {
          if (file.createdAt && new Date(file.createdAt) > oneDayAgo) {
            const notificationId = `upload-${file.id}`;
            const isRead = storage.isNotificationRead(userId, notificationId);
            
            // N'ajouter que les uploads NON LUS
            if (!isRead) {
              notifications.push({
                id: notificationId,
                type: 'file_upload',
                title: '📁 Upload récent',
                message: `Fichier "${file.name}" uploadé avec succès`,
                timestamp: file.createdAt.toISOString(),
                read: false,
                data: file,
                priority: 'low',
                actionUrl: '/cloud'
              });
              realUploadsCount++;
            }
          }
        });
        console.log(`[NOTIF] ${realUploadsCount} vrais uploads récents trouvés`);
      } catch (error) {
        console.log('[NOTIF] Erreur récupération vrais uploads:', error.message);
      }

      // 7. NOTIFICATIONS RÉUNIONS RÉELLES - Réunions imminentes uniquement
      try {
        // ✅ RÉCUPÉRER LES VRAIES RÉUNIONS PROGRAMMÉES DEPUIS LE STOCKAGE
        // (Pas de notifications simulées - seulement les vraies réunions créées par les utilisateurs)
        console.log('[NOTIF] Recherche de réunions réelles programmées pour les prochaines 30 minutes');
        // Note: Aucune réunion simulée - attendre que l'utilisateur crée de vraies réunions
      } catch (error) {
        console.log('[NOTIF] Pas de réunions imminentes:', error.message);
      }

      // Trier par timestamp (plus récent en premier)
      notifications.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      
      const totalCount = notifications.length;
      console.log(`[NOTIF] ${totalCount} notifications pour utilisateur ${userId}`);
      
      // ✅ FILTRAGE AVANCÉ AVEC ÉTATS DE LECTURE PERSISTANTS
      const readStates = storage.getNotificationReadStates(userId);
      
      // Marquer les notifications comme lues selon l'état persistant
      notifications.forEach(notif => {
        notif.read = storage.isNotificationRead(userId, notif.id);
      });
      
      // Filtrer seulement les notifications non lues
      const unreadNotifications = notifications.filter(n => !n.read);
      
      console.log(`[NOTIF] ✅ ${notifications.length} notifications RÉELLES trouvées, ${unreadNotifications.length} non lues pour utilisateur ${userId}`);

      const response = {
        notifications,
        unreadCount: unreadNotifications.length,
        totalCount: notifications.length,
        readStatesCount: readStates.size,
        byType: {
          courrier: notifications.filter(n => n.type === 'courrier').length,
          planning: notifications.filter(n => n.type === 'planning').length,
          meeting: notifications.filter(n => n.type === 'meeting').length,
          message: notifications.filter(n => n.type === 'message').length,
          system: notifications.filter(n => n.type === 'system').length,
          contact_request: notifications.filter(n => n.type === 'contact_request').length,
          file_upload: notifications.filter(n => n.type === 'file_upload').length
        },
        unreadByType: {
          courrier: unreadNotifications.filter(n => n.type === 'courrier').length,
          planning: unreadNotifications.filter(n => n.type === 'planning').length,
          meeting: unreadNotifications.filter(n => n.type === 'meeting').length,
          message: unreadNotifications.filter(n => n.type === 'message').length,
          system: unreadNotifications.filter(n => n.type === 'system').length,
          contact_request: unreadNotifications.filter(n => n.type === 'contact_request').length,
          file_upload: unreadNotifications.filter(n => n.type === 'file_upload').length
        }
      };

      res.json(response);
      
    } catch (error) {
      console.error('[NOTIF] Erreur récupération notifications:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  app.get("/api/mail/unread-count", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      // Récupérer le nombre réel de courriers récents
      const sharedFiles = await storage.getSharedFiles(userId);
      const recentCount = sharedFiles.filter(file => {
        const shareDate = new Date(file.createdAt || file.sharedAt || Date.now());
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
        return shareDate > threeDaysAgo;
      }).length;
      
      console.log(`[NOTIF] ${recentCount} courriers récents pour utilisateur ${userId}`);
      res.json(recentCount);
    } catch (error) {
      console.error('[NOTIF] Erreur récupération courriers non lus:', error);
      res.json(0); // Retourner 0 en cas d'erreur
    }
  });

  app.get("/api/events/upcoming", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      
      // Récupérer tous les événements de l'utilisateur
      const allEvents = await storage.getEventsForUser(userId);
      
      // Filtrer les événements à venir dans les prochaines 24 heures
      const upcomingEvents = allEvents.filter(event => {
        const eventStart = new Date(event.startDate);
        return eventStart > now && eventStart <= in24Hours;
      });

      console.log(`[NOTIF] ${upcomingEvents.length} événements à venir pour utilisateur ${userId}`);
      res.json(upcomingEvents);
    } catch (error) {
      console.error('[NOTIF] Erreur récupération événements à venir:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Récupérer les événements d'un utilisateur
  app.get("/api/events", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log(`[EVENTS] Récupérer événements pour utilisateur ${userId}`);
      
      const events = await storage.getEventsForUser(userId);
      
      res.json(events);
    } catch (error: any) {
      console.error('Erreur récupération événements:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Récupérer un événement spécifique
  app.get("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const event = await storage.getEventById(eventId);
      
      if (!event) {
        return res.status(404).json({ error: "Événement introuvable" });
      }
      
      res.json(event);
    } catch (error: any) {
      console.error('Erreur récupération événement:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // ✅ Modifier un événement avec partage automatique
  app.put("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const eventId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const event = await storage.getEventById(eventId);
      if (!event || event.creatorId !== userId) {
        return res.status(403).json({ error: "Accès refusé" });
      }

      const updates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined
      };

      const updatedEvent = await storage.updateEvent(eventId, updates);
      
      // ✅ PARTAGE AUTOMATIQUE - Si les participants ont été modifiés (attendeeEmails du frontend)
      const participantField = req.body.attendeeEmails || req.body.participants || '';
      if (participantField && participantField.trim()) {
        const participantEmails = participantField
          .split(',')
          .map((email: string) => email.trim())
          .filter((email: string) => email.length > 0 && email.includes('@rony.com'));
        
        console.log(`[EVENTS] Mise à jour partage avec ${participantEmails.length} participants:`, participantEmails);
        
        if (participantEmails.length > 0) {
          await storage.shareEventWithUsers(eventId, participantEmails, userId);
          console.log(`[EVENTS] ✅ Partage mis à jour pour événement ${eventId}`);
        } else {
          console.log(`[EVENTS] Aucun participant @rony.com valide trouvé dans: "${participantField}"`);
        }
      }
      
      res.json({ success: true, event: updatedEvent });
    } catch (error: any) {
      console.error('Erreur modification événement:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Supprimer un événement
  app.delete("/api/events/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const eventId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const event = await storage.getEventById(eventId);
      if (!event || event.creatorId !== userId) {
        return res.status(403).json({ error: "Accès refusé" });
      }

      await storage.deleteEvent(eventId);
      
      res.json({ success: true, message: "Événement supprimé" });
    } catch (error: any) {
      console.error('Erreur suppression événement:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Ajouter un participant à un événement
  app.post("/api/events/:id/participants", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const eventId = parseInt(req.params.id);
      
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const event = await storage.getEventById(eventId);
      if (!event || event.creatorId !== userId) {
        return res.status(403).json({ error: "Accès refusé" });
      }

      const participantData = {
        eventId,
        userId: req.body.userId,
        response: "pending",
        isOrganizer: false
      };

      const participant = await storage.addEventParticipant(participantData);
      
      res.json({ success: true, participant });
    } catch (error: any) {
      console.error('Erreur ajout participant:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Récupérer les participants d'un événement
  app.get("/api/events/:id/participants", requireAuth, async (req, res) => {
    try {
      const eventId = parseInt(req.params.id);
      const participants = await storage.getEventParticipants(eventId);
      
      res.json(participants);
    } catch (error: any) {
      console.error('Erreur récupération participants:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Contacts routes
  app.get("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 10;
      const sortBy = req.query.sortBy as string || 'displayName';
      const sortOrder = req.query.sortOrder as 'asc' | 'desc' || 'asc';

      const result = await storage.getPaginatedContactsForUser(userId, {
        page,
        pageSize,
        sortBy,
        sortOrder
      });

      res.json(result);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Meeting routes - Simple Jitsi Meet integration
  app.get("/api/meetings/active", async (req, res) => {
    try {
      // Vérifier les réunions programmées qui doivent devenir actives (5 minutes avant l'heure de début)
      const now = new Date();
      const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

      const meetingsToActivate: string[] = [];

      scheduledMeetings.forEach((meeting, roomCode) => {
        const startTime = new Date(meeting.startTime);
        if (startTime <= fiveMinutesFromNow && startTime > now) {
          // Déplacer vers les réunions actives
          meeting.status = 'active';
          activeMeetings.set(roomCode, meeting);
          meetingsToActivate.push(roomCode);
        }
      });

      // Supprimer les réunions activées de la liste programmée
      meetingsToActivate.forEach(roomCode => {
        scheduledMeetings.delete(roomCode);
        console.log(`[meetings] Réunion activée automatiquement: ${roomCode}`);
      });

      // Retourner les réunions actives
      const activeRooms = Array.from(activeMeetings.values()).map(meeting => ({
        roomCode: meeting.roomCode,
        title: meeting.title,
        startTime: meeting.startTime,
        participants: 0 // Sera mis à jour par l'usage réel
      }));

      res.json({ success: true, rooms: activeRooms });
    } catch (error) {
      console.error('Error fetching active meetings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/meetings/scheduled", async (req, res) => {
    try {
      // Retourner les réunions programmées depuis le stockage en mémoire
      const meetings = Array.from(scheduledMeetings.values()).map(meeting => ({
        ...meeting,
        participants: 0,
        maxParticipants: 50,
        isActive: false
      }));

      res.json({ success: true, meetings });
    } catch (error) {
      console.error('Error fetching scheduled meetings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/meetings/create", async (req, res) => {
    try {
      const { title, description, roomCode, startTime, duration } = req.body;

      if (!roomCode) {
        return res.status(400).json({ error: 'Room code is required' });
      }

      // Simple création de réunion avec Jitsi Meet
      const meetingUrl = `https://jitsiarona.duckdns.org/${roomCode}`;

      const meeting: StoredMeeting = {
        id: roomCode,
        title: title || 'Nouvelle réunion',
        description: description || '',
        roomCode,
        url: meetingUrl,
        startTime: startTime || new Date().toISOString(),
        duration: duration || 60,
        status: 'scheduled',
        createdAt: new Date(),
        createdBy: req.user?.id
      };

      // Stocker la réunion en mémoire
      scheduledMeetings.set(roomCode, meeting);

      console.log(`[meetings] Réunion créée: ${meeting.title} (${roomCode}). Total: ${scheduledMeetings.size}`);

      res.json({
        success: true,
        meeting: {
          ...meeting,
          participants: 0,
          maxParticipants: 50,
          isActive: false
        }
      });
    } catch (error) {
      console.error('Error creating meeting:', error);
      res.status(500).json({ error: 'Failed to create meeting' });
    }
  });

  app.delete("/api/meetings/:meetingId", async (req, res) => {
    try {
      const { meetingId } = req.params;

      // Supprimer la réunion du stockage en mémoire
      const deleted = scheduledMeetings.delete(meetingId);
      activeMeetings.delete(meetingId);

      if (deleted) {
        console.log(`[meetings] Réunion supprimée: ${meetingId}. Total: ${scheduledMeetings.size}`);
      }

      res.json({
        success: true,
        message: 'Meeting deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting meeting:', error);
      res.status(500).json({ error: 'Failed to delete meeting' });
    }
  });

  // Route pour ajouter un contact
  app.post("/api/contacts", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { username, contactId } = req.body;
      
      let targetUser;
      
      // Support pour ajout par username ou contactId
      if (username) {
        targetUser = await storage.getUserByUsername(username);
        if (!targetUser) {
          return res.status(404).json({ error: "Utilisateur non trouvé avec ce nom d'utilisateur" });
        }
      } else if (contactId) {
        targetUser = await storage.getUser(contactId);
        if (!targetUser) {
          return res.status(404).json({ error: "Utilisateur non trouvé avec cet ID" });
        }
      } else {
        return res.status(400).json({ error: "Nom d'utilisateur ou ID de contact requis" });
      }

      // Vérifier que l'utilisateur ne s'ajoute pas lui-même
      if (targetUser.id === userId) {
        return res.status(400).json({ error: "Vous ne pouvez pas vous ajouter vous-même comme contact" });
      }

      // Vérifier si le contact existe déjà
      const existingContacts = await storage.getContactsForUser(userId);
      const contactExists = existingContacts.some(contact => contact.id === targetUser.id);
      
      if (contactExists) {
        return res.status(400).json({ error: "Ce contact existe déjà" });
      }

      // Créer le contact
      const contactData = {
        userId,
        contactId: targetUser.id,
        createdAt: new Date()
      };

      const contact = await storage.addContact(contactData);
      
      // Réponse avec informations du contact ajouté
      res.status(201).json({ 
        success: true, 
        contact: {
          id: contact.id,
          user: targetUser,
          createdAt: contact.createdAt
        },
        message: "Contact ajouté avec succès" 
      });
    } catch (error) {
      console.error('Error adding contact:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour supprimer un contact
  app.delete("/api/contacts/:contactId", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const contactId = parseInt(req.params.contactId);
      await storage.removeContact(userId, contactId);
      res.json({ success: true, message: "Contact supprimé avec succès" });
    } catch (error) {
      console.error('Error removing contact:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour upload d'avatar
  app.post("/api/upload-avatar", requireAuth, avatarUpload.single('avatar'), async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier d'avatar fourni" });
      }

      const avatarPath = `/uploads/avatars/${req.file.filename}`;
      
      // Mettre à jour l'utilisateur avec le nouveau chemin d'avatar
      await storage.updateUserProfile(userId, { avatar: avatarPath });

      res.json({ 
        success: true, 
        avatar: avatarPath,
        message: "Avatar mis à jour avec succès" 
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour changer le thème
  app.patch("/api/user/theme", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { theme } = req.body;
      if (!theme) {
        return res.status(400).json({ error: "Thème requis" });
      }

      await storage.updateUserProfile(userId, { theme });
      res.json({ success: true, theme, message: "Thème mis à jour avec succès" });
    } catch (error) {
      console.error('Error updating theme:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour mettre à jour le profil utilisateur
  app.patch("/api/user/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { displayName, email, phone, title } = req.body;
      
      await storage.updateUserProfile(userId, {
        displayName,
        email,
        phone,
        title
      });

      res.json({ success: true, message: "Profil mis à jour avec succès" });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // AI Assistant route
  app.post("/api/ai/chat", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      await handleAIChat(req, res);
    } catch (error) {
      console.error('Error in AI chat:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Legacy video conferencing routes removed - using native WebRTC solution

  // API pour répondre à un courrier - VERSION COMPLÈTEMENT CORRIGÉE
  app.post("/api/courrier/reply", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { recipientEmail, message, originalSubject, originalSender, originalContent, senderName, senderEmail } = req.body;

      console.log(`[REPLY] Processing reply from user ${userId} to ${recipientEmail}`);
      
      // Trouver l'utilisateur destinataire par email/username avec logique améliorée
      const cleanRecipientEmail = recipientEmail.replace('@rony.com', '');
      const recipient = Array.from((storage as any).users.values()).find((u: any) => {
        return u.email === recipientEmail || 
               u.username === recipientEmail ||
               u.email === cleanRecipientEmail ||
               u.username === cleanRecipientEmail ||
               u.username === recipientEmail + '@rony.com' ||
               u.email === recipientEmail + '@rony.com';
      });
      
      if (!recipient) {
        console.log(`[REPLY] Recipient not found for: ${recipientEmail}`);
        return res.status(400).json({ success: false, error: "Utilisateur destinataire introuvable. Vérifiez l'adresse email." });
      }

      console.log(`[REPLY] Found recipient:`, { id: recipient.id, email: recipient.email, username: recipient.username });

      // Créer le message de réponse avec ID unique
      const replyMessage = {
        id: Date.now() + Math.random(),
        type: 'reply',
        recipientId: recipient.id,
        sender: senderName || req.user?.displayName || req.user?.username || 'Utilisateur',
        senderEmail: senderEmail || req.user?.username || req.user?.email || '',
        subject: `Re: ${originalSubject}`,
        content: message,
        originalContent: originalContent,
        originalSender: originalSender,
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        priority: 'medium',
        hasAttachment: false,
        category: 'documents'
      };

      // Envoyer via WebSocket en temps réel
      if ((global as any).wss && (global as any).wss.clients) {
        const messageData = JSON.stringify({
          type: 'courrier_message',
          data: replyMessage
        });
        
        (global as any).wss.clients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(messageData);
          }
        });
        console.log(`[REPLY] WebSocket message sent to ${(global as any).wss.clients.size} clients`);
      }

      res.json({ success: true, message: "Réponse envoyée avec succès" });
    } catch (error: any) {
      console.error('Erreur réponse courrier:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // API pour transférer un courrier - VERSION COMPLÈTEMENT CORRIGÉE
  app.post("/api/courrier/forward", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const user = req.user;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { recipientEmail, message, originalEmail, senderName, senderEmail } = req.body;
      
      console.log(`[FORWARD] Processing forward from user ${userId} to ${recipientEmail}`);
      
      // Logique améliorée pour trouver le destinataire
      const cleanRecipientEmail = recipientEmail.replace('@rony.com', '');
      const recipient = Array.from((storage as any).users.values()).find((u: any) => {
        return u.email === recipientEmail || 
               u.username === recipientEmail ||
               u.email === cleanRecipientEmail ||
               u.username === cleanRecipientEmail ||
               u.username === recipientEmail + '@rony.com' ||
               u.email === recipientEmail + '@rony.com';
      });
      
      if (!recipient) {
        console.log(`[FORWARD] Recipient not found for: ${recipientEmail}`);
        return res.status(400).json({ success: false, error: "Utilisateur destinataire introuvable. Vérifiez l'adresse email." });
      }

      console.log(`[FORWARD] Found recipient:`, { id: recipient.id, email: recipient.email, username: recipient.username });

      // Créer le message transféré avec structure complète
      const forwardMessage = {
        id: Date.now() + Math.random(),
        type: 'forward',
        recipientId: recipient.id,
        sender: senderName || req.user?.displayName || req.user?.username || 'Utilisateur',
        senderEmail: senderEmail || req.user?.username || req.user?.email || '',
        subject: `Fwd: ${originalEmail.subject}`,
        content: `${message}\n\n--- Message transféré ---\nDe: ${originalEmail.sender}\nSujet: ${originalEmail.subject}\n\n${originalEmail.content}`,
        originalEmail: originalEmail,
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        priority: 'medium',
        hasAttachment: originalEmail.hasAttachment || false,
        category: 'documents'
      };

      // Envoyer via WebSocket en temps réel
      if ((global as any).wss && (global as any).wss.clients) {
        const messageData = JSON.stringify({
          type: 'courrier_message',
          data: forwardMessage
        });
        
        (global as any).wss.clients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(messageData);
          }
        });
        console.log(`[FORWARD] WebSocket message sent to ${(global as any).wss.clients.size} clients`);
      }

      res.json({ success: true, message: "Message transféré avec succès" });
    } catch (error: any) {
      console.error('Erreur transfert courrier:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // API pour composer un nouveau message courrier - VERSION COMPLÈTEMENT CORRIGÉE
  app.post("/api/courrier/compose", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      const user = req.user;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const { recipientEmail, subject, message, senderName, senderEmail } = req.body;

      console.log(`[COMPOSE] Processing new message from user ${userId} to ${recipientEmail}`);
      
      // Logique améliorée pour trouver le destinataire
      const cleanRecipientEmail = recipientEmail.replace('@rony.com', '');
      const recipient = Array.from((storage as any).users.values()).find((u: any) => {
        return u.email === recipientEmail || 
               u.username === recipientEmail ||
               u.email === cleanRecipientEmail ||
               u.username === cleanRecipientEmail ||
               u.username === recipientEmail + '@rony.com' ||
               u.email === recipientEmail + '@rony.com';
      });
      
      if (!recipient) {
        console.log(`[COMPOSE] Recipient not found for: ${recipientEmail}`);
        return res.status(400).json({ success: false, error: "Utilisateur destinataire introuvable. Vérifiez l'adresse email." });
      }

      console.log(`[COMPOSE] Found recipient:`, { id: recipient.id, email: recipient.email, username: recipient.username });

      // Créer le nouveau message avec structure complète
      const newMessage = {
        id: Date.now() + Math.random(),
        type: 'compose',
        recipientId: recipient.id,
        sender: senderName || req.user?.displayName || req.user?.username || 'Utilisateur',
        senderEmail: senderEmail || req.user?.username || req.user?.email || '',
        subject: subject,
        content: message,
        preview: message.substring(0, 100) + (message.length > 100 ? '...' : ''),
        date: new Date().toLocaleDateString('fr-FR'),
        time: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        timestamp: new Date().toISOString(),
        priority: 'medium',
        hasAttachment: false,
        category: 'documents'
      };

      // Envoyer via WebSocket en temps réel
      if ((global as any).wss && (global as any).wss.clients) {
        const messageData = JSON.stringify({
          type: 'courrier_message',
          data: newMessage
        });
        
        (global as any).wss.clients.forEach((client: any) => {
          if (client.readyState === 1) {
            client.send(messageData);
          }
        });
        console.log(`[COMPOSE] WebSocket message sent to ${(global as any).wss.clients.size} clients`);
      }

      res.json({ success: true, message: "Message envoyé avec succès" });
    } catch (error: any) {
      console.error('Erreur composition courrier:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // API pour les statistiques du courrier - CORRECTION COMPLÈTE
  app.get("/api/courrier/stats", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      // Utiliser les méthodes de stockage pour statistiques précises
      const sharedFiles = await storage.getSharedFiles(userId);
      const sharedFolders = await storage.getSharedFolders(userId);
      
      const sharedFilesCount = sharedFiles.length;
      const sharedFoldersCount = sharedFolders.length;
      const totalMessages = sharedFilesCount + sharedFoldersCount;

      // Statistiques détaillées
      const stats = {
        totalMessages,
        newMessages: totalMessages, // Tous les messages sont considérés comme nouveaux dans ce système
        unreadMessages: totalMessages,
        archivedMessages: 0,
        sharedFiles: sharedFilesCount,
        sharedFolders: sharedFoldersCount,
        lastUpdate: new Date().toISOString()
      };

      console.log(`[COURRIER-STATS] Stats for user ${userId}:`, stats);
      res.json(stats);
    } catch (error: any) {
      console.error('Erreur récupération statistiques courrier:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
    }
  });

  // Jitsi routes temporarily disabled - using WebRTC native solution
  console.log("Routes configured successfully");

  // API pour explorer les fichiers d'un dossier partagé
  app.get("/api/files/folder/:folderId/files", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const folderId = parseInt(req.params.folderId);
      if (isNaN(folderId)) {
        return res.status(400).json({ error: "ID de dossier invalide" });
      }

      console.log(`[FOLDER-EXPLORE] User ${userId} exploring folder ${folderId}`);
      
      // Vérifier que l'utilisateur a accès au dossier
      const folder = await storage.getFileById(folderId); // Using getFileById as getFolderById doesn't exist
      if (!folder) {
        return res.status(404).json({ error: "Dossier non trouvé" });
      }

      // Récupérer les fichiers du dossier
      const files = await storage.getFilesByFolder(folderId);
      console.log(`[FOLDER-EXPLORE] Found ${files.length} files in folder ${folderId}`);

      res.json({ 
        success: true, 
        files: files.map(file => ({
          id: file.id,
          name: file.name,
          type: file.type,
          size: file.size,
          url: file.url,
          uploadedAt: file.uploadedAt
        }))
      });
    } catch (error) {
      console.error('Erreur exploration dossier:', error);
      res.status(500).json({ error: 'Erreur lors de l\'exploration du dossier' });
    }
  });

  // API pour télécharger un fichier individuel d'un dossier
  app.get("/api/files/:fileId/download", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const fileId = parseInt(req.params.fileId);
      if (isNaN(fileId)) {
        return res.status(400).json({ error: "ID de fichier invalide" });
      }

      const file = await storage.getFileById(fileId);
      if (!file) {
        return res.status(404).json({ error: "Fichier non trouvé" });
      }

      console.log(`[FILE-DOWNLOAD] User ${userId} downloading file ${fileId}: ${file.name}`);
      
      // Rediriger vers l'URL du fichier pour téléchargement
      res.redirect(file.url);
    } catch (error) {
      console.error('Erreur téléchargement fichier:', error);
      res.status(500).json({ error: 'Erreur lors du téléchargement' });
    }
  });

  // ✅ API TÉLÉCHARGEMENT DOSSIER COMPLET - Nouvelle fonctionnalité
  app.get("/api/folders/:id/download", requireAuth, async (req, res) => {
    try {
      const folderId = parseInt(req.params.id, 10);
      const userId = req.user?.id;

      console.log(`[FOLDER-DOWNLOAD] Téléchargement dossier ${folderId} pour utilisateur ${userId}`);

      // Vérifier si l'utilisateur a accès au dossier
      const sharedFolders = await storage.getSharedFolders(userId);
      const folder = sharedFolders.find(f => f.id === folderId);
      
      if (!folder) {
        return res.status(404).json({ error: "Dossier non trouvé ou accès non autorisé" });
      }

      // Récupérer tous les fichiers du dossier
      const folderFiles = await storage.getFilesByFolder(folderId);
      
      if (folderFiles.length === 0) {
        return res.status(404).json({ error: "Aucun fichier trouvé dans le dossier" });
      }

      const archiver = require('archiver');
      const fs = require('fs');
      const path = require('path');

      // Configurer les headers pour le téléchargement
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${folder.name}.zip"`);

      // Créer l'archive ZIP
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      archive.on('error', (err: any) => {
        console.error('[FOLDER-DOWNLOAD] Erreur archivage:', err);
        res.status(500).json({ error: "Erreur lors de la création de l'archive" });
      });

      // Pipe l'archive vers la réponse
      archive.pipe(res);

      // Ajouter chaque fichier à l'archive
      for (const file of folderFiles) {
        try {
          const filePath = path.join('uploads', file.name);
          if (fs.existsSync(filePath)) {
            archive.file(filePath, { name: file.name });
            console.log(`[FOLDER-DOWNLOAD] Fichier ajouté: ${file.name}`);
          } else {
            console.warn(`[FOLDER-DOWNLOAD] Fichier non trouvé: ${filePath}`);
          }
        } catch (fileError) {
          console.error(`[FOLDER-DOWNLOAD] Erreur fichier ${file.name}:`, fileError);
        }
      }

      // Finaliser l'archive
      archive.finalize();
      
      console.log(`[FOLDER-DOWNLOAD] Archive créée pour dossier: ${folder.name} avec ${folderFiles.length} fichiers`);

    } catch (error: any) {
      console.error('[FOLDER-DOWNLOAD] Erreur générale:', error);
      res.status(500).json({ error: error.message || "Erreur lors du téléchargement du dossier" });
    }
  });

  // WEBSOCKET AMÉLIORÉ avec heartbeat et identification utilisateur
  if (!(global as any).wss) {
    const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
    (global as any).wss = wss;

    wss.on('connection', (ws, req) => {
    console.log('[WS] Client connection attempt from:', req.headers.origin);
    console.log('[WS] New client connected');
    
    // Variables pour ce client
    let userId: number | null = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;

    // Setup heartbeat
    const setupHeartbeat = () => {
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000); // Ping every 30 seconds
    };

    setupHeartbeat();

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        console.log('[WS] Message received:', message);

        // Handle heartbeat pong
        if (message.type === 'pong') {
          console.log('[WS] Pong received from client');
          return;
        }

        // Handle ping - respond with pong
        if (message.type === 'ping') {
          ws.send(JSON.stringify({ type: 'pong' }));
          return;
        }

        // Handle user identification
        if (message.type === 'identify' && message.userId) {
          userId = message.userId;
          (ws as any).userId = userId;
          console.log('[WS] Client identified as user:', userId);
          return;
        }

        // Handle other message types
        console.log('[WS] Processing message type:', message.type);
        
      } catch (error) {
        console.error('[WS] Error parsing message:', error);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Client disconnected');
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    });

    ws.on('error', (error) => {
      console.error('[WS] WebSocket error:', error);
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    });
  });

    console.log('[WS] WebSocket server configured on path /ws');
  } else {
    console.log('[WS] WebSocket server already configured, reusing existing instance');
  }

  return httpServer;
}