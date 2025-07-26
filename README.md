# Rony - Plateforme de Communication Moderne

Une plateforme de collaboration cloud complète qui intègre des outils de communication avancés, de gestion de documents et de productivité.

## 🚀 Déploiement sur Google Cloud Run

Cette application est optimisée pour le déploiement sur Google Cloud Run via GitHub Actions.

### Prérequis

1. **Compte Google Cloud Platform** avec facturation activée
2. **Projet GCP** configuré
3. **APIs activées** :
   - Cloud Run API
   - Cloud Build API
   - Container Registry API
   - Cloud SQL API (optionnel)

### Configuration pour le déploiement

#### 1. Variables d'environnement requises

Configurez ces variables dans Google Cloud Run :

```bash
NODE_ENV=production
PORT=8080
SESSION_SECRET=your-secure-session-secret
DATABASE_URL=postgresql://user:password@host:port/database
```

#### 2. Déploiement automatique depuis GitHub

1. **Connecter le repository GitHub** :
   ```bash
   gcloud run deploy rony-app \
     --source=https://github.com/votre-username/rony \
     --region=europe-west1 \
     --allow-unauthenticated
   ```

2. **Ou utiliser Cloud Build** avec le fichier `cloudbuild.yaml` inclus

#### 3. Déploiement manuel

```bash
# Build local
npm run build

# Déploiement direct
gcloud run deploy rony-app \
  --source . \
  --region=europe-west1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --max-instances=10
```

## 🏗️ Architecture

### Technologies
- **Frontend**: React + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript  
- **Base de données**: PostgreSQL
- **ORM**: Drizzle ORM
- **Temps réel**: WebSocket
- **Build**: Vite + esbuild

### Structure du projet
```
/
├── client/               # Frontend React
├── server/               # Backend Express
├── shared/               # Types partagés
├── uploads/              # Fichiers uploadés
├── Dockerfile           # Configuration Docker
├── cloudbuild.yaml      # Configuration Cloud Build
└── app.yaml            # Configuration App Engine
```

## 🔧 Développement local

```bash
# Installation des dépendances
npm install

# Démarrage en mode développement
npm run dev

# Build de production
npm run build

# Démarrage en production
npm start
```

## 📋 Health Checks

L'application expose deux endpoints pour les vérifications de santé :

- `/api/health` - Vérification de l'état général
- `/api/ready` - Vérification de disponibilité des services

## 🔒 Sécurité

- Sessions sécurisées avec cookies HTTPOnly
- Protection CORS configurée
- Validation des données avec Zod
- Upload de fichiers sécurisé avec Multer
- Variables d'environnement pour les secrets

## 📈 Monitoring

L'application est configurée pour fonctionner avec :
- Cloud Logging (logs structurés en JSON)
- Cloud Monitoring (métriques automatiques)
- Cloud Trace (tracing des requêtes)

## 🌍 Variables d'environnement

Voir `.env.example` pour la liste complète des variables configurables.

## 📖 Documentation API

Les endpoints principaux :
- `/api/auth/*` - Authentification
- `/api/messages/*` - Messagerie
- `/api/files/*` - Gestion des fichiers
- `/api/groups/*` - Groupes de conversation
- `/api/events/*` - Planification d'événements

## 🤝 Contribution

1. Fork le projet
2. Créer une branche feature
3. Commit les changements
4. Push vers la branche
5. Ouvrir une Pull Request

## 📄 Licence

MIT License - voir le fichier LICENSE pour plus de détails.