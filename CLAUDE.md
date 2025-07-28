# Claude AI Assistant Memory & Common Mistakes

This document tracks recurring issues and mistakes that need to be avoided in future interactions.

## 🚨 CRITICAL MIGRATION STATUS: NOW USING VERCEL API 🚨

**WE HAVE MIGRATED FROM GOOGLE APPS SCRIPT TO VERCEL API**

### Current Architecture (July 2025)
- **Frontend**: React/TypeScript hosted on Vercel
- **Backend**: Node.js API routes deployed on Vercel (`/api/*`)
- **Authentication**: Google OAuth with service account for API access
- **Database**: Google Sheets (accessed via Google Sheets API from Vercel)
- **Storage**: Google Drive (accessed via Google Drive API from Vercel)

### ⚠️ NEVER USE CLASP ANYMORE ⚠️
- **OLD (DEPRECATED)**: `clasp push` to Google Apps Script
- **NEW (CURRENT)**: `git push origin main` deploys to Vercel automatically
- **Backend location**: `/api/` folder (Vercel API routes)
- **No more**: Google Apps Script backend (`/backend/Code.gs` is LEGACY)

## CRITICAL: Git Workflow Issues

### 1. **Always Commit ALL Changes Before Claiming "Complete"**
**Issue**: Frequently making code edits but forgetting to commit them, causing "fixes" to not actually be deployed.

**Required Actions EVERY TIME:**
- After making ANY code changes, immediately run: `git status`  
- If there are uncommitted changes, ALWAYS commit them: `git add . && git commit -m "message" && git push origin main`
- NEVER claim a feature is "fixed" or "complete" without confirming all changes are committed and pushed
- Check for uncommitted changes with `git status` before ending any task

### 2. **Directory Context for Git Commands**
**Issue**: Running git commands from wrong directory (e.g., from `/backend` instead of root)

**Solution:**
- Always run git commands from the project root: `/Users/bradleytangonan/google_productivity_app/`
- If in wrong directory, use `cd ..` to get to root before git commands

### 3. **Vercel Deployment Process (CURRENT)**
**Issue**: Forgetting that we're now on Vercel, not Google Apps Script

**Required Process:**
1. **Make changes** to `/api/*` files or frontend
2. **Test locally**: `npm run dev`
3. **Commit and push**: `git add . && git commit -m "message" && git push origin main`
4. **Vercel auto-deploys** - no manual deployment needed
5. **Check deployment**: Visit Vercel dashboard or test live URL

## Development Patterns & Architecture

### 4. **Task Field Usage**
**Issue**: Confusing where different data belongs in tasks

**Correct Usage:**
- **title**: Task name/description only
- **context**: Tags like @project-name, contexts, categories
- **description**: Long-form details
- **projectId**: Database relationship field

### 5. **Missing API Methods (VERCEL)**
**Issue**: Frontend calling backend methods that don't exist

**Always Check:**
- When adding new frontend API calls, ensure Vercel API route exists
- Create new file in `/api/` folder (e.g., `/api/projects/create.js`)
- Update frontend ApiService class to call the correct Vercel endpoint
- **NO MORE**: Google Apps Script functions or `doPost` cases

### 6. **Task Filtering Logic**
**Issue**: Showing wrong tasks in different views

**Key Rules:**
- Project views: Show only `task.projectId === selectedProjectId && !task.isCompleted`
- Logbook view: Show only `task.isCompleted`
- Other views: Show only `!task.isCompleted` with appropriate filters

## Testing & Verification

### 7. **Deployment Verification Checklist (VERCEL)**
Before claiming any feature works:
- [ ] All code changes committed and pushed to git
- [ ] Vercel deployment completed successfully (auto-triggers on push)
- [ ] Check Vercel dashboard for deployment status
- [ ] Feature tested in actual deployed environment
- [ ] **NO MORE**: clasp push or Google Apps Script deployments

### 8. **Common Debug Steps (VERCEL)**
When features "don't work":
1. Check browser console for errors
2. Verify `git status` shows no uncommitted changes
3. Check Vercel deployment logs in dashboard
4. Check API endpoints are returning expected data
5. Clear browser cache / hard refresh
6. **NO MORE**: Google Apps Script URL updates

## Vercel API Patterns (CURRENT)

### 9. **API Endpoint Structure**
All endpoints are in `/api/` folder:
- `/api/app/load-data.js` - Load all app data
- `/api/projects/files.js` - Project file operations  
- `/api/tasks/create.js` - Create tasks
- `/api/tasks/list.js` - List tasks
- `/api/auth/validate.js` - Validate auth tokens

### 10. **Adding New API Endpoints**
For every new API endpoint:
1. Create file: `/api/[category]/[action].js`
2. Export default handler function
3. Handle authentication with `validateGoogleToken()`
4. Use Google APIs directly (sheets, drive, etc.)
5. Return JSON response with `res.status(200).json()`

## Recurring Mistakes to Avoid (UPDATED FOR VERCEL)

- ❌ Making code changes but not committing them
- ❌ Claiming features work without testing in deployed environment
- ❌ Running git commands from wrong directory
- ❌ **USING CLASP OR GOOGLE APPS SCRIPT DEPLOYMENT**
- ❌ Adding frontend API calls without corresponding Vercel API routes  
- ❌ Using title field for tags instead of context field
- ❌ Not handling both create and edit scenarios for new features
- ❌ Forgetting to check Vercel deployment status

## Success Patterns (UPDATED FOR VERCEL)

- ✅ Always run `git status` before claiming completion
- ✅ Test features in actual deployed environment
- ✅ Update both frontend and Vercel API routes for new functionality
- ✅ Use proper git workflow: edit → add → commit → push (auto-deploys to Vercel)
- ✅ Check Vercel dashboard for deployment success
- ✅ **NEVER USE CLASP OR APPS SCRIPT ANYMORE**

## Current Deployment Info (VERCEL)

### 🚀 Live Vercel Deployment
- **Platform**: Vercel (Auto-deploys from GitHub)
- **Frontend URL**: https://calm-productivity-app.vercel.app/
- **API Base**: https://calm-productivity-app.vercel.app/api/
- **Last Updated**: July 29, 2025 (Drive folder fixes)
- **Status**: ✅ ACTIVE

### 🗂️ Available Vercel API Endpoints
- `GET /api/app/load-data` - Load all app data (areas, projects, tasks)
- `GET /api/projects/files` - Get project files from Google Drive
- `POST /api/tasks/create` - Create new tasks
- `GET /api/tasks/list` - List tasks with filters
- `POST /api/auth/exchange-code` - Exchange OAuth code for tokens
- `POST /api/auth/validate` - Validate Google auth tokens
- `GET /api/health` - API health check

### 📁 Google Drive Integration

**Service Account Email**: `nowandlater@solid-study-467023-i3.iam.gserviceaccount.com`

**Current Implementation**:
- ✅ Direct Google Drive API access from Vercel
- ✅ File listing and filtering (hides internal "Tasks" folders)
- ✅ Base64 credential authentication
- ✅ Drive folder URL validation and error handling
- ❌ **TODO**: Create project creation API endpoint in Vercel
- ❌ **TODO**: Master folder configuration (currently only in legacy Apps Script)

**Migration Status**:
- ✅ **MIGRATED**: File operations (`/api/projects/files.js`)
- ✅ **MIGRATED**: Task operations (`/api/tasks/*`)  
- ✅ **MIGRATED**: Authentication (`/api/auth/*`)
- ✅ **MIGRATED**: Data loading (`/api/app/load-data.js`)
- ❌ **LEGACY**: Project creation (still uses Google Apps Script)
- ❌ **LEGACY**: Master folder config (still uses Google Apps Script)

### 🔧 Setup Instructions for Users

1. **Share Your Drive Folder**:
   - Share with: `nowandlater@solid-study-467023-i3.iam.gserviceaccount.com`
   - Permission: "Editor"

2. **All Operations Work Through Vercel**:
   - File browsing: ✅ Vercel API
   - Task management: ✅ Vercel API  
   - Project creation: ⚠️ Still Google Apps Script (legacy)

### ⚠️ Known Issues
- Project creation still uses legacy Google Apps Script backend
- Some projects may have empty `driveFolderUrl` fields (shows helpful error message)
- Master folder configuration not yet migrated to Vercel