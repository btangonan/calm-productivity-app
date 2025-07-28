import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
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

  } catch (error) {
    console.error('Token validation error:', error);
    return res.status(500).json({
      success: false,
      error: 'Token validation failed'
    });
  }
}