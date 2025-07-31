export async function validateGoogleToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('🔍 No auth header or invalid format');
    return null;
  }

  const token = authHeader.substring(7);
  console.log('🔍 Validating token:', token.substring(0, 20) + '...');
  console.log('🔍 Environment check:', {
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? 'Present' : 'Missing',
    VITE_GOOGLE_CLIENT_ID: process.env.VITE_GOOGLE_CLIENT_ID ? 'Present' : 'Missing',
    NODE_ENV: process.env.NODE_ENV
  });
  
  try {
    // Try validating as access token first (for the new OAuth flow)
    const accessTokenResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    console.log('🔍 Access token validation response:', {
      status: accessTokenResponse.status,
      statusText: accessTokenResponse.statusText,
      ok: accessTokenResponse.ok
    });
    
    if (accessTokenResponse.ok) {
      const tokenInfo = await accessTokenResponse.json();
      console.log('🔍 Access token validation successful:', {
        user_id: tokenInfo.user_id,
        email: tokenInfo.email,
        audience: tokenInfo.audience,
        expires_in: tokenInfo.expires_in
      });
      
      // Validate token is for our application
      const expectedClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      console.log('🔍 Expected client ID:', expectedClientId);
      if (tokenInfo.audience && tokenInfo.audience !== expectedClientId) {
        console.error(`Access token audience mismatch: ${tokenInfo.audience} !== ${expectedClientId}`);
        return null;
      }

      return {
        userId: tokenInfo.user_id,
        email: tokenInfo.email,
        accessToken: token, // This is a real access token for API calls
        expiresAt: new Date(tokenInfo.expires_in * 1000 + Date.now())
      };
    }

    // Fallback: Check if it's a JWT ID token (for backward compatibility)
    if (token.startsWith('eyJ')) {
      console.log('🔍 Trying JWT ID token validation...');
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      
      if (!response.ok) {
        console.error(`JWT validation failed: ${response.status} ${response.statusText}`);
        const errorText = await response.text();
        console.error('JWT validation error details:', errorText);
        return null;
      }

      const tokenInfo = await response.json();
      
      // Validate token is for our application
      const expectedClientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
      if (tokenInfo.aud !== expectedClientId) {
        console.error(`JWT audience mismatch: ${tokenInfo.aud} !== ${expectedClientId}`);
        return null;
      }

      // Check if token is expired
      const now = Math.floor(Date.now() / 1000);
      if (tokenInfo.exp < now) {
        console.error('JWT token has expired');
        return null;
      }

      return {
        userId: tokenInfo.sub,
        email: tokenInfo.email,
        accessToken: token,
        expiresAt: new Date(tokenInfo.exp * 1000),
        isJWT: true // Flag to indicate we need service account for API calls
      };
    }

    console.error('Token validation failed for both access token and ID token');
    console.error('Access token response was not ok, and token does not start with eyJ (not a JWT)');
    
    // Return a special object indicating token refresh is needed
    return {
      userId: null,
      email: null,
      accessToken: token,
      needsRefresh: true,
      error: 'Token expired - refresh required'
    };
  } catch (error) {
    console.error('Token validation error:', error);
    console.error('Error during token validation process:', error.message);
    return null;
  }
}

export async function refreshGoogleToken(refreshToken) {
  try {
    console.log('🔄 refreshGoogleToken called with token length:', refreshToken?.length || 0);
    console.log('🔄 Environment check:', {
      hasClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      clientIdPreview: process.env.GOOGLE_CLIENT_ID?.substring(0, 10) + '...' || 'missing'
    });

    console.log('📤 Making request to Google OAuth token endpoint...');
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    console.log('📥 Google OAuth response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Google OAuth error response:', errorText);
      
      // Try to parse the error for more details
      try {
        const errorJson = JSON.parse(errorText);
        console.error('❌ Google OAuth error details:', errorJson);
      } catch (e) {
        console.error('❌ Could not parse Google OAuth error as JSON');
      }
      
      throw new Error(`Token refresh failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Google OAuth success response:', {
      hasAccessToken: !!result.access_token,
      hasRefreshToken: !!result.refresh_token,
      tokenType: result.token_type,
      expiresIn: result.expires_in
    });

    return result;
  } catch (error) {
    console.error('❌ Token refresh error:', error);
    console.error('❌ Error stack:', error.stack);
    throw error;
  }
}

export async function getServiceAccountToken(userEmail = null) {
  try {
    console.log('🔍 Starting service account token generation...');
    console.log('🔍 Service account email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
    console.log('🔍 Private key exists:', !!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
    
    // Import Google Auth library
    const { GoogleAuth } = await import('google-auth-library');
    
    // Configure the authentication client
    const auth = new GoogleAuth({
      credentials: JSON.parse(Buffer.from(process.env.GOOGLE_CREDENTIALS_JSON, 'base64').toString('utf8')),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    console.log('🔍 Getting authenticated client...');
    const authClient = await auth.getClient();
    
    console.log('🔍 Getting access token...');
    const accessTokenResponse = await authClient.getAccessToken();
    
    if (!accessTokenResponse.token) {
      throw new Error('No access token received from Google Auth');
    }
    
    console.log('✅ Service account token obtained successfully');
    return accessTokenResponse.token;
    
  } catch (error) {
    console.error('[DEBUG] Service account token error:', error);
    console.error('[DEBUG] Error type:', error.constructor.name);
    console.error('[DEBUG] Error message:', error.message);
    console.error('[DEBUG] Error stack:', error.stack);
    
    // Re-throw with more context
    throw new Error(`Service account authentication failed: ${error.message}`);
  }
}

