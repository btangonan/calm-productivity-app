import { validateGoogleToken } from '../utils/google-auth.js';
import { isCacheInvalidated, markCacheFresh } from '../cache/invalidate.js';

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

    console.log(`🔐 Fetching tasks for user: ${user.email}`);

    // Check if tasks cache has been invalidated
    const userIdentifier = user.sub || user.email;
    const isInvalidated = isCacheInvalidated(userIdentifier, 'tasks');
    
    if (isInvalidated) {
      console.log('💾 Tasks cache invalidated - forcing fresh fetch from Google Sheets');
    }

    // Fetch tasks from Google Sheets
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/Tasks!A:J`,
      {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      console.error('Sheets API error:', sheetsResponse.status, errorText);
      throw new Error(`Sheets API error: ${sheetsResponse.status}`);
    }

    const sheetsResult = await sheetsResponse.json();
    const rows = sheetsResult.values || [];

    // Skip header row and convert to task objects
    const tasks = rows.slice(1).map(row => ({
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
    })).filter(task => task.id); // Filter out empty rows

    const duration = Date.now() - startTime;
    console.log(`⚡ Fetched ${tasks.length} tasks in ${duration}ms`);

    // Mark cache as fresh since we just fetched new data
    if (isInvalidated) {
      markCacheFresh(userIdentifier, 'tasks');
    }

    return res.status(200).json({
      success: true,
      data: tasks,
      count: tasks.length,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
        cacheInvalidated: isInvalidated
      }
    });

  } catch (error) {
    console.error('Tasks list error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch tasks',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}