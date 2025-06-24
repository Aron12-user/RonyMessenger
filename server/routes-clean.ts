import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
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
  app.get("/api/conversations", async (req, res) => {
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

  app.post("/api/conversations", async (req, res) => {
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

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const conversationId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Contenu du message requis" });
      }

      const message = await storage.createMessage({
        conversationId,
        senderId: userId,
        content,
        timestamp: new Date()
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

      const folders = await storage.getFoldersForUser(userId);
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

      const files = await storage.getFilesByFolder(folderId);
      console.log(`[routes] Returning ${files.length} files`);
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
      let folderStructure = {};
      if (filePaths && Array.isArray(filePaths)) {
        filePaths.forEach(path => {
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
      res.status(500).json({ error: error.message || 'Erreur lors de l\'upload des fichiers' });
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

      const sharedFiles = await storage.getSharedFiles(userId);
      res.json({ files: sharedFiles, folders: [] });
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
      res.json({ success: true, sharing, message: "Fichier partagé avec succès" });
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

      // Vérifier que le dossier existe et appartient à l'utilisateur
      const folder = await storage.getFolderById(folderId);
      if (!folder) {
        return res.status(404).json({ error: "Dossier introuvable" });
      }

      if (folder.ownerId !== userId) {
        return res.status(403).json({ error: "Vous n'avez pas l'autorisation de partager ce dossier" });
      }

      console.log(`[folders] Sharing folder ${folderId} with user ${sharedWithId}`);
      
      res.json({ 
        success: true, 
        message: "Dossier partagé avec succès",
        sharing: {
          folderId,
          sharedWithId,
          permission: permission || 'read',
          ownerId: userId,
          createdAt: new Date()
        }
      });
    } catch (error: any) {
      console.error('Erreur lors du partage du dossier:', error);
      res.status(500).json({ error: error.message || "Erreur lors du partage" });
    }
  });

  app.post("/api/files/:id/share", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const fileId = parseInt(req.params.id);
      const { sharedWithUserId, permissions } = req.body;

      if (!sharedWithUserId) {
        return res.status(400).json({ error: "Utilisateur destinataire requis" });
      }

      const sharingData: InsertFileSharing = {
        fileId,
        ownerId: userId,
        sharedWithId: sharedWithUserId,
        permission: permissions || 'read',
        createdAt: new Date()
      };

      const sharing = await storage.shareFile(sharingData);
      res.json(sharing);
    } catch (error) {
      console.error('Error sharing file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Contacts routes
  app.get("/api/contacts", async (req, res) => {
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

  // AI Assistant route
  app.post("/api/ai/chat", async (req, res) => {
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

  // Jitsi routes temporarily disabled - using WebRTC native solution
  console.log("Routes configured successfully");

  return httpServer;
}