import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes-clean";
import { setupVite, serveStatic, log } from "./vite";
// WebRTC server removed
import session from 'express-session';
import MemoryStore from 'memorystore';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configuration de session avec stockage en mémoire
const MemStore = MemoryStore(session);
app.use(session({
  store: new MemStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  }),
  secret: process.env.SESSION_SECRET || 'rony_session_secret_key_2025',
  resave: false,
  saveUninitialized: false,
  name: 'rony.session',
  cookie: { 
    secure: false, // Désactivé pour le développement
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 jours
    sameSite: 'lax'
  }
}));

// Logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const { method, url: path } = req;
  let capturedJsonResponse: any = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

app.use('/uploads', express.static('uploads'));

(async () => {
  try {
    log("Application démarrée avec stockage en mémoire", "system");
  } catch (error) {
    console.error("Erreur lors du démarrage:", error);
    log("Échec du démarrage de l'application", "system");
  }

  const server = await registerRoutes(app);

  // WebRTC server removed

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Gestion d'erreur globale
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Erreur serveur:", err);
    if (res.headersSent) {
      return;
    }
    
    res.status(500).json({ 
      error: "Erreur interne du serveur",
      message: err.message 
    });
  });

  const PORT = parseInt(process.env.PORT || "5000");
  server.listen(PORT, "0.0.0.0", () => {
    log(`serving on port ${PORT}`, "express");
  });
})();