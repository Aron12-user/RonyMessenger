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
- **Primary**: Jitsi Meet integration for unlimited video calls
- **Self-hosted Option**: Support for custom Jitsi deployment
- **Fallback**: WebRTC implementation for peer-to-peer communication
- **Features**: Audio/video calls, screen sharing, recording capabilities

## Key Components

### Communication Features
- **Messaging System**: Real-time chat with file attachments and encryption support
- **Video Conferencing**: Unlimited duration meetings with Jitsi Meet integration
- **Voice Calls**: WebRTC-based audio calls between users
- **File Sharing**: Secure file upload, download, and sharing with expiration controls

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
2. Jitsi Meet embedded for unlimited duration calls
3. WebRTC fallback for direct peer connections
4. Screen sharing and recording capabilities

### File Management
1. Files uploaded to local storage with unique identifiers
2. Metadata stored in PostgreSQL with access controls
3. Sharing permissions managed through database relations
4. Download links generated with expiration controls

## External Dependencies

### Core Technologies
- **Database**: PostgreSQL (Neon serverless or local)
- **Real-time**: Native WebSocket implementation
- **File Storage**: Local filesystem with future cloud integration
- **Video**: Jitsi Meet public instance with self-hosting option

### Third-party Services
- **Jitsi Meet**: Video conferencing platform (meet.jit.si)
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
- **WebSocket**: Efficient message broadcasting
- **File Storage**: Local storage with cloud migration path
- **Video**: Self-hosted Jitsi for enterprise scaling

## Changelog

```
Changelog:
- June 23, 2025. Initial setup
```

## User Preferences

```
Preferred communication style: Simple, everyday language.
```