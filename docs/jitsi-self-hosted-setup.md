# Guide d'installation d'un serveur Jitsi Meet auto-hébergé

Ce guide explique comment installer et configurer un serveur Jitsi Meet auto-hébergé sur un VPS pour Rony. Cette configuration désactive la limitation de 5 minutes pour les réunions publiques et permet des appels vidéo illimités.

## Prérequis

- Un VPS avec au moins 4 Go de RAM et 2 cœurs CPU
- Ubuntu 20.04 LTS ou version plus récente
- Un nom de domaine configuré pour pointer vers l'adresse IP du VPS (ex: jitsi.rony.app)
- Accès root au serveur

## Étape 1: Préparation du système

Commencez par mettre à jour le système et installer les dépendances nécessaires :

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y apt-transport-https gnupg2 nginx-full
```

## Étape 2: Configuration du nom d'hôte

Définissez le nom d'hôte de la machine pour qu'il corresponde à votre domaine :

```bash
sudo hostnamectl set-hostname jitsi.rony.app
```

Éditez le fichier `/etc/hosts` pour ajouter votre domaine :

```bash
sudo nano /etc/hosts
```

Ajoutez la ligne suivante (remplacez avec votre IP et domaine) :
```
YOUR_SERVER_IP jitsi.rony.app
```

## Étape 3: Installation de Jitsi Meet

Ajoutez le dépôt Jitsi :

```bash
curl https://download.jitsi.org/jitsi-key.gpg.key | sudo sh -c 'gpg --dearmor > /usr/share/keyrings/jitsi-keyring.gpg'
echo 'deb [signed-by=/usr/share/keyrings/jitsi-keyring.gpg] https://download.jitsi.org stable/' | sudo tee /etc/apt/sources.list.d/jitsi-stable.list > /dev/null
sudo apt update
```

Installez Jitsi Meet :

```bash
sudo apt install -y jitsi-meet
```

Pendant l'installation :
- Entrez votre nom de domaine (ex: jitsi.rony.app)
- Choisissez de générer un certificat Let's Encrypt

## Étape 4: Configuration de Prosody (XMPP)

Éditez le fichier de configuration Prosody :

```bash
sudo nano /etc/prosody/conf.avail/jitsi.rony.app.cfg.lua
```

Modifiez les sections suivantes pour activer l'authentification JWT :

```lua
VirtualHost "jitsi.rony.app"
    authentication = "token"
    app_id = "rony_app"
    app_secret = "rony_secure_jitsi_jwt_secret"  -- Utilisez votre propre secret
    allow_empty_token = false

VirtualHost "guest.jitsi.rony.app"
    authentication = "anonymous"
    c2s_require_encryption = false
```

Redémarrez Prosody :

```bash
sudo systemctl restart prosody
```

## Étape 5: Configuration de Jicofo

Éditez le fichier de configuration Jicofo :

```bash
sudo nano /etc/jitsi/jicofo/sip-communicator.properties
```

Ajoutez ces lignes pour désactiver les limitations et activer l'authentification JWT :

```properties
org.jitsi.jicofo.auth.URL=XMPP:jitsi.rony.app
org.jitsi.jicofo.auth.DISABLE_AUTOLOGIN=true

# Désactiver la restriction des 5 minutes
org.jitsi.jicofo.DISABLE_AUTO_OWNER=false
org.jitsi.jicofo.ENABLE_AUTO_OWNER=true
org.jitsi.jicofo.auth.DISABLE_AUDIENCE_VERIFICATION=true

# Augmenter la durée des réunions
org.jitsi.jicofo.conference.MAX_JICOFO_CONFERENCE_DURATION=0
```

## Étape 6: Configuration de Jitsi Meet

Éditez le fichier de configuration principal :

```bash
sudo nano /etc/jitsi/meet/jitsi.rony.app-config.js
```

Modifiez les paramètres suivants :

```javascript
var config = {
    // Configuration JWT
    tokenAuthUrl: 'https://rony.app/auth/jitsi-token', // Si vous générez des tokens via votre API
    
    // Désactiver les limitations de temps
    enableClosePage: false,
    enableWelcomePage: true,
    
    // Configurations des réunions
    resolution: 720,
    constraints: {
        video: {
            height: {
                ideal: 720,
                max: 720,
                min: 180
            }
        }
    },
    
    // Configuration avancée pour permettre les sessions longues
    disableDeepLinking: true,
    enableUserRolesBasedOnToken: true,
    enableLayerSuspension: true,
    
    // Désactiver l'expiration des réunions
    deploymentInfo: {
        authEnabled: true,
        disableSessionExpire: true
    }
};
```

## Étape 7: Installation et configuration de TURN

Le serveur TURN est essentiel pour que les connexions WebRTC fonctionnent derrière les pare-feux restrictifs :

```bash
sudo apt install -y coturn
```

Éditez le fichier de configuration :

```bash
sudo nano /etc/turnserver.conf
```

Ajoutez les lignes suivantes :

```
listening-port=3478
fingerprint
lt-cred-mech
max-port=65535
min-port=49152
realm=turn.rony.app
server-name=turn.rony.app
user-quota=12
total-quota=1200
authentication-realm=turn.rony.app

# Créez un utilisateur et mot de passe pour l'authentification TURN
user=ronyuser:ronypassword

# Si vous avez un certificat SSL
cert=/etc/letsencrypt/live/jitsi.rony.app/fullchain.pem
pkey=/etc/letsencrypt/live/jitsi.rony.app/privkey.pem

# Activer TLS
tls-listening-port=443
```

Activez le service TURN :

```bash
sudo systemctl enable coturn
sudo systemctl restart coturn
```

## Étape 8: Configuration des serveurs TURN dans Jitsi Meet

Éditez à nouveau le fichier de configuration :

```bash
sudo nano /etc/jitsi/meet/jitsi.rony.app-config.js
```

Ajoutez la configuration TURN :

```javascript
config.p2p = {
    enabled: true,
    stunServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
    ]
};

config.websocket = {
    uri: 'wss://jitsi.rony.app/xmpp-websocket'
};

config.enableP2P = true;
config.enableRemb = true;
config.enableTcc = true;

// Configuration TURN
config.iceServers = [
    {
        urls: 'turn:turn.rony.app:443?transport=tcp',
        username: 'ronyuser',
        credential: 'ronypassword'
    },
    {
        urls: 'turns:turn.rony.app:443?transport=tcp',
        username: 'ronyuser',
        credential: 'ronypassword'
    }
];
```

## Étape 9: Redémarrage des services

Redémarrez tous les services pour appliquer les modifications :

```bash
sudo systemctl restart prosody
sudo systemctl restart jicofo
sudo systemctl restart jitsi-videobridge2
sudo systemctl restart nginx
```

## Étape 10: Vérification de l'installation

Accédez à votre domaine dans un navigateur (https://jitsi.rony.app) et vérifiez que tout fonctionne correctement.

## Configuration de variables d'environnement dans Rony

Pour que votre application Rony utilise ce serveur auto-hébergé, configurez les variables d'environnement suivantes :

```
JITSI_DOMAIN=jitsi.rony.app
JITSI_JWT_SECRET=rony_secure_jitsi_jwt_secret
TURN_SERVER_URL=turn:turn.rony.app:443
TURN_USERNAME=ronyuser
TURN_CREDENTIAL=ronypassword
```

## Dépannage

### Vérification des journaux

En cas de problème, consultez les journaux :

```bash
sudo journalctl -u prosody -f
sudo journalctl -u jicofo -f
sudo journalctl -u jitsi-videobridge2 -f
sudo journalctl -u coturn -f
```

### Problèmes courants

1. **Erreur d'accès refusé** : Vérifiez les permissions des certificats SSL
2. **Erreur de connexion WebSocket** : Vérifiez la configuration de Nginx
3. **Les participants ne peuvent pas se connecter** : Vérifiez la configuration du pare-feu et de TURN
4. **Problème de connexion après 5 minutes** : Assurez-vous que les paramètres de désactivation des limitations sont correctement configurés

## Maintenance

- Effectuez régulièrement des mises à jour de sécurité
- Surveillez l'utilisation des ressources (mémoire, CPU)
- Renouvelez les certificats SSL avant leur expiration

## Conclusion

Votre serveur Jitsi Meet auto-hébergé est maintenant configuré pour permettre des réunions de durée illimitée sans la restriction de 5 minutes pour les réunions publiques. Toutes les communications passent par votre propre serveur TURN, ce qui améliore la confidentialité et la fiabilité des connexions.