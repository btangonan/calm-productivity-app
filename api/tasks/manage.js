import { validateGoogleToken } from '../utils/google-auth.js';
import { isCacheInvalidated, markCacheFresh } from '../cache/invalidate.js';

export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
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
    // Call Google Apps Script to update the task
    const updateData = {};
    if (isCompleted !== undefined) updateData.isCompleted = isCompleted;
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (context !== undefined) updateData.context = context;
    if (dueDate !== undefined) updateData.dueDate = dueDate;
    if (projectId !== undefined) updateData.projectId = projectId;

    console.log(`📝 Updating task ${taskId} with data:`, updateData);

    const scriptResponse = await fetch(process.env.VITE_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        action: 'updateTask',
        taskId: taskId,
        updateData: updateData
      })
    });

    if (!scriptResponse.ok) {
      throw new Error(`Google Apps Script returned ${scriptResponse.status}: ${scriptResponse.statusText}`);
    }

    const scriptResult = await scriptResponse.json();
    
    if (!scriptResult.success) {
      throw new Error(scriptResult.message || 'Failed to update task in Google Apps Script');
    }

    const duration = Date.now() - startTime;
    console.log(`✅ Task updated successfully in ${duration}ms`);

    // Return the updated task
    return res.status(200).json({
      success: true,
      data: scriptResult.data,
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