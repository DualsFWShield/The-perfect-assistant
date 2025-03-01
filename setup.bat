@echo off
REM Script de déploiement ZeroConfig Personal Assistant pour Windows
REM Ce script configure et déploie l'assistant personnel sur Firebase ou Cloudflare

REM Configuration du journal d'installation
set LOG_FILE=installation_log.txt
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set datetime=%%a
set year=%datetime:~0,4%
set month=%datetime:~4,2%
set day=%datetime:~6,2%
set hour=%datetime:~8,2%
set minute=%datetime:~10,2%
set second=%datetime:~12,2%
set timestamp=%year%-%month%-%day% %hour%:%minute%:%second%

echo [%timestamp%] Démarrage de l'installation de ZeroConfig Personal Assistant > %LOG_FILE%

REM Fonction pour écrire dans le journal et la console
:log
set message=%~1
set type=%~2
if "%type%"=="" set type=INFO

for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set datetime=%%a
set year=%datetime:~0,4%
set month=%datetime:~4,2%
set day=%datetime:~6,2%
set hour=%datetime:~8,2%
set minute=%datetime:~10,2%
set second=%datetime:~12,2%
set timestamp=%year%-%month%-%day% %hour%:%minute%:%second%

echo [%timestamp%] [%type%] %message% >> %LOG_FILE%

if "%type%"=="INFO" (
    echo [36m%message%[0m
) else if "%type%"=="SUCCESS" (
    echo [32m%message%[0m
) else if "%type%"=="WARNING" (
    echo [33m%message%[0m
) else if "%type%"=="ERROR" (
    echo [31m%message%[0m
) else (
    echo %message%
)
goto :EOF

REM Vérifier les prérequis
call :log "Vérification des prérequis..." "INFO"

where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  call :log "npm est requis mais n'est pas installé. Veuillez installer Node.js." "ERROR"
  goto :end
)

for /f "tokens=*" %%i in ('npm --version') do set npm_version=%%i
call :log "npm détecté: %npm_version%" "SUCCESS"

where node >nul 2>nul
if %ERRORLEVEL% neq 0 (
  call :log "Node.js est requis mais n'est pas installé." "ERROR"
  goto :end
)

for /f "tokens=*" %%i in ('node --version') do set node_version=%%i
call :log "Node.js détecté: %node_version%" "SUCCESS"

where git >nul 2>nul
if %ERRORLEVEL% neq 0 (
  call :log "Git n'est pas installé. Ce n'est pas obligatoire mais recommandé." "WARNING"
) else (
  for /f "tokens=*" %%i in ('git --version') do set git_version=%%i
  call :log "Git détecté: %git_version%" "SUCCESS"
)

REM Choix de la plateforme de déploiement
call :log "" "INFO"
call :log "Choisissez votre plateforme de déploiement:" "INFO"
call :log "1. Firebase (recommandé pour débutants, domaine gratuit inclus)" "INFO"
call :log "2. Cloudflare Workers (performances supérieures)" "INFO"
call :log "" "INFO"

set /p PLATFORM_CHOICE="Entrez 1 ou 2: "

if "%PLATFORM_CHOICE%"=="1" (
  call :log "Vous avez choisi Firebase comme plateforme de déploiement." "INFO"
  call :DeployToFirebase
) else if "%PLATFORM_CHOICE%"=="2" (
  call :log "Vous avez choisi Cloudflare Workers comme plateforme de déploiement." "INFO"
  call :DeployToCloudflare
) else (
  call :log "Choix invalide. Veuillez redémarrer le script et choisir 1 ou 2." "ERROR"
  goto :end
)

REM Instructions pour Google Apps Script
call :log "" "INFO"
call :log "🔹 ÉTAPES FINALES (MANUEL) 🔹" "INFO"
call :log "1. Ouvrez https://script.google.com/" "INFO"
call :log "2. Créez un nouveau projet et copiez le contenu de src/integrations/google-apps-script/sync.gs" "INFO"
call :log "3. Déployez comme application web avec les paramètres suivants:" "INFO"
call :log "   - Exécuter en tant que: Moi-même" "INFO"
call :log "   - Qui a accès: Uniquement moi" "INFO"
call :log "4. Copiez l'URL du déploiement et configurez-la dans l'interface de l'assistant" "INFO"
call :log "" "INFO"
call :log "✨ Installation terminée ! ✨" "SUCCESS"

goto :end

:DeployToFirebase
call :log "Préparation du déploiement sur Firebase..." "INFO"

REM Installer Firebase CLI
call :log "Installation de Firebase CLI (cela peut prendre quelques minutes)..." "INFO"
call npm install -g firebase-tools
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors de l'installation de Firebase CLI. Vérifiez votre connexion internet et les permissions npm." "ERROR"
  exit /b 1
)
call :log "Firebase CLI installé avec succès" "SUCCESS"

REM Connexion à Firebase
call :log "Connexion à votre compte Firebase..." "INFO"
call :log "Une fenêtre de navigateur va s'ouvrir pour vous authentifier avec Google." "INFO"
call firebase login
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors de la connexion à Firebase. Veuillez réessayer." "ERROR"
  exit /b 1
)
call :log "Connexion à Firebase réussie" "SUCCESS"

REM Initialiser Firebase
call :log "Initialisation du projet Firebase..." "INFO"
call :log "Vous allez être guidé à travers plusieurs questions pour configurer Firebase:" "INFO"
call :log " - Sélectionnez 'Hosting', 'Functions' et 'Firestore'" "INFO"
call :log " - Choisissez un projet existant ou créez-en un nouveau" "INFO"
call :log " - Pour Hosting, utilisez 'dist' comme dossier public" "INFO"
call :log " - Configurez une application à page unique: oui" "INFO"
call :log " - Pour Functions, choisissez JavaScript" "INFO"

call firebase init hosting,functions,firestore
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors de l'initialisation de Firebase. Veuillez vérifier les messages d'erreur ci-dessus." "ERROR"
  exit /b 1
)
call :log "Initialisation de Firebase réussie" "SUCCESS"

REM Préparer les fichiers Firebase
call :log "Préparation des fichiers pour le déploiement..." "INFO"

REM Créer un dossier pour les fonctions
if not exist functions mkdir functions
call :log "Dossier 'functions' vérifié" "INFO"

REM Copier le fichier de configuration des fonctions
if exist firebase\functions\index.js (
  copy firebase\functions\index.js functions\index.js
  call :log "Fichier index.js copié depuis le modèle" "INFO"
) else (
  if exist src\backend\worker.js (
    copy src\backend\worker.js functions\index.js
    echo const functions = require('firebase-functions');>> functions\index.js
    echo exports.api = functions.https.onRequest(handleRequest);>> functions\index.js
    call :log "Fichier index.js créé à partir du worker.js avec adaptations pour Firebase" "INFO"
  ) else (
    call :log "Fichier source pour les fonctions introuvable. Vérifiez votre installation." "ERROR"
    exit /b 1
  )
)

REM Copier les fichiers frontend
if not exist dist mkdir dist
call :log "Dossier 'dist' créé pour le frontend" "INFO"

if exist src\frontend (
  xcopy /E /I src\frontend\* dist\
  call :log "Fichiers frontend copiés vers le dossier de distribution" "SUCCESS"
) else (
  call :log "Dossier frontend introuvable. Vérifiez votre installation." "ERROR"
  exit /b 1
)

REM Installer les dépendances pour les fonctions
call :log "Installation des dépendances pour Firebase Functions..." "INFO"
cd functions
call npm install firebase-admin firebase-functions axios cors
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors de l'installation des dépendances. Vérifiez votre connexion internet." "ERROR"
  cd ..
  exit /b 1
)
cd ..
call :log "Dépendances installées avec succès" "SUCCESS"

REM Configuration de l'API Gemini
call :log "Configuration de l'API Gemini..." "INFO"
call :log "Vous aurez besoin d'une clé API Gemini de Google AI Studio (https://ai.google.dev/)" "INFO"
set /p gemini_api_key="Entrez votre clé API Gemini: "
set /p user_email="Entrez votre adresse email Google (pour l'authentification): "

if not "%gemini_api_key%"=="" if not "%user_email%"=="" (
  call :log "Configuration des variables d'environnement Firebase..." "INFO"
  call firebase functions:config:set assistant.gemini_api_key="%gemini_api_key%" assistant.allowed_user_email="%user_email%"
  call :log "Variables d'environnement configurées" "SUCCESS"
) else (
  call :log "Clé API ou email manquant. La configuration devra être effectuée manuellement plus tard." "WARNING"
)

REM Déployer sur Firebase
call :log "Déploiement sur Firebase (cela peut prendre plusieurs minutes)..." "INFO"
call firebase deploy
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors du déploiement. Essayons de déployer chaque service séparément." "WARNING"
  
  call :log "Déploiement des fonctions..." "INFO"
  call firebase deploy --only functions
  
  call :log "Déploiement de l'hébergement..." "INFO"
  call firebase deploy --only hosting
  
  call :log "Déploiement des règles Firestore..." "INFO"
  call firebase deploy --only firestore:rules
) else (
  call :log "Déploiement réussi!" "SUCCESS"
)

REM Afficher l'URL du site
call :log "Récupération de l'URL de votre application..." "INFO"
call firebase hosting:channel:list
call :log "Votre assistant est disponible sur le domaine Firebase affiché ci-dessus" "SUCCESS"

exit /b 0

:DeployToCloudflare
call :log "Préparation du déploiement sur Cloudflare Workers..." "INFO"

REM Installer Wrangler (CLI Cloudflare)
call :log "Installation de Wrangler (CLI Cloudflare)..." "INFO"
call npm install -g wrangler
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors de l'installation de Wrangler. Vérifiez votre connexion internet et les permissions npm." "ERROR"
  exit /b 1
)
call :log "Wrangler installé avec succès" "SUCCESS"

REM Authentification Cloudflare
call :log "Connexion à votre compte Cloudflare..." "INFO"
call :log "Une fenêtre de navigateur va s'ouvrir pour vous authentifier avec Cloudflare." "INFO"
call wrangler login
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors de la connexion à Cloudflare. Veuillez réessayer." "ERROR"
  exit /b 1
)
call :log "Connexion à Cloudflare réussie" "SUCCESS"

REM Configuration de l'API Gemini et des variables d'environnement
call :log "Configuration de l'API Gemini..." "INFO"
call :log "Vous aurez besoin d'une clé API Gemini de Google AI Studio (https://ai.google.dev/)" "INFO"
set /p gemini_api_key="Entrez votre clé API Gemini: "
set /p user_email="Entrez votre adresse email Google (pour l'authentification): "

if not "%gemini_api_key%"=="" if not "%user_email%"=="" (
  call :log "Configuration de la variable secrète ASSISTANT_CONFIG..." "INFO"
  call :log "Vous allez être invité à entrer la configuration. Copiez-collez exactement le texte suivant:" "INFO"
  echo {"GEMINI_API_KEY":"%gemini_api_key%","ALLOWED_USER_EMAIL":"%user_email%","ALLOWED_ORIGIN":"*"}
  
  call wrangler secret put ASSISTANT_CONFIG
  call :log "Variable secrète configurée" "SUCCESS"
) else (
  call :log "Clé API ou email manquant. La configuration devra être effectuée manuellement plus tard." "WARNING"
)

REM Déployer le worker
call :log "Déploiement du Worker Cloudflare..." "INFO"
call wrangler deploy
if %ERRORLEVEL% neq 0 (
  call :log "Erreur lors du déploiement. Vérifiez les messages d'erreur ci-dessus." "ERROR"
  exit /b 1
)
call :log "Worker déployé avec succès" "SUCCESS"

REM Configuration du frontend
call :log "Configuration du frontend..." "INFO"
if not exist dist mkdir dist
call :log "Dossier 'dist' créé pour le frontend" "INFO"

if exist src\frontend (
  xcopy /E /I src\frontend\* dist\
  call :log "Fichiers frontend copiés vers le dossier de distribution" "SUCCESS"
) else (
  call :log "Dossier frontend introuvable. Vérifiez votre installation." "ERROR"
  exit /b 1
)

call :log "Pour héberger le frontend, vous pouvez utiliser Cloudflare Pages ou tout autre service d'hébergement statique." "INFO"
call :log "Votre Worker est disponible sur le sous-domaine workers.dev affiché ci-dessus." "SUCCESS"

exit /b 0

:end
for /f "tokens=2 delims==" %%a in ('wmic OS Get localdatetime /value') do set datetime=%%a
set year=%datetime:~0,4%
set month=%datetime:~4,2%
set day=%datetime:~6,2%
set hour=%datetime:~8,2%
set minute=%datetime:~10,2%
set second=%datetime:~12,2%
set timestamp=%year%-%month%-%day% %hour%:%minute%:%second%

echo [%timestamp%] Installation terminée >> %LOG_FILE%
echo.
echo Consultez le fichier journal %LOG_FILE% pour plus de détails sur l'installation.