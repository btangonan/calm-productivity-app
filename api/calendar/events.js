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
    
    // Handle token refresh case  
    if (user.needsRefresh) {
      return res.status(401).json({ 
        error: 'Token expired',
        needsRefresh: true,
        message: 'Please refresh your access token'
      });
    }

    console.log(`📅 Calendar API request from user: ${user.email}`);

    // Route based on method and action
    if (req.method === 'GET') {
      return await handleGetCalendarEvents(req, res, user);
    } else if (req.method === 'POST') {
      const { action } = req.query;
      if (action === 'convert-to-task') {
        return await handleConvertEventToTask(req, res, user);
      } else {
        return res.status(400).json({ error: 'Invalid action. Use: convert-to-task' });
      }
    }

  } catch (error) {
    console.error('Calendar API error:', error);
    
    return res.status(500).json({
      success: false,
      error: 'Failed to process Calendar request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Handle GET - Get Google Calendar events
async function handleGetCalendarEvents(req, res, user) {
  const startTime = Date.now();
  
  const {
    timeRange = '7', // days
    orderBy = 'startTime',
    singleEvents = 'true'
  } = req.query;

  // Scale maxResults based on time range - more days = more potential events
  const timeRangeDays = parseInt(timeRange);
  let maxResults;
  if (timeRangeDays <= 1) {
    maxResults = 10;   // Today: 10 events max
  } else if (timeRangeDays <= 7) {
    maxResults = 20;   // Week: 20 events max  
  } else if (timeRangeDays <= 14) {
    maxResults = 35;   // 2 weeks: 35 events max
  } else {
    maxResults = 50;   // Month+: 50 events max
  }

  console.log(`📅 Loading calendar events for next ${timeRange} days, maxResults: ${maxResults}`);

  // Set up Google Calendar API with user authentication
  const { google } = await import('googleapis');
  let authClient;
  
  if (user.accessToken && !user.isJWT) {
    // User has a real access token - create OAuth2 client directly
    const { OAuth2Client } = await import('google-auth-library');
    authClient = new OAuth2Client(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    authClient.setCredentials({ access_token: user.accessToken });
    console.log('🔑 Using user OAuth token for Calendar API');
  } else {
    // Use service account for API calls (fallback - Note: Service accounts can't access user Calendar)
    return res.status(400).json({
      success: false,
      error: 'Calendar access requires user OAuth token. Service account cannot access user Calendar.'
    });
  }

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  // Calculate time range
  const now = new Date();
  const timeMin = now.toISOString();
  
  const timeMaxDate = new Date();
  timeMaxDate.setDate(timeMaxDate.getDate() + parseInt(timeRange));
  const timeMax = timeMaxDate.toISOString();

  console.log(`📊 Calendar time range: ${timeMin} to ${timeMax}`);

  // Get calendar events
  const eventsResponse = await calendar.events.list({
    calendarId: 'primary',
    timeMin: timeMin,
    timeMax: timeMax,
    maxResults: maxResults, // Already converted to integer above
    singleEvents: singleEvents === 'true',
    orderBy: orderBy
  });

  const events = eventsResponse.data.items || [];
  console.log(`📅 Found ${events.length} calendar events`);

  // Format events for frontend
  const formattedEvents = events.map(event => ({
    id: event.id,
    summary: event.summary || '(No title)',
    description: event.description || '',
    start: event.start,
    end: event.end,
    location: event.location || '',
    attendees: event.attendees || [],
    htmlLink: event.htmlLink || `https://calendar.google.com/calendar/event?eid=${event.id}`
  }));

  const duration = Date.now() - startTime;
  
  return res.status(200).json({
    success: true,
    data: {
      events: formattedEvents,
      totalResults: events.length,
      timeRange: { timeMin, timeMax }
    },
    performance: {
      duration: `${duration}ms`,
      timestamp: new Date().toISOString(),
      eventCount: formattedEvents.length
    }
  });
}

// Handle POST - Convert calendar event to task
async function handleConvertEventToTask(req, res, user) {
  const { eventId, projectId, context, customTitle, customDescription, title, description, priority } = req.body;

  if (!eventId) {
    return res.status(400).json({ 
      success: false, 
      error: 'Event ID is required' 
    });
  }

  console.log(`🔄 Converting Calendar event ${eventId} to task`);

  // Set up Google Calendar API to get event details
  const { google } = await import('googleapis');
  const { OAuth2Client } = await import('google-auth-library');
  
  const authClient = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  authClient.setCredentials({ access_token: user.accessToken });

  const calendar = google.calendar({ version: 'v3', auth: authClient });

  // Get event details
  const eventDetail = await calendar.events.get({
    calendarId: 'primary',
    eventId: eventId
  });

  const event = eventDetail.data;
  
  // Extract event information
  const eventTitle = event.summary || '(No title)';
  const eventDescription = event.description || '';
  const eventLocation = event.location || '';
  const eventStart = event.start?.dateTime || event.start?.date || '';
  const eventEnd = event.end?.dateTime || event.end?.date || '';

  // Create task from calendar event (prioritize AI-enhanced data)
  const taskTitle = title || customTitle || `Calendar: ${eventTitle}`;
  const taskDescription = description || customDescription || 
    `Event: ${eventTitle}\nTime: ${eventStart}${eventEnd && eventEnd !== eventStart ? ` - ${eventEnd}` : ''}\n${eventLocation ? `Location: ${eventLocation}\n` : ''}\n${eventDescription}`;
    
  console.log('🔥 [DEBUG-CALENDAR-BACKEND] Using AI-enhanced data:', { 
    aiTitle: title, 
    aiDescription: description?.substring(0, 100),
    fallbackTitle: `Calendar: ${eventTitle}` 
  });

  // Determine context
  let taskContext = context || '';
  if (!taskContext) {
    // Auto-suggest context based on event content
    const eventText = (eventTitle + ' ' + eventDescription).toLowerCase();
    if (eventText.includes('meeting') || eventText.includes('call')) {
      taskContext = '@meeting';
    } else if (eventText.includes('appointment') || eventText.includes('visit')) {
      taskContext = '@appointment';
    } else {
      taskContext = '@calendar';
    }
  }

  // Set due date based on event start time
  let dueDate = null;
  if (eventStart) {
    try {
      dueDate = new Date(eventStart).toISOString();
    } catch (error) {
      console.warn('Failed to parse event start time:', eventStart);
    }
  }

  // Create task using the existing task creation endpoint
  const taskPayload = {
    title: taskTitle,
    description: taskDescription,
    projectId: projectId || null,
    context: taskContext,
    dueDate: dueDate,
    priority: priority || 'medium', // Include AI-enhanced priority
    attachments: [{
      name: `Calendar Event: ${eventTitle}`,
      url: event.htmlLink || `https://calendar.google.com/calendar/event?eid=${eventId}`,
      type: 'calendar-event'
    }]
  };
  
  console.log('🔥 [DEBUG-CALENDAR-BACKEND] Final task payload:', {
    title: taskPayload.title,
    description: taskPayload.description?.substring(0, 100),
    context: taskPayload.context,
    priority: taskPayload.priority
  });
  
  const taskResponse = await fetch(`${req.headers.host?.includes('localhost') ? 'http://localhost:3000' : 'https://' + req.headers.host}/api/tasks/manage`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': req.headers.authorization
    },
    body: JSON.stringify(taskPayload)
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
      eventDetails: {
        summary: eventTitle,
        start: eventStart,
        end: eventEnd,
        location: eventLocation,
        eventId
      }
    },
    message: 'Calendar event successfully converted to task'
  });
}