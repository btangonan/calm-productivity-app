# API.ts Refactoring Plan - From Monolith to Services

## Current State Analysis
- **File**: `src/services/api.ts` 
- **Size**: 2,001 lines of code
- **Methods**: 62 async methods
- **Risk Level**: HIGH - This file powers the entire application

## Method Distribution by Domain
- **Authentication**: 8 methods (token management, OAuth flow)
- **Task Operations**: 15 methods (CRUD, completion, search, attachments)
- **Project Management**: 24 methods (creation, updates, Drive integration)
- **Drive Integration**: 21 methods (file operations, folder management)
- **Utility/Health**: 4 methods (health checks, data loading)

## Refactoring Strategy: Safety-First Approach

### Phase 1: Service Extraction (Zero Logic Changes)
Goal: Extract methods into focused service classes with **no behavioral changes**

#### 1.1 AuthService (Lowest Risk)
**Location**: `src/services/AuthService.ts`
**Methods to Extract**:
- `checkToken()` - Token validation
- `refreshToken()` - Token refresh logic  
- `handleAuthError()` - Error handling
- `validateGoogleToken()` - Google token validation
- `logout()` - Session cleanup
- OAuth flow methods

**Risk**: LOW - Auth has clear boundaries
**Testing**: Login → Token refresh → Logout flow

#### 1.2 TaskService (Medium Risk)
**Location**: `src/services/TaskService.ts` 
**Methods to Extract**:
- `createTask()` - Task creation with optimistic updates
- `updateTask()` - Task modification
- `getTasks()` - Task retrieval with filtering
- `toggleTaskCompletion()` - Completion status
- `deleteTask()` - Task removal
- `searchTasks()` - Task search functionality
- `updateTaskCompletion()` - Batch completion updates
- Task attachment methods

**Risk**: MEDIUM - Core functionality, critical for user experience
**Testing**: Full CRUD operations + optimistic UI behavior

#### 1.3 ProjectService (Medium-High Risk)
**Location**: `src/services/ProjectService.ts`
**Methods to Extract**:
- Project CRUD operations (24 methods)
- Drive folder integration
- File management within projects
- Project hierarchy management

**Risk**: MEDIUM-HIGH - Complex Drive API dependencies
**Testing**: Project creation → Task assignment → Drive folder workflows

#### 1.4 DriveService (Highest Risk)
**Location**: `src/services/DriveService.ts`
**Methods to Extract**:
- File upload/download operations
- Folder creation and management
- Google Drive API calls
- File sharing and permissions

**Risk**: HIGH - Many external API dependencies, error-prone
**Testing**: File operations in isolated environment first

### Phase 2: Gradual Component Integration

#### 2.1 Component Update Strategy
- **Never batch updates** - Update one component at a time
- Replace `ApiService.methodName()` with `TaskService.methodName()`
- Test each component update in isolation
- Maintain feature flags for rollback

#### 2.2 Component Priority Order
1. **Authentication components** (LoginScreen, etc.)
2. **Task components** (TaskList, TaskItem, etc.) 
3. **Project components** (ProjectView, etc.)
4. **Drive integration components** (FileUpload, etc.)

### Phase 3: Testing & Validation

#### 3.1 Critical Test Scenarios
- ✅ **Authentication Flow**: Login → Token refresh → Logout
- ✅ **Task CRUD**: Create → Update → Complete → Delete  
- ✅ **Optimistic Updates**: Temp ID handling and backend sync
- ✅ **Email/Calendar Conversion**: Gmail → Task → Click task
- ✅ **Project Workflows**: Create project → Add tasks → Drive folder
- ✅ **File Operations**: Upload → Download → Attachment handling

#### 3.2 Rollback Strategy
- Keep original `api.ts` as `api-backup.ts`
- Each service can be independently disabled via feature flags
- Component-level rollback capability
- Database consistency checks

### Phase 4: Clean-up & Optimization

#### 4.1 Dead Code Removal
- Remove `/backend/` directory (legacy Google Apps Script)
- Clean up unused imports and interfaces
- Remove development debugging code

#### 4.2 Performance Optimization  
- Implement proper tree-shaking for services
- Add lazy loading for heavy operations
- Optimize bundle splitting

## Implementation Timeline

### Week 1: AuthService
- [ ] Extract auth methods with zero logic changes
- [ ] Add comprehensive logging for method call tracking
- [ ] Test complete auth flow (login/refresh/logout)
- [ ] Update authentication components one-by-one

### Week 2: TaskService  
- [ ] Extract task methods preserving optimistic UI logic
- [ ] Ensure temp ID handling works correctly
- [ ] Test all CRUD operations extensively
- [ ] Update task-related components incrementally

### Week 3: ProjectService
- [ ] Extract project methods with Drive dependencies intact  
- [ ] Test project creation and Drive folder workflows
- [ ] Update project management components
- [ ] Verify file operations work correctly

### Week 4: DriveService & Cleanup
- [ ] Extract Drive methods with careful API error handling
- [ ] Test file upload/download operations thoroughly
- [ ] Update file management components
- [ ] Remove legacy code and optimize bundle

## Risk Mitigation

### Pre-Implementation
- [ ] Full backup of current working state (v1.2.0 tag ✅)
- [ ] Comprehensive test suite for existing functionality
- [ ] Staging environment setup for testing

### During Implementation  
- [ ] No logic changes in Phase 1 - pure method extraction only
- [ ] Comprehensive logging to track all method calls
- [ ] Feature flags for gradual rollout
- [ ] Component-by-component updates with individual testing

### Post-Implementation
- [ ] Performance benchmarking vs. original
- [ ] User acceptance testing in staging
- [ ] Gradual production rollout with monitoring

## Success Criteria

### Functional Requirements
- [ ] All existing functionality preserved
- [ ] No user-facing behavior changes
- [ ] Performance equal or better than original
- [ ] Comprehensive error handling maintained

### Code Quality Goals
- [ ] **Maintainability**: 4 focused services vs 1 monolith
- [ ] **Testing**: Isolated unit tests for each domain
- [ ] **Development**: Multiple developers can work on different services
- [ ] **Performance**: Better tree-shaking and code splitting

## Emergency Rollback Plan

If any phase fails:
1. **Immediate**: Revert to previous git commit
2. **Component-level**: Disable new service, re-enable ApiService method
3. **Service-level**: Feature flag to disable entire new service
4. **Full rollback**: Return to v1.2.0 tag

## File Structure After Refactoring

```
src/services/
├── api.ts (lightweight coordinator)
├── AuthService.ts (8 methods)
├── TaskService.ts (15 methods)  
├── ProjectService.ts (24 methods)
├── DriveService.ts (21 methods)
└── types.ts (shared interfaces)
```

---

**Goal**: Maintain the "beautiful functioning app" while systematically improving code organization and maintainability. Every step must preserve existing functionality.