import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
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

    console.log(`🔧 Fixing missing drive folders for user: ${user.email}`);

    // Use Google APIs with authentication
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

    // Get all projects from Google Sheets
    const projectsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Projects!A:H'
    });

    const projectRows = projectsResponse.data.values || [];
    if (projectRows.length <= 1) {
      return res.status(200).json({
        success: true,
        message: 'No projects found to fix',
        fixed: 0
      });
    }

    // Header row: id, name, description, areaId, status, driveFolderId, driveFolderUrl, createdAt
    const headerRow = projectRows[0];
    const dataRows = projectRows.slice(1);

    console.log(`📊 Found ${dataRows.length} projects to check`);

    let fixedCount = 0;
    const updatedRows = [];

    // Get master folder ID for creating new folders inside it
    let masterFolderId = null;
    const masterFolderMap = new Map();
    try {
      // This could be improved to get from user preferences, but for now assume they have one
      const driveResponse = await drive.files.list({
        q: "name='Productivity App' and mimeType='application/vnd.google-apps.folder' and trashed=false",
        fields: 'files(id,name)',
        pageSize: 1
      });
      
      if (driveResponse.data.files && driveResponse.data.files.length > 0) {
        masterFolderId = driveResponse.data.files[0].id;
        masterFolderMap.set(user.email, masterFolderId);
        console.log(`📁 Found master folder: ${masterFolderId}`);
      }
    } catch (error) {
      console.log(`📁 No master folder found, will create in root: ${error.message}`);
    }

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const projectId = row[0];
      const projectName = row[1];
      const driveFolderId = row[5] || '';
      const driveFolderUrl = row[6] || '';

      // Skip if project already has drive folder data
      if (driveFolderId && driveFolderUrl && driveFolderUrl.startsWith('http')) {
        updatedRows.push(row);
        continue;
      }

      console.log(`🔧 Fixing project: ${projectName} (${projectId})`);

      try {
        // Create drive folder for this project
        const folderResource = {
          name: projectName.trim(),
          mimeType: 'application/vnd.google-apps.folder'
        };
        
        // Add parent folder if master folder is configured
        if (masterFolderId) {
          folderResource.parents = [masterFolderId];
        }
        
        const folderResponse = await drive.files.create({
          resource: folderResource
        });
        
        const newFolderId = folderResponse.data.id;
        const newFolderUrl = `https://drive.google.com/drive/folders/${newFolderId}`;
        
        // Update the row with new drive folder data
        const updatedRow = [...row];
        updatedRow[5] = newFolderId; // driveFolderId
        updatedRow[6] = newFolderUrl; // driveFolderUrl
        updatedRows.push(updatedRow);
        
        fixedCount++;
        console.log(`✅ Created drive folder for ${projectName}: ${newFolderId}`);
        
      } catch (error) {
        console.error(`❌ Failed to create drive folder for ${projectName}:`, error);
        // Keep the original row unchanged
        updatedRows.push(row);
      }
    }

    // Update Google Sheets with the fixed data
    if (fixedCount > 0) {
      const allRows = [headerRow, ...updatedRows];
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Projects!A:H',
        valueInputOption: 'RAW',
        resource: {
          values: allRows
        }
      });
      
      console.log(`📊 Updated Google Sheets with ${fixedCount} fixed projects`);
    }

    const duration = Date.now() - startTime;
    console.log(`⚡ Drive folder fix completed in ${duration}ms`);

    return res.status(200).json({
      success: true,
      message: `Fixed ${fixedCount} projects with missing drive folders`,
      fixed: fixedCount,
      total: dataRows.length,
      performance: {
        duration: `${duration}ms`
      }
    });

  } catch (error) {
    console.error('Fix drive folders error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fix drive folders',
      message: error.message
    });
  }
}