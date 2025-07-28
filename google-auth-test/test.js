const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const path = require('path');

// --- CONFIGURATION ---
const KEY_FILE_PATH = path.join(__dirname, 'service-account-key.json');
const SPREADSHEET_ID = '1NaVZ4zBLnoXMSskvTyHGbgpxFoazSbEhXG-X8ier9xM'; // Your sheet ID
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
// ---------------------

async function runTest() {
  console.log('Attempting to authenticate with local key file...');

  try {
    const auth = new GoogleAuth({
      keyFile: KEY_FILE_PATH, // Directly use the file
      scopes: SCOPES,
    });

    const authClient = await auth.getClient();
    console.log('✅ Authentication successful.');

    const sheets = google.sheets({ version: 'v4', auth: authClient });
    console.log('Attempting to read from Google Sheet...');

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'A1', // Just try to read a single cell
    });

    console.log('✅ Successfully read from sheet.');
    console.log('Data:', response.data.values);
    console.log('\n🎉 TEST SUCCEEDED! The problem is with the Vercel environment variables.');

  } catch (error) {
    console.error('❌ TEST FAILED.');
    console.error('Error Message:', error.message);
    console.error('\n🤔 DIAGNOSIS: The problem is with your Google Cloud project or sharing settings, not Vercel.');
  }
}

runTest();