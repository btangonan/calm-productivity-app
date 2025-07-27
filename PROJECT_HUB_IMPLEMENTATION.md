# Project Hub Enhancement Plan

## Executive Summary

Transform the existing project view into a comprehensive Project Hub by enhancing the right sidebar with tabbed navigation, advanced file management, and seamless Google Drive integration. This plan prioritizes backward compatibility, error resilience, and progressive enhancement to ensure zero downtime during implementation.

## Current State Analysis

### ✅ Working Features
- Projects automatically create Google Drive folders via `createProjectFolder()` 
- Project files display in `ProjectFileList` component
- File upload working via `FileDropzone` component
- Google Drive integration established
- Hierarchical folder structure (Areas → Projects)

### ❌ Missing Features
- folderId storage (only stores driveFolderUrl)
- Subfolder navigation in file browser
- Google Docs/Sheets/Slides creation within projects
- Tabbed interface for project features
- Error handling for file operations
- State persistence across navigation

## Architecture Overview

### Component Hierarchy
```
MainContent
├── ProjectTabs (new)
│   ├── useProjectTabs hook (new)
│   ├── TasksTab (existing DraggableTaskList)
│   ├── FilesTab
│   │   ├── EnhancedProjectFileList (new)
│   │   ├── FolderNavigator (new)
│   │   └── FileCreationToolbar (new)
│   └── DocumentsTab (new)
└── [existing components...]
```

### Data Flow
```
User Action → Component → API Service → Google Apps Script → Google Drive API
     ↓
State Management (React Context + localStorage) ← Error Boundaries ← Response
```

### Backend API Additions
```
Code.gs (existing) + New Functions:
├── getProjectFolderId() - Extract from URL
├── createGoogleDoc() - Document creation
├── createGoogleSheet() - Spreadsheet creation
├── createGoogleSlides() - Presentation creation
├── createProjectSubfolder() - Folder organization
└── getFolderContents() - Navigation support
```

## Implementation Phases

### Phase 1: Foundation & Safety (No Breaking Changes)
**Duration**: 2-3 days  
**Risk**: Low  

#### Task 1A: Backward-Compatible folderId Addition
**File**: `backend/Code.gs`
**Objective**: Add folderId extraction without database changes

```javascript
// Add utility function to extract folderId from existing driveFolderUrl
function getProjectFolderId(projectId) {
  try {
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project?.driveFolderUrl) {
      console.warn(`No drive folder URL found for project ${projectId}`);
      return null;
    }
    return extractFolderIdFromUrl(project.driveFolderUrl);
  } catch (error) {
    console.error('Error extracting folder ID:', error);
    return null;
  }
}

// Add to doGet/doPost for API access
case 'getProjectFolderId':
  result = { success: true, data: getProjectFolderId(parameters[0]) };
  break;
```

#### Task 1B: Error-Safe Type Updates
**File**: `src/types/index.ts`
**Objective**: Support both legacy and enhanced project data

```typescript
// Keep existing Project interface unchanged
export interface Project {
  id: string;
  name: string;
  description: string;
  areaId: string | null;
  status: 'Active' | 'Paused' | 'Completed' | 'Archive';
  driveFolderId?: string; // Keep optional for backward compatibility
  driveFolderUrl?: string;
  createdAt: string;
}

// Add new interface for enhanced features
export interface ProjectWithFolder extends Project {
  driveFolderId: string; // Required for enhanced features
}

// Navigation types
export interface FolderBreadcrumb {
  id: string;
  name: string;
  path: string[];
}

export interface FolderContents {
  files: ProjectFile[];
  folders: DriveFolder[];
  currentPath: string[];
}
```

#### Task 1C: Core Hook Implementation
**File**: `src/hooks/useProjectTabs.ts` (new)
**Objective**: Centralized tab state management

```typescript
import { useState, useEffect } from 'react';

type TabType = 'tasks' | 'files' | 'documents';

export function useProjectTabs(projectId: string) {
  const [activeTab, setActiveTab] = useState<TabType>('tasks');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Persist tab selection per project in localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`project-tab-${projectId}`);
      if (saved && ['tasks', 'files', 'documents'].includes(saved)) {
        setActiveTab(saved as TabType);
      }
    } catch (err) {
      console.warn('Failed to load saved tab preference:', err);
    }
  }, [projectId]);

  const changeTab = (tab: TabType) => {
    try {
      setActiveTab(tab);
      localStorage.setItem(`project-tab-${projectId}`, tab);
      setError(null);
    } catch (err) {
      console.error('Failed to save tab preference:', err);
      setError('Failed to save tab preference');
    }
  };

  return { 
    activeTab, 
    changeTab, 
    loading, 
    error,
    clearError: () => setError(null)
  };
}
```

### Phase 2: Enhanced File Management (Incremental)
**Duration**: 3-4 days  
**Risk**: Medium  

#### Task 2A: Folder Navigation Hook
**File**: `src/hooks/useFolderNavigation.ts` (new)
**Objective**: Handle folder traversal and breadcrumbs

```typescript
import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { FolderBreadcrumb, FolderContents } from '../types';

export function useFolderNavigation(projectId: string) {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<FolderBreadcrumb[]>([]);
  const [contents, setContents] = useState<FolderContents | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize with project's root folder
  useEffect(() => {
    initializeProjectFolder();
  }, [projectId]);

  const initializeProjectFolder = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiService.getProjectFolderId(projectId);
      if (response) {
        setCurrentFolderId(response);
        setBreadcrumbs([{ id: response, name: 'Project Root', path: [] }]);
        await loadFolderContents(response);
      } else {
        throw new Error('Project folder not found');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load project folder');
    } finally {
      setLoading(false);
    }
  };

  const loadFolderContents = async (folderId: string) => {
    try {
      setLoading(true);
      const files = await apiService.getFolderContents(folderId);
      setContents({
        files: files.filter(f => !f.isFolder),
        folders: files.filter(f => f.isFolder),
        currentPath: breadcrumbs.map(b => b.name)
      });
    } catch (err) {
      setError('Failed to load folder contents');
    } finally {
      setLoading(false);
    }
  };

  const navigateToFolder = async (folderId: string, folderName: string) => {
    try {
      setCurrentFolderId(folderId);
      setBreadcrumbs(prev => [...prev, { 
        id: folderId, 
        name: folderName, 
        path: [...prev.map(b => b.name), folderName] 
      }]);
      await loadFolderContents(folderId);
    } catch (err) {
      setError('Navigation failed');
    }
  };

  const navigateToBreadcrumb = async (index: number) => {
    try {
      const targetBreadcrumb = breadcrumbs[index];
      setCurrentFolderId(targetBreadcrumb.id);
      setBreadcrumbs(breadcrumbs.slice(0, index + 1));
      await loadFolderContents(targetBreadcrumb.id);
    } catch (err) {
      setError('Navigation failed');
    }
  };

  return {
    currentFolderId,
    breadcrumbs,
    contents,
    loading,
    error,
    navigateToFolder,
    navigateToBreadcrumb,
    refresh: () => currentFolderId && loadFolderContents(currentFolderId),
    clearError: () => setError(null)
  };
}
```

#### Task 2B: Enhanced File List Component
**File**: `src/components/EnhancedProjectFileList.tsx` (new)
**Objective**: File browser with folder navigation

```typescript
import React from 'react';
import { useFolderNavigation } from '../hooks/useFolderNavigation';
import { FileCreationToolbar } from './FileCreationToolbar';
import { BreadcrumbNavigation } from './BreadcrumbNavigation';
import { FileGrid } from './FileGrid';
import { ErrorBoundary } from './ErrorBoundary';

interface EnhancedProjectFileListProps {
  projectId: string;
  viewMode?: 'list' | 'grid';
}

export default function EnhancedProjectFileList({ 
  projectId, 
  viewMode = 'list' 
}: EnhancedProjectFileListProps) {
  const {
    currentFolderId,
    breadcrumbs,
    contents,
    loading,
    error,
    navigateToFolder,
    navigateToBreadcrumb,
    refresh,
    clearError
  } = useFolderNavigation(projectId);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="text-red-800">{error}</div>
          <button 
            onClick={clearError}
            className="text-red-600 hover:text-red-800"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  if (loading && !contents) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={<div>Something went wrong with the file browser</div>}>
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          {/* Header with breadcrumbs */}
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">Project Files</h3>
            <FileCreationToolbar 
              projectId={projectId}
              currentFolderId={currentFolderId}
              onFileCreated={refresh}
            />
          </div>

          {/* Breadcrumb navigation */}
          <BreadcrumbNavigation 
            breadcrumbs={breadcrumbs}
            onNavigate={navigateToBreadcrumb}
          />

          {/* File/folder grid */}
          <FileGrid 
            contents={contents}
            viewMode={viewMode}
            loading={loading}
            onFolderClick={navigateToFolder}
            onRefresh={refresh}
          />
        </div>
      </div>
    </ErrorBoundary>
  );
}
```

### Phase 3: Backend API Enhancements (Safe Additions)
**Duration**: 2-3 days  
**Risk**: Low  

#### Task 3A: File Creation Functions
**File**: `backend/Code.gs`
**Objective**: Add Google Workspace file creation

```javascript
// Add to doPost switch statement
case 'createGoogleDoc':
  result = createGoogleDoc(parameters[0], parameters[1], parameters[2]);
  break;
case 'createGoogleSheet':
  result = createGoogleSheet(parameters[0], parameters[1], parameters[2]);
  break;
case 'createGoogleSlides':
  result = createGoogleSlides(parameters[0], parameters[1], parameters[2]);
  break;
case 'createProjectSubfolder':
  result = createProjectSubfolder(parameters[0], parameters[1], parameters[2]);
  break;
case 'getFolderContents':
  result = getFolderContents(parameters[0]);
  break;

function createGoogleDoc(projectId, fileName, parentFolderId = null) {
  try {
    const targetFolderId = parentFolderId || getProjectFolderId(projectId);
    if (!targetFolderId) {
      return { success: false, message: 'Project folder not found' };
    }
    
    // Validate folder exists and is accessible
    const folder = DriveApp.getFolderById(targetFolderId);
    
    // Create document with error handling
    const doc = Docs.Documents.create({ title: fileName });
    const file = DriveApp.getFileById(doc.documentId);
    
    // Move to target folder
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    
    console.log(`Created Google Doc "${fileName}" in folder ${targetFolderId}`);
    
    return { 
      success: true, 
      data: { 
        documentId: doc.documentId,
        documentUrl: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        folderId: targetFolderId,
        fileName: fileName,
        mimeType: 'application/vnd.google-apps.document',
        createdAt: new Date().toISOString()
      } 
    };
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    return { success: false, message: `Failed to create document: ${error.toString()}` };
  }
}

function createGoogleSheet(projectId, fileName, parentFolderId = null) {
  try {
    const targetFolderId = parentFolderId || getProjectFolderId(projectId);
    if (!targetFolderId) {
      return { success: false, message: 'Project folder not found' };
    }
    
    const folder = DriveApp.getFolderById(targetFolderId);
    
    // Create spreadsheet
    const sheet = SpreadsheetApp.create(fileName);
    const file = DriveApp.getFileById(sheet.getId());
    
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    
    console.log(`Created Google Sheet "${fileName}" in folder ${targetFolderId}`);
    
    return { 
      success: true, 
      data: { 
        documentId: sheet.getId(),
        documentUrl: sheet.getUrl(),
        folderId: targetFolderId,
        fileName: fileName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        createdAt: new Date().toISOString()
      } 
    };
  } catch (error) {
    console.error('Error creating Google Sheet:', error);
    return { success: false, message: `Failed to create spreadsheet: ${error.toString()}` };
  }
}

function createGoogleSlides(projectId, fileName, parentFolderId = null) {
  try {
    const targetFolderId = parentFolderId || getProjectFolderId(projectId);
    if (!targetFolderId) {
      return { success: false, message: 'Project folder not found' };
    }
    
    const folder = DriveApp.getFolderById(targetFolderId);
    
    // Create presentation
    const presentation = SlidesApp.create(fileName);
    const file = DriveApp.getFileById(presentation.getId());
    
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    
    console.log(`Created Google Slides "${fileName}" in folder ${targetFolderId}`);
    
    return { 
      success: true, 
      data: { 
        documentId: presentation.getId(),
        documentUrl: `https://docs.google.com/presentation/d/${presentation.getId}/edit`,
        folderId: targetFolderId,
        fileName: fileName,
        mimeType: 'application/vnd.google-apps.presentation',
        createdAt: new Date().toISOString()
      } 
    };
  } catch (error) {
    console.error('Error creating Google Slides:', error);
    return { success: false, message: `Failed to create presentation: ${error.toString()}` };
  }
}

function getFolderContents(folderId) {
  try {
    const folder = DriveApp.getFolderById(folderId);
    const contents = [];
    
    // Get subfolders
    const subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      const subfolder = subfolders.next();
      contents.push({
        id: subfolder.getId(),
        name: subfolder.getName(),
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: subfolder.getLastUpdated().toISOString(),
        webViewLink: subfolder.getUrl(),
        isFolder: true,
        size: null
      });
    }
    
    // Get files (reuse existing logic from getProjectFiles)
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      
      let mimeType;
      try {
        mimeType = file.getBlob().getContentType();
      } catch (e) {
        mimeType = 'application/vnd.google-apps.script';
      }
      
      contents.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: mimeType,
        size: file.getSize(),
        modifiedTime: file.getLastUpdated().toISOString(),
        webViewLink: file.getUrl(),
        isFolder: false
      });
    }
    
    // Sort: folders first, then files, both alphabetically
    contents.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return { success: true, data: contents };
  } catch (error) {
    console.error('Error getting folder contents:', error);
    return { success: false, message: error.toString() };
  }
}
```

### Phase 4: UI Integration (Progressive Enhancement)
**Duration**: 3-4 days  
**Risk**: Medium  

#### Task 4A: Tabbed Interface Component
**File**: `src/components/ProjectTabs.tsx` (new)
**Objective**: Main tabbed navigation interface

```typescript
import React from 'react';
import { useProjectTabs } from '../hooks/useProjectTabs';
import DraggableTaskList from './DraggableTaskList';
import EnhancedProjectFileList from './EnhancedProjectFileList';
import DocumentsList from './DocumentsList';
import { useApp } from '../context/AppContext';

interface ProjectTabsProps {
  projectId: string;
}

export default function ProjectTabs({ projectId }: ProjectTabsProps) {
  const { activeTab, changeTab, error, clearError } = useProjectTabs(projectId);
  const { state } = useApp();
  
  const project = state.projects.find(p => p.id === projectId);
  
  if (!project) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Project not found</div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          <TabButton 
            active={activeTab === 'tasks'} 
            onClick={() => changeTab('tasks')}
            icon="📋"
          >
            Tasks
          </TabButton>
          <TabButton 
            active={activeTab === 'files'} 
            onClick={() => changeTab('files')}
            icon="📁"
          >
            Files
          </TabButton>
          <TabButton 
            active={activeTab === 'documents'} 
            onClick={() => changeTab('documents')}
            icon="📝"
          >
            Documents
          </TabButton>
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-red-800 text-sm">{error}</div>
            <button 
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'tasks' && <DraggableTaskList />}
        {activeTab === 'files' && <EnhancedProjectFileList projectId={projectId} />}
        {activeTab === 'documents' && <DocumentsList projectId={projectId} />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
}

function TabButton({ active, onClick, children, icon }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2
        ${active 
          ? 'border-primary-500 text-primary-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
      `}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}
```

#### Task 4B: File Creation Toolbar
**File**: `src/components/FileCreationToolbar.tsx` (new)
**Objective**: Google Workspace file creation interface

```typescript
import React, { useState } from 'react';
import { apiService } from '../services/api';
import { useApp } from '../context/AppContext';

interface FileCreationToolbarProps {
  projectId: string;
  currentFolderId: string | null;
  onFileCreated: () => void;
}

export default function FileCreationToolbar({ 
  projectId, 
  currentFolderId, 
  onFileCreated 
}: FileCreationToolbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [creating, setCreating] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [showNameInput, setShowNameInput] = useState<string | null>(null);
  const { state, dispatch } = useApp();

  const createFile = async (type: 'doc' | 'sheet' | 'slides') => {
    if (!fileName.trim()) {
      alert('Please enter a file name');
      return;
    }

    setCreating(type);
    try {
      const userProfile = state.userProfile;
      if (!userProfile) throw new Error('Not authenticated');

      let result;
      switch (type) {
        case 'doc':
          result = await apiService.createGoogleDoc(projectId, fileName, currentFolderId, userProfile.id_token);
          break;
        case 'sheet':
          result = await apiService.createGoogleSheet(projectId, fileName, currentFolderId, userProfile.id_token);
          break;
        case 'slides':
          result = await apiService.createGoogleSlides(projectId, fileName, currentFolderId, userProfile.id_token);
          break;
      }

      if (result) {
        onFileCreated();
        setFileName('');
        setShowNameInput(null);
        setIsOpen(false);
        
        // Optionally open the created file
        window.open(result.documentUrl, '_blank');
      }
    } catch (error) {
      console.error('Failed to create file:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: `Failed to create ${type}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setCreating(null);
    }
  };

  const handleCreateClick = (type: 'doc' | 'sheet' | 'slides') => {
    setShowNameInput(type);
    setFileName(`New ${type === 'doc' ? 'Document' : type === 'sheet' ? 'Spreadsheet' : 'Presentation'}`);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
        New
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10">
          <div className="py-1" role="menu">
            <button
              onClick={() => handleCreateClick('doc')}
              disabled={creating === 'doc'}
              className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left disabled:opacity-50"
            >
              <span className="mr-3">📝</span>
              Google Doc
              {creating === 'doc' && <span className="ml-auto">...</span>}
            </button>
            <button
              onClick={() => handleCreateClick('sheet')}
              disabled={creating === 'sheet'}
              className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left disabled:opacity-50"
            >
              <span className="mr-3">📊</span>
              Google Sheets
              {creating === 'sheet' && <span className="ml-auto">...</span>}
            </button>
            <button
              onClick={() => handleCreateClick('slides')}
              disabled={creating === 'slides'}
              className="group flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left disabled:opacity-50"
            >
              <span className="mr-3">📈</span>
              Google Slides
              {creating === 'slides' && <span className="ml-auto">...</span>}
            </button>
          </div>
        </div>
      )}

      {/* File name input modal */}
      {showNameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Create New {showNameInput === 'doc' ? 'Document' : showNameInput === 'sheet' ? 'Spreadsheet' : 'Presentation'}
            </h3>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createFile(showNameInput as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter file name"
              autoFocus
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowNameInput(null);
                  setFileName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createFile(showNameInput as any)}
                disabled={!fileName.trim() || creating}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

### Phase 5: Integration & Feature Flags
**Duration**: 2 days  
**Risk**: Low  

#### Task 5A: MainContent Integration with Feature Flags
**File**: `src/components/MainContent.tsx`
**Objective**: Progressive rollout of new interface

```typescript
// Add near the top of the component
const useEnhancedProjectView = localStorage.getItem('enhanced-project-view') === 'true';

// Replace the project features section (lines 90-104) with:
{showProjectFeatures && (
  <div className="space-y-4">
    {/* Feature flag toggle for testing */}
    <div className="text-xs text-gray-500 flex items-center space-x-2">
      <label className="inline-flex items-center">
        <input
          type="checkbox"
          checked={useEnhancedProjectView}
          onChange={(e) => {
            localStorage.setItem('enhanced-project-view', e.target.checked.toString());
            window.location.reload(); // Reload to apply changes
          }}
          className="form-checkbox h-3 w-3 text-primary-600"
        />
        <span className="ml-2">Enhanced Project View (Beta)</span>
      </label>
    </div>

    {useEnhancedProjectView ? (
      <ProjectTabs projectId={selectedProjectId!} />
    ) : (
      <>
        <FileDropzone 
          projectId={selectedProjectId!} 
          onFilesUploaded={handleFilesUploaded}
        />
        <ProjectFileList 
          projectId={selectedProjectId!}
          refreshTrigger={fileRefreshTrigger}
        />
        <div className="bg-white rounded-lg">
          <AISuggestions />
        </div>
      </>
    )}
  </div>
)}
```

#### Task 5B: API Service Updates
**File**: `src/services/api.ts`
**Objective**: Add new API methods

```typescript
// Add these methods to the apiService class

async getProjectFolderId(projectId: string, token: string): Promise<string | null> {
  const response = await this.executeGoogleScript<string>(token, 'getProjectFolderId', [projectId], 'GET');
  return response;
}

async createGoogleDoc(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
  const response = await this.executeGoogleScript<any>(token, 'createGoogleDoc', [projectId, fileName, parentFolderId]);
  return response;
}

async createGoogleSheet(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
  const response = await this.executeGoogleScript<any>(token, 'createGoogleSheet', [projectId, fileName, parentFolderId]);
  return response;
}

async createGoogleSlides(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
  const response = await this.executeGoogleScript<any>(token, 'createGoogleSlides', [projectId, fileName, parentFolderId]);
  return response;
}

async getFolderContents(folderId: string, token: string): Promise<any[]> {
  const response = await this.executeGoogleScript<any[]>(token, 'getFolderContents', [folderId], 'GET');
  return response || [];
}
```

## Testing Strategy

### Unit Tests
```bash
# Test individual components
npm test src/hooks/useProjectTabs.test.ts
npm test src/hooks/useFolderNavigation.test.ts
npm test src/components/ProjectTabs.test.tsx
```

### Integration Tests
```bash
# Test feature flag toggling
# Test tab persistence
# Test file creation workflow
# Test folder navigation
```

### Manual Testing Checklist
- [ ] Feature flag enables/disables enhanced view
- [ ] Tab selection persists across page reloads
- [ ] File creation works for all Google Workspace types
- [ ] Folder navigation breadcrumbs work correctly
- [ ] Error handling displays user-friendly messages
- [ ] Loading states show during async operations
- [ ] Existing functionality unchanged when feature flag disabled

### Performance Testing
- [ ] Large folder loading times acceptable (<3s for 100+ files)
- [ ] Tab switching feels instant
- [ ] File creation completes within 5 seconds
- [ ] Memory usage stable during navigation

## Deployment Plan

### Pre-deployment
1. Backend function deployment to Google Apps Script
2. Frontend build with feature flags disabled by default
3. Database backup (though no schema changes required)

### Deployment Steps
1. Deploy backend changes first
2. Deploy frontend with feature flags
3. Enable feature flag for testing users
4. Monitor error rates and performance
5. Gradual rollout to all users
6. Remove feature flag once stable

### Rollback Plan
- Disable feature flag immediately if issues arise
- Previous functionality remains fully intact
- No data migration needed for rollback

## Success Metrics

### User Experience
- Tab usage analytics (which tabs used most)
- File creation frequency increase
- Time spent in project views
- User feedback scores

### Technical Metrics
- Error rates <1% for file operations
- Page load times remain <2s
- API response times <500ms average
- Zero data loss incidents

## Future Enhancements

### Phase 6: Advanced Features (Future)
- Drag & drop file organization between folders
- Bulk file operations (move, delete, rename)
- File preview in sidebar
- Integration with Google Drive search
- Collaborative features (sharing, comments)
- Version history integration
- Advanced file filtering and sorting

### Phase 7: Performance Optimizations (Future)
- Virtual scrolling for large file lists
- File thumbnail caching
- Lazy loading of folder contents
- Background sync of file changes
- Offline support for recently accessed files

This implementation plan ensures a smooth, risk-free enhancement of your productivity app while maintaining all existing functionality and providing a clear path for future improvements.