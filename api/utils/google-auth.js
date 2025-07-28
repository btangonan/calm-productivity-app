export async function validateGoogleToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    // Check if it's a JWT token (starts with eyJ)
    if (token.startsWith('eyJ')) {
      // It's a JWT ID token - validate with Google's tokeninfo endpoint for ID tokens
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
        accessToken: token, // We'll use service account for actual API calls
        expiresAt: new Date(tokenInfo.exp * 1000)
      };
    } else {
      // It's an OAuth access token - use the original validation
      const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
      
      if (!response.ok) {
        console.error(`Access token validation failed: ${response.status} ${response.statusText}`);
        return null;
      }

      const tokenInfo = await response.json();
      
      // Validate token is for our application
      if (tokenInfo.audience !== process.env.GOOGLE_CLIENT_ID) {
        console.error(`Access token audience mismatch: ${tokenInfo.audience} !== ${process.env.GOOGLE_CLIENT_ID}`);
        return null;
      }

      return {
        userId: tokenInfo.user_id,
        email: tokenInfo.email,
        accessToken: token,
        expiresAt: new Date(tokenInfo.expires_in * 1000 + Date.now())
      };
    }
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

export async function getServiceAccountToken() {
  try {
    // Create JWT for service account
    const now = Math.floor(Date.now() / 1000);
    const jwt = await createServiceAccountJWT({
      iss: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      scope: 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      exp: now + 3600,
      iat: now
    });

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
      throw new Error(`Service account token failed: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    return result.access_token;
  } catch (error) {
    console.error('Service account token error:', error);
    throw error;
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

  // Import private key
  const privateKeyPem = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.replace(/\\n/g, '\n');
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