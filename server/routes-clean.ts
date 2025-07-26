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
      fileSize: 100 * 1024 * 1024, // Limit to 100MB
      files: 20 // Maximum 20 files per request
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

      // Validation des fichiers
      const maxSize = 100 * 1024 * 1024; // 100MB
      const allowedTypes = [
        'image/', 'video/', 'audio/', 'text/', 'application/pdf',
        'application/msword', 'application/vnd.openxmlformats-officedocument',
        'application/vnd.ms-excel', 'application/vnd.ms-powerpoint',
        'application/zip', 'application/x-rar-compressed'
      ];

      for (const file of req.files) {
        if (file.size > maxSize) {
          return res.status(400).json({ 
            error: `Le fichier "${file.originalname}" dépasse la taille limite de 100MB` 
          });
        }

        const isAllowed = allowedTypes.some(type => file.mimetype.startsWith(type));
        if (!isAllowed) {
          return res.status(400).json({ 
            error: `Le type de fichier "${file.mimetype}" n'est pas autorisé pour "${file.originalname}"` 
          });
        }
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
        
        // Diffuser via WebSocket pour réception instantanée avec gestion robuste
        if ((global as any).wss?.clients) {
          (global as any).wss.clients.forEach((client: any) => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify(courierData));
            }
          });
          console.log(`[WebSocket] Notification fichier diffusée à ${(global as any).wss.clients.size} clients`);
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
        
        // Diffuser via WebSocket pour réception instantanée avec gestion robuste
        if ((global as any).wss?.clients) {
          (global as any).wss.clients.forEach((client: any) => {
            if (client.readyState === 1) { // WebSocket.OPEN
              client.send(JSON.stringify(courierData));
            }
          });
          console.log(`[WebSocket] Notification dossier diffusée à ${(global as any).wss.clients.size} clients`);
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

  // API COURRIER CORRIGÉE - utilise les méthodes de stockage existantes
  app.get("/api/files/shared", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      console.log(`[COURRIER-FIX] Récupération courrier pour utilisateur ${userId}`);
      
      // Utiliser les méthodes de stockage existantes qui fonctionnent
      const sharedFiles = await storage.getSharedFiles(userId);
      const sharedFolders = await storage.getSharedFolders(userId);
      
      console.log(`[COURRIER-FIX] Storage retourné: ${sharedFiles.length} fichiers, ${sharedFolders.length} dossiers`);

      // Convertir en format courrier
      const fileEmails = sharedFiles.map((file: any, index: number) => ({
        id: 1000 + index,
        subject: `Fichier partagé: ${file.name}`,
        sender: file.sharedBy?.displayName || 'Utilisateur',
        senderEmail: file.sharedBy?.username || 'user@rony.com',
        content: `Fichier "${file.name}" a été partagé avec vous.\n\nTaille: ${(file.size / 1024).toFixed(1)} KB\nType: ${file.type || 'Non spécifié'}\n\nCliquez pour télécharger.`,
        date: new Date(file.sharedAt).toLocaleDateString('fr-FR'),
        time: new Date(file.sharedAt).toLocaleTimeString('fr-FR'),
        priority: 'medium',
        hasAttachment: true,
        attachment: {
          name: file.name,
          size: file.size,
          type: file.type,
          url: `/api/files/${file.id}/download`
        },
        category: 'files'
      }));

      const folderEmails = sharedFolders.map((folder: any, index: number) => ({
        id: 2000 + index,
        subject: `Dossier partagé: ${folder.name}`,
        sender: folder.sharedBy?.displayName || 'Utilisateur',
        senderEmail: folder.sharedBy?.username || 'user@rony.com',
        content: `Dossier "${folder.name}" a été partagé avec vous.\n\nVous pouvez l'explorer et télécharger son contenu.`,
        date: new Date(folder.sharedAt).toLocaleDateString('fr-FR'),
        time: new Date(folder.sharedAt).toLocaleTimeString('fr-FR'),
        priority: 'medium',
        hasAttachment: true,
        folder: {
          id: folder.id,
          name: folder.name,
          fileCount: 0
        },
        category: 'folders'
      }));

      console.log(`[COURRIER-FIX] Emails générés: ${fileEmails.length} fichiers, ${folderEmails.length} dossiers`);

      res.json({ 
        files: fileEmails, 
        folders: folderEmails 
      });
    } catch (error: any) {
      console.error('[COURRIER-FIX] Erreur:', error);
      res.status(500).json({ error: "Erreur serveur" });
    }
  });

  // Route /api/files/:id/share supprimée pour éviter les doublons - utilise uniquement /api/files/share

  // APIs PLANIFICATION - Système d'événements complet
  
  // Créer un nouvel événement
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
      
      res.json({ success: true, event });
    } catch (error: any) {
      console.error('Erreur création événement:', error);
      res.status(500).json({ error: error.message || "Erreur serveur" });
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

  // Modifier un événement
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
      const meetingUrl = `https://meet.jit.si/${roomCode}`;

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

  return httpServer;
}