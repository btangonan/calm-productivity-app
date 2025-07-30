# API Endpoint Analysis for Gmail Integration

## Current API Count: 13/12 (OVER LIMIT!)

### Current API Endpoints:
1. `/api/auth/validate.js` - Token validation
2. `/api/auth/exchange-code.js` - OAuth code exchange  
3. `/api/auth/store-token.js` - Store refresh tokens
4. `/api/health.js` - Health checks
5. `/api/tasks/create.js` - Create tasks
6. `/api/tasks/list.js` - List tasks
7. `/api/projects/manage.js` - CRUD projects
8. `/api/projects/files.js` - Project file management
9. `/api/drive/files.js` - Enhanced Drive API
10. `/api/settings/master-folder.js` - Master folder settings
11. `/api/cache/invalidate.js` - Cache invalidation
12. `/api/app/load-data.js` - Load all app data
13. `/api/utils/google-auth.js` - Shared utility (doesn't count as endpoint)

## 🚨 CRITICAL: We're already at 13/12 endpoints!

## Consolidation Opportunities (Immediate):

### Option 1: Merge Auth Endpoints (High Impact)
**Consolidate**: `/api/auth/validate.js` + `/api/auth/exchange-code.js` + `/api/auth/store-token.js`
**Into**: `/api/auth/manage.js` with action parameter
**Savings**: 2 endpoints
**Implementation**: Use `action` query parameter or HTTP methods

### Option 2: Merge Health & Cache (Low Risk)
**Consolidate**: `/api/health.js` + `/api/cache/invalidate.js` 
**Into**: `/api/system/manage.js`
**Savings**: 1 endpoint
**Rationale**: Both are system-level utilities

### Option 3: Merge Tasks (Medium Risk)
**Consolidate**: `/api/tasks/create.js` + `/api/tasks/list.js`
**Into**: `/api/tasks/manage.js`
**Savings**: 1 endpoint
**Implementation**: Use HTTP methods (GET for list, POST for create)

## Consolidation Recommendations:

### Priority 1: Auth Consolidation (IMMEDIATE)
```javascript
// /api/auth/manage.js
// POST /api/auth/manage?action=exchange-code
// POST /api/auth/manage?action=validate  
// POST /api/auth/manage?action=store-token
```
**Benefit**: Frees up 2 endpoints immediately

### Priority 2: Tasks Consolidation (SAFE)
```javascript
// /api/tasks/manage.js
// GET /api/tasks/manage (list tasks)
// POST /api/tasks/manage (create task)
// PUT /api/tasks/manage (update task)
// DELETE /api/tasks/manage (delete task)
```
**Benefit**: Frees up 1 more endpoint

### After Consolidation: 10/12 endpoints
This gives us **2 free slots** for Gmail integration!

## Gmail Integration Plan:

### Required Gmail Endpoints:
1. `/api/gmail/messages.js` - List/search Gmail messages & convert to tasks

### Gmail Features to Implement:
- Search emails by query/labels/date ranges
- Convert emails to tasks with attachments
- Extract project context from email threads
- Auto-populate task details from email content
- Handle email attachments as task attachments

## Implementation Strategy:

### Phase 1: Emergency Consolidation (NOW)
1. Merge auth endpoints → `/api/auth/manage.js`
2. Merge tasks endpoints → `/api/tasks/manage.js`  
3. **Result**: 10/12 endpoints, 2 slots free

### Phase 2: Gmail Integration (NEXT)
4. Add `/api/gmail/messages.js` (handles both search & conversion)
5. **Result**: 11/12 endpoints, 1 slot remaining for future

### Phase 3: Future Optimization (LATER)
- Consider merging `/api/health.js` + `/api/cache/invalidate.js` if needed
- Evaluate if `/api/app/load-data.js` can be merged with task/project endpoints

## Risk Assessment:

### Low Risk Consolidations:
- ✅ Auth endpoints (similar functionality)
- ✅ Tasks create/list (same domain)

### Medium Risk:
- ⚠️ Health + Cache (different purposes but both system-level)

### High Risk (Avoid):
- ❌ Drive + Projects (different scopes)
- ❌ Settings + anything (specialized function)

## Next Steps:
1. **IMMEDIATE**: Implement auth consolidation
2. **TODAY**: Implement tasks consolidation  
3. **THIS WEEK**: Add Gmail endpoints
4. **Test thoroughly** - consolidation can break existing code

## Code Impact Analysis:
- Frontend `ApiService` needs updates for new endpoint patterns
- All existing API calls need to be updated
- Error handling may need adjustment
- Authentication flow needs testing

**Estimated Development Time**: 2-3 hours for consolidation + testing