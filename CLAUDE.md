# Claude AI Assistant Memory & App Architecture

This document tracks the current application architecture, common issues, and deployment patterns.

## 🚀 CURRENT ARCHITECTURE (AUGUST 2025)

### Tech Stack
- **Frontend**: React/TypeScript hosted on Vercel
- **Backend**: Node.js API routes + Vercel Edge Functions (`/api/*`)
- **AI Integration**: Groq API (Llama 3.1 70B) via secure Edge Functions
- **Authentication**: User-based Google OAuth. The application requests permission to access the user's Google Drive and uses their access token to perform operations on their behalf.
- **Database**: Google Sheets (via Google Sheets API)
- **Storage**: Google Drive (via Google Drive API, using user-owned folders)
- **Deployment**: Vercel (auto-deploys from GitHub main branch)

### Current API Endpoints (v1.3.0 AI Integration Release)
```
/api/ - 11/12 endpoints used
├── ai/
│   └── analyze-email.js      # 🤖 NEW: Secure AI email analysis (Edge Function)
├── app/
│   └── load-data.js          # Load all app data (areas, projects, tasks)
├── auth/
│   └── manage.js             # CONSOLIDATED: validate, exchange-code, store-token
├── cache/
│   └── invalidate.js         # Cache invalidation for data consistency
├── drive/
│   └── files.js              # Enhanced Drive API with query system
├── gmail/
│   └── messages.js           # Gmail integration (search & convert to tasks)
├── projects/
│   ├── files.js              # GET: list files, POST: upload files  
│   └── manage.js             # Project CRUD (create, update, delete)
├── settings/
│   └── master-folder.js      # Master folder configuration
├── tasks/
│   └── manage.js             # CONSOLIDATED: create, list, update, delete
└── health.js                 # API health check
```

### AI Integration Architecture
- **Model**: Llama 3.1 70B Versatile (via Groq API)
- **Security**: Server-side Edge Function (API key never exposed to browser)
- **Performance**: Sub-second responses (500+ tokens/sec inference)
- **Persona**: Creative Director-focused analysis and task generation
- **Fallback**: Graceful degradation to basic task creation if AI unavailable

### API Evolution History
- **Original**: 13 endpoints (OVER 12 LIMIT!)
- **Auth Consolidation**: 3 → 1 endpoint (freed 2 slots)
- **Tasks Consolidation**: 2 → 1 endpoint (freed 1 slot)  
- **Gmail Integration**: Used 1 slot
- **AI Integration**: Used 1 slot (added `/api/ai/analyze-email.js`)
- **Final**: 11/12 endpoints (1 slot available)

## 🤖 AI INTEGRATION (Creative Director Assistant)

### Overview
The app now features AI-powered email analysis that transforms generic email-to-task conversion into intelligent Creative Director-focused task generation.

### AI Features
- **Smart Task Titles**: "Address client concerns on video pacing" vs "Email Task"
- **Creative Context**: Understands branding, storytelling, client relationships
- **Priority Intelligence**: Critical for negative feedback, high for deliverables
- **Context Tags**: @creative, @feedback, @strategy, @meeting, @executive
- **Sentiment Analysis**: Polite-but-disappointed, enthusiastic, urgent tones
- **Key Theme Extraction**: Brand positioning, visual hierarchy, CTA clarity

### Technical Implementation
```typescript
// Frontend: AIService calls secure server endpoint
const analysis = await aiService.analyzeEmail({
  emailSubject, emailSender, emailContent, emailSnippet
});

// Backend: Edge Function processes with Groq API
/api/ai/analyze-email.js → Groq Llama 3.1 70B → Creative Analysis
```

### AI Response Structure
```json
{
  "is_actionable": true,
  "task_type": "feedback_request",
  "task_title": "Address client concerns on video pacing",
  "task_description": "Summary: Client feedback on video draft.\nAction Items:\n- Review luxury brand positioning\n- Source sophisticated music options\n- Deliver revised version by tomorrow",
  "priority": "critical",
  "due_date": "2025-08-03",
  "creative_analysis": {
    "tone": "polite_but_disappointed",
    "sentiment": "negative",
    "key_themes": ["brand positioning", "music selection"],
    "notes": "Client unhappy with current direction, needs careful handling"
  },
  "context_tags": ["MegaCorp", "video_revision", "client_feedback"]
}
```

### Environment Variables
```bash
# Required for AI features
GROQ_API_KEY=gsk_your_actual_groq_api_key_here

# Google OAuth (existing)
VITE_GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CREDENTIALS_JSON=your_base64_service_account_json
```

### AI Debugging
Filter console with `🔥 [DEBUG-AI]` to trace AI analysis flow:
- Connection testing and API key validation
- Email content analysis and parsing
- Task generation and creative enhancement
- Fallback handling when AI unavailable

## 🔧 DEPLOYMENT WORKFLOW

### Standard Process
1. **Make changes** to `/api/*` files or frontend code
2. **Test locally**: `npm run dev`
3. **Commit and push**: `git add . && git commit -m "description" && git push origin main`
4. **Vercel auto-deploys** within 1-2 minutes
5. **Verify deployment** at production URL

### Git Workflow Rules
- **ALWAYS** run `git status` before claiming completion
- **ALWAYS** commit all changes: `git add . && git commit -m "message" && git push origin main`
- **NEVER** claim features work without testing in deployed environment
- Run git commands from project root: `/Users/bradleytangonan/google_productivity_app/`

## 🔄 STABLE RELEASE & ROLLBACK PROCEDURES

### Current Branch Strategy (July 31, 2025)
- **`main`**: Latest stable development work (v1.2.2 - UX-Optimized Stable)
- **`v1.2.2`**: **RECOMMENDED** - UX-optimized app with instant responsiveness
- **`v1.2.1`**: Post-refactoring stable with service architecture
- **`v1.2.0`**: Pre-refactoring stable
- **Previous**: `release/v1.0-stable` and `v1.0.0` (original stable release)

### How to Restore to Stable Release

#### Option 1: Reset to Latest Stable (v1.2.2 - RECOMMENDED)
```bash
# UX-optimized app with instant responsiveness
git checkout main
git reset --hard v1.2.2
git push origin main --force-with-lease

# Verify stable version
git log --oneline -3
```

#### Option 2: Reset to Post-Refactoring Stable (v1.2.1)
```bash
# Service architecture without UX optimizations
git checkout main
git reset --hard v1.2.1
git push origin main --force-with-lease
```

#### Option 3: Reset to Pre-Refactoring Stable (v1.2.0)
```bash
# Before the comprehensive API refactoring
git checkout main
git reset --hard v1.2.0
git push origin main --force-with-lease
```

#### Option 4: Create Emergency Branch
```bash
# Create emergency branch from recommended stable version
git checkout -b emergency-rollback v1.2.2
git push -u origin emergency-rollback
```

### What's in Each Stable Release

#### v1.2.2 (Current Stable - July 31, 2025) - **RECOMMENDED**
- ✅ **All v1.2.1 features PLUS:**
- ✅ **Bold styling for unread emails** (clear read/unread distinction)
- ✅ **Instant task creation from emails** with optimistic UI
- ✅ **Instant task creation from calendar events** with optimistic UI
- ✅ **Background processing** eliminates wait times for Google API operations
- ✅ **Professional-grade responsiveness** and interaction patterns
- ✅ **Comprehensive error handling** with optimistic rollback
- ✅ **Zero latency** email/calendar workflow integration

#### v1.2.1 (Post-Refactoring Stable - July 31, 2025)
- ✅ **All v1.2.0 features PLUS:**
- ✅ Comprehensive API refactoring (AuthService, TaskService, ProjectService, DriveService, MockDataService, GoogleScriptService)
- ✅ Improved UI interactions (double-click emails, clean sender names)
- ✅ Persistent divider positions (Gmail panel height, right sidebar width)
- ✅ Gmail defaults to "Important" filter
- ✅ Zero behavioral changes - all functionality preserved
- ✅ Better maintainability with service extraction pattern

#### v1.2.0 (Pre-Refactoring Stable - July 28, 2025)
- ✅ Complete task management with Areas/Projects
- ✅ Google Drive integration with file uploads  
- ✅ Gmail integration for email-to-task conversion
- ✅ Cache invalidation system for data consistency
- ✅ Token expiration handling with automatic logout
- ✅ Consolidated API endpoints (10/12 used)
- ✅ Master folder setup and project management
- ✅ All authentication and authorization working
- ✅ Performance optimizations and error handling

#### v1.0.0 (Original Stable - July 30, 2025)  
- ✅ Basic working application
- ✅ Core task and project management
- ✅ Initial Google integrations

### Emergency Rollback Commands
```bash
# If anything breaks, run these commands:

# 1. Quick rollback to latest stable (RECOMMENDED)
git checkout main
git reset --hard v1.2.2
git push origin main --force-with-lease

# 2. Rollback to pre-refactoring if services are broken
git checkout main  
git reset --hard v1.2.0
git push origin main --force-with-lease

# 3. Nuclear option - go back to very first stable
git checkout main
git reset --hard v1.0.0
git push origin main --force-with-lease

# 4. Verify rollback worked
git log --oneline -5
```

### Vercel Branch Deployment
- **Production**: Currently deploys from `main` branch
- **Preview**: Can deploy from any branch via PR
- **Emergency**: Can switch production to deploy from `release/v1.0-stable`

To switch Vercel to stable branch:
1. Go to Vercel dashboard → Project settings  
2. Change production branch from `main` to `release/v1.0-stable`
3. Trigger new deployment

## 📊 DATA ARCHITECTURE

### Google Sheets Structure
- **Areas Sheet**: Project categories/areas
- **Projects Sheet**: Project data with drive folder integration
- **Tasks Sheet**: Task data with project relationships
- **Users Sheet**: Stores user email and refresh token for Google API access

### Task Field Usage
- **title**: Task name/description only
- **context**: Tags like @project-name, contexts, categories  
- **description**: Long-form details
- **projectId**: Database relationship field

### Project Drive Integration
- Each project has a dedicated Google Drive folder, created within the user's designated "Master Folder".
- All file and folder operations are performed on behalf of the user, using their OAuth access token.
- The service account is no longer used for file uploads.

## 🔍 DEBUGGING PATTERNS

### When Features Don't Work
1. Check browser console for errors
2. Verify `git status` shows no uncommitted changes  
3. Check Vercel deployment logs in dashboard
4. Test API endpoints directly with curl/Postman
5. Clear browser cache / hard refresh
6. Check Google API quotas and permissions

### Common Error Patterns
- **404 on API routes**: Check if endpoint file exists and is properly named  
- **500 Internal Server Error**: Check Vercel function logs for actual error
- **Authentication failures**: Ensure the user has granted the correct Google Drive permissions. Check for valid access and refresh tokens.
- **Empty responses**: Check Google Sheets/Drive API permissions

## ⚠️ KNOWN ISSUES & FIXES

### File Upload Issues (July 2025)
- **Problem**: 500 error on file upload with the error `Service Accounts do not have storage quota`.
- **Cause**: The application was previously using a service account to upload files, which does not have its own Google Drive storage.
- **Fix**: The application has been re-architected to use a user-centric OAuth flow. It now requests permission to access the user's Google Drive and performs all file operations on their behalf, using their storage space.

### Project Deletion Timing
- Projects may require multiple deletion attempts  
- Backend includes verification step to ensure deletion succeeds
- Frontend shows simple error message on failure (no intermediate success pages)

### Drive Folder Access
- Currently limited to project-specific folders
- **Future**: Plan to add full Google Drive browsing capability

## 🏗️ CURRENT SERVICE ARCHITECTURE (v1.2.1)

### Refactored Service Pattern
The application uses a clean service architecture with dependency injection:

```typescript
// Service Structure
src/services/
├── api.ts              # Main API service (coordinator)
├── AuthService.ts      # Authentication & token management
├── TaskService.ts      # Task CRUD operations  
├── ProjectService.ts   # Project & Drive integration
├── DriveService.ts     # Google Drive file operations
├── MockDataService.ts  # Development mock data
└── GoogleScriptService.ts # Legacy script execution
```

### Service Responsibilities
- **AuthService**: Token refresh, expiration handling, user profile management
- **TaskService**: Task creation, updates, completion, email conversion
- **ProjectService**: Project CRUD, Drive folder management, Area relationships
- **DriveService**: File uploads, queries, folder operations
- **MockDataService**: Development data when backend unavailable
- **ApiService**: Main coordinator, delegates to specific services

### Dependency Injection Pattern
```typescript
// Services receive dependencies via constructor/factory
const taskService = createTaskService(fetchWithAuth, executeGoogleScript);
const projectService = createProjectService(fetchWithAuth, driveService);
```

## 🚨 CRITICAL MISTAKES TO AVOID

- ❌ Making code changes without committing them
- ❌ Claiming features work without testing in production
- ❌ Adding frontend API calls without corresponding backend endpoints
- ❌ Using Google Apps Script patterns (we're fully on Vercel now)
- ❌ Forgetting to check Vercel deployment status
- ❌ Not handling temporary project IDs in optimistic updates
- ❌ Breaking service dependency injection patterns during changes

## ✅ SUCCESS PATTERNS

- ✅ Always test in deployed environment before claiming completion
- ✅ Update both frontend and backend for new functionality  
- ✅ Use proper git workflow with detailed commit messages
- ✅ Check Vercel dashboard for deployment success
- ✅ Handle both create and edit scenarios for new features
- ✅ Use performance logging for API operations

## 🔗 CURRENT DEPLOYMENT STATUS

### Live Application
- **Frontend**: https://calm-productivity-app.vercel.app/
- **API Base**: https://calm-productivity-app.vercel.app/api/
- **Status**: ✅ ACTIVE (v1.2.2 Stable - UX Optimized)
- **Current Branch**: `main` (stable development)
- **Latest Stable Tag**: `v1.3.0` (August 1, 2025) - **RECOMMENDED** 🤖 AI Integration
- **Previous Stable Tags**: `v1.2.2` (July 31, 2025), `v1.2.1` (July 31, 2025), `v1.2.0` (July 28, 2025)

### API Capabilities (Current v1.3.0)
- ✅ Full task management (create, read, update, delete)
- ✅ Project management (create, read, update, delete)
- ✅ Google Drive file operations (list, upload, enhanced query system)
- ✅ Gmail integration (search emails, convert to tasks)
- ✅ **🤖 AI-Powered Email Analysis** (NEW) - Creative Director-focused task generation
- ✅ **🔒 Secure AI Processing** (NEW) - Server-side Groq API integration via Edge Functions
- ✅ **🎨 Creative Intelligence** (NEW) - Understands branding, client relationships, creative feedback
- ✅ Area/category management
- ✅ Authentication and authorization with token expiration handling
- ✅ Cache invalidation system for data consistency
- ✅ Performance optimization with consolidated endpoints
- ✅ Master folder setup and project-specific Drive folders

### Authentication Setup
- Users authenticate via Google OAuth
- Service account handles backend API calls
- Base64 encoded credentials in environment variables
- Automatic folder sharing with authenticated users

## 🔮 DEVELOPMENT ROADMAP

### In Progress: Modular Tile System (Feature Branch)
- **Branch**: `feature/modular-tile-system`
- **Timeline**: 13-17 weeks total development
- **Features**:
  - Customizable dashboard with draggable tiles
  - Gmail tile with AI-powered email-to-task conversion
  - AI Search tile with local Ollama integration
  - Calendar, Drive Files, and Notes tiles
  - Window-style tile management (close/open)

### ✅ COMPLETED: AI Integration (v1.3.0)
- **Status**: LIVE - AI-powered Creative Director email analysis
- **Implementation**: Groq API + Llama 3.1 70B via secure Edge Functions
- **Features**: Smart task generation, creative context understanding, sentiment analysis
- **Security**: Server-side processing, API keys never exposed to browser
- **Performance**: Sub-second response times (500+ tokens/sec)

### Future AI Enhancements
- Enhanced mobile responsiveness for tile system
- Advanced AI features (bulk processing, context detection)
- Team collaboration features
- Performance monitoring and analytics

### Technical Debt
- None currently - fully migrated to modern Vercel architecture
- All Google Apps Script dependencies removed
- Clean API structure with proper error handling
- Stable release preserved for rollback safety