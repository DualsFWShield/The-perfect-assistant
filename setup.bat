@echo off
REM Script de déploiement ZeroConfig Personal Assistant pour Windows
REM Ce script configure et déploie l'assistant personnel sur Firebase ou Cloudflare

echo 🚀 Installation de l'Assistant Personnel ZeroConfig...

REM Vérifier les prérequis
echo ✓ Vérification des prérequis...
where npm >nul 2>nul
if %ERRORLEVEL% neq 0 (
  echo ❌ npm est requis mais n'est pas installé. Veuillez installer Node.js.
  exit /b 1
)

REM Choix de la plateforme de déploiement
echo.
echo Choisissez votre plateforme de déploiement:
echo 1. Firebase (domaine gratuit inclus)
echo 2. Cloudflare Workers
echo.
set /p PLATFORM_CHOICE="Entrez 1 ou 2: "

if "%PLATFORM_CHOICE%"=="1" (
  call :DeployToFirebase
) else if "%PLATFORM_CHOICE%"=="2" (
  call :DeployToCloudflare
) else (
  echo Choix invalide. Veuillez redémarrer le script et choisir 1 ou 2.
  exit /b 1
)

REM Instructions pour Google Apps Script
echo.
echo 🔹 ÉTAPES FINALES (MANUEL) 🔹
echo.
echo 1. Ouvrez https://script.google.com/
echo 2. Créez un nouveau projet et copiez le contenu de src/integrations/google-apps-script/sync.gs
echo 3. Déployez comme application web avec les paramètres suivants:
echo    - Exécuter en tant que: Moi-même
echo    - Qui a accès: Uniquement moi
echo 4. Copiez l'URL du déploiement et configurez-la dans l'interface de l'assistant
echo.
echo ✨ Installation terminée ! ✨
echo.
goto :EOF

:DeployToFirebase
echo Vous avez choisi Firebase comme plateforme de déploiement.

REM Installer Firebase CLI
echo ✓ Installation de Firebase CLI...
call npm install -g firebase-tools

REM Connexion à Firebase
echo ✓ Connexion à votre compte Firebase...
call firebase login

REM Initialiser Firebase
echo ✓ Initialisation du projet Firebase...
call firebase init hosting,functions,firestore
echo - Sélectionnez un projet existant ou créez-en un nouveau
echo - Pour hosting, utilisez "dist" comme dossier public
echo - Configurez une application à page unique: oui
echo - Pour functions, choisissez JavaScript

REM Préparer les fichiers Firebase
echo ✓ Préparation des fichiers Firebase...

REM Créer un dossier pour les fonctions
if not exist functions\src mkdir functions\src

REM Copier le fichier de configuration des fonctions
if exist firebase\functions\index.js (
  copy firebase\functions\index.js functions\index.js
) else (
  copy src\backend\worker.js functions\index.js
  echo const functions = require('firebase-functions');>> functions\index.js
  echo exports.api = functions.https.onRequest(handleRequest);>> functions\index.js
)

REM Copier les fichiers frontend
if not exist dist mkdir dist
xcopy /E /I src\frontend\* dist\

REM Installer les dépendances pour les fonctions
echo ✓ Installation des dépendances...
cd functions
call npm install firebase-admin firebase-functions axios cors
cd ..

REM Déployer sur Firebase
echo ✓ Déploiement sur Firebase...
call firebase deploy

REM Afficher l'URL du site
call firebase hosting:channel:list
echo 📱 Votre assistant est disponible sur le domaine Firebase gratuit affiché ci-dessus
goto :EOF

:DeployToCloudflare
echo Vous avez choisi Cloudflare Workers comme plateforme de déploiement.

REM Installer Wrangler (CLI Cloudflare)
echo ✓ Installation de Wrangler (CLI Cloudflare)...
call npm install -g wrangler

REM Authentification Cloudflare
echo ✓ Connexion à votre compte Cloudflare...
call wrangler login

REM Déployer le worker
echo ✓ Déploiement du Worker Cloudflare...
call wrangler deploy

REM Configuration du frontend
echo ✓ Configuration du frontend...
if not exist dist mkdir dist
xcopy /E /I src\frontend\* dist\

echo Pour lier votre domaine personnalisé ou utiliser un sous-domaine workers.dev gratuit,
echo suivez les instructions dans la documentation Cloudflare.
goto :EOF