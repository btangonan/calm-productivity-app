# Claude AI Assistant Memory & Common Mistakes

This document tracks recurring issues and mistakes that need to be avoided in future interactions.

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
- Remember: `clasp push` runs from `/backend`, but `git` commands run from root

### 3. **Backend Deployment Process**
**Issue**: Forgetting the two-step deployment process for full-stack changes

**Required Process:**
1. **Backend**: `cd backend && clasp push --force`
2. **Frontend**: `cd .. && git add . && git commit -m "message" && git push origin main`  
3. **API URL**: Update `src/services/api.ts` with new Google Apps Script URL
4. **Commit API URL**: `git add . && git commit -m "API URL update" && git push origin main`

## Development Patterns & Architecture

### 4. **Task Field Usage**
**Issue**: Confusing where different data belongs in tasks

**Correct Usage:**
- **title**: Task name/description only
- **context**: Tags like @project-name, contexts, categories
- **description**: Long-form details
- **projectId**: Database relationship field

### 5. **Missing API Methods**
**Issue**: Frontend calling backend methods that don't exist

**Always Check:**
- When adding new frontend API calls, ensure backend method exists
- Add corresponding Google Apps Script function AND case statement in doPost
- Update both frontend ApiService class AND backend Code.gs

### 6. **Task Filtering Logic**
**Issue**: Showing wrong tasks in different views

**Key Rules:**
- Project views: Show only `task.projectId === selectedProjectId && !task.isCompleted`
- Logbook view: Show only `task.isCompleted`
- Other views: Show only `!task.isCompleted` with appropriate filters

## Testing & Verification

### 7. **Deployment Verification Checklist**
Before claiming any feature works:
- [ ] All code changes committed and pushed to git
- [ ] Backend changes pushed via clasp
- [ ] API URL updated if needed
- [ ] Vercel deployment completed successfully
- [ ] Feature tested in actual deployed environment

### 8. **Common Debug Steps**
When features "don't work":
1. Check browser console for errors
2. Verify `git status` shows no uncommitted changes
3. Check Vercel deployment logs
4. Confirm API URL matches latest Google Apps Script deployment
5. Clear browser cache / hard refresh

## Google Apps Script Patterns

### 9. **Version Naming Convention**
Format: `v2024.MM.DD.###-FEATURE-NAME`
- Date: Current date
- Build: Increment for each deployment that day  
- Feature: Short description of main change

### 10. **API Method Pattern**
For every new API method:
1. Add case to doPost function: `case 'methodName':`
2. Create function: `function methodName(param1, param2) { ... }`
3. Add to frontend ApiService: `async methodName(...) { ... }`
4. Update version numbers and redeploy

## Recurring Mistakes to Avoid

- ❌ Making code changes but not committing them
- ❌ Claiming features work without testing in deployed environment
- ❌ Running git commands from wrong directory
- ❌ Forgetting to update API URL after backend deployments
- ❌ Adding frontend API calls without corresponding backend methods  
- ❌ Using title field for tags instead of context field
- ❌ Not handling both create and edit scenarios for new features
- ❌ Forgetting to update version numbers before deployment

## Success Patterns

- ✅ Always run `git status` before claiming completion
- ✅ Test features in actual deployed environment
- ✅ Update both frontend and backend for new functionality
- ✅ Use proper git workflow: edit → add → commit → push
- ✅ Update API URLs immediately after backend deployments
- ✅ Document deployment versions and what they contain

## Current Deployment Info

### Latest Google Apps Script Deployment
- **Version**: v2024.07.28.001-PERFORMANCE-BOOST
- **URL**: https://script.google.com/macros/s/AKfycbxoBsxraR0CQMkvpVTcTpQylqRTK7fNuNoQs3bV-I-DKzP5_jWVBlGMJ2TrcN1trpMm/exec
- **Features**: Optimistic UI updates, performance optimizations, comprehensive timing logs
- **Date**: July 28, 2025