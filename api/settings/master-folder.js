import { validateGoogleToken, getServiceAccountToken } from '../utils/google-auth.js';

// Temporary in-memory cache for performance - but data is persisted in Google Sheets
const userMasterFolders = new Map();

// Export the map so other modules can access it
export { userMasterFolders as masterFolderMap };

// Helper function to get master folder from Google Sheets
export async function getMasterFolderFromSheets(userEmail) {
  try {
    console.log(`📊 Getting master folder from sheets for: ${userEmail}`);
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Get settings from Google Sheets (assuming we have a Settings sheet)
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Settings!A:C', // Columns: email, setting_key, setting_value
    });

    const rows = response.data.values || [];
    if (rows.length <= 1) return null; // No data rows

    // Find master folder setting for this user
    const dataRows = rows.slice(1); // Skip header
    const masterFolderRow = dataRows.find(row => 
      row[0] === userEmail && row[1] === 'master_folder_id'
    );

    if (masterFolderRow && masterFolderRow[2]) {
      console.log(`✅ Found master folder in sheets: ${masterFolderRow[2]}`);
      // Cache it for performance
      userMasterFolders.set(userEmail, masterFolderRow[2]);
      return masterFolderRow[2];
    }

    console.log(`❌ No master folder setting found in sheets for ${userEmail}`);
    return null;
  } catch (error) {
    console.log(`❌ Error getting master folder from sheets:`, error.message);
    return null;
  }
}

// Helper function to save master folder to Google Sheets
async function saveMasterFolderToSheets(userEmail, folderId) {
  try {
    console.log(`📊 Saving master folder to sheets: ${userEmail} -> ${folderId}`);
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // First, check if Settings sheet exists, if not create it
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Settings!A1',
      });
    } catch (sheetError) {
      // Settings sheet doesn't exist, create it
      console.log('📊 Creating Settings sheet...');
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        resource: {
          requests: [{
            addSheet: {
              properties: {
                title: 'Settings'
              }
            }
          }]
        }
      });
      
      // Add header row
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Settings!A1:C1',
        valueInputOption: 'RAW',
        resource: {
          values: [['email', 'setting_key', 'setting_value']]
        }
      });
    }

    // Get existing settings to see if we need to update or append
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Settings!A:C',
    });

    const rows = response.data.values || [['email', 'setting_key', 'setting_value']];
    const dataRows = rows.slice(1);
    
    // Find existing master folder setting for this user
    const existingRowIndex = dataRows.findIndex(row => 
      row[0] === userEmail && row[1] === 'master_folder_id'
    );

    if (existingRowIndex !== -1) {
      // Update existing row
      const actualRowIndex = existingRowIndex + 2; // +1 for header, +1 for 0-based index
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `Settings!C${actualRowIndex}`,
        valueInputOption: 'RAW',
        resource: {
          values: [[folderId]]
        }
      });
      console.log(`✅ Updated existing master folder setting in row ${actualRowIndex}`);
    } else {
      // Append new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Settings!A:C',
        valueInputOption: 'RAW',
        resource: {
          values: [[userEmail, 'master_folder_id', folderId]]
        }
      });
      console.log(`✅ Added new master folder setting`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error saving master folder to sheets:`, error);
    return false;
  }
}

export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      // Get current master folder configuration
      const serviceAccountEmail = 'nowandlater@solid-study-467023-i3.iam.gserviceaccount.com';
      
      // Get stored master folder for this user - first check cache, then sheets
      let currentMasterFolderId = userMasterFolders.get(user.email);
      
      if (!currentMasterFolderId) {
        console.log(`📊 Master folder not in cache, checking sheets for ${user.email}`);
        currentMasterFolderId = await getMasterFolderFromSheets(user.email);
      }
      
      return res.status(200).json({
        success: true,
        data: {
          serviceAccountEmail: serviceAccountEmail,
          message: 'Share your master Drive folder with this email to enable full functionality',
          currentMasterFolderId: currentMasterFolderId,
          note: currentMasterFolderId 
            ? 'Master folder is set and stored persistently in Google Sheets'
            : 'No master folder configured yet'
        }
      });
    }

    if (req.method === 'POST') {
      // Set master folder
      const { folderId } = req.body;
      
      if (!folderId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Folder ID is required' 
        });
      }

      console.log(`📊 Setting master folder for user ${user.email}: ${folderId}`);
      
      // Store folder ID persistently in Google Sheets
      const saved = await saveMasterFolderToSheets(user.email, folderId);
      
      if (saved) {
        // Also store in memory cache for performance
        userMasterFolders.set(user.email, folderId);
        
        console.log(`✅ Master folder stored persistently and cached. Current cache:`, Array.from(userMasterFolders.entries()));
        
        return res.status(200).json({
          success: true,
          data: {
            folderId,
            message: 'Master folder configuration saved persistently in Google Sheets',
            userEmail: user.email
          }
        });
      } else {
        return res.status(500).json({
          success: false,
          error: 'Failed to save master folder configuration'
        });
      }
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Master folder API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process master folder request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}