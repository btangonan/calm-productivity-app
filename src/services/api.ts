import type { Area, Project, Task, GoogleScriptResponse, Contact, TaskWithIntegrations, Document } from '../types';

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
  private readonly APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzePtrrW95Ht91fVZycizbrMtH83WHmu1kZVonWUxFkEq3iy5HFIe8sYZ2as2p4_Q0n/exec';
  private isGoogleAppsScript = true; // Enable Apps Script integration

  // Mock data for development
  private mockAreas: Area[] = [
    { id: '1', name: 'Personal', description: 'Personal tasks and projects', createdAt: new Date().toISOString() },
    { id: '2', name: 'Work', description: 'Work-related items', createdAt: new Date().toISOString() }
  ];

  private mockProjects: Project[] = [
    {
      id: '1',
      name: 'Home Renovation',
      description: 'Kitchen and bathroom updates',
      areaId: '1',
      status: 'Active',
      driveFolderUrl: 'https://drive.google.com/drive/folders/example1',
      createdAt: new Date().toISOString()
    },
    {
      id: '2',
      name: 'Q4 Planning',
      description: 'Strategic planning for Q4',
      areaId: '2',
      status: 'Active',
      driveFolderUrl: 'https://drive.google.com/drive/folders/example2',
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
    }
  ];

  private async executeGoogleScript<T>(functionName: string, ...args: any[]): Promise<GoogleScriptResponse<T>> {
    if (!this.isGoogleAppsScript) {
      // Return mock data for development
      return new Promise((resolve) => {
        setTimeout(() => {
          resolve(this.getMockResponse<T>(functionName, ...args));
        }, 300); // Simulate network delay
      });
    }

    try {
      const formData = new FormData();
      formData.append('function', functionName);
      formData.append('parameters', JSON.stringify(args));

      const response = await fetch(this.APPS_SCRIPT_URL, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result as GoogleScriptResponse<T>;
    } catch (error) {
      console.error('Apps Script request failed:', error);
      throw error;
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
      default:
        return { success: true, data: null as T };
    }
  }

  // API Methods
  async getAreas(): Promise<Area[]> {
    const response = await this.executeGoogleScript<Area[]>('getAreas');
    return response.data || [];
  }

  async createArea(name: string, description: string): Promise<Area> {
    const response = await this.executeGoogleScript<Area>('createArea', name, description);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create area');
    }
    return response.data;
  }

  async getProjects(areaId?: string): Promise<Project[]> {
    const response = await this.executeGoogleScript<Project[]>('getProjects', areaId);
    return response.data || [];
  }

  async getTasks(projectId?: string, view?: string): Promise<Task[]> {
    const response = await this.executeGoogleScript<Task[]>('getTasks', projectId, view);
    return response.data || [];
  }

  async createProject(name: string, description: string, areaId?: string): Promise<Project> {
    const response = await this.executeGoogleScript<Project>('createProject', name, description, areaId);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project');
    }
    return response.data;
  }

  async createTask(title: string, description: string, projectId?: string, context?: string, dueDate?: string): Promise<Task> {
    const response = await this.executeGoogleScript<Task>('createTask', title, description, projectId, context, dueDate);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task');
    }
    return response.data;
  }

  async updateTaskCompletion(taskId: string, isCompleted: boolean): Promise<void> {
    const response = await this.executeGoogleScript<void>('updateTaskCompletion', taskId, isCompleted);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update task');
    }
  }

  async updateProjectStatus(projectId: string, status: Project['status']): Promise<void> {
    const response = await this.executeGoogleScript<void>('updateProjectStatus', projectId, status);
    if (!response.success) {
      throw new Error(response.message || 'Failed to update project');
    }
  }

  async reorderTasks(taskIds: string[]): Promise<void> {
    const response = await this.executeGoogleScript<void>('reorderTasks', taskIds);
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
  async processGmailToTasks(): Promise<Task[]> {
    const response = await this.executeGoogleScript<Task[]>('processGmailToTasks');
    return response.data || [];
  }

  async syncTasksWithCalendar(): Promise<any> {
    const response = await this.executeGoogleScript<any>('syncTasksWithCalendar');
    return response.data || [];
  }

  async createTaskWithIntegrations(
    title: string, 
    description: string, 
    projectId?: string, 
    context?: string, 
    dueDate?: string,
    createCalendarEvent?: boolean
  ): Promise<TaskWithIntegrations> {
    const response = await this.executeGoogleScript<TaskWithIntegrations>(
      'createTaskWithIntegrations', 
      title, 
      description, 
      projectId, 
      context, 
      dueDate,
      createCalendarEvent
    );
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task with integrations');
    }
    return response.data;
  }

  async createProjectDocument(projectId: string, projectName: string, templateType: 'project-notes' | 'meeting-notes' | 'project-plan'): Promise<Document> {
    const response = await this.executeGoogleScript<Document>('createProjectDocument', projectId, projectName, templateType);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project document');
    }
    return response.data;
  }

  async getContacts(): Promise<Contact[]> {
    const response = await this.executeGoogleScript<Contact[]>('getContacts');
    return response.data || [];
  }

  async setupGoogleTriggers(): Promise<void> {
    const response = await this.executeGoogleScript<void>('setupTriggers');
    if (!response.success) {
      throw new Error(response.message || 'Failed to setup triggers');
    }
  }

  async testGoogleIntegrations(): Promise<any> {
    const response = await this.executeGoogleScript<any>('testIntegrations');
    return response.data || {};
  }
}

export const apiService = new ApiService();