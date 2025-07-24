import type { Express, Request, Response } from "express";
import { completeStorage as storage } from "./storage-clean";
import { insertMessageSchema } from "@shared/schema";
import { z } from "zod";

// Middleware d'authentification simplifié pour la messagerie - utilise l'auth existant
async function requireAuthSimple(req: Request, res: Response, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Non authentifié" });
  }
  
  try {
    const user = await storage.getUser(req.session.userId);
    if (!user) {
      return res.status(401).json({ message: "Utilisateur non trouvé" });
    }
    req.user = user;
    next();
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    res.status(500).json({ message: "Erreur interne du serveur" });
  }
}

export function setupMessagingRoutes(app: Express) {
  
  // Route pour récupérer tous les messages
  app.get("/api/messages", requireAuthSimple, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      // Récupérer toutes les conversations de l'utilisateur
      const conversations = await storage.getConversationsForUser(userId);
      let allMessages: any[] = [];

      // Récupérer les messages pour chaque conversation
      for (const conversation of conversations) {
        const messages = await storage.getMessagesForConversation(conversation.id);
        allMessages = [...allMessages, ...messages];
      }

      // Trier par timestamp
      allMessages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

      res.json(allMessages);
    } catch (error) {
      console.error('Error fetching messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour récupérer les messages d'une conversation
  app.get("/api/messages/:conversationId", requireAuthSimple, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      if (isNaN(conversationId)) {
        return res.status(400).json({ error: "ID de conversation invalide" });
      }

      const messages = await storage.getMessagesForConversation(conversationId);
      res.json(messages);
    } catch (error) {
      console.error('Error fetching conversation messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour créer un message simple
  app.post("/api/messages", requireAuthSimple, async (req: Request, res: Response) => {
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
        fileSize
      } = req.body;

      if (!conversationId) {
        return res.status(400).json({ error: "ID de conversation requis" });
      }

      if (!content) {
        return res.status(400).json({ error: "Contenu du message requis" });
      }

      // Créer le message
      const message = await storage.createMessage({
        conversationId: parseInt(conversationId),
        senderId: userId,
        content,
        messageType,
        fileUrl: fileUrl || null,
        fileName: fileName || null,
        fileType: fileType || null,
        fileSize: fileSize || null,
        timestamp: new Date(),
        isRead: false,
        isDeleted: false,
        isPinned: false,
        isEdited: false,
        editedAt: null,
        replyToId: replyToId || null,
        reactions: [],
        mentions: [],
        metadata: null
      });

      // Mettre à jour la conversation
      await storage.updateConversationLastMessage(
        parseInt(conversationId),
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

  // Route pour les messages de conversation (compatible avec l'ancien format)
  app.post("/api/conversations/:id/messages", requireAuthSimple, async (req: Request, res: Response) => {
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
        fileSize: fileSize || null,
        timestamp: new Date(),
        isRead: false,
        isDeleted: false,
        isPinned: false,
        isEdited: false,
        editedAt: null,
        replyToId: null,
        reactions: [],
        mentions: [],
        metadata: null
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

  // Route pour modifier un message
  app.patch("/api/messages/:id", requireAuthSimple, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      const { content } = req.body;

      if (!content) {
        return res.status(400).json({ error: "Contenu requis" });
      }

      const updatedMessage = await storage.updateMessage(messageId, {
        content,
        isEdited: true,
        editedAt: new Date()
      });

      res.json(updatedMessage);
    } catch (error) {
      console.error('Error updating message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour supprimer un message
  app.delete("/api/messages/:id", requireAuthSimple, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      await storage.deleteMessage(messageId);

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour épingler/désépingler un message
  app.patch("/api/messages/:id/pin", requireAuthSimple, async (req: Request, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: "Non authentifié" });
      }

      const messageId = parseInt(req.params.id);
      const { isPinned } = req.body;

      const updatedMessage = await storage.updateMessage(messageId, {
        isPinned: !!isPinned
      });

      res.json(updatedMessage);
    } catch (error) {
      console.error('Error pinning message:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour ajouter une réaction
  app.post("/api/messages/:id/reactions", requireAuthSimple, async (req: Request, res: Response) => {
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

      res.json(reaction);
    } catch (error) {
      console.error('Error adding reaction:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // Route pour supprimer une réaction
  app.delete("/api/messages/:id/reactions", requireAuthSimple, async (req: Request, res: Response) => {
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

  // Route pour obtenir les messages épinglés
  app.get("/api/messages/:conversationId/pinned", requireAuthSimple, async (req: Request, res: Response) => {
    try {
      const conversationId = parseInt(req.params.conversationId);
      const pinnedMessages = await storage.getPinnedMessages(conversationId);
      res.json(pinnedMessages);
    } catch (error) {
      console.error('Error fetching pinned messages:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });
}