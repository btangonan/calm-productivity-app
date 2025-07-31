import { validateGoogleToken, refreshGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  // Handle different actions based on query parameter
  const { action } = req.query;

  try {
    switch (action) {
      case 'validate':
        return await handleValidate(req, res);
      case 'exchange-code':
        return await handleExchangeCode(req, res);
      case 'store-token':
        return await handleStoreToken(req, res);
      case 'refresh':
        return await handleRefreshToken(req, res);
      default:
        return res.status(400).json({ 
          error: 'Invalid action. Use: validate, exchange-code, store-token, or refresh' 
        });
    }
  } catch (error) {
    console.error(`Auth ${action} error:`, error);
    return res.status(500).json({
      success: false,
      error: `Failed to ${action}`,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

// Token validation (from /api/auth/validate.js)
async function handleValidate(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const user = await validateGoogleToken(req.headers.authorization);
  
  if (!user) {
    return res.status(401).json({ 
      success: false, 
      error: 'Invalid or expired token' 
    });
  }

  return res.status(200).json({
    success: true,
    user: {
      userId: user.userId,
      email: user.email,
      expiresAt: user.expiresAt
    }
  });
}

// OAuth code exchange (from /api/auth/exchange-code.js)
async function handleExchangeCode(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Authorization code is required' });
  }

  // Exchange authorization code for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      code: code,
      grant_type: 'authorization_code',
      redirect_uri: 'postmessage', // For popup flow
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', errorText);
    return res.status(400).json({ 
      error: 'Failed to exchange authorization code',
      details: process.env.NODE_ENV === 'development' ? errorText : undefined
    });
  }

  const tokens = await tokenResponse.json();

  // Get user info from Google
  const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: {
      Authorization: `Bearer ${tokens.access_token}`,
    },
  });

  if (!userInfoResponse.ok) {
    const errorText = await userInfoResponse.text();
    console.error('User info fetch failed:', errorText);
    return res.status(400).json({ 
      error: 'Failed to get user information',
      details: process.env.NODE_ENV === 'development' ? errorText : undefined
    });
  }

  const userInfo = await userInfoResponse.json();

  return res.status(200).json({
    success: true,
    tokens: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      id_token: tokens.id_token,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type
    },
    user: {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture,
      verified_email: userInfo.verified_email
    }
  });
}

// Store refresh token (from /api/auth/store-token.js)
async function handleStoreToken(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

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
  const usersRange = 'Users!A:C';
  const usersResponse = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.GOOGLE_SHEETS_ID,
    range: usersRange,
  });

  const rows = usersResponse.data.values || [];
  const userRowIndex = rows.findIndex(row => row[1] === user.email);

  if (userRowIndex > 0) {
    // Update existing user's refresh token
    await sheets.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: `Users!C${userRowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[refreshToken]]
      }
    });
    console.log(`Updated refresh token for existing user: ${user.email}`);
  } else {
    // Add new user
    await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.GOOGLE_SHEETS_ID,
      range: 'Users!A:C',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[user.sub || user.userId, user.email, refreshToken]]
      }
    });
    console.log(`Added new user: ${user.email}`);
  }

  return res.status(200).json({
    success: true,
    message: 'Refresh token stored successfully'
  });
}

// Refresh access token
async function handleRefreshToken(req, res) {
  console.log('🔄 handleRefreshToken called with method:', req.method);
  
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { refreshToken } = req.body;
  console.log('🔄 Refresh token received:', {
    hasToken: !!refreshToken,
    tokenLength: refreshToken?.length || 0,
    tokenPreview: refreshToken?.substring(0, 15) + '...' || 'none'
  });
  
  if (!refreshToken) {
    console.error('❌ No refresh token provided in request body');
    return res.status(400).json({ error: 'Refresh token is required' });
  }

  try {
    console.log('🔄 Attempting to refresh access token...');
    
    const newTokens = await refreshGoogleToken(refreshToken);
    
    console.log('✅ Token refresh successful');
    
    return res.status(200).json({
      success: true,
      tokens: {
        access_token: newTokens.access_token,
        expires_in: newTokens.expires_in,
        token_type: newTokens.token_type,
        // Keep the same refresh token if a new one wasn't provided
        refresh_token: newTokens.refresh_token || refreshToken
      }
    });
    
  } catch (error) {
    console.error('❌ Token refresh failed:', error);
    
    return res.status(401).json({
      success: false,
      error: 'Failed to refresh token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}