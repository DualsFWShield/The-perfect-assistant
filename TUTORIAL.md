# Tutoriel d'Installation et d'Utilisation
# Assistant Personnel ZeroConfig

Ce tutoriel vous guidera pas à pas dans l'installation, la configuration et l'utilisation de votre Assistant Personnel ZeroConfig.

## Table des matières

1. [Prérequis](#1-prérequis)
2. [Installation](#2-installation)
   - [Installation sur Windows](#21-installation-sur-windows)
   - [Installation sur Linux/Mac](#22-installation-sur-linuxmac)
   - [Choix de la plateforme de déploiement](#23-choix-de-la-plateforme-de-déploiement)
3. [Configuration](#3-configuration)
   - [Configuration de Google API](#31-configuration-de-google-api)
   - [Configuration de Google Apps Script](#32-configuration-de-google-apps-script)
   - [Configuration de Firebase](#33-configuration-de-firebase) (Option 1)
   - [Configuration de Cloudflare Workers](#34-configuration-de-cloudflare-workers) (Option 2)
4. [Utilisation de l'Assistant](#4-utilisation-de-lassistant)
   - [Commandes vocales](#41-commandes-vocales)
   - [Gestion des emails](#42-gestion-des-emails)
   - [Gestion du calendrier](#43-gestion-du-calendrier)
5. [Personnalisation](#5-personnalisation)
6. [Dépannage](#6-dépannage)

---

## 1. Prérequis

Avant de commencer, assurez-vous d'avoir :

- Un compte Google (Gmail/Google Workspace)
- Un compte Firebase (tier gratuit suffisant) OU un compte Cloudflare (tier gratuit suffisant)
- Node.js et npm installés sur votre machine
- Un navigateur compatible avec la Web Speech API (Chrome, Edge)
- Une clé API Gemini (obtenue sur https://ai.google.dev/)

## 2. Installation

### 2.1 Installation sur Windows

1. **Téléchargez les fichiers source** ou clonez le dépôt :
   ```
   git clone https://github.com/votre-nom/personal-assistant-zeroconfig.git
   cd personal-assistant-zeroconfig
   ```

2. **Exécutez le script d'installation Windows** (deux options) :
   
   Option 1 - Script Batch :
   ```
   setup.bat
   ```
   
   Option 2 - Script PowerShell (recommandé) :
   ```
   powershell -ExecutionPolicy Bypass -File setup.ps1
   ```

3. **Suivez les instructions à l'écran** pour choisir votre plateforme de déploiement et vous connecter.

### 2.2 Installation sur Linux/Mac

1. **Téléchargez les fichiers source** ou clonez le dépôt :
   ```bash
   git clone https://github.com/votre-nom/personal-assistant-zeroconfig.git
   cd personal-assistant-zeroconfig
   ```

2. **Rendez le script exécutable et lancez-le** :
   ```bash
   chmod +x setup.sh
   ./setup.sh
   ```

3. **Suivez les instructions à l'écran** pour choisir votre plateforme de déploiement et vous connecter.

### 2.3 Choix de la plateforme de déploiement

Lors de l'installation, vous devrez choisir entre deux options de déploiement :

#### Option 1: Firebase (recommandé pour les débutants)
- **Avantages** : 
  - Domaine gratuit inclus (*.web.app ou *.firebaseapp.com)
  - Interface utilisateur simple pour la gestion
  - Compatible avec Firestore pour le stockage
  - Fonctionne parfaitement sur Windows

#### Option 2: Cloudflare Workers
- **Avantages** :
  - Performances supérieures 
  - Présence mondiale sur plus de 200 emplacements
  - Meilleure gestion des limites de requêtes

## 3. Configuration

### 3.1 Configuration de Google API

1. **Créez un projet Google Cloud** :
   - Rendez-vous sur [Google Cloud Console](https://console.cloud.google.com/)
   - Créez un nouveau projet
   
   ![Google Cloud New Project](images/tutorial/gcp_new_project.png)

2. **Activez les APIs nécessaires** :
   - Google Sheets API
   - Gmail API
   - Google Calendar API
   - Identity Services API
   
   ![Enable APIs](images/tutorial/enable_apis.png)

3. **Configurez l'écran de consentement OAuth** :
   - Type : Externe
   - Remplissez les informations obligatoires (nom, email)
   - Ajoutez votre email comme utilisateur de test
   
   ![OAuth Consent](images/tutorial/oauth_consent.png)

4. **Créez des identifiants OAuth** :
   - Type d'application : Application Web
   - Nom : "Assistant Personnel ZeroConfig"
   - Origines JavaScript autorisées : `https://votre-projet.web.app` ou votre domaine Cloudflare
   - URI de redirection : `https://votre-projet.web.app/auth_callback.html` ou équivalent Cloudflare
   
   ![Create Credentials](images/tutorial/create_credentials.png)

5. **Obtenez une clé API Gemini** :
   - Rendez-vous sur [Google AI Studio](https://ai.google.dev/)
   - Créez une clé API dans la section "API Keys"
   - Notez cette clé pour la configuration ultérieure

### 3.2 Configuration de Google Apps Script

1. **Créez un nouveau projet Google Apps Script** :
   - Rendez-vous sur [Google Apps Script](https://script.google.com/home)
   - Créez un nouveau projet
   
   ![Apps Script New](images/tutorial/apps_script_new.png)

2. **Copiez le code du script** :
   - Copiez le contenu du fichier `src/integrations/google-apps-script/sync.gs`
   - Collez-le dans l'éditeur de script
   
   ![Copy Script](images/tutorial/copy_script.png)

3. **Créez une feuille Google Sheets** :
   - Créez une nouvelle feuille Google Sheets
   - Notez l'ID dans l'URL (`https://docs.google.com/spreadsheets/d/ID_FEUILLE/edit`)
   - Mettez cet ID dans la constante `SPREADSHEET_ID` du script

4. **Déployez le script** :
   - Cliquez sur "Déployer" > "Nouvelle déploiement"
   - Type : Application Web
   - Exécuter en tant que : Moi-même
   - Personnes ayant accès : Uniquement moi
   
   ![Deploy Script](images/tutorial/deploy_script.png)

5. **Configurez les autorisations** :
   - Accordez les autorisations demandées lors de la première exécution
   
   ![Grant Permissions](images/tutorial/grant_permissions.png)

6. **Copiez l'URL du déploiement** :
   - Vous en aurez besoin pour configurer le webhook

### 3.3 Configuration de Firebase (Option 1)

Si vous avez choisi Firebase comme plateforme de déploiement :

1. **Créez un projet Firebase** :
   - Rendez-vous sur [Firebase Console](https://console.firebase.google.com/)
   - Cliquez sur "Ajouter un projet"
   - Suivez les étapes pour créer votre projet
   - Activez Firestore et Storage quand demandé

2. **Configurez les variables d'environnement Firebase** :
   ```bash
   firebase functions:config:set assistant.gemini_api_key="VOTRE_CLE_API" assistant.allowed_user_email="votre-email@gmail.com"
   ```

3. **Vérifiez votre URL de déploiement** :
   - Vos fonctions sont disponibles sur `https://votre-projet.web.app/api/...`
   - L'interface utilisateur est sur `https://votre-projet.web.app`

4. **Configurez Firestore** :
   - Dans la console Firebase, allez dans "Firestore Database"
   - Créez une collection "config" avec un document "allowed_user"
   - Ajoutez un champ "email" avec votre adresse email autorisée
   
   ![Firestore Config](images/tutorial/firestore_config.png)

5. **Modifiez le fichier auth-component.js** :
   - Ouvrez `src/frontend/components/auth-component.js`
   - Remplacez l'ID client OAuth par celui que vous avez obtenu :
   ```javascript
   const clientId = 'VOTRE_ID_CLIENT_OAUTH';
   ```

6. **Modifiez le fichier voice-assistant.js** :
   - Ouvrez `src/frontend/components/voice-assistant.js`
   - Mettez à jour l'URL de l'API pour qu'elle pointe vers votre domaine Firebase :
   ```javascript
   const response = await fetch('https://votre-projet.web.app/api/voice-command', {
     // reste du code...
   });
   ```

### 3.4 Configuration de Cloudflare Workers (Option 2)

Si vous avez choisi Cloudflare Workers comme plateforme de déploiement :

1. **Configurez les variables secrètes** :
   ```bash
   wrangler secret put ASSISTANT_CONFIG
   ```
   Puis entrez un JSON au format :
   ```json
   {
     "GEMINI_API_KEY": "votre-clé-api-gemini",
     "SHEETS_API_KEY": "votre-clé-api-sheets",
     "ALLOWED_ORIGIN": "https://votre-domaine.com",
     "ALLOWED_USER_EMAIL": "votre-email@gmail.com"
   }
   ```

2. **Obtenez votre sous-domaine workers.dev gratuit** :
   - Votre API sera accessible sur `https://personal-assistant.votre-compte.workers.dev`
   - Pour un domaine personnalisé, suivez les instructions de Cloudflare pour configurer les routes

3. **Modifiez le fichier auth-component.js** :
   - Ouvrez `src/frontend/components/auth-component.js`
   - Remplacez l'ID client OAuth par celui que vous avez obtenu :
   ```javascript
   const clientId = 'VOTRE_ID_CLIENT_OAUTH';
   ```

4. **Modifiez le fichier voice-assistant.js** :
   - Ouvrez `src/frontend/components/voice-assistant.js`
   - Mettez à jour l'URL de l'API pour qu'elle pointe vers votre Worker Cloudflare :
   ```javascript
   const response = await fetch('https://personal-assistant.votre-compte.workers.dev/api/voice-command', {
     // reste du code...
   });
   ```

## 4. Utilisation de l'Assistant

### 4.1 Commandes vocales

Voici quelques exemples de commandes vocales que vous pouvez utiliser avec votre assistant :

#### Résumé d'emails
- "Résume mes emails non lus"
- "Résume mes emails non lus de Jean"
- "Quels nouveaux emails ai-je reçu aujourd'hui de l'équipe marketing?"

#### Gestion de calendrier
- "Bloque 2h demain pour le projet Zephyr"
- "Bloque 2h demain matin pour le projet Alpha avec rappel SMS"
- "Crée une réunion hebdomadaire le lundi à 10h pour l'équipe"

#### Création d'événements avec invités
- "Déjeuner avec Marc et Sophie (marc@mail.com, sophie@proton.me) vendredi midi"
- "Organise une réunion avec l'équipe technique (tech@entreprise.com) mercredi à 14h"
- "Appel avec client (client@société.fr) lundi prochain à 11h pour démonstration"

### 4.2 Gestion des emails

Pour que l'assistant puisse gérer vos emails :

1. **Créez les libellés Gmail** suivants :
   - "Assistant/ToProcess" - pour les emails à traiter
   - "Assistant/Processed" - pour les emails déjà traités
   
   ![Gmail Labels](images/tutorial/gmail_labels.png)

2. **Créez des filtres** pour catégoriser automatiquement vos emails :
   - Paramètres Gmail > Filtres
   - Exemple : Appliquer le libellé "Assistant/ToProcess" aux emails importants
   
   ![Gmail Filters](images/tutorial/gmail_filters.png)

### 4.3 Gestion du calendrier

Pour une gestion optimale du calendrier :

1. **Autorisez l'accès à Google Calendar** lors de la première utilisation.

2. **Utilisez des mots clés spécifiques** dans vos commandes pour une meilleure reconnaissance :
   - "Bloque" pour réserver du temps personnel
   - "Réunion" ou "Rendez-vous" pour des événements avec d'autres personnes
   - "Déjeuner", "Dîner" pour des événements sociaux

3. **Spécifiez les rappels** pour ne jamais manquer un événement :
   - "... avec rappel SMS"
   - "... avec rappel email 30 minutes avant"

## 5. Personnalisation

Vous pouvez personnaliser votre assistant :

1. **Modifiez l'interface utilisateur** :
   - Éditez les fichiers CSS dans `src/frontend/styles.css`
   - Ajoutez votre logo dans `src/frontend/images/logo.svg`
   - Personnalisez les couleurs dans les variables CSS

2. **Ajoutez de nouvelles fonctionnalités** :
   - Créez de nouveaux composants web dans `src/frontend/components/`
   - Étendez les fonctions du backend dans les fichiers appropriés
   - Ajoutez de nouvelles intégrations dans `src/integrations/`

3. **Configurez les préférences dans la feuille Google Sheets** :
   - Ouvrez votre feuille de configuration
   - Modifiez les valeurs dans l'onglet "Config"

## 6. Dépannage

### Problèmes d'authentification
- Vérifiez que votre email est bien autorisé dans la configuration
- Assurez-vous que les origines JavaScript et les URIs de redirection sont correctement configurés
- Videz le cache de votre navigateur et essayez à nouveau

### Commandes vocales non reconnues
- Parlez distinctement et à un rythme régulier
- Vérifiez que votre navigateur a accès au microphone
- Essayez de reformuler votre commande en utilisant des mots-clés explicites

### Problèmes de synchronisation
- Vérifiez que votre script Google Apps Script est correctement déployé
- Assurez-vous que les autorisations nécessaires sont accordées
- Vérifiez les journaux d'exécution dans l'éditeur de script

### Problèmes spécifiques à Firebase
- Vérifiez les journaux Firebase Functions dans la console Firebase
- Assurez-vous que les règles Firestore sont correctement configurées
- Vérifiez que votre plan gratuit n'a pas atteint ses limites
- Si vous rencontrez des erreurs de déploiement, essayez :
  ```bash
  firebase deploy --only functions
  firebase deploy --only hosting
  firebase deploy --only firestore:rules
  ```

### Problèmes spécifiques à Cloudflare
- Consultez les logs des Workers dans le dashboard Cloudflare
- Vérifiez que la variable secrète ASSISTANT_CONFIG est correctement formatée
- Assurez-vous que les CORS sont correctement configurés

### Mode hors-ligne ne fonctionne pas
- Visitez l'application au moins une fois en mode connecté
- Vérifiez que votre navigateur supporte les Service Workers
- Assurez-vous que la mise en cache fonctionne correctement

## 7. Mise à jour et maintenance

### Mise à jour de l'application
1. **Modifiez les fichiers source** selon vos besoins
2. **Redéployez** en utilisant la commande appropriée :
   - Pour Firebase : `firebase deploy`
   - Pour Cloudflare : `wrangler deploy`

### Sauvegarde de vos données
1. **Exportez régulièrement votre feuille Google Sheets**
2. **Sauvegardez vos configurations** (variables d'environnement, etc.)

### Surveillance des quotas
1. **Vérifiez régulièrement** les quotas d'utilisation de vos services
2. **Firebase** : Console Firebase > Usage and billing
3. **Cloudflare** : Dashboard > Workers > Usage
4. **Google Cloud** : Console GCP > Billing > Reports

---

## Besoin d'aide supplémentaire ?

Si vous rencontrez des problèmes non couverts par ce tutoriel, voici quelques ressources:

- Documentation Firebase: https://firebase.google.com/docs
- Documentation Cloudflare Workers: https://developers.cloudflare.com/workers/
- Documentation Google Apps Script: https://developers.google.com/apps-script
- Documentation Gemini API: https://ai.google.dev/docs

---

**Note**: N'oubliez pas de remplacer les placeholders d'images (`images/tutorial/...`) par de véritables captures d'écran pour rendre ce tutoriel plus facile à suivre.