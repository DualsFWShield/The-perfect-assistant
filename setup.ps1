# Script PowerShell de déploiement ZeroConfig Personal Assistant
# Ce script configure et déploie l'assistant personnel sur Firebase ou Cloudflare

# Configuration du journal d'installation
$logFile = "installation_log.txt"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"[$timestamp] Démarrage de l'installation de ZeroConfig Personal Assistant" | Out-File -FilePath $logFile

function Write-LogAndConsole {
    param (
        [string]$Message,
        [string]$Type = "INFO"
    )
    
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] [$Type] $Message"
    
    # Écrire dans le fichier journal
    $logMessage | Out-File -FilePath $logFile -Append
    
    # Afficher dans la console avec couleur
    switch ($Type) {
        "INFO" { Write-Host $Message -ForegroundColor Cyan }
        "SUCCESS" { Write-Host $Message -ForegroundColor Green }
        "WARNING" { Write-Host $Message -ForegroundColor Yellow }
        "ERROR" { Write-Host $Message -ForegroundColor Red }
        default { Write-Host $Message }
    }
}

# Fonction pour vérifier les prérequis
function Check-Prerequisites {
    Write-LogAndConsole "Vérification des prérequis..." "INFO"
    
    # Vérifier Node.js
    try {
        $nodeVersion = node --version
        Write-LogAndConsole "Node.js détecté: $nodeVersion" "SUCCESS"
    } catch {
        Write-LogAndConsole "Node.js n'est pas installé. Veuillez l'installer depuis https://nodejs.org/" "ERROR"
        return $false
    }
    
    # Vérifier npm
    try {
        $npmVersion = npm --version
        Write-LogAndConsole "npm détecté: $npmVersion" "SUCCESS"
    } catch {
        Write-LogAndConsole "npm n'est pas installé correctement." "ERROR"
        return $false
    }
    
    # Vérifier Git (optionnel mais recommandé)
    try {
        $gitVersion = git --version
        Write-LogAndConsole "Git détecté: $gitVersion" "SUCCESS"
    } catch {
        Write-LogAndConsole "Git n'est pas installé. Ce n'est pas obligatoire mais recommandé." "WARNING"
    }
    
    return $true
}

# Fonction pour déployer sur Firebase
function Deploy-ToFirebase {
    Write-LogAndConsole "Préparation du déploiement sur Firebase..." "INFO"
    
    # Installer Firebase CLI
    Write-LogAndConsole "Installation de Firebase CLI (cela peut prendre quelques minutes)..." "INFO"
    npm install -g firebase-tools
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors de l'installation de Firebase CLI. Vérifiez votre connexion internet et les permissions npm." "ERROR"
        return $false
    }
    Write-LogAndConsole "Firebase CLI installé avec succès" "SUCCESS"
    
    # Connexion à Firebase
    Write-LogAndConsole "Connexion à votre compte Firebase..." "INFO"
    Write-LogAndConsole "Une fenêtre de navigateur va s'ouvrir pour vous authentifier avec Google." "INFO"
    firebase login
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors de la connexion à Firebase. Veuillez réessayer." "ERROR"
        return $false
    }
    Write-LogAndConsole "Connexion à Firebase réussie" "SUCCESS"
    
    # Initialiser Firebase
    Write-LogAndConsole "Initialisation du projet Firebase..." "INFO"
    Write-LogAndConsole "Vous allez être guidé à travers plusieurs questions pour configurer Firebase:" "INFO"
    Write-LogAndConsole " - Sélectionnez 'Hosting', 'Functions' et 'Firestore'" "INFO"
    Write-LogAndConsole " - Choisissez un projet existant ou créez-en un nouveau" "INFO"
    Write-LogAndConsole " - Pour Hosting, utilisez 'dist' comme dossier public" "INFO"
    Write-LogAndConsole " - Configurez une application à page unique: oui" "INFO"
    Write-LogAndConsole " - Pour Functions, choisissez JavaScript" "INFO"
    
    firebase init hosting,functions,firestore
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors de l'initialisation de Firebase. Veuillez vérifier les messages d'erreur ci-dessus." "ERROR"
        return $false
    }
    Write-LogAndConsole "Initialisation de Firebase réussie" "SUCCESS"
    
    # Préparer les fichiers Firebase
    Write-LogAndConsole "Préparation des fichiers pour le déploiement..." "INFO"
    
    # Vérifier et créer le dossier functions si nécessaire
    if (!(Test-Path -Path "functions")) {
        New-Item -ItemType Directory -Path "functions" | Out-Null
        Write-LogAndConsole "Dossier 'functions' créé" "INFO"
    }
    
    # Copier le fichier de configuration Firebase Functions
    if (Test-Path -Path "firebase/functions/index.js") {
        Copy-Item -Path "firebase/functions/index.js" -Destination "functions/index.js" -Force
        Write-LogAndConsole "Fichier index.js copié depuis le modèle" "INFO"
    } else {
        if (Test-Path -Path "src/backend/worker.js") {
            Copy-Item -Path "src/backend/worker.js" -Destination "functions/index.js" -Force
            Add-Content -Path "functions/index.js" -Value "`nconst functions = require('firebase-functions');"
            Add-Content -Path "functions/index.js" -Value "exports.api = functions.https.onRequest(handleRequest);"
            Write-LogAndConsole "Fichier index.js créé à partir du worker.js avec adaptations pour Firebase" "INFO"
        } else {
            Write-LogAndConsole "Fichier source pour les fonctions introuvable. Vérifiez votre installation." "ERROR"
            return $false
        }
    }
    
    # Copier les fichiers frontend
    if (!(Test-Path -Path "dist")) {
        New-Item -ItemType Directory -Path "dist" | Out-Null
        Write-LogAndConsole "Dossier 'dist' créé pour le frontend" "INFO"
    }
    
    if (Test-Path -Path "src/frontend") {
        Copy-Item -Path "src/frontend/*" -Destination "dist/" -Recurse -Force
        Write-LogAndConsole "Fichiers frontend copiés vers le dossier de distribution" "SUCCESS"
    } else {
        Write-LogAndConsole "Dossier frontend introuvable. Vérifiez votre installation." "ERROR"
        return $false
    }
    
    # Installer les dépendances pour les fonctions
    Write-LogAndConsole "Installation des dépendances pour Firebase Functions..." "INFO"
    Set-Location -Path "functions"
    npm install firebase-admin firebase-functions axios cors
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors de l'installation des dépendances. Vérifiez votre connexion internet." "ERROR"
        Set-Location -Path ".."
        return $false
    }
    Set-Location -Path ".."
    Write-LogAndConsole "Dépendances installées avec succès" "SUCCESS"
    
    # Configuration de l'API Gemini
    Write-LogAndConsole "Configuration de l'API Gemini..." "INFO"
    Write-LogAndConsole "Vous aurez besoin d'une clé API Gemini de Google AI Studio (https://ai.google.dev/)" "INFO"
    $geminiApiKey = Read-Host "Entrez votre clé API Gemini"
    $userEmail = Read-Host "Entrez votre adresse email Google (pour l'authentification)"
    
    if ($geminiApiKey -and $userEmail) {
        Write-LogAndConsole "Configuration des variables d'environnement Firebase..." "INFO"
        firebase functions:config:set assistant.gemini_api_key="$geminiApiKey" assistant.allowed_user_email="$userEmail"
        Write-LogAndConsole "Variables d'environnement configurées" "SUCCESS"
    } else {
        Write-LogAndConsole "Clé API ou email manquant. La configuration devra être effectuée manuellement plus tard." "WARNING"
    }
    
    # Déployer sur Firebase
    Write-LogAndConsole "Déploiement sur Firebase (cela peut prendre plusieurs minutes)..." "INFO"
    firebase deploy
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors du déploiement. Essayons de déployer chaque service séparément." "WARNING"
        
        Write-LogAndConsole "Déploiement des fonctions..." "INFO"
        firebase deploy --only functions
        
        Write-LogAndConsole "Déploiement de l'hébergement..." "INFO"
        firebase deploy --only hosting
        
        Write-LogAndConsole "Déploiement des règles Firestore..." "INFO"
        firebase deploy --only firestore:rules
    } else {
        Write-LogAndConsole "Déploiement réussi!" "SUCCESS"
    }
    
    # Afficher l'URL du site
    Write-LogAndConsole "Récupération de l'URL de votre application..." "INFO"
    firebase hosting:channel:list
    Write-LogAndConsole "Votre assistant est disponible sur le domaine Firebase affiché ci-dessus" "SUCCESS"
    
    return $true
}

# Fonction pour déployer sur Cloudflare
function Deploy-ToCloudflare {
    Write-LogAndConsole "Préparation du déploiement sur Cloudflare Workers..." "INFO"
    
    # Installer Wrangler (CLI Cloudflare)
    Write-LogAndConsole "Installation de Wrangler (CLI Cloudflare)..." "INFO"
    npm install -g wrangler
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors de l'installation de Wrangler. Vérifiez votre connexion internet et les permissions npm." "ERROR"
        return $false
    }
    Write-LogAndConsole "Wrangler installé avec succès" "SUCCESS"
    
    # Authentification Cloudflare
    Write-LogAndConsole "Connexion à votre compte Cloudflare..." "INFO"
    Write-LogAndConsole "Une fenêtre de navigateur va s'ouvrir pour vous authentifier avec Cloudflare." "INFO"
    wrangler login
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors de la connexion à Cloudflare. Veuillez réessayer." "ERROR"
        return $false
    }
    Write-LogAndConsole "Connexion à Cloudflare réussie" "SUCCESS"
    
    # Configuration de l'API Gemini et des variables d'environnement
    Write-LogAndConsole "Configuration de l'API Gemini..." "INFO"
    Write-LogAndConsole "Vous aurez besoin d'une clé API Gemini de Google AI Studio (https://ai.google.dev/)" "INFO"
    $geminiApiKey = Read-Host "Entrez votre clé API Gemini"
    $userEmail = Read-Host "Entrez votre adresse email Google (pour l'authentification)"
    
    if ($geminiApiKey -and $userEmail) {
        $configJson = @{
            GEMINI_API_KEY = $geminiApiKey
            ALLOWED_USER_EMAIL = $userEmail
            ALLOWED_ORIGIN = "*"
        } | ConvertTo-Json -Compress
        
        Write-LogAndConsole "Configuration de la variable secrète ASSISTANT_CONFIG..." "INFO"
        Write-LogAndConsole "Vous allez être invité à entrer la configuration. Copiez-collez exactement le texte suivant:" "INFO"
        Write-Host $configJson -ForegroundColor Yellow
        
        wrangler secret put ASSISTANT_CONFIG
        Write-LogAndConsole "Variable secrète configurée" "SUCCESS"
    } else {
        Write-LogAndConsole "Clé API ou email manquant. La configuration devra être effectuée manuellement plus tard." "WARNING"
    }
    
    # Déployer le worker
    Write-LogAndConsole "Déploiement du Worker Cloudflare..." "INFO"
    wrangler deploy
    if ($LASTEXITCODE -ne 0) {
        Write-LogAndConsole "Erreur lors du déploiement. Vérifiez les messages d'erreur ci-dessus." "ERROR"
        return $false
    }
    Write-LogAndConsole "Worker déployé avec succès" "SUCCESS"
    
    # Configuration du frontend
    Write-LogAndConsole "Configuration du frontend..." "INFO"
    if (!(Test-Path -Path "dist")) {
        New-Item -ItemType Directory -Path "dist" | Out-Null
        Write-LogAndConsole "Dossier 'dist' créé pour le frontend" "INFO"
    }
    
    if (Test-Path -Path "src/frontend") {
        Copy-Item -Path "src/frontend/*" -Destination "dist/" -Recurse -Force
        Write-LogAndConsole "Fichiers frontend copiés vers le dossier de distribution" "SUCCESS"
    } else {
        Write-LogAndConsole "Dossier frontend introuvable. Vérifiez votre installation." "ERROR"
        return $false
    }
    
    Write-LogAndConsole "Pour héberger le frontend, vous pouvez utiliser Cloudflare Pages ou tout autre service d'hébergement statique." "INFO"
    Write-LogAndConsole "Votre Worker est disponible sur le sous-domaine workers.dev affiché ci-dessus." "SUCCESS"
    
    return $true
}

# Fonction principale
function Main {
    Write-LogAndConsole "🚀 Installation de l'Assistant Personnel ZeroConfig" "INFO"
    
    # Vérifier les prérequis
    $prereqsOk = Check-Prerequisites
    if (-not $prereqsOk) {
        Write-LogAndConsole "Prérequis manquants. Veuillez installer les outils nécessaires et réessayer." "ERROR"
        return
    }
    
    # Choix de la plateforme de déploiement
    Write-LogAndConsole "`nChoisissez votre plateforme de déploiement:" "INFO"
    Write-LogAndConsole "1. Firebase (recommandé pour débutants, domaine gratuit inclus)" "INFO"
    Write-LogAndConsole "2. Cloudflare Workers (performances supérieures)" "INFO"
    Write-LogAndConsole ""
    
    $platformChoice = Read-Host "Entrez 1 ou 2"
    
    $deploymentSuccess = $false
    
    if ($platformChoice -eq "1") {
        Write-LogAndConsole "Vous avez choisi Firebase comme plateforme de déploiement." "INFO"
        $deploymentSuccess = Deploy-ToFirebase
    } elseif ($platformChoice -eq "2") {
        Write-LogAndConsole "Vous avez choisi Cloudflare Workers comme plateforme de déploiement." "INFO"
        $deploymentSuccess = Deploy-ToCloudflare
    } else {
        Write-LogAndConsole "Choix invalide. Veuillez redémarrer le script et choisir 1 ou 2." "ERROR"
        return
    }
    
    if ($deploymentSuccess) {
        # Instructions pour Google Apps Script
        Write-LogAndConsole "`n🔹 ÉTAPES FINALES (MANUEL) 🔹" "INFO"
        Write-LogAndConsole "1. Ouvrez https://script.google.com/" "INFO"
        Write-LogAndConsole "2. Créez un nouveau projet et copiez le contenu de src/integrations/google-apps-script/sync.gs" "INFO"
        Write-LogAndConsole "3. Déployez comme application web avec les paramètres suivants:" "INFO"
        Write-LogAndConsole "   - Exécuter en tant que: Moi-même" "INFO"
        Write-LogAndConsole "   - Qui a accès: Uniquement moi" "INFO"
        Write-LogAndConsole "4. Copiez l'URL du déploiement et configurez-la dans l'interface de l'assistant" "INFO"
        Write-LogAndConsole "`n✨ Installation terminée ! ✨" "SUCCESS"
        
        # Enregistrer le succès dans le journal
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$timestamp] [SUCCESS] Installation terminée avec succès" | Out-File -FilePath $logFile -Append
    } else {
        Write-LogAndConsole "`n❌ L'installation a rencontré des problèmes. Consultez le fichier journal pour plus de détails: $logFile" "ERROR"
        
        # Enregistrer l'échec dans le journal
        $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
        "[$timestamp] [ERROR] L'installation a échoué" | Out-File -FilePath $logFile -Append
    }
}

# Exécuter la fonction principale
Main