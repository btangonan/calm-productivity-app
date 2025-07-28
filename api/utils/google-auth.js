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
    
    // For personal Gmail accounts, we can't use domain-wide delegation
    // Use service account without impersonation for shared resources only
    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    };

    console.log('🔍 JWT payload:', jwtPayload);

    // Note: Cannot impersonate personal Gmail users without domain-wide delegation
    // This will only work for resources shared with the service account
    
    console.log('🔍 Creating service account JWT...');
    const jwt = await createServiceAccountJWT(jwtPayload);
    console.log('✅ JWT created successfully');

    // Exchange JWT for access token
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: jwt,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Service account token failed:', response.status, errorText);
      
      // Try to parse the error for more details
      let googleError;
      try {
        googleError = JSON.parse(errorText);
        console.error('Google OAuth2 Error Details:', googleError);
      } catch (e) {
        console.error('Raw Google OAuth2 Response:', errorText);
      }
      
      throw new Error(`Service account token failed: ${response.status} - ${googleError?.error_description || errorText}`);
    }

    const result = await response.json();
    return result.access_token;
  } catch (error) {
    console.error('[DEBUG] Service account token error:', error);
    console.error('[DEBUG] Error type:', error.constructor.name);
    console.error('[DEBUG] Error message:', error.message);
    console.error('[DEBUG] Error stack:', error.stack);
    
    // Re-throw with more context
    throw new Error(`Service account authentication failed: ${error.message}`);
  }
}

async function createServiceAccountJWT(payload) {
  // Import Web Crypto API
  const crypto = globalThis.crypto;
  
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  
  const message = `${encodedHeader}.${encodedPayload}`;
  const messageBuffer = new TextEncoder().encode(message);

  // Import private key - fix common Vercel environment variable formatting issues
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY environment variable is not set');
  }
  
  let privateKeyPem;
  try {
    privateKeyPem = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
    console.log('Private key format check:', privateKeyPem.substring(0, 50) + '...');
    console.log('Private key ends with:', privateKeyPem.substring(privateKeyPem.length - 50));
  } catch (keyError) {
    console.error('Error processing private key:', keyError);
    throw new Error(`Private key processing failed: ${keyError.message}`);
  }
  const privateKey = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  );

  // Sign the message
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    privateKey,
    messageBuffer
  );

  const encodedSignature = base64UrlEncode(signature);
  return `${message}.${encodedSignature}`;
}

function base64UrlEncode(data) {
  if (typeof data === 'string') {
    data = new TextEncoder().encode(data);
  }
  
  const base64 = btoa(String.fromCharCode(...new Uint8Array(data)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function pemToArrayBuffer(pem) {
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  return bytes.buffer;
}