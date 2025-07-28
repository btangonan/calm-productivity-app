export async function validateGoogleToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    // Verify token with Google
    const response = await fetch(`https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`);
    
    if (!response.ok) {
      console.error(`Token validation failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const tokenInfo = await response.json();
    
    // Validate token is for our application
    if (tokenInfo.audience !== process.env.GOOGLE_CLIENT_ID) {
      console.error(`Token audience mismatch: ${tokenInfo.audience} !== ${process.env.GOOGLE_CLIENT_ID}`);
      return null;
    }

    return {
      userId: tokenInfo.user_id,
      email: tokenInfo.email,
      accessToken: token,
      expiresAt: new Date(tokenInfo.expires_in * 1000 + Date.now())
    };
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