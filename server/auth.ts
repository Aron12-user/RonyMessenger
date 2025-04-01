import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        const user = await storage.getUserByUsername(username);
        if (!user) {
          return done(null, false, { message: "Nom d'utilisateur incorrect" });
        }
        
        // Pour le développement, accepter tous les mots de passe
        // En production, utiliser comparePasswords(password, user.password)
        if (process.env.NODE_ENV === 'production') {
          const isValid = await comparePasswords(password, user.password);
          if (!isValid) {
            return done(null, false, { message: "Mot de passe incorrect" });
          }
        }
        
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    }),
  );

  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      const { username, password, displayName } = req.body;
      
      // Vérifier si l'utilisateur existe déjà
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ message: "Ce nom d'utilisateur est déjà pris" });
      }
      
      // Hash du mot de passe
      const hashedPassword = await hashPassword(password);
      
      // Créer un nouvel utilisateur
      const user = await storage.createUser({
        username,
        password: hashedPassword,
        displayName: displayName || username,
        status: 'online',
        lastSeen: new Date(),
        email: null,
        phone: null,
        title: null
      });
      
      // Connecter automatiquement l'utilisateur
      req.login(user, (err) => {
        if (err) {
          return res.status(500).json({ message: "Erreur lors de la connexion" });
        }
        
        // Retourner l'utilisateur sans le mot de passe
        const { password, ...userWithoutPassword } = user;
        return res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Erreur lors de l'inscription:", error);
      res.status(500).json({ message: "Erreur lors de l'inscription" });
    }
  });

  app.post("/api/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: Express.User, info: any) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Échec de l'authentification" });
      }
      
      req.login(user, (err) => {
        if (err) {
          return next(err);
        }
        
        // Mettre à jour le statut de l'utilisateur
        storage.updateUserStatus(user.id, 'online');
        
        // Retourner l'utilisateur sans le mot de passe
        const { password, ...userWithoutPassword } = user;
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res) => {
    // Mettre à jour le statut de l'utilisateur avant la déconnexion
    if (req.user) {
      storage.updateUserStatus((req.user as Express.User).id, 'offline');
    }
    
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Erreur lors de la déconnexion" });
      }
      res.json({ message: "Déconnecté avec succès" });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Non authentifié" });
    }
    
    // Retourner l'utilisateur sans le mot de passe
    const { password, ...userWithoutPassword } = req.user as Express.User;
    res.json(userWithoutPassword);
  });

  // Middleware d'authentification pour protéger les routes
  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentification requise" });
    }
    next();
  };

  return { requireAuth };
}