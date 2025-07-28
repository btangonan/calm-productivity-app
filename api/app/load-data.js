import { validateGoogleToken, getServiceAccountToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔐 Loading app data for user: ${user.email}`);

    // Use the user's access token directly (if available) or service account as fallback
    let apiToken = user.accessToken;
    
    if (user.isJWT) {
      // For old JWT tokens, use service account
      apiToken = await getServiceAccountToken();
    }

    // Use batch request to get all data at once (much faster than individual calls)
    const batchResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values:batchGet?ranges=Areas!A:F&ranges=Projects!A:H&ranges=Tasks!A:J`,
      {
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!batchResponse.ok) {
      const errorText = await batchResponse.text();
      console.error('Sheets batch API error:', batchResponse.status, errorText);
      throw new Error(`Sheets API error: ${batchResponse.status}`);
    }

    const batchResult = await batchResponse.json();
    const [areasData, projectsData, tasksData] = batchResult.valueRanges;

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
    console.error('Load app data error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to load app data',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}