import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const startTime = Date.now();
    
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`📧 Gmail API request from user: ${user.email}`);

    // Route based on method and action
    if (req.method === 'GET') {
      return await handleSearchMessages(req, res, user);
    } else if (req.method === 'POST') {
      const { action } = req.query;
      if (action === 'convert-to-task') {
        return await handleConvertToTask(req, res, user);
      } else {
        return res.status(400).json({ error: 'Invalid action. Use: convert-to-task' });
      }
    }

  } catch (error) {
    console.error('Gmail API error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process Gmail request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Handle GET - Search Gmail messages
async function handleSearchMessages(req, res, user) {
  const {
    query = '',
    maxResults = '10',
    labelIds,
    includeSpamTrash = 'false',
    dateRange = '7' // days
  } = req.query;

  console.log(`🔍 Searching Gmail with query: "${query}", maxResults: ${maxResults}`);

  // Set up Gmail API with user authentication
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
    console.log('🔑 Using user OAuth token for Gmail API');
  } else {
    // Use service account for API calls (fallback - Note: Service accounts can't access user Gmail)
    return res.status(400).json({
      success: false,
      error: 'Gmail access requires user OAuth token. Service account cannot access user Gmail.'
    });
  }

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // Build search query
  let searchQuery = query;
  
  // Add date range filter
  if (dateRange && dateRange !== '0') {
    const daysAgo = parseInt(dateRange);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysAgo);
    const dateString = cutoffDate.toISOString().split('T')[0].replace(/-/g, '/');
    searchQuery += ` after:${dateString}`;
  }

  // Add label filters
  if (labelIds) {
    const labels = Array.isArray(labelIds) ? labelIds : [labelIds];
    labels.forEach(label => {
      searchQuery += ` label:${label}`;
    });
  }

  console.log(`📊 Final Gmail search query: "${searchQuery}"`);

  // Search messages
  const messagesResponse = await gmail.users.messages.list({
    userId: 'me',
    q: searchQuery,
    maxResults: parseInt(maxResults),
    includeSpamTrash: includeSpamTrash === 'true'
  });

  const messages = messagesResponse.data.messages || [];
  console.log(`📧 Found ${messages.length} messages`);

  // Get detailed message data for each message
  const detailedMessages = await Promise.all(
    messages.map(async (message) => {
      try {
        const messageDetail = await gmail.users.messages.get({
          userId: 'me',
          id: message.id,
          format: 'full'
        });

        const msg = messageDetail.data;
        const headers = msg.payload.headers || [];
        
        // Extract key header information
        const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
        
        const subject = getHeader('Subject');
        const from = getHeader('From');
        const to = getHeader('To');
        const date = getHeader('Date');
        
        // Extract message body
        let body = '';
        if (msg.payload.body?.data) {
          body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
        } else if (msg.payload.parts) {
          // Handle multipart messages
          const textPart = msg.payload.parts.find(part => part.mimeType === 'text/plain');
          if (textPart?.body?.data) {
            body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
          }
        }

        // Clean up body text (remove excessive whitespace, HTML tags if any)
        body = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
        if (body.length > 500) {
          body = body.substring(0, 500) + '...';
        }

        // Extract attachment info
        const attachments = [];
        if (msg.payload.parts) {
          msg.payload.parts.forEach(part => {
            if (part.filename && part.body?.attachmentId) {
              attachments.push({
                filename: part.filename,
                mimeType: part.mimeType,
                size: part.body.size,
                attachmentId: part.body.attachmentId
              });
            }
          });
        }

        return {
          id: msg.id,
          threadId: msg.threadId,
          subject,
          from,
          to,
          date,
          snippet: msg.snippet,
          body,
          attachments,
          labels: msg.labelIds || [],
          hasAttachments: attachments.length > 0,
          isUnread: msg.labelIds?.includes('UNREAD') || false
        };
      } catch (error) {
        console.error(`Failed to get details for message ${message.id}:`, error);
        return {
          id: message.id,
          error: 'Failed to load message details'
        };
      }
    })
  );

  const duration = Date.now() - Date.now();
  
  return res.status(200).json({
    success: true,
    data: {
      messages: detailedMessages,
      totalResults: messagesResponse.data.resultSizeEstimate || 0,
      query: searchQuery
    },
    performance: {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      messageCount: detailedMessages.length
    }
  });
}

// Handle POST - Convert email to task
async function handleConvertToTask(req, res, user) {
  const { messageId, projectId, context, customTitle, customDescription } = req.body;

  if (!messageId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Message ID is required' 
    });
  }

  console.log(`🔄 Converting Gmail message ${messageId} to task`);

  // Set up Gmail API to get message details
  const { google } = await import('googleapis');
  const { OAuth2Client } = await import('google-auth-library');
  
  const authClient = new OAuth2Client(
    process.env.VITE_GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  authClient.setCredentials({ access_token: user.accessToken });

  const gmail = google.gmail({ version: 'v1', auth: authClient });

  // Get message details
  const messageDetail = await gmail.users.messages.get({
    userId: 'me',
    id: messageId,
    format: 'full'
  });

  const msg = messageDetail.data;
  const headers = msg.payload.headers || [];
  
  const getHeader = (name) => headers.find(h => h.name.toLowerCase() === name.toLowerCase())?.value || '';
  
  const subject = getHeader('Subject');
  const from = getHeader('From');
  const date = getHeader('Date');

  // Extract message body
  let body = '';
  if (msg.payload.body?.data) {
    body = Buffer.from(msg.payload.body.data, 'base64').toString('utf-8');
  } else if (msg.payload.parts) {
    const textPart = msg.payload.parts.find(part => part.mimeType === 'text/plain');
    if (textPart?.body?.data) {
      body = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
    }
  }

  // Clean up body
  body = body.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

  // Create task from email
  const taskTitle = customTitle || `Email: ${subject}` || 'Email Task';
  const taskDescription = customDescription || 
    `From: ${from}\nDate: ${date}\n\n${body.substring(0, 1000)}${body.length > 1000 ? '...' : ''}`;

  // Determine context
  let taskContext = context || '';
  if (!taskContext) {
    // Auto-suggest context based on email content
    if (body.toLowerCase().includes('meeting') || body.toLowerCase().includes('call')) {
      taskContext = '@meeting';
    } else if (body.toLowerCase().includes('review') || body.toLowerCase().includes('feedback')) {
      taskContext = '@review';
    } else {
      taskContext = '@email';
    }
  }

  // Create task using the existing task creation endpoint
  const taskResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://localhost:3000' : 'https://' + req.headers.host}/api/tasks/manage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization
    },
    body: JSON.stringify({
      title: taskTitle,
      description: taskDescription,
      projectId: projectId || null,
      context: taskContext,
      dueDate: null,
      attachments: [{
        name: `Gmail Message: ${subject}`,
        url: `https://mail.google.com/mail/u/0/#inbox/${messageId}`,
        type: 'gmail-message'
      }]
    })
  });

  if (!taskResponse.ok) {
    const errorData = await taskResponse.json();
    throw new Error(errorData.error || 'Failed to create task');
  }

  const taskData = await taskResponse.json();

  return res.status(201).json({
    success: true,
    data: {
      task: taskData.data,
      emailDetails: {
        subject,
        from,
        date,
        messageId
      }
    },
    message: 'Email successfully converted to task'
  });
}