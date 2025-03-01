/**
 * Service Worker pour l'Assistant Personnel ZeroConfig
 * 
 * Gère le cache pour le fonctionnement hors-ligne et les mises à jour
 */

const CACHE_NAME = 'assistant-personal-v1';

// Fichiers à mettre en cache lors de l'installation
const CACHE_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/components/auth-component.js',
  '/components/voice-assistant.js',
  '/images/logo.svg',
  '/images/icon-192x192.png',
  '/images/icon-512x512.png',
  'https://cdn.jsdelivr.net/npm/localforage@1.10.0/dist/localforage.min.js',
  'https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js',
  'https://cdn.jsdelivr.net/npm/preact@10.13.2/dist/preact.min.js',
  'https://cdn.jsdelivr.net/npm/preact@10.13.2/hooks/dist/hooks.umd.js'
];

// Installation du Service Worker
self.addEventListener('install', event => {
  // Mise en cache des fichiers essentiels
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Cache ouvert');
        return cache.addAll(CACHE_ASSETS);
      })
      .then(() => {
        // Forcer l'activation immédiate sans attendre la fermeture des onglets
        return self.skipWaiting();
      })
  );
});

// Activation du Service Worker
self.addEventListener('activate', event => {
  // Nettoyage des anciens caches
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            console.log('Suppression de l\'ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
    .then(() => {
      // Prendre le contrôle de toutes les pages clientes immédiatement
      return self.clients.claim();
    })
  );
});

// Interception des requêtes réseau
self.addEventListener('fetch', event => {
  // Stratégie : Network First avec fallback sur le cache
  // Pour les API, toujours essayer le réseau d'abord
  if (event.request.url.includes('/api/')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          // En cas d'échec réseau, vérifier le cache
          return caches.match(event.request);
        })
    );
  } 
  // Pour les assets statiques, stratégie Cache First
  else {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          // Retourner du cache si disponible
          if (cachedResponse) {
            // Faire une requête réseau en arrière-plan pour mettre à jour le cache
            fetch(event.request)
              .then(response => {
                // Mettre à jour le cache uniquement si la requête a réussi
                if (response.ok) {
                  const responseToCache = response.clone();
                  caches.open(CACHE_NAME)
                    .then(cache => {
                      cache.put(event.request, responseToCache);
                    });
                }
              });
              
            return cachedResponse;
          }
          
          // Sinon, faire une requête réseau
          return fetch(event.request)
            .then(response => {
              // Ne pas mettre en cache les réponses erronées
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Cloner la réponse car elle ne peut être utilisée qu'une fois
              const responseToCache = response.clone();
              
              // Mettre en cache la nouvelle ressource
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
                
              return response;
            });
        })
    );
  }
});

// Gestion des notifications push
self.addEventListener('push', event => {
  if (!event.data) return;
  
  try {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'Notification de votre assistant personnel',
      icon: '/images/icon-192x192.png',
      badge: '/images/notification-badge.png',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/'
      }
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'Assistant Personnel', options)
    );
  } catch (error) {
    console.error('Erreur lors du traitement de la notification push:', error);
  }
});

// Clic sur une notification
self.addEventListener('notificationclick', event => {
  event.notification.close();
  
  // Ouvrir l'URL associée à la notification ou la page par défaut
  const targetUrl = event.notification.data.url || '/';
  
  event.waitUntil(
    clients.matchAll({type: 'window'})
      .then(clientsList => {
        // Rechercher si un onglet est déjà ouvert
        for (const client of clientsList) {
          if (client.url === targetUrl && 'focus' in client) {
            return client.focus();
          }
        }
        
        // Si non, ouvrir un nouvel onglet
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});

// Gestion des messages entre la page et le Service Worker
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});