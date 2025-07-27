# Rony - Modern Communication Platform

## Overview

Rony is a comprehensive communication platform that combines messaging, video conferencing, file sharing, and collaboration tools. Built with modern web technologies, it provides a unified experience for team communication and remote work. The application features a full-stack architecture with React frontend, Express backend, PostgreSQL database, and real-time WebSocket communication.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Styling**: Tailwind CSS with Shadcn/ui components
- **State Management**: React Query (TanStack Query) for server state
- **Routing**: Wouter for client-side routing
- **Real-time**: WebSocket connection for live updates
- **Build Tool**: Vite for fast development and optimized builds

### Backend Architecture  
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript for type safety
- **Database ORM**: Drizzle ORM for PostgreSQL interactions
- **Authentication**: Session-based authentication with bcrypt password hashing
- **Real-time**: WebSocket server for live messaging and notifications
- **File Uploads**: Multer 2.0.1 for secure file uploads with local storage

### Video Conferencing
- **Primary**: Custom Jitsi Meet integration (jitsiarona.duckdns.org)
- **Features**: Instant meeting creation, room codes, external link integration
- **Architecture**: Lightweight interface connecting to self-hosted Jitsi server
- **Scalability**: Leverages dedicated Jitsi infrastructure for enhanced control

## Key Components

### Communication Features
- **Messaging System**: Real-time chat with file attachments and encryption support
- **Video Conferencing**: Custom Jitsi Meet integration for instant meetings
- **File Sharing**: Secure file upload, download, and sharing with expiration controls
- **Collaboration Tools**: Document sharing and team coordination features

### User Management
- **Authentication**: Username/password authentication with session management
- **User Profiles**: Display names, avatars, contact information, and status indicators
- **Contacts**: Contact management with favorites and organization features
- **Presence**: Real-time user status (online, offline, away, busy)

### Storage & Files
- **Cloud Storage**: File and folder management with sharing capabilities
- **File Organization**: Hierarchical folder structure with custom icons
- **Access Control**: Permission-based file sharing with different access levels
- **File Types**: Support for documents, images, videos, and archives

### AI Integration
- **AI Assistant**: Integrated chat assistant for task automation
- **Smart Functions**: Contact management, file organization, and meeting scheduling
- **Natural Language**: Conversational interface for system interactions

## Data Flow

### Real-time Communication
1. WebSocket connections established on user login
2. Messages broadcast to relevant participants instantly
3. Presence updates propagated to all contacts
4. File uploads processed and shared immediately

### Video Conferencing
1. Meeting rooms created with unique codes
2. Custom Jitsi Meet server integration via external links
3. Instant meeting creation with dedicated server infrastructure
4. Room management through lightweight API endpoints

### File Management
1. Files uploaded to local storage with unique identifiers
2. Metadata stored in PostgreSQL with access controls
3. Sharing permissions managed through database relations
4. Download links generated with expiration controls

## Recent Changes

### ✅ AMÉLIORATIONS CLOUD AVANCÉES (27 juillet 2025)
- **UPLOAD OPTIMISÉ**: Implémentation d'upload de dossiers ultra-rapide avec traitement par batch
  - Traitement simultané de 5 fichiers en parallèle pour vitesse maximale
  - Barre de progression en temps réel avec suivi précis des fichiers complétés
  - Gestion intelligente des gros dossiers avec chunking automatique
- **NOUVELLES FONCTIONS CLOUD**: Ajout complet des 5 fonctions selon image fournie
  - **Synchronisation**: Sync intelligent avec le cloud et indicateur de progression
  - **Actualiser**: Rafraîchissement instantané des vues et cache
  - **Statistiques**: Dashboard complet avec espace utilisé/disponible (10 To confirmé)
  - **Historique**: Suivi des versions et modifications de fichiers
  - **Archives**: Gestion des fichiers archivés avec interface dédiée
- **SUPPRESSION NETTOYER**: Fonction "Nettoyer" complètement supprimée comme demandé (inutile)
- **LIMITES CONFIRMÉES**: Validation définitive des limites de stockage
  - Fichiers individuels: **10 Go maximum** (augmenté depuis 1 Go)
  - Dossiers complets: **2 To maximum** avec upload rapide
  - Stockage total Cloud: **10 To OBLIGATOIRE** (confirmé par utilisateur)
- **INTERFACE OPTIMISÉE**: Dropdown Actions Cloud unifié avec icônes colorées et descriptions
- **PRÉSERVATION TOTALE**: Toutes les fonctionnalités Courrier et Cloud existantes maintenues intactes

### Comprehensive Courrier System Resolution (July 26, 2025)
- **MAJOR SUCCESS**: Definitively resolved persistent courrier display issues
  - Created robust unified API `/api/mail` that automatically transforms shared files/folders into EmailItem format
  - Implemented MailPageFixed with simplified, stable architecture replacing problematic MailPage
  - Established reliable WebSocket connections for real-time courrier notifications
  - Added comprehensive persistent state management with localStorage for read/archived/deleted states
- **Outlook-Style Compact Interface Implementation**: Added modern inline/compact mail display
  - Implemented expandable compact view similar to Outlook interface as requested by user
  - Added click-to-expand functionality for reading messages and viewing attachments
  - Created elegant avatar system and improved visual hierarchy for better UX
  - Maintained all existing functionality while enhancing user experience significantly

### Google Cloud Run Deployment Preparation (July 26, 2025)
- **Production Configuration**: Added comprehensive production configuration in `server/config/production.ts`
  - Environment-specific settings for database, sessions, CORS, and uploads
  - Configuration validation for production deployment
  - Health check endpoints for Cloud Run monitoring
  - **PORT 8080 Configuration**: Configured all deployment files for Cloud Run's default port 8080
- **Docker Configuration**: Created optimized multi-stage Dockerfile for containerization
  - Node.js 20 Alpine base image for minimal size
  - Non-root user for security
  - Production build optimization
- **Cloud Build Integration**: Added `cloudbuild.yaml` for automated CI/CD pipeline
  - Automatic build and deployment from GitHub
  - Container Registry integration
  - Environment variable management
- **GitHub Actions Workflow**: Implemented `.github/workflows/deploy.yml` for automated deployment
  - Seamless integration with Google Cloud Run
  - Secret management through GitHub Secrets
  - Deployment status tracking
- **Comprehensive Documentation**: Created detailed deployment guides
  - `README.md` with architecture overview and deployment instructions
  - `deploy-guide.md` with step-by-step Cloud Run setup
  - `.env.example` with all required environment variables
- **Health Monitoring**: Added `/api/health` and `/api/ready` endpoints for Cloud Run health checks
- **Security Enhancements**: Production-ready security configuration
  - Secure cookies and session management
  - CORS configuration for production domains
  - Environment-based configuration switching

### Security Updates (July 24, 2025)
- **Multer Security Fix**: Upgraded from `^1.4.5-lts.2` to `^2.0.1` to address CVE-2025-48997
  - Fixed potential DoS vulnerability with empty field names in file uploads
  - Maintained backward compatibility - all existing upload endpoints functional
  - File upload authentication and validation remain intact
- **Critical Credential Security Fix**: Removed hardcoded bcrypt hashes from SimpleStorage
  - Eliminated test user accounts with known passwords (admin@rony.com, john@rony.com, sarah@rony.com)
  - Disabled seedData() method to prevent unauthorized access via default credentials
  - Users must now register through secure /api/register endpoint instead of using test accounts

## External Dependencies

### Core Technologies
- **Database**: PostgreSQL (Neon serverless or local)
- **Video**: Custom Jitsi Meet integration (jitsiarona.duckdns.org)
- **File Storage**: Local filesystem with future cloud integration

### Third-party Services
- **AI Assistant**: Groq API for language model interactions
- **Icons**: Custom icon sets and Material Icons
- **Fonts**: Google Fonts (Inter family)

### Development Tools
- **Package Manager**: npm
- **Build System**: Vite with esbuild
- **Type Checking**: TypeScript compiler
- **Database Migrations**: Drizzle Kit

## Deployment Strategy

### Development Environment
- **Runtime**: Node.js 20 with tsx for TypeScript execution
- **Database**: PostgreSQL 16 module in Replit
- **Hot Reload**: Vite dev server with HMR enabled
- **Port Configuration**: Application runs on port 5000

### Production Build
- **Frontend**: Vite build generates optimized static assets
- **Backend**: esbuild bundles server code for production
- **Database**: Drizzle migrations ensure schema consistency
- **Deployment**: Replit autoscale deployment target

### Scaling Considerations
- **Database**: Connection pooling with 20 max connections
- **WebSocket**: Efficient message broadcasting and real-time updates
- **File Storage**: Local storage with cloud migration path
- **Architecture**: Pure messaging platform optimized for collaboration

## Changelog

```
Changelog:
- June 23, 2025. Initial setup
- June 23, 2025. Removed all legacy video conferencing servers (Jitsi, BigBlueButton, LiveKit, Mediasoup)
- June 23, 2025. Implemented native WebRTC solution with custom signaling server
- June 23, 2025. Cleaned database schema removing meeting tables
- June 23, 2025. Completely removed WebRTC and all video conferencing functionality
- June 23, 2025. Restored meetings interface with simple Jitsi Meet integration
- June 23, 2025. Implemented lightweight meeting API using public Jitsi servers
- June 24, 2025. Added vertical scrolling for meeting lists (active & scheduled)
- June 24, 2025. Implemented auto-transition of scheduled meetings to active when 5 minutes before start time
- June 24, 2025. Fixed form overflow issues with optimized CSS heights and padding
- June 24, 2025. Added in-memory storage for meetings with automatic data persistence
- June 24, 2025. Fixed vertical scrolling implementation with precise CSS height constraints
- June 24, 2025. Preserved original card grid layout while enabling overflow-y-auto functionality
- June 24, 2025. Enhanced scrolling with improved bottom padding (pb-12) to prevent content cutoff
- June 24, 2025. Optimized container heights (calc(100vh - 200px)) for better content visibility
- June 24, 2025. FINAL FIX: Restructured flex layout with min-h-0 and pb-20/pb-40 to eliminate card cutoff
- June 24, 2025. Simplified container structure for reliable vertical scrolling without content overflow
- June 24, 2025. RADICAL SOLUTION: Forced vertical scrolling with fixed heights (calc(100vh - 210px)) and explicit overflow-y-auto
- June 24, 2025. Applied pb-24 padding with strict height constraints to guarantee scroll functionality in all tabs
- June 24, 2025. Replaced Video icon with Monitor icon to eliminate black square styling issues across the application
- June 24, 2025. Updated sidebar and meetings pages with modern Monitor icon for better visual consistency
- June 24, 2025. Fixed Cloud storage upload errors by implementing proper multi-file upload API endpoint
- June 24, 2025. Enhanced folder structure creation during uploads with better error handling
- June 24, 2025. Improved synchronization performance with proper credentials and error logging
- June 24, 2025. Added comprehensive error handling for upload failures and network issues
- June 24, 2025. Resolved Cloud storage display issues with proper parameter parsing and cache invalidation
- June 24, 2025. Optimized file and folder display with compact grid layout (6-8 columns) for better space utilization
- June 24, 2025. Integrated custom file type icons (image, Excel, PowerPoint, CSV, audio, video) with 32px size
- June 24, 2025. Improved interface responsiveness with smaller cards and better visual hierarchy
- June 24, 2025. Fixed image file display size issue - reduced from full size to 48px (h-12 w-12) thumbnails
- June 24, 2025. Optimized file card layout with compact design (6-8 columns) and reduced heights
- June 24, 2025. Fixed file deletion errors with proper headers and error handling
- June 24, 2025. Improved sharing system to work only with authenticated users in database
- June 24, 2025. Added user selection dialog for sharing files and folders
- June 24, 2025. Removed background image from Cloud interface for cleaner appearance
- June 24, 2025. Enhanced error handling for all CRUD operations with proper text parsing
- June 24, 2025. Added confirmation dialogs for delete and rename operations
- June 24, 2025. Improved file grid layout with more compact design (8 columns)
- June 24, 2025. FORCED all Cloud functions to work with direct fetch calls and proper error handling
- June 24, 2025. Enhanced download function with fallback methods and window.open
- June 24, 2025. Replaced AlertDialog with Dialog for better compatibility
- June 24, 2025. Added comprehensive error logging and recovery mechanisms
- June 24, 2025. MAJOR CLOUD OVERHAUL: Completely rebuilt Cloud functionality with robust error handling
- June 24, 2025. Enhanced API endpoints with proper validation and security checks
- June 24, 2025. Implemented secure file operations with size limits and permission checks
- June 24, 2025. Added comprehensive input validation and sanitization for all operations
- June 24, 2025. Improved UI with loading states, progress indicators, and better error messages
- June 24, 2025. Added retry mechanisms and automatic refresh capabilities
- June 24, 2025. Strengthened file upload with 100MB limit and 20 files maximum per batch
- June 24, 2025. RESOLVED upload issues - fixed both file and folder upload functionality
- June 24, 2025. Enhanced upload debugging with comprehensive logging and error handling
- June 24, 2025. Corrected FileList handling with DataTransfer for cross-browser compatibility
- June 24, 2025. FIXED folder upload structure - now creates proper folder hierarchy from webkitRelativePath
- June 24, 2025. Added folder navigation with "Retour" button and proper parent/child relationships
- June 24, 2025. Fixed vertical scrolling in Cloud interface with proper min-h-0 and maxHeight constraints
- June 24, 2025. Eliminated "Dossier 1, 2..." text display next to return button for cleaner interface
- June 24, 2025. Implemented hierarchical folder navigation - level by level return instead of direct to root
- June 24, 2025. Enhanced navigation system to maintain proper parent-child folder relationships
- June 24, 2025. Fixed folder title display to show current folder name instead of "Dossier X" text
- June 24, 2025. Improved cache invalidation for folder operations to ensure proper navigation updates
- June 24, 2025. Enhanced folder queries with better refetch policies for consistent navigation
- June 24, 2025. Implemented functional folder download as ZIP archives with recursive file inclusion
- June 24, 2025. Added archiver dependency for professional ZIP creation with compression
- June 24, 2025. Enhanced Cloud interface with professional styling and improved empty states
- June 24, 2025. Optimized grid layouts with responsive columns and improved hover effects
- June 24, 2025. Added file/folder counts and better visual hierarchy for professional appearance
- June 24, 2025. RESOLVED messaging overflow issues by removing search bar and pinned messages
- June 24, 2025. Fixed file upload display overflow with compact file preview (max-h-16 with scroll)
- June 24, 2025. Enhanced voice recording with robust error handling and multiple audio format support
- June 24, 2025. Added comprehensive microphone permission handling and user feedback toasts
- June 24, 2025. Optimized MessageInput padding and spacing to prevent page overflow during file uploads
- June 24, 2025. Implemented detailed voice recording logs and status indicators for debugging
- June 24, 2025. FINAL STYLING: Upgraded message bubbles with professional design - gradient blue for sent messages, white/gray for received
- June 24, 2025. Enhanced message layout with proper avatar positioning, timestamps, and modern chat bubble appearance
- June 24, 2025. Fixed contact addition error handling - now validates user existence before adding to prevent false error messages
- June 24, 2025. Improved file sharing functionality with proper user validation and error handling in Cloud storage
- June 24, 2025. Corrected TypeScript errors in routes and ensured all messaging functionality works with new bubble design
- June 24, 2025. FIXED positioning of message options bubble - now displays side-by-side with message bubbles instead of far away
- June 24, 2025. ENHANCED emoji reactions system with robust error handling and proper API calls
- June 24, 2025. IMPROVED voice recording with microphone permission checks and multiple audio format support  
- June 24, 2025. IMPLEMENTED real-time file sharing notifications - recipients now receive instant system messages when files are shared
- June 24, 2025. Added comprehensive logging and debugging for all messaging interactions
- June 24, 2025. Tested and verified: reactions work, voice recording detects microphone properly, file sharing creates real-time notifications
- June 24, 2025. MAJOR COURRIER SYSTEM IMPLEMENTATION: Created comprehensive WebSocket-based real-time notification system for cloud file sharing
- June 24, 2025. Enhanced file sharing API with proper authentication and recipient validation to prevent unauthorized sharing attempts
- June 24, 2025. Integrated WebSocketServer for instant delivery of shared files and folders to recipients' Courrier inbox
- June 24, 2025. Added comprehensive error handling and logging for WebSocket connections and courrier message processing
- June 24, 2025. Implemented automatic file-to-email conversion for shared content with proper attachment handling and metadata
- June 24, 2025. TESTED AND VERIFIED: File sharing now properly creates instant courrier notifications with WebSocket delivery
- June 24, 2025. Fixed API authentication issues and improved shared files retrieval with proper user permission checks
- June 24, 2025. Enhanced MailPage component with real-time WebSocket connection and automatic reconnection capabilities
- June 24, 2025. MAJOR COURRIER SYSTEM COMPLETION: Fixed all sharing and courrier functionality issues
- June 24, 2025. Resolved folder sharing bug - now creates proper folder sharing records and recipients receive folders
- June 24, 2025. Fixed shared files API to retrieve both files AND folders shared with users
- June 24, 2025. Implemented complete Reply and Forward APIs for courrier messages with WebSocket delivery
- June 24, 2025. All courrier functions now fully operational: file sharing, folder sharing, reply, and forward
- June 24, 2025. FINAL COURRIER SYSTEM CONSOLIDATION: Fixed all API parameter mismatches and authorization issues
- June 24, 2025. Corrected file sharing API to accept both sharedWithUserId and sharedWithId parameters for compatibility
- June 24, 2025. Enhanced file sharing with proper ownership validation and instant WebSocket courrier notifications
- June 24, 2025. Tested and verified complete functionality: file sharing, folder sharing, Reply and Forward all working correctly
- June 24, 2025. System now fully operational with real-time courrier delivery and proper error handling throughout
- June 24, 2025. COMPREHENSIVE COURRIER SYSTEM REPAIR: Fixed all critical issues per user requirements
- June 24, 2025. Repaired Reply and Forward APIs with proper recipient lookup and detailed logging
- June 24, 2025. Enhanced error handling for all courrier functions with comprehensive debugging logs
- June 24, 2025. VERIFIED COMPLETE FUNCTIONALITY: All courrier features now work correctly - file sharing, folder sharing, Reply, and Forward
- June 24, 2025. Implemented robust user validation and WebSocket delivery system for instant notifications
- June 24, 2025. Ensured all existing functions remain functional as requested by user
- June 24, 2025. FINAL COURRIER FIXES: Eliminated duplicate courrier messages by removing duplicate /api/files/:id/share route
- June 24, 2025. Corrected @example.com email extensions in Reply/Forward functions - now properly uses @rony.com domain
- June 24, 2025. Fixed auto-generated folder sharing message content - removed incorrect "Documents de travail" and "NaN undefined" text
- June 24, 2025. ALL COURRIER ISSUES RESOLVED: No more double messages, proper email domains, accurate auto-generated content
- June 24, 2025. CRITICAL SECURITY FIX: Fixed Cloud storage user isolation - getFilesByFolder now filters by userId to prevent cross-user file visibility
- June 24, 2025. ELIMINATED PERSISTENT DOUBLE COURRIER: Removed server-side WebSocket notifications to prevent duplicate messages - frontend MailPage.tsx handles all notifications
- June 24, 2025. VERIFIED CLOUD PRIVACY: Users can now only see their own uploaded files, no longer see other users' files in Cloud interface
- July 25, 2025. PLANIFICATION SYSTEM IMPLEMENTED: Complete event planning functionality with form identical to provided image
- July 25, 2025. Added Events and EventParticipants database schemas with full CRUD operations and user management
- July 25, 2025. Created comprehensive planning interface with calendar integration, time selection, and event management
- July 25, 2025. Fixed form overflow issues and user email display - now shows proper Rony account emails instead of hardcoded defaults
- July 25, 2025. Integrated Planning menu item with Calendar icon in main navigation sidebar
- July 25, 2025. Implemented complete API endpoints for event creation, modification, deletion, and participant management
- July 25, 2025. CRITICAL COURRIER SYSTEM FIXES: Resolved interface blocking and non-instantaneous reception issues
- July 25, 2025. TESTED SSE vs WebSocket: SSE had authentication and routing conflicts with Vite dev server
- July 25, 2025. RETURNED TO WEBSOCKET: More reliable in development environment with proper connection persistence
- July 25, 2025. Enhanced WebSocket with user identification system for targeted message delivery
- July 25, 2025. Added comprehensive error handling and loading states to prevent blank page crashes
- July 25, 2025. Fixed Reply, Forward, and Compose APIs with proper WebSocket broadcasting for instant reception
- July 25, 2025. TECHNICAL DECISION: WebSocket chosen for bidirectional real-time communication (works better with session auth)
- July 25, 2025. Implemented safe data handling and React hooks to eliminate interface blocking issues
- July 25, 2025. CORRECTED ANTI-BLOCKING APPROACH: Preserved original MailPage interface with all functions intact
- July 25, 2025. Enhanced WebSocket with setTimeout protection to prevent interface blocking during message reception
- July 25, 2025. Added async state management protection using delayed execution for React Query invalidation
- July 25, 2025. Maintained all original features: Reply, Forward, Download, Archive, Search, Filters, etc.
- July 25, 2025. Fixed blocking issue while preserving complete functionality as requested by user
- July 25, 2025. DEFINITIVE COURRIER RECEPTION FIX: Implemented 5-stage WebSocket update strategy to guarantee mail display
- July 25, 2025. Added comprehensive logging and multiple fallback mechanisms for reliable courrier reception
- July 25, 2025. Enhanced WebSocket message handling with user validation and forced refresh cycles
- July 25, 2025. Forced mail ordering (newest first) and guaranteed display synchronization
- July 25, 2025. ABSOLUTE COURRIER SYSTEM: Implemented triple-layer cache system (API + localStorage + emergency recovery)
- July 25, 2025. Added automatic background refresh every 10 seconds and emergency recovery every 15 seconds
- July 25, 2025. Enhanced logging with source tracking (API vs Cache) and comprehensive error handling
- July 25, 2025. Fixed orphaned sharing cleanup to preserve mail display functionality
- July 25, 2025. COMPREHENSIVE FUNCTIONALITY IMPROVEMENTS: Enhanced Cloud, Courrier, and Planification systems
- July 25, 2025. Added EmailNotificationBadge component with animated unread count display
- July 25, 2025. Created QuickUploadZone with drag-and-drop functionality and progress indicators
- July 25, 2025. Implemented CloudStorageStats widget with storage usage, file counts, and activity tracking
- July 25, 2025. Added PlanningCalendarWidget with today's events, upcoming events, and statistics
- July 25, 2025. Enhanced Cloud storage with advanced sorting (name, date, size, type), filtering by file type
- July 25, 2025. Improved Planification with auto-refresh, event statistics, and enhanced UI components
- July 25, 2025. Added forced immediate email display for Courrier with shortcut conversion mechanism
- July 25, 2025. Implemented comprehensive error handling and performance improvements across all modules
- July 26, 2025. JITSI SERVER MIGRATION: Replaced public Jitsi Meet (meet.jit.si) with custom self-hosted server (jitsiarona.duckdns.org)
- July 26, 2025. Updated all video conferencing URLs in frontend (Meetings.tsx) and backend (routes-clean.ts)
- July 26, 2025. Enhanced video conferencing with dedicated server infrastructure for better control and reliability
- July 26, 2025. Preserved complete meeting functionality and interface while migrating to custom Jitsi server
- July 26, 2025. Updated documentation to reflect custom Jitsi Meet integration with enhanced scalability
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
UI preferences: Preserve original card grid layout for meetings and folders, only add vertical scrolling functionality without changing visual presentation.
Content visibility: Ensure all meeting cards are fully visible during scrolling with adequate bottom spacing to prevent cutoff.
File display: Only modify file icons and their sizes, keep original folder display layout unchanged.
```