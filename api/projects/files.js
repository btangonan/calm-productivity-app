import { validateGoogleToken } from '../utils/google-auth.js';
import { Readable } from 'stream';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return await handleGetFiles(req, res);
  } else if (req.method === 'POST') {
    return await handleUploadFile(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

async function handleGetFiles(req, res) {

  try {
    const startTime = Date.now();
    const { projectId, folderId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔐 Fetching files for project: ${projectId} for user: ${user.email}`);

    let driveFolderId = folderId;
    
    // If no folder ID provided, fall back to looking it up (slower path)
    if (!driveFolderId) {
      console.log('⚠️ No folderId provided, falling back to Sheets lookup (slower)');
      
      // Use Google APIs directly
      const { google } = await import('googleapis');
      const { GoogleAuth } = await import('google-auth-library');
      
      const auth = new GoogleAuth({
        credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
        scopes: [
          'https://www.googleapis.com/auth/spreadsheets',
          'https://www.googleapis.com/auth/drive.readonly'
        ],
      });

      const authClient = await auth.getClient();
      const sheets = google.sheets({ version: 'v4', auth: authClient });

      // Get the project to find its Drive folder ID
      console.log('🔍 Fetching project data from Sheets...');
      const projectsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Projects!A:H',
      });

      const projects = (projectsResponse.data.values || []).slice(1);
      const project = projects.find(row => row[0] === projectId);

      if (!project || !project[5]) {
        console.log(`No Drive folder found for project: ${projectId}`);
        return res.status(200).json({
          success: true,
          data: [],
          count: 0,
          performance: {
            duration: `${Date.now() - startTime}ms`,
            timestamp: new Date().toISOString(),
            note: 'No Drive folder configured for project'
          }
        });
      }

      const driveFolderUrl = project[5];
      driveFolderId = getDriveFolderIdFromUrl(driveFolderUrl);

      if (!driveFolderId) {
        console.log(`Invalid Drive folder URL for project: ${projectId}`);
        return res.status(400).json({
          success: false,
          error: 'Invalid Drive folder URL',
        });
      }
    }
    
    console.log(`📁 Using Drive folder: ${driveFolderId}`);

    // Initialize Drive API only 
    console.log('⚡ Initializing Drive API...');
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')), 
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Get files from Google Drive API (much faster than Apps Script)
    console.log('🔍 Fetching files from Drive API...');
    const filesResponse = await drive.files.list({
      q: `'${driveFolderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,parents)',
      orderBy: 'modifiedTime desc',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    });

    console.log('Raw filesResponse.data.files:', filesResponse.data.files);

    // Filter out internal app folders and system files
    const filteredFiles = (filesResponse.data.files || []).filter(file => {
      // Hide the Tasks subfolder (internal app structure)
      if (file.name === 'Tasks' && file.mimeType === 'application/vnd.google-apps.folder') {
        return false;
      }
      
      // Hide any other system/hidden files (starting with .)
      if (file.name.startsWith('.')) {
        return false;
      }
      
      return true;
    });

    const files = filteredFiles.map(file => ({
      id: file.id,
      name: file.name,
      type: getFileType(file.mimeType),
      mimeType: file.mimeType,
      size: parseInt(file.size) || 0,
      createdAt: file.createdTime,
      modifiedAt: file.modifiedTime,
      thumbnailLink: file.thumbnailLink,
      webViewLink: file.webViewLink,
      downloadUrl: `https://drive.google.com/uc?id=${file.id}&export=download`,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder'
    }));

    console.log('Processed files array:', files);

    const duration = Date.now() - startTime;
    console.log(`⚡ Fetched ${files.length} files in ${duration}ms for project: ${projectId}`);

    return res.status(200).json({
      success: true,
      data: files,
      count: files.length,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        projectId,
        driveFolderId
      }
    });

  } catch (error) {
    console.error('Get project files error:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    
    // Handle specific error types
    if (error.message && error.message.includes('File not found')) {
      console.log(`⚠️ Drive folder not found for project: ${req.query.projectId}`);
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        performance: {
          duration: `${Date.now() - (req.startTime || Date.now())}ms`,
          timestamp: new Date().toISOString(),
          note: 'Drive folder not found - returning empty results'
        }
      });
    }
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch project files',
      errorType: error.name,
      errorMessage: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}

async function handleUploadFile(req, res) {
  let user, projectId, fileName, fileContent, mimeType;

  try {
    const startTime = Date.now();
    
    console.log('🔍 FILE UPLOAD AUTH DEBUG:', {
      hasAuthHeader: !!req.headers.authorization,
      authHeaderPrefix: req.headers.authorization?.substring(0, 20),
      timestamp: new Date().toISOString()
    });
    
    // Authenticate user
    user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      console.log('❌ FILE UPLOAD: Token validation failed');
      return res.status(401).json({ 
        error: 'Unauthorized',
        debug: {
          hasAuthHeader: !!req.headers.authorization,
          tokenPrefix: req.headers.authorization?.substring(0, 20),
          timestamp: new Date().toISOString()
        }
      });
    }

    console.log(`📤 File upload request from user: ${user.email}`);

    ({ projectId, fileName, fileContent, mimeType } = req.body);

    if (!projectId || !fileName || !fileContent) {
      return res.status(400).json({ error: 'Project ID, file name, and file content are required' });
    }

    console.log(`📤 Uploading file: ${fileName} to project: ${projectId}`);

    // Initialize Google APIs with proper authentication
    const { google } = await import('googleapis');
    let userAuthClient, serviceAuthClient;
    
    // Set up service account for sheets operations
    const { GoogleAuth } = await import('google-auth-library');
    const serviceAuth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    serviceAuthClient = await serviceAuth.getClient();
    
    // Set up user authentication for Drive operations
    if (user.accessToken && !user.isJWT) {
      // User has a real access token - create OAuth2 client directly
      console.log('🔑 Using user access token for Drive operations');
      const { OAuth2Client } = await import('google-auth-library');
      userAuthClient = new OAuth2Client(
        process.env.VITE_GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET
      );
      userAuthClient.setCredentials({ access_token: user.accessToken });
    } else {
      // Use service account for API calls (fallback)
      console.log('🔑 Using service account for Drive operations');
      const driveAuth = new GoogleAuth({
        credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
        scopes: ['https://www.googleapis.com/auth/drive'],
      });
      userAuthClient = await driveAuth.getClient();
    }

    const sheets = google.sheets({ version: 'v4', auth: serviceAuthClient }); // Use service account for sheets
    const drive = google.drive({ version: 'v3', auth: userAuthClient }); // Use appropriate auth for drive

    // Get the project's drive folder ID
    console.log('🔍 Looking up project drive folder...');
    console.log('🔍 SHEETS_ID:', process.env.GOOGLE_SHEETS_ID ? 'Present' : 'Missing');
    
    const projectsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Projects!A:H',
    });

    console.log('🔍 Projects response rows:', projectsResponse.data.values?.length || 0);
    const projects = (projectsResponse.data.values || []).slice(1);
    const project = projects.find(row => row[0] === projectId);
    
    console.log('🔍 Found project:', project ? 'Yes' : 'No');
    console.log('🔍 Project drive data:', project ? { 
      driveFolderId: project[5], 
      driveFolderUrl: project[6] 
    } : 'N/A');

    if (!project || !project[5]) {
      console.log(`❌ No Drive folder found for project: ${projectId}`);
      console.log(`❌ Available projects: ${projects.map(p => p[0]).join(', ')}`);
      return res.status(400).json({ 
        error: 'No Drive folder configured for this project',
        debug: {
          projectId,
          availableProjects: projects.map(p => p[0]),
          projectFound: !!project,
          hasDriveFolder: !!(project && project[5])
        }
      });
    }

    const driveFolderId = getDriveFolderIdFromUrl(project[5]) || project[5];
    console.log(`📁 Using Drive folder: ${driveFolderId}`);

    // Convert base64 content to buffer
    const buffer = Buffer.from(fileContent, 'base64');
    
    // Create file in Drive
    console.log(`📤 Creating file in Drive...`);
    const fileMetadata = {
      name: fileName,
      parents: [driveFolderId]
    };

    const media = {
      mimeType: mimeType || 'application/octet-stream',
      body: Readable.from(buffer)
    };

    const fileResponse = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,mimeType,size,createdTime,modifiedTime,webViewLink',
      supportsAllDrives: true
    });

    const uploadedFile = fileResponse.data;
    console.log(`✅ File uploaded successfully: ${uploadedFile.id}`);

    // Format response to match expected ProjectFile interface
    const projectFile = {
      id: uploadedFile.id,
      name: uploadedFile.name,
      type: getFileType(uploadedFile.mimeType),
      mimeType: uploadedFile.mimeType,
      size: parseInt(uploadedFile.size) || buffer.length,
      createdAt: uploadedFile.createdTime || new Date().toISOString(),
      modifiedAt: uploadedFile.modifiedTime || new Date().toISOString(),
      webViewLink: uploadedFile.webViewLink,
      downloadUrl: `https://drive.google.com/uc?id=${uploadedFile.id}&export=download`,
      isFolder: false
    };

    const duration = Date.now() - startTime;
    console.log(`⚡ File upload completed in ${duration}ms`);

    return res.status(201).json({
      success: true,
      data: projectFile,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('❌ DETAILED UPLOAD ERROR:', {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
      projectId,
      fileName,
      fileContentLength: fileContent?.length,
      mimeType,
      userEmail: user.email,
      timestamp: new Date().toISOString()
    });
    
    // Return detailed error for debugging
    return res.status(500).json({
      success: false,
      error: 'Failed to upload file',
      debug: {
        errorType: error.name,
        errorMessage: error.message,
        projectId,
        fileName,
        fileSize: fileContent?.length,
        userEmail: user.email,
        timestamp: new Date().toISOString(),
        // Include stack trace in development
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    });
  }
}

function getFileType(mimeType) {
  if (!mimeType) return 'unknown';
  
  if (mimeType.includes('spreadsheet')) return 'spreadsheet';
  if (mimeType.includes('document')) return 'document';  
  if (mimeType.includes('presentation')) return 'presentation';
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('image')) return 'image';
  if (mimeType.includes('video')) return 'video';
  if (mimeType.includes('audio')) return 'audio';
  if (mimeType.includes('folder')) return 'folder';
  
  return 'file';
}

function getDriveFolderIdFromUrl(url) {
  if (!url) return null;
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}