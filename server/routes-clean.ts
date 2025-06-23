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
import { registerJitsiRoutes } from "./jitsi/routes";
import { handleAIChat } from "./ai-assistant";
import { liveKitService } from "./livekit-config";
import { bbbService } from "./bigbluebutton-config";

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
  setupSimpleAuth(app);

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
      fileSize: 100 * 1024 * 1024 // Limit to 100MB
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
  app.get("/api/folders", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const parentId = req.query.parentId ? parseInt(req.query.parentId as string) : null;
      const folders = await storage.getFoldersByParent(parentId, userId);
      res.json(folders);
    } catch (error) {
      console.error('Error fetching folders:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/folders", async (req, res) => {
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

  app.put("/api/folders/:id", async (req, res) => {
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

  app.delete("/api/folders/:id", async (req, res) => {
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

  app.get("/api/files", async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const folderId = req.query.folderId ? parseInt(req.query.folderId as string) : null;
      const files = await storage.getFilesByFolder(folderId);
      res.json(files);
    } catch (error) {
      console.error('Error fetching files:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.post("/api/files/upload", upload.single('file'), async (req, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Aucun fichier fourni" });
      }

      const { folderId } = req.body;
      
      const fileData = {
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        url: `/uploads/${req.file.filename}`,
        uploaderId: userId,
        folderId: folderId ? parseInt(folderId) : null
      };

      const file = await storage.createFile(fileData);
      res.json(file);
    } catch (error) {
      console.error('Error uploading file:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/files/shared", async (req, res) => {
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

  // Meeting routes
  app.get("/api/meetings/active", async (req, res) => {
    try {
      res.json({ success: true, rooms: [] });
    } catch (error) {
      console.error('Error fetching active meetings:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  app.get("/api/meetings/scheduled", async (req, res) => {
    try {
      res.json({ success: true, meetings: [] });
    } catch (error) {
      console.error('Error fetching scheduled meetings:', error);
      res.status(500).json({ error: 'Internal server error' });
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

  // LiveKit routes
  app.post('/api/livekit/token', async (req: Request, res: Response) => {
    try {
      const { roomName, participantName } = req.body;
      
      if (!roomName || !participantName) {
        return res.status(400).json({ error: 'Room name and participant name are required' });
      }

      const token = await liveKitService.generateAccessToken(roomName, participantName);
      res.json({ token });
    } catch (error) {
      console.error('Error generating LiveKit token:', error);
      res.status(500).json({ error: 'Failed to generate token' });
    }
  });

  app.get('/api/livekit/room/:roomCode', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const roomInfo = await liveKitService.getRoomInfo(roomCode);
      res.json(roomInfo);
    } catch (error) {
      console.error('Error getting room info:', error);
      res.status(500).json({ error: 'Failed to get room info' });
    }
  });

  // BigBlueButton routes
  app.post('/api/bbb/create', async (req: Request, res: Response) => {
    try {
      const { meetingID, meetingName, moderatorPW, attendeePW } = req.body;
      
      if (!meetingID || !meetingName) {
        return res.status(400).json({ error: 'Meeting ID and name are required' });
      }

      const result = await bbbService.createMeeting(meetingID, meetingName, moderatorPW, attendeePW);
      res.json(result);
    } catch (error) {
      console.error('Error creating BBB meeting:', error);
      res.status(500).json({ error: 'Failed to create meeting' });
    }
  });

  app.post('/api/bbb/join', async (req: Request, res: Response) => {
    try {
      const { meetingID, fullName, password, userID } = req.body;
      
      if (!meetingID || !fullName || !password) {
        return res.status(400).json({ error: 'Meeting ID, full name, and password are required' });
      }

      const joinUrl = bbbService.getJoinUrl(meetingID, fullName, password, userID);
      res.json({ joinUrl });
    } catch (error) {
      console.error('Error generating BBB join URL:', error);
      res.status(500).json({ error: 'Failed to generate join URL' });
    }
  });

  app.get('/api/bbb/meeting/:roomCode', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const { password } = req.query;
      
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      const meetingInfo = await bbbService.getMeetingInfo(roomCode, password as string);
      res.json(meetingInfo);
    } catch (error) {
      console.error('Error getting BBB meeting info:', error);
      res.status(500).json({ error: 'Failed to get meeting info' });
    }
  });

  app.delete('/api/bbb/meeting/:roomCode', async (req: Request, res: Response) => {
    try {
      const { roomCode } = req.params;
      const { password } = req.body;
      
      if (!password) {
        return res.status(400).json({ error: 'Password is required' });
      }

      const result = await bbbService.endMeeting(roomCode, password);
      res.json({ success: result });
    } catch (error) {
      console.error('Error ending BBB meeting:', error);
      res.status(500).json({ error: 'Failed to end meeting' });
    }
  });

  // Jitsi routes temporarily disabled - using WebRTC native solution
  console.log("Routes configured successfully");

  return httpServer;
}