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
- **File Uploads**: Multer for handling file uploads with local storage

### Video Conferencing
- **Primary**: Simple Jitsi Meet integration (meet.jit.si)
- **Features**: Instant meeting creation, room codes, external link integration
- **Architecture**: Lightweight interface connecting to public Jitsi servers
- **Scalability**: Leverages Jitsi's infrastructure for unlimited users

## Key Components

### Communication Features
- **Messaging System**: Real-time chat with file attachments and encryption support
- **Video Conferencing**: Simple Jitsi Meet integration for instant meetings
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
2. Simple Jitsi Meet integration via external links
3. Instant meeting creation without complex server setup
4. Room management through lightweight API endpoints

### File Management
1. Files uploaded to local storage with unique identifiers
2. Metadata stored in PostgreSQL with access controls
3. Sharing permissions managed through database relations
4. Download links generated with expiration controls

## External Dependencies

### Core Technologies
- **Database**: PostgreSQL (Neon serverless or local)
- **Video**: Simple Jitsi Meet integration (meet.jit.si)
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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
UI preferences: Preserve original card grid layout for meetings and folders, only add vertical scrolling functionality without changing visual presentation.
Content visibility: Ensure all meeting cards are fully visible during scrolling with adequate bottom spacing to prevent cutoff.
File display: Only modify file icons and their sizes, keep original folder display layout unchanged.
```