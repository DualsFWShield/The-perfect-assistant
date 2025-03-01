/**
 * ZeroConfig Personal Assistant - Firebase Functions
 * 
 * Points d'entrée principaux pour l'API backend
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');
const cors = require('cors')({origin: true});

admin.initializeApp();

// Configuration des environnements via Firebase Functions Config
// Pour définir les variables de configuration:
// firebase functions:config:set assistant.gemini_api_key="VOTRE_CLE" assistant.allowed_user_email="user@example.com"
const getConfig = () => {
  return {
    GEMINI_API_KEY: functions.config().assistant?.gemini_api_key || '',
    SHEETS_API_KEY: functions.config().assistant?.sheets_api_key || '',
    ALLOWED_ORIGIN: functions.config().assistant?.allowed_origin || "*",
    ALLOWED_USER_EMAIL: functions.config().assistant?.allowed_user_email || ''
  };
};

// Middleware de sécurité
async function authenticate(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      error: true,
      status: 401,
      message: 'Unauthorized'
    };
  }

  const token = authHeader.split(' ')[1];
  const config = getConfig();
  
  // Vérification du token via Google OAuth
  try {
    const response = await axios.get(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const data = response.data;
    
    // Vérification que l'email est celui autorisé
    if (data.email !== config.ALLOWED_USER_EMAIL) {
      return {
        error: true,
        status: 403,
        message: 'Forbidden'
      };
    }
    
    // Stockage de l'email dans l'objet request pour utilisation ultérieure
    req.userEmail = data.email;
    return {
      error: false
    };
  } catch (error) {
    console.error('Authentication Error:', error);
    return {
      error: true,
      status: 401,
      message: 'Authentication Error'
    };
  }
}

// Middleware de logging et de validation
async function requestLogger(req) {
  console.log(`${req.method} ${req.path}`);
  
  // Valider le format de la requête
  if (req.method === 'POST') {
    try {
      const contentType = req.headers['content-type'];
      if (!contentType || !contentType.includes('application/json')) {
        return {
          error: true,
          status: 400,
          message: 'Content-Type must be application/json'
        };
      }
      
      // Vérification sommaire du corps de la requête
      if (!req.body) {
        return {
          error: true,
          status: 400,
          message: 'Empty request body'
        };
      }
      
      return { error: false };
    } catch (error) {
      return {
        error: true,
        status: 400,
        message: 'Invalid JSON'
      };
    }
  }
  
  return { error: false };
}

// API Gemini avec fallback
async function processWithGemini(prompt, fallbackMode = false) {
  const config = getConfig();
  
  if (fallbackMode) {
    // Mode dégradé simple en cas d'indisponibilité de Gemini
    return {
      response: "Je suis désolé, le service Gemini est actuellement indisponible. Voici une réponse basique basée sur les règles prédéfinies.",
      source: "fallback"
    };
  }
  
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${config.GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        }
      }
    );
    
    const data = response.data;
    
    // Vérification de la réponse
    if (data.error) {
      console.error("Gemini API error:", data.error);
      // Fallback automatique en cas d'erreur
      return processWithGemini(prompt, true);
    }
    
    return {
      response: data.candidates[0].content.parts[0].text,
      source: "gemini"
    };
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return processWithGemini(prompt, true);
  }
}

// Traitement des commandes vocales
async function processVoiceCommand(command, userEmail) {
  // Extraire le type de commande et les paramètres
  let commandType = "";
  let params = {};
  
  // Reconnaissance des patterns courants
  if (command.includes("résume mes emails") || command.includes("résumer mes emails")) {
    commandType = "email_summary";
    
    // Extraction de l'expéditeur si spécifié
    const fromMatch = command.match(/de ([a-zA-Z0-9\s]+)$/);
    if (fromMatch) {
      params.from = fromMatch[1].trim();
    }
  } 
  else if (command.match(/bloque.*h.*pour/i)) {
    commandType = "calendar_block";
    
    // Extraction de la durée
    const durationMatch = command.match(/bloque\s+(\d+)h/i);
    if (durationMatch) {
      params.duration = parseInt(durationMatch[1]);
    }
    
    // Extraction du projet/sujet
    const projectMatch = command.match(/pour\s+le\s+projet\s+([a-zA-Z0-9\s]+)/i);
    if (projectMatch) {
      params.project = projectMatch[1].trim();
    }
    
    // Extraction de la date
    if (command.includes("demain")) {
      params.date = "tomorrow";
    } else if (command.includes("aujourd'hui")) {
      params.date = "today";
    }
    
    // Extraction de la notification
    if (command.includes("rappel SMS")) {
      params.reminder = "sms";
    } else if (command.includes("rappel email")) {
      params.reminder = "email";
    }
  }
  else if (command.match(/déjeuner|dîner|rendez-vous|réunion/i) && command.match(/avec/i)) {
    commandType = "calendar_event";
    
    // Extraction du type d'événement
    if (command.includes("déjeuner")) {
      params.eventType = "lunch";
    } else if (command.includes("dîner")) {
      params.eventType = "dinner";
    } else if (command.includes("rendez-vous")) {
      params.eventType = "meeting";
    } else if (command.includes("réunion")) {
      params.eventType = "meeting";
    }
    
    // Extraction des participants avec emails entre parenthèses
    const participantsMatch = command.match(/avec\s+([^(]+)\s*\(([^)]+)\)/);
    if (participantsMatch) {
      params.participants = participantsMatch[1].trim();
      params.emails = participantsMatch[2].split(',').map(email => email.trim());
    }
    
    // Extraction de la date/heure
    if (command.includes("demain")) {
      params.date = "tomorrow";
    } else if (command.includes("aujourd'hui")) {
      params.date = "today";
    }
    
    if (command.includes("midi")) {
      params.time = "12:00";
    } else if (command.includes("soir")) {
      params.time = "19:00";
    }
    
    // Détecter jours de la semaine
    const weekdays = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];
    for (const day of weekdays) {
      if (command.includes(day)) {
        params.weekday = day;
        break;
      }
    }
  }
  
  // Utiliser Gemini pour enrichir la compréhension de la commande
  const enrichedPrompt = `
  Analyse cette commande vocale: "${command}"
  
  J'ai déjà identifié cette commande comme étant de type: ${commandType}
  Avec ces paramètres: ${JSON.stringify(params)}
  
  Si ma classification est incorrecte, corrige-la.
  Si des paramètres sont manquants ou incorrects, corrige-les.
  Fournis également des suggestions pertinentes basées sur le contexte.
  
  Format de réponse JSON uniquement:
  {
    "commandType": "type_de_commande",
    "params": { ... },
    "suggestions": [ ... ],
    "confidence": 0-1
  }
  `;
  
  const geminiResponse = await processWithGemini(enrichedPrompt);
  
  try {
    // Tenter de parser la réponse JSON de Gemini
    const enhancedUnderstanding = JSON.parse(geminiResponse.response);
    
    // Fusionner avec notre analyse initiale
    return {
      commandType: enhancedUnderstanding.commandType || commandType,
      params: { ...params, ...enhancedUnderstanding.params },
      suggestions: enhancedUnderstanding.suggestions || [],
      confidence: enhancedUnderstanding.confidence || 0.5,
      processed: true
    };
  } catch (error) {
    console.error("Error parsing Gemini response:", error);
    // Fallback à notre analyse initiale
    return {
      commandType,
      params,
      suggestions: [],
      confidence: 0.3,
      processed: true
    };
  }
}

// Fonction Firebase pour l'API
exports.api = functions.https.onRequest(async (req, res) => {
  return cors(req, res, async () => {
    // Middleware d'authentification
    const authResult = await authenticate(req);
    if (authResult.error) {
      return res.status(authResult.status).json({ error: authResult.message });
    }

    // Middleware de logging et validation
    const logResult = await requestLogger(req);
    if (logResult.error) {
      return res.status(logResult.status).json({ error: logResult.message });
    }

    // Router basique
    const path = req.path;

    // Route pour les commandes vocales
    if (path === "/voice-command" && req.method === "POST") {
      const { command } = req.body;
      
      if (!command) {
        return res.status(400).json({ error: "Missing command parameter" });
      }
      
      const result = await processVoiceCommand(command, req.userEmail);
      return res.json(result);
    }
    
    // Route pour l'analyse IA générique
    if (path === "/analyze" && req.method === "POST") {
      const { prompt } = req.body;
      
      if (!prompt) {
        return res.status(400).json({ error: "Missing prompt parameter" });
      }
      
      const result = await processWithGemini(prompt);
      return res.json(result);
    }

    // Requête non gérée
    return res.status(404).json({ error: "Not Found" });
  });
});

// Fonction pour synchroniser avec Google Sheets (déclenchée par un cronJob)
exports.scheduledSync = functions.pubsub.schedule('every 1 hours').onRun(async (context) => {
  // Logique de synchronisation planifiée
  console.log('Running scheduled sync...');
  return null;
});

// Fonction pour l'audit de sécurité quotidien
exports.dailySecurityAudit = functions.pubsub.schedule('0 0 * * *').onRun(async (context) => {
  // Logique d'audit de sécurité
  console.log('Running daily security audit...');
  return null;
});