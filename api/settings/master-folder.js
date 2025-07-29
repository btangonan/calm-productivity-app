import { validateGoogleToken } from '../utils/google-auth.js';

// Temporary in-memory storage for master folder IDs by user email
// TODO: Replace with proper database storage
const userMasterFolders = new Map();

// Export the map so other modules can access it
export { userMasterFolders as masterFolderMap };

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
      
      // Get stored master folder for this user
      const currentMasterFolderId = userMasterFolders.get(user.email) || null;
      
      return res.status(200).json({
        success: true,
        data: {
          serviceAccountEmail: serviceAccountEmail,
          message: 'Share your master Drive folder with this email to enable full functionality',
          currentMasterFolderId: currentMasterFolderId,
          note: currentMasterFolderId 
            ? 'Master folder is set and stored temporarily (will be persisted in database in future update)'
            : 'No master folder configured yet'
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

      console.log(`Setting master folder for user ${user.email}: ${folderId}`);
      
      // Store folder ID for this user (temporary in-memory storage)
      userMasterFolders.set(user.email, folderId);
      
      console.log(`Master folder stored. Current storage:`, Array.from(userMasterFolders.entries()));
      
      return res.status(200).json({
        success: true,
        data: {
          folderId,
          message: 'Master folder configuration saved in memory (will be persisted to database in future update)',
          userEmail: user.email
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