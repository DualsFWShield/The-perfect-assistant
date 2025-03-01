#!/bin/bash

# Script de déploiement ZeroConfig Personal Assistant pour Linux/Mac
# Ce script configure et déploie l'assistant personnel sur Firebase ou Cloudflare

# Configuration du journal d'installation
LOG_FILE="installation_log.txt"
timestamp=$(date "+%Y-%m-%d %H:%M:%S")
echo "[$timestamp] Démarrage de l'installation de ZeroConfig Personal Assistant" > "$LOG_FILE"

# Fonction pour écrire dans le journal et la console
log_and_console() {
    local message="$1"
    local type="${2:-INFO}"
    
    timestamp=$(date "+%Y-%m-%d %H:%M:%S")
    log_message="[$timestamp] [$type] $message"
    
    # Écrire dans le fichier journal
    echo "$log_message" >> "$LOG_FILE"
    
    # Afficher dans la console avec couleur
    case "$type" in
        "INFO")
            echo -e "\033[36m$message\033[0m" ;;  # Cyan
        "SUCCESS")
            echo -e "\033[32m$message\033[0m" ;;  # Vert
        "WARNING")
            echo -e "\033[33m$message\033[0m" ;;  # Jaune
        "ERROR")
            echo -e "\033[31m$message\033[0m" ;;  # Rouge
        *)
            echo "$message" ;;
    esac
}

# Fonction pour vérifier les prérequis
check_prerequisites() {
    log_and_console "Vérification des prérequis..." "INFO"
    
    # Vérifier Node.js
    if command -v node >/dev/null 2>&1; then
        node_version=$(node --version)
        log_and_console "Node.js détecté: $node_version" "SUCCESS"
    else
        log_and_console "Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/" "ERROR"
        return 1
    fi
    
    # Vérifier npm
    if command -v npm >/dev/null 2>&1; then
        npm_version=$(npm --version)
        log_and_console "npm détecté: $npm_version" "SUCCESS"
    else
        log_and_console "npm n'est pas installé correctement." "ERROR"
        return 1
    fi
    
    # Vérifier Git (optionnel mais recommandé)
    if command -v git >/dev/null 2>&1; then
        git_version=$(git --version)
        log_and_console "Git détecté: $git_version" "SUCCESS"
    else
        log_and_console "Git n'est pas installé. Ce n'est pas obligatoire mais recommandé." "WARNING"
    fi
    
    return 0
}

# Fonction pour déployer sur Firebase
deploy_to_firebase() {
    log_and_console "Préparation du déploiement sur Firebase..." "INFO"
    
    # Installer Firebase CLI
    log_and_console "Installation de Firebase CLI (cela peut prendre quelques minutes)..." "INFO"
    npm install -g firebase-tools
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors de l'installation de Firebase CLI. Vérifiez votre connexion internet et les permissions npm." "ERROR"
        return 1
    fi
    log_and_console "Firebase CLI installé avec succès" "SUCCESS"
    
    # Connexion à Firebase
    log_and_console "Connexion à votre compte Firebase..." "INFO"
    log_and_console "Une fenêtre de navigateur va s'ouvrir pour vous authentifier avec Google." "INFO"
    firebase login
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors de la connexion à Firebase. Veuillez réessayer." "ERROR"
        return 1
    fi
    log_and_console "Connexion à Firebase réussie" "SUCCESS"
    
    # Initialiser Firebase
    log_and_console "Initialisation du projet Firebase..." "INFO"
    log_and_console "Vous allez être guidé à travers plusieurs questions pour configurer Firebase:" "INFO"
    log_and_console " - Sélectionnez 'Hosting', 'Functions' et 'Firestore'" "INFO"
    log_and_console " - Choisissez un projet existant ou créez-en un nouveau" "INFO"
    log_and_console " - Pour Hosting, utilisez 'dist' comme dossier public" "INFO"
    log_and_console " - Configurez une application à page unique: oui" "INFO"
    log_and_console " - Pour Functions, choisissez JavaScript" "INFO"
    
    firebase init hosting,functions,firestore
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors de l'initialisation de Firebase. Veuillez vérifier les messages d'erreur ci-dessus." "ERROR"
        return 1
    fi
    log_and_console "Initialisation de Firebase réussie" "SUCCESS"
    
    # Préparer les fichiers Firebase
    log_and_console "Préparation des fichiers pour le déploiement..." "INFO"
    
    # Vérifier et créer le dossier functions si nécessaire
    if [ ! -d "functions" ]; then
        mkdir -p functions
        log_and_console "Dossier 'functions' créé" "INFO"
    fi
    
    # Copier le fichier de configuration Firebase Functions
    if [ -f "firebase/functions/index.js" ]; then
        cp firebase/functions/index.js functions/index.js
        log_and_console "Fichier index.js copié depuis le modèle" "INFO"
    else
        if [ -f "src/backend/worker.js" ]; then
            cp src/backend/worker.js functions/index.js
            echo -e "\nconst functions = require('firebase-functions');" >> functions/index.js
            echo "exports.api = functions.https.onRequest(handleRequest);" >> functions/index.js
            log_and_console "Fichier index.js créé à partir du worker.js avec adaptations pour Firebase" "INFO"
        else
            log_and_console "Fichier source pour les fonctions introuvable. Vérifiez votre installation." "ERROR"
            return 1
        fi
    fi
    
    # Copier les fichiers frontend
    if [ ! -d "dist" ]; then
        mkdir -p dist
        log_and_console "Dossier 'dist' créé pour le frontend" "INFO"
    fi
    
    if [ -d "src/frontend" ]; then
        cp -r src/frontend/* dist/
        log_and_console "Fichiers frontend copiés vers le dossier de distribution" "SUCCESS"
    else
        log_and_console "Dossier frontend introuvable. Vérifiez votre installation." "ERROR"
        return 1
    fi
    
    # Installer les dépendances pour les fonctions
    log_and_console "Installation des dépendances pour Firebase Functions..." "INFO"
    cd functions
    npm install firebase-admin firebase-functions axios cors
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors de l'installation des dépendances. Vérifiez votre connexion internet." "ERROR"
        cd ..
        return 1
    fi
    cd ..
    log_and_console "Dépendances installées avec succès" "SUCCESS"
    
    # Configuration de l'API Gemini
    log_and_console "Configuration de l'API Gemini..." "INFO"
    log_and_console "Vous aurez besoin d'une clé API Gemini de Google AI Studio (https://ai.google.dev/)" "INFO"
    read -p "Entrez votre clé API Gemini: " gemini_api_key
    read -p "Entrez votre adresse email Google (pour l'authentification): " user_email
    
    if [ -n "$gemini_api_key" ] && [ -n "$user_email" ]; then
        log_and_console "Configuration des variables d'environnement Firebase..." "INFO"
        firebase functions:config:set assistant.gemini_api_key="$gemini_api_key" assistant.allowed_user_email="$user_email"
        log_and_console "Variables d'environnement configurées" "SUCCESS"
    else
        log_and_console "Clé API ou email manquant. La configuration devra être effectuée manuellement plus tard." "WARNING"
    fi
    
    # Déployer sur Firebase
    log_and_console "Déploiement sur Firebase (cela peut prendre plusieurs minutes)..." "INFO"
    firebase deploy
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors du déploiement. Essayons de déployer chaque service séparément." "WARNING"
        
        log_and_console "Déploiement des fonctions..." "INFO"
        firebase deploy --only functions
        
        log_and_console "Déploiement de l'hébergement..." "INFO"
        firebase deploy --only hosting
        
        log_and_console "Déploiement des règles Firestore..." "INFO"
        firebase deploy --only firestore:rules
    else
        log_and_console "Déploiement réussi!" "SUCCESS"
    fi
    
    # Afficher l'URL du site
    log_and_console "Récupération de l'URL de votre application..." "INFO"
    firebase hosting:channel:list
    log_and_console "Votre assistant est disponible sur le domaine Firebase affiché ci-dessus" "SUCCESS"
    
    return 0
}

# Fonction pour déployer sur Cloudflare
deploy_to_cloudflare() {
    log_and_console "Préparation du déploiement sur Cloudflare Workers..." "INFO"
    
    # Installer Wrangler (CLI Cloudflare)
    log_and_console "Installation de Wrangler (CLI Cloudflare)..." "INFO"
    npm install -g wrangler
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors de l'installation de Wrangler. Vérifiez votre connexion internet et les permissions npm." "ERROR"
        return 1
    fi
    log_and_console "Wrangler installé avec succès" "SUCCESS"
    
    # Authentification Cloudflare
    log_and_console "Connexion à votre compte Cloudflare..." "INFO"
    log_and_console "Une fenêtre de navigateur va s'ouvrir pour vous authentifier avec Cloudflare." "INFO"
    wrangler login
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors de la connexion à Cloudflare. Veuillez réessayer." "ERROR"
        return 1
    fi
    log_and_console "Connexion à Cloudflare réussie" "SUCCESS"
    
    # Configuration de l'API Gemini et des variables d'environnement
    log_and_console "Configuration de l'API Gemini..." "INFO"
    log_and_console "Vous aurez besoin d'une clé API Gemini de Google AI Studio (https://ai.google.dev/)" "INFO"
    read -p "Entrez votre clé API Gemini: " gemini_api_key
    read -p "Entrez votre adresse email Google (pour l'authentification): " user_email
    
    if [ -n "$gemini_api_key" ] && [ -n "$user_email" ]; then
        config_json="{\"GEMINI_API_KEY\":\"$gemini_api_key\",\"ALLOWED_USER_EMAIL\":\"$user_email\",\"ALLOWED_ORIGIN\":\"*\"}"
        
        log_and_console "Configuration de la variable secrète ASSISTANT_CONFIG..." "INFO"
        log_and_console "Vous allez être invité à entrer la configuration. Copiez-collez exactement le texte suivant:" "INFO"
        echo -e "\033[33m$config_json\033[0m"
        
        wrangler secret put ASSISTANT_CONFIG
        log_and_console "Variable secrète configurée" "SUCCESS"
    else
        log_and_console "Clé API ou email manquant. La configuration devra être effectuée manuellement plus tard." "WARNING"
    fi
    
    # Déployer le worker
    log_and_console "Déploiement du Worker Cloudflare..." "INFO"
    wrangler deploy
    if [ $? -ne 0 ]; then
        log_and_console "Erreur lors du déploiement. Vérifiez les messages d'erreur ci-dessus." "ERROR"
        return 1
    fi
    log_and_console "Worker déployé avec succès" "SUCCESS"
    
    # Configuration du frontend
    log_and_console "Configuration du frontend..." "INFO"
    if [ ! -d "dist" ]; then
        mkdir -p dist
        log_and_console "Dossier 'dist' créé pour le frontend" "INFO"
    fi
    
    if [ -d "src/frontend" ]; then
        cp -r src/frontend/* dist/
        log_and_console "Fichiers frontend copiés vers le dossier de distribution" "SUCCESS"
    else
        log_and_console "Dossier frontend introuvable. Vérifiez votre installation." "ERROR"
        return 1
    fi
    
    log_and_console "Pour héberger le frontend, vous pouvez utiliser Cloudflare Pages ou tout autre service d'hébergement statique." "INFO"
    log_and_console "Votre Worker est disponible sur le sous-domaine workers.dev affiché ci-dessus." "SUCCESS"
    
    return 0
}

# Fonction principale
main() {
    log_and_console "🚀 Installation de l'Assistant Personnel ZeroConfig" "INFO"
    
    # Vérifier les prérequis
    check_prerequisites
    if [ $? -ne 0 ]; then
        log_and_console "Prérequis manquants. Veuillez installer les outils nécessaires et réessayer." "ERROR"
        return 1
    fi
    
    # Choix de la plateforme de déploiement
    log_and_console $'\nChoisissez votre plateforme de déploiement:' "INFO"
    log_and_console "1. Firebase (recommandé pour débutants, domaine gratuit inclus)" "INFO"
    log_and_console "2. Cloudflare Workers (performances supérieures)" "INFO"
    log_and_console ""
    
    read -p "Entrez 1 ou 2: " platform_choice
    
    deployment_success=1
    
    if [ "$platform_choice" = "1" ]; then
        log_and_console "Vous avez choisi Firebase comme plateforme de déploiement." "INFO"
        deploy_to_firebase
        deployment_success=$?
    elif [ "$platform_choice" = "2" ]; then
        log_and_console "Vous avez choisi Cloudflare Workers comme plateforme de déploiement." "INFO"
        deploy_to_cloudflare
        deployment_success=$?
    else
        log_and_console "Choix invalide. Veuillez redémarrer le script et choisir 1 ou 2." "ERROR"
        return 1
    fi
    
    if [ $deployment_success -eq 0 ]; then
        # Instructions pour Google Apps Script
        log_and_console $'\n🔹 ÉTAPES FINALES (MANUEL) 🔹' "INFO"
        log_and_console "1. Ouvrez https://script.google.com/" "INFO"
        log_and_console "2. Créez un nouveau projet et copiez le contenu de src/integrations/google-apps-script/sync.gs" "INFO"
        log_and_console "3. Déployez comme application web avec les paramètres suivants:" "INFO"
        log_and_console "   - Exécuter en tant que: Moi-même" "INFO"
        log_and_console "   - Qui a accès: Uniquement moi" "INFO"
        log_and_console "4. Copiez l'URL du déploiement et configurez-la dans l'interface de l'assistant" "INFO"
        log_and_console $'\n✨ Installation terminée ! ✨' "SUCCESS"
        
        # Enregistrer le succès dans le journal
        timestamp=$(date "+%Y-%m-%d %H:%M:%S")
        echo "[$timestamp] [SUCCESS] Installation terminée avec succès" >> "$LOG_FILE"
    else
        log_and_console $'\n❌ L\'installation a rencontré des problèmes. Consultez le fichier journal pour plus de détails: '"$LOG_FILE" "ERROR"
        
        # Enregistrer l'échec dans le journal
        timestamp=$(date "+%Y-%m-%d %H:%M:%S")
        echo "[$timestamp] [ERROR] L'installation a échoué" >> "$LOG_FILE"
    fi
}

# Exécuter la fonction principale
main