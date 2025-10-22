# JobTradeSasa - Local Service Marketplace

## Overview
JobTradeSasa is a community-focused marketplace platform that connects service requesters with local service providers (artisans, technicians, suppliers, and companies). The platform features location-based matching, real-time chat, job management, ratings, and analytics.

## Project Structure

### Frontend (React + TypeScript)
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **Styling**: Tailwind CSS with shadcn/ui components
- **State Management**: React Query (TanStack Query)
- **PWA**: Configured with manifest.json for installability

### Backend (Node.js + Express)
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: JWT-based auth
- **Real-time**: WebSocket support for chat

### Database Schema
- **users**: User accounts with role-based access (requester/provider/admin)
- **providers**: Extended profile for service providers
- **categories**: Service categories
- **jobs**: Service requests with location and status tracking
- **messages**: Chat messages between users
- **ratings**: Provider ratings and reviews
- **promotions**: Provider promotions and special offers

## Key Features

### For Requesters (Customers)
- Post service requests with location, urgency, and budget
- Browse and search for service providers
- Filter providers by distance, rating, and availability
- Real-time chat with providers
- Rate and review providers after job completion
- Track job history and payment records

### For Providers (Service Vendors)
- Manage service offerings and availability
- Receive job notifications based on location
- Real-time chat with requesters
- Track job progress (accepted, en route, on site, completed)
- Analytics dashboard with earnings and performance metrics
- Build reputation through ratings and verification

### For Admins
- Verify provider registrations
- Manage categories and promotions
- View platform analytics and reports
- Moderate disputes and content

## Technology Stack

### Frontend Dependencies
- React, React DOM, React Router (Wouter)
- TanStack React Query for data fetching
- Tailwind CSS + shadcn/ui components
- Lucide React for icons
- React Hook Form + Zod for forms
- Date-fns for date formatting

### Backend Dependencies
- Express.js for API server
- Drizzle ORM for database operations
- PostgreSQL (with PostGIS for geolocation)
- Bcrypt for password hashing
- JSON Web Tokens (JWT) for authentication
- WebSocket (ws) for real-time chat
- Multer for file uploads

## API Endpoints

### Authentication
- POST /api/auth/signup - Create new account
- POST /api/auth/login - Login and get JWT token

### Jobs
- GET /api/jobs - List jobs (with filters)
- GET /api/jobs/:id - Get job details
- POST /api/jobs - Create new job
- PATCH /api/jobs/:id - Update job status
- POST /api/jobs/:id/accept - Accept a job (provider)

### Messages
- GET /api/messages/conversations - List user conversations
- GET /api/messages/:jobId - Get messages for a job
- POST /api/messages - Send a message

### Providers
- GET /api/providers - Search providers by location
- GET /api/provider/stats - Get provider analytics

### Profile
- PATCH /api/profile - Update user profile

### Categories
- GET /api/categories - List all categories

## Development

### Environment Variables
- DATABASE_URL - PostgreSQL connection string
- SESSION_SECRET - Secret for session management
- JWT_SECRET - Secret for JWT signing

### Running Locally
```bash
npm install
npm run dev
```

### Database Migrations
```bash
npm run db:push
```

## Design System

### Colors
- **Primary**: Trust blue (#2563eb) - CTAs, verification badges
- **Secondary**: Success green - Completed jobs, availability
- **Accent**: Urgent/emergency indicators (orange)
- **Background**: Dark mode primary, light mode available

### Typography
- **Font**: Inter (Google Fonts)
- **Hierarchy**: Display → Headers → Body → Captions

### Components
- Shadcn/ui component library
- Custom hover and active elevation utilities
- Responsive mobile-first design
- Dark/light theme support

## Deployment

### Frontend (Vercel)
- Static site generation optimized
- Automatic deployments from main branch
- Environment variables configured in Vercel dashboard

### Backend (Render)
- Node.js environment
- PostgreSQL database included
- Automatic deployments from main branch
- Environment variables configured in Render dashboard

## Security
- Passwords hashed with bcrypt
- JWT-based authentication
- CORS configured for frontend domain
- Input validation with Zod schemas
- Prepared statements for SQL (via Drizzle)

## Recent Changes
- 2025-01-22: Initial project setup
- Complete database schema with geolocation support
- Full authentication system with role-based access
- Job posting and browsing functionality
- Real-time chat system
- Provider dashboard with analytics
- PWA configuration for mobile installability

## User Preferences
- Modern, clean UI design with Material Design 3 inspiration
- Trust-building elements (verification badges, ratings)
- Mobile-first responsive design
- Smooth animations and transitions
- Dark mode support
