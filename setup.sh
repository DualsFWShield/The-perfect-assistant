#!/bin/bash

# Script de déploiement ZeroConfig Personal Assistant
# Ce script configure et déploie l'assistant personnel sur Cloudflare Workers

echo "🚀 Installation de l'Assistant Personnel ZeroConfig..."

# 1. Vérifier les prérequis
echo "✓ Vérification des prérequis..."
command -v npm >/dev/null 2>&1 || { echo "❌ npm est requis mais n'est pas installé. Veuillez installer Node.js."; exit 1; }

# 2. Installer wrangler (CLI Cloudflare)
echo "✓ Installation de Wrangler (CLI Cloudflare)..."
npm install -g wrangler

# 3. Authentification Cloudflare (interactif)
echo "✓ Connexion à votre compte Cloudflare..."
wrangler login

# 4. Déployer le worker
echo "✓ Déploiement du Worker Cloudflare..."
wrangler deploy

# 5. Générer un certificat pour le frontend
echo "✓ Configuration du frontend..."
mkdir -p dist
cp -r src/frontend/* dist/

# 6. Instructions pour Google Apps Script
echo "
🔹 ÉTAPES FINALES (MANUEL) 🔹

1. Ouvrez https://script.google.com/
2. Créez un nouveau projet et copiez le contenu de src/integrations/google-apps-script/sync.gs
3. Déployez comme application web avec les paramètres suivants:
   - Exécuter en tant que: Moi-même
   - Qui a accès: Uniquement moi
4. Copiez l'URL du déploiement et configurez-la dans l'interface de l'assistant

✨ Installation terminée ! ✨
"

echo "📱 Pour accéder à votre assistant, ouvrez: https://votre-domaine.com"