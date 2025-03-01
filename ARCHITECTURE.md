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
    
    subgraph "Backend (Option 1: Firebase)"
        FBF[Firebase Functions]
        FBS[Firebase Storage]
        FBDB[Firestore Database]
        FBAuth[Firebase Auth]
    end
    
    subgraph "Backend (Option 2: Cloudflare)"
        CFW[Cloudflare Workers]
        CFKV[KV Storage]
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
    VR --> FBF
    VR --> CFW
    UI --> LC
    SW --> LC
    
    FBF --> FBAuth
    FBF --> FBDB
    FBF --> Gemini
    
    CFW --> CFKV
    CFW --> Gemini
    
    FBF --> GSheets
    CFW --> GSheets
    GAppsScript --> GSheets
    GAppsScript --> GCalendar
    GAppsScript --> GMail
    
    FBDB -.-> GSheets
    CFKV -.-> GSheets
```

## Options de déploiement

### Option 1: Firebase (Recommandée pour débutants)

```mermaid
flowchart LR
    subgraph "Frontend"
        PWA[PWA]
    end
    
    subgraph "Firebase"
        FH[Firebase Hosting]
        FF[Firebase Functions]
        FS[Firestore]
    end
    
    subgraph "Google Services"
        GS[Google Sheets]
        GAS[Google Apps Script]
        GC[Google Calendar]
        GM[Gmail]
    end
    
    subgraph "AI"
        Gemini[Gemini API]
    end
    
    PWA --> FH
    PWA -- API Calls --> FF
    FF -- Data Storage --> FS
    FF -- AI Processing --> Gemini
    FF -- Data Sync --> GS
    GAS -- Sync --> GC
    GAS -- Sync --> GM
    GAS -- Webhook --> FF
```

### Option 2: Cloudflare Workers

```mermaid
flowchart LR
    subgraph "Frontend"
        PWA[PWA]
    end
    
    subgraph "Cloudflare"
        CP[Cloudflare Pages]
        CW[Cloudflare Workers]
        KV[KV Storage]
    end
    
    subgraph "Google Services"
        GS[Google Sheets]
        GAS[Google Apps Script]
        GC[Google Calendar]
        GM[Gmail]
    end
    
    subgraph "AI"
        Gemini[Gemini API]
    end
    
    PWA --> CP
    PWA -- API Calls --> CW
    CW -- Data Cache --> KV
    CW -- AI Processing --> Gemini
    CW -- Data Storage --> GS
    GAS -- Sync --> GC
    GAS -- Sync --> GM
    GAS -- Webhook --> CW
```

## Flux de données

```mermaid
sequenceDiagram
    participant User as Utilisateur
    participant PWA as Frontend PWA
    participant Backend as Backend (Firebase/Cloudflare)
    participant Gemini as Gemini 1.5
    participant GAS as Google Apps Script
    participant GS as Google Sheets
    participant GMail as Gmail
    participant GCal as Google Calendar
    
    User->>PWA: Commande vocale
    PWA->>PWA: Reconnaissance locale
    PWA->>Backend: Envoie commande analysée
    Backend->>Gemini: Analyse sémantique
    Gemini->>Backend: Résultats d'analyse
    Backend->>GS: Recherche données pertinentes
    GS->>Backend: Renvoie données
    
    alt Gestion Email
        Backend->>GAS: Demande sync email
        GAS->>GMail: Recherche emails
        GMail->>GAS: Liste emails
        GAS->>GS: Stocke données
        GAS->>Backend: Notification terminée
    end
    
    alt Gestion Calendrier
        Backend->>GAS: Création événement
        GAS->>GCal: Ajoute événement
        GCal->>GAS: Confirmation
        GAS->>GS: Enregistre événement
        GAS->>Backend: Statut opération
    end
    
    Backend->>PWA: Réponse formatée
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
        F[Firebase/Cloudflare\nProtection API]
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

### Backend (Option 1: Firebase)
- **Serverless** : Firebase Functions
- **Base de données** : Firestore
- **Stockage** : Firebase Storage
- **Authentification** : Firebase Auth via Google
- **Hébergement** : Firebase Hosting (domaine gratuit *.web.app)

### Backend (Option 2: Cloudflare)
- **Serverless** : Cloudflare Workers
- **Cache** : KV Store Cloudflare
- **Authentification** : OAuth via Google (magic links)
- **Hébergement** : Cloudflare Pages ou domaine personnalisé

### Services Google
- **Stockage principal** : Google Sheets comme base de données
- **Emails** : Gmail API
- **Calendrier** : Google Calendar API
- **Synchronisation** : Google Apps Script
- **Authentification** : Google Identity Services

### IA
- **Traitement du langage** : Gemini 1.5 Flash
- **Fallback** : Système de règles locales en cas d'indisponibilité

### Intégrations
- **Webhook** : Communication bidirectionnelle
- **Cron triggers** : Tâches planifiées (Firebase ou Cloudflare)
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

### Option 1: Firebase

```mermaid
graph LR
    subgraph "Code source"
        src[Fichiers source]
    end
    
    subgraph "Outils"
        firebase[Firebase CLI]
        script[Setup Script]
    end
    
    subgraph "Déploiement"
        FH[Firebase Hosting]
        FF[Firebase Functions]
        FS[Firestore]
        GAS[Google Apps Script]
    end
    
    src --> script
    script --> firebase
    firebase --> FH
    firebase --> FF
    firebase --> FS
    script -- instructions manuelles --> GAS
```

### Option 2: Cloudflare

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
        CP[Cloudflare Pages]
        GAS[Google Apps Script]
    end
    
    src --> script
    script --> wrangler
    wrangler --> CW
    script --> CP
    script -- instructions manuelles --> GAS
```

## Comparaison des options de déploiement

| Fonctionnalité | Firebase | Cloudflare Workers |
|----------------|----------|-------------------|
| **Domaine gratuit** | ✅ (*.web.app) | ✅ (*.workers.dev) |
| **Base de données** | ✅ Firestore | ❌ (utilise Google Sheets) |
| **Stockage fichiers** | ✅ Firebase Storage | ❌ (non inclus) |
| **Limites gratuites** | 125K/mois invocations | 100K/jour requêtes |
| **Facilité d'installation** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |
| **Performance** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Support Windows** | ✅ Excellent | ✅ Bon |
| **Interface admin** | ✅ Console Firebase | ❌ Limitée |

## Sécurité et confidentialité

- **Authentification** : Basée sur Google OAuth avec vérification d'email unique
- **Chiffrement** : AES-256 pour toutes les données sensibles stockées localement
- **Isolation** : Accès limité à un seul utilisateur via whitelist d'email
- **Audit** : Vérification quotidienne des permissions et accès
- **Données** : Stockées principalement dans les services Google de l'utilisateur

Cette documentation visuelle illustre l'architecture complète du système "ZeroConfig Personal Assistant", avec les deux options de déploiement (Firebase et Cloudflare Workers), des composants jusqu'au flux de données et au modèle de sécurité.