# Claude AI Assistant Memory & App Architecture

This document tracks the current application architecture, common issues, and deployment patterns.

## 🚀 CURRENT ARCHITECTURE (JULY 2025)

### Tech Stack
- **Frontend**: React/TypeScript hosted on Vercel
- **Backend**: Node.js API routes on Vercel (`/api/*`)
- **Authentication**: User-based Google OAuth. The application requests permission to access the user's Google Drive and uses their access token to perform operations on their behalf.
- **Database**: Google Sheets (via Google Sheets API)
- **Storage**: Google Drive (via Google Drive API, using user-owned folders)
- **Deployment**: Vercel (auto-deploys from GitHub main branch)

### Current API Endpoints (v1.0.0 Stable Release)
```
/api/ - 10/12 endpoints used
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

### API Consolidation History
- **Original**: 13 endpoints (OVER 12 LIMIT!)
- **Auth Consolidation**: 3 → 1 endpoint (freed 2 slots)
- **Tasks Consolidation**: 2 → 1 endpoint (freed 1 slot)  
- **Gmail Integration**: Used 1 slot
- **Final**: 10/12 endpoints (2 slots available)

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

### Current Branch Strategy (July 30, 2025)
- **`main`**: Latest development work
- **`feature/modular-tile-system`**: Active development branch for tile system
- **`release/v1.0-stable`**: **STABLE RELEASE** - fully working app before tile system
- **`v1.0.0`**: Release tag pointing to stable state

### How to Restore to Stable Release

#### Option 1: Switch to Stable Branch (Temporary)
```bash
# Switch to stable version (preserves current work)
git checkout release/v1.0-stable

# Verify you're on stable branch
git branch
# * release/v1.0-stable

# Return to development when ready
git checkout feature/modular-tile-system
```

#### Option 2: Reset to Stable Tag (Permanent)
```bash
# WARNING: This discards all changes after v1.0.0
git checkout main
git reset --hard v1.0.0
git push origin main --force-with-lease

# OR create new branch from stable tag
git checkout -b emergency-rollback v1.0.0
git push -u origin emergency-rollback
```

#### Option 3: Create Hotfix from Stable
```bash
# Create hotfix branch from stable release
git checkout release/v1.0-stable
git checkout -b hotfix/emergency-fix
# Make emergency fixes
git push -u origin hotfix/emergency-fix
```

### What's in the Stable Release (v1.0.0)
- ✅ Complete task management with Areas/Projects
- ✅ Google Drive integration with file uploads  
- ✅ Gmail integration for email-to-task conversion
- ✅ Cache invalidation system for data consistency
- ✅ Token expiration handling with automatic logout
- ✅ Consolidated API endpoints (10/12 used)
- ✅ Master folder setup and project management
- ✅ All authentication and authorization working
- ✅ Performance optimizations and error handling

### Emergency Rollback Commands
```bash
# If tile system breaks everything, run these commands:

# 1. Quick switch to working version
git checkout release/v1.0-stable

# 2. Deploy stable version to production
git checkout release/v1.0-stable
git push origin release/v1.0-stable
# Then update Vercel to deploy from release/v1.0-stable branch

# 3. Complete rollback of main branch
git checkout main
git reset --hard v1.0.0  
git push origin main --force-with-lease
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

## 🚨 CRITICAL MISTAKES TO AVOID

- ❌ Making code changes without committing them
- ❌ Claiming features work without testing in production
- ❌ Adding frontend API calls without corresponding backend endpoints
- ❌ Using Google Apps Script patterns (we're fully on Vercel now)
- ❌ Forgetting to check Vercel deployment status
- ❌ Not handling temporary project IDs in optimistic updates

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
- **Status**: ✅ ACTIVE
- **Current Branch**: `feature/modular-tile-system` (development)
- **Stable Branch**: `release/v1.0-stable` (production-ready fallback)
- **Last Stable Release**: July 30, 2025 (v1.0.0)

### API Capabilities (Stable v1.0.0)
- ✅ Full task management (create, read, update, delete)
- ✅ Project management (create, read, update, delete)
- ✅ Google Drive file operations (list, upload, enhanced query system)
- ✅ Gmail integration (search emails, convert to tasks)
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

### Planned AI Integration (Local Ollama)
- **Privacy-First**: All AI processing on user's machine
- **Zero API Costs**: No external AI service fees
- **Features**: Email analysis, natural language search, content summarization
- **Models**: Llama 3.1, Codestral, user-configurable

### Future Enhancements
- Enhanced mobile responsiveness for tile system
- Advanced AI features (bulk processing, context detection)
- Team collaboration features
- Performance monitoring and analytics

### Technical Debt
- None currently - fully migrated to modern Vercel architecture
- All Google Apps Script dependencies removed
- Clean API structure with proper error handling
- Stable release preserved for rollback safety