import type { Area, Project, ProjectFile, Document, DriveFolder, DriveStructure, GoogleScriptResponse } from '../types/index';

export class ProjectService {
  private readonly EDGE_FUNCTIONS_URL: string;
  private readonly useEdgeFunctions: boolean;
  private readonly enableFallback: boolean;

  // Dependencies - these need to be injected
  private fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>;
  private executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>;

  constructor(
    fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>,
    executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>,
    EDGE_FUNCTIONS_URL: string,
    useEdgeFunctions: boolean,
    enableFallback: boolean
  ) {
    this.fetchWithAuth = fetchWithAuth;
    this.executeGoogleScript = executeGoogleScript;
    this.EDGE_FUNCTIONS_URL = EDGE_FUNCTIONS_URL;
    this.useEdgeFunctions = useEdgeFunctions;
    this.enableFallback = enableFallback;
    console.log('🏗️ ProjectService initialized');
  }

  // ==== AREA MANAGEMENT METHODS ====

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

  async deleteArea(areaId: string, token: string): Promise<void> {
    const response = await this.executeGoogleScript<void>(token, 'deleteArea', [areaId]);
    if (!response.success) {
      throw new Error(response.message || 'Failed to delete area');
    }
  }

  // ==== PROJECT CRUD METHODS ====

  async getProjects(areaId: string | undefined, token: string): Promise<Project[]> {
    const response = await this.executeGoogleScript<Project[]>(token, 'getProjects', [areaId], 'GET');
    return response.data || [];
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

  // ==== PROJECT FILE MANAGEMENT METHODS ====

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

  // ==== DRIVE FOLDER MANAGEMENT METHODS ====

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

  async getProjectFolderId(projectId: string, token: string): Promise<string | null> {
    const response = await this.executeGoogleScript<string>(token, 'getProjectFolderId', [projectId], 'GET');
    return response.success ? response.data || null : null;
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

  // ==== PROJECT DOCUMENT CREATION METHODS ====

  async createProjectDocument(projectId: string, projectName: string, templateType: 'project-notes' | 'meeting-notes' | 'project-plan', token: string): Promise<Document> {
    const response = await this.executeGoogleScript<Document>(token, 'createProjectDocument', [projectId, projectName, templateType]);
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to create project document');
    }
    return response.data;
  }

  async createGoogleDoc(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'createGoogleDoc', [projectId, fileName, parentFolderId]);
    return response.data;
  }

  async createGoogleSheet(projectId: string, fileName: string, parentFolderId: string | null, token: string): Promise<any> {
    const response = await this.executeGoogleScript<any>(token, 'createGoogleSheet', [projectId, fileName, parentFolderId]);
    return response.data;
  }

  // ==== UTILITY METHODS ====

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

  async loadAppData(token: string): Promise<{areas: Area[], projects: Project[], tasks: any[]}> {
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

  private async loadAppDataLegacy(token: string): Promise<{areas: Area[], projects: Project[], tasks: any[]}> {
    const startTime = performance.now();
    const response = await this.executeGoogleScript<{areas: Area[], projects: Project[], tasks: any[]}>(token, 'loadAppData', [], 'GET');
    if (!response.success || !response.data) {
      throw new Error(response.message || 'Failed to load app data');
    }
    const duration = performance.now() - startTime;
    console.log(`🔄 Legacy loadAppData: ${duration.toFixed(1)}ms`);
    return response.data;
  }
}

// Factory function for dependency injection
export const createProjectService = (
  fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>,
  executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>,
  EDGE_FUNCTIONS_URL: string,
  useEdgeFunctions: boolean,
  enableFallback: boolean
) => {
  return new ProjectService(
    fetchWithAuth,
    executeGoogleScript,
    EDGE_FUNCTIONS_URL,
    useEdgeFunctions,
    enableFallback
  );
};