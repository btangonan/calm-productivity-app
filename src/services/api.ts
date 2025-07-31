import type { Area, Project, Task, GoogleScriptResponse, Contact, TaskWithIntegrations, Document, ProjectFile, TaskAttachment, DriveFolder, DriveStructure } from '../types';
import { authService } from './AuthService';

// Google Apps Script API functions
// These will be available when deployed as a Google Apps Script web app
declare global {
  interface Window {
    google: {
      script: {
        run: {
          withSuccessHandler: (callback: (result: any) => void) => {
            withFailureHandler: (callback: (error: any) => void) => {
              [key: string]: (...args: any[]) => void;
            };
          };
          withFailureHandler: (callback: (error: any) => void) => {
            [key: string]: (...args: any[]) => void;
          };
          [key: string]: (...args: any[]) => void;
        };
      };
    };
  }
}

class ApiService {
  private readonly APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbxoBsxraR0CQMkvpVTcTpQylqRTK7fNuNoQs3bV-I-DKzP5_jWVBlGMJ2TrcN1trpMm/exec';
  private readonly EDGE_FUNCTIONS_URL = import.meta.env.PROD 
    ? 'https://nowandlater.vercel.app/api'
    : 'http://localhost:3000/api';
  
  private isGoogleAppsScript = true; // Enable Google Apps Script backend
  private useEdgeFunctions = import.meta.env.VITE_USE_EDGE_FUNCTIONS === 'true' || false; // Feature flag for Edge Functions
  private enableFallback = true; // Fallback to Apps Script if Edge Functions fail
  private backendHealthy = true; // Track backend health status

  // Methods to control Edge Functions for testing
  enableEdgeFunctions() {
    this.useEdgeFunctions = true;
    console.log('🚀 Edge Functions enabled');
  }

  disableEdgeFunctions() {
    this.useEdgeFunctions = false;
    console.log('🔄 Using legacy Apps Script');
  }

  getBackendStatus() {
    const status = {
      useEdgeFunctions: this.useEdgeFunctions,
      enableFallback: this.enableFallback,
      edgeFunctionsUrl: this.EDGE_FUNCTIONS_URL,
      appsScriptUrl: this.APPS_SCRIPT_URL,
      viteEnvVar: import.meta.env.VITE_USE_EDGE_FUNCTIONS
    };
    console.log('📊 Backend Status:', status);
    return status;
  }

  // Log status on initialization
  constructor() {
    console.log(`🏗️ ApiService initialized - Edge Functions: ${this.useEdgeFunctions ? 'ENABLED' : 'DISABLED'}`);
  }

  // Set callback for auth errors (to trigger logout)
  setAuthErrorCallback(callback: () => void) {
    authService.setAuthErrorCallback(callback);
  }

  // Handle 401 unauthorized errors - delegate to AuthService
  private async handleAuthError(context: string): Promise<boolean> {
    return await authService.handleAuthError(context);
  }

  // Attempt to refresh the access token - delegate to AuthService
  private async attemptTokenRefresh(): Promise<{ success: boolean; newToken?: string }> {
    return await authService.attemptTokenRefresh();
  }

  // Set callback for token refresh - delegate to AuthService
  setTokenRefreshCallback(callback: (newProfile: any) => void) {
    authService.setTokenRefreshCallback(callback);
  }

  // Check if access token is expired - delegate to AuthService
  private isTokenExpired(token: string): boolean {
    return authService.isTokenExpired(token);
  }

  // Enhanced fetch with automatic 401 handling and retry
  async fetchWithAuth(url: string, options: RequestInit = {}, context: string = 'API call', token?: string, isRetry: boolean = false): Promise<Response> {
    console.log(`🔐AUTH fetchWithAuth called:`, {
      url,
      context,
      hasToken: !!token,
      tokenPrefix: token?.substring(0, 20) + '...',
      isRetry
    });

    // Check if token is expired before making the request
    if (token && !isRetry) {
      const isExpired = this.isTokenExpired(token);
      console.log(`🔐AUTH Token expiry check:`, {
        isExpired,
        tokenLength: token.length,
        context
      });
      
      if (isExpired) {
        console.log('🔐AUTH Token expired before request, attempting refresh...');
        const refreshResult = await this.attemptTokenRefresh();
        console.log('🔐AUTH Pre-request refresh result:', {
          success: refreshResult.success,
          hasNewToken: !!refreshResult.newToken,
          newTokenPrefix: refreshResult.newToken?.substring(0, 20) + '...'
        });
        
        if (refreshResult.success && refreshResult.newToken) {
          console.log('🔐AUTH Pre-request token refresh successful, using new token');
          token = refreshResult.newToken;
        } else {
          console.log('🔐AUTH Pre-request token refresh failed');
          throw new Error('Authentication expired - please sign in again');
        }
      }
    }

    // Automatically add Authorization header if token is provided
    if (token) {
      options = {
        ...options,
        headers: {
          ...options.headers,
          'Authorization': `Bearer ${token}`
        }
      };
    }
    
    console.log(`🔐AUTH Making ${context} request to: ${url}`);
    console.log('🔐AUTH Authorization header:', options.headers?.['Authorization'] ? 'Present' : 'Missing');
    
    const response = await fetch(url, options);
    
    console.log(`🔐AUTH ${context} response:`, {
      url,
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });
    
    if (response.status === 401 && !isRetry) {
      console.log('🔐AUTH Got 401, checking if token refresh is needed...');
      
      // Check if the response indicates token refresh is needed
      try {
        const errorData = await response.clone().json();
        if (errorData.needsRefresh) {
          console.log('🔐AUTH Backend indicates token refresh needed, attempting refresh...');
          const refreshResult = await this.attemptTokenRefresh();
          
          if (refreshResult.success && refreshResult.newToken) {
            console.log('🔐AUTH Token refresh successful, retrying request with new token');
            return this.fetchWithAuth(url, options, context, refreshResult.newToken, true);
          } else {
            console.log('🔐AUTH Token refresh failed');
            throw new Error('Authentication expired - please sign in again');
          }
        }
      } catch (parseError) {
        console.warn('🔐AUTH Could not parse 401 response for needsRefresh flag');
      }
      
      // Fallback to original logic
      const shouldRetry = await this.handleAuthError(context);
      
      if (shouldRetry) {
        console.log('🔄 Retrying request with refreshed token...');
        // Get the new token from localStorage (using correct key)
        const userProfile = JSON.parse(localStorage.getItem('google-auth-state') || '{}');
        const newToken = userProfile.access_token;
        
        if (newToken) {
          // Retry the request with the new token
          return this.fetchWithAuth(url, options, context, newToken, true);
        }
      }
      
      // If refresh failed or no retry, trigger logout
      throw new Error('Authentication expired - please sign in again');
    } else if (response.status === 401 && isRetry) {
      // If retry also failed, give up
      console.error('❌ Retry with refreshed token also failed');
      throw new Error('Authentication expired - please sign in again');
    }
    
    return response;
  }

  // Mock data for development
  private mockAreas: Area[] = [
    { 
      id: '1', 
      name: 'Personal', 
      description: 'Personal tasks and projects', 
      driveFolderId: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms', // Example Google Drive folder ID
      driveFolderUrl: 'https://drive.google.com/drive/folders/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms',
      createdAt: new Date().toISOString() 
    },
    { 
      id: '2', 
      name: 'Work', 
      description: 'Work-related items',
      driveFolderId: '1UpxCxGI0Oo_cL4XuN0QGod4p3lwLBYEF', // Example Google Drive folder ID
      driveFolderUrl: 'https://drive.google.com/drive/folders/1UpxCxGI0Oo_cL4XuN0QGod4p3lwLBYEF',
      createdAt: new Date().toISOString() 
    }
  ];

  private mockProjectFiles: Record<string, ProjectFile[]> = {
    '1': [
      {
        id: 'file_1',
        name: 'Kitchen_Plans.pdf',
        mimeType: 'application/pdf',
        size: 2048000,
        url: 'https://drive.google.com/file/d/example1/view',
        thumbnailUrl: 'https://drive.google.com/thumbnail?id=example1',
        createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        modifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'file_2',
        name: 'Contractor_Quotes.xlsx',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 512000,
        url: 'https://drive.google.com/file/d/example2/view',
        createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        modifiedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      }
    ],
    '2': [
      {
        id: 'file_3',
        name: 'Q4_Strategy.pptx',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        size: 4096000,
        url: 'https://drive.google.com/file/d/example3/view',
        thumbnailUrl: 'https://drive.google.com/thumbnail?id=example3',
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        modifiedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString()
      }
    ]
  };

  private mockProjects: Project[] = [
    {
      id: '1',
      name: 'Home Renovation',
      description: 'Kitchen and bathroom updates',
      areaId: '1',
      status: 'Active',
      driveFolderId: '1SmWFnzcqKuiKX3-r_9PPaH0TMTMDThBy', // Example Google Drive folder ID
      driveFolderUrl: 'https://drive.google.com/drive/folders/1SmWFnzcqKuiKX3-r_9PPaH0TMTMDThBy',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Q4 Planning',
      description: 'Strategic planning for Q4',
      areaId: '2',
      status: 'Active',
      driveFolderId: '1mwSF0YOX6kTjZxFy9Bg2MHI5Q9uX8JzD', // Example Google Drive folder ID  
      driveFolderUrl: 'https://drive.google.com/drive/folders/1mwSF0YOX6kTjZxFy9Bg2MHI5Q9uX8JzD',
      createdAt: new Date().toISOString()
    }
  ];

  private mockTasks: Task[] = [
    {
      id: '1',
      title: 'Research contractors',
      description: 'Find 3 quotes for kitchen renovation',
      projectId: '1',
      context: '@research',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isCompleted: false,
      sortOrder: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      title: 'Review budget',
      description: 'Check Q3 expenses',
      projectId: '2',
      context: '@computer',
      dueDate: new Date().toISOString().split('T')[0],
      isCompleted: false,
      sortOrder: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: '3',
      title: 'Quick inbox task',
      description: 'Something without a project',
      projectId: null,
      context: '@errands',
      dueDate: null,
      isCompleted: false,
      sortOrder: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: '4',
      title: 'Test task with very long description',
      description: 'This task has an extremely long description that demonstrates the new expand/collapse functionality. When collapsed, you see just a snippet. When expanded, you can see the full description plus a dedicated area for future features like checklists, attachments, and other rich content. This expandable system will make tasks much more powerful while keeping the interface clean and organized.',
      projectId: '1',
      context: '@computer',
      dueDate: null,
      isCompleted: false,
      sortOrder: 2,
      createdAt: new Date().toISOString()
    },
    {
      id: '5',
      title: 'Short task',
      description: 'Simple task with short description',
      projectId: '2',  
      context: '@office',
      dueDate: null,
      isCompleted: false,
      sortOrder: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: '6',
      title: 'Future checklist task',
      description: 'This task will eventually have checklists:\n\n• Research vendors\n• Get three quotes\n• Compare pricing\n• Make recommendation\n\nThe expand area below will show these as interactive checkboxes in a future update.',
      projectId: null,
      context: '@research',
      dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      isCompleted: false,
      sortOrder: 1,
      createdAt: new Date().toISOString()
    },
    {
      id: '7',
      title: 'Task with sample attachments',
      description: 'This task demonstrates the attachment functionality with a sample image and document.',
      projectId: '1',
      context: '@computer',
      dueDate: null,
      isCompleted: false,
      sortOrder: 3,
      createdAt: new Date().toISOString(),
      attachments: [
        {
          id: 'att_sample_1',
          name: 'project-mockup.png',
          mimeType: 'image/png',
          size: 245760,
          url: 'https://picsum.photos/400/300?random=1',
          thumbnailUrl: 'https://picsum.photos/400/300?random=1',
          uploadedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
        },
        {
          id: 'att_sample_2',
          name: 'requirements.pdf',
          mimeType: 'application/pdf',
          size: 1024000,
          url: 'https://example.com/sample.pdf',
          uploadedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString()
        }
      ]
    }
  ];

  private async executeGoogleScript<T>(token: string, functionName: string, args: any[] = [], httpMethod: 'GET' | 'POST' = 'POST'): Promise<GoogleScriptResponse<T>> {
    const startTime = performance.now();
    console.log(`🔄 executeGoogleScript called: ${functionName} (${httpMethod}) at ${new Date().toLocaleTimeString()}`);
    console.log(`📊 Backend status: isGoogleAppsScript=${this.isGoogleAppsScript}, backendHealthy=${this.backendHealthy}`);
    
    if (!this.isGoogleAppsScript || !this.backendHealthy) {
      console.log(`⚠️ Using mock data for ${functionName} - backend unhealthy or disabled`);
      return this.getMockResponse<T>(functionName, ...args);
    }

    try {
      const payload = {
        action: functionName,
        parameters: args,
        token: token, // Pass token in payload
      };

      let url = this.APPS_SCRIPT_URL;
      const options: RequestInit = {
        method: httpMethod,
        mode: 'cors',
      };

      if (httpMethod === 'GET') {
        const params = new URLSearchParams();
        params.append('function', functionName);
        params.append('parameters', JSON.stringify(args));
        params.append('token', token);
        url = `${this.APPS_SCRIPT_URL}?${params.toString()}`;
        console.log(`🌐 GET Request URL: ${url}`);
      } else { // POST
        options.headers = {
          'Content-Type': 'text/plain;charset=utf-8',
        };
        options.body = JSON.stringify(payload);
        console.log(`🌐 POST Request to: ${url}`);
        console.log(`📝 POST Body: ${JSON.stringify(payload)}`);
      }

      console.log(`📡 Making ${httpMethod} request to backend...`);
      const response = await fetch(url, options);
      console.log(`📡 Response status: ${response.status}`);
      console.log(`📡 Response headers:`, Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ HTTP error ${response.status}:`, errorText.substring(0, 500));
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      const endTime = performance.now();
      console.log(`✅ ${functionName} response:`, result);
      console.log(`⚡ ${functionName} execution time: ${(endTime - startTime).toFixed(1)}ms`);
      return result as GoogleScriptResponse<T>;
    } catch (error) {
      const endTime = performance.now();
      console.error(`❌ Apps Script request failed for ${functionName}:`, error);
      console.log(`⚡ ${functionName} failed after: ${(endTime - startTime).toFixed(1)}ms`);
      console.log(`🔄 Setting backendHealthy to false, switching to mock data`);
      this.backendHealthy = false;
      return this.getMockResponse<T>(functionName, ...args);
    }
  }

  private getMockResponse<T>(functionName: string, ...args: any[]): GoogleScriptResponse<T> {
    switch (functionName) {
      case 'getAreas':
        return { success: true, data: this.mockAreas as T };
      case 'getProjects':
        return { success: true, data: this.mockProjects as T };
      case 'getTasks':
        const [projectId, view] = args;
        let filteredTasks = [...this.mockTasks];
        
        if (projectId) {
          filteredTasks = filteredTasks.filter(task => task.projectId === projectId);
        } else if (view) {
          const today = new Date();
          today.setHours(23, 59, 59, 999);
          
          switch (view) {
            case 'inbox':
              filteredTasks = filteredTasks.filter(task => !task.projectId && !task.isCompleted);
              break;
            case 'today':
              filteredTasks = filteredTasks.filter(task => 
                !task.isCompleted && task.dueDate && new Date(task.dueDate) <= today
              );
              break;
            case 'upcoming':
              filteredTasks = filteredTasks.filter(task => 
                !task.isCompleted && task.dueDate && new Date(task.dueDate) > today
              );
              break;
            case 'anytime':
              filteredTasks = filteredTasks.filter(task => !task.isCompleted && !task.dueDate);
              break;
            case 'logbook':
              filteredTasks = filteredTasks.filter(task => task.isCompleted);
              break;
          }
        }
        
        return { success: true, data: filteredTasks as T };
      case 'updateProjectArea':
        const [updateProjectId, newAreaId] = args;
        const project = this.mockProjects.find(p => p.id === updateProjectId);
        if (project) {
          project.areaId = newAreaId;
          console.log(`Mock: Updated project ${updateProjectId} to area ${newAreaId}`);
        }
        return { success: true, data: null as T };
      case 'createArea':
        const [areaName, areaDescription] = args;
        const newArea = {
          id: `area_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: areaName,
          description: areaDescription || '',
          driveFolderId: `area_folder_${Date.now()}`,
          driveFolderUrl: `https://drive.google.com/drive/folders/area_folder_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        this.mockAreas.push(newArea);
        console.log('Mock: Created area', newArea.id, 'with drive folder', newArea.driveFolderId);
        return { success: true, data: newArea as T };
      case 'createProject':
        const [projectName, projectDescription, projectAreaId] = args;
        const newProject = {
          id: `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: projectName,
          description: projectDescription || '',
          areaId: projectAreaId || null,
          status: 'Active' as const,
          driveFolderId: `project_folder_${Date.now()}`,
          driveFolderUrl: `https://drive.google.com/drive/folders/project_folder_${Date.now()}`,
          createdAt: new Date().toISOString()
        };
        this.mockProjects.push(newProject);
        console.log('Mock: Created project', newProject.id, 'with drive folder', newProject.driveFolderId);
        return { success: true, data: newProject as T };
      case 'createTask':
        const [taskTitle, taskDescription, taskProjectId, taskContext, taskDueDate, taskAttachments] = args;
        const newTask = {
          id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          title: taskTitle,
          description: taskDescription || '',
          projectId: taskProjectId || null,
          context: taskContext || '',
          dueDate: taskDueDate || null,
          isCompleted: false,
          sortOrder: this.mockTasks.length + 1,
          createdAt: new Date().toISOString(),
          attachments: taskAttachments || []
        };
        this.mockTasks.push(newTask);
        console.log('Mock: Created task', newTask.id);
        return { success: true, data: newTask as T };
      case 'getProjectFiles':
        const [fileProjectId] = args;
        const projectFiles = this.mockProjectFiles[fileProjectId] || [];
        return { success: true, data: projectFiles as T };
      case 'uploadFileToProject':
        const [uploadProjectId, file] = args;
        const newFile: ProjectFile = {
          id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          url: `https://drive.google.com/file/d/mock_${Date.now()}/view`,
          thumbnailUrl: file.type.startsWith('image/') ? `https://drive.google.com/thumbnail?id=mock_${Date.now()}` : undefined,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString()
        };
        
        if (!this.mockProjectFiles[uploadProjectId]) {
          this.mockProjectFiles[uploadProjectId] = [];
        }
        this.mockProjectFiles[uploadProjectId].push(newFile);
        console.log('Mock: Uploaded file', newFile.id, 'to project', uploadProjectId);
        return { success: true, data: newFile as T };
      case 'deleteProjectFile':
        const [deleteProjectId, fileId] = args;
        if (this.mockProjectFiles[deleteProjectId]) {
          this.mockProjectFiles[deleteProjectId] = this.mockProjectFiles[deleteProjectId].filter(f => f.id !== fileId);
          console.log('Mock: Deleted file', fileId, 'from project', deleteProjectId);
        }
        return { success: true, data: null as T };
      case 'createMasterFolder':
        const [masterFolderName] = args;
        const masterFolder = {
          id: `master_${Date.now()}`,
          name: masterFolderName,
          webViewLink: `https://drive.google.com/drive/folders/master_${Date.now()}`,
          createdTime: new Date().toISOString(),
          modifiedTime: new Date().toISOString()
        };
        console.log('Mock: Created master folder', masterFolder.id);
        return { success: true, data: masterFolder as T };
      case 'getDriveStructure':
        const mockStructure = {
          masterFolderId: 'master_folder_id',
          masterFolderName: 'Productivity App',
          areas: {},
          projects: {}
        };
        return { success: true, data: mockStructure as T };
      case 'createAreaFolder':
        const [folderAreaId, folderAreaName, folderMasterFolderId] = args;
        const areaFolder = {
          id: `area_folder_${Date.now()}`,
          name: folderAreaName,
          webViewLink: `https://drive.google.com/drive/folders/area_folder_${Date.now()}`,
          parentFolderId: folderMasterFolderId,
          createdTime: new Date().toISOString(),
          modifiedTime: new Date().toISOString()
        };
        console.log('Mock: Created area folder', areaFolder.id, 'for area', folderAreaId);
        return { success: true, data: areaFolder as T };
      case 'createProjectFolder':
        const [folderProjectId, folderProjectName, folderAreaFolderId] = args;
        const projectFolder = {
          id: `project_folder_${Date.now()}`,
          name: folderProjectName,
          webViewLink: `https://drive.google.com/drive/folders/project_folder_${Date.now()}`,
          parentFolderId: folderAreaFolderId,
          createdTime: new Date().toISOString(),
          modifiedTime: new Date().toISOString()
        };
        console.log('Mock: Created project folder', projectFolder.id, 'for project', folderProjectId);
        return { success: true, data: projectFolder as T };
      case 'uploadFileToFolder':
        const [uploadFolderId, uploadFile] = args;
        const folderFile = {
          id: `folder_file_${Date.now()}`,
          name: uploadFile.name,
          mimeType: uploadFile.type,
          size: uploadFile.size,
          url: `https://drive.google.com/file/d/folder_file_${Date.now()}/view`,
          driveFileId: `folder_file_${Date.now()}`,
          thumbnailUrl: uploadFile.type.startsWith('image/') ? `https://drive.google.com/thumbnail?id=folder_file_${Date.now()}` : undefined,
          createdAt: new Date().toISOString(),
          modifiedAt: new Date().toISOString()
        };
        console.log('Mock: Uploaded file to folder', uploadFolderId);
        return { success: true, data: folderFile as T };
      case 'getFolderFiles':
        const [folderId] = args;
        console.log('Mock: Getting files for folder', folderId);
        return { success: true, data: [] as T };
      case 'setMasterFolder':
        const [setFolderId] = args;
        console.log('Mock: Set master folder', setFolderId);
        return { success: true, data: null as T };
      default:
        return { success: true, data: null as T };
    }
  }

  // Health Check Methods
  async checkBackendHealth(): Promise<boolean> {
    if (!this.isGoogleAppsScript) {
      console.log('Using mock data mode');
      this.backendHealthy = true;
      return true;
    }

    try {
      console.log('🔍 Checking Google Apps Script backend health...');
      console.log('📍 Testing URL:', this.APPS_SCRIPT_URL);
      
      const payload = {
        action: 'healthCheck',
        timestamp: Date.now(),
      };

      const response = await fetch(this.APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(payload),
        mode: 'cors',
      });

      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const responseText = await response.text();
        console.error('❌ Health check failed with status:', response.status);
        console.error('❌ Response body:', responseText.substring(0, 500));
        this.backendHealthy = false;
        return false;
      }

      const data = await response.json();
      const isHealthy = data.success && data.version;
      this.backendHealthy = isHealthy;

      if (isHealthy) {
        console.log('✅ Backend is healthy - Version:', data.version);
      } else {
        console.warn('⚠️ Backend responding but unhealthy:', data);
      }

      return isHealthy;
    } catch (error) {
      console.error('❌ Backend health check failed:', error);
      this.backendHealthy = false;
      return false;
    }
  }

  async testConnection(): Promise<{success: boolean, data?: any, error?: string}> {
    try {
      const response = await this.executeGoogleScript('getHealthCheck');
      return {
        success: response.success,
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  

  // API Methods
  async getAreas(token: string): Promise<Area[]> {
    const response = await this.executeGoogleScript<Area[]>(token, 'getAreas', [], 'GET');
    return response.data || [];
  }

  async createArea(name: string, description: string, token: string): Promise<Area> {
    const response = await this.executeGoogleScript<Area>(token, 'createArea', [name, description]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create area');
    }
    return response.data;
  }

  async getProjects(areaId: string | undefined, token: string): Promise<Project[]> {
    const response = await this.executeGoogleScript<Project[]>(token, 'getProjects', [areaId], 'GET');
    return response.data || [];
  }

  async getTasks(projectId: string | undefined, view: string | undefined, token: string): Promise<Task[]> {
    const response = await this.executeGoogleScript<Task[]>(token, 'getTasks', [projectId, view], 'GET');
    return response.data || [];
  }

  async loadAppData(token: string): Promise<{areas: Area[], projects: Project[], tasks: Task[]}> {
    const startTime = performance.now();
    
    try {
      // Try Edge Functions first if enabled
      if (this.useEdgeFunctions) {
        console.log(`🔑 Calling Edge Function with token: ${token.substring(0, 20)}...`);
        const response = await this.fetchWithAuth(`${this.EDGE_FUNCTIONS_URL}/app/load-data`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 'loadAppData');

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Edge Function loadAppData: ${duration.toFixed(1)}ms`);
          return result.data;
        }

        // Log the error details
        const errorText = await response.text();
        console.error(`Edge Function failed: ${response.status} ${response.statusText}`, errorText);

        // If Edge Function fails and fallback is enabled
        if (this.enableFallback) {
          console.warn('Edge Function failed, falling back to Apps Script');
          return await this.loadAppDataLegacy(token);
        }

        throw new Error(`Edge Function failed: ${response.status}`);
      }

      // Use legacy Apps Script
      return await this.loadAppDataLegacy(token);

    } catch (error) {
      console.error('Load app data failed:', error);
      
      // Fallback to legacy if enabled
      if (this.useEdgeFunctions && this.enableFallback) {
        console.warn('Falling back to Apps Script due to error');
        return await this.loadAppDataLegacy(token);
      }
      
      throw error;
    }
  }

  private async loadAppDataLegacy(token: string): Promise<{areas: Area[], projects: Project[], tasks: Task[]}> {
    const startTime = performance.now();
    const response = await this.executeGoogleScript<{areas: Area[], projects: Project[], tasks: Task[]}>(token, 'loadAppData', [], 'GET');
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to load app data');
    }
    const duration = performance.now() - startTime;
    console.log(`🔄 Legacy loadAppData: ${duration.toFixed(1)}ms`);
    return response.data;
  }

  // Cache invalidation method to ensure data consistency between legacy and Edge Functions
  private async invalidateTasksCache(token: string): Promise<void> {
    try {
      // Only invalidate if Edge Functions are enabled
      if (!this.useEdgeFunctions) {
        console.log('💾 Skipping cache invalidation - Edge Functions disabled');
        return;
      }

      console.log('🗑️ Invalidating tasks cache to ensure data consistency...');
      
      const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/cache/invalidate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          cacheKeys: ['tasks', 'app-data'] // Invalidate both tasks and full app data
        })
      });

      if (response.ok) {
        console.log('✅ Cache invalidated successfully');
      } else {
        console.warn(`⚠️ Cache invalidation failed: ${response.status} - but continuing operation`);
      }
    } catch (error) {
      console.warn('⚠️ Cache invalidation error (non-critical):', error);
      // Don't throw - cache invalidation failure shouldn't break the main operation
    }
  }

  async createProject(name: string, description: string, areaId: string | undefined, token: string): Promise<Project> {
    try {
      const response = await this.fetchWithAuth('/api/projects/manage', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: name.trim(), 
          description: description.trim(), 
          areaId: areaId || null 
        }),
      }, 'createProject');
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create project');
      }
      
      console.log('Project created successfully:', data);
      return data.data;
    } catch (error) {
      console.error('Create project error:', error);
      throw error;
    }
  }

  async createTask(title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, attachments: TaskAttachment[] | undefined, token: string): Promise<Task> {
    const startTime = performance.now();
    
    try {
      // Try Edge Functions first if enabled
      if (this.useEdgeFunctions) {
        const response = await this.fetchWithAuth(`${this.EDGE_FUNCTIONS_URL}/tasks/manage`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            title,
            description,
            projectId,
            context,
            dueDate,
            attachments
          })
        }, 'createTask');

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Edge Function createTask: ${duration.toFixed(1)}ms`);
          return result.data;
        }

        // If Edge Function fails and fallback is enabled
        if (this.enableFallback) {
          console.warn('Edge Function failed, falling back to Apps Script');
          return await this.createTaskLegacy(title, description, projectId, context, dueDate, attachments, token);
        }

        throw new Error(`Edge Function failed: ${response.status}`);
      }

      // Use legacy Apps Script
      return await this.createTaskLegacy(title, description, projectId, context, dueDate, attachments, token);

    } catch (error) {
      console.error('Task creation failed:', error);
      
      // Fallback to legacy if enabled
      if (this.useEdgeFunctions && this.enableFallback) {
        console.warn('Falling back to Apps Script due to error');
        return await this.createTaskLegacy(title, description, projectId, context, dueDate, attachments, token);
      }
      
      throw error;
    }
  }

  private async createTaskLegacy(title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, attachments: TaskAttachment[] | undefined, token: string): Promise<Task> {
    const startTime = performance.now();
    const response = await this.executeGoogleScript<Task>(token, 'createTask', [title, description, projectId, context, dueDate, attachments]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task');
    }
    const duration = performance.now() - startTime;
    console.log(`🔄 Legacy createTask: ${duration.toFixed(1)}ms`);
    return response.data;
  }

  async updateTask(taskId: string, title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, token: string): Promise<Task> {
    const response = await this.executeGoogleScript<Task>(token, 'updateTask', [taskId, title, description, projectId, context, dueDate]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task');
    }
    
    // Invalidate Edge Functions cache to ensure fresh data on next load
    await this.invalidateTasksCache(token);
    return response.data;
  }

  async updateTaskCompletion(taskId: string, isCompleted: boolean, token: string): Promise<void> {
    console.log(`📝 Updating task completion: ${taskId} -> ${isCompleted}`);
    
    // Check if this is a temporary task ID that hasn't been synced yet
    if (taskId.startsWith('temp-')) {
      console.log('⏳ Task has temporary ID, delaying update to allow backend sync...');
      
      // Wait a moment for the task creation to complete in the background
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Throw a user-friendly error asking them to try again
      throw new Error('Task is still being created - please try again in a moment');
    }
    
    // Use Edge Functions if available, otherwise fallback to Google Apps Script
    if (this.useEdgeFunctions) {
      try {
        const response = await this.fetchWithAuth('/api/tasks/manage', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            taskId,
            isCompleted
          })
        }, 'updateTaskCompletion', token);

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update task completion');
        }

        const result = await response.json();
        console.log('✅ Task completion updated via Edge Functions:', result);
        
        // Invalidate cache
        await this.invalidateTasksCache(token);
        return;
        
      } catch (error) {
        console.error('Edge Functions task update failed:', error);
        if (!this.enableFallback) {
          throw error;
        }
        console.log('🔄 Falling back to Google Apps Script...');
      }
    }

    // Fallback to Google Apps Script
    const response = await this.executeGoogleScript<void>(token, 'updateTaskCompletion', [taskId, isCompleted]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update task');
    }
    
    console.log('✅ Task completion updated via Google Apps Script');
    // Invalidate Edge Functions cache to ensure fresh data on next load
    await this.invalidateTasksCache(token);
  }

  async deleteTask(taskId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteTask', [taskId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete task');
    }
    
    // Invalidate Edge Functions cache to ensure fresh data on next load
    await this.invalidateTasksCache(token);
  }

  async deleteProject(projectId: string, token: string): Promise<void> {
    try {
      const response = await this.fetchWithAuth('/api/projects/manage', {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ projectId }),
      }, 'deleteProject');
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete project');
      }
      
      console.log('Project deleted successfully:', data);
    } catch (error) {
      console.error('Delete project error:', error);
      throw error;
    }
  }


  async deleteArea(areaId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteArea', [areaId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete area');
    }
  }

  async updateProjectStatus(projectId: string, status: Project['status'], token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'updateProjectStatus', [projectId, status]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update project');
    }
  }

  async updateProjectArea(projectId: string, areaId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'updateProjectArea', [projectId, areaId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update project area');
    }
  }

  async updateProjectName(projectId: string, newName: string, token: string): Promise<Project> {
    try {
      const response = await this.fetchWithAuth('/api/projects/manage', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          projectId, 
          name: newName.trim()
        }),
      }, 'updateProjectName');
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to update project name');
      }
      
      console.log('Project name updated successfully:', data);
      return data.data;
    } catch (error) {
      console.error('Update project name error:', error);
      throw error;
    }
  }

  async reorderTasks(taskIds: string[], token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'reorderTasks', [taskIds]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to reorder tasks');
    }
    
    // Invalidate Edge Functions cache to ensure fresh data on next load
    await this.invalidateTasksCache(token);
  }

  async getAISuggestions(projectName: string, tasks: Task[]): Promise<string> {
    try {
      const prompt = `Project: ${projectName}

Current tasks:
${tasks.map(task => `- ${task.title}${task.isCompleted ? ' (completed)' : ''}`).join('\n')}

Please suggest 2-3 logical next steps or identify any potential blockers for this project. Keep suggestions concise and actionable.`;

      const response = await fetch('http://localhost:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama2', // You can change this to whatever model you're using
          prompt: prompt,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get AI suggestions');
      }

      const data = await response.json();
      return data.response || 'No suggestions available.';
    } catch (error) {
      console.error('AI suggestions error:', error);
      return 'AI suggestions temporarily unavailable. Please ensure Ollama is running locally.';
    }
  }

  // Google Integrations
  async processGmailToTasks(token: string): Promise<Task[]> {
    const response = await this.executeGoogleScript<Task[]>(token, 'processGmailToTasks');
    return response.data || [];
  }

  async syncTasksWithCalendar(token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'syncTasksWithCalendar');
    return response.data || [];
  }

  async createTaskWithIntegrations(
    title: string, 
    description: string, 
    projectId: string | undefined, 
    context: string | undefined, 
    dueDate: string | undefined,
    createCalendarEvent: boolean | undefined,
    token: string
  ): Promise<TaskWithIntegrations> {
    const response = await this.executeGoogleScript<TaskWithIntegrations>(
      token, 
      'createTaskWithIntegrations', 
      [title, description, projectId, context, dueDate, createCalendarEvent]
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task with integrations');
    }
    return response.data;
  }

  async createProjectDocument(projectId: string, projectName: string, templateType: 'project-notes' | 'meeting-notes' | 'project-plan', token: string): Promise<Document> {
    const response = await this.executeGoogleScript<Document>(token, 'createProjectDocument', [projectId, projectName, templateType]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project document');
    }
    return response.data;
  }

  async getContacts(token: string): Promise<Contact[]> {
    const response = await this.executeGoogleScript<Contact[]>(token, 'getContacts', [], 'GET');
    return response.data || [];
  }

  async setupGoogleTriggers(token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'setupTriggers');
    if (!response.success) {
      throw new Error(response.message || 'Failed to setup triggers');
    }
  }

  async testGoogleIntegrations(token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'testIntegrations');
    return response.data || {};
  }

  // File Management Methods
  async getProjectFiles(projectId: string, token: string, driveFolderId?: string): Promise<ProjectFile[]> {
    const startTime = performance.now();
    
    try {
      // Try Edge Functions first if enabled
      if (this.useEdgeFunctions) {
        console.log(`🔑 Calling Edge Function getProjectFiles with token: ${token ? token.substring(0, 20) + '...' : 'undefined'}`);
        
        // Build URL with optional folderId parameter for faster lookup
        let url = `${this.EDGE_FUNCTIONS_URL}/projects/files?projectId=${encodeURIComponent(projectId)}`;
        if (driveFolderId) {
          url += `&folderId=${encodeURIComponent(driveFolderId)}`;
          console.log('⚡ Using direct folder ID to skip Sheets lookup');
        }
        
        const response = await this.fetchWithAuth(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }, 'getProjectFiles');

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Edge Function getProjectFiles: ${duration.toFixed(1)}ms`);
          return result.data || [];
        }

        // Log the error details
        const errorText = await response.text();
        console.error(`Edge Function getProjectFiles failed: ${response.status} ${response.statusText}`, errorText);

        // If Edge Function fails and fallback is enabled
        if (this.enableFallback) {
          console.warn('Edge Function failed, falling back to Apps Script');
          return await this.getProjectFilesLegacy(projectId, token);
        }

        throw new Error(`Edge Function failed: ${response.status}`);
      }

      // Use legacy Apps Script
      return await this.getProjectFilesLegacy(projectId, token);

    } catch (error) {
      console.error('Get project files failed:', error);
      
      // Fallback to legacy if enabled
      if (this.useEdgeFunctions && this.enableFallback) {
        console.warn('Falling back to Apps Script due to error');
        return await this.getProjectFilesLegacy(projectId, token);
      }
      
      throw error;
    }
  }

  private async getProjectFilesLegacy(projectId: string, token: string): Promise<ProjectFile[]> {
    const startTime = performance.now();
    const response = await this.executeGoogleScript<ProjectFile[]>(token, 'getProjectFiles', [projectId], 'GET');
    const duration = performance.now() - startTime;
    console.log(`🔄 Legacy getProjectFiles: ${duration.toFixed(1)}ms`);
    return response.data || [];
  }

  async uploadFileToProject(projectId: string, file: File, token: string): Promise<ProjectFile> {
    const startTime = performance.now();
    console.log(`📤 Starting file upload: ${file.name} to project: ${projectId}`);

    try {
      // Convert File to base64
      const fileContent = await this.fileToBase64(file);
      
      // Use Vercel API endpoint instead of Google Apps Script
      const response = await this.fetchWithAuth(`/api/projects/files`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          projectId,
          fileName: file.name,
          fileContent,
          mimeType: file.type
        })
      }, 'uploadFileToProject');

      if (!response.ok) {
        const errorData = await response.json();
        console.error('🔥 DETAILED UPLOAD ERROR RESPONSE:', {
          status: response.status,
          statusText: response.statusText,
          errorData,
          projectId,
          fileName: file.name
        });
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to upload file`);
      }

      const result = await response.json();
      
      if (!result.success || !result.data) {
        throw new Error(result.error || 'Failed to upload file');
      }

      const duration = performance.now() - startTime;
      console.log(`⚡ uploadFileToProject execution time: ${duration.toFixed(1)}ms`);
      
      return result.data;
    } catch (error) {
      const duration = performance.now() - startTime;
      console.log(`⚡ uploadFileToProject execution time: ${duration.toFixed(1)}ms`);
      console.error(`Failed to upload ${file.name}:`, error);
      throw error;
    }
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:image/png;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
    });
  }

  async deleteProjectFile(projectId: string, fileId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteProjectFile', [projectId, fileId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete file');
    }
    return response.data;
  }

  // Drive Folder Management Methods
  async createMasterFolder(folderName: string, token: string): Promise<DriveFolder> {
    const response = await this.executeGoogleScript<DriveFolder>(token, 'createMasterFolder', [folderName]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create master folder');
    }
    return response.data;
  }

  async getDriveStructure(token: string): Promise<DriveStructure> {
    const response = await this.executeGoogleScript<DriveStructure>(token, 'getDriveStructure', [], 'GET');
    return response.data || { areas: {}, projects: {} };
  }

  async createAreaFolder(areaId: string, areaName: string, masterFolderId: string | undefined, token: string): Promise<DriveFolder> {
    const response = await this.executeGoogleScript<DriveFolder>(token, 'createAreaFolder', [areaId, areaName, masterFolderId]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create area folder');
    }
    return response.data;
  }

  async createProjectFolder(projectId: string, projectName: string, areaFolderId: string | undefined, token: string): Promise<DriveFolder> {
    const response = await this.executeGoogleScript<DriveFolder>(token, 'createProjectFolder', [projectId, projectName, areaFolderId]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project folder');
    }
    return response.data;
  }

  async uploadFileToFolder(folderId: string, file: File, token: string): Promise<ProjectFile> {
    // Convert File to base64 for Google Apps Script
    const fileContent = await this.fileToBase64(file);
    const response = await this.executeGoogleScript<ProjectFile>(token, 'uploadFileToFolder', [
      folderId, 
      file.name, 
      fileContent, 
      file.type
    ]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to upload file to folder');
    }
    return response.data;
  }

  async getFolderFiles(folderId: string, token: string): Promise<ProjectFile[]> {
    const response = await this.executeGoogleScript<ProjectFile[]>(token, 'getFolderFiles', [folderId], 'GET');
    return response.data || [];
  }

  async setMasterFolder(folderId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'setMasterFolder', [folderId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to set master folder');
    }
    return response.data;
  }

  // Enhanced Google Drive Browser Methods
  async listDriveFiles(folderId: string = 'root', token: string, options: {
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
  } = {}): Promise<any> {
    const startTime = performance.now();
    
    try {
      // Try Edge Functions first for much faster performance
      if (this.useEdgeFunctions) {
        console.log(`🔑 Calling enhanced Drive API for folder: ${folderId}`);
        
        const params = new URLSearchParams({
          folderId,
          ...(options.pageSize && { pageSize: options.pageSize.toString() }),
          ...(options.pageToken && { pageToken: options.pageToken }),
          ...(options.orderBy && { orderBy: options.orderBy })
        });
        
        const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/drive/files?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Enhanced Drive API: ${duration.toFixed(1)}ms for ${result.data?.files?.length || 0} files`);
          return result.data || { files: [] };
        }

        // Log the error details
        const errorText = await response.text();
        console.error(`Enhanced Drive API failed: ${response.status} ${response.statusText}`, errorText);

        // If Edge Function fails and fallback is enabled
        if (this.enableFallback) {
          console.warn('Enhanced Drive API failed, falling back to legacy');
          return { files: await this.listDriveFilesLegacy(folderId, token) };
        }

        throw new Error(`Enhanced Drive API failed: ${response.status}`);
      }

      // Use legacy Apps Script
      return { files: await this.listDriveFilesLegacy(folderId, token) };

    } catch (error) {
      console.error('List drive files failed:', error);
      
      // Fallback to legacy if enabled
      if (this.useEdgeFunctions && this.enableFallback) {
        console.warn('Falling back to legacy due to error');
        return { files: await this.listDriveFilesLegacy(folderId, token) };
      }
      
      throw error;
    }
  }

  async searchDriveFiles(query: string, token: string, options: {
    type?: string;
    mimeType?: string;
    limit?: number;
  } = {}): Promise<any> {
    const startTime = performance.now();
    
    try {
      if (this.useEdgeFunctions) {
        console.log(`🔍 Enhanced Drive search: "${query}"`);
        
        const params = new URLSearchParams({
          search: query,
          ...(options.type && { type: options.type }),
          ...(options.mimeType && { mimeType: options.mimeType }),
          ...(options.limit && { limit: options.limit.toString() })
        });
        
        const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/drive/files?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Enhanced Drive search: ${duration.toFixed(1)}ms for ${result.data?.files?.length || 0} results`);
          return result.data?.files || [];
        }

        console.error(`Enhanced Drive search failed: ${response.status}`);
        if (this.enableFallback) {
          return await this.searchDriveFilesLegacy(query, token);
        }
        throw new Error(`Search failed: ${response.status}`);
      }

      return await this.searchDriveFilesLegacy(query, token);
    } catch (error) {
      console.error('Search drive files failed:', error);
      if (this.useEdgeFunctions && this.enableFallback) {
        return await this.searchDriveFilesLegacy(query, token);
      }
      throw error;
    }
  }

  async getRecentFiles(token: string, days: number = 7, limit: number = 50): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      if (this.useEdgeFunctions) {
        console.log(`📅 Getting recent files (${days} days, limit ${limit})`);
        
        const params = new URLSearchParams({
          scope: 'recent',
          days: days.toString(),
          limit: limit.toString()
        });
        
        const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/drive/files?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Recent files: ${duration.toFixed(1)}ms for ${result.data?.files?.length || 0} files`);
          return result.data?.files || [];
        }

        console.error(`Recent files failed: ${response.status}`);
      }

      // Fallback: return empty array if no enhanced API
      return [];
    } catch (error) {
      console.error('Get recent files failed:', error);
      return [];
    }
  }

  async getSharedFiles(token: string): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      if (this.useEdgeFunctions) {
        console.log(`🤝 Getting shared files`);
        
        const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/drive/files?scope=shared`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ Shared files: ${duration.toFixed(1)}ms for ${result.data?.files?.length || 0} files`);
          return result.data?.files || [];
        }

        console.error(`Shared files failed: ${response.status}`);
      }

      // Fallback: return empty array if no enhanced API
      return [];
    } catch (error) {
      console.error('Get shared files failed:', error);
      return [];
    }
  }

  async getFilePath(fileId: string, token: string): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      if (this.useEdgeFunctions) {
        console.log(`🛤️ Getting path for file: ${fileId}`);
        
        const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/drive/files?pathFor=${fileId}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const result = await response.json();
          const duration = performance.now() - startTime;
          console.log(`⚡ File path: ${duration.toFixed(1)}ms`);
          return result.data?.path || [];
        }

        console.error(`File path failed: ${response.status}`);
        if (this.enableFallback) {
          return await this.getFilePathLegacy(fileId, token);
        }
        throw new Error(`Path resolution failed: ${response.status}`);
      }

      return await this.getFilePathLegacy(fileId, token);
    } catch (error) {
      console.error('Get file path failed:', error);
      if (this.useEdgeFunctions && this.enableFallback) {
        return await this.getFilePathLegacy(fileId, token);
      }
      throw error;
    }
  }

  // Legacy fallback methods
  private async listDriveFilesLegacy(folderId: string, token: string): Promise<any[]> {
    const startTime = performance.now();
    const response = await this.executeGoogleScript<any[]>(token, 'listDriveFiles', [folderId], 'GET');
    const duration = performance.now() - startTime;
    console.log(`🔄 Legacy listDriveFiles: ${duration.toFixed(1)}ms`);
    return response.data || [];
  }

  private async searchDriveFilesLegacy(query: string, token: string): Promise<any[]> {
    const response = await this.executeGoogleScript<any[]>(token, 'searchDriveFiles', [query], 'GET');
    return response.data || [];
  }

  private async getFilePathLegacy(fileId: string, token: string): Promise<any[]> {
    const response = await this.executeGoogleScript<any[]>(token, 'getFilePath', [fileId], 'GET');
    return response.data || [];
  }

  async getProjectFolderId(projectId: string, token: string): Promise<string | null> {
    const response = await this.executeGoogleScript<string>(token, 'getProjectFolderId', [projectId], 'GET');
    return response.success ? response.data || null : null;
  }

  async createGoogleDoc(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'createGoogleDoc', [projectId, fileName, parentFolderId]);
    return response.data;
  }

  async createGoogleSheet(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'createGoogleSheet', [projectId, fileName, parentFolderId]);
    return response.data;
  }

  async getServiceAccountEmail(token: string): Promise<{ email: string; message: string }> {
    try {
      const response = await fetch('/api/settings/master-folder', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get service account email');
      }
      
      return {
        email: data.data.serviceAccountEmail,
        message: data.data.message
      };
    } catch (error) {
      console.error('Failed to get service account email:', error);
      return {
        email: 'nowandlater@solid-study-467023-i3.iam.gserviceaccount.com',
        message: 'Share your master Drive folder with this email to enable full functionality'
      };
    }
  }

  async getMasterFolderId(token: string): Promise<{ folderId: string }> {
    try {
      const response = await fetch('/api/settings/master-folder', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to get master folder ID');
      }
      
      return { folderId: data.data.currentMasterFolderId || '' };
    } catch (error) {
      console.error('Failed to get master folder ID:', error);
      return { folderId: '' };
    }
  }

  async setMasterFolderId(folderId: string, token: string): Promise<{ folderId: string; message: string }> {
    try {
      const response = await fetch('/api/settings/master-folder', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ folderId }),
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to set master folder ID');
      }
      
      return {
        folderId: data.data.folderId,
        message: data.data.message
      };
    } catch (error) {
      console.error('Failed to set master folder ID:', error);
      throw error;
    }
  }

  async shareFolderWithServiceAccount(folderId: string, token: string): Promise<{ message: string; folderId: string; folderName: string; serviceAccountEmail?: string }> {
    // This functionality would need to be implemented in Vercel API
    // For now, return a helpful message
    return {
      message: 'Folder sharing functionality is being migrated to the new backend. Please manually share your folder with: nowandlater@solid-study-467023-i3.iam.gserviceaccount.com',
      folderId,
      folderName: 'Unknown',
      serviceAccountEmail: 'nowandlater@solid-study-467023-i3.iam.gserviceaccount.com'
    };
  }

  // Gmail Integration Methods
  async searchGmailMessages(token: string, options: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    includeSpamTrash?: boolean;
    dateRange?: number; // days
  } = {}): Promise<any[]> {
    const startTime = performance.now();
    
    try {
      const params = new URLSearchParams();
      if (options.query) params.append('query', options.query);
      if (options.maxResults) params.append('maxResults', options.maxResults.toString());
      if (options.labelIds) options.labelIds.forEach(label => params.append('labelIds', label));
      if (options.includeSpamTrash) params.append('includeSpamTrash', options.includeSpamTrash.toString());
      if (options.dateRange) params.append('dateRange', options.dateRange.toString());

      console.log(`📧 Searching Gmail messages with query: "${options.query || 'all'}"`);
      
      const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/gmail/messages?${params}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Gmail search failed: ${response.status}`);
      }

      const result = await response.json();
      const duration = performance.now() - startTime;
      console.log(`⚡ Gmail search completed: ${duration.toFixed(1)}ms for ${result.data?.messages?.length || 0} messages`);
      
      return result.data?.messages || [];
    } catch (error) {
      console.error('Gmail search failed:', error);
      throw error;
    }
  }

  async convertEmailToTask(token: string, messageId: string, options: {
    projectId?: string;
    context?: string;
    customTitle?: string;
    customDescription?: string;
  } = {}): Promise<any> {
    const startTime = performance.now();
    
    try {
      console.log(`🔄 Converting Gmail message ${messageId} to task`);
      
      const response = await fetch(`${this.EDGE_FUNCTIONS_URL}/gmail/messages?action=convert-to-task`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messageId,
          ...options
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Email conversion failed: ${response.status}`);
      }

      const result = await response.json();
      const duration = performance.now() - startTime;
      console.log(`⚡ Email to task conversion completed: ${duration.toFixed(1)}ms`);
      
      // Invalidate tasks cache since we created a new task
      await this.invalidateTasksCache(token);
      
      return result.data;
    } catch (error) {
      console.error('Email to task conversion failed:', error);
      throw error;
    }
  }

  async fixMissingDriveFolders(token: string): Promise<{ message: string; fixed: number; total: number }> {
    try {
      const response = await fetch('/api/projects/manage?action=fix-drive-folders', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fix drive folders');
      }
      
      return {
        message: data.message,
        fixed: data.fixed,
        total: data.total
      };
    } catch (error) {
      console.error('Failed to fix drive folders:', error);
      throw error;
    }
  }
}

export const apiService = new ApiService();