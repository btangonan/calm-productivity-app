# Google Apps Script Deployment Debugging Guide

## Current Issue Analysis

Based on the research and code review, here are the likely issues with your Google Apps Script deployment:

### 1. **Deployment Version Management**
- Google Apps Script requires creating **new versions** for changes to appear in production
- Your current URL (`https://script.google.com/macros/s/AKfycbz.../exec`) only serves the last **versioned deployment**
- Changes to Code.gs won't appear until you create a new version

### 2. **Frontend Configuration**
- Your `api.ts` has `isGoogleAppsScript = false`, which means it's using mock data
- This might be intentional due to deployment issues

## Diagnostic Tests

### Test 1: Version Verification Test

Add this to your Code.gs file and redeploy:

```javascript
// Add this at the top of Code.gs
const DEPLOYMENT_VERSION = "v2024.07.25.001"; // Update this each deployment
const LAST_UPDATED = "2024-07-25T12:00:00Z"; // Update timestamp

function doGet(e) {
  // Add version info to GET response
  return ContentService
    .createTextOutput(JSON.stringify({
      success: true,
      message: "Calm Productivity API is running!",
      version: DEPLOYMENT_VERSION,
      lastUpdated: LAST_UPDATED,
      timestamp: new Date().toISOString(),
      testParameter: e.parameter.test || "none"
    }))
    .setMimeType(ContentService.MimeType.JSON);
}
```

**Test URLs:**
- Development: `https://script.google.com/macros/s/AKfycb.../dev?test=development`
- Production: `https://script.google.com/macros/s/AKfycb.../exec?test=production`

### Test 2: Function Call Test

Add this test function to Code.gs:

```javascript
function testFunction() {
  return { 
    success: true, 
    message: "Test function called successfully", 
    version: DEPLOYMENT_VERSION,
    timestamp: new Date().toISOString() 
  };
}

// Update doPost to include test function
function doPost(e) {
  try {
    const functionName = e.parameter.function;
    const parameters = JSON.parse(e.parameter.parameters || '[]');
    
    let result;
    switch (functionName) {
      case 'testFunction':
        result = testFunction();
        break;
      // ... your existing cases
      default:
        result = { success: false, message: `Unknown function: ${functionName}` };
    }
    
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ 
        success: false, 
        message: error.toString(),
        version: DEPLOYMENT_VERSION 
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

### Test 3: Frontend API Test

Create a temporary test page to verify the connection:

```javascript
// Add to your frontend (temporary test)
const testGoogleAppsScript = async () => {
  const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbzScfuEZaIy-kaXeSec93vzw7DbaKfJJHzYEckavbRo37DhtdTYFQ9lP1c6CqHy3EKn/exec';
  
  console.log('Testing Google Apps Script connection...');
  
  try {
    // Test GET request
    const getResponse = await fetch(APPS_SCRIPT_URL + '?test=frontend');
    const getData = await getResponse.json();
    console.log('GET Response:', getData);
    
    // Test POST request
    const formData = new FormData();
    formData.append('function', 'testFunction');
    formData.append('parameters', JSON.stringify([]));
    
    const postResponse = await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      body: formData,
    });
    const postData = await postResponse.json();
    console.log('POST Response:', postData);
    
  } catch (error) {
    console.error('Connection failed:', error);
  }
};

// Call this in browser console
testGoogleAppsScript();
```

## Deployment Update Checklist

### Step 1: Update Code.gs
1. ✅ Update `DEPLOYMENT_VERSION` and `LAST_UPDATED` constants
2. ✅ Add your new functionality
3. ✅ Save the file

### Step 2: Create New Deployment Version
1. ✅ Go to **Deploy → Manage deployments**
2. ✅ Find your existing deployment
3. ✅ Click the pencil icon (Edit)
4. ✅ In Version dropdown, select **"New version"**
5. ✅ Add description: "Updated with version tracking and new features"
6. ✅ Click **Deploy**
7. ✅ Verify URL remains the same

### Step 3: Verify Deployment
1. ✅ Open production URL in new incognito window
2. ✅ Check that version number updated
3. ✅ Test with cache-busting parameter: `?v=${Date.now()}`

### Step 4: Update Frontend
Once deployment is verified working:

```javascript
// In src/services/api.ts, change this:
private isGoogleAppsScript = false; // Change to true

// To this:
private isGoogleAppsScript = true; // Enable Google Apps Script
```

## Common Issues & Solutions

### Issue: "Changes don't appear"
**Solution:** You must create a **new version**, not just save the code

### Issue: "Deployment hangs"
**Solutions:** 
- Try different browser
- Clear cache and cookies
- Use Firefox instead of Chrome
- Check popup blockers

### Issue: "Permission denied"
**Solutions:**
- Re-authorize the script
- Check sharing permissions
- Verify execution permissions are set to "Anyone"

### Issue: "Old responses still showing"
**Solutions:**
- Hard refresh browser (Ctrl+F5)
- Test in incognito mode
- Add cache-busting parameters
- Clear browser cache completely

## Monitoring Deployment Health

Add this to your Code.gs for ongoing monitoring:

```javascript
function getHealthCheck() {
  return {
    success: true,
    version: DEPLOYMENT_VERSION,
    lastUpdated: LAST_UPDATED,
    serverTime: new Date().toISOString(),
    status: "healthy"
  };
}

// Add to doPost switch statement:
case 'getHealthCheck':
  result = getHealthCheck();
  break;
```

Then periodically test:
```bash
curl "https://script.google.com/macros/s/AKfycb.../exec"
```

## Expected Timeline

- **Code changes**: Immediate in Apps Script editor
- **Test deployment (/dev)**: Immediate after save
- **Production deployment (/exec)**: Only after creating new version
- **Browser updates**: May require cache clear/hard refresh