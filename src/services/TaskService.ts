import type { Task, TaskAttachment, GoogleScriptResponse } from '../types';

export class TaskService {
  private readonly EDGE_FUNCTIONS_URL = import.meta.env.PROD 
    ? 'https://nowandlater.vercel.app/api'
    : 'http://localhost:3000/api';
  
  private useEdgeFunctions = import.meta.env.VITE_USE_EDGE_FUNCTIONS === 'true' || false;
  private enableFallback = true;

  // Dependencies - these need to be injected
  private fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>;
  private executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>;

  constructor(
    fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>,
    executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>
  ) {
    this.fetchWithAuth = fetchWithAuth;
    this.executeGoogleScript = executeGoogleScript;
    console.log('📝 TaskService initialized');
  }

  // Get tasks for a specific project or view
  async getTasks(projectId: string | undefined, view: string | undefined, token: string): Promise<Task[]> {
    const response = await this.executeGoogleScript<Task[]>(token, 'getTasks', [projectId, view]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to get tasks');
    }
    return response.data;
  }

  // Create a new task
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

  // Legacy task creation using Google Apps Script
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

  // Update an existing task
  async updateTask(taskId: string, title: string, description: string, projectId: string | undefined, context: string | undefined, dueDate: string | undefined, token: string): Promise<Task> {
    const response = await this.executeGoogleScript<Task>(token, 'updateTask', [taskId, title, description, projectId, context, dueDate]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to update task');
    }
    
    // Invalidate Edge Functions cache to ensure fresh data on next load
    await this.invalidateTasksCache(token);
    return response.data;
  }

  // Update task completion status
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
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            taskId,
            isCompleted
          })
        }, 'updateTaskCompletion');

        if (response.ok) {
          console.log(`✅ Task completion updated via Edge Function: ${taskId} -> ${isCompleted}`);
          return;
        }

        // If Edge Function fails and fallback is enabled
        if (this.enableFallback) {
          console.warn('Edge Function failed, falling back to Apps Script for task completion');
          const scriptResponse = await this.executeGoogleScript<void>(token, 'updateTaskCompletion', [taskId, isCompleted]);
          if (!scriptResponse.success) {
            throw new Error(scriptResponse.message || 'Failed to update task completion');
          }
          
          // Invalidate cache after successful update
          await this.invalidateTasksCache(token);
          return;
        }

        throw new Error(`Edge Function failed: ${response.status}`);
      } catch (error) {
        console.error('Task completion update failed:', error);
        
        // Fallback to legacy if enabled
        if (this.enableFallback) {
          console.warn('Falling back to Apps Script due to error');
          const scriptResponse = await this.executeGoogleScript<void>(token, 'updateTaskCompletion', [taskId, isCompleted]);
          if (!scriptResponse.success) {
            throw new Error(scriptResponse.message || 'Failed to update task completion');
          }
          
          // Invalidate cache after successful update
          await this.invalidateTasksCache(token);
          return;
        }
        
        throw error;
      }
    } else {
      // Use Google Apps Script directly
      const response = await this.executeGoogleScript<void>(token, 'updateTaskCompletion', [taskId, isCompleted]);
      if (!response.success) {
        throw new Error(response.message || 'Failed to update task completion');
      }
      
      // Invalidate cache after successful update
      await this.invalidateTasksCache(token);
    }
  }

  // Delete a task
  async deleteTask(taskId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteTask', [taskId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete task');
    }
    
    // Invalidate Edge Functions cache to ensure fresh data on next load
    await this.invalidateTasksCache(token);
  }

  // Reorder tasks
  async reorderTasks(taskIds: string[], token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'reorderTasks', [taskIds]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to reorder tasks');
    }
    
    // Invalidate Edge Functions cache to ensure fresh data on next load  
    await this.invalidateTasksCache(token);
  }

  // Get AI suggestions for tasks
  async getAISuggestions(projectName: string, tasks: Task[]): Promise<string> {
    // This is a placeholder - would integrate with AI service
    return `Based on the project "${projectName}" and ${tasks.length} existing tasks, consider: 1) Review progress on current tasks, 2) Identify any blockers, 3) Plan next steps`;
  }

  // Process Gmail messages to create tasks
  async processGmailToTasks(token: string): Promise<Task[]> {
    const response = await this.executeGoogleScript<Task[]>(token, 'processGmailToTasks', []);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to process Gmail to tasks');
    }
    return response.data;
  }

  // Sync tasks with calendar
  async syncTasksWithCalendar(token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'syncTasksWithCalendar', []);
    if (!response.success) {
      throw new Error(response.message || 'Failed to sync tasks with calendar');
    }
    return response.data;
  }

  // Create task with integrations (Gmail, Calendar, etc.)
  async createTaskWithIntegrations(
    title: string,
    description: string,
    projectId: string | undefined,
    context: string | undefined,
    dueDate: string | undefined,
    attachments: TaskAttachment[] | undefined,
    integrations: {
      gmailMessageId?: string;
      calendarEventId?: string;
      driveFileId?: string;
    },
    token: string
  ): Promise<Task> {
    const response = await this.executeGoogleScript<Task>(token, 'createTaskWithIntegrations', [
      title,
      description,
      projectId,
      context,
      dueDate,
      attachments,
      integrations
    ]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create task with integrations');
    }
    return response.data;
  }

  // Convert email to task
  async convertEmailToTask(token: string, messageId: string, options: {
    projectId?: string;
    context?: string;
    customTitle?: string;
    customDescription?: string;
  }): Promise<Task> {
    try {
      const response = await this.fetchWithAuth('/api/gmail/messages?action=convert-to-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messageId,
          ...options
        })
      }, 'convertEmailToTask');

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to convert email to task');
      }

      const result = await response.json();
      
      // Invalidate cache after successful creation
      await this.invalidateTasksCache(token);
      
      return result.data.task;
    } catch (error) {
      console.error('Email to task conversion failed:', error);
      throw error;
    }
  }

  // Invalidate tasks cache (private utility method)
  private async invalidateTasksCache(token: string): Promise<void> {
    if (this.useEdgeFunctions) {
      try {
        await this.fetchWithAuth('/api/cache/invalidate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ cacheKeys: ['tasks'] })
        }, 'invalidateTasksCache');
      } catch (error) {
        console.warn('Failed to invalidate tasks cache:', error);
        // Don't throw error for cache invalidation failures
      }
    }
  }
}

// We'll export a factory function instead of a singleton since TaskService needs dependencies
export const createTaskService = (
  fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>,
  executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>
) => {
  return new TaskService(fetchWithAuth, executeGoogleScript);
};