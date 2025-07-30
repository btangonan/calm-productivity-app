import { validateGoogleToken } from '../utils/google-auth.js';
import { isCacheInvalidated, markCacheFresh } from '../cache/invalidate.js';

export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    // Handle token refresh case
    if (user.needsRefresh) {
      return res.status(401).json({ 
        error: 'Token expired',
        needsRefresh: true,
        message: 'Please refresh your access token'
      });
    }

    // Route based on HTTP method
    switch (req.method) {
      case 'GET':
        return await handleListTasks(req, res, user);
      case 'POST':
        return await handleCreateTask(req, res, user);
      case 'PUT':
        return await handleUpdateTask(req, res, user);
      case 'DELETE':
        return await handleDeleteTask(req, res, user);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Tasks manage error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process tasks request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Handle GET - List tasks (from /api/tasks/list.js)
async function handleListTasks(req, res, user) {
  const startTime = Date.now();
  
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
}

// Handle POST - Create task (from /api/tasks/create.js)
async function handleCreateTask(req, res, user) {
  const startTime = Date.now();
  
  const { title, description, projectId, context, dueDate, attachments } = req.body;

  if (!title) {
    return res.status(400).json({ 
      success: false, 
      error: 'Task title is required' 
    });
  }

  console.log(`📝 Creating task for user: ${user.email}`);

  // Set up Google Sheets API with user authentication
  const { google } = await import('googleapis');
  let authClient;
  
  if (user.accessToken && !user.isJWT) {
    // User has a real access token - create OAuth2 client directly
    const { OAuth2Client } = await import('google-auth-library');
    authClient = new OAuth2Client(
      process.env.VITE_GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    authClient.setCredentials({ access_token: user.accessToken });
    console.log('🔑 Using user OAuth token for Sheets API');
  } else {
    // Use service account for API calls (fallback)
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    authClient = await auth.getClient();
    console.log('🔑 Using service account for Sheets API');
  }

  const sheets = google.sheets({ version: 'v4', auth: authClient });

  // Generate task ID and prepare row data
  const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const createdAt = new Date().toISOString();
  const attachmentsJson = JSON.stringify(attachments || []);

  const rowData = [
    taskId,
    title,
    description || '',
    projectId || '',
    context || '',
    dueDate || '',
    'false', // isCompleted
    '0', // sortOrder
    createdAt,
    attachmentsJson
  ];

  // Append to Google Sheets
  const appendResponse = await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: 'Tasks!A:J',
    valueInputOption: 'RAW',
    insertDataOption: 'INSERT_ROWS',
    requestBody: {
      values: [rowData]
    }
  });

  if (!appendResponse.data) {
    throw new Error('Failed to append task to spreadsheet');
  }

  // Create task object to return
  const newTask = {
    id: taskId,
    title,
    description: description || '',
    projectId: projectId || null,
    context: context || '',
    dueDate: dueDate || null,
    isCompleted: false,
    sortOrder: 0,
    createdAt,
    attachments: attachments || []
  };

  const duration = Date.now() - startTime;
  console.log(`⚡ Created task ${taskId} in ${duration}ms`);

  return res.status(201).json({
    success: true,
    data: newTask,
    performance: {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    }
  });
}

// Handle PUT - Update task (including completion status)
async function handleUpdateTask(req, res, user) {
  const startTime = Date.now();
  console.log(`📝 Updating task for user: ${user.email}`);

  const { taskId, isCompleted, title, description, context, dueDate, projectId } = req.body;

  if (!taskId) {
    return res.status(400).json({
      success: false,
      error: 'Task ID is required for update'
    });
  }

  try {
    // Get service account credentials and connect to Google Sheets directly
    const { GoogleAuth } = await import('google-auth-library');
    const { google } = await import('googleapis');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const sheets = google.sheets({ version: 'v4', auth });
    const spreadsheetId = process.env.GOOGLE_SHEETS_ID;

    // First, get the current task data to find the row
    console.log(`📝 Finding task ${taskId} in Google Sheets...`);
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: 'Tasks!A:J', // Assuming columns A-J contain task data
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) {
      throw new Error('No task data found in spreadsheet');
    }

    // Find the task row (assuming first column contains task IDs)
    console.log(`🔍 Searching for task ${taskId} in ${rows.length} rows`);
    
    const taskRowIndex = rows.findIndex((row, index) => {
      console.log(`   Row ${index}: ID = "${row[0]}", matches = ${row[0] === taskId}`);
      return index > 0 && row[0] === taskId;
    });
    
    if (taskRowIndex === -1) {
      console.error(`❌ Task ${taskId} not found in spreadsheet`);
      console.error('Available task IDs:', rows.slice(1).map(row => row[0]).filter(Boolean));
      throw new Error(`Task ${taskId} not found in spreadsheet`);
    }

    const actualRowNumber = taskRowIndex + 1; // +1 because spreadsheet rows are 1-indexed
    console.log(`✅ Found task ${taskId} at row ${actualRowNumber} (index ${taskRowIndex})`);
    
    // Show current row data before update
    const currentRow = rows[taskRowIndex];
    console.log('📊 Current row data:', {
      id: currentRow[0],
      title: currentRow[1],
      isCompleted: currentRow[6],
      fullRow: currentRow
    });
    
    // Update the specific fields
    const updates = [];
    
    if (isCompleted !== undefined) {
      // isCompleted is in column G (index 6) - matches load-data.js row[6]
      updates.push({
        range: `Tasks!G${actualRowNumber}`,
        values: [[isCompleted]]
      });
    }
    
    if (title !== undefined) {
      // Assuming title is in column B (index 1)
      updates.push({
        range: `Tasks!B${actualRowNumber}`,
        values: [[title]]
      });
    }
    
    if (description !== undefined) {
      // Assuming description is in column C (index 2)
      updates.push({
        range: `Tasks!C${actualRowNumber}`,
        values: [[description]]
      });
    }
    
    if (context !== undefined) {
      // Assuming context is in column E (index 4)
      updates.push({
        range: `Tasks!E${actualRowNumber}`,
        values: [[context]]
      });
    }
    
    if (dueDate !== undefined) {
      // dueDate is in column F (index 5) - matches load-data.js row[5]
      updates.push({
        range: `Tasks!F${actualRowNumber}`,
        values: [[dueDate]]
      });
    }
    
    if (projectId !== undefined) {
      // Assuming projectId is in column D (index 3)
      updates.push({
        range: `Tasks!D${actualRowNumber}`,
        values: [[projectId]]
      });
    }

    console.log(`📝 Updating ${updates.length} fields for task ${taskId} in row ${actualRowNumber}`);

    // Perform batch update
    if (updates.length > 0) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: 'RAW',
          data: updates
        }
      });
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Task updated successfully in Google Sheets in ${duration}ms`);

    // Return success response
    return res.status(200).json({
      success: true,
      data: {
        taskId,
        updatedFields: Object.keys({ isCompleted, title, description, context, dueDate, projectId }).filter(key => 
          eval(key) !== undefined
        ),
        rowNumber: actualRowNumber
      },
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Failed to update task:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to update task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Handle DELETE - Delete task (placeholder for future implementation)
async function handleDeleteTask(req, res, user) {
  return res.status(501).json({
    success: false,
    error: 'Task delete not yet implemented in consolidated endpoint'
  });
}