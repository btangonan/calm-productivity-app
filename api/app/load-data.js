import { validateGoogleToken } from '../utils/google-auth.js';
import { isCacheInvalidated, markCacheFresh } from '../cache/invalidate.js';

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

    // Check if app data cache has been invalidated
    const userIdentifier = user.sub || user.email;
    const isInvalidated = isCacheInvalidated(userIdentifier, 'app-data') || isCacheInvalidated(userIdentifier, 'tasks');
    
    if (isInvalidated) {
      console.log('💾 App data cache invalidated - forcing fresh fetch from Google Sheets');
    }

    // Use Google Sheets API directly with authentication
    const authStartTime = Date.now();
    console.log('🔍 Initializing Google Sheets API...');
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const authDuration = Date.now() - authStartTime;
    console.log(`⚡ Auth setup: ${authDuration}ms`);
    
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    const apiStartTime = Date.now();
    console.log('🔍 Making batch API call to Google Sheets...');
    const batchResponse = await sheets.spreadsheets.values.batchGet({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      ranges: ['Areas!A:F', 'Projects!A:H', 'Tasks!A:J'],
    });
    const apiDuration = Date.now() - apiStartTime;
    console.log(`⚡ Sheets API call: ${apiDuration}ms`);

    const [areasData, projectsData, tasksData] = batchResponse.data.valueRanges;

    const processingStartTime = Date.now();
    console.log('🔄 Processing data...');

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
    const projects = (projectsData.values || []).slice(1).map(row => {
      let driveFolderId = row[5] || '';
      let driveFolderUrl = row[6] || '';
      
      // Fix swapped drive folder data (if ID contains URL and URL contains timestamp/ID)
      if (driveFolderId.startsWith('https://drive.google.com/drive/folders/')) {
        // Swap them - the "ID" field actually contains the URL
        const temp = driveFolderId;
        driveFolderId = driveFolderUrl; // This might be empty or a timestamp
        driveFolderUrl = temp;
        
        // If we now have a URL but no ID, extract the ID from the URL
        if (driveFolderUrl && !driveFolderId) {
          const match = driveFolderUrl.match(/\/folders\/([a-zA-Z0-9-_]+)/);
          if (match) {
            driveFolderId = match[1];
          }
        }
        
        console.log(`🔧 Fixed swapped drive folder data for project: ${row[1]} - ID: ${driveFolderId}, URL: ${driveFolderUrl}`);
      }
      
      return {
        id: row[0] || '',
        name: row[1] || '',
        description: row[2] || '',
        areaId: row[3] || null,
        status: row[4] || 'Active',
        driveFolderId,
        driveFolderUrl,
        createdAt: row[7] || ''
      };
    }).filter(project => project.id);

    // Convert tasks data
    console.log('🔍 Raw tasks data from Google Sheets:', tasksData.values?.length || 0, 'rows');
    
    const tasks = (tasksData.values || []).slice(1).map((row, index) => {
      // Debug logging for each row
      console.log(`📋 Task row ${index + 2}:`, {
        id: row[0],
        title: row[1],
        isCompletedRaw: row[6],
        isCompletedParsed: row[6] === 'TRUE' || row[6] === 'true' || row[6] === true,
        fullRow: row
      });
      
      return {
        id: row[0] || '',
        title: row[1] || '',
        description: row[2] || '',
        projectId: row[3] || null,
        context: row[4] || '',
        dueDate: row[5] || null,
        isCompleted: row[6] === 'TRUE' || row[6] === 'true' || row[6] === true,
        sortOrder: parseInt(row[7]) || 0,
        createdAt: row[8] || '',
        attachments: (() => {
          try {
            return JSON.parse(row[9] || '[]');
          } catch {
            return [];
          }
        })()
      };
    }).filter(task => task.id);

    const processingDuration = Date.now() - processingStartTime;
    console.log(`⚡ Data processing: ${processingDuration}ms`);

    const duration = Date.now() - startTime;
    console.log(`⚡ Total app data loading: ${duration}ms: ${areas.length} areas, ${projects.length} projects, ${tasks.length} tasks`);

    // Mark cache as fresh since we just fetched new data
    if (isInvalidated) {
      markCacheFresh(userIdentifier, 'app-data');
      markCacheFresh(userIdentifier, 'tasks');
    }

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
        cacheInvalidated: isInvalidated,
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