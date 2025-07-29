import { validateGoogleToken } from '../utils/google-auth.js';
import { masterFolderMap } from '../settings/master-folder.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'Project ID is required' });
    }
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`📁 Setting up drive folder for existing project: ${projectId} for user: ${user.email}`);

    // Use Google APIs directly
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive'
      ],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });
    const drive = google.drive({ version: 'v3', auth: authClient });

    // First, get the project details
    console.log('🔍 Getting project details from spreadsheet...');
    const projectsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Projects!A:H',
    });

    const projects = (projectsResponse.data.values || []).slice(1);
    const projectIndex = projects.findIndex(row => row[0] === projectId);
    
    if (projectIndex === -1) {
      return res.status(404).json({
        success: false,
        error: 'Project not found'
      });
    }

    const project = projects[projectIndex];
    const projectName = project[1];
    const existingDriveFolderId = project[5];
    const existingDriveFolderUrl = project[6];

    // Check if drive folder already exists
    if (existingDriveFolderId && existingDriveFolderUrl) {
      console.log(`✅ Project "${projectName}" already has drive folder: ${existingDriveFolderId}`);
      return res.status(200).json({
        success: true,
        data: {
          projectId,
          projectName,
          driveFolderId: existingDriveFolderId,
          driveFolderUrl: existingDriveFolderUrl,
          message: 'Drive folder already configured'
        }
      });
    }

    // Create drive folder
    console.log(`📁 Creating drive folder for project: "${projectName}"`);
    
    // Get master folder ID if available
    let parentFolderId = null;
    try {
      parentFolderId = masterFolderMap.get(user.email);
      if (parentFolderId) {
        console.log(`📁 Creating project folder inside master folder: ${parentFolderId}`);
      }
    } catch {
      console.log('📁 No master folder configured, creating in root drive');
    }
    
    // Create the project folder
    const folderResource = {
      name: projectName,
      mimeType: 'application/vnd.google-apps.folder'
    };
    
    // Add parent folder if master folder is configured
    if (parentFolderId) {
      folderResource.parents = [parentFolderId];
    }
    
    const folderResponse = await drive.files.create({
      resource: folderResource
    });
    
    const driveFolderId = folderResponse.data.id;
    const driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`;
    
    console.log(`📁 Drive folder created: ${driveFolderId}`);
    
    // Update the spreadsheet with the folder information
    const rowIndex = projectIndex + 2; // +1 for header, +1 for 0-based index
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `Projects!F${rowIndex}:G${rowIndex}`,
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[driveFolderId, driveFolderUrl]]
      }
    });
    
    console.log(`📁 Updated spreadsheet with folder info for project: "${projectName}"`);

    const duration = Date.now() - startTime;
    console.log(`⚡ Drive folder setup completed in ${duration}ms`);

    return res.status(200).json({
      success: true,
      data: {
        projectId,
        projectName,
        driveFolderId,
        driveFolderUrl,
        message: 'Drive folder created and configured successfully'
      },
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Setup drive folder error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to setup drive folder',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}