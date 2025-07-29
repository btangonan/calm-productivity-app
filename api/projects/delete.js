import { validateGoogleToken } from '../utils/google-auth.js';

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

    console.log(`🗑️ Deleting project: ${projectId} for user: ${user.email}`);

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

    // First, get the project to confirm it exists and get drive folder info
    console.log('🔍 Finding project in spreadsheet...');
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
    const driveFolderUrl = project[5];
    
    console.log(`📁 Found project "${projectName}" with drive folder: ${driveFolderUrl}`);

    // Delete the project row from the spreadsheet
    console.log('🗑️ Deleting project from spreadsheet...');
    const actualRowIndex = projectIndex + 2; // +1 for header, +1 for 0-based index
    
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

    // TODO: Also delete associated tasks and drive folder if needed
    // For now, we'll just delete the project record

    const duration = Date.now() - startTime;
    console.log(`⚡ Project deleted in ${duration}ms`);

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

  } catch (error) {
    console.error('Delete project error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to delete project',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}