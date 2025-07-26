# Google Apps Script Deployment & Debugging Guide

This comprehensive guide covers everything about Google Apps Script deployment issues, based on research and practical testing for web app backends.

## Table of Contents
- [Understanding the Problem](#understanding-the-problem)
- [Core Concepts](#core-concepts)
- [Common Issues & Root Causes](#common-issues--root-causes)
- [Deployment Best Practices](#deployment-best-practices)
- [Testing & Debugging Strategy](#testing--debugging-strategy)
- [Step-by-Step Solutions](#step-by-step-solutions)
- [Troubleshooting Checklist](#troubleshooting-checklist)

## Understanding the Problem

### The Main Issue
**Google Apps Script deployments don't automatically update when you modify Code.gs**. Changes only appear in production after creating a new deployment version.

### Why This Happens
- Google Apps Script uses a **versioning system** for deployments
- The production URL (`/exec`) serves only the **last versioned deployment**
- Code changes are immediately available in the **development URL** (`/dev`) but not production
- Many developers expect changes to appear automatically (like traditional web servers)

## Core Concepts

### URL Types
```
Development URL (immediate updates):
https://script.google.com/macros/s/{SCRIPT_ID}/dev

Production URL (versioned deployments only):
https://script.google.com/macros/s/{SCRIPT_ID}/exec
```

### Version Management
- **HEAD deployment**: Shows latest saved code (development only)
- **Versioned deployment**: Frozen snapshot for production use
- **Maximum versions**: 200 per script project (enforced since 2024)

### Deployment Types
- **Test deployment**: Use for development and testing
- **New deployment**: Create for production use
- **Manage deployments**: Update existing deployments with new versions

## Common Issues & Root Causes

### 1. **Version Management Misunderstanding** (Most Common)
- **Problem**: Expecting changes to appear automatically in production
- **Cause**: Using old deployment URLs without creating new versions
- **Solution**: Always create new versions for production updates

### 2. **URL Confusion**
- **Problem**: Using wrong URL type for intended purpose
- **Cause**: Mixing up `/dev` and `/exec` endpoints
- **Solution**: Use `/dev` for testing, `/exec` for production

### 3. **Browser Caching**
- **Problem**: Old responses still showing after deployment
- **Cause**: Client-side caching of HTML, CSS, JavaScript
- **Solution**: Hard refresh, incognito mode, cache-busting parameters

### 4. **Deployment Process Errors**
- **Problem**: Deployment appears to succeed but changes don't show
- **Cause**: Not following proper deployment update process
- **Solution**: Use "Manage deployments" → "New version" workflow

### 5. **Permissions & Access Issues**
- **Problem**: Deployment fails silently or returns errors
- **Cause**: Incorrect execution permissions or sharing settings
- **Solution**: Verify "Execute as" and "Who has access" settings

## Deployment Best Practices

### Code Organization

```javascript
// Add version tracking at the top of Code.gs
const DEPLOYMENT_VERSION = "v2024.07.25.001"; // Update with each deployment
const LAST_UPDATED = "2024-07-25T20:00:00Z";   // Update timestamp

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: "API is running!",
      version: DEPLOYMENT_VERSION,
      lastUpdated: LAST_UPDATED,
      serverTime: new Date().toISOString(),
      cacheBuster: Math.random().toString(36).substr(2, 9)
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Deployment Strategy

#### For Development/Testing
- Use HEAD deployments or test deployment URLs (ending in `/dev`)
- Changes appear immediately after saving
- Only accessible to script editors

#### For Production
- Always use versioned deployments for public-facing applications
- Create new versions for each update
- URL remains stable across versions

### Version Naming Convention
```javascript
const DEPLOYMENT_VERSION = "v{YEAR}.{MONTH}.{DAY}.{BUILD}";
// Example: "v2024.07.25.001"
```

## Testing & Debugging Strategy

### Built-in Diagnostic Functions

Add these functions to your Code.gs for testing:

```javascript
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
      status: "healthy"
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
```

### Browser Console Testing

```javascript
// Quick deployment test
fetch('https://script.google.com/macros/s/{SCRIPT_ID}/exec?test=console')
  .then(r => r.json())
  .then(d => console.log('Deployment response:', d));

// Test POST function
const formData = new FormData();
formData.append('function', 'testFunction');
formData.append('parameters', JSON.stringify([]));

fetch('https://script.google.com/macros/s/{SCRIPT_ID}/exec', {
  method: 'POST',
  body: formData,
})
.then(r => r.json())
.then(d => console.log('Function test:', d));
```

### Multi-Window Testing Setup

For efficient debugging, use this window setup:
1. **Code Editor**: Apps Script editor for making changes
2. **Test Deployment**: Browser tab with `/dev` URL for immediate testing  
3. **Production Deployment**: Browser tab with `/exec` URL for version testing
4. **Console/Logs**: Browser DevTools or logging spreadsheet

### Network Debugging

Use browser DevTools Network tab to check:
- **304 responses**: Indicates caching (need hard refresh)
- **Correct URL**: Verify `/exec` vs `/dev` endpoint
- **Response headers**: Check cache control settings
- **Request payload**: Verify parameters are sent correctly

## Step-by-Step Solutions

### Deployment Update Process (Recommended)

#### Step 1: Prepare Code Changes
```javascript
// 1. Update version constants in Code.gs
const DEPLOYMENT_VERSION = "v2024.07.25.002"; // Increment version
const LAST_UPDATED = new Date().toISOString(); // Current timestamp

// 2. Make your functional changes
// 3. Save the file (Ctrl+S or Cmd+S)
```

#### Step 2: Create New Version
1. ✅ Go to **Deploy → Manage deployments**
2. ✅ Find your active deployment
3. ✅ Click the **pencil icon** (edit deployment)
4. ✅ In Version dropdown, select **"New version"**
5. ✅ Add version description (optional but recommended)
6. ✅ Click **"Deploy"**
7. ✅ Verify the URL remains the same

#### Step 3: Verify Deployment
```javascript
// Test in browser console or new incognito window
fetch('https://script.google.com/macros/s/{SCRIPT_ID}/exec?v=' + Date.now())
  .then(r => r.json())
  .then(d => {
    console.log('Version:', d.version);
    console.log('Updated:', d.lastUpdated);
    console.log('Server Time:', d.serverTime);
  });
```

### Alternative: New Deployment Process

If updating existing deployment fails:

#### Step 1: Create New Deployment
1. ✅ Go to **Deploy → New deployment**
2. ✅ Click gear icon → **Web app**
3. ✅ Set description and version
4. ✅ Set **Execute as**: "Me"
5. ✅ Set **Who has access**: "Anyone" (for public APIs)
6. ✅ Click **"Deploy"**
7. ✅ Copy the new URL

#### Step 2: Update Frontend
```javascript
// Update your API URL in frontend code
const APPS_SCRIPT_URL = 'NEW_DEPLOYMENT_URL_HERE';
```

#### Step 3: Archive Old Deployment
1. ✅ Go to **Deploy → Manage deployments**
2. ✅ Find old deployment
3. ✅ Click **Archive** (don't delete - breaks existing URLs)

## Troubleshooting Checklist

### ✅ Pre-Deployment Checklist

- [ ] Code changes saved in Apps Script editor
- [ ] Version constants updated (`DEPLOYMENT_VERSION`, `LAST_UPDATED`)
- [ ] Functions tested in Apps Script editor (Run button)
- [ ] No syntax errors in code
- [ ] Required permissions granted

### ✅ Deployment Process Checklist

- [ ] Used **"Manage deployments"** not "New deployment"
- [ ] Selected **"New version"** from dropdown
- [ ] Verified URL remained the same after deployment
- [ ] No error messages during deployment process
- [ ] Deployment completed successfully (no hanging spinners)

### ✅ Verification Checklist

- [ ] Tested in **incognito/private browser** window
- [ ] Used **cache-busting parameters** (`?v=${Date.now()}`)
- [ ] Verified **version number updated** in response
- [ ] Tested both **GET and POST** requests
- [ ] Checked **browser DevTools Network** tab for errors

### ✅ If Still Not Working

- [ ] Try **different browser** (Firefox vs Chrome)
- [ ] Clear **browser cache completely**
- [ ] Test **development URL** (`/dev`) vs **production URL** (`/exec`)
- [ ] Create **completely new deployment**
- [ ] Check **Apps Script quotas** and limits
- [ ] Verify **Google account permissions**

## Advanced Debugging Techniques

### Logging Solutions

Since `console.log()` doesn't work in web apps:

```javascript
// Option 1: Use Cloud Logging
function doGet(e) {
  console.log("Web app accessed:", new Date()); // View in Cloud Console
  // Your code here
}

// Option 2: Log to Spreadsheet
function logToSheet(message) {
  const sheet = SpreadsheetApp.openById('YOUR_LOG_SHEET_ID').getActiveSheet();
  sheet.appendRow([new Date(), message]);
}

// Option 3: Return debugging info in response
function doGet(e) {
  const debugInfo = {
    timestamp: new Date().toISOString(),
    parameters: e.parameter,
    version: DEPLOYMENT_VERSION,
    // Add other debug data
  };
  
  return ContentService
    .createTextOutput(JSON.stringify(debugInfo))
    .setMimeType(ContentService.MimeType.JSON);
}
```

### Error Handling & Reporting

```javascript
function doPost(e) {
  try {
    // Your main logic here
    const result = processRequest(e);
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: result,
        version: DEPLOYMENT_VERSION,
        timestamp: new Date().toISOString()
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    // Detailed error reporting
    const errorInfo = {
      success: false,
      error: error.toString(),
      stack: error.stack,
      version: DEPLOYMENT_VERSION,
      timestamp: new Date().toISOString(),
      parameters: e.parameter
    };
    
    // Log error to sheet for monitoring
    logToSheet(`ERROR: ${error.toString()}`);
    
    return ContentService
      .createTextOutput(JSON.stringify(errorInfo))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Performance Monitoring

```javascript
function doPost(e) {
  const startTime = Date.now();
  
  try {
    const result = processRequest(e);
    const executionTime = Date.now() - startTime;
    
    return ContentService
      .createTextOutput(JSON.stringify({
        success: true,
        data: result,
        performance: {
          executionTime: `${executionTime}ms`,
          timestamp: new Date().toISOString()
        },
        version: DEPLOYMENT_VERSION
      }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch (error) {
    const executionTime = Date.now() - startTime;
    // Error handling with performance data
  }
}
```

## Common Deployment Scenarios

### Scenario 1: First-Time Deployment
```
Problem: New to Google Apps Script, need to deploy web app
Solution: Use "New deployment" → Web app → Set permissions → Deploy
Expected: New URL ending in /exec
```

### Scenario 2: Code Changes Not Appearing
```
Problem: Modified Code.gs but changes don't show in production
Solution: "Manage deployments" → Edit → "New version" → Deploy  
Expected: Same URL, updated responses with new version number
```

### Scenario 3: Deployment Hangs/Fails
```
Problem: Deployment process gets stuck or fails silently
Solution: Try different browser, clear cache, check permissions
Expected: Deployment completes with success message
```

### Scenario 4: Permission Errors
```
Problem: "Authorization required" or access denied errors
Solution: Re-authorize script, check "Execute as" and "Who has access"
Expected: API responds normally without permission prompts
```

### Scenario 5: Old Responses Cached
```
Problem: Deployment succeeded but still getting old responses
Solution: Hard refresh (Ctrl+F5), incognito mode, cache-busting parameters
Expected: New responses with updated version/data
```

## Monitoring & Maintenance

### Regular Health Checks

Set up automated monitoring:

```javascript
// Add to your Code.gs
function getSystemStatus() {
  return {
    version: DEPLOYMENT_VERSION,
    lastUpdated: LAST_UPDATED,
    serverTime: new Date().toISOString(),
    status: "operational",
    uptime: Date.now(), // Or calculate actual uptime
    checks: {
      database: testDatabaseConnection(),
      drive: testDriveAccess(),
      calendar: testCalendarAccess()
    }
  };
}
```

### Deployment Log

Keep a deployment history:

```markdown
## Deployment History

### v2024.07.25.003 - 2024-07-25 20:30 UTC
- Added version tracking and diagnostic functions
- Enhanced error handling and logging
- Fixed parameter passing issues

### v2024.07.25.002 - 2024-07-25 18:15 UTC  
- Updated file management APIs
- Added Google Drive integration
- Bug fixes for task creation

### v2024.07.25.001 - 2024-07-25 12:00 UTC
- Initial deployment with basic CRUD operations
- Google Sheets integration
- Basic error handling
```

### Quota Monitoring

Monitor your usage limits:

```javascript
function getQuotaStatus() {
  const quotas = {
    // Google Apps Script has various quotas
    emailsPerDay: 100, // Example limits
    driveFilesPerDay: 1000,
    executionTimePerDay: 21600 // 6 hours in seconds
  };
  
  return {
    success: true,
    quotas: quotas,
    // Add actual usage tracking if needed
    timestamp: new Date().toISOString()
  };
}
```

## Integration with Frontend Applications

### React/TypeScript Integration

```typescript
// api.ts
class ApiService {
  private readonly APPS_SCRIPT_URL = 'YOUR_DEPLOYMENT_URL_HERE';
  private readonly isProduction = true; // Toggle for testing
  
  async executeGoogleScript<T>(functionName: string, ...params: any[]): Promise<T> {
    if (!this.isProduction) {
      return this.getMockData<T>(functionName, ...params);
    }
    
    try {
      const formData = new FormData();
      formData.append('function', functionName);
      formData.append('parameters', JSON.stringify(params));
      
      const response = await fetch(this.APPS_SCRIPT_URL, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.message || 'Unknown error from Apps Script');
      }
      
      return result.data;
    } catch (error) {
      console.error('Apps Script request failed:', error);
      throw error;
    }
  }
  
  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.executeGoogleScript('getHealthCheck');
      return result.status === 'healthy';
    } catch {
      return false;
    }
  }
}
```

### Environment Configuration

```typescript
// config.ts
const config = {
  development: {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/{SCRIPT_ID}/dev',
    USE_MOCK_DATA: true
  },
  production: {
    APPS_SCRIPT_URL: 'https://script.google.com/macros/s/{SCRIPT_ID}/exec',
    USE_MOCK_DATA: false
  }
};

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env as keyof typeof config];
};
```

## Security Best Practices

### Access Control
```javascript
// In Code.gs - Add basic authentication if needed
function doPost(e) {
  // Optional: Add API key validation
  const apiKey = e.parameter.apiKey;
  if (REQUIRE_API_KEY && apiKey !== VALID_API_KEY) {
    return ContentService
      .createTextOutput(JSON.stringify({
        success: false,
        message: 'Invalid API key'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  // Continue with normal processing
}
```

### Data Validation
```javascript
function validateInput(data, schema) {
  // Add input validation logic
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid input data');
  }
  
  // Validate required fields
  for (const field of schema.required || []) {
    if (!(field in data)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  return true;
}
```

## Final Notes

### Key Takeaways
1. **Always create new versions** for production updates
2. **Use version tracking** in your code for debugging
3. **Test thoroughly** before and after deployment
4. **Monitor deployments** with health checks
5. **Document changes** and maintain deployment history

### When to Use Google Apps Script
✅ **Good for:**
- Rapid prototyping and development
- Google Workspace integrations
- Simple CRUD APIs
- Serverless applications
- Small to medium scale applications

❌ **Consider alternatives for:**
- High-traffic applications (quotas and limits)
- Real-time applications (execution time limits)
- Complex business logic (debugging limitations)
- Applications requiring advanced infrastructure

### Resources
- [Google Apps Script Documentation](https://developers.google.com/apps-script)
- [Apps Script Quotas and Limits](https://developers.google.com/apps-script/guides/services/quotas)
- [Web Apps Guide](https://developers.google.com/apps-script/guides/web)
- [Deployment Documentation](https://developers.google.com/apps-script/concepts/deployments)

---

*This guide is based on practical experience and research as of July 2024. Google Apps Script features and processes may change over time.*