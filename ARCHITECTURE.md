# Architecture de l'Assistant Personnel ZeroConfig

## Vue d'ensemble

```mermaid
graph TB
    subgraph "Frontend (PWA)"
        UI[Interface Utilisateur]
        VR[Reconnaissance Vocale]
        LC[Stockage Local Chiffré]
        SW[Service Worker]
    end
    
    subgraph "Backend (Cloudflare Workers)"
        API[API REST]
        Auth[Authentification]
        VoiceP[Traitement Vocal]
        AIProc[Traitement IA]
    end
    
    subgraph "Services Google"
        GSheets[Google Sheets]
        GCalendar[Google Calendar]
        GMail[Gmail]
        GAppsScript[Google Apps Script]
    end
    
    subgraph "IA"
        Gemini[Gemini 1.5 Flash]
    end
    
    UI --> VR
    VR --> API
    UI --> LC
    SW --> LC
    
    API --> Auth
    API --> VoiceP
    VoiceP --> AIProc
    AIProc --> Gemini
    
    Auth --> GSheets
    GAppsScript --> GSheets
    GAppsScript --> GCalendar
    GAppsScript --> GMail
    
    API --> GSheets
```

## Flux de données

```mermaid
sequenceDiagram
    participant User as Utilisateur
    participant PWA as Frontend PWA
    participant CF as Cloudflare Workers
    participant Gemini as Gemini 1.5
    participant GAS as Google Apps Script
    participant GS as Google Sheets
    participant GMail as Gmail
    participant GCal as Google Calendar
    
    User->>PWA: Commande vocale
    PWA->>PWA: Reconnaissance locale
    PWA->>CF: Envoie commande analysée
    CF->>Gemini: Analyse sémantique
    Gemini->>CF: Résultats d'analyse
    CF->>GS: Recherche données pertinentes
    GS->>CF: Renvoie données
    
    alt Gestion Email
        CF->>GAS: Demande sync email
        GAS->>GMail: Recherche emails
        GMail->>GAS: Liste emails
        GAS->>GS: Stocke données
        GAS->>CF: Notification terminée
    end
    
    alt Gestion Calendrier
        CF->>GAS: Création événement
        GAS->>GCal: Ajoute événement
        GCal->>GAS: Confirmation
        GAS->>GS: Enregistre événement
        GAS->>CF: Statut opération
    end
    
    CF->>PWA: Réponse formatée
    PWA->>User: Réponse vocale et visuelle
```

## Architecture de sécurité

```mermaid
flowchart TD
    subgraph "Couches de sécurité"
        A[OAuth Google\nAuthentification unique]
        B[AES-256\nChiffrement côté client]
        C[HTTPS/TLS\nChiffrement en transit]
        D[Email Whitelist\nContrôle d'accès]
        E[Vérification signatures\nPour webhooks]
        F[Cloudflare WAF\nProtection API]
    end
    
    subgraph "Accès données"
        User([Utilisateur unique])
    end
    
    User --> A
    A --> B
    B --> C
    C --> D
    D --> E
    E --> F
    F --> Access([Accès autorisé])
```

## Composants du système

### Frontend
- **Interface PWA** : Preact + Web Components
- **Reconnaissance vocale** : Web Speech API
- **Stockage local** : IndexedDB via localForage
- **Chiffrement** : AES-256 via CryptoJS
- **Service Worker** : Cache et fonctionnement hors-ligne

### Backend
- **Serverless** : Cloudflare Workers
- **API Gateway** : REST avec CORS
- **Authentification** : OAuth via Google (magic links)
- **Traitement IA** : Gemini 1.5 Flash
- **Caching** : KV Store Cloudflare

### Services Google
- **Stockage** : Google Sheets comme base de données
- **Emails** : Gmail API
- **Calendrier** : Google Calendar API
- **Synchronisation** : Google Apps Script
- **Authentification** : Google Identity Services

### Intégrations
- **Webhook** : Communication bidirectionnelle
- **Cron triggers** : Tâches planifiées sur Cloudflare
- **Push notifications** : Service Worker

## Modèle de données

```mermaid
erDiagram
    USERS ||--o{ EMAILS : possède
    USERS ||--o{ EVENTS : possède
    USERS {
        string email PK
        string displayName
        timestamp lastLogin
        array whitelistedEmails
        string preferences
    }
    EMAILS {
        string id PK
        string threadId
        string subject
        string sender
        timestamp receivedAt
        boolean isRead
        string snippet
        array labels
    }
    EVENTS {
        string id PK
        string title
        string description
        string location
        timestamp startTime
        timestamp endTime
        boolean isAllDay
        array guests
        array reminders
    }
    CONFIG {
        string key PK
        string value
        string description
    }
```

## Déploiement

```mermaid
graph LR
    subgraph "Code source"
        src[Fichiers source]
    end
    
    subgraph "Outils"
        wrangler[Wrangler CLI]
        script[Setup Script]
    end
    
    subgraph "Déploiement"
        CW[Cloudflare Workers]
        PWA[Site statique]
        GAS[Google Apps Script]
    end
    
    src --> script
    script --> wrangler
    wrangler --> CW
    script --> PWA
    script -- instructions manuelles --> GAS
```

Cette documentation visuelle illustre l'architecture complète du système "ZeroConfig Personal Assistant", des composants jusqu'au flux de données et au modèle de sécurité.