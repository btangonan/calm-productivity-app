import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }

    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');

    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const authClient = await auth.getClient();
    const sheets = google.sheets({ version: 'v4', auth: authClient });

    // Check if the user already exists in the sheet
    const usersResponse = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Users!A:B',
    });

    const users = (usersResponse.data.values || []).slice(1);
    const userRow = users.find(row => row[0] === user.email);

    if (userRow) {
      // User exists, update the refresh token
      const rowIndex = users.findIndex(row => row[0] === user.email) + 2;
      await sheets.spreadsheets.values.update({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: `Users!B${rowIndex}`,
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[refreshToken]],
        },
      });
    } else {
      // User does not exist, add a new row
      await sheets.spreadsheets.values.append({
        spreadsheetId: process.env.GOOGLE_SHEETS_ID,
        range: 'Users!A:B',
        valueInputOption: 'USER_ENTERED',
        resource: {
          values: [[user.email, refreshToken]],
        },
      });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Store token error:', error);
    return res.status(500).json({ error: 'Failed to store token' });
  }
}
