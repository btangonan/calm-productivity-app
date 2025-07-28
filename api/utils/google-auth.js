export async function validateGoogleToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    // Try validating as access token first (for the new OAuth flow)
    const accessTokenResponse = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    
    if (accessTokenResponse.ok) {
      const tokenInfo = await accessTokenResponse.json();
      
      // Validate token is for our application
      if (tokenInfo.audience && tokenInfo.audience !== process.env.GOOGLE_CLIENT_ID) {
        console.error(`Access token audience mismatch: ${tokenInfo.audience} !== ${process.env.GOOGLE_CLIENT_ID}`);
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
      const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${token}`);
      
      if (!response.ok) {
        console.error(`JWT validation failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const tokenInfo = await response.json();
      
      // Validate token is for our application
      if (tokenInfo.aud !== process.env.GOOGLE_CLIENT_ID) {
        console.error(`JWT audience mismatch: ${tokenInfo.aud} !== ${process.env.GOOGLE_CLIENT_ID}`);
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
    return null;
  } catch (error) {
    console.error('Token validation error:', error);
    return null;
  }
}

export async function refreshGoogleToken(refreshToken) {
  try {
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

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Token refresh error:', error);
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

