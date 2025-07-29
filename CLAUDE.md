# Claude AI Assistant Memory & App Architecture

This document tracks the current application architecture, common issues, and deployment patterns.

## 🚀 CURRENT ARCHITECTURE (JANUARY 2025)

### Tech Stack
- **Frontend**: React/TypeScript hosted on Vercel
- **Backend**: Node.js API routes on Vercel (`/api/*`)
- **Authentication**: Google OAuth with service account for API access
- **Database**: Google Sheets (via Google Sheets API)
- **Storage**: Google Drive (via Google Drive API)
- **Deployment**: Vercel (auto-deploys from GitHub main branch)

### Current API Endpoints
```
/api/
├── app/
│   └── load-data.js          # Load all app data (areas, projects, tasks)
├── auth/
│   ├── exchange-code.js      # OAuth code exchange
│   └── validate.js           # Token validation
├── drive/
│   └── list-files.js         # Fast drive file listing (Edge Function)
├── projects/
│   ├── files.js              # GET: list files, POST: upload files  
│   └── manage.js             # Project CRUD (create, update, delete)
├── tasks/
│   ├── create.js             # Create new tasks
│   └── list.js               # List tasks with filtering
├── settings/
│   └── master-folder.js      # Master folder configuration
└── health.js                 # API health check
```

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

## 📊 DATA ARCHITECTURE

### Google Sheets Structure
- **Areas Sheet**: Project categories/areas
- **Projects Sheet**: Project data with drive folder integration
- **Tasks Sheet**: Task data with project relationships

### Task Field Usage
- **title**: Task name/description only
- **context**: Tags like @project-name, contexts, categories  
- **description**: Long-form details
- **projectId**: Database relationship field

### Project Drive Integration
- Each project has dedicated Google Drive folder
- **Service Account**: `nowandlater@solid-study-467023-i3.iam.gserviceaccount.com`
- Drive folders automatically shared with users
- File operations use Google Drive API v3 directly

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
- **Authentication failures**: Verify `GOOGLE_CREDENTIALS_JSON` base64 encoding
- **Empty responses**: Check Google Sheets/Drive API permissions

## ⚠️ KNOWN ISSUES & FIXES

### File Upload Issues (January 2025)
- **Problem**: 500 errors on file upload, 404 on project deletion
- **Cause**: API routing or authentication issues
- **Debug**: Check Vercel function logs for detailed error messages

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
- **Last Major Update**: January 2025 (File upload migration)

### API Capabilities
- ✅ Full task management (create, read, update, delete)
- ✅ Project management (create, read, update, delete)
- ✅ Google Drive file operations (list, upload)
- ✅ Area/category management
- ✅ Authentication and authorization
- ✅ Performance optimization with Edge Functions

### Authentication Setup
- Users authenticate via Google OAuth
- Service account handles backend API calls
- Base64 encoded credentials in environment variables
- Automatic folder sharing with authenticated users

## 🔮 FUTURE IMPROVEMENTS

### Planned Features
- Full Google Drive browsing (beyond project folders)
- Enhanced file management capabilities  
- Better error handling and user feedback
- Performance monitoring and analytics
- Mobile-responsive improvements

### Technical Debt
- None currently - fully migrated to modern Vercel architecture
- All Google Apps Script dependencies removed
- Clean API structure with proper error handling