import { Express, Request, Response } from "express";
import { storage } from "./storage";
import bcrypt from "bcrypt";

import { User } from "../shared/schema";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export function setupSimpleAuth(app: Express) {
  // Middleware pour vérifier l'authentification
  const requireAuth = async (req: Request, res: Response, next: any) => {
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
      console.error("Erreur lors de la vérification de l'authentification:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  };

  // Route de connexion
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "Nom d'utilisateur incorrect" });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ message: "Mot de passe incorrect" });
      }

      // Créer la session
      req.session.userId = user.id;
      req.session.user = user;

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Erreur de connexion:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // Route d'inscription
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const { username, password, displayName, email } = req.body;

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Nom d'utilisateur déjà utilisé" });
      }

      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName,
        email,
        status: "online"
      });

      // Créer la session
      req.session.userId = user.id;
      req.session.user = user;

      const { password: _, ...userWithoutPassword } = user;
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Erreur d'inscription:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  // Route de déconnexion
  app.post("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.clearCookie('rony.session');
      res.sendStatus(200);
    });
  });

  // Route pour obtenir l'utilisateur actuel
  app.get("/api/user", async (req: Request, res: Response) => {
    if (!req.session?.userId) {
      return res.status(401).json({ message: "Non authentifié" });
    }

    try {
      const user = await storage.getUser(req.session.userId);
      if (!user) {
        return res.status(401).json({ message: "Utilisateur non trouvé" });
      }

      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Erreur lors de la récupération de l'utilisateur:", error);
      res.status(500).json({ message: "Erreur interne du serveur" });
    }
  });

  return { requireAuth };
}

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    user?: any;
  }
}