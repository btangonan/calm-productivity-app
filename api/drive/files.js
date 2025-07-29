import { validateGoogleToken } from '../utils/google-auth.js';

// In-memory cache for recently accessed folders (5 minute TTL)
const folderCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    
    // Authenticate user
    const authHeader = req.headers.authorization;
    const user = await validateGoogleToken(authHeader);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Parse query parameters
    const {
      folderId = 'root',
      search,
      scope,
      type,
      mimeType,
      days = '30',
      limit = '100',
      pageSize = '100',
      pageToken,
      pathFor,
      orderBy
    } = req.query;

    console.log(`🔍 Enhanced Drive API request:`, {
      folderId: folderId !== 'root' ? folderId : 'root',
      search: search || 'none',
      scope: scope || 'folder',
      pathFor: pathFor || 'none'
    });

    // Validate search query length
    if (search && search.length < 3) {
      return res.status(400).json({
        success: false,
        error: 'Search query must be at least 3 characters'
      });
    }

    // Set up Google Drive API with user authentication
    const { google } = await import('googleapis');
    let authClient;
    
    if (user.accessToken && !user.isJWT) {
      // User has a real access token - create OAuth2 client directly
      const { OAuth2Client } = await import('google-auth-library');
      authClient = new OAuth2Client(
        process.env.VITE_GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      authClient.setCredentials({ access_token: user.accessToken });
      console.log('🔑 Using user OAuth token for Drive API');
    } else {
      // Use service account for API calls (fallback)
      const { GoogleAuth } = await import('google-auth-library');
      const auth = new GoogleAuth({
        credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
        scopes: ['https://www.googleapis.com/auth/drive.readonly'],
      });
      authClient = await auth.getClient();
      console.log('🔑 Using service account for Drive API');
    }

    const drive = google.drive({ version: 'v3', auth: authClient });

    // Handle special case: path resolution
    if (pathFor) {
      console.log(`🛤️ Resolving path for file: ${pathFor}`);
      const pathData = await resolveFilePath(pathFor, drive);
      const duration = Date.now() - startTime;
      
      return res.status(200).json({
        success: true,
        data: {
          path: pathData,
          fileId: pathFor
        },
        performance: {
          duration: `${duration}ms`
        }
      });
    }

    // Check cache for folder listings (not for search/recent/shared)
    const cacheKey = `${scope || 'folder'}_${folderId}_${pageToken || 'first'}`;
    if (!search && !scope && folderId !== 'root') {
      const cached = getCachedFolder(cacheKey);
      if (cached) {
        console.log(`⚡ Cache hit for folder: ${folderId}`);
        return res.status(200).json({
          ...cached,
          performance: {
            ...cached.performance,
            cacheHit: true,
            duration: `${Date.now() - startTime}ms`
          }
        });
      }
    }

    // Build Drive API query based on parameters
    const queryParams = buildDriveQuery({
      folderId,
      search,
      scope,
      type,
      mimeType,
      days: parseInt(days),
      limit: parseInt(limit),
      pageSize: parseInt(pageSize),
      pageToken,
      orderBy
    });

    console.log(`📊 Drive API query:`, queryParams.q);

    // Execute Drive API call with retry logic
    const response = await executeWithRetry(() => 
      drive.files.list(queryParams)
    );

    const files = response.data.files || [];
    
    // Transform files to our expected format
    const transformedFiles = files.map(file => enhanceFileMetadata(file));

    // Build response metadata
    const responseData = {
      files: transformedFiles,
      nextPageToken: response.data.nextPageToken,
      hasMore: !!response.data.nextPageToken,
      scope: scope || 'folder',
      totalFiles: files.length
    };

    // Add query-specific metadata
    if (search) responseData.searchQuery = search;
    if (folderId !== 'root') responseData.folderId = folderId;
    if (scope === 'recent') responseData.daysBack = parseInt(days);

    const duration = Date.now() - startTime;
    const finalResponse = {
      success: true,
      data: responseData,
      performance: {
        duration: `${duration}ms`,
        fileCount: transformedFiles.length,
        cacheHit: false,
        apiCalls: 1
      },
      meta: {
        query: queryParams.q,
        scope: scope || 'folder',
        timestamp: new Date().toISOString()
      }
    };

    // Cache folder listings (not search results)
    if (!search && !scope && folderId !== 'root') {
      setCachedFolder(cacheKey, finalResponse);
    }

    console.log(`⚡ Enhanced Drive API completed: ${transformedFiles.length} files in ${duration}ms`);
    return res.status(200).json(finalResponse);

  } catch (error) {
    console.error('Enhanced Drive API error:', error);
    
    // Try graceful degradation for folder listings
    if (!req.query.search && !req.query.scope) {
      try {
        console.log('🔄 Attempting graceful degradation to basic folder listing');
        return await executeBasicFolderListing(req, res);
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to access Google Drive',
      message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      debug: process.env.NODE_ENV === 'development' ? {
        errorType: error.name,
        stack: error.stack
      } : undefined
    });
  }
}

// Build Google Drive API query based on parameters
function buildDriveQuery(params) {
  const { folderId, search, scope, type, mimeType, days, pageSize, pageToken, orderBy } = params;
  
  let query;
  let order = orderBy || 'folder,name';
  let fields = 'nextPageToken,files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,parents,shared,owners(displayName,emailAddress))';
  
  switch (scope) {
    case 'recent':
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - days);
      query = `modifiedTime > '${recentDate.toISOString()}' and trashed=false`;
      order = 'modifiedTime desc';
      break;
    
    case 'shared':
      query = `sharedWithMe and trashed=false`;
      order = 'sharedWithMeTime desc';
      break;
    
    case 'trash':
      query = `trashed=true`;
      order = 'trashedTime desc';
      break;
    
    default: // folder listing or search
      if (search) {
        // Global search across all Drive
        query = `fullText contains '${search.replace(/'/g, "\\'")}' and trashed=false`;
        order = 'relevance';
      } else {
        // Standard folder listing
        query = `'${folderId}' in parents and trashed=false`;
        order = 'folder,name';
      }
      break;
  }
  
  // Add file type filtering
  if (type) {
    const typeQueries = {
      'document': `mimeType contains 'document'`,
      'spreadsheet': `mimeType contains 'spreadsheet'`,
      'presentation': `mimeType contains 'presentation'`,
      'pdf': `mimeType='application/pdf'`,
      'image': `mimeType contains 'image'`,
      'video': `mimeType contains 'video'`,
      'audio': `mimeType contains 'audio'`,
      'folder': `mimeType='application/vnd.google-apps.folder'`
    };
    
    if (typeQueries[type]) {
      query += ` and ${typeQueries[type]}`;
    }
  }
  
  // Add specific MIME type filtering
  if (mimeType) {
    if (mimeType.endsWith('*')) {
      query += ` and mimeType contains '${mimeType.slice(0, -1)}'`;
    } else {
      query += ` and mimeType='${mimeType}'`;
    }
  }
  
  return {
    q: query,
    fields,
    pageSize: Math.min(pageSize || 100, 1000), // Max 1000 per Google Drive API
    pageToken: pageToken || undefined,
    orderBy: order,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true
  };
}

// Enhance file metadata with additional information
function enhanceFileMetadata(file) {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size ? parseInt(file.size) : undefined,
    modifiedTime: file.modifiedTime,
    webViewLink: file.webViewLink,
    thumbnailLink: file.thumbnailLink,
    isFolder: file.mimeType === 'application/vnd.google-apps.folder',
    parents: file.parents || [],
    shared: file.shared || false,
    owners: file.owners || [],
    // Enhanced metadata
    fileCategory: categorizeFile(file.mimeType),
    isGoogleWorkspace: isGoogleWorkspaceFile(file.mimeType),
    canPreview: canPreviewFile(file.mimeType),
    estimatedSize: file.size ? formatFileSize(parseInt(file.size)) : undefined,
    lastActivity: getRelativeTime(file.modifiedTime)
  };
}

// Categorize file based on MIME type
function categorizeFile(mimeType) {
  if (!mimeType) return 'unknown';
  
  if (mimeType === 'application/vnd.google-apps.folder') return 'folder';
  if (mimeType.includes('document')) return 'document';
  if (mimeType.includes('spreadsheet')) return 'spreadsheet';
  if (mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('text/')) return 'text';
  
  return 'file';
}

// Check if file is a Google Workspace file
function isGoogleWorkspaceFile(mimeType) {
  return mimeType && mimeType.startsWith('application/vnd.google-apps.');
}

// Check if file can be previewed
function canPreviewFile(mimeType) {
  if (!mimeType) return false;
  
  const previewable = [
    'application/pdf',
    'text/plain',
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation'
  ];
  
  return previewable.includes(mimeType) || 
         mimeType.startsWith('image/') || 
         mimeType.startsWith('video/');
}

// Format file size in human readable format
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Get relative time string
function getRelativeTime(dateString) {
  if (!dateString) return 'Unknown';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now.getTime() - date.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays === 1) return 'Today';
  if (diffDays === 2) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays - 1} days ago`;
  if (diffDays <= 30) return `${Math.ceil(diffDays / 7)} weeks ago`;
  if (diffDays <= 365) return `${Math.ceil(diffDays / 30)} months ago`;
  return `${Math.ceil(diffDays / 365)} years ago`;
}

// Resolve file path by traversing parent hierarchy
async function resolveFilePath(fileId, drive) {
  const pathParts = [];
  let currentFileId = fileId;
  const visited = new Set(); // Prevent infinite loops
  
  try {
    // Traverse up the parent chain
    while (currentFileId && currentFileId !== 'root' && !visited.has(currentFileId)) {
      visited.add(currentFileId);
      
      const file = await drive.files.get({
        fileId: currentFileId,
        fields: 'name,parents',
        supportsAllDrives: true
      });
      
      pathParts.unshift({
        id: currentFileId,
        name: file.data.name
      });
      
      currentFileId = file.data.parents?.[0];
    }
    
    // Add "My Drive" as root
    pathParts.unshift({
      id: 'root',
      name: 'My Drive'
    });
    
    return pathParts;
  } catch (error) {
    console.error('Path resolution error:', error);
    return [
      { id: 'root', name: 'My Drive' },
      { id: fileId, name: 'Unknown File' }
    ];
  }
}

// Execute API call with exponential backoff retry
async function executeWithRetry(apiCall, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await apiCall();
    } catch (error) {
      // Retry on rate limit errors
      if (error.code === 429 && i < maxRetries - 1) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`Rate limited, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
}

// Cache management functions
function getCachedFolder(key) {
  const cached = folderCache.get(key);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  return null;
}

function setCachedFolder(key, data) {
  folderCache.set(key, {
    data,
    timestamp: Date.now()
  });
  
  // Clean up expired cache entries periodically
  if (folderCache.size > 100) {
    cleanupCache();
  }
}

function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of folderCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      folderCache.delete(key);
    }
  }
}

// Graceful degradation fallback
async function executeBasicFolderListing(req, res) {
  const folderId = req.query.folderId || 'root';
  console.log(`🔄 Basic fallback listing for folder: ${folderId}`);
  
  // This would implement a very basic folder listing as last resort
  // For now, just throw to let the main error handler deal with it
  throw new Error('Graceful degradation not implemented yet');
}