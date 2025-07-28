import { validateGoogleToken } from '../utils/google-auth.js';

export default async function handler(req, res) {
  try {
    // Authenticate user
    const user = await validateGoogleToken(req.headers.authorization);
    if (!user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (req.method === 'GET') {
      // Get current master folder configuration
      const serviceAccountEmail = 'nowandlater@solid-study-467023-i3.iam.gserviceaccount.com';
      
      // For now, return hardcoded values since we don't have a user-specific storage yet
      // TODO: Implement user-specific master folder storage
      return res.status(200).json({
        success: true,
        data: {
          serviceAccountEmail: serviceAccountEmail,
          message: 'Share your master Drive folder with this email to enable full functionality',
          currentMasterFolderId: null, // TODO: Get from user storage
          note: 'Master folder configuration will be implemented in a future update'
        }
      });
    }

    if (req.method === 'POST') {
      // Set master folder
      const { folderId } = req.body;
      
      if (!folderId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Folder ID is required' 
        });
      }

      // TODO: Validate folder exists and is accessible
      // TODO: Store folder ID for this user
      
      return res.status(200).json({
        success: true,
        data: {
          folderId,
          message: 'Master folder configuration saved (feature in development)'
        }
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });

  } catch (error) {
    console.error('Master folder API error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process master folder request',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}