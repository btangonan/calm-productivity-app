// Calm Productivity App - Google Apps Script Backend
// This script manages the Google Sheets database and Google Drive integration

// DEPLOYMENT TRACKING - UPDATE THESE WITH EACH DEPLOYMENT
const DEPLOYMENT_VERSION = "v2024.07.29.005-PERFORMANCE-BOOST";
const SCRIPT_VERSION = "4.0.0"; // Major version bump for performance improvements
const LAST_UPDATED = "2024-07-29T04:00:00Z";

// CORS configuration
const ALLOWED_ORIGIN = '*'; // For production, use 'https://nowandlater.vercel.app'

const SPREADSHEET_ID = '1NaVZ4zBLnoXMSskvTyHGbgpxFoazSbEhXG-X8ier9xM';
const DRIVE_FOLDER_ID = '1qof5IfgXPIUsDFk8cFaBMGEl6VEH1qAG'; // Master folder for the app (user configurable)
const CALENDAR_ID = 'primary'; // Use primary calendar or specify a custom calendar ID

// Folder structure constants
const UNORGANIZED_PROJECTS_FOLDER = 'Unorganized Projects';
const TASKS_SUBFOLDER = 'Tasks';

/**
 * Handle GET requests from the frontend
 */
function doGet(e) {
  let result;
  try {
    // Robustly get functionName and parameters from e.parameter or e.parameters
    const functionName = e.parameter.function || (e.parameters.function && e.parameters.function[0]);
    let parameters = [];
    if (e.parameter.parameters) {
      try {
        parameters = JSON.parse(e.parameter.parameters);
      } catch (err) {
        console.warn("Could not parse parameters from query string (e.parameter.parameters):", e.parameter.parameters, err);
      }
    } else if (e.parameters.parameters && e.parameters.parameters[0]) {
      try {
        parameters = JSON.parse(e.parameters.parameters[0]);
      } catch (err) {
        console.warn("Could not parse parameters from query string array (e.parameters.parameters[0]):", e.parameters.parameters[0], err);
      }
    }

    const authToken = e.parameter.token; // Retrieve token from query parameter

    let userInfo = null;
    if (authToken) {
      try {
        userInfo = verifyGoogleToken(authToken);
        console.log('Authenticated user (GET):', userInfo ? userInfo.email : 'Token verification failed');
      } catch (error) {
        console.warn('Token verification failed (GET):', error);
      }
    }

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
      case 'getContacts':
        result = getContacts();
        break;
      case 'getProjectFiles':
        result = getProjectFiles(parameters[0]);
        break;
      case 'getDriveStructure':
        result = getDriveStructure();
        break;
      case 'getFolderFiles':
        result = getFolderFiles(parameters[0]);
        break;
      case 'listDriveFiles':
        result = listDriveFiles(parameters[0]);
        break;
      case 'searchDriveFiles':
        result = searchDriveFiles(parameters[0]);
        break;
      case 'getFilePath':
        result = getFilePath(parameters[0]);
        break;
      case 'getProjectFolderId':
        result = getProjectFolderId(parameters[0]);
        break;
      case 'loadAppData':
        result = loadAppData();
        break;
      case 'healthCheck':
        result = {
          success: true,
          message: "API is healthy! (GET)",
          version: DEPLOYMENT_VERSION,
          scriptVersion: SCRIPT_VERSION,
          authenticated: !!authToken,
          userEmail: userInfo ? userInfo.email : null,
        };
        break;
      default:
        result = { success: false, message: `Unknown GET function: '${functionName}'` };
        break;
    }
  } catch (error) {
    result = { success: false, message: error.toString(), stack: error.stack };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Handles HTTP OPTIONS requests for CORS preflight.
 * This function's only job is to exist and return a valid TextOutput.
 * The Google Apps Script platform will see it and automatically handle the
 * OPTIONS preflight request by adding the necessary CORS headers.
 */
function doOptions(e) {
  return ContentService.createTextOutput();
}

/**
 * Handle POST requests from the frontend
 */
function doPost(e) {
  let result;
  try {
    const payload = JSON.parse(e.postData.contents);
    const functionName = payload.action;
    const parameters = payload.parameters || [];
    const authToken = payload.token; // Retrieve token from payload

    let userInfo = null;
    if (authToken) {
      try {
        userInfo = verifyGoogleToken(authToken);
        console.log('Authenticated user:', userInfo ? userInfo.email : 'Token verification failed');
      } catch (error) {
        console.warn('Token verification failed:', error);
      }
    }

    switch (functionName) {
      case 'healthCheck':
        result = {
          success: true,
          message: "API is healthy! (POST text/plain)",
          version: DEPLOYMENT_VERSION,
          scriptVersion: SCRIPT_VERSION,
          receivedPayload: payload,
          authenticated: !!authToken,
          userEmail: userInfo ? userInfo.email : null,
        };
        break;
      case 'getAreas':
        result = getAreas();
        break;
      case 'createArea':
        result = createArea(parameters[0], parameters[1]);
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
      case 'updateTask':
        result = updateTask(parameters[0], parameters[1], parameters[2], parameters[3], parameters[4], parameters[5]);
        break;
      case 'updateTaskCompletion':
        result = updateTaskCompletion(parameters[0], parameters[1]);
        break;
      case 'deleteTask':
        result = deleteTask(parameters[0]);
        break;
      case 'deleteProject':
        result = deleteProject(parameters[0]);
        break;
      case 'deleteArea':
        result = deleteArea(parameters[0]);
        break;
      case 'updateProjectStatus':
        result = updateProjectStatus(parameters[0], parameters[1]);
        break;
      case 'updateProjectArea':
        result = updateProjectArea(parameters[0], parameters[1]);
        break;
      case 'updateProjectName':
        result = updateProjectName(parameters[0], parameters[1]);
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
      case 'getProjectFiles':
        result = getProjectFiles(parameters[0]);
        break;
      case 'uploadFileToProject':
        result = uploadFileToProject(parameters[0], parameters[1], parameters[2], parameters[3]);
        break;
      case 'uploadFileToFolder':
        result = uploadFileToFolder(parameters[0], parameters[1], parameters[2], parameters[3]);
        break;
      case 'uploadFileToTask':
        result = uploadFileToTask(parameters[0], parameters[1], parameters[2], parameters[3], parameters[4]);
        break;
      case 'deleteProjectFile':
        result = deleteProjectFile(parameters[0], parameters[1]);
        break;
      case 'listDriveFiles':
        result = listDriveFiles(parameters[0]);
        break;
      case 'searchDriveFiles':
        result = searchDriveFiles(parameters[0]);
        break;
      case 'getFilePath':
        result = getFilePath(parameters[0]);
        break;
      case 'testFunction':
        result = testFunction();
        break;
      case 'getHealthCheck':
        result = getHealthCheck();
        break;
      case 'testDeployment':
        result = testDeployment(parameters[0]);
        break;
      case 'createGoogleDoc':
        result = createGoogleDoc(parameters[0], parameters[1], parameters[2]);
        break;
      case 'createGoogleSheet':
        result = createGoogleSheet(parameters[0], parameters[1], parameters[2]);
        break;
      case 'getServiceAccountEmail':
        result = getServiceAccountEmail();
        break;
      case 'getMasterFolderId':
        result = getMasterFolderId();
        break;
      case 'setMasterFolderId':
        result = setMasterFolderId(parameters[0]);
        break;
      case 'shareFolderWithServiceAccount':
        result = shareFolderWithServiceAccount(parameters[0]);
        break;
      default:
        result = { success: false, message: `Unknown function: '${functionName}'`, version: DEPLOYMENT_VERSION };
        break;
    }
  } catch (error) {
    result = { success: false, message: error.toString(), stack: error.stack };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
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
 * Optimized app loading - get all data in one call
 */
function loadAppData() {
  try {
    console.log('Loading app data in single call...');
    
    // Get all data concurrently (as much as possible)
    const areas = getAreas();
    const projects = getProjects();
    const tasks = getTasks();
    
    if (!areas.success || !projects.success || !tasks.success) {
      return { 
        success: false, 
        message: 'Failed to load app data',
        details: {
          areas: areas.success,
          projects: projects.success,
          tasks: tasks.success
        }
      };
    }
    
    console.log('App data loaded successfully');
    return {
      success: true,
      data: {
        areas: areas.data,
        projects: projects.data,
        tasks: tasks.data,
        loadedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    console.error('Error loading app data:', error);
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
    
    // Create Google Drive folder for the area
    const driveFolderUrl = createAreaFolder(name, id);
    
    sheet.appendRow([id, name, description, createdAt, driveFolderUrl]);
    
    return { success: true, data: { id, name, description, createdAt, driveFolderUrl } };
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
    
    // Create project in spreadsheet immediately (fast response)
    sheet.appendRow([id, name, description, areaId, 'Active', '', createdAt]);
    
    // Start background Drive folder creation (don't wait for it)
    try {
      const driveFolderUrl = createProjectFolder(name, id, areaId);
      // Update the spreadsheet with the folder URL after creation
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (data[i][0] === id) {
          sheet.getRange(i + 1, 6).setValue(driveFolderUrl); // Column F is driveFolderUrl
          break;
        }
      }
    } catch (driveError) {
      console.error('Drive folder creation failed (background):', driveError);
      // Don't fail the entire operation if Drive fails
    }
    
    return { 
      success: true, 
      data: { 
        id, 
        name, 
        description, 
        areaId, 
        status: 'Active', 
        driveFolderUrl: '', // Initially empty, will be updated in background
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

function getProjectFolderId(projectId) {
  try {
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project?.driveFolderUrl) {
      console.warn(`No drive folder URL found for project ${projectId}`);
      return { success: false, message: 'Project folder not found' };
    }
    
    const folderId = extractFolderIdFromUrl(project.driveFolderUrl);
    if (!folderId) {
      console.warn(`Could not extract folder ID from URL: ${project.driveFolderUrl}`);
      return { success: false, message: 'Invalid folder URL format' };
    }
    
    console.log(`Extracted folder ID ${folderId} for project ${projectId}`);
    return { success: true, data: folderId };
  } catch (error) {
    console.error('Error extracting folder ID:', error);
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

function updateProjectArea(projectId, areaId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === projectId) {
        sheet.getRange(i + 1, 4).setValue(areaId); // Column 4 is AreaID
        return { success: true, message: 'Project area updated' };
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

function updateTask(taskId, title, description, projectId, context, dueDate) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    // Find the task row to update
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        // Update the task row (columns: taskId, title, description, projectId, context, dueDate, isCompleted, sortOrder, createdAt)
        sheet.getRange(i + 1, 2).setValue(title); // Column B - title
        sheet.getRange(i + 1, 3).setValue(description || ''); // Column C - description
        sheet.getRange(i + 1, 4).setValue(projectId || ''); // Column D - projectId
        sheet.getRange(i + 1, 5).setValue(context || ''); // Column E - context
        sheet.getRange(i + 1, 6).setValue(dueDate || ''); // Column F - dueDate
        
        // Return the updated task
        const updatedTask = {
          id: taskId,
          title: title,
          description: description || '',
          projectId: projectId || null,
          context: context || '',
          dueDate: dueDate || null,
          isCompleted: data[i][6], // Keep existing completion status
          sortOrder: data[i][7], // Keep existing sort order
          createdAt: data[i][8] // Keep existing creation date
        };
        
        console.log(`Updated task ${taskId}: "${title}"`);
        return { success: true, data: updatedTask };
      }
    }
    
    return { success: false, message: 'Task not found' };
  } catch (error) {
    console.error('Error updating task:', error);
    return { success: false, message: error.toString() };
  }
}

function deleteTask(taskId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    // Find the task row to delete
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === taskId) {
        // Delete the row (i+1 because sheet rows are 1-indexed)
        sheet.deleteRow(i + 1);
        console.log(`Deleted task ${taskId} from row ${i + 1}`);
        return { success: true, message: 'Task deleted successfully' };
      }
    }
    
    return { success: false, message: 'Task not found' };
  } catch (error) {
    console.error('Error deleting task:', error);
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
 * Google Drive Integration - Hierarchical Folder Management
 */

/**
 * Get or create the master app folder structure
 */
function initializeMasterFolderStructure() {
  try {
    const masterFolder = DriveApp.getFolderById(getActualMasterFolderId());
    
    // Create Unorganized Projects folder if it doesn't exist
    let unorganizedFolder = null;
    const folders = masterFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName() === UNORGANIZED_PROJECTS_FOLDER) {
        unorganizedFolder = folder;
        break;
      }
    }
    
    if (!unorganizedFolder) {
      unorganizedFolder = masterFolder.createFolder(UNORGANIZED_PROJECTS_FOLDER);
    }
    
    return {
      masterFolderId: getActualMasterFolderId(),
      unorganizedFolderId: unorganizedFolder.getId()
    };
  } catch (error) {
    console.error('Error initializing master folder structure:', error);
    return null;
  }
}

/**
 * Create or get an Area folder in Google Drive
 */
function createAreaFolder(areaName, areaId) {
  try {
    const masterFolder = DriveApp.getFolderById(getActualMasterFolderId());
    const folderName = `${areaName} (${areaId.substring(0, 8)})`;
    
    // Check if folder already exists
    const folders = masterFolder.getFolders();
    while (folders.hasNext()) {
      const folder = folders.next();
      if (folder.getName() === folderName) {
        return folder.getUrl();
      }
    }
    
    // Create new area folder
    const areaFolder = masterFolder.createFolder(folderName);
    return areaFolder.getUrl();
  } catch (error) {
    console.error('Error creating area folder:', error);
    return null;
  }
}

/**
 * Create a project folder within an area or in unorganized projects
 */
function createProjectFolder(projectName, projectId, areaId = null) {
  try {
    let parentFolder;
    
    if (areaId) {
      // Find the area folder
      const area = getAreas().data.find(a => a.id === areaId);
      if (area && area.driveFolderUrl) {
        const areaFolderId = extractFolderIdFromUrl(area.driveFolderUrl);
        parentFolder = DriveApp.getFolderById(areaFolderId);
      } else {
        // If area doesn't have a folder yet, create it
        const areaFolderUrl = createAreaFolder(area.name, areaId);
        const areaFolderId = extractFolderIdFromUrl(areaFolderUrl);
        parentFolder = DriveApp.getFolderById(areaFolderId);
      }
    } else {
      // Use unorganized projects folder
      const masterFolder = DriveApp.getFolderById(getActualMasterFolderId());
      const folders = masterFolder.getFolders();
      while (folders.hasNext()) {
        const folder = folders.next();
        if (folder.getName() === UNORGANIZED_PROJECTS_FOLDER) {
          parentFolder = folder;
          break;
        }
      }
      if (!parentFolder) {
        parentFolder = masterFolder.createFolder(UNORGANIZED_PROJECTS_FOLDER);
      }
    }
    
    const folderName = `${projectName} (${projectId.substring(0, 8)})`;
    const projectFolder = parentFolder.createFolder(folderName);
    
    // Create Tasks subfolder for task attachments
    projectFolder.createFolder(TASKS_SUBFOLDER);
    
    return projectFolder.getUrl();
  } catch (error) {
    console.error('Error creating project folder:', error);
    return null;
  }
}

/**
 * Get or create Tasks subfolder within a project
 */
function getProjectTasksFolder(projectId) {
  try {
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project || !project.driveFolderUrl) {
      throw new Error('Project or folder not found');
    }
    
    const projectFolderId = extractFolderIdFromUrl(project.driveFolderUrl);
    const projectFolder = DriveApp.getFolderById(projectFolderId);
    
    // Look for existing Tasks folder
    const subfolders = projectFolder.getFolders();
    while (subfolders.hasNext()) {
      const folder = subfolders.next();
      if (folder.getName() === TASKS_SUBFOLDER) {
        return folder;
      }
    }
    
    // Create Tasks folder if it doesn't exist
    return projectFolder.createFolder(TASKS_SUBFOLDER);
  } catch (error) {
    console.error('Error getting project tasks folder:', error);
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
 * Google Docs/Sheets Creation for Project Hub
 */
function createGoogleDoc(projectId, fileName, parentFolderId = null) {
  try {
    const targetFolderId = parentFolderId || getProjectFolderId(projectId).data;
    if (!targetFolderId) {
      return { success: false, message: 'Project folder not found' };
    }
    
    // Validate folder exists and is accessible
    const folder = DriveApp.getFolderById(targetFolderId);
    
    // Create document
    const doc = Docs.Documents.create({ title: fileName });
    const file = DriveApp.getFileById(doc.documentId);
    
    // Move to target folder
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    
    console.log(`Created Google Doc "${fileName}" in folder ${targetFolderId}`);
    
    return { 
      success: true, 
      data: { 
        documentId: doc.documentId,
        documentUrl: `https://docs.google.com/document/d/${doc.documentId}/edit`,
        folderId: targetFolderId,
        fileName: fileName,
        mimeType: 'application/vnd.google-apps.document',
        createdAt: new Date().toISOString()
      } 
    };
  } catch (error) {
    console.error('Error creating Google Doc:', error);
    return { success: false, message: `Failed to create document: ${error.toString()}` };
  }
}

function createGoogleSheet(projectId, fileName, parentFolderId = null) {
  try {
    const targetFolderId = parentFolderId || getProjectFolderId(projectId).data;
    if (!targetFolderId) {
      return { success: false, message: 'Project folder not found' };
    }
    
    const folder = DriveApp.getFolderById(targetFolderId);
    
    // Create spreadsheet
    const sheet = SpreadsheetApp.create(fileName);
    const file = DriveApp.getFileById(sheet.getId());
    
    folder.addFile(file);
    DriveApp.getRootFolder().removeFile(file);
    
    console.log(`Created Google Sheet "${fileName}" in folder ${targetFolderId}`);
    
    return { 
      success: true, 
      data: { 
        documentId: sheet.getId(),
        documentUrl: sheet.getUrl(),
        folderId: targetFolderId,
        fileName: fileName,
        mimeType: 'application/vnd.google-apps.spreadsheet',
        createdAt: new Date().toISOString()
      } 
    };
  } catch (error) {
    console.error('Error creating Google Sheet:', error);
    return { success: false, message: `Failed to create spreadsheet: ${error.toString()}` };
  }
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
    const folder = DriveApp.getFolderById(getActualMasterFolderId());
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

/**
 * File Management Functions
 */

/**
 * Get all files in a project's Drive folder
 */
function getProjectFiles(projectId) {
  try {
    // Get the project to find its Drive folder
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project || !project.driveFolderUrl) {
      return { success: false, message: 'Project or folder not found' };
    }

    const folderId = extractFolderIdFromUrl(project.driveFolderUrl);
    const folder = DriveApp.getFolderById(folderId);
    const files = folder.getFiles();
    
    const fileList = [];
    while (files.hasNext()) {
      const file = files.next();
      fileList.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getBlob().getContentType(),
        size: file.getSize(),
        url: file.getUrl(),
        thumbnailUrl: file.getThumbnail() ? `https://drive.google.com/thumbnail?id=${file.getId()}` : null,
        createdAt: file.getDateCreated().toISOString(),
        modifiedAt: file.getLastUpdated().toISOString()
      });
    }

    return { success: true, data: fileList };
  } catch (error) {
    console.error('Error getting project files:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Upload a file to a project's Drive folder
 * Note: This is a simplified version. In practice, file upload handling in Apps Script
 * requires special handling for multipart/form-data which is more complex.
 */
function uploadFileToProject(projectId, fileName, fileContent, mimeType) {
  try {
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project || !project.driveFolderUrl) {
      return { success: false, message: 'Project or folder not found' };
    }

    const folderId = extractFolderIdFromUrl(project.driveFolderUrl);
    const folder = DriveApp.getFolderById(folderId);
    
    // Create blob from base64 content
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileContent),
      mimeType,
      fileName
    );
    
    // Upload file to project folder
    const file = folder.createFile(blob);
    
    return { 
      success: true, 
      data: {
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getBlob().getContentType(),
        size: file.getSize(),
        url: file.getUrl(),
        thumbnailUrl: file.getBlob().getContentType().startsWith('image/') ? 
          `https://drive.google.com/thumbnail?id=${file.getId()}` : undefined,
        createdAt: file.getDateCreated().toISOString(),
        modifiedAt: file.getLastUpdated().toISOString()
      }
    };
  } catch (error) {
    console.error('Error uploading file to project:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Upload a file to a task (goes in project's Tasks subfolder)
 */
function uploadFileToTask(projectId, taskId, fileName, fileContent, mimeType) {
  try {
    const tasksFolder = getProjectTasksFolder(projectId);
    if (!tasksFolder) {
      return { success: false, message: 'Project tasks folder not found' };
    }
    
    // Create blob from base64 content
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileContent),
      mimeType,
      fileName
    );
    
    // Upload file to tasks folder
    const file = tasksFolder.createFile(blob);
    
    return { 
      success: true, 
      data: {
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getBlob().getContentType(),
        size: file.getSize(),
        url: file.getUrl(),
        thumbnailUrl: file.getBlob().getContentType().startsWith('image/') ? 
          `https://drive.google.com/thumbnail?id=${file.getId()}` : undefined,
        uploadedAt: file.getDateCreated().toISOString(),
        taskId: taskId
      }
    };
  } catch (error) {
    console.error('Error uploading file to task:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Upload a file directly to a specific folder by folder ID
 * Note: This function expects file data in a specific format from the frontend
 */
function uploadFileToFolder(folderId, fileName, fileContent, mimeType) {
  try {
    console.log(`Uploading file to folder: ${folderId}`, { fileName, mimeType });
    
    // Validate folder exists
    const folder = DriveApp.getFolderById(folderId);
    if (!folder) {
      return { success: false, message: 'Folder not found' };
    }
    
    // Create blob from base64 content
    const blob = Utilities.newBlob(
      Utilities.base64Decode(fileContent),
      mimeType,
      fileName
    );
    
    // Upload file to folder
    const file = folder.createFile(blob);
    
    return { 
      success: true, 
      data: {
        id: file.getId(),
        name: file.getName(),
        mimeType: file.getBlob().getContentType(),
        size: file.getSize(),
        url: file.getUrl(),
        driveFileId: file.getId(),
        thumbnailUrl: file.getThumbnail() ? `https://drive.google.com/thumbnail?id=${file.getId()}` : null,
        createdAt: file.getDateCreated().toISOString(),
        modifiedAt: file.getLastUpdated().toISOString()
      }
    };
    
  } catch (error) {
    console.error('Error uploading file to folder:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Delete a file from a project's Drive folder
 */
function deleteProjectFile(projectId, fileId) {
  try {
    // Get the project to find its Drive folder
    const project = getProjects().data.find(p => p.id === projectId);
    if (!project || !project.driveFolderUrl) {
      return { success: false, message: 'Project or folder not found' };
    }

    const folderId = extractFolderIdFromUrl(project.driveFolderUrl);
    const folder = DriveApp.getFolderById(folderId);
    
    // Find and delete the file
    const files = folder.getFiles();
    while (files.hasNext()) {
      const file = files.next();
      if (file.getId() === fileId) {
        file.setTrashed(true);
        return { success: true, data: null };
      }
    }

    return { success: false, message: 'File not found' };
  } catch (error) {
    console.error('Error deleting file:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Diagnostic Functions for Testing Deployment
 */

/**
 * Simple test function to verify deployment is working
 */
function testFunction() {
  return { 
    success: true, 
    message: "Test function called successfully", 
    version: DEPLOYMENT_VERSION,
    lastUpdated: LAST_UPDATED,
    serverTime: new Date().toISOString(),
    randomValue: Math.random()
  };
}

/**
 * Health check function for monitoring
 */
function getHealthCheck() {
  try {
    return {
      success: true,
      version: DEPLOYMENT_VERSION,
      lastUpdated: LAST_UPDATED,
      serverTime: new Date().toISOString(),
      status: "healthy",
      spreadsheetId: SPREADSHEET_ID,
      driveFolderId: getActualMasterFolderId(),
      calendarId: CALENDAR_ID
    };
  } catch (error) {
    return {
      success: false,
      version: DEPLOYMENT_VERSION,
      serverTime: new Date().toISOString(),
      status: "error",
      error: error.toString()
    };
  }
}

/**
 * Test deployment with parameter echo
 */
function testDeployment(testData) {
  return {
    success: true,
    message: "Deployment test successful",
    version: DEPLOYMENT_VERSION,
    lastUpdated: LAST_UPDATED,
    serverTime: new Date().toISOString(),
    receivedData: testData || "no data provided",
    echo: {
      input: testData,
      processed: testData ? `Processed: ${testData}` : "No input to process"
    }
  };
}

/**
 * Verify Google ID token and extract user information
 */
function verifyGoogleToken(idToken) {
  try {
    // In Google Apps Script, we can use the built-in OAuth to verify tokens
    // This is a simplified approach - for production, you might want more robust verification
    
    // Use Google's tokeninfo endpoint to verify the token
    const response = UrlFetchApp.fetch(
      `https://oauth2.googleapis.com/tokeninfo?id_token=${idToken}`,
      {
        method: 'GET',
        muteHttpExceptions: true
      }
    );
    
    if (response.getResponseCode() !== 200) {
      console.error('Token verification failed:', response.getContentText());
      return null;
    }
    
    const tokenInfo = JSON.parse(response.getContentText());
    
    // Verify the token is for our app (optional - add your client ID check here)
    // if (tokenInfo.aud !== 'YOUR_CLIENT_ID') {
    //   console.error('Token audience mismatch');
    //   return null;
    // }
    
    return {
      id: tokenInfo.sub,
      email: tokenInfo.email,
      name: tokenInfo.name,
      picture: tokenInfo.picture,
      verified: true
    };
    
  } catch (error) {
    console.error('Error verifying Google token:', error);
    return null;
  }
}

/**
 * Get user-specific folder or create if doesn't exist
 */
function getUserFolder(userEmail) {
  try {
    // Create a folder structure: Master > Users > [user-email]
    const masterFolder = DriveApp.getFolderById(getActualMasterFolderId());
    
    // Look for Users folder
    let usersFolder;
    const usersFolders = masterFolder.getFoldersByName('Users');
    if (usersFolders.hasNext()) {
      usersFolder = usersFolders.next();
    } else {
      usersFolder = masterFolder.createFolder('Users');
    }
    
    // Look for user-specific folder
    const userFolderName = userEmail.replace('@', '_at_').replace(/[^a-zA-Z0-9_]/g, '_');
    let userFolder;
    const userFolders = usersFolder.getFoldersByName(userFolderName);
    if (userFolders.hasNext()) {
      userFolder = userFolders.next();
    } else {
      userFolder = usersFolder.createFolder(userFolderName);
    }
    
    return userFolder;
  } catch (error) {
    console.error('Error getting user folder:', error);
    return DriveApp.getFolderById(getActualMasterFolderId()); // Fallback to master folder
  }
}

/**
 * List files and folders in Google Drive
 */
function listDriveFiles(folderId = 'root') {
  try {
    let folder;
    
    if (folderId === 'root') {
      folder = DriveApp.getRootFolder();
    } else {
      folder = DriveApp.getFolderById(folderId);
    }
    
    const files = [];
    
    // Get folders
    const folders = folder.getFolders();
    while (folders.hasNext()) {
      const driveFolder = folders.next();
      files.push({
        id: driveFolder.getId(),
        name: driveFolder.getName(),
        mimeType: 'application/vnd.google-apps.folder',
        modifiedTime: driveFolder.getLastUpdated().toISOString(),
        webViewLink: driveFolder.getUrl(),
        isFolder: true,
        parents: [folderId === 'root' ? 'root' : folderId]
      });
    }
    
    // Get files
    const driveFiles = folder.getFiles();
    while (driveFiles.hasNext()) {
      const file = driveFiles.next();
      
      // Safely get mime type - some files (like Google Apps Script) can't be converted to blob
      let mimeType;
      try {
        mimeType = file.getBlob().getContentType();
      } catch (e) {
        // For Google Apps Script files and other special files, use a generic type
        mimeType = 'application/vnd.google-apps.script';
      }
      
      files.push({
        id: file.getId(),
        name: file.getName(),
        mimeType: mimeType,
        size: file.getSize(),
        modifiedTime: file.getLastUpdated().toISOString(),
        webViewLink: file.getUrl(),
        thumbnailLink: mimeType.startsWith('image/') ? 
          `https://drive.google.com/thumbnail?id=${file.getId()}` : undefined,
        isFolder: false,
        parents: [folderId === 'root' ? 'root' : folderId]
      });
    }
    
    // Sort: folders first, then files, both alphabetically
    files.sort((a, b) => {
      if (a.isFolder && !b.isFolder) return -1;
      if (!a.isFolder && b.isFolder) return 1;
      return a.name.localeCompare(b.name);
    });
    
    return { success: true, data: files };
  } catch (error) {
    console.error('Error listing Drive files:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Delete a project from the database
 */
function deleteProject(projectId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const data = sheet.getDataRange().getValues();
    
    // Find the project row to delete
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === projectId) {
        // Delete the row (i+1 because sheet rows are 1-indexed)
        sheet.deleteRow(i + 1);
        console.log(`Deleted project ${projectId} from row ${i + 1}`);
        
        // Also delete all tasks associated with this project
        deleteTasksByProject(projectId);
        
        return { success: true, message: 'Project deleted successfully' };
      }
    }
    
    return { success: false, message: 'Project not found' };
  } catch (error) {
    console.error('Error deleting project:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Delete an area from the database
 */
function deleteArea(areaId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Areas');
    const data = sheet.getDataRange().getValues();
    
    // Find the area row to delete
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === areaId) {
        // Delete the row (i+1 because sheet rows are 1-indexed)
        sheet.deleteRow(i + 1);
        console.log(`Deleted area ${areaId} from row ${i + 1}`);
        
        // Move all projects in this area to unorganized (set areaId to null)
        moveProjectsToUnorganized(areaId);
        
        return { success: true, message: 'Area deleted successfully' };
      }
    }
    
    return { success: false, message: 'Area not found' };
  } catch (error) {
    console.error('Error deleting area:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Helper function to delete all tasks for a project
 */
function deleteTasksByProject(projectId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Tasks');
    const data = sheet.getDataRange().getValues();
    
    // Delete rows from bottom to top to avoid index shifting
    for (let i = data.length - 1; i >= 1; i--) {
      if (data[i][3] === projectId) { // Column 3 is ProjectID
        sheet.deleteRow(i + 1);
        console.log(`Deleted task in project ${projectId} from row ${i + 1}`);
      }
    }
  } catch (error) {
    console.error('Error deleting tasks for project:', error);
  }
}

/**
 * Update project name and sync with Google Drive folder name
 */
function updateProjectName(projectId, newName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const data = sheet.getDataRange().getValues();
    
    // Find the project row
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] === projectId) { // projectId is in column A
        const oldName = data[i][1];
        const driveFolderUrl = data[i][5];
        
        // Update project name in spreadsheet
        sheet.getRange(i + 1, 2).setValue(newName); // Column B (index 1) is name
        
        // Update @project-name tags in all related tasks
        updateProjectTagsInTasks(projectId, oldName, newName);
        
        // Update Google Drive folder name if it exists
        if (driveFolderUrl) {
          try {
            const folderId = extractFolderIdFromUrl(driveFolderUrl);
            const folder = DriveApp.getFolderById(folderId);
            const newFolderName = `${newName} (${projectId.substring(0, 8)})`;
            folder.setName(newFolderName);
            
            console.log(`Updated project "${oldName}" to "${newName}" and synced Drive folder`);
          } catch (folderError) {
            console.error('Error updating Drive folder name:', folderError);
            // Continue anyway - spreadsheet update succeeded
          }
        }
        
        return { 
          success: true, 
          data: {
            id: projectId,
            name: newName,
            description: data[i][2],
            areaId: data[i][3],
            status: data[i][4],
            driveFolderUrl: data[i][5],
            createdAt: data[i][6]
          }
        };
      }
    }
    
    return { success: false, message: 'Project not found' };
  } catch (error) {
    console.error('Error updating project name:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Update @project-name tags in all tasks when project name changes
 */
function updateProjectTagsInTasks(projectId, oldName, newName) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const tasksSheet = spreadsheet.getSheetByName('Tasks');
    const tasksData = tasksSheet.getDataRange().getValues();
    
    const oldTag = `@${oldName.replace(/\s+/g, '-').toLowerCase()}`;
    const newTag = `@${newName.replace(/\s+/g, '-').toLowerCase()}`;
    
    console.log(`Updating project tags from "${oldTag}" to "${newTag}" for project ${projectId}`);
    
    // Find all tasks for this project and update their context
    for (let i = 1; i < tasksData.length; i++) {
      const taskProjectId = tasksData[i][3]; // Column D (index 3) is projectId
      const taskContext = tasksData[i][4]; // Column E (index 4) is context
      
      if (taskProjectId === projectId && taskContext && taskContext.includes(oldTag)) {
        const updatedContext = taskContext.replace(new RegExp(oldTag, 'g'), newTag);
        tasksSheet.getRange(i + 1, 5).setValue(updatedContext); // Update context in column E
        console.log(`Updated task context from "${taskContext}" to "${updatedContext}"`);
      }
    }
    
    console.log(`Completed updating project tags for project ${projectId}`);
  } catch (error) {
    console.error('Error updating project tags in tasks:', error);
  }
}

/**
 * Helper function to move projects to unorganized when area is deleted
 */
function moveProjectsToUnorganized(areaId) {
  try {
    const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = spreadsheet.getSheetByName('Projects');
    const data = sheet.getDataRange().getValues();
    
    for (let i = 1; i < data.length; i++) {
      if (data[i][3] === areaId) { // Column 3 is AreaID
        sheet.getRange(i + 1, 4).setValue(''); // Set AreaID to empty
        console.log(`Moved project ${data[i][0]} to unorganized`);
      }
    }
  } catch (error) {
    console.error('Error moving projects to unorganized:', error);
  }
}

/**
 * Search files across all of Google Drive
 */
function searchDriveFiles(query) {
  try {
    if (!query || query.trim().length < 2) {
      return { success: false, message: 'Search query must be at least 2 characters long' };
    }
    
    // Use Google Drive's search functionality
    // Search in file names and content (for text files)
    const searchQuery = `name contains '${query}' or fullText contains '${query}'`;
    
    console.log('🔍 Searching Google Drive with query:', searchQuery);
    
    const files = [];
    let pageToken = null;
    let totalResults = 0;
    const maxResults = 100; // Limit to prevent too many results
    
    do {
      const searchOptions = {
        q: searchQuery,
        pageSize: Math.min(50, maxResults - totalResults),
        fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, thumbnailLink, parents)',
        orderBy: 'modifiedTime desc'
      };
      
      if (pageToken) {
        searchOptions.pageToken = pageToken;
      }
      
      const response = Drive.Files.list(searchOptions);
      
      if (response.files && response.files.length > 0) {
        response.files.forEach(file => {
          files.push({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType || 'application/octet-stream',
            size: file.size || 0,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            thumbnailLink: file.thumbnailLink,
            isFolder: file.mimeType === 'application/vnd.google-apps.folder',
            parents: file.parents || []
          });
        });
        
        totalResults += response.files.length;
      }
      
      pageToken = response.nextPageToken;
      
    } while (pageToken && totalResults < maxResults);
    
    console.log(`🔍 Found ${files.length} files matching query: ${query}`);
    
    return { success: true, data: files };
  } catch (error) {
    console.error('Error searching Drive files:', error);
    return { success: false, message: `Search failed: ${error.toString()}` };
  }
}

/**
 * Get the full path of a file in Google Drive
 */
function getFilePath(fileId) {
  try {
    if (!fileId || fileId === 'root') {
      return { success: true, data: [{ id: 'root', name: 'My Drive' }] };
    }
    
    const file = DriveApp.getFileById(fileId);
    const parents = file.getParents();
    
    if (!parents.hasNext()) {
      return { success: true, data: [{ id: 'root', name: 'My Drive' }] };
    }
    
    const pathParts = [];
    let currentFolder = parents.next();
    
    // Build path by walking up the hierarchy
    while (currentFolder && currentFolder.getId() !== 'root') {
      pathParts.unshift({
        id: currentFolder.getId(),
        name: currentFolder.getName()
      });
      
      const parentFolders = currentFolder.getParents();
      if (parentFolders.hasNext()) {
        currentFolder = parentFolders.next();
      } else {
        break;
      }
    }
    
    // Add My Drive at the beginning
    pathParts.unshift({ id: 'root', name: 'My Drive' });
    
    return { success: true, data: pathParts };
  } catch (error) {
    console.error('Error getting file path:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Get the service account email
 */
function getServiceAccountEmail() {
  try {
    // This is the known service account email for this app
    const serviceAccountEmail = 'nowandlater@solid-study-467023-i3.iam.gserviceaccount.com';
    
    return { 
      success: true, 
      data: { 
        email: serviceAccountEmail,
        message: 'Share your master Drive folder with this email to enable full functionality'
      } 
    };
  } catch (error) {
    console.error('Error getting service account email:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Get current master folder ID
 */
function getMasterFolderId() {
  try {
    return { success: true, data: { folderId: getActualMasterFolderId() } };
  } catch (error) {
    console.error('Error getting master folder ID:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Set master folder ID (user configurable)
 * This allows users to specify their own master folder
 */
function setMasterFolderId(newFolderId) {
  try {
    if (!newFolderId || typeof newFolderId !== 'string') {
      return { success: false, message: 'Valid folder ID is required' };
    }
    
    // Validate that the folder exists and is accessible
    try {
      const folder = DriveApp.getFolderById(newFolderId);
      folder.getName(); // This will throw if folder doesn't exist or isn't accessible
    } catch (folderError) {
      return { 
        success: false, 
        message: 'Cannot access folder. Make sure the folder exists and is shared with the service account.' 
      };
    }
    
    // For now, we store this in PropertiesService since we can't modify the script constants
    PropertiesService.getScriptProperties().setProperty('MASTER_FOLDER_ID', newFolderId);
    
    return { 
      success: true, 
      data: { 
        folderId: newFolderId,
        message: 'Master folder updated successfully. You may need to redeploy the script for all features to work properly.'
      } 
    };
  } catch (error) {
    console.error('Error setting master folder ID:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Share a folder with the service account
 */
function shareFolderWithServiceAccount(folderId) {
  try {
    if (!folderId || typeof folderId !== 'string') {
      return { success: false, message: 'Valid folder ID is required' };
    }
    
    const serviceAccountEmail = 'nowandlater@solid-study-467023-i3.iam.gserviceaccount.com';
    
    try {
      const folder = DriveApp.getFolderById(folderId);
      
      // Check if already shared
      const editors = folder.getEditors();
      const viewers = folder.getViewers();
      const allUsers = [...editors, ...viewers];
      const isAlreadyShared = allUsers.some(user => user.getEmail() === serviceAccountEmail);
      
      if (isAlreadyShared) {
        return { 
          success: true, 
          data: { 
            message: 'Folder is already shared with the service account',
            folderId: folderId,
            folderName: folder.getName()
          } 
        };
      }
      
      // Share the folder with edit permissions
      folder.addEditor(serviceAccountEmail);
      
      return { 
        success: true, 
        data: { 
          message: 'Folder shared successfully with the service account',
          folderId: folderId,
          folderName: folder.getName(),
          serviceAccountEmail: serviceAccountEmail
        } 
      };
    } catch (folderError) {
      return { 
        success: false, 
        message: 'Cannot access folder. Make sure the folder ID is correct and you have permission to share it.' 
      };
    }
  } catch (error) {
    console.error('Error sharing folder with service account:', error);
    return { success: false, message: error.toString() };
  }
}

/**
 * Get the actual master folder ID (checking PropertiesService first, then falling back to constant)
 */
function getActualMasterFolderId() {
  const customFolderId = PropertiesService.getScriptProperties().getProperty('MASTER_FOLDER_ID');
  return customFolderId || DRIVE_FOLDER_ID;
}