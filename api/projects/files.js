import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    const { projectId } = req.query;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔐 Fetching files for project: ${projectId} for user: ${user.email}`);

    // Use Google APIs directly
    console.log('🔍 Initializing Google APIs...');
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
    const drive = google.drive({ version: 'v3', auth: authClient });

    // First, get the project to find its Drive folder ID
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
          timestamp: new Date().toISOString()
        }
      });
    }

    const driveFolderUrl = project[5];
    const driveFolderId = getDriveFolderIdFromUrl(driveFolderUrl);

    if (!driveFolderId) {
      console.log(`Invalid Drive folder URL for project: ${projectId}`);
      return res.status(400).json({
        success: false,
        error: 'Invalid Drive folder URL',
      });
    }
    console.log(`📁 Found Drive folder: ${driveFolderId}`);

    // Get files from Google Drive API (much faster than Apps Script)
    console.log('🔍 Fetching files from Drive API...');
    const filesResponse = await drive.files.list({
      q: `'${driveFolderId}' in parents and trashed=false`,
      fields: 'files(id,name,mimeType,size,createdTime,modifiedTime,thumbnailLink,webViewLink,parents)',
      orderBy: 'modifiedTime desc',
    });

    console.log('Raw filesResponse.data.files:', filesResponse.data.files);

    const files = (filesResponse.data.files || []).map(file => ({
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
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch project files',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
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