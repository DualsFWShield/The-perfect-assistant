/**
 * ZeroConfig Personal Assistant - Cloudflare Worker
 * 
 * Points d'entrée principaux pour l'API backend
 */

// Configuration des environnements (accessibles via l'interface Cloudflare)
// Pas besoin de .env, tout est géré via l'interface Cloudflare Workers
const GEMINI_API_KEY = ASSISTANT_CONFIG.GEMINI_API_KEY;
const SHEETS_API_KEY = ASSISTANT_CONFIG.SHEETS_API_KEY;
const ALLOWED_ORIGIN = ASSISTANT_CONFIG.ALLOWED_ORIGIN || "https://your-pwa-domain.com";
const ALLOWED_USER_EMAIL = ASSISTANT_CONFIG.ALLOWED_USER_EMAIL;

// Middleware de sécurité
async function authenticate(request, env) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const token = authHeader.split(' ')[1];
  
  // Vérification du token via Google OAuth
  try {
    const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
    const data = await response.json();
    
    // Vérification que l'email est celui autorisé
    if (data.email !== ALLOWED_USER_EMAIL) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Stockage de l'email dans l'objet request pour utilisation ultérieure
    request.userEmail = data.email;
    return null; // Authentification réussie
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Authentication Error' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Middleware de logging et de validation
async function requestLogger(request) {
  console.log(`${request.method} ${new URL(request.url).pathname}`);
  
  // Valider le format de la requête
  if (request.method === 'POST') {
    try {
      const contentType = request.headers.get('Content-Type');
      if (!contentType || !contentType.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Content-Type must be application/json' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Vérification sommaire du corps de la requête
      const body = await request.json();
      if (!body) {
        return new Response(JSON.stringify({ error: 'Empty request body' }), { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      // Réinitialisation du corps pour les gestionnaires suivants
      request.jsonBody = body;
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }
  
  return null; // Validation réussie
}

// API Gemini avec fallback
async function processWithGemini(prompt, fallbackMode = false) {
  if (fallbackMode) {
    // Mode dégradé simple en cas d'indisponibilité de Gemini
    return {
      response: "Je suis désolé, le service Gemini est actuellement indisponible. Voici une réponse basique basée sur les règles prédéfinies.",
      source: "fallback"
    };
  }
  
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      })
    });
    
    const data = await response.json();
    
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

// Point d'entrée principal
async function handleRequest(request, env) {
  // CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      }
    });
  }

  // Middleware d'authentification
  const authError = await authenticate(request, env);
  if (authError) return authError;

  // Middleware de logging et validation
  const logError = await requestLogger(request);
  if (logError) return logError;

  // Router basique
  const url = new URL(request.url);
  const path = url.pathname;

  // Route pour les commandes vocales
  if (path === "/api/voice-command" && request.method === "POST") {
    const { command } = request.jsonBody;
    
    if (!command) {
      return new Response(JSON.stringify({ error: "Missing command parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN
        }
      });
    }
    
    const result = await processVoiceCommand(command, request.userEmail);
    
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN
      }
    });
  }
  
  // Route pour l'analyse IA générique
  if (path === "/api/analyze" && request.method === "POST") {
    const { prompt } = request.jsonBody;
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Missing prompt parameter" }), {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN
        }
      });
    }
    
    const result = await processWithGemini(prompt);
    
    return new Response(JSON.stringify(result), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": ALLOWED_ORIGIN
      }
    });
  }

  // Requête non gérée
  return new Response(JSON.stringify({ error: "Not Found" }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN
    }
  });
}

// Défini l'événement fetch pour Cloudflare Workers
addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request, event.env));
});

// Gestion des tâches planifiées (Cron Triggers)
addEventListener('scheduled', event => {
  event.waitUntil(handleScheduled(event));
});

async function handleScheduled(event) {
  // Exécution quotidienne à minuit (configurable dans l'interface Cloudflare)
  if (event.cron === "0 0 * * *") {
    // Audit de sécurité automatique
    await runSecurityAudit();
  }
  
  // Synchronisation périodique (toutes les heures)
  if (event.cron === "0 * * * *") {
    // Synchronisation avec Google Sheets
    await syncGoogleSheets();
  }
  
  // Nettoyage hebdomadaire (dimanche à 2h du matin)
  if (event.cron === "0 2 * * 0") {
    // Nettoyage des données anciennes
    await cleanupOldData();
  }
}

async function runSecurityAudit() {
  console.log("Running security audit...");
  // Vérification des permissions et rapports
}

async function syncGoogleSheets() {
  console.log("Syncing with Google Sheets...");
  // Logique de synchronisation
}

async function cleanupOldData() {
  console.log("Cleaning up old data...");
  // Logique de nettoyage
}