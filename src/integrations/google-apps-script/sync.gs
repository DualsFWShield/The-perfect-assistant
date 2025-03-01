/**
 * ZeroConfig Personal Assistant - Script de synchronisation Gmail/Calendar
 * 
 * Ce script doit être déployé dans Google Apps Script et configuré
 * pour s'exécuter à intervalles réguliers via les déclencheurs.
 */

// Configuration - à modifier via l'interface web de l'assistant
const CONFIG = {
  WEBHOOK_URL: 'https://api.yourdomain.com/api/sync-webhook',
  SPREADSHEET_ID: '1ABC123DEF456GHI789JKL0123456789', // ID de la feuille de calcul Google Sheets
  EMAIL_LABEL: 'Assistant/ToProcess', // Libellé Gmail pour les emails à traiter
  DAYS_TO_KEEP: 7, // Nombre de jours à conserver dans l'historique
  MAX_EMAILS: 50, // Nombre maximum d'emails à traiter en une fois
  WHITELIST_EMAILS: [] // Sera rempli via l'interface web
};

// Fonction principale exécutée par le déclencheur
function syncGmailCalendarToSheets() {
  try {
    // Charger la configuration depuis la feuille de configuration
    loadConfig();
    
    // Vérifier la dernière exécution
    const lastRun = getLastRunTimestamp();
    const now = new Date();
    
    // Enregistrer la date d'exécution actuelle
    setLastRunTimestamp(now);
    
    // Synchroniser les emails non lus avec le libellé spécifié
    const emailsData = syncEmails(lastRun);
    
    // Synchroniser les événements du calendrier
    const eventsData = syncCalendarEvents(lastRun);
    
    // Nettoyer les anciennes données
    cleanupOldData();
    
    // Envoyer les mises à jour au webhook
    sendWebhookUpdate({
      emails: emailsData,
      events: eventsData,
      timestamp: now.getTime()
    });
    
    return {
      success: true,
      emailsCount: emailsData.length,
      eventsCount: eventsData.length,
      timestamp: now.getTime()
    };
  } catch (error) {
    Logger.log(`Erreur lors de la synchronisation: ${error.toString()}`);
    
    // Envoyer l'erreur au webhook
    sendWebhookUpdate({
      error: error.toString(),
      timestamp: new Date().getTime()
    });
    
    return {
      success: false,
      error: error.toString()
    };
  }
}

// Charger la configuration depuis la feuille "Config"
function loadConfig() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const configSheet = spreadsheet.getSheetByName('Config');
    
    if (!configSheet) {
      Logger.log('Feuille de configuration non trouvée. Utilisation des valeurs par défaut.');
      return;
    }
    
    const data = configSheet.getDataRange().getValues();
    
    // Ignorer la ligne d'en-tête
    for (let i = 1; i < data.length; i++) {
      const key = data[i][0];
      const value = data[i][1];
      
      if (key && value) {
        // Traitement spécial pour la liste des emails whitelist
        if (key === 'WHITELIST_EMAILS') {
          CONFIG.WHITELIST_EMAILS = value.split(',').map(email => email.trim());
        } 
        // Nombres
        else if (['DAYS_TO_KEEP', 'MAX_EMAILS'].includes(key)) {
          CONFIG[key] = parseInt(value);
        }
        // Chaînes de caractères
        else {
          CONFIG[key] = value;
        }
      }
    }
  } catch (error) {
    Logger.log(`Erreur lors du chargement de la configuration: ${error.toString()}`);
  }
}

// Récupérer le timestamp de la dernière exécution
function getLastRunTimestamp() {
  const userProperties = PropertiesService.getUserProperties();
  const lastRunStr = userProperties.getProperty('lastRun');
  
  if (!lastRunStr) {
    // Si pas de dernière exécution, utiliser une date 24h plus tôt
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday;
  }
  
  return new Date(parseInt(lastRunStr));
}

// Enregistrer le timestamp de l'exécution actuelle
function setLastRunTimestamp(timestamp) {
  const userProperties = PropertiesService.getUserProperties();
  userProperties.setProperty('lastRun', timestamp.getTime().toString());
}

// Synchroniser les emails récents avec le libellé spécifié
function syncEmails(lastRun) {
  // Créer une requête pour obtenir les emails récents avec le libellé spécifié
  let query = '';
  
  if (CONFIG.EMAIL_LABEL) {
    query += `label:${CONFIG.EMAIL_LABEL} `;
  }
  
  // Emails après la dernière exécution
  const formattedDate = Utilities.formatDate(lastRun, 'GMT', 'yyyy/MM/dd');
  query += `after:${formattedDate}`;
  
  // Obtenir les threads correspondants
  const threads = GmailApp.search(query, 0, CONFIG.MAX_EMAILS);
  const emailsData = [];
  
  // Traiter chaque thread
  threads.forEach(thread => {
    const messages = thread.getMessages();
    
    // Traiter uniquement le premier message du thread pour la simplicité
    if (messages.length > 0) {
      const message = messages[0];
      
      // Vérifier si l'expéditeur est dans la whitelist (si configurée)
      const sender = message.getFrom();
      if (CONFIG.WHITELIST_EMAILS.length > 0) {
        const isWhitelisted = CONFIG.WHITELIST_EMAILS.some(email => 
          sender.toLowerCase().includes(email.toLowerCase())
        );
        
        if (!isWhitelisted) {
          return; // Ignorer cet email
        }
      }
      
      // Extraire les informations pertinentes
      const email = {
        id: message.getId(),
        threadId: thread.getId(),
        subject: message.getSubject(),
        sender: sender,
        receivedAt: message.getDate().getTime(),
        isRead: message.isRead(),
        isStarred: thread.isStarred(),
        snippet: message.getPlainBody().substring(0, 200), // Extrait court du corps
        hasAttachments: message.getAttachments().length > 0,
        labels: thread.getLabels().map(label => label.getName())
      };
      
      emailsData.push(email);
      
      // Marquer le thread comme lu
      if (!message.isRead()) {
        message.markRead();
      }
      
      // Ajouter un libellé "Processed"
      const processedLabel = getOrCreateLabel('Assistant/Processed');
      thread.addLabel(processedLabel);
      
      // Supprimer le libellé "ToProcess"
      if (CONFIG.EMAIL_LABEL) {
        const toProcessLabel = GmailApp.getUserLabelByName(CONFIG.EMAIL_LABEL);
        if (toProcessLabel) {
          thread.removeLabel(toProcessLabel);
        }
      }
    }
  });
  
  // Enregistrer les données dans la feuille "Emails"
  saveEmailsToSheet(emailsData);
  
  return emailsData;
}

// Obtenir ou créer un libellé Gmail
function getOrCreateLabel(labelName) {
  let label = GmailApp.getUserLabelByName(labelName);
  
  if (!label) {
    label = GmailApp.createLabel(labelName);
  }
  
  return label;
}

// Enregistrer les données d'emails dans la feuille "Emails"
function saveEmailsToSheet(emails) {
  if (emails.length === 0) {
    return;
  }
  
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName('Emails');
    
    // Créer la feuille si elle n'existe pas
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Emails');
      sheet.appendRow([
        'ID', 'Thread ID', 'Subject', 'Sender', 'Received At', 
        'Is Read', 'Is Starred', 'Snippet', 'Has Attachments', 
        'Labels', 'Processed At'
      ]);
      
      // Formater l'en-tête
      sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
    }
    
    // Préparer les données à insérer
    const now = new Date().getTime();
    const rowsToAdd = emails.map(email => [
      email.id,
      email.threadId,
      email.subject,
      email.sender,
      new Date(email.receivedAt),
      email.isRead ? 'Yes' : 'No',
      email.isStarred ? 'Yes' : 'No',
      email.snippet,
      email.hasAttachments ? 'Yes' : 'No',
      email.labels.join(', '),
      new Date(now)
    ]);
    
    // Ajouter les lignes à la feuille
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 11).setValues(rowsToAdd);
  } catch (error) {
    Logger.log(`Erreur lors de l'enregistrement des emails: ${error.toString()}`);
    throw error;
  }
}

// Synchroniser les événements du calendrier
function syncCalendarEvents(lastRun) {
  // Calculer la plage de dates
  const now = new Date();
  const maxDate = new Date();
  maxDate.setDate(now.getDate() + 14); // 2 semaines en avant
  
  // Obtenir les événements
  const calendar = CalendarApp.getDefaultCalendar();
  const events = calendar.getEvents(lastRun, maxDate);
  
  const eventsData = [];
  
  events.forEach(event => {
    // Extraire les informations pertinentes
    const eventData = {
      id: event.getId(),
      title: event.getTitle(),
      description: event.getDescription(),
      location: event.getLocation(),
      startTime: event.getStartTime().getTime(),
      endTime: event.getEndTime().getTime(),
      isAllDay: event.isAllDay(),
      organizer: event.getCreators()[0] || '',
      guests: event.getGuestList().map(guest => ({
        email: guest.getEmail(),
        name: guest.getName(),
        status: guest.getStatus()
      })),
      hasReminders: event.getPopupReminders().length > 0
    };
    
    eventsData.push(eventData);
  });
  
  // Enregistrer les données dans la feuille "Events"
  saveEventsToSheet(eventsData);
  
  return eventsData;
}

// Enregistrer les données d'événements dans la feuille "Events"
function saveEventsToSheet(events) {
  if (events.length === 0) {
    return;
  }
  
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    let sheet = spreadsheet.getSheetByName('Events');
    
    // Créer la feuille si elle n'existe pas
    if (!sheet) {
      sheet = spreadsheet.insertSheet('Events');
      sheet.appendRow([
        'ID', 'Title', 'Description', 'Location', 'Start Time', 
        'End Time', 'Is All Day', 'Organizer', 'Guests', 
        'Has Reminders', 'Synced At'
      ]);
      
      // Formater l'en-tête
      sheet.getRange(1, 1, 1, 11).setFontWeight('bold');
    }
    
    // Préparer les données à insérer
    const now = new Date().getTime();
    const rowsToAdd = events.map(event => [
      event.id,
      event.title,
      event.description,
      event.location,
      new Date(event.startTime),
      new Date(event.endTime),
      event.isAllDay ? 'Yes' : 'No',
      event.organizer,
      JSON.stringify(event.guests),
      event.hasReminders ? 'Yes' : 'No',
      new Date(now)
    ]);
    
    // Ajouter les lignes à la feuille
    sheet.getRange(sheet.getLastRow() + 1, 1, rowsToAdd.length, 11).setValues(rowsToAdd);
  } catch (error) {
    Logger.log(`Erreur lors de l'enregistrement des événements: ${error.toString()}`);
    throw error;
  }
}

// Nettoyer les anciennes données
function cleanupOldData() {
  try {
    const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    
    // Nettoyer les emails anciens
    cleanupOldSheetData(spreadsheet, 'Emails', 5, CONFIG.DAYS_TO_KEEP); // Colonne 5 = Received At
    
    // Nettoyer les événements anciens (passés)
    cleanupOldSheetData(spreadsheet, 'Events', 5, CONFIG.DAYS_TO_KEEP); // Colonne 5 = Start Time
    
  } catch (error) {
    Logger.log(`Erreur lors du nettoyage des données: ${error.toString()}`);
    throw error;
  }
}

// Nettoyer les données anciennes d'une feuille spécifique
function cleanupOldSheetData(spreadsheet, sheetName, dateColumn, daysToKeep) {
  const sheet = spreadsheet.getSheetByName(sheetName);
  
  if (!sheet) {
    return;
  }
  
  // Calculer la date limite
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
  
  // Obtenir toutes les données
  const data = sheet.getDataRange().getValues();
  
  // Ignorer la ligne d'en-tête
  const rowsToDelete = [];
  for (let i = 1; i < data.length; i++) {
    const rowDate = new Date(data[i][dateColumn - 1]); // Ajuster l'index
    
    if (rowDate < cutoffDate) {
      // Ajouter l'index de ligne (en commençant par 1)
      rowsToDelete.push(i + 1); // +1 car les indices de ligne commencent à 1
    }
  }
  
  // Supprimer les lignes, en commençant par la fin pour éviter le décalage des indices
  for (let i = rowsToDelete.length - 1; i >= 0; i--) {
    sheet.deleteRow(rowsToDelete[i]);
  }
}

// Envoyer une mise à jour au webhook
function sendWebhookUpdate(data) {
  if (!CONFIG.WEBHOOK_URL) {
    return;
  }
  
  try {
    // Ajouter une signature pour l'authentification
    const signature = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      data.timestamp + SESSION_SECRET,
      Utilities.Charset.UTF_8
    );
    
    const payload = {
      data: data,
      signature: Utilities.base64Encode(signature)
    };
    
    // Faire la requête POST
    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload)
    };
    
    UrlFetchApp.fetch(CONFIG.WEBHOOK_URL, options);
  } catch (error) {
    Logger.log(`Erreur lors de l'envoi au webhook: ${error.toString()}`);
  }
}

// Endpoint pour les actions à distance (déclenchées par l'API)
function doPost(e) {
  try {
    // Vérifier l'authentification
    const payload = JSON.parse(e.postData.contents);
    
    if (!payload.action || !payload.timestamp || !payload.signature) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Paramètres manquants' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Vérifier la signature
    const expectedSignature = Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      payload.timestamp + SESSION_SECRET,
      Utilities.Charset.UTF_8
    );
    
    const providedSignature = Utilities.base64Decode(payload.signature);
    
    if (!Utilities.newBlob(expectedSignature).getBytes().every((byte, i) => byte === providedSignature[i])) {
      return ContentService.createTextOutput(
        JSON.stringify({ success: false, error: 'Signature invalide' })
      ).setMimeType(ContentService.MimeType.JSON);
    }
    
    // Traiter l'action demandée
    switch (payload.action) {
      case 'sync':
        const result = syncGmailCalendarToSheets();
        return ContentService.createTextOutput(
          JSON.stringify(result)
        ).setMimeType(ContentService.MimeType.JSON);
        
      case 'createEvent':
        // Créer un événement dans Google Calendar
        if (!payload.event) {
          throw new Error('Paramètres d\'événement manquants');
        }
        
        const event = createCalendarEvent(payload.event);
        return ContentService.createTextOutput(
          JSON.stringify({ success: true, eventId: event.getId() })
        ).setMimeType(ContentService.MimeType.JSON);
        
      case 'updateConfig':
        // Mettre à jour la configuration
        if (!payload.config) {
          throw new Error('Configuration manquante');
        }
        
        updateConfigSheet(payload.config);
        return ContentService.createTextOutput(
          JSON.stringify({ success: true })
        ).setMimeType(ContentService.MimeType.JSON);
        
      default:
        throw new Error('Action non reconnue');
    }
  } catch (error) {
    return ContentService.createTextOutput(
      JSON.stringify({ success: false, error: error.toString() })
    ).setMimeType(ContentService.MimeType.JSON);
  }
}

// Créer un événement dans Google Calendar
function createCalendarEvent(eventData) {
  const calendar = CalendarApp.getDefaultCalendar();
  
  // Créer l'événement
  const event = calendar.createEvent(
    eventData.title,
    new Date(eventData.startTime),
    new Date(eventData.endTime),
    {
      description: eventData.description,
      location: eventData.location,
      guests: eventData.guests ? eventData.guests.join(',') : ''
    }
  );
  
  // Ajouter des rappels si demandé
  if (eventData.reminders && eventData.reminders.length > 0) {
    eventData.reminders.forEach(reminder => {
      event.addPopupReminder(reminder);
    });
  }
  
  return event;
}

// Mettre à jour la feuille de configuration
function updateConfigSheet(config) {
  const spreadsheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  let configSheet = spreadsheet.getSheetByName('Config');
  
  // Créer la feuille si elle n'existe pas
  if (!configSheet) {
    configSheet = spreadsheet.insertSheet('Config');
    configSheet.appendRow(['Key', 'Value', 'Description']);
    
    // Formater l'en-tête
    configSheet.getRange(1, 1, 1, 3).setFontWeight('bold');
  } else {
    // Effacer le contenu existant, mais garder l'en-tête
    const lastRow = configSheet.getLastRow();
    if (lastRow > 1) {
      configSheet.getRange(2, 1, lastRow - 1, 3).clearContent();
    }
  }
  
  // Préparer les données à insérer
  const rowsToAdd = [];
  
  // Utiliser les descriptions prédéfinies pour les clés connues
  const descriptions = {
    WEBHOOK_URL: 'URL du webhook pour les notifications',
    EMAIL_LABEL: 'Libellé Gmail pour les emails à traiter',
    DAYS_TO_KEEP: 'Nombre de jours à conserver dans l\'historique',
    MAX_EMAILS: 'Nombre maximum d\'emails à traiter en une fois',
    WHITELIST_EMAILS: 'Liste d\'emails autorisés (séparés par des virgules)'
  };
  
  // Ajouter chaque clé de configuration
  for (const [key, value] of Object.entries(config)) {
    const row = [
      key,
      Array.isArray(value) ? value.join(',') : value.toString(),
      descriptions[key] || ''
    ];
    
    rowsToAdd.push(row);
  }
  
  // Ajouter les lignes à la feuille
  if (rowsToAdd.length > 0) {
    configSheet.getRange(2, 1, rowsToAdd.length, 3).setValues(rowsToAdd);
  }
}

// Variable globale pour le secret de session (généré au déploiement)
const SESSION_SECRET = PropertiesService.getScriptProperties().getProperty('SESSION_SECRET') || 'default-secret';

// Configuration initiale (exécutée lors du déploiement)
function setup() {
  // Générer un secret de session
  const newSecret = Utilities.getUuid();
  PropertiesService.getScriptProperties().setProperty('SESSION_SECRET', newSecret);
  
  // Créer les déclencheurs
  const triggers = ScriptApp.getProjectTriggers();
  
  // Supprimer les déclencheurs existants
  triggers.forEach(trigger => {
    ScriptApp.deleteTrigger(trigger);
  });
  
  // Ajouter un déclencheur quotidien
  ScriptApp.newTrigger('syncGmailCalendarToSheets')
    .timeBased()
    .everyDays(1)
    .atHour(1)
    .create();
  
  // Ajouter un déclencheur toutes les heures
  ScriptApp.newTrigger('syncGmailCalendarToSheets')
    .timeBased()
    .everyHours(1)
    .create();
    
  return {
    success: true,
    message: 'Script configuré avec succès',
    secret: newSecret
  };
}