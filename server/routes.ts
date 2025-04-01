import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { json } from "express";
import { insertUserSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { setupAuth } from "./auth";

// Map of online users
const onlineUsers = new Map<number, WebSocket>();

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication
  const { requireAuth } = setupAuth(app);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
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
    const userId = (req.user as Express.User).id;
    
    const conversations = await storage.getConversationsForUser(userId);
    res.json(conversations);
  });
  
  app.post('/api/conversations', requireAuth, async (req, res) => {
    try {
      const { participantId } = req.body;
      
      // Utiliser l'ID de l'utilisateur connecté
      const creatorId = (req.user as Express.User).id;
      
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
      const userId = (req.user as Express.User).id;
      
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
      const senderId = (req.user as Express.User).id;
      
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
  
  // Files routes
  app.get('/api/files', requireAuth, async (req, res) => {
    // Utiliser l'ID de l'utilisateur connecté
    const userId = (req.user as Express.User).id;
    
    const files = await storage.getFilesForUser(userId);
    res.json(files);
  });
  
  // Contacts routes
  app.get('/api/contacts', requireAuth, async (req, res) => {
    // Utiliser l'ID de l'utilisateur connecté
    const userId = (req.user as Express.User).id;
    
    const contacts = await storage.getContactsForUser(userId);
    res.json(contacts);
  });
  
  app.post('/api/contacts', requireAuth, async (req, res) => {
    try {
      // Utiliser l'ID de l'utilisateur connecté
      const userId = (req.user as Express.User).id;
      const { username } = req.body;
      
      if (!username) {
        return res.status(400).json({ message: 'Username is required' });
      }
      
      // Find the user by username
      const user = await storage.getUserByUsername(username);
      
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      
      // Check if trying to add self
      if (user.id === userId) {
        return res.status(400).json({ message: 'Cannot add yourself as a contact' });
      }
      
      // Add the contact
      await storage.addContact({
        userId,
        contactId: user.id,
        isFavorite: false,
        createdAt: new Date()
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error('Error adding contact:', error);
      res.status(500).json({ message: 'Failed to add contact' });
    }
  });

  // Route pour mettre à jour le profil utilisateur
  app.patch('/api/user/profile', requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: 'Unauthorized' });
      }
      
      const userId = (req.user as Express.User).id;
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

  return httpServer;
}
