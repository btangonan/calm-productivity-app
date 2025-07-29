import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  try {
    // Authenticate user for all operations
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const startTime = Date.now();

    if (req.method === 'POST' && req.query.action === 'fix-drive-folders') {
      return await handleFixDriveFolders(req, res, user, startTime);
    } else if (req.method === 'POST') {
      return await handleCreateProject(req, res, user, startTime);
    } else if (req.method === 'DELETE') {
      return await handleDeleteProject(req, res, user, startTime);
    } else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Projects manage error:', error);
    return res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
}

// CREATE PROJECT
async function handleCreateProject(req, res, user, startTime) {
  const { name, description = '', areaId = null } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
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
    // Continue without drive folder - project still created
  }

  const duration = Date.now() - startTime;
  const newProject = {
    id: projectId,
    name: name.trim(),
    description: description.trim(),
    areaId: areaId || null,
    status: 'Active',
    driveFolderId,
    driveFolderUrl,
    createdAt
  };

  console.log(`⚡ Project creation completed in ${duration}ms`);

  return res.status(201).json({
    success: true,
    data: newProject,
    performance: {
      duration: `${duration}ms`
    }
  });
}

// DELETE PROJECT
async function handleDeleteProject(req, res, user, startTime) {
  const { projectId } = req.body;

  if (!projectId) {
    return res.status(400).json({ error: 'Project ID is required' });
  }

  console.log(`🗑️ Deleting project: ${projectId} for user: ${user.email}`);

  // Use Google Sheets API directly with authentication
  const { google } = await import('googleapis');
  const { GoogleAuth } = await import('google-auth-library');
  
  const auth = new GoogleAuth({
    credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  const authClient = await auth.getClient();
  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Get all projects to find the row to delete
  const projectsResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: 'Projects!A:H'
  });

  const projectRows = projectsResponse.data.values || [];
  if (projectRows.length <= 1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Find project in data rows (excluding header)
  const dataRows = projectRows.slice(1);
  const projectIndex = dataRows.findIndex(row => row[0] === projectId);

  if (projectIndex === -1) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const project = dataRows[projectIndex];
  const projectName = project[1];
  console.log(`📁 Found project "${projectName}" to delete`);

  // Delete the project row from the spreadsheet  
  const actualRowIndex = projectIndex + 2; // +1 for header, +1 for 0-based index
  console.log(`📊 Deleting project row ${actualRowIndex}`);

  await sheets.spreadsheets.batchUpdate({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    resource: {
      requests: [{
        deleteDimension: {
          range: {
            sheetId: 0, // Assuming Projects is the first sheet
            dimension: 'ROWS',
            startIndex: actualRowIndex - 1,
            endIndex: actualRowIndex
          }
        }
      }]
    }
  });

  console.log(`✅ Project "${projectName}" deleted from spreadsheet`);

  // TODO: Also delete associated tasks if needed
  // For now, we'll just delete the project record to keep it simple

  const duration = Date.now() - startTime;
  console.log(`⚡ Project deletion completed in ${duration}ms`);

  return res.status(200).json({
    success: true,
    data: {
      projectId,
      projectName,
      message: 'Project deleted successfully'
    },
    performance: {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }
  });
}

// FIX DRIVE FOLDERS
async function handleFixDriveFolders(req, res, user, startTime) {
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
  try {
    // This could be improved to get from user preferences, but for now assume they have one
    const driveResponse = await drive.files.list({
      q: "name='Productivity App' and mimeType='application/vnd.google-apps.folder' and trashed=false",
      fields: 'files(id,name)',
      pageSize: 1
    });
    
    if (driveResponse.data.files && driveResponse.data.files.length > 0) {
      masterFolderId = driveResponse.data.files[0].id;
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
}