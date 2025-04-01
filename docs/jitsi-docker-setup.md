# Installation de Jitsi Meet avec Docker pour auto-hébergement

Ce guide explique comment installer et configurer un serveur Jitsi Meet auto-hébergé en utilisant Docker. Cette approche est plus simple que l'installation manuelle et permet de déployer facilement Jitsi Meet sur un VPS.

## Prérequis

- Un VPS avec au moins 4 Go de RAM et 2 cœurs CPU
- Docker et Docker Compose installés
- Un nom de domaine configuré pour pointer vers l'adresse IP du VPS (ex: jitsi.rony.app)
- Ports 80, 443, 4443, 10000/udp ouverts sur le pare-feu

## Étape 1: Préparation du système

Commencez par mettre à jour le système et installer Docker :

```bash
# Mettre à jour le système
sudo apt update
sudo apt upgrade -y

# Installer les prérequis
sudo apt install -y apt-transport-https ca-certificates curl software-properties-common gnupg

# Ajouter la clé GPG de Docker
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo apt-key add -

# Ajouter le dépôt Docker
sudo add-apt-repository "deb [arch=amd64] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable"

# Installer Docker et Docker Compose
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io
sudo curl -L "https://github.com/docker/compose/releases/download/v2.18.1/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Ajouter votre utilisateur au groupe docker
sudo usermod -aG docker $USER
```

Déconnectez-vous et reconnectez-vous pour que les changements de groupe prennent effet.

## Étape 2: Préparer l'environnement Jitsi

Créez un répertoire pour le projet et accédez-y :

```bash
mkdir -p ~/jitsi-meet-docker
cd ~/jitsi-meet-docker
```

## Étape 3: Créer le fichier .env

Créez un fichier `.env` avec les variables d'environnement nécessaires :

```bash
nano .env
```

Ajoutez le contenu suivant (remplacez les valeurs selon vos besoins) :

```
# Domaine Jitsi Meet
DOCKER_HOST_ADDRESS=jitsi.rony.app
PUBLIC_URL=https://jitsi.rony.app

# Configuration SSL
ENABLE_LETSENCRYPT=1
LETSENCRYPT_DOMAIN=jitsi.rony.app
LETSENCRYPT_EMAIL=admin@rony.app

# Configuration de sécurité
ENABLE_AUTH=1
ENABLE_GUESTS=1
AUTH_TYPE=jwt
JWT_APP_ID=rony_app
JWT_APP_SECRET=rony_secure_jitsi_jwt_secret

# Jicofo - Désactiver la limitation de 5 minutes
JICOFO_ENABLE_AUTO_OWNER=true
JICOFO_DISABLE_AUTO_OWNER=false
JICOFO_CONF_DURATION_NO_OWNER=0
JICOFO_AUTH_LIFETIME=0

# Jitsi - Configuration du videobridge
JVB_TCP_HARVESTER_DISABLED=false
JVB_TCP_PORT=4443
JVB_TCP_MAPPED_PORT=4443
JVB_STUN_SERVERS=stun.l.google.com:19302,stun1.l.google.com:19302
JVB_ENABLE_STATISTICS=true

# Configuration TURN
TURN_HOST=turn.rony.app
TURN_PORT=443
TURN_TRANSPORT=tcp
TURN_USERNAME=ronyuser
TURN_PASSWORD=ronypassword
TURN_CREDENTIALS=ronyuser:ronypassword

# Configuration globale
TZ=Europe/Paris
```

## Étape 4: Créer le fichier docker-compose.yml

Créez un fichier `docker-compose.yml` :

```bash
nano docker-compose.yml
```

Ajoutez le contenu suivant :

```yaml
version: '3'

services:
  # Frontend
  web:
    image: jitsi/web:latest
    restart: unless-stopped
    ports:
      - '80:80'
      - '443:443'
    volumes:
      - ${CONFIG}/web:/config
      - ${CONFIG}/web/letsencrypt:/etc/letsencrypt
      - ${CONFIG}/transcripts:/usr/share/jitsi-meet/transcripts
    environment:
      - ENABLE_AUTH
      - ENABLE_GUESTS
      - AUTH_TYPE
      - JWT_APP_ID
      - JWT_APP_SECRET
      - ENABLE_LETSENCRYPT
      - LETSENCRYPT_DOMAIN
      - LETSENCRYPT_EMAIL
      - PUBLIC_URL
      - TZ
      - DISABLE_HTTPS=0
      - JICOFO_AUTH_LIFETIME
      - DISABLE_DEEP_LINKING=false
      - ENABLE_WELCOME_PAGE=true
      - DISABLE_SESSION_EXPIRE=true
    networks:
      meet.jitsi:
        aliases:
          - ${DOCKER_HOST_ADDRESS}

  # XMPP server
  prosody:
    image: jitsi/prosody:latest
    restart: unless-stopped
    expose:
      - '5222'
      - '5280'
      - '5347'
    volumes:
      - ${CONFIG}/prosody/config:/config
      - ${CONFIG}/prosody/prosody-plugins-custom:/prosody-plugins-custom
    environment:
      - AUTH_TYPE
      - JWT_APP_ID
      - JWT_APP_SECRET
      - JICOFO_AUTH_LIFETIME
      - ENABLE_AUTH
      - ENABLE_GUESTS
      - TZ
    networks:
      meet.jitsi:
        aliases:
          - ${XMPP_SERVER}

  # Focus component
  jicofo:
    image: jitsi/jicofo:latest
    restart: unless-stopped
    volumes:
      - ${CONFIG}/jicofo:/config
    environment:
      - AUTH_TYPE
      - ENABLE_AUTH
      - JICOFO_ENABLE_AUTO_OWNER
      - JICOFO_DISABLE_AUTO_OWNER
      - JICOFO_CONF_DURATION_NO_OWNER
      - JICOFO_AUTH_LIFETIME
      - TZ
    depends_on:
      - prosody
    networks:
      meet.jitsi:

  # Video bridge
  jvb:
    image: jitsi/jvb:latest
    restart: unless-stopped
    ports:
      - '${JVB_PORT}:${JVB_PORT}/udp'
      - '${JVB_TCP_PORT}:${JVB_TCP_PORT}'
    volumes:
      - ${CONFIG}/jvb:/config
    environment:
      - JVB_AUTH_PASSWORD
      - JVB_PORT
      - JVB_TCP_HARVESTER_DISABLED
      - JVB_TCP_PORT
      - JVB_TCP_MAPPED_PORT
      - JVB_STUN_SERVERS
      - JVB_ENABLE_STATISTICS
      - JVB_REMB_AVERAGING_WINDOW_SIZE=10
      - TZ
    depends_on:
      - prosody
    networks:
      meet.jitsi:

  # TURN server
  coturn:
    image: coturn/coturn:latest
    restart: unless-stopped
    ports:
      - '3478:3478'
      - '3478:3478/udp'
      - '5349:5349'
      - '5349:5349/udp'
    volumes:
      - ${CONFIG}/coturn:/etc/coturn
    command: >
      -n --log-file=stdout
      --realm=${TURN_HOST}
      --listening-port=3478
      --tls-listening-port=5349
      --fingerprint
      --lt-cred-mech
      --static-auth-secret=${TURN_PASSWORD}
      --no-multicast-peers
      --min-port=10000
      --max-port=20000
      --user=${TURN_CREDENTIALS}
    networks:
      meet.jitsi:

networks:
  meet.jitsi:
```

## Étape 5: Créer les répertoires de configuration

```bash
export CONFIG=~/.jitsi-meet-cfg
mkdir -p $CONFIG/{web,prosody,jicofo,jvb,coturn}
```

## Étape 6: Lancer les conteneurs

```bash
docker-compose up -d
```

## Étape 7: Personnaliser la configuration pour désactiver la limite de 5 minutes

Pour désactiver complètement la limitation de 5 minutes, modifiez la configuration de Prosody :

```bash
nano $CONFIG/prosody/config/conf.d/jitsi-meet.cfg.lua
```

Ajoutez les lignes suivantes dans la section VirtualHost de votre domaine :

```lua
unlimited_jids = { "focus@auth.jitsi.rony.app" }
token_allow_empty = true
allow_empty_token = true
```

Modifiez également la configuration de Jicofo :

```bash
nano $CONFIG/jicofo/jicofo.conf
```

Ajoutez les paramètres suivants :

```hocon
jicofo {
  conference {
    enable-auto-owner = true
    disable-auto-owner = false
    max-ssrcs-per-user = 100
    max-duration-with-no-owner = 0
  }
  auth {
    lifetime = 0
  }
}
```

## Étape 8: Redémarrer les services

```bash
docker-compose restart prosody jicofo
```

## Étape 9: Vérifiez l'installation

Accédez à votre domaine dans un navigateur (https://jitsi.rony.app) et vérifiez que tout fonctionne correctement.

## Configuration de l'application Rony

Pour que votre application Rony utilise ce serveur auto-hébergé, configurez les variables d'environnement suivantes dans votre application :

```
JITSI_DOMAIN=jitsi.rony.app
JITSI_JWT_SECRET=rony_secure_jitsi_jwt_secret
TURN_SERVER_URL=turn:turn.rony.app:443?transport=tcp
TURN_USERNAME=ronyuser
TURN_CREDENTIAL=ronypassword
```

## Maintenance

- Pour mettre à jour les conteneurs avec les dernières versions :
  ```bash
  docker-compose pull
  docker-compose up -d
  ```

- Pour afficher les journaux :
  ```bash
  docker-compose logs -f
  ```

- Pour afficher les journaux d'un service spécifique :
  ```bash
  docker-compose logs -f jicofo
  ```

## Dépannage

1. **Problèmes de certificat SSL** : Vérifiez que les paramètres Let's Encrypt sont corrects
2. **Problèmes de connexion** : Vérifiez les journaux des conteneurs avec `docker-compose logs`
3. **Problèmes d'authentification JWT** : Assurez-vous que `JWT_APP_SECRET` est le même dans tous les services
4. **Problèmes de connexion après 5 minutes** : Vérifiez que les paramètres Jicofo concernant l'auto-owner sont bien configurés

## Conclusion

Votre installation Jitsi Meet avec Docker est maintenant configurée pour permettre des réunions de durée illimitée sans la restriction de 5 minutes pour les réunions publiques. Toutes les communications passent par votre propre serveur TURN, ce qui améliore la confidentialité et la fiabilité des connexions.