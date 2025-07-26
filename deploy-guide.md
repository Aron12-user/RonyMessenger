# Guide de Déploiement Google Cloud Run

## 🚀 Guide étape par étape pour déployer Rony sur Google Cloud Run

### Étape 1: Préparation du projet Google Cloud

1. **Créer un projet GCP** (si pas déjà fait)
   ```bash
   gcloud projects create votre-projet-rony --name="Rony App"
   gcloud config set project votre-projet-rony
   ```

2. **Activer les APIs nécessaires**
   ```bash
   gcloud services enable run.googleapis.com
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable containerregistry.googleapis.com
   gcloud services enable sqladmin.googleapis.com
   ```

3. **Configurer la facturation** (obligatoire)
   - Aller sur console.cloud.google.com
   - Activer la facturation pour le projet

### Étape 2: Configuration de la base de données (Cloud SQL)

1. **Créer une instance PostgreSQL**
   ```bash
   gcloud sql instances create rony-db \
     --database-version=POSTGRES_14 \
     --tier=db-f1-micro \
     --region=europe-west1
   ```

2. **Créer la base de données**
   ```bash
   gcloud sql databases create rony --instance=rony-db
   ```

3. **Créer un utilisateur**
   ```bash
   gcloud sql users create rony-user \
     --instance=rony-db \
     --password=VotreMotDePasseSecurise
   ```

### Étape 3: Déploiement depuis GitHub

#### Option A: Déploiement automatique (Recommandé)

1. **Pousser le code sur GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/votre-username/rony.git
   git push -u origin main
   ```

2. **Configurer les secrets GitHub**
   Dans les paramètres de votre repository GitHub :
   - `GCP_PROJECT_ID`: votre-projet-rony
   - `GCP_SA_KEY`: clé JSON du service account
   - `SESSION_SECRET`: clé secrète pour les sessions
   - `DATABASE_URL`: URL de connexion PostgreSQL

3. **Le déploiement se fera automatiquement** à chaque push sur main

#### Option B: Déploiement manuel

1. **Déploiement direct depuis le repository**
   ```bash
   gcloud run deploy rony-app \
     --source=https://github.com/votre-username/rony \
     --region=europe-west1 \
     --allow-unauthenticated \
     --set-env-vars="NODE_ENV=production,PORT=5000" \
     --set-secrets="SESSION_SECRET=session-secret:latest,DATABASE_URL=database-url:latest"
   ```

### Étape 4: Configuration des variables d'environnement

1. **Créer les secrets**
   ```bash
   # Secret pour la session
   echo "votre-secret-session-ultra-securise" | gcloud secrets create session-secret --data-file=-
   
   # Secret pour la base de données
   echo "postgresql://rony-user:VotreMotDePasseSecurise@/rony?host=/cloudsql/votre-projet-rony:europe-west1:rony-db" | gcloud secrets create database-url --data-file=-
   ```

2. **Configurer le service Cloud Run**
   ```bash
   gcloud run services update rony-app \
     --region=europe-west1 \
     --set-env-vars="NODE_ENV=production,PORT=5000" \
     --set-secrets="SESSION_SECRET=session-secret:latest,DATABASE_URL=database-url:latest"
   ```

### Étape 5: Configuration du domaine personnalisé (optionnel)

1. **Mapper un domaine**
   ```bash
   gcloud run domain-mappings create \
     --service=rony-app \
     --domain=votre-domaine.com \
     --region=europe-west1
   ```

### Étape 6: Monitoring et logs

1. **Voir les logs en temps réel**
   ```bash
   gcloud run services logs tail rony-app --region=europe-west1
   ```

2. **Monitoring dans la console**
   - Aller sur console.cloud.google.com
   - Cloud Run > rony-app > Métriques

### Étape 7: Mise à jour de l'application

1. **Avec GitHub Actions** (automatique)
   - Pousser le code sur main
   - Le déploiement se fait automatiquement

2. **Déploiement manuel**
   ```bash
   gcloud run deploy rony-app \
     --source . \
     --region=europe-west1
   ```

## 🔧 Dépannage

### Problèmes courants

1. **Erreur de build**
   ```bash
   # Vérifier les logs de build
   gcloud builds list --limit=5
   gcloud builds log BUILD_ID
   ```

2. **Problème de base de données**
   ```bash
   # Tester la connexion
   gcloud sql connect rony-db --user=rony-user
   ```

3. **Variables d'environnement**
   ```bash
   # Vérifier la configuration
   gcloud run services describe rony-app --region=europe-west1
   ```

## 💰 Estimation des coûts

- **Cloud Run**: ~5-10€/mois (pour un usage modéré)
- **Cloud SQL**: ~15-25€/mois (instance f1-micro)
- **Stockage**: ~1-2€/mois
- **Réseau**: ~1-3€/mois

**Total estimé**: 22-40€/mois pour une utilisation normale

## 🔒 Sécurité

- ✅ HTTPS automatique
- ✅ Secrets gérés par Google Secret Manager
- ✅ Base de données isolée
- ✅ Authentification IAM
- ✅ Logs sécurisés

## 📞 Support

En cas de problème :
1. Vérifier les logs Cloud Run
2. Tester les endpoints `/api/health` et `/api/ready`
3. Vérifier la configuration des secrets
4. Consulter la documentation Google Cloud Run