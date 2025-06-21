import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
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
import { registerJitsiRoutes } from "./jitsi/routes";
import { handleAIChat } from "./ai-assistant";

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
      cb(new Error('Seuls les fichiers image sont autorisés'));
    }
  }
});

// Map of online users
const onlineUsers = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const requireAuth = setupSimpleAuth(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Configure multer for file uploads
  const uploadsDir = path.resolve('./uploads');
  
  // Ensure uploads directory exists
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
      fileSize: 100 * 1024 * 1024 // Limit to 100MB
    }
  });
  
  // Create WebSocket server on a distinct endpoint
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws',
    perMessageDeflate: false // Désactiver la compression pour éviter les problèmes de compatibilité
  });
  
  // User routes with pagination (protected)
  app.get('/api/users', requireAuth, async (req, res) => {
    try {
      // Extraction des paramètres de pagination depuis la requête
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'id';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';
      
      // Vérification de la validité des paramètres
      if (page < 1 || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({ 
          error: 'Invalid pagination parameters. Page and pageSize must be positive, and pageSize cannot exceed 100.' 
        });
      }
      
      // Récupération des utilisateurs avec pagination
      const result = await storage.getPaginatedUsers({ page, pageSize, sortBy, sortOrder });
      res.json(result);
    } catch (error) {
      console.error('Error fetching paginated users:', error);
      res.status(500).json({ error: 'Failed to fetch users. Please try again later.' });
    }
  });
  
  // WebSocket handling
  wss.on('connection', (ws) => {
    let userId: number | null = null;
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        
        switch (data.type) {
          case 'authenticate':
            const newUserId = data.data.userId as number; 
            if (typeof newUserId === 'number') {
              userId = newUserId;
              onlineUsers.set(userId, ws);
            }
            
            // Update user status to online
            if (userId) {
              await storage.updateUserStatus(userId, 'online');
              
              // Broadcast status update to all clients
              broadcastToAll({
                type: 'user_status',
                data: { userId, status: 'online' }
              });
            }
            break;
            
          case 'new_message':
            if (userId && data.data.message) {
              const conversationId = data.data.conversationId;
              const conversation = await storage.getConversation(conversationId);
              
              if (conversation) {
                // Send to the other user if they are online
                const recipientId = conversation.participantId === userId 
                  ? conversation.creatorId 
                  : conversation.participantId;
                
                const recipientWs = onlineUsers.get(recipientId);
                
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                  recipientWs.send(JSON.stringify({
                    type: 'new_message',
                    data: {
                      message: data.data.message,
                      conversationId
                    }
                  }));
                }
              }
            }
            break;
            
          case 'user_typing':
            if (userId && data.data.conversationId) {
              const conversationId = data.data.conversationId;
              const conversation = await storage.getConversation(conversationId);
              
              if (conversation) {
                const recipientId = conversation.participantId === userId 
                  ? conversation.creatorId 
                  : conversation.participantId;
                
                const recipientWs = onlineUsers.get(recipientId);
                
                if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
                  recipientWs.send(JSON.stringify({
                    type: 'user_typing',
                    data: {
                      userId,
                      conversationId,
                      isTyping: data.data.isTyping
                    }
                  }));
                }
              }
            }
            break;
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });
    
    ws.on('close', async () => {
      if (userId) {
        onlineUsers.delete(userId);
        
        // Update user status to offline
        await storage.updateUserStatus(userId, 'offline');
        
        // Broadcast status update to all clients
        broadcastToAll({
          type: 'user_status',
          data: { userId, status: 'offline' }
        });
      }
    });
  });
  
  // Helper function to broadcast to all connected clients
  function broadcastToAll(data: any) {
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(data));
      }
    });
  }
  
  // Avatar upload route
  app.post('/api/upload-avatar', requireAuth, avatarUpload.single('avatar'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Aucun fichier fourni' });
      }

      const userId = req.user!.id;
      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Update user avatar in database
      await storage.updateUserProfile(userId, { avatar: avatarUrl });

      res.json({ 
        message: 'Avatar mis à jour avec succès',
        avatarUrl 
      });
    } catch (error) {
      console.error('Error uploading avatar:', error);
      res.status(500).json({ error: 'Erreur lors du téléchargement de l\'avatar' });
    }
  });

  // Update user profile
  app.patch('/api/user/profile', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { displayName, email, phone, title } = req.body;

      await storage.updateUserProfile(userId, { displayName, email, phone, title });

      res.json({ message: 'Profil mis à jour avec succès' });
    } catch (error) {
      console.error('Error updating profile:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du profil' });
    }
  });

  // Update user theme
  app.patch('/api/user/theme', requireAuth, async (req, res) => {
    try {
      const { theme } = req.body;
      const userId = req.user!.id;

      if (!theme || typeof theme !== 'string') {
        return res.status(400).json({ error: 'Thème invalide' });
      }

      await storage.updateUserProfile(userId, { theme });

      res.json({ message: 'Thème mis à jour avec succès' });
    } catch (error) {
      console.error('Error updating theme:', error);
      res.status(500).json({ error: 'Erreur lors de la mise à jour du thème' });
    }
  });

  // AI Assistant route
  app.post('/api/ai-chat', requireAuth, handleAIChat);

  // Serve uploaded avatars
  app.use('/uploads/avatars', expressStatic(path.join(process.cwd(), 'uploads/avatars')));

  // API Routes
  // User routes (handled by our auth.ts)
  
  // Version publique pour tests de pagination (sans authentification)
  app.get('/api/test/users', async (req, res) => {
    try {
      // Extraction des paramètres de pagination depuis la requête
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 50;
      const sortBy = (req.query.sortBy as string) || 'id';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';
      
      // Vérification de la validité des paramètres
      if (page < 1 || pageSize < 1 || pageSize > 100) {
        return res.status(400).json({ 
          error: 'Invalid pagination parameters. Page and pageSize must be positive, and pageSize cannot exceed 100.' 
        });
      }
      
      // Récupération des utilisateurs avec pagination
      const result = await storage.getPaginatedUsers({ page, pageSize, sortBy, sortOrder });
      
      // Suppression des mots de passe avant d'envoyer les données
      const sanitizedResult = {
        ...result,
        data: result.data.map(user => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        })
      };
      
      res.json(sanitizedResult);
    } catch (error) {
      console.error('Error fetching paginated users:', error);
      res.status(500).json({ error: 'Failed to fetch users. Please try again later.' });
    }
  });
  
  // Route obsolète remplacée par la version paginée ci-dessus
  // app.get('/api/users', requireAuth, async (req, res) => {
  //   const users = await storage.getAllUsers();
  //   
  //   // Don't send passwords back
  //   const usersWithoutPasswords = users.map(user => {
  //     const { password, ...userWithoutPassword } = user;
  //     return userWithoutPassword;
  //   });
  //   
  //   res.json(usersWithoutPasswords);
  // });
  
  // Conversation routes
  app.get('/api/conversations', requireAuth, async (req, res) => {
    // Utiliser l'ID de l'utilisateur connecté
    const userId = req.user!.id;
    
    const conversations = await storage.getConversationsForUser(userId);
    res.json(conversations);
  });
  
  app.post('/api/conversations', requireAuth, async (req, res) => {
    try {
      const { participantId } = req.body;
      
      // Utiliser l'ID de l'utilisateur connecté
      const creatorId = req.user!.id;
      
      if (!participantId) {
        return res.status(400).json({ message: 'Participant ID is required' });
      }
      
      // Check if a conversation already exists between these users
      const userConversations = await storage.getConversationsForUser(creatorId);
      const existingConversation = userConversations.find(conv => 
        (conv.participantId === participantId && conv.creatorId === creatorId) || 
        (conv.participantId === creatorId && conv.creatorId === participantId)
      );
      
      if (existingConversation) {
        // Return the existing conversation instead of creating a new one
        return res.json(existingConversation);
      }
      
      // Create a new conversation if none exists
      const conversation = await storage.createConversation({
        creatorId,
        participantId,
        createdAt: new Date(),
        lastMessageTime: null,
        lastMessage: '',
        unreadCount: 0
      });
      
      res.status(201).json(conversation);
    } catch (error) {
      console.error('Error creating conversation:', error);
      res.status(500).json({ message: 'Could not create conversation' });
    }
  });
  
  app.put('/api/conversations/:id/read', requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.id);
      
      // Utiliser l'ID de l'utilisateur connecté
      const userId = req.user!.id;
      
      await storage.markConversationAsRead(conversationId, userId);
      
      res.status(200).json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Could not mark conversation as read' });
    }
  });
  
  // Messages routes
  app.get('/api/messages/:conversationId', requireAuth, async (req, res) => {
    const conversationId = parseInt(req.params.conversationId);
    
    const messages = await storage.getMessagesForConversation(conversationId);
    res.json(messages);
  });
  
  app.post('/api/messages/:conversationId', requireAuth, async (req, res) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      
      // Utiliser l'ID de l'utilisateur connecté
      const senderId = req.user!.id;
      
      const messageData = insertMessageSchema.parse({
        ...req.body,
        conversationId,
        senderId,
        timestamp: new Date(),
        isRead: false
      });
      
      const message = await storage.createMessage(messageData);
      
      // Update conversation with last message info
      await storage.updateConversationLastMessage(
        conversationId, 
        message.content, 
        message.timestamp,
        senderId
      );
      
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid message data' });
      }
      res.status(500).json({ message: 'Could not create message' });
    }
  });
  
  // Cloud Storage API Routes (Folders and Files)
  // Get files in a specific folder or root folder
  app.get('/api/files', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const folderId = req.query.folderId === "null" ? null : req.query.folderId ? parseInt(req.query.folderId as string) : null;
      
      // Get files that belong to the current user only
      const userFiles = await storage.getFilesForUser(userId);
      
      // Filter by folder if specified
      const files = folderId !== undefined 
        ? userFiles.filter(file => file.folderId === folderId)
        : userFiles;
        
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ message: 'Failed to fetch files' });
    }
  });
  
  // Get all folders for user
  app.get('/api/folders', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const parentId = req.query.parentId === "null" ? null : req.query.parentId ? parseInt(req.query.parentId as string) : null;
      
      // If parentId is provided, get subfolders, otherwise get all user folders
      const folders = parentId !== undefined
        ? await storage.getFoldersByParent(parentId, userId)
        : await storage.getFoldersForUser(userId);
        
      res.json(folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ message: 'Failed to fetch folders' });
    }
  });
  
  // Get storage statistics
  app.get('/api/storage/stats', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Get all files for the user
      const files = await storage.getFilesForUser(userId);
      
      // Calculate used space in bytes
      const usedSpace = files.reduce((total, file) => total + file.size, 0);
      
      // Total space: 1TB (1 terabyte = 1024^4 bytes)
      const totalSpace = 1024 * 1024 * 1024 * 1024;
      
      res.json({
        usedSpace,
        totalSpace,
        filesCount: files.length
      });
    } catch (error) {
      console.error('Error getting storage stats:', error);
      res.status(500).json({ message: 'Failed to get storage statistics' });
    }
  });
  
  // Upload multiple files
  app.post('/api/upload', requireAuth, upload.array('files', 10), async (req, res) => {
    try {
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({ message: 'No files uploaded' });
      }
      
      const userId = req.user!.id;
      const folderId = req.body.folderId === "null" ? null : req.body.folderId ? parseInt(req.body.folderId) : null;
      
      const uploadedFiles = [];
      
      for (const file of req.files) {
        const { originalname, path: filepath, mimetype, size } = file;
        
        // Create URL for the file
        const serverUrl = `http://${req.headers.host}`;
        const fileUrl = `${serverUrl}/uploads/${path.basename(filepath)}`;
        
        // Save file metadata to database
        const savedFile = await storage.createFile({
          name: originalname,
          type: mimetype,
          size: size,
          url: fileUrl,
          uploaderId: userId,
          folderId: folderId,
          uploadedAt: new Date(),
          updatedAt: new Date(),
          isShared: false,
          expiresAt: null,
          sharedWithId: null,
          shareLink: null,
          shareLinkExpiry: null,
          isPublic: false
        });
        
        uploadedFiles.push(savedFile);
      }
      
      res.status(201).json({ files: uploadedFiles, count: uploadedFiles.length });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ message: 'Failed to upload files' });
    }
  });

  // Upload folder with structure
  app.post('/api/upload-folder', requireAuth, upload.array('files', 100), async (req, res) => {
    try {
      console.log('Folder upload request received');
      
      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        console.error('No files in upload request');
        return res.status(400).json({ message: 'No files uploaded' });
      }
      
      const userId = req.user!.id;
      const isSync = req.body.isSync === 'true';
      let parentFolderId = req.body.folderId === "null" ? null : req.body.folderId ? parseInt(req.body.folderId) : null;
      
      // Si c'est une synchronisation, créer ou utiliser le dossier "Bureau Sync"
      if (isSync) {
        const existingFolders = await storage.getFoldersByParent(null, userId);
        let syncFolder = existingFolders.find(f => f.name === 'Bureau Sync');
        
        if (!syncFolder) {
          syncFolder = await storage.createFolder({
            name: 'Bureau Sync',
            parentId: null,
            path: 'Bureau Sync',
            ownerId: userId,
            iconType: 'blue',
            createdAt: new Date(),
            updatedAt: new Date(),
            isShared: false
          });
        }
        
        parentFolderId = syncFolder.id;
      }
      
      const filePaths = Array.isArray(req.body.filePaths) ? req.body.filePaths : [req.body.filePaths];
      
      let folderStructure = {};
      try {
        folderStructure = JSON.parse(req.body.folderStructure || '{}');
      } catch (e) {
        console.error('Error parsing folder structure:', e);
        folderStructure = {};
      }
      
      console.log('Upload params:', {
        filesCount: req.files.length,
        parentFolderId,
        filePathsCount: filePaths.length,
        folderStructure
      });
      
      const createdFolders: { [key: string]: number } = {};
      const uploadedFiles = [];
      
      // Créer tous les dossiers nécessaires d'abord
      const uniqueFolderPaths = new Set<string>();
      
      // Extraire tous les chemins de dossiers uniques
      filePaths.forEach((filePath: string) => {
        if (filePath && filePath.includes('/')) {
          const pathParts = filePath.split('/');
          // Construire tous les chemins intermédiaires
          for (let i = 1; i < pathParts.length; i++) {
            const folderPath = pathParts.slice(0, i).join('/');
            if (folderPath) {
              uniqueFolderPaths.add(folderPath);
            }
          }
        }
      });
      
      // Trier les chemins pour créer les parents avant les enfants
      const sortedFolderPaths = Array.from(uniqueFolderPaths).sort();
      console.log('Folders to create:', sortedFolderPaths);
      
      // Créer tous les dossiers de manière optimisée
      for (const folderPath of sortedFolderPaths) {
        const pathParts = folderPath.split('/');
        let currentParentId = parentFolderId;
        let currentPath = '';
        
        for (let i = 0; i < pathParts.length; i++) {
          const folderName = pathParts[i];
          currentPath = currentPath ? `${currentPath}/${folderName}` : folderName;
          
          if (!createdFolders[currentPath]) {
            try {
              // Vérifier si le dossier existe déjà
              const existingFolders = await storage.getFoldersByParent(currentParentId, userId);
              
              const existingFolder = existingFolders.find(f => f.name === folderName);
              
              if (existingFolder) {
                createdFolders[currentPath] = existingFolder.id;
                currentParentId = existingFolder.id;
              } else {
                // Créer le nouveau dossier
                const newFolder = await storage.createFolder({
                  name: folderName,
                  parentId: currentParentId,
                  path: currentPath,
                  ownerId: userId,
                  iconType: 'orange',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                  isShared: false
                });
                
                createdFolders[currentPath] = newFolder.id;
                currentParentId = newFolder.id;
                
                // Mettre à jour le cache
                const newCacheKey = `_cache_${currentParentId || 'root'}`;
                delete createdFolders[newCacheKey];
              }
            } catch (folderError) {
              console.error(`Error creating folder ${folderName}:`, folderError);
              throw folderError;
            }
          } else {
            currentParentId = createdFolders[currentPath];
          }
        }
      }
      
      // Traitement parallèle des fichiers pour améliorer la vitesse
      const BATCH_SIZE = 10; // Traiter 10 fichiers en parallèle
      const currentTime = new Date();
      const serverUrl = `http://${req.headers.host}`;
      
      // Préparer tous les fichiers avec leurs métadonnées
      const fileOperations = req.files.map((file: Express.Multer.File, i: number) => {
        const relativePath: string = filePaths[i] || file.originalname;
        
        // Déterminer le dossier de destination
        let targetFolderId = parentFolderId;
        if (relativePath.includes('/')) {
          const pathParts: string[] = relativePath.split('/');
          const folderPath = pathParts.slice(0, -1).join('/');
          if (folderPath && createdFolders[folderPath]) {
            targetFolderId = createdFolders[folderPath];
          }
        }
        
        return {
          file,
          relativePath,
          targetFolderId,
          fileData: {
            name: file.originalname,
            type: file.mimetype,
            size: file.size,
            url: `${serverUrl}/uploads/${path.basename(file.path)}`,
            uploaderId: userId,
            folderId: targetFolderId,
            uploadedAt: currentTime,
            updatedAt: currentTime,
            isShared: false,
            expiresAt: null,
            sharedWithId: null,
            shareLink: null,
            shareLinkExpiry: null,
            isPublic: false
          }
        };
      });
      
      // Traiter les fichiers par batches
      for (let i = 0; i < fileOperations.length; i += BATCH_SIZE) {
        const batch = fileOperations.slice(i, i + BATCH_SIZE);
        
        const batchPromises = batch.map(async ({ file, relativePath, fileData }) => {
          try {
            const savedFile = await storage.createFile(fileData);
            return savedFile;
          } catch (fileError) {
            console.error(`Error saving file ${relativePath}:`, fileError);
            throw fileError;
          }
        });
        
        const batchResults = await Promise.all(batchPromises);
        uploadedFiles.push(...batchResults);
        
        console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(fileOperations.length / BATCH_SIZE)}`);
      }
      
      // Nettoyer les clés de cache avant de retourner le résultat
      const cleanedFolders = Object.keys(createdFolders)
        .filter(key => !key.startsWith('_cache_'))
        .reduce((obj, key) => {
          obj[key] = createdFolders[key];
          return obj;
        }, {} as { [key: string]: number });

      const result = {
        message: 'Folder uploaded successfully',
        foldersCreated: Object.keys(cleanedFolders).length,
        filesUploaded: uploadedFiles.length,
        folders: cleanedFolders,
        files: uploadedFiles
      };
      
      console.log('Upload completed successfully:', result);
      res.status(201).json(result);
      
    } catch (error) {
      console.error('Error uploading folder:', error);
      res.status(500).json({ 
        message: 'Failed to upload folder',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });

  // Upload single file (legacy support)
  app.post('/api/files/upload', requireAuth, upload.single('file'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file uploaded' });
      }
      
      const userId = req.user!.id;
      const folderId = req.body.folderId === "null" ? null : req.body.folderId ? parseInt(req.body.folderId) : null;
      
      // Get file details
      const { originalname, path: filepath, mimetype, size } = req.file;
      
      // Create URL for the file (in a real cloud environment, this would be a CDN URL)
      const serverUrl = `http://${req.headers.host}`;
      const fileUrl = `${serverUrl}/uploads/${path.basename(filepath)}`;
      
      // Save file metadata to database
      const file = await storage.createFile({
        name: originalname,
        type: mimetype,
        size: size,
        url: fileUrl,
        uploaderId: userId,
        folderId: folderId,
        uploadedAt: new Date(),
        updatedAt: new Date(),
        isShared: false,
        expiresAt: null,
        sharedWithId: null,
        shareLink: null,
        shareLinkExpiry: null,
        isPublic: false
      });
      
      res.status(201).json(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ message: 'Failed to upload file' });
    }
  });
  
  // Create folder
  app.post('/api/folders', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { name, parentId, path, iconType } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Folder name is required' });
      }
      
      // Préparation des données pour la création du dossier
      const folderData: InsertFolder = {
        name,
        parentId: parentId === "null" ? null : (parentId ? parseInt(parentId) : null),
        path: path || name,
        ownerId: userId,
        iconType: iconType || 'orange',
        createdAt: new Date(),
        updatedAt: new Date(),
        isShared: false
      };
      
      console.log('Creating folder with data:', folderData);
      const folder = await storage.createFolder(folderData);
      
      res.status(201).json(folder);
    } catch (error) {
      console.error('Error creating folder:', error);
      res.status(500).json({ message: 'Failed to create folder' });
    }
  });
  
  // Update folder
  app.patch('/api/folders/:id', requireAuth, async (req, res) => {
    try {
      const folderId = parseInt(req.params.id);
      const { name, iconType } = req.body;
      
      if (name) {
        const folder = await storage.updateFolder(folderId, name);
        res.json(folder);
      } else if (iconType) {
        // Mise à jour de l'icône du dossier
        const folder = await storage.getFolderById(folderId);
        if (!folder) {
          return res.status(404).json({ message: 'Folder not found' });
        }
        
        // Utiliser une requête SQL directe pour mettre à jour l'icône
        await storage.updateFolderIcon(folderId, iconType);
        const updatedFolder = await storage.getFolderById(folderId);
        res.json(updatedFolder);
      } else {
        return res.status(400).json({ message: 'Name or iconType is required' });
      }
    } catch (error) {
      console.error('Error updating folder:', error);
      res.status(500).json({ message: 'Failed to update folder' });
    }
  });
  
  // Delete folder
  app.delete('/api/folders/:id', requireAuth, async (req, res) => {
    try {
      const folderId = parseInt(req.params.id);
      await storage.deleteFolder(folderId);
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting folder:', error);
      res.status(500).json({ message: 'Failed to delete folder' });
    }
  });
  
  // Update file
  app.patch('/api/files/:id', requireAuth, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      const updateData = req.body;
      
      const file = await storage.updateFile(fileId, updateData);
      res.json(file);
    } catch (error) {
      console.error('Error updating file:', error);
      res.status(500).json({ message: 'Failed to update file' });
    }
  });
  
  // Delete file
  app.delete('/api/files/:id', requireAuth, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id);
      
      // Get file info first to delete physical file if needed
      const file = await storage.getFileById(fileId);
      if (file) {
        // Extract filename from URL
        const filename = path.basename(file.url);
        const filepath = path.join(process.cwd(), 'uploads', filename);
        
        // Delete physical file if it exists
        if (fs.existsSync(filepath)) {
          fs.unlinkSync(filepath);
        }
        
        // Delete database record
        await storage.deleteFile(fileId);
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting file:', error);
      res.status(500).json({ message: 'Failed to delete file' });
    }
  });
  
  // Share files
  app.post('/api/files/share', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { fileIds, recipient, permission } = req.body;
      
      if (!fileIds || !fileIds.length || !recipient) {
        return res.status(400).json({ message: 'File IDs and recipient are required' });
      }
      
      // Find recipient user
      const recipientUser = await storage.getUserByUsername(recipient);
      if (!recipientUser) {
        return res.status(404).json({ message: 'Recipient user not found' });
      }
      
      // Share each file
      const sharingResults = await Promise.all(
        fileIds.map(async (fileId: number) => {
          // Check if file exists and belongs to current user
          const file = await storage.getFileById(fileId);
          if (!file || file.uploaderId !== userId) {
            return { fileId, success: false, message: 'File not found or not owned by you' };
          }
          
          // Share file
          const sharingData: InsertFileSharing = {
            fileId,
            ownerId: userId,
            sharedWithId: recipientUser.id,
            permission: permission || 'read',
            createdAt: new Date()
          };
          
          console.log('Sharing file with data:', sharingData);
          const sharing = await storage.shareFile(sharingData);
          
          // Update file to mark as shared
          await storage.updateFile(fileId, { isShared: true, sharedWithId: recipientUser.id });
          
          return { fileId, success: true, sharing };
        })
      );
      
      res.json(sharingResults);
    } catch (error) {
      console.error('Error sharing files:', error);
      res.status(500).json({ message: 'Failed to share files' });
    }
  });

  // Share single file with custom message (new advanced sharing)
  app.post('/api/files/share-message', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { fileId, recipientEmail, permission, subject, message } = req.body;
      
      if (!fileId) {
        return res.status(400).json({ message: 'File ID is required' });
      }
      
      if (!recipientEmail) {
        return res.status(400).json({ message: 'Recipient email is required' });
      }
      
      // Find recipient user by email/username
      const users = await storage.getAllUsers();
      const recipientUser = users.find(u => 
        u.username === recipientEmail || 
        u.email === recipientEmail || 
        u.displayName === recipientEmail
      );
      
      if (!recipientUser) {
        return res.status(404).json({ message: 'Adresse Rony introuvable' });
      }
      
      // Check if file exists and belongs to current user
      const file = await storage.getFileById(fileId);
      if (!file || file.uploaderId !== userId) {
        return res.status(404).json({ message: 'File not found or not owned by you' });
      }
      
      // Share file
      const sharingData: InsertFileSharing = {
        fileId,
        ownerId: userId,
        sharedWithId: recipientUser.id,
        permission: permission || 'read',
        createdAt: new Date()
      };
      
      const sharing = await storage.shareFile(sharingData);
      
      // Update file to mark as shared
      await storage.updateFile(fileId, { isShared: true, sharedWithId: recipientUser.id });
      
      // Broadcast real-time notification to recipient
      const senderUser = await storage.getUser(userId);
      broadcastToAll({
        type: 'courrier_message',
        data: {
          id: Date.now(),
          type: 'file',
          fileId,
          fileName: file.name,
          fileSize: file.size,
          fileType: file.type,
          fileUrl: file.url,
          sender: senderUser?.displayName || senderUser?.username || 'Utilisateur',
          senderEmail: senderUser?.username || senderUser?.email,
          recipientId: recipientUser.id,
          subject: subject || `Partage de fichier : ${file.name}`,
          message: message || `Nouveau fichier partagé : ${file.name}`,
          timestamp: new Date().toISOString()
        }
      });
      
      res.json({ success: true, sharing });
    } catch (error) {
      console.error('Error sharing file with message:', error);
      res.status(500).json({ message: 'Failed to share file with message' });
    }
  });

  // Share folder with custom message
  app.post('/api/folders/share-message', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { folderId, recipientEmail, permission, subject, message } = req.body;
      
      if (!folderId) {
        return res.status(400).json({ message: 'Folder ID is required' });
      }
      
      if (!recipientEmail) {
        return res.status(400).json({ message: 'Recipient email is required' });
      }
      
      // Find recipient user by email/username
      const users = await storage.getAllUsers();
      const recipientUser = users.find(u => 
        u.username === recipientEmail || 
        u.email === recipientEmail || 
        u.displayName === recipientEmail
      );
      
      if (!recipientUser) {
        return res.status(404).json({ message: 'Adresse Rony introuvable' });
      }
      
      // Check if folder exists and belongs to current user
      const folder = await storage.getFolderById(folderId);
      if (!folder || folder.ownerId !== userId) {
        return res.status(404).json({ message: 'Folder not found or not owned by you' });
      }
      
      // Get folder files for notification
      const folderFiles = await storage.getFilesByFolder(folderId);
      const totalSize = folderFiles.reduce((sum, file) => sum + file.size, 0);
      
      // Broadcast real-time notification to recipient
      const senderUser = await storage.getUser(userId);
      broadcastToAll({
        type: 'courrier_message',
        data: {
          id: Date.now(),
          type: 'folder',
          folderId,
          folderName: folder.name,
          fileCount: folderFiles.length,
          totalSize,
          sender: senderUser?.displayName || senderUser?.username || 'Utilisateur',
          senderEmail: senderUser?.username || senderUser?.email,
          recipientId: recipientUser.id,
          subject: subject || `Partage de dossier : ${folder.name}`,
          message: message || `Nouveau dossier partagé : ${folder.name}`,
          timestamp: new Date().toISOString()
        }
      });
      
      res.json({ success: true, folder });
    } catch (error) {
      console.error('Error sharing folder with message:', error);
      res.status(500).json({ message: 'Failed to share folder with message' });
    }
  });
  
  // Get shared files and folders with owner information
  app.get('/api/files/shared', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const sharedFiles = await storage.getSharedFiles(userId);
      const sharedFolders = await storage.getFoldersForUser(userId);
      
      // Enrichir les fichiers avec les informations du propriétaire
      const enrichedFiles = await Promise.all(
        sharedFiles.map(async (file) => {
          const owner = await storage.getUser(file.uploaderId);
          return {
            ...file,
            sharedBy: owner ? {
              id: owner.id,
              username: owner.username,
              displayName: owner.displayName || owner.username
            } : null
          };
        })
      );

      // Enrichir les dossiers partagés avec les informations du propriétaire et le nombre de fichiers
      const enrichedFolders = await Promise.all(
        sharedFolders.filter(folder => folder.isShared).map(async (folder) => {
          const owner = await storage.getUser(folder.ownerId);
          const folderFiles = await storage.getFilesByFolder(folder.id);
          const totalSize = folderFiles.reduce((sum, file) => sum + file.size, 0);
          
          return {
            id: folder.id,
            name: folder.name,
            type: 'folder',
            fileCount: folderFiles.length,
            totalSize: totalSize,
            uploaderId: folder.ownerId,
            uploadedAt: folder.createdAt.toISOString(),
            sharedBy: owner ? {
              id: owner.id,
              username: owner.username,
              displayName: owner.displayName || owner.username
            } : null
          };
        })
      );
      
      res.json({
        files: enrichedFiles,
        folders: enrichedFolders
      });
    } catch (error) {
      console.error('Error fetching shared content:', error);
      res.status(500).json({ message: 'Failed to fetch shared content' });
    }
  });

  // Get synchronized files for desktop sync
  app.get('/api/sync/files', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      // Récupérer tous les fichiers de l'utilisateur pour éviter les doublons
      const userFiles = await storage.getFilesForUser(userId);
      res.json(userFiles);
    } catch (error) {
      console.error('Error fetching sync files:', error);
      res.status(500).json({ message: 'Failed to fetch sync files' });
    }
  });
  
  // Serve uploaded files
  app.use('/uploads', (req, res, next) => {
    // Basic security check - only allow access to files with valid session
    if (!req.isAuthenticated()) {
      return res.status(401).send('Unauthorized');
    }
    next();
  }, expressStatic(path.resolve('./uploads')));
  
  // Contacts routes
  app.get('/api/contacts', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      
      // Check if pagination is requested
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;
      const sortBy = (req.query.sortBy as string) || 'displayName';
      const sortOrder = (req.query.sortOrder as string) === 'desc' ? 'desc' : 'asc';
      
      // If pagination parameters are provided, use paginated contacts
      if (req.query.page || req.query.pageSize) {
        if (page < 1 || pageSize < 1 || pageSize > 100) {
          return res.status(400).json({ 
            error: 'Invalid pagination parameters. Page and pageSize must be positive, and pageSize cannot exceed 100.' 
          });
        }
        
        const result = await storage.getPaginatedContactsForUser(userId, { page, pageSize, sortBy, sortOrder });
        res.json(result);
      } else {
        // Return all contacts for backward compatibility
        const contacts = await storage.getContactsForUser(userId);
        res.json(contacts);
      }
    } catch (error) {
      console.error('Error fetching contacts:', error);
      res.status(500).json({ error: 'Failed to fetch contacts' });
    }
  });
  
  app.post('/api/contacts', requireAuth, async (req, res) => {
    try {
      // Utiliser l'ID de l'utilisateur connecté
      const userId = req.user!.id;
      const { username } = req.body;
      
      console.log('POST /api/contacts - Attempting to add contact with username:', username);
      console.log('Current user ID:', userId);
      
      if (!username) {
        console.log('Username not provided');
        return res.status(400).json({ message: 'Username is required' });
      }
      
      // Find the user by username
      const user = await storage.getUserByUsername(username);
      console.log('Found user:', user);
      
      if (!user) {
        console.log('User not found for username:', username);
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if trying to add self
      if (user.id === userId) {
        console.log('User tried to add themselves as contact');
        return res.status(400).json({ message: 'Cannot add yourself as a contact' });
      }
      
      // Check if contact already exists
      const contacts = await storage.getContactsForUser(userId);
      const contactExists = contacts.some(contact => contact.id === user.id);
      
      if (contactExists) {
        console.log('Contact already exists');
        return res.status(400).json({ message: 'Contact already exists in your list' });
      }
      
      console.log('Adding contact with data:', {
        userId,
        contactId: user.id,
        isFavorite: false,
        createdAt: new Date()
      });
      
      // Add the contact
      const result = await storage.addContact({
        userId,
        contactId: user.id,
        isFavorite: false,
        createdAt: new Date()
      });
      
      console.log('Contact added successfully, result:', result);
      res.status(201).json(user);
    } catch (error) {
      console.error('Error adding contact:', error);
      res.status(500).json({ message: 'Failed to add contact' });
    }
  });

  // Delete contact route
  app.delete('/api/contacts/:contactId', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const contactId = parseInt(req.params.contactId);
      
      if (!contactId || isNaN(contactId)) {
        return res.status(400).json({ message: 'Invalid contact ID' });
      }
      
      // Remove the contact
      await storage.removeContact(userId, contactId);
      
      res.status(200).json({ message: 'Contact removed successfully' });
    } catch (error) {
      console.error('Error removing contact:', error);
      res.status(500).json({ message: 'Failed to remove contact' });
    }
  });

  // Route pour mettre à jour le profil utilisateur
  app.patch('/api/user/profile', requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const userId = req.user!.id;
      const { displayName, email, phone, title } = req.body;
      
      // Créer un objet avec uniquement les données à mettre à jour
      const updateData: { displayName?: string; email?: string; phone?: string; title?: string } = {};
      
      if (displayName !== undefined) updateData.displayName = displayName;
      if (email !== undefined) updateData.email = email;
      if (phone !== undefined) updateData.phone = phone;
      if (title !== undefined) updateData.title = title;
      
      // Mettre à jour les informations utilisateur
      await storage.updateUserProfile(userId, updateData);
      
      // Récupérer les informations mises à jour
      const updatedUser = await storage.getUser(userId);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Retourner l'utilisateur sans le mot de passe
      const { password, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error('Error updating user profile:', error);
      res.status(500).json({ message: 'Failed to update profile' });
    }
  });
  
  // Routes pour les fonctions Répondre et Transfert du courrier
  app.post('/api/courrier/reply', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { recipientEmail, message, originalSubject, originalSender, originalContent, senderName, senderEmail } = req.body;
      
      if (!recipientEmail || !message) {
        return res.status(400).json({ message: 'Destinataire et message sont requis' });
      }
      
      // Find recipient user by email/username
      const users = await storage.getAllUsers();
      const recipientUser = users.find(u => 
        u.username === recipientEmail || 
        u.email === recipientEmail || 
        u.displayName === recipientEmail
      );
      
      if (!recipientUser) {
        return res.status(404).json({ message: 'Destinataire introuvable' });
      }
      
      // Broadcast reply message to recipient
      broadcastToAll({
        type: 'courrier_message',
        data: {
          id: Date.now(),
          type: 'reply',
          sender: senderName,
          senderEmail: senderEmail,
          recipientId: recipientUser.id,
          subject: `Re: ${originalSubject}`,
          message: message,
          originalMessage: {
            subject: originalSubject,
            sender: originalSender,
            content: originalContent
          },
          timestamp: new Date().toISOString(),
          priority: 'medium'
        }
      });
      
      res.json({ success: true, message: 'Réponse envoyée avec succès' });
    } catch (error) {
      console.error('Error sending reply:', error);
      res.status(500).json({ message: 'Erreur lors de l\'envoi de la réponse' });
    }
  });

  app.post('/api/courrier/forward', requireAuth, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { recipientEmail, message, originalEmail, senderName, senderEmail } = req.body;
      
      if (!recipientEmail || !originalEmail) {
        return res.status(400).json({ message: 'Destinataire et email original sont requis' });
      }
      
      // Find recipient user by email/username
      const users = await storage.getAllUsers();
      const recipientUser = users.find(u => 
        u.username === recipientEmail || 
        u.email === recipientEmail || 
        u.displayName === recipientEmail
      );
      
      if (!recipientUser) {
        return res.status(404).json({ message: 'Destinataire introuvable' });
      }
      
      // Broadcast forwarded message to recipient with complete original data
      broadcastToAll({
        type: 'courrier_message',
        data: {
          id: Date.now(),
          type: 'forward',
          sender: senderName,
          senderEmail: senderEmail,
          recipientId: recipientUser.id,
          subject: `Fwd: ${originalEmail.subject}`,
          message: message || `Message transféré de ${originalEmail.sender}`,
          originalEmail: {
            subject: originalEmail.subject,
            sender: originalEmail.sender,
            senderEmail: originalEmail.senderEmail,
            content: originalEmail.content,
            date: originalEmail.date,
            time: originalEmail.time,
            attachment: originalEmail.attachment ? {
              id: originalEmail.attachment.id,
              name: originalEmail.attachment.name,
              type: originalEmail.attachment.type,
              size: originalEmail.attachment.size,
              url: originalEmail.attachment.url,
              uploaderId: originalEmail.attachment.uploaderId,
              uploadedAt: originalEmail.attachment.uploadedAt,
              sharedBy: originalEmail.attachment.sharedBy
            } : undefined,
            folder: originalEmail.folder ? {
              id: originalEmail.folder.id,
              name: originalEmail.folder.name,
              fileCount: originalEmail.folder.fileCount,
              totalSize: originalEmail.folder.totalSize,
              uploaderId: originalEmail.folder.uploaderId,
              uploadedAt: originalEmail.folder.uploadedAt,
              sharedBy: originalEmail.folder.sharedBy
            } : undefined
          },
          // Dupliquer les informations pour compatibilité
          fileId: originalEmail.attachment?.id,
          fileName: originalEmail.attachment?.name,
          fileSize: originalEmail.attachment?.size,
          fileType: originalEmail.attachment?.type,
          fileUrl: originalEmail.attachment?.url,
          folderId: originalEmail.folder?.id,
          folderName: originalEmail.folder?.name,
          fileCount: originalEmail.folder?.fileCount,
          totalSize: originalEmail.folder?.totalSize,
          timestamp: new Date().toISOString(),
          priority: 'medium'
        }
      });
      
      res.json({ success: true, message: 'Email transféré avec succès' });
    } catch (error) {
      console.error('Error forwarding email:', error);
      res.status(500).json({ message: 'Erreur lors du transfert de l\'email' });
    }
  });

  // Enregistrer les routes pour les réunions vidéo Jitsi
  registerJitsiRoutes(app, requireAuth);

  return httpServer;
}
