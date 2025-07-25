// Calm Productivity App - Google Apps Script Backend
// This script manages the Google Sheets database and Google Drive integration

const SPREADSHEET_ID = '1NaVZ4zBLnoXMSskvTyHGbgpxFoazSbEhXG-X8ier9xM';
const DRIVE_FOLDER_ID = '1qof5IfgXPIUsDFk8cFaBMGEl6VEH1qAG'; // Parent folder for all project folders
const CALENDAR_ID = 'primary'; // Use primary calendar or specify a custom calendar ID

/**
 * Handle GET requests from the frontend
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: "Calm Productivity API is running!",
      version: "1.0.0"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handle POST requests from the frontend
 */
function doPost(e) {
  try {
    const functionName = e.parameter.function;
    const parameters = JSON.parse(e.parameter.parameters || '[]');
    
    // Call the appropriate function
    let result;
    switch (functionName) {
      case 'getAreas':
        result = getAreas();
        break;
      case 'getProjects':
        result = getProjects(parameters[0]);
        break;
      case 'getTasks':
        result = getTasks(parameters[0], parameters[1]);
        break;
      case 'createProject':
        result = createProject(parameters[0], parameters[1], parameters[2]);
        break;
      case 'createTask':
        result = createTask(parameters[0], parameters[1], parameters[2], parameters[3], parameters[4]);
        break;
      case 'updateTaskCompletion':
        result = updateTaskCompletion(parameters[0], parameters[1]);
        break;
      case 'updateProjectStatus':
        result = updateProjectStatus(parameters[0], parameters[1]);
        break;
      case 'reorderTasks':
        result = reorderTasks(parameters[0]);
        break;
      case 'processGmailToTasks':
        result = processGmailToTasks();
        break;
      case 'syncTasksWithCalendar':
        result = syncTasksWithCalendar();
        break;
      case 'createTaskWithIntegrations':
        result = createTaskWithIntegrations(parameters[0], parameters[1], parameters[2], parameters[3], parameters[4], parameters[5]);
        break;
      case 'createProjectDocument':
        result = createProjectDocument(parameters[0], parameters[1], parameters[2]);
        break;
      case 'getContacts':
        result = getContacts();
        break;
      case 'setupTriggers':
        result = setupTriggers();
        break;
      case 'testIntegrations':
        result = testIntegrations();
        break;
      default:
        result = { success: false, message: `Unknown function: ${functionName}` };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Initialize the Google Sheets database with required tabs and headers
 */
function initializeDatabase() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    
    // Create Areas tab
    let areasSheet = spreadsheet.getSheetByName('Areas');
    if (!areasSheet) {
      areasSheet = spreadsheet.insertSheet('Areas');
      areasSheet.getRange(1, 1, 1, 4).setValues([['ID', 'Name', 'Description', 'CreatedAt']]);
      areasSheet.getRange(1, 1, 1, 4).setFontWeight('bold');
    }
    
    // Create Projects tab
    let projectsSheet = spreadsheet.getSheetByName('Projects');
    if (!projectsSheet) {
      projectsSheet = spreadsheet.insertSheet('Projects');
      projectsSheet.getRange(1, 1, 1, 7).setValues([
        ['ID', 'Name', 'Description', 'AreaID', 'Status', 'DriveFolderURL', 'CreatedAt']
      ]);
      projectsSheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    }
    
    // Create Tasks tab
    let tasksSheet = spreadsheet.getSheetByName('Tasks');
    if (!tasksSheet) {
      tasksSheet = spreadsheet.insertSheet('Tasks');
      tasksSheet.getRange(1, 1, 1, 9).setValues([
        ['ID', 'Title', 'Description', 'ProjectID', 'Context', 'DueDate', 'IsCompleted', 'SortOrder', 'CreatedAt']
      ]);
      tasksSheet.getRange(1, 1, 1, 9).setFontWeight('bold');
    }
    
    return { success: true, message: 'Database initialized successfully' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * CRUD Operations for Areas
 */
function createArea(name, description = '') {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Areas');
    const id = Utilities.getUuid();
    const createdAt = new Date().toISOString();
    
    sheet.appendRow([id, name, description, createdAt]);
    
    return { success: true, data: { id, name, description, createdAt } };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getAreas() {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Areas');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return { success: true, data: [] };
    
    const areas = data.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      createdAt: row[3]
    }));
    
    return { success: true, data: areas };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * CRUD Operations for Projects
 */
function createProject(name, description = '', areaId = null) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const id = Utilities.getUuid();
    const createdAt = new Date().toISOString();
    
    // Create Google Drive folder for this project
    const driveFolderUrl = createProjectFolder(name, id);
    
    sheet.appendRow([id, name, description, areaId, 'Active', driveFolderUrl, createdAt]);
    
    return { 
      success: true, 
      data: { 
        id, 
        name, 
        description, 
        areaId, 
        status: 'Active', 
        driveFolderUrl, 
        createdAt 
      } 
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getProjects(areaId = null) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return { success: true, data: [] };
    
    let projects = data.slice(1).map(row => ({
      id: row[0],
      name: row[1],
      description: row[2],
      areaId: row[3],
      status: row[4],
      driveFolderUrl: row[5],
      createdAt: row[6]
    }));
    
    if (areaId) {
      projects = projects.filter(project => project.areaId === areaId);
    }
    
    return { success: true, data: projects };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateProjectStatus(projectId, status) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === projectId) {
        sheet.getRange(i + 1, 5).setValue(status);
        return { success: true, message: 'Project status updated' };
      }
    }
    
    return { success: false, message: 'Project not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * CRUD Operations for Tasks
 */
function createTask(title, description = '', projectId = null, context = '', dueDate = null) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const id = Utilities.getUuid();
    const createdAt = new Date().toISOString();
    
    // Get the highest sort order for this project/context
    const data = sheet.getDataRange().getValues();
    let maxSortOrder = 0;
    
    if (data.length > 1) {
      const relevantTasks = data.slice(1).filter(row => 
        (projectId ? row[3] === projectId : !row[3])
      );
      maxSortOrder = Math.max(...relevantTasks.map(row => row[7] || 0));
    }
    
    const sortOrder = maxSortOrder + 1;
    
    sheet.appendRow([
      id, title, description, projectId, context, 
      dueDate, false, sortOrder, createdAt
    ]);
    
    return { 
      success: true, 
      data: { 
        id, title, description, projectId, context, 
        dueDate, isCompleted: false, sortOrder, createdAt 
      } 
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getTasks(projectId = null, view = 'all') {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    if (data.length <= 1) return { success: true, data: [] };
    
    let tasks = data.slice(1).map(row => ({
      id: row[0],
      title: row[1],
      description: row[2],
      projectId: row[3],
      context: row[4],
      dueDate: row[5],
      isCompleted: row[6],
      sortOrder: row[7],
      createdAt: row[8]
    }));
    
    // Filter by project if specified
    if (projectId) {
      tasks = tasks.filter(task => task.projectId === projectId);
    }
    
    // Filter by view
    const today = new Date();
    today.setHours(23, 59, 59, 999); // End of today
    
    switch (view) {
      case 'inbox':
        tasks = tasks.filter(task => !task.projectId && !task.isCompleted);
        break;
      case 'today':
        tasks = tasks.filter(task => 
          !task.isCompleted && 
          task.dueDate && 
          new Date(task.dueDate) <= today
        );
        break;
      case 'upcoming':
        tasks = tasks.filter(task => 
          !task.isCompleted && 
          task.dueDate && 
          new Date(task.dueDate) > today
        );
        break;
      case 'anytime':
        tasks = tasks.filter(task => !task.isCompleted && !task.dueDate);
        break;
      case 'logbook':
        tasks = tasks.filter(task => task.isCompleted);
        break;
      default:
        // Return all tasks
        break;
    }
    
    // Sort by sortOrder, then by creation date
    tasks.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
    
    return { success: true, data: tasks };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateTaskCompletion(taskId, isCompleted) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        sheet.getRange(i + 1, 7).setValue(isCompleted);
        return { success: true, message: 'Task completion updated' };
      }
    }
    
    return { success: false, message: 'Task not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateTaskOrder(taskId, newSortOrder) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        sheet.getRange(i + 1, 8).setValue(newSortOrder);
        return { success: true, message: 'Task order updated' };
      }
    }
    
    return { success: false, message: 'Task not found' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function reorderTasks(taskIds) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    // Update sort order for each task
    taskIds.forEach((taskId, index) => {
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === taskId) {
          sheet.getRange(i + 1, 8).setValue(index + 1);
          break;
        }
      }
    });
    
    return { success: true, message: 'Tasks reordered successfully' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Google Drive Integration
 */
function createProjectFolder(projectName, projectId) {
  try {
    const parentFolder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const folderName = `${projectName} (${projectId.substring(0, 8)})`;
    const folder = parentFolder.createFolder(folderName);
    
    return folder.getUrl();
  } catch (error) {
    console.error('Error creating project folder:', error);
    return null;
  }
}

/**
 * Utility function to get project tasks with AI suggestions context
 */
function getProjectWithTasks(projectId) {
  try {
    const projectResult = getProjects();
    if (!projectResult.success) return projectResult;
    
    const project = projectResult.data.find(p => p.id === projectId);
    if (!project) {
      return { success: false, message: 'Project not found' };
    }
    
    const tasksResult = getTasks(projectId);
    if (!tasksResult.success) return tasksResult;
    
    return {
      success: true,
      data: {
        project: project,
        tasks: tasksResult.data
      }
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * GOOGLE SERVICES INTEGRATIONS
 */

/**
 * Gmail Integration - Convert emails to tasks
 */
function processGmailToTasks(query = 'is:unread label:to-task', maxResults = 50) {
  try {
    const threads = Gmail.Users.Threads.list('me', {
      q: query,
      maxResults: maxResults
    });

    const tasks = [];
    
    if (threads.threads) {
      threads.threads.forEach(thread => {
        const threadDetails = Gmail.Users.Threads.get('me', thread.id);
        const firstMessage = threadDetails.messages[0];
        
        const subject = getHeaderValue(firstMessage.payload.headers, 'Subject');
        const sender = getHeaderValue(firstMessage.payload.headers, 'From');
        const date = getHeaderValue(firstMessage.payload.headers, 'Date');
        
        // Create task from email
        const taskTitle = `Email: ${subject}`;
        const taskDescription = `From: ${sender}\nDate: ${date}\nGmail Thread: ${thread.id}`;
        
        const newTask = createTask(taskTitle, taskDescription, null, '@email');
        if (newTask.success) {
          tasks.push(newTask.data);
          
          // Mark email as processed by removing the label
          Gmail.Users.Threads.modify('me', thread.id, {
            removeLabelIds: [getLabelId('to-task')]
          });
        }
      });
    }
    
    return { success: true, data: tasks };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function getHeaderValue(headers, name) {
  const header = headers.find(h => h.name === name);
  return header ? header.value : '';
}

function getLabelId(labelName) {
  try {
    const labels = Gmail.Users.Labels.list('me');
    const label = labels.labels.find(l => l.name === labelName);
    return label ? label.id : null;
  } catch (error) {
    console.error('Error getting label ID:', error);
    return null;
  }
}

/**
 * Google Calendar Integration
 */
function createCalendarEvent(taskId, title, dueDate, description = '') {
  try {
    if (!dueDate) return { success: false, message: 'Due date required for calendar event' };
    
    const startTime = new Date(dueDate);
    const endTime = new Date(startTime.getTime() + (60 * 60 * 1000)); // 1 hour duration
    
    const event = {
      summary: title,
      description: `${description}\n\nTask ID: ${taskId}`,
      start: {
        dateTime: startTime.toISOString(),
        timeZone: Session.getScriptTimeZone()
      },
      end: {
        dateTime: endTime.toISOString(),
        timeZone: Session.getScriptTimeZone()
      },
      extendedProperties: {
        shared: {
          taskId: taskId,
          source: 'calm-productivity'
        }
      }
    };
    
    const createdEvent = Calendar.Events.insert(event, CALENDAR_ID);
    
    return { 
      success: true, 
      data: { 
        eventId: createdEvent.id,
        eventUrl: createdEvent.htmlLink 
      } 
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function updateCalendarEvent(eventId, title, dueDate, description = '') {
  try {
    const startTime = new Date(dueDate);
    const endTime = new Date(startTime.getTime() + (60 * 60 * 1000));
    
    const event = Calendar.Events.get(CALENDAR_ID, eventId);
    event.summary = title;
    event.description = description;
    event.start.dateTime = startTime.toISOString();
    event.end.dateTime = endTime.toISOString();
    
    Calendar.Events.update(event, CALENDAR_ID, eventId);
    
    return { success: true, message: 'Calendar event updated' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function deleteCalendarEvent(eventId) {
  try {
    Calendar.Events.remove(CALENDAR_ID, eventId);
    return { success: true, message: 'Calendar event deleted' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function syncTasksWithCalendar() {
  try {
    const tasksResult = getTasks();
    if (!tasksResult.success) return tasksResult;
    
    const tasksWithDueDates = tasksResult.data.filter(task => 
      task.dueDate && !task.isCompleted
    );
    
    const syncResults = [];
    
    tasksWithDueDates.forEach(task => {
      // Check if calendar event already exists
      const existingEvents = Calendar.Events.list(CALENDAR_ID, {
        q: `Task ID: ${task.id}`,
        maxResults: 1
      });
      
      if (existingEvents.items && existingEvents.items.length > 0) {
        // Update existing event
        const eventId = existingEvents.items[0].id;
        const result = updateCalendarEvent(eventId, task.title, task.dueDate, task.description);
        syncResults.push({ taskId: task.id, action: 'updated', result });
      } else {
        // Create new event
        const result = createCalendarEvent(task.id, task.title, task.dueDate, task.description);
        syncResults.push({ taskId: task.id, action: 'created', result });
      }
    });
    
    return { success: true, data: syncResults };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Google Docs Integration
 */
function createProjectDocument(projectId, projectName, templateType = 'project-notes') {
  try {
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project) {
      return { success: false, message: 'Project not found' };
    }
    
    // Create document in the project's Drive folder
    const projectFolder = DriveApp.getFolderById(extractFolderIdFromUrl(project.driveFolderUrl));
    
    let docTitle, docContent;
    
    switch (templateType) {
      case 'project-notes':
        docTitle = `${projectName} - Project Notes`;
        docContent = createProjectNotesTemplate(projectName);
        break;
      case 'meeting-notes':
        docTitle = `${projectName} - Meeting Notes`;
        docContent = createMeetingNotesTemplate(projectName);
        break;
      case 'project-plan':
        docTitle = `${projectName} - Project Plan`;
        docContent = createProjectPlanTemplate(projectName);
        break;
      default:
        docTitle = `${projectName} - Document`;
        docContent = '';
    }
    
    // Create the document
    const doc = Docs.Documents.create({
      title: docTitle
    });
    
    // Move to project folder
    const file = DriveApp.getFileById(doc.documentId);
    projectFolder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    
    // Add content if template provided
    if (docContent) {
      Docs.Documents.batchUpdate({
        requests: [{
          insertText: {
            location: { index: 1 },
            text: docContent
          }
        }]
      }, doc.documentId);
    }
    
    return { 
      success: true, 
      data: { 
        documentId: doc.documentId,
        documentUrl: `https://docs.google.com/document/d/${doc.documentId}/edit`
      } 
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

function createProjectNotesTemplate(projectName) {
  return `# ${projectName} - Project Notes

## Project Overview
- **Start Date:** ${new Date().toDateString()}
- **Status:** Active
- **Key Stakeholders:** 

## Objectives
- [ ] 
- [ ] 
- [ ] 

## Current Progress
### Completed
- 

### In Progress
- 

### Next Steps
- 
- 
- 

## Meeting Notes

### ${new Date().toDateString()}
- 

## Resources & Links
- 

## Notes & Ideas
- `;
}

function createMeetingNotesTemplate(projectName) {
  return `# ${projectName} - Meeting Notes

## Meeting Details
- **Date:** ${new Date().toDateString()}
- **Time:** 
- **Attendees:** 
- **Meeting Type:** 

## Agenda
1. 
2. 
3. 

## Discussion Points
### Topic 1
- 

### Topic 2
- 

## Action Items
- [ ] [Person] - Task description - Due: 
- [ ] [Person] - Task description - Due: 

## Decisions Made
- 

## Next Meeting
- **Date:** 
- **Agenda Items:** `;
}

function createProjectPlanTemplate(projectName) {
  return `# ${projectName} - Project Plan

## Project Information
- **Project Name:** ${projectName}
- **Start Date:** ${new Date().toDateString()}
- **Target Completion:** 
- **Project Manager:** 
- **Status:** Planning

## Project Scope
### In Scope
- 
- 
- 

### Out of Scope
- 
- 

## Milestones
1. **Milestone 1** - Target Date: 
   - Deliverables:
   - Success Criteria:

2. **Milestone 2** - Target Date: 
   - Deliverables:
   - Success Criteria:

## Resources Required
- **Team Members:** 
- **Budget:** 
- **Tools/Software:** 

## Risk Assessment
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|---------|-------------------|
|      | Low/Med/High| Low/Med/High|                |

## Success Metrics
- 
- 
- `;
}

function extractFolderIdFromUrl(url) {
  const match = url.match(/folders\/([a-zA-Z0-9-_]+)/);
  return match ? match[1] : null;
}

/**
 * Google Contacts Integration
 */
function getContacts() {
  try {
    const connections = People.People.Connections.list('people/me', {
      personFields: 'names,emailAddresses',
      pageSize: 100
    });
    
    const contacts = [];
    
    if (connections.connections) {
      connections.connections.forEach(person => {
        if (person.names && person.names.length > 0) {
          const name = person.names[0].displayName;
          const email = person.emailAddresses && person.emailAddresses.length > 0 
            ? person.emailAddresses[0].value 
            : '';
          
          contacts.push({
            name: name,
            email: email,
            resourceName: person.resourceName
          });
        }
      });
    }
    
    return { success: true, data: contacts };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Automated Triggers and Workflows
 */
function setupTriggers() {
  try {
    // Delete existing triggers
    const triggers = ScriptApp.getProjectTriggers();
    triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
    
    // Gmail trigger - check for new emails every 5 minutes
    ScriptApp.newTrigger('processGmailToTasks')
      .timeBased()
      .everyMinutes(5)
      .create();
    
    // Calendar sync trigger - sync tasks with calendar every hour
    ScriptApp.newTrigger('syncTasksWithCalendar')
      .timeBased()
      .everyHours(1)
      .create();
    
    return { success: true, message: 'Triggers set up successfully' };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Enhanced Task Functions with Google Integration
 */
function createTaskWithIntegrations(title, description = '', projectId = null, context = '', dueDate = null, createCalendarEvent = false) {
  try {
    // Create the task first
    const taskResult = createTask(title, description, projectId, context, dueDate);
    if (!taskResult.success) return taskResult;
    
    const task = taskResult.data;
    const integrations = {};
    
    // Create calendar event if requested and due date exists
    if (createCalendarEvent && dueDate) {
      const calendarResult = createCalendarEvent(task.id, title, dueDate, description);
      integrations.calendar = calendarResult;
    }
    
    return { 
      success: true, 
      data: { 
        task: task,
        integrations: integrations
      } 
    };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}

/**
 * Test function to verify all integrations
 */
function testIntegrations() {
  console.log('Testing Google Services Integrations...');
  
  const results = {};
  
  try {
    // Test Sheets access
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    results.sheets = '✓ Sheets access working';
    
    // Test Drive access
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    results.drive = '✓ Drive access working';
    
    // Test Gmail access
    try {
      Gmail.Users.Labels.list('me');
      results.gmail = '✓ Gmail access working';
    } catch (e) {
      results.gmail = '✗ Gmail access failed: ' + e.toString();
    }
    
    // Test Calendar access
    try {
      Calendar.CalendarList.list();
      results.calendar = '✓ Calendar access working';
    } catch (e) {
      results.calendar = '✗ Calendar access failed: ' + e.toString();
    }
    
    // Test Docs access
    try {
      Docs.Documents.create({ title: 'Test Doc' });
      results.docs = '✓ Docs access working';
    } catch (e) {
      results.docs = '✗ Docs access failed: ' + e.toString();
    }
    
    // Test Contacts access
    try {
      People.People.Connections.list('people/me', { pageSize: 1 });
      results.contacts = '✓ Contacts access working';
    } catch (e) {
      results.contacts = '✗ Contacts access failed: ' + e.toString();
    }
    
    return { success: true, data: results };
  } catch (error) {
    return { success: false, message: error.toString() };
  }
}