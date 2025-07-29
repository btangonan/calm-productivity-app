import { validateGoogleToken } from './utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.authorization;
    const user = await validateGoogleToken(authHeader);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    console.log(`🔍 Debug sheets for user: ${user.email}`);

    // Use Google Sheets API directly with authentication
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Get the projects data
    const projectsResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Projects!A:H'
    });

    const projectRows = projectsResponse.data.values || [];
    
    console.log('📊 Projects sheet raw data:');
    projectRows.forEach((row, index) => {
      console.log(`Row ${index + 1}:`, row);
    });

    // Get sheet metadata
    const sheetResponse = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID
    });

    const sheetsInfo = sheetResponse.data.sheets.map(sheet => ({
      sheetId: sheet.properties.sheetId,
      title: sheet.properties.title,
      index: sheet.properties.index
    }));

    return res.status(200).json({
      success: true,
      data: {
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        sheets: sheetsInfo,
        projects: {
          headers: projectRows[0] || [],
          dataRows: projectRows.slice(1),
          totalRows: projectRows.length
        }
      }
    });

  } catch (error) {
    console.error('Debug sheets error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to debug sheets',
      message: error.message
    });
  }
}