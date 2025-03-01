/**
 * ZeroConfig Personal Assistant - Composant d'authentification
 * 
 * Un composant web qui gère l'authentification via Google OAuth
 * sans besoin de mot de passe (magic link)
 */

class AuthComponent extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    
    // États
    this.isAuthenticated = false;
    this.userEmail = '';
    this.loading = false;
    
    // Vérifier l'authentification depuis le stockage local
    this.checkAuth();
    
    // Rendu initial
    this.render();
  }
  
  async checkAuth() {
    // Vérifier si un token existe dans le stockage local
    const token = localStorage.getItem('auth_token');
    const tokenExpiry = localStorage.getItem('auth_token_expiry');
    
    if (!token || !tokenExpiry) {
      this.isAuthenticated = false;
      this.updateUI();
      return;
    }
    
    // Vérifier si le token est expiré
    if (new Date().getTime() > parseInt(tokenExpiry)) {
      // Token expiré, supprimer
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_token_expiry');
      localStorage.removeItem('user_email');
      
      this.isAuthenticated = false;
      this.updateUI();
      return;
    }
    
    // Token valide, récupérer les informations utilisateur
    this.userEmail = localStorage.getItem('user_email') || '';
    this.isAuthenticated = true;
    this.updateUI();
    
    // Vérifier le token avec Google
    this.verifyToken(token);
  }
  
  async verifyToken(token) {
    try {
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      
      if (!response.ok) {
        throw new Error('Token invalide');
      }
      
      const data = await response.json();
      
      // Mettre à jour les informations utilisateur
      this.userEmail = data.email;
      localStorage.setItem('user_email', data.email);
      
      // Si tout est ok, rien à faire, le token est toujours valide
      this.isAuthenticated = true;
      this.updateUI();
    } catch (error) {
      console.error('Erreur de vérification du token:', error);
      
      // Token invalide, supprimer
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_token_expiry');
      localStorage.removeItem('user_email');
      
      this.isAuthenticated = false;
      this.updateUI();
    }
  }
  
  async initiateGoogleAuth() {
    // Configuration OAuth pour Google
    const clientId = '123456789-example.apps.googleusercontent.com'; // À remplacer via l'interface de configuration
    const redirectUri = encodeURIComponent(window.location.origin + '/auth_callback.html');
    const scope = encodeURIComponent('email profile');
    const responseType = 'token id_token';
    const prompt = 'select_account';
    
    // Construction de l'URL OAuth
    const authUrl = `https://accounts.google.com/o/oauth2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scope}&response_type=${responseType}&prompt=${prompt}`;
    
    // Utilisation d'une popup pour l'authentification
    const authWindow = window.open(authUrl, 'GoogleAuth', 'width=500,height=600');
    
    // Écouter l'événement de message depuis la popup
    window.addEventListener('message', this.handleAuthMessage.bind(this), { once: true });
    
    // Timer pour détecter la fermeture de la popup
    const checkClosed = setInterval(() => {
      if (authWindow.closed) {
        clearInterval(checkClosed);
        this.loading = false;
        this.updateUI();
      }
    }, 500);
  }
  
  handleAuthMessage(event) {
    // S'assurer que le message vient de notre domaine
    if (event.origin !== window.location.origin) {
      return;
    }
    
    const { token, error, email } = event.data;
    
    if (error) {
      console.error('Erreur d\'authentification:', error);
      this.showError(error);
      this.loading = false;
      this.updateUI();
      return;
    }
    
    if (token) {
      // Calculer l'expiration (1 heure)
      const expiry = new Date().getTime() + 3600000;
      
      // Stocker le token et l'email
      localStorage.setItem('auth_token', token);
      localStorage.setItem('auth_token_expiry', expiry.toString());
      localStorage.setItem('user_email', email);
      
      // Mettre à jour l'état
      this.isAuthenticated = true;
      this.userEmail = email;
      this.loading = false;
      
      // Mettre à jour l'interface
      this.updateUI();
      
      // Déclencher un événement d'authentification réussie
      this.dispatchEvent(new CustomEvent('auth-success', { 
        detail: { email },
        bubbles: true, 
        composed: true 
      }));
    }
  }
  
  logout() {
    // Supprimer les informations d'authentification
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_token_expiry');
    localStorage.removeItem('user_email');
    
    // Mettre à jour l'état
    this.isAuthenticated = false;
    this.userEmail = '';
    
    // Mettre à jour l'interface
    this.updateUI();
    
    // Déclencher un événement de déconnexion
    this.dispatchEvent(new CustomEvent('auth-logout', { 
      bubbles: true, 
      composed: true 
    }));
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
  
  updateUI() {
    // Mettre à jour l'interface en fonction de l'état d'authentification
    const authContainer = this.shadowRoot.querySelector('.auth-container');
    const userInfo = this.shadowRoot.querySelector('.user-info');
    const loginButton = this.shadowRoot.querySelector('#login-button');
    
    if (this.isAuthenticated) {
      authContainer.style.display = 'none';
      userInfo.style.display = 'flex';
      
      // Mettre à jour les informations utilisateur
      this.shadowRoot.querySelector('#user-email').textContent = this.userEmail;
    } else {
      authContainer.style.display = 'block';
      userInfo.style.display = 'none';
    }
    
    // Gestion de l'état de chargement
    if (this.loading) {
      loginButton.disabled = true;
      loginButton.textContent = 'Connexion en cours...';
    } else {
      loginButton.disabled = false;
      loginButton.textContent = 'Se connecter avec Google';
    }
  }
  
  login() {
    this.loading = true;
    this.updateUI();
    this.initiateGoogleAuth();
  }
  
  connectedCallback() {
    // Ajouter les écouteurs d'événements
    this.shadowRoot.querySelector('#login-button').addEventListener('click', () => {
      this.login();
    });
    
    this.shadowRoot.querySelector('#logout-button').addEventListener('click', () => {
      this.logout();
    });
  }
  
  render() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', sans-serif;
        }
        
        .container {
          padding: 20px;
          border-radius: 8px;
          background: #f9f9f9;
          box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          max-width: 400px;
          margin: 0 auto;
        }
        
        h3 {
          margin-top: 0;
          color: #333;
          text-align: center;
        }
        
        .auth-container {
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        
        .auth-container p {
          text-align: center;
          color: #666;
          margin-bottom: 20px;
        }
        
        #login-button {
          background: #4285F4;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 4px;
          font-size: 16px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background-color 0.3s;
        }
        
        #login-button:hover {
          background: #3367D6;
        }
        
        #login-button:disabled {
          background: #A4A4A4;
          cursor: not-allowed;
        }
        
        .user-info {
          display: none;
          flex-direction: column;
          align-items: center;
        }
        
        .user-avatar {
          width: 64px;
          height: 64px;
          border-radius: 50%;
          background: #e0e0e0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 15px;
          font-size: 24px;
          color: #555;
        }
        
        .user-details {
          display: flex;
          flex-direction: column;
          align-items: center;
          margin-bottom: 20px;
        }
        
        #user-email {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .user-status {
          color: #4CAF50;
          font-size: 14px;
        }
        
        #logout-button {
          background: transparent;
          color: #e74c3c;
          border: 1px solid #e74c3c;
          padding: 8px 16px;
          border-radius: 4px;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        #logout-button:hover {
          background: #e74c3c;
          color: white;
        }
        
        #error {
          display: none;
          margin-top: 15px;
          padding: 10px;
          background: #ffecec;
          color: #e74c3c;
          border-radius: 4px;
          font-size: 14px;
          text-align: center;
        }
      </style>
      
      <div class="container">
        <h3>Authentification</h3>
        
        <div class="auth-container">
          <p>Connectez-vous pour accéder à votre assistant personnel</p>
          <button id="login-button">
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18">
              <path fill="#FFF" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
              <path fill="#FFF" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FFF" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#FFF" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Se connecter avec Google
          </button>
        </div>
        
        <div class="user-info">
          <div class="user-avatar">
            <span>👤</span>
          </div>
          <div class="user-details">
            <div id="user-email"></div>
            <div class="user-status">Connecté</div>
          </div>
          <button id="logout-button">Se déconnecter</button>
        </div>
        
        <div id="error"></div>
      </div>
    `;
  }
}

// Définir le composant personnalisé
customElements.define('auth-component', AuthComponent);