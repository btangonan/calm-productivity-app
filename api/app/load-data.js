import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('[ENV_DEBUG] GOOGLE_CREDENTIALS_JSON exists:', !!process.env.GOOGLE_CREDENTIALS_JSON);
    console.log('[ENV_DEBUG] GOOGLE_SHEETS_ID exists:', !!process.env.GOOGLE_SHEETS_ID);
    const startTime = Date.now();
    
    // Authenticate user
    console.log('🔍 Validating token...');
    const authHeader = req.headers.authorization;
    console.log('🔑 Auth header present:', !!authHeader);
    
    const user = await validateGoogleToken(authHeader);
    if (!user) {
      console.log('❌ Token validation failed');
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔐 Loading app data for user: ${user.email}`);

    // Use Google Sheets API directly with authentication
    console.log('🔍 Initializing Google Sheets API...');
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    console.log('🔍 Making batch API call to Google Sheets...');
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      ranges: ['Areas!A:F', 'Projects!A:H', 'Tasks!A:J'],
    });

    const [areasData, projectsData, tasksData] = batchResponse.data.valueRanges;

    // Convert areas data
    const areas = (areasData.values || []).slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      description: row[2] || '',
      driveFolderId: row[3] || '',
      driveFolderUrl: row[4] || '',
      createdAt: row[5] || ''
    })).filter(area => area.id);

    // Convert projects data
    const projects = (projectsData.values || []).slice(1).map(row => ({
      id: row[0] || '',
      name: row[1] || '',
      description: row[2] || '',
      areaId: row[3] || null,
      status: row[4] || 'Active',
      driveFolderId: row[5] || '',
      driveFolderUrl: row[6] || '',
      createdAt: row[7] || ''
    })).filter(project => project.id);

    // Convert tasks data
    const tasks = (tasksData.values || []).slice(1).map(row => ({
      id: row[0] || '',
      title: row[1] || '',
      description: row[2] || '',
      projectId: row[3] || null,
      context: row[4] || '',
      dueDate: row[5] || null,
      isCompleted: row[6] === 'true' || row[6] === true,
      sortOrder: parseInt(row[7]) || 0,
      createdAt: row[8] || '',
      attachments: (() => {
        try {
          return JSON.parse(row[9] || '[]');
        } catch {
          return [];
        }
      })()
    })).filter(task => task.id);

    const duration = Date.now() - startTime;
    console.log(`⚡ Loaded app data in ${duration}ms: ${areas.length} areas, ${projects.length} projects, ${tasks.length} tasks`);

    return res.status(200).json({
      success: true,
      data: {
        areas,
        projects,
        tasks
      },
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        counts: {
          areas: areas.length,
          projects: projects.length,
          tasks: tasks.length
        }
      }
    });

  } catch (error) {
    // Log the full error object to Vercel's logs
    console.error('[DEBUG] Detailed Error:', error);
    console.error('[DEBUG] Error name:', error.name);
    console.error('[DEBUG] Error message:', error.message);
    console.error('[DEBUG] Error stack:', error.stack);
    
    // If the error is from a failed fetch to Google's API
    if (error.response) {
      try {
        const googleError = await error.response.text();
        console.error('Google API Response Status:', error.response.status);
        console.error('Google API Response Body:', googleError);
        
        return res.status(502).json({
          success: false,
          error: 'Google API request failed',
          google_api_status: error.response.status,
          google_error: JSON.parse(googleError)
        });
      } catch (parseError) {
        console.error('Could not parse Google API error:', parseError);
      }
    }
    
    // Return a more informative error response to the frontend
    return res.status(500).json({
      success: false,
      error: 'Failed to load app data',
      error_type: error.name, // e.g., 'TypeError'
      error_message: error.message, // The specific error message
      error_stack: process.env.NODE_ENV === 'development' ? error.stack : undefined, // Only show stack in dev
      environment_debug: {
        has_service_account_email: !!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        has_private_key: !!process.env.GOOGLE_PRIVATE_KEY_BASE64,
        has_sheets_id: !!process.env.GOOGLE_SHEETS_ID
      }
    });
  }
}