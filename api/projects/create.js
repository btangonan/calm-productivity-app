import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    const { name, description = '', areaId = null } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Project name is required' });
    }
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🚀 Creating project: "${name}" for user: ${user.email}`);

    // Generate project data immediately
    const projectId = `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const createdAt = new Date().toISOString();

    // Use Google APIs directly for speed
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

    // Add to spreadsheet immediately (don't wait for drive folder creation)
    console.log('📝 Adding project to spreadsheet...');
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Projects!A:H',
      valueInputOption: 'USER_ENTERED',
      resource: {
        values: [[
          projectId,
          name.trim(),
          description.trim(),
          areaId || '',
          'Active',
          '', // driveFolderId - will be set later
          '', // driveFolderUrl - will be set later  
          createdAt
        ]]
      }
    });

    console.log(`✅ Project "${name}" added to spreadsheet`);

    // Create drive folder immediately
    let driveFolderId = '';
    let driveFolderUrl = '';
    
    try {
      console.log('📁 Creating drive folder...');
      const drive = google.drive({ version: 'v3', auth: authClient });
      
      // Get master folder ID if available (from master-folder API memory)
      let parentFolderId = null;
      try {
        const { masterFolderMap } = await import('../settings/master-folder.js');
        parentFolderId = masterFolderMap.get(user.email);
        if (parentFolderId) {
          console.log(`📁 Creating project folder inside master folder: ${parentFolderId}`);
        }
      } catch {
        console.log('📁 No master folder configured, creating in root drive');
      }
      
      // Create the project folder
      const folderResource = {
        name: name.trim(),
        mimeType: 'application/vnd.google-apps.folder'
      };
      
      // Add parent folder if master folder is configured
      if (parentFolderId) {
        folderResource.parents = [parentFolderId];
      }
      
      const folderResponse = await drive.files.create({
        resource: folderResource
      });
      
      driveFolderId = folderResponse.data.id;
      driveFolderUrl = `https://drive.google.com/drive/folders/${driveFolderId}`;
      
      console.log(`📁 Drive folder created: ${driveFolderId}`);
      
      // Update the spreadsheet with the folder information
      // Find the row we just added (last row)
      const projectsResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Projects!A:A',
      });
      const lastRowIndex = (projectsResponse.data.values || []).length;
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `Projects!F${lastRowIndex}:G${lastRowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[driveFolderId, driveFolderUrl]]
        }
      });
      
      console.log(`📁 Updated spreadsheet with folder info`);
    } catch (folderError) {
      console.error('❌ Failed to create drive folder:', folderError);
      // Don't fail the entire request, just log and continue without folder
    }

    // Create the project object to return
    const project = {
      id: projectId,
      name: name.trim(),
      description: description.trim(),
      areaId: areaId || null,
      status: 'Active',
      driveFolderId,
      driveFolderUrl,
      createdAt
    };

    const duration = Date.now() - startTime;
    console.log(`⚡ Project created in ${duration}ms`);

    // Drive folder created above with error handling

    return res.status(200).json({
      success: true,
      data: project,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        note: 'Drive folder will be created in background'
      }
    });

  } catch (error) {
    console.error('Create project error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create project',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}