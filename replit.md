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
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
UI preferences: Preserve original card grid layout for meetings, only add vertical scrolling functionality without changing visual presentation.
Content visibility: Ensure all meeting cards are fully visible during scrolling with adequate bottom spacing to prevent cutoff.
```