import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { runMigrations, seedDatabase } from './db';
import { createTables } from './create-tables';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { db } from './db';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configuration de session avec stockage PostgreSQL
const PgSession = connectPgSimple(session);
app.use(session({
  store: new PgSession({
    conObject: {
      connectionString: process.env.DATABASE_URL,
    },
    createTableIfMissing: true
  }),
  secret: process.env.SESSION_SECRET || 'rony_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: process.env.NODE_ENV === 'production', 
    maxAge: 24 * 60 * 60 * 1000 // 1 jour
  }
}));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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

(async () => {
  // Exécuter les migrations de base de données
  try {
    const migrationsOk = await runMigrations();
    if (migrationsOk) {
      log('Migrations de base de données réussies', 'database');

      // Créer les tables manquantes
      const tablesOk = await createTables();
      if (tablesOk) {
        log('Création des tables réussie', 'database');
      } else {
        log('Échec de la création des tables', 'database');
      }

      // Initialiser les données de test si besoin
      const seedOk = await seedDatabase();
      if (seedOk) {
        log('Initialisation des données réussie', 'database');
      } else {
        log('Échec de l\'initialisation des données', 'database');
      }
    } else {
      log('Échec des migrations de base de données', 'database');
    }
  } catch (error) {
    log(`Erreur lors de l'initialisation de la base de données: ${error}`, 'database');
  }

  // Définir les routes API AVANT de configurer Vite
  // afin que les routes API ne soient pas interceptées par le middleware de Vite
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Important: Vite est configuré après les routes API
  // pour que son middleware catch-all n'interfère pas avec les routes API
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);

  // Fonction pour démarrer le serveur avec gestion d'erreur améliorée
  const startServer = () => {
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`serving on port ${port}`);
    }).on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        log(`Port ${port} is already in use. Server may already be running.`);
        // Arrêter le processus proprement au lieu de redémarrer
        process.exit(0);
      } else {
        log(`Server error: ${err.message}`);
        throw err;
      }
    });
  };

  startServer();
})();
