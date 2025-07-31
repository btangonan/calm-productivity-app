import type { Contact, GoogleScriptResponse } from '../types/index';

export class DriveService {
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
    console.log('💿 DriveService initialized');
  }

  // ==== ENHANCED GOOGLE DRIVE BROWSER METHODS ====

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

  // ==== LEGACY FALLBACK METHODS ====

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

  // ==== GMAIL INTEGRATION METHODS ====

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

  // ==== GOOGLE INTEGRATIONS & CONTACTS ====

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
}

// Factory function for dependency injection
export const createDriveService = (
  fetchWithAuth: (url: string, options?: RequestInit, context?: string, token?: string, isRetry?: boolean) => Promise<Response>,
  executeGoogleScript: <T>(token: string, functionName: string, args?: any[], httpMethod?: 'GET' | 'POST') => Promise<GoogleScriptResponse<T>>,
  EDGE_FUNCTIONS_URL: string,
  useEdgeFunctions: boolean,
  enableFallback: boolean
) => {
  return new DriveService(
    fetchWithAuth,
    executeGoogleScript,
    EDGE_FUNCTIONS_URL,
    useEdgeFunctions,
    enableFallback
  );
};