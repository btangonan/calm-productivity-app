import { validateGoogleToken } from '../utils/google-auth.js';

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

    // Get folder ID from query parameter
    const folderId = req.query.folderId || 'root';
    console.log(`🔍 Listing Drive files for folder: ${folderId}`);

    // Use Google Drive API directly with authentication
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/drive.readonly'],
    });

    const authClient = await auth.getClient();
    const drive = google.drive({ version: 'v3', auth: authClient });

    // Build query for listing files in the folder
    let query = `'${folderId}' in parents and trashed=false`;
    
    // Use the more efficient Drive v3 API with only necessary fields
    const response = await drive.files.list({
      q: query,
      fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink,parents)',
      pageSize: 1000, // Get up to 1000 files at once
      orderBy: 'folder,name' // Sort folders first, then by name
    });

    const files = response.data.files || [];
    
    // Transform to our expected format
    const transformedFiles = files.map(file => ({
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
      size: file.size ? parseInt(file.size) : undefined,
      modifiedTime: file.modifiedTime,
      webViewLink: file.webViewLink,
      thumbnailLink: file.thumbnailLink,
      isFolder: file.mimeType === 'application/vnd.google-apps.folder',
      parents: file.parents || [folderId === 'root' ? 'root' : folderId]
    }));

    const duration = Date.now() - startTime;
    console.log(`⚡ Listed ${transformedFiles.length} Drive files in ${duration}ms`);

    return res.status(200).json({
      success: true,
      data: transformedFiles,
      performance: {
        duration: `${duration}ms`,
        fileCount: transformedFiles.length,
        folderId: folderId
      }
    });

  } catch (error) {
    console.error('Drive list files error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to list drive files',
      message: error.message
    });
  }
}