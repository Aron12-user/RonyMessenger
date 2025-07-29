# Dockerfile multi-stage pour Google Cloud Run
FROM node:20-alpine AS base

# Installer les dépendances système nécessaires
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Copier les fichiers de configuration
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./

# Installer les dépendances
RUN npm ci --only=production && npm cache clean --force

# Stage de build
FROM base AS build

# Installer toutes les dépendances (dev incluses)
RUN npm ci

# Copier le code source
COPY . .

# Build de l'application
RUN npm run build

# Stage de production
FROM node:20-alpine AS production

WORKDIR /app

# Créer un utilisateur non-root pour la sécurité
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copier les dépendances de production
COPY --from=base /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/uploads ./uploads

# Copier les fichiers de configuration nécessaires
COPY package*.json ./
COPY drizzle.config.ts ./

# Créer le dossier uploads et donner les permissions
RUN mkdir -p uploads && chown -R nextjs:nodejs uploads
RUN chown -R nextjs:nodejs /app

# Utiliser l'utilisateur non-root
USER nextjs

# Exposer le port
EXPOSE 8080

# Variables d'environnement par défaut
ENV NODE_ENV=production
ENV PORT=8080

# Commande de démarrage
CMD ["node", "dist/index.js"]
