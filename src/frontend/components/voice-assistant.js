/**
 * ZeroConfig Personal Assistant - Composant d'assistant vocal
 * 
 * Un composant web qui gère la reconnaissance vocale et l'interaction avec l'API
 */

class VoiceAssistant extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // État interne
    this.listening = false;
    this.recognizing = false;
    this.lastCommand = '';
    this.recognition = null;
    this.synth = window.speechSynthesis;
    
    // Initialiser la reconnaissance vocale si disponible
    this.initSpeechRecognition();
    
    // Rendu initial
    this.render();
  }
  
  initSpeechRecognition() {
    // Vérifier la compatibilité du navigateur
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      this.showError("Votre navigateur ne supporte pas la reconnaissance vocale.");
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = false;
    this.recognition.interimResults = true;
    this.recognition.lang = 'fr-FR';
    
    // Gestionnaires d'événements
    this.recognition.onstart = () => {
      this.recognizing = true;
      this.updateUI();
    };
    
    this.recognition.onerror = (event) => {
      console.error("Erreur de reconnaissance vocale:", event.error);
      this.showError(`Erreur: ${event.error}`);
      this.stopListening();
    };
    
    this.recognition.onend = () => {
      this.recognizing = false;
      if (this.listening) {
        // Redémarrer si on est toujours en mode écoute
        this.recognition.start();
      } else {
        this.updateUI();
      }
    };
    
    this.recognition.onresult = (event) => {
      const interim = Array.from(event.results)
        .map(result => result[0].transcript)
        .join('');
        
      this.shadowRoot.querySelector('#interim-text').textContent = interim;
      
      // Si c'est un résultat final, traiter la commande
      if (event.results[0].isFinal) {
        const command = event.results[0][0].transcript.trim();
        this.processCommand(command);
      }
    };
  }
  
  async processCommand(command) {
    // Afficher la commande reconnue
    this.lastCommand = command;
    this.updateUI();
    
    // Obtenir le token d'authentification depuis le stockage local
    const token = localStorage.getItem('auth_token');
    if (!token) {
      this.showError("Vous n'êtes pas connecté. Veuillez vous connecter d'abord.");
      return;
    }
    
    try {
      // Arrêter l'écoute pendant le traitement
      this.stopListening();
      
      // Appeler l'API backend
      const response = await fetch('https://api.yourdomain.com/api/voice-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ command })
      });
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const result = await response.json();
      
      // Afficher et prononcer la réponse
      this.displayResponse(result);
      
      // Si la confidence est basse, demander confirmation
      if (result.confidence < 0.7) {
        this.askForConfirmation(result);
      }
      
    } catch (error) {
      console.error("Erreur lors du traitement de la commande:", error);
      this.showError(`Erreur: ${error.message}`);
      
      // Essayer de charger une réponse locale en cas d'échec réseau
      this.tryLocalFallback(command);
    }
  }
  
  displayResponse(result) {
    const responseElem = this.shadowRoot.querySelector('#response');
    
    // Créer un élément de réponse structuré
    let html = '<div class="response-card">';
    
    if (result.commandType) {
      html += `<div class="command-type">${this.getHumanReadableCommandType(result.commandType)}</div>`;
    }
    
    if (result.params) {
      html += '<div class="params">';
      for (const [key, value] of Object.entries(result.params)) {
        html += `<div class="param"><span>${this.getHumanReadableParam(key)}:</span> ${value}</div>`;
      }
      html += '</div>';
    }
    
    if (result.suggestions && result.suggestions.length > 0) {
      html += '<div class="suggestions">';
      html += '<h4>Suggestions:</h4>';
      html += '<ul>';
      result.suggestions.forEach(suggestion => {
        html += `<li>${suggestion}</li>`;
      });
      html += '</ul>';
      html += '</div>';
    }
    
    html += '</div>';
    
    responseElem.innerHTML = html;
    
    // Synthèse vocale pour la réponse principale
    this.speak(this.generateSpokenResponse(result));
  }
  
  getHumanReadableCommandType(type) {
    const types = {
      'email_summary': 'Résumé des emails',
      'calendar_block': 'Blocage de temps calendrier',
      'calendar_event': 'Création d\'événement',
      'reminder': 'Rappel',
      'search': 'Recherche',
      'task': 'Tâche'
    };
    
    return types[type] || type;
  }
  
  getHumanReadableParam(param) {
    const params = {
      'from': 'De',
      'to': 'À',
      'duration': 'Durée',
      'project': 'Projet',
      'date': 'Date',
      'time': 'Heure',
      'reminder': 'Rappel',
      'participants': 'Participants',
      'emails': 'Emails',
      'eventType': 'Type d\'événement',
      'weekday': 'Jour de la semaine'
    };
    
    return params[param] || param;
  }
  
  generateSpokenResponse(result) {
    // Générer une réponse vocale naturelle basée sur le résultat
    switch (result.commandType) {
      case 'email_summary':
        return `Je vais résumer vos emails${result.params.from ? ' de ' + result.params.from : ''}.`;
        
      case 'calendar_block':
        return `Je bloque ${result.params.duration}h dans votre calendrier${result.params.date ? ' pour ' + result.params.date : ''} pour le projet ${result.params.project}.`;
        
      case 'calendar_event':
        return `Je crée un événement de type ${this.getHumanReadableParam(result.params.eventType)} avec ${result.params.participants} pour ${result.params.weekday || result.params.date || 'bientôt'}.`;
        
      default:
        return "Commande traitée avec succès.";
    }
  }
  
  speak(text) {
    // Arrêter toute synthèse vocale en cours
    this.synth.cancel();
    
    // Créer un nouvel utterance
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'fr-FR';
    
    // Sélectionner une voix féminine si disponible
    const voices = this.synth.getVoices();
    const frenchVoices = voices.filter(voice => voice.lang.includes('fr'));
    if (frenchVoices.length > 0) {
      utterance.voice = frenchVoices[0];
    }
    
    // Démarrer la synthèse
    this.synth.speak(utterance);
  }
  
  askForConfirmation(result) {
    const confirmText = `Je ne suis pas sûr d'avoir bien compris. Voulez-vous ${this.generateSpokenResponse(result)}`;
    this.speak(confirmText);
    
    // Ajouter des boutons de confirmation à l'interface
    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'confirmation';
    confirmationDiv.innerHTML = `
      <p>${confirmText}</p>
      <button id="confirm-yes">Oui</button>
      <button id="confirm-no">Non</button>
    `;
    
    this.shadowRoot.querySelector('#response').appendChild(confirmationDiv);
    
    // Ajouter les écouteurs d'événements
    this.shadowRoot.querySelector('#confirm-yes').addEventListener('click', () => {
      // Continuer avec l'exécution
      this.speak("D'accord, je m'en occupe.");
      confirmationDiv.remove();
    });
    
    this.shadowRoot.querySelector('#confirm-no').addEventListener('click', () => {
      this.speak("D'accord, j'annule cette action.");
      confirmationDiv.remove();
    });
  }
  
  tryLocalFallback(command) {
    // Essayer des règles simples locales pour les commandes de base
    const lowerCommand = command.toLowerCase();
    
    if (lowerCommand.includes('résume') && lowerCommand.includes('email')) {
      this.displayLocalResponse({
        commandType: 'email_summary',
        params: {},
        message: "Mode hors ligne: Je ne peux pas accéder à vos emails actuellement."
      });
    } 
    else if (lowerCommand.includes('bloque') && lowerCommand.includes('pour')) {
      this.displayLocalResponse({
        commandType: 'calendar_block',
        params: {},
        message: "Mode hors ligne: Je ne peux pas accéder à votre calendrier actuellement."
      });
    }
    else {
      this.displayLocalResponse({
        commandType: 'unknown',
        params: {},
        message: "Mode hors ligne: Commande non reconnue en mode local."
      });
    }
  }
  
  displayLocalResponse(result) {
    const responseElem = this.shadowRoot.querySelector('#response');
    responseElem.innerHTML = `
      <div class="offline-response">
        <div class="offline-icon">⚠️ Mode hors ligne</div>
        <div class="command-type">${this.getHumanReadableCommandType(result.commandType)}</div>
        <div class="message">${result.message}</div>
      </div>
    `;
    
    this.speak(result.message);
  }
  
  showError(message) {
    const errorElem = this.shadowRoot.querySelector('#error');
    errorElem.textContent = message;
    errorElem.style.display = 'block';
    
    // Masquer après 5 secondes
    setTimeout(() => {
      errorElem.style.display = 'none';
    }, 5000);
  }
  
  startListening() {
    if (!this.recognition) {
      this.showError("La reconnaissance vocale n'est pas disponible.");
      return;
    }
    
    this.listening = true;
    this.recognition.start();
    this.updateUI();
  }
  
  stopListening() {
    this.listening = false;
    if (this.recognition && this.recognizing) {
      this.recognition.stop();
    }
    this.updateUI();
  }
  
  toggleListening() {
    if (this.listening) {
      this.stopListening();
    } else {
      this.startListening();
    }
  }
  
  updateUI() {
    const micButton = this.shadowRoot.querySelector('#mic-button');
    const statusIndicator = this.shadowRoot.querySelector('#status');
    const interimText = this.shadowRoot.querySelector('#interim-text');
    
    if (this.listening) {
      micButton.classList.add('active');
      micButton.innerHTML = '<span>🔴</span> Arrêter';
      statusIndicator.textContent = this.recognizing ? 'Écoute en cours...' : 'Initialisation...';
      statusIndicator.className = 'status listening';
    } else {
      micButton.classList.remove('active');
      micButton.innerHTML = '<span>🎙️</span> Écouter';
      statusIndicator.textContent = 'En attente';
      statusIndicator.className = 'status idle';
      interimText.textContent = '';
    }
  }
  
  connectedCallback() {
    // Ajouter les écouteurs d'événements une fois que le composant est ajouté au DOM
    this.shadowRoot.querySelector('#mic-button').addEventListener('click', () => {
      this.toggleListening();
    });
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Icons', 'Helvetica Neue', Helvetica, Arial, sans-serif;
          max-width: 600px;
          margin: 0 auto;
          --apple-blue: #0071e3;
          --apple-red: #ff3b30;
          --apple-green: #34c759;
          --apple-gray: #8e8e93;
          --apple-light-gray: #f5f5f7;
          --apple-dark-text: #1d1d1f;
          --apple-secondary-text: #86868b;
        }
        
        .container {
          padding: 24px;
          border-radius: 18px;
          background: #ffffff;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
        }
        
        h2 {
          margin-top: 0;
          margin-bottom: 24px;
          color: var(--apple-dark-text);
          text-align: center;
          font-weight: 600;
          font-size: 24px;
        }
        
        .control-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 28px;
        }
        
        #mic-button {
          background: var(--apple-blue);
          border: none;
          border-radius: 980px;
          padding: 12px 24px;
          font-size: 17px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 2px 8px rgba(0, 113, 227, 0.3);
        }
        
        #mic-button span {
          font-size: 20px;
        }
        
        #mic-button:hover {
          background: #0077ed;
          transform: scale(1.02);
        }
        
        #mic-button:active {
          transform: scale(0.98);
        }
        
        #mic-button.active {
          background: var(--apple-red);
          box-shadow: 0 2px 8px rgba(255, 59, 48, 0.3);
        }
        
        .status {
          margin-top: 12px;
          font-size: 15px;
          font-weight: 400;
        }
        
        .status.listening {
          color: var(--apple-red);
        }
        
        .status.idle {
          color: var(--apple-secondary-text);
        }
        
        #interim-text {
          margin-top: 16px;
          min-height: 24px;
          font-size: 17px;
          color: var(--apple-dark-text);
          text-align: center;
          font-weight: 400;
        }
        
        #last-command {
          margin-top: 28px;
          padding: 16px;
          background: var(--apple-light-gray);
          border-radius: 12px;
          font-size: 15px;
        }
        
        #last-command strong {
          font-weight: 600;
          color: var(--apple-dark-text);
        }
        
        #response {
          margin-top: 28px;
        }
        
        .response-card {
          padding: 20px;
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
          border-left: 4px solid var(--apple-green);
        }
        
        .command-type {
          font-weight: 600;
          font-size: 17px;
          margin-bottom: 12px;
          color: var(--apple-dark-text);
        }
        
        .params {
          margin-bottom: 16px;
        }
        
        .param {
          margin-bottom: 8px;
          font-size: 15px;
          color: var(--apple-dark-text);
        }
        
        .param span {
          font-weight: 500;
          color: var(--apple-blue);
        }
        
        .suggestions {
          margin-top: 16px;
          border-top: 1px solid rgba(0, 0, 0, 0.1);
          padding-top: 16px;
        }
        
        .suggestions h4 {
          margin: 0 0 12px 0;
          font-size: 15px;
          font-weight: 600;
          color: var(--apple-secondary-text);
        }
        
        .suggestions ul {
          margin: 0;
          padding-left: 20px;
        }
        
        .suggestions li {
          margin-bottom: 8px;
          font-size: 15px;
          color: var(--apple-dark-text);
        }
        
        .offline-response {
          background: #fff9e9;
          border-radius: 12px;
          padding: 20px;
          border-left: 4px solid #ff9500;
        }
        
        .offline-icon {
          font-weight: 600;
          margin-bottom: 12px;
          color: #ff9500;
          font-size: 15px;
        }
        
        .confirmation {
          margin-top: 20px;
          padding: 20px;
          background: #f0f8ff;
          border-radius: 12px;
        }
        
        .confirmation p {
          margin-top: 0;
          margin-bottom: 16px;
          font-size: 15px;
          color: var(--apple-dark-text);
        }
        
        .confirmation button {
          background: var(--apple-blue);
          color: white;
          border: none;
          padding: 8px 18px;
          margin-right: 12px;
          border-radius: 980px;
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .confirmation button:hover {
          transform: scale(1.05);
        }
        
        .confirmation button:active {
          transform: scale(0.98);
        }
        
        .confirmation button#confirm-no {
          background: var(--apple-gray);
        }
        
        #error {
          display: none;
          margin-top: 20px;
          padding: 16px;
          background: #ffecec;
          color: var(--apple-red);
          border-radius: 12px;
          font-size: 15px;
          text-align: center;
          font-weight: 500;
        }
        
        .message {
          font-size: 15px;
          line-height: 1.4;
          color: var(--apple-dark-text);
        }
      </style>
      
      <div class="container">
        <h2>Assistant Personnel</h2>
        
        <div class="control-section">
          <button id="mic-button"><span>🎙️</span> Écouter</button>
          <div id="status" class="status idle">En attente</div>
          <div id="interim-text"></div>
        </div>
        
        <div id="last-command">
          <strong>Dernière commande:</strong>
          <div>${this.lastCommand || 'Aucune commande encore...'}</div>
        </div>
        
        <div id="response"></div>
        
        <div id="error"></div>
      </div>
    `;
  }
}

// Définir le composant personnalisé
customElements.define('voice-assistant', VoiceAssistant);