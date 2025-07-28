import type { Area, Project, Task, GoogleScriptResponse, Contact, TaskWithIntegrations, Document, ProjectFile, TaskAttachment, DriveFolder, DriveStructure } from '../types';

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
  private readonly APPS_SCRIPT_URL = import.meta.env.VITE_APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbwBRoV5gi3NVDpXuNtx_8qtaDq659CPMWMlpsCKgQrSRcIH5qynHiEI5vy1pteX4Mhq/exec';
  private isGoogleAppsScript = true; // Enable Google Apps Script backend
  private backendHealthy = true; // Track backend health status

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

  getBackendStatus(): {isEnabled: boolean, isHealthy: boolean, usingMockData: boolean} {
    return {
      isEnabled: this.isGoogleAppsScript,
      isHealthy: this.backendHealthy,
      usingMockData: !this.isGoogleAppsScript || !this.backendHealthy
    };
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
    const response = await this.executeGoogleScript<{areas: Area[], projects: Project[], tasks: Task[]}>(token, 'loadAppData', [], 'GET');
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to load app data');
    }
    return response.data;
  }

  async createProject(name: string, description: string, areaId: string | undefined, token: string): Promise<Project> {
    const response = await this.executeGoogleScript<Project>(token, 'createProject', [name, description, areaId]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project');
    }
    return response.data;
  }

  async createTask(title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, attachments: TaskAttachment[] | undefined, token: string): Promise<Task> {
    const response = await this.executeGoogleScript<Task>(token, 'createTask', [title, description, projectId, context, dueDate, attachments]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task');
    }
    return response.data;
  }

  async updateTask(taskId: string, title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, token: string): Promise<Task> {
    const response = await this.executeGoogleScript<Task>(token, 'updateTask', [taskId, title, description, projectId, context, dueDate]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task');
    }
    return response.data;
  }

  async updateTaskCompletion(taskId: string, isCompleted: boolean, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'updateTaskCompletion', [taskId, isCompleted]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update task');
    }
  }

  async deleteTask(taskId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteTask', [taskId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete task');
    }
  }

  async deleteProject(projectId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteProject', [projectId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete project');
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
    const response = await this.executeGoogleScript<Project>(token, 'updateProjectName', [projectId, newName]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update project name');
    }
    return response.data;
  }

  async reorderTasks(taskIds: string[], token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'reorderTasks', [taskIds]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to reorder tasks');
    }
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
  async getProjectFiles(projectId: string, token: string): Promise<ProjectFile[]> {
    const response = await this.executeGoogleScript<ProjectFile[]>(token, 'getProjectFiles', [projectId], 'GET');
    return response.data || [];
  }

  async uploadFileToProject(projectId: string, file: File, token: string): Promise<ProjectFile> {
    // Convert File to base64 for Google Apps Script
    const fileContent = await this.fileToBase64(file);
    const response = await this.executeGoogleScript<ProjectFile>(token, 'uploadFileToProject', [
      projectId, 
      file.name, 
      fileContent, 
      file.type
    ]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to upload file');
    }
    return response.data;
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

  // Google Drive Browser Methods
  async listDriveFiles(folderId: string = 'root', token: string): Promise<any[]> {
    const response = await this.executeGoogleScript<any[]>(token, 'listDriveFiles', [folderId], 'GET');
    return response.data || [];
  }

  async searchDriveFiles(query: string, token: string): Promise<any[]> {
    const response = await this.executeGoogleScript<any[]>(token, 'searchDriveFiles', [query], 'GET');
    return response.data || [];
  }

  async getFilePath(fileId: string, token: string): Promise<any[]> {
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
}

export const apiService = new ApiService();