import type { Area, Project, Task, GoogleScriptResponse, Contact, TaskWithIntegrations, Document, ProjectFile, TaskAttachment, DriveFolder, DriveStructure } from '../types';
import { authService } from './AuthService';
import { createTaskService } from './TaskService';
import { createProjectService } from './ProjectService';
import { createDriveService } from './DriveService';

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
  private taskService: ReturnType<typeof createTaskService>;
  private projectService: ReturnType<typeof createProjectService>;
  private driveService: ReturnType<typeof createDriveService>;

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
    
    // Initialize TaskService with required dependencies
    this.taskService = createTaskService(
      this.fetchWithAuth.bind(this),
      this.executeGoogleScript.bind(this)
    );
    
    // Initialize ProjectService with required dependencies
    this.projectService = createProjectService(
      this.fetchWithAuth.bind(this),
      this.executeGoogleScript.bind(this),
      this.EDGE_FUNCTIONS_URL,
      this.useEdgeFunctions,
      this.enableFallback
    );
    
    // Initialize DriveService with required dependencies
    this.driveService = createDriveService(
      this.fetchWithAuth.bind(this),
      this.executeGoogleScript.bind(this),
      this.EDGE_FUNCTIONS_URL,
      this.useEdgeFunctions,
      this.enableFallback
    );
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

  

  // API Methods - delegated to ProjectService
  async getAreas(token: string): Promise<Area[]> {
    return await this.projectService.getAreas(token);
  }

  async createArea(name: string, description: string, token: string): Promise<Area> {
    return await this.projectService.createArea(name, description, token);
  }

  async getProjects(areaId: string | undefined, token: string): Promise<Project[]> {
    return await this.projectService.getProjects(areaId, token);
  }

  async getTasks(projectId: string | undefined, view: string | undefined, token: string): Promise<Task[]> {
    return await this.taskService.getTasks(projectId, view, token);
  }

  async loadAppData(token: string): Promise<{areas: Area[], projects: Project[], tasks: Task[]}> {
    return await this.projectService.loadAppData(token);
  }

  // Removed - delegated to ProjectService

  // Cache invalidation method to ensure data consistency between legacy and Edge Functions

  async createProject(name: string, description: string, areaId: string | undefined, token: string): Promise<Project> {
    return await this.projectService.createProject(name, description, areaId, token);
  }

  async createTask(title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, attachments: TaskAttachment[] | undefined, token: string): Promise<Task> {
    return await this.taskService.createTask(title, description, projectId, context, dueDate, attachments, token);
  }


  async updateTask(taskId: string, title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, token: string): Promise<Task> {
    return await this.taskService.updateTask(taskId, title, description, projectId, context, dueDate, token);
  }

  async updateTaskCompletion(taskId: string, isCompleted: boolean, token: string): Promise<void> {
    return await this.taskService.updateTaskCompletion(taskId, isCompleted, token);
  }

  async deleteTask(taskId: string, token: string): Promise<void> {
    return await this.taskService.deleteTask(taskId, token);
  }

  async deleteProject(projectId: string, token: string): Promise<void> {
    return await this.projectService.deleteProject(projectId, token);
  }


  async deleteArea(areaId: string, token: string): Promise<void> {
    return await this.projectService.deleteArea(areaId, token);
  }

  async updateProjectStatus(projectId: string, status: Project['status'], token: string): Promise<void> {
    return await this.projectService.updateProjectStatus(projectId, status, token);
  }

  async updateProjectArea(projectId: string, areaId: string, token: string): Promise<void> {
    return await this.projectService.updateProjectArea(projectId, areaId, token);
  }

  async updateProjectName(projectId: string, newName: string, token: string): Promise<Project> {
    return await this.projectService.updateProjectName(projectId, newName, token);
  }

  async reorderTasks(taskIds: string[], token: string): Promise<void> {
    return await this.taskService.reorderTasks(taskIds, token);
  }

  async getAISuggestions(projectName: string, tasks: Task[]): Promise<string> {
    return await this.taskService.getAISuggestions(projectName, tasks);
  }

  // Google Integrations
  async processGmailToTasks(token: string): Promise<Task[]> {
    return await this.taskService.processGmailToTasks(token);
  }

  async syncTasksWithCalendar(token: string): Promise<any> {
    return await this.taskService.syncTasksWithCalendar(token);
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
    // Need to update TaskService to match this signature - for now delegate with adaptation
    return await this.taskService.createTaskWithIntegrations(
      title, description, projectId, context, dueDate, undefined,
      { calendarEventId: createCalendarEvent ? 'create' : undefined }, token
    ) as TaskWithIntegrations;
  }

  async createProjectDocument(projectId: string, projectName: string, templateType: 'project-notes' | 'meeting-notes' | 'project-plan', token: string): Promise<Document> {
    return await this.projectService.createProjectDocument(projectId, projectName, templateType, token);
  }

  async getContacts(token: string): Promise<Contact[]> {
    return await this.driveService.getContacts(token);
  }

  async setupGoogleTriggers(token: string): Promise<void> {
    return await this.driveService.setupGoogleTriggers(token);
  }

  async testGoogleIntegrations(token: string): Promise<any> {
    return await this.driveService.testGoogleIntegrations(token);
  }

  // File Management Methods - delegated to ProjectService
  async getProjectFiles(projectId: string, token: string, driveFolderId?: string): Promise<ProjectFile[]> {
    return await this.projectService.getProjectFiles(projectId, token, driveFolderId);
  }

  // Removed - delegated to ProjectService

  async uploadFileToProject(projectId: string, file: File, token: string): Promise<ProjectFile> {
    return await this.projectService.uploadFileToProject(projectId, file, token);
  }

  // Removed - delegated to ProjectService

  async deleteProjectFile(projectId: string, fileId: string, token: string): Promise<void> {
    return await this.projectService.deleteProjectFile(projectId, fileId, token);
  }

  // Drive Folder Management Methods - delegated to ProjectService
  async createMasterFolder(folderName: string, token: string): Promise<DriveFolder> {
    return await this.projectService.createMasterFolder(folderName, token);
  }

  async getDriveStructure(token: string): Promise<DriveStructure> {
    return await this.projectService.getDriveStructure(token);
  }

  async createAreaFolder(areaId: string, areaName: string, masterFolderId: string | undefined, token: string): Promise<DriveFolder> {
    return await this.projectService.createAreaFolder(areaId, areaName, masterFolderId, token);
  }

  async createProjectFolder(projectId: string, projectName: string, areaFolderId: string | undefined, token: string): Promise<DriveFolder> {
    return await this.projectService.createProjectFolder(projectId, projectName, areaFolderId, token);
  }

  async uploadFileToFolder(folderId: string, file: File, token: string): Promise<ProjectFile> {
    return await this.projectService.uploadFileToFolder(folderId, file, token);
  }

  async getFolderFiles(folderId: string, token: string): Promise<ProjectFile[]> {
    return await this.projectService.getFolderFiles(folderId, token);
  }

  async setMasterFolder(folderId: string, token: string): Promise<void> {
    return await this.projectService.setMasterFolder(folderId, token);
  }

  // Enhanced Google Drive Browser Methods - delegated to DriveService
  async listDriveFiles(folderId: string = 'root', token: string, options: {
    pageSize?: number;
    pageToken?: string;
    orderBy?: string;
  } = {}): Promise<any> {
    return await this.driveService.listDriveFiles(folderId, token, options);
  }

  async searchDriveFiles(query: string, token: string, options: {
    type?: string;
    mimeType?: string;
    limit?: number;
  } = {}): Promise<any> {
    return await this.driveService.searchDriveFiles(query, token, options);
  }

  async getRecentFiles(token: string, days: number = 7, limit: number = 50): Promise<any[]> {
    return await this.driveService.getRecentFiles(token, days, limit);
  }

  async getSharedFiles(token: string): Promise<any[]> {
    return await this.driveService.getSharedFiles(token);
  }

  async getFilePath(fileId: string, token: string): Promise<any[]> {
    return await this.driveService.getFilePath(fileId, token);
  }

  // Legacy fallback methods - removed, now handled by DriveService

  async getProjectFolderId(projectId: string, token: string): Promise<string | null> {
    return await this.projectService.getProjectFolderId(projectId, token);
  }

  async createGoogleDoc(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
    return await this.projectService.createGoogleDoc(projectId, fileName, parentFolderId, token);
  }

  async createGoogleSheet(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
    return await this.projectService.createGoogleSheet(projectId, fileName, parentFolderId, token);
  }

  async getServiceAccountEmail(token: string): Promise<{ email: string; message: string }> {
    return await this.projectService.getServiceAccountEmail(token);
  }

  async getMasterFolderId(token: string): Promise<{ folderId: string }> {
    return await this.projectService.getMasterFolderId(token);
  }

  async setMasterFolderId(folderId: string, token: string): Promise<{ folderId: string; message: string }> {
    return await this.projectService.setMasterFolderId(folderId, token);
  }

  async shareFolderWithServiceAccount(folderId: string, token: string): Promise<{ message: string; folderId: string; folderName: string; serviceAccountEmail?: string }> {
    return await this.projectService.shareFolderWithServiceAccount(folderId, token);
  }

  // Gmail Integration Methods - delegated to DriveService
  async searchGmailMessages(token: string, options: {
    query?: string;
    maxResults?: number;
    labelIds?: string[];
    includeSpamTrash?: boolean;
    dateRange?: number; // days
  } = {}): Promise<any[]> {
    return await this.driveService.searchGmailMessages(token, options);
  }

  async convertEmailToTask(token: string, messageId: string, options: {
    projectId?: string;
    context?: string;
    customTitle?: string;
    customDescription?: string;
  } = {}): Promise<any> {
    return await this.taskService.convertEmailToTask(token, messageId, options);
  }

  async fixMissingDriveFolders(token: string): Promise<{ message: string; fixed: number; total: number }> {
    return await this.projectService.fixMissingDriveFolders(token);
  }
}

export const apiService = new ApiService();