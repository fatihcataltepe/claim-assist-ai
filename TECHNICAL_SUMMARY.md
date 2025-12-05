# Claim Assist AI - Technical Summary

## 🏗️ Architecture Overview

**Claim Assist AI** is a full-stack insurance claim processing system that uses AI to guide customers through roadside assistance claims. The system is built with a modern, serverless architecture leveraging Supabase as the backend-as-a-service platform.

### High-Level Architecture

```
Frontend (React) → Supabase Edge Functions → OpenAI API
                ↓
         Supabase Database (PostgreSQL)
                ↓
         Real-time Subscriptions
```

---

## 🛠️ Technology Stack

### Frontend
- **Framework**: React 18.3 with TypeScript
- **Build Tool**: Vite 7.2 (with SWC for fast compilation)
- **UI Library**: shadcn/ui (Radix UI primitives + Tailwind CSS)
- **State Management**: React Hooks + React Query (TanStack Query)
- **Routing**: React Router v6
- **Form Handling**: React Hook Form + Zod validation
- **Charts**: Recharts for analytics visualization
- **Styling**: Tailwind CSS with custom design system

### Backend
- **Platform**: Supabase (PostgreSQL + Edge Functions)
- **Runtime**: Deno (for Edge Functions)
- **AI Integration**: OpenAI GPT-4 (via function calling)
- **Database**: PostgreSQL with Row Level Security (RLS)

### Key Libraries
- `@supabase/supabase-js` - Database client and real-time subscriptions
- `react-markdown` - Markdown rendering for AI responses
- `sonner` - Toast notifications
- `date-fns` - Date formatting
- `lucide-react` - Icon library

---

## 🗄️ Database Schema

### Core Tables

1. **`claims`** - Main claim records
   - Status enum: `data_gathering` → `coverage_check` → `arranging_services` → `completed`
   - Stores conversation history as JSONB
   - Tracks coverage decisions and arranged services
   - Auto-updates `updated_at` via trigger

2. **`insurance_policies`** - Policy master data
   - Coverage flags: `roadside_assistance`, `towing_coverage`, `rental_car_coverage`, `transport_coverage`
   - Vehicle information and policy holder details
   - Pre-seeded with 5 test policies

3. **`services`** - Service requests
   - Service types: `tow_truck`, `repair_truck`, `taxi`, `rental_car`
   - Links to claims via foreign key
   - Tracks provider, ETA, and status

4. **`notifications`** - Notification queue
   - Types: `sms`, `email`
   - Status: `pending`, `sent`, `failed`
   - Used by notification service for dispatch

5. **`garages`** - Service provider directory
   - Pre-configured with 5 providers
   - Includes location, services offered, ratings, response times

6. **`customers`** - Customer master data
   - Stores customer information with policy relationships

### Database Features
- **Row Level Security (RLS)**: Public read/write policies for demo (production-ready structure)
- **Real-time Subscriptions**: Enabled on `claims` and `notifications` tables
- **Triggers**: Auto-update `updated_at` timestamps
- **Enums**: Type-safe status and service type definitions
- **JSONB**: Flexible storage for conversation history and arranged services

---

## 🤖 AI-Powered Claim Processing

### Process Flow

1. **Data Gathering** (`data_gathering` status)
   - AI asks for policy number
   - Falls back to phone/name lookup if needed
   - Retrieves policy details automatically
   - Only asks for missing info: location + incident description

2. **Coverage Check** (`coverage_check` status)
   - AI analyzes incident to determine needed services
   - Checks policy coverage for each service
   - Records decision with reasoning
   - Handles uncovered claims with escalation option

3. **Service Arrangement** (`arranging_services` status)
   - AI selects appropriate providers automatically
   - Creates service requests and notifications
   - Communicates details to customer

4. **Completion** (`completed` status)
   - Final confirmation from customer
   - Claim marked as complete

### Key AI Decisions

- **Function Calling**: Uses OpenAI function calling for structured tool use
- **State Management**: Automatic status transitions based on claim state
- **Conversation Persistence**: Full conversation history stored in JSONB
- **Smart Service Selection**: AI determines needed services based on incident type
- **Provider Selection**: AI chooses best provider without asking user

---

## ⚡ Edge Functions

### 1. `process-claim` (Main AI Handler)
- **Purpose**: Processes customer messages through AI workflow
- **Tools Available**:
  - `save_claim_data` - Persist collected information
  - `find_policy_by_phone/name` - Policy lookup
  - `get_policy_coverage` - Coverage verification
  - `record_coverage_decision` - Save coverage analysis
  - `get_available_providers` - Service provider lookup
  - `arrange_services` - Create service requests
  - `complete_claim` - Finalize claim
- **Features**:
  - Automatic status transitions
  - Conversation history management
  - Error handling and validation

### 2. `analytics-assistant`
- **Purpose**: AI assistant for admin dashboard analytics
- **Features**: 
  - Analyzes claim data
  - Provides insights and recommendations
  - Uses Lovable API for AI responses

### 3. `text-to-speech`
- **Purpose**: Converts AI responses to speech
- **Integration**: Likely uses browser Web Speech API or external service

### 4. `transcribe-audio`
- **Purpose**: Converts voice input to text
- **Integration**: Likely uses browser Web Speech API or external service

---

## 🔄 Real-Time Features

### Implementation
- **Supabase Realtime**: PostgreSQL change streams
- **Custom Hook**: `useClaimRealtime` manages subscriptions
- **Channels**: Separate channels for claims and notifications
- **Auto-cleanup**: Proper subscription cleanup on unmount

### Use Cases
- Live claim status updates
- Real-time notification delivery
- Multi-user claim viewing
- Admin dashboard live updates

---

## 🎨 Frontend Architecture

### Component Structure
```
src/
├── pages/
│   ├── Index.tsx - Landing page
│   ├── ClaimSubmission.tsx - Main claim interface
│   ├── AdminDashboard.tsx - Admin analytics & management
│   └── NotFound.tsx
├── components/
│   ├── AdminAIAssistant.tsx - Admin AI chat
│   ├── ClaimDetails.tsx - Claim information display
│   ├── ClaimProgress.tsx - Status progress indicator
│   ├── VoiceRecorder.tsx - Voice input component
│   └── ui/ - shadcn/ui components
├── hooks/
│   ├── useClaimRealtime.ts - Real-time subscription hook
│   └── use-mobile.tsx - Responsive utilities
└── integrations/
    └── supabase/ - Supabase client & types
```

### Key Features
- **Voice Input**: Voice recording and transcription
- **Text-to-Speech**: AI responses read aloud
- **Progress Tracking**: Visual status indicators
- **Admin Takeover**: Human agents can take over conversations
- **Analytics Dashboard**: Charts and insights for admins

---

## 🔐 Security & Configuration

### Security Decisions
- **RLS Policies**: Database-level access control (currently permissive for demo)
- **Service Role Key**: Used only in Edge Functions (server-side)
- **Anon Key**: Used in frontend (safe with RLS)
- **Environment Variables**: Secrets stored in Supabase secrets

### Configuration
- **Project Linking**: Supabase CLI for local/remote sync
- **Migrations**: Version-controlled database schema
- **Type Safety**: Generated TypeScript types from database schema

---

## 📊 Important Technical Decisions

### 1. **Status-Driven Workflow**
- **Decision**: Use enum-based status field to track claim progression
- **Rationale**: Clear state machine, easy to query and filter
- **Implementation**: Automatic status transitions based on data presence

### 2. **JSONB for Flexible Data**
- **Decision**: Store conversation history and arranged services as JSONB
- **Rationale**: Flexible schema, easy to query, supports complex nested data
- **Trade-off**: Less structured than normalized tables, but more flexible

### 3. **AI Function Calling**
- **Decision**: Use OpenAI function calling instead of prompt engineering
- **Rationale**: Structured tool use, better reliability, easier to debug
- **Benefits**: Type-safe tool calls, clear error handling

### 4. **Real-time Subscriptions**
- **Decision**: Use Supabase Realtime instead of polling
- **Rationale**: Better UX, lower server load, instant updates
- **Implementation**: Custom React hook for easy consumption

### 5. **Edge Functions Architecture**
- **Decision**: Serverless functions instead of traditional backend
- **Rationale**: Scalable, cost-effective, no server management
- **Benefits**: Auto-scaling, global distribution, simple deployment

### 6. **TypeScript Throughout**
- **Decision**: Full TypeScript adoption
- **Rationale**: Type safety, better DX, fewer runtime errors
- **Implementation**: Generated types from database schema

### 7. **Component Library Choice**
- **Decision**: shadcn/ui over Material UI or Chakra
- **Rationale**: Copy-paste components, full control, Tailwind-based
- **Benefits**: Customizable, lightweight, modern design

### 8. **Form Validation**
- **Decision**: Zod + React Hook Form
- **Rationale**: Type-safe validation, great DX, schema-first approach

### 9. **State Management**
- **Decision**: React Query + local state (no Redux)
- **Rationale**: Simpler, built-in caching, server state management
- **Benefits**: Less boilerplate, automatic refetching, optimistic updates

### 10. **Voice Features**
- **Decision**: Browser-native Web Speech API
- **Rationale**: No external dependencies, works offline, privacy-friendly
- **Trade-off**: Browser compatibility limitations

---

## 🚀 Deployment Architecture

### Frontend
- **Build**: Vite production build
- **Hosting**: Can be deployed to Vercel, Netlify, or any static host
- **Environment**: Requires `.env` with Supabase credentials

### Backend
- **Database**: Supabase PostgreSQL (managed)
- **Functions**: Supabase Edge Functions (Deno runtime)
- **Deployment**: `supabase functions deploy` command
- **Migrations**: `supabase db push` for schema updates

### CI/CD Ready
- Migration-based schema management
- Version-controlled functions
- Environment variable management

---

## 📈 Scalability Considerations

### Current Architecture Supports:
- **Horizontal Scaling**: Edge functions auto-scale
- **Database Scaling**: Supabase handles PostgreSQL scaling
- **Real-time**: WebSocket connections managed by Supabase
- **Caching**: React Query provides client-side caching

### Future Enhancements:
- Redis for session management (if needed)
- CDN for static assets
- Queue system for notifications (if volume increases)
- Database read replicas (if needed)

---

## 🔧 Development Workflow

### Local Development
1. `npm install` - Install dependencies
2. `npm run dev` - Start Vite dev server
3. `supabase start` - Local Supabase (optional)
4. `supabase link` - Link to remote project

### Database Management
- **Migrations**: Version-controlled SQL files
- **Deployment**: `npm run supabase:deploy:migrations`
- **Functions**: `npm run supabase:deploy:functions`

### Testing
- Pre-seeded test policies (POL-2024-001 through POL-2024-005)
- Mock garages and service providers
- Real-time testing with multiple browser tabs

---

## 🎯 Key Metrics & Monitoring

### Tracked in Admin Dashboard:
- Total claims by status
- Coverage acceptance rate
- Service type distribution
- Response times
- Completion rates

### Database Metrics:
- Claim creation rate
- Average time per status
- Service arrangement success rate

---

## 🐛 Error Handling Strategy

1. **Frontend**: Toast notifications for user-facing errors
2. **Edge Functions**: Try-catch blocks with detailed error messages
3. **Database**: Foreign key constraints and validation
4. **AI**: Fallback responses for API failures
5. **Real-time**: Automatic reconnection on connection loss

---

## 📝 Code Quality

- **TypeScript**: Strict mode enabled
- **ESLint**: Configured with React best practices
- **Code Organization**: Feature-based structure
- **Reusability**: Shared hooks and components
- **Documentation**: Inline comments for complex logic

---

## 🔮 Future Architecture Considerations

1. **Microservices**: Could split into claim-service, notification-service, etc.
2. **Event Sourcing**: For audit trail and complex workflows
3. **CQRS**: Separate read/write models if query patterns diverge
4. **GraphQL**: If frontend needs more flexible queries
5. **Webhooks**: For external system integrations

---

## 📚 Key Takeaways for Presentation

1. **Modern Stack**: React + TypeScript + Supabase + OpenAI
2. **Serverless**: No backend servers to manage
3. **Real-time**: Live updates without polling
4. **AI-First**: Intelligent claim processing with natural language
5. **Type-Safe**: End-to-end TypeScript with generated types
6. **Scalable**: Built for growth with serverless architecture
7. **Developer-Friendly**: Simple deployment, clear structure
8. **Production-Ready**: Security, error handling, monitoring built-in

