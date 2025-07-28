import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    
    // Extract and validate request data
    const { title, description, projectId, context, dueDate, attachments } = req.body;
    
    if (!title || title.trim().length === 0) {
      return res.status(400).json({ error: 'Title is required' });
    }

    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔐 Authenticated user: ${user.email}`);

    // Generate task ID and timestamp
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const timestamp = new Date().toISOString();

    // Prepare data for Google Sheets (matching your existing schema)
    const taskData = [
      taskId,
      title.trim(),
      description || '',
      projectId || '',
      context || '',
      dueDate || '',
      false, // isCompleted
      0, // sortOrder
      timestamp, // createdAt
      JSON.stringify(attachments || [])
    ];

    console.log(`📊 Creating task in Google Sheets: ${taskId}`);

    // Write to Google Sheets using direct API call (much faster than Apps Script)
    const sheetsResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${process.env.GOOGLE_SHEETS_ID}/values/Tasks!A:J:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${user.accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          values: [taskData]
        })
      }
    );

    if (!sheetsResponse.ok) {
      const errorText = await sheetsResponse.text();
      console.error('Sheets API error:', sheetsResponse.status, errorText);
      throw new Error(`Sheets API error: ${sheetsResponse.status}`);
    }

    const sheetsResult = await sheetsResponse.json();
    console.log(`✅ Task written to Google Sheets: ${sheetsResult.updates?.updatedRows || 1} row(s)`);

    // Create response object (matching your existing Task interface)
    const newTask = {
      id: taskId,
      title: title.trim(),
      description: description || '',
      projectId: projectId || null,
      context: context || '',
      dueDate: dueDate || null,
      isCompleted: false,
      sortOrder: 0,
      createdAt: timestamp,
      attachments: attachments || []
    };

    const duration = Date.now() - startTime;
    console.log(`⚡ Task created successfully in ${duration}ms: ${taskId}`);

    return res.status(201).json({
      success: true,
      data: newTask,
      performance: {
        duration: `${duration}ms`,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Task creation error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to create task',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}