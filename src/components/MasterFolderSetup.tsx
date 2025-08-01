import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

const MasterFolderSetup: React.FC = () => {
  const { state, dispatch } = useApp();
  const [serviceAccountEmail, setServiceAccountEmail] = useState<string>('');
  const [currentMasterFolderId, setCurrentMasterFolderId] = useState<string>('');
  const [newFolderUrl, setNewFolderUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  useEffect(() => {
    loadCurrentSettings();
  }, []);

  const loadCurrentSettings = async () => {
    if (!state.userProfile) return;

    try {
      setLoading(true);
      
      // Get service account email
      try {
        const token = state.userProfile.access_token || state.userProfile.id_token;
        if (!token) {
          throw new Error('No authentication token available');
        }
        const emailData = await apiService.getServiceAccountEmail(token);
        console.log('Email data received:', emailData);
        setServiceAccountEmail(emailData.email);
      } catch (emailError) {
        console.error('Failed to load service account email:', emailError);
        // Fallback to hardcoded email
        setServiceAccountEmail('nowandlater@solid-study-467023-i3.iam.gserviceaccount.com');
      }
      
      // Get current master folder ID
      let masterFolderId = '';
      try {
        const token = state.userProfile.access_token || state.userProfile.id_token;
        if (!token) {
          throw new Error('No authentication token available');
        }
        const folderData = await apiService.getMasterFolderId(token);
        console.log('Folder data received:', folderData);
        masterFolderId = folderData.folderId || '';
      } catch (folderError) {
        console.error('Failed to load master folder ID from API:', folderError);
      }
      
      // If no folder ID from API, try localStorage as fallback
      if (!masterFolderId) {
        const localStorageKey = `masterFolder_${state.userProfile.email}`;
        const localFolderId = localStorage.getItem(localStorageKey);
        if (localFolderId) {
          console.log('Using master folder ID from localStorage:', localFolderId);
          masterFolderId = localFolderId;
        }
      }
      
      setCurrentMasterFolderId(masterFolderId);
      
      if (masterFolderId) {
        setMessage(`Master folder loaded: ${masterFolderId}`);
        setMessageType('success');
      } else {
        setMessage('No master folder configured yet');
        setMessageType('info');
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      setMessage('Some settings could not be loaded. Using defaults.');
      setMessageType('error');
      // Set fallback values
      setServiceAccountEmail('nowandlater@solid-study-467023-i3.iam.gserviceaccount.com');
      setCurrentMasterFolderId('');
    } finally {
      setLoading(false);
    }
  };

  const extractFolderIdFromUrl = (url: string): string | null => {
    const match = url.match(/folders\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  const handleSetMasterFolder = async () => {
    if (!state.userProfile) return;
    
    if (!newFolderUrl.trim()) {
      setMessage('Please enter a Google Drive folder URL');
      setMessageType('error');
      return;
    }

    const folderId = extractFolderIdFromUrl(newFolderUrl);
    if (!folderId) {
      setMessage('Invalid Google Drive folder URL. Please make sure it contains /folders/[ID]');
      setMessageType('error');
      return;
    }

    console.log('Setting master folder with ID:', folderId);
    console.log('Original URL:', newFolderUrl);

    try {
      setLoading(true);
      setMessage('Setting master folder...');
      setMessageType('info');

      // Get authentication token
      const token = state.userProfile.access_token || state.userProfile.id_token;
      if (!token) {
        throw new Error('No authentication token available');
      }

      // Set the new master folder
      const result = await apiService.setMasterFolderId(folderId, token);
      console.log('API result:', result);
      
      // Store in localStorage as backup
      const localStorageKey = `masterFolder_${state.userProfile.email}`;
      localStorage.setItem(localStorageKey, folderId);
      console.log('Stored master folder in localStorage:', localStorageKey, folderId);
      
      // Update the UI immediately
      setCurrentMasterFolderId(folderId);
      setMessage(`Master folder set successfully! Folder ID: ${folderId}. Saved both in memory and locally.`);
      setMessageType('success');
      setNewFolderUrl('');
      
      console.log('Master folder updated to:', folderId);
    } catch (error) {
      console.error('Failed to set master folder:', error);
      setMessage(`Failed to set master folder: ${error.message}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const handleShareFolder = async () => {
    if (!state.userProfile) {
      setMessage('Please sign in to use this feature');
      setMessageType('error');
      return;
    }

    if (!currentMasterFolderId) {
      setMessage('Please set a master folder first before sharing');
      setMessageType('error');
      return;
    }

    try {
      setLoading(true);
      setMessage('Sharing folder with service account...');
      setMessageType('info');

      const token = state.userProfile.access_token || state.userProfile.id_token;
      if (!token) {
        throw new Error('No authentication token available');
      }
      const result = await apiService.shareFolderWithServiceAccount(currentMasterFolderId, token);
      setMessage(result.message);
      setMessageType('info');
    } catch (error) {
      console.error('Failed to share folder:', error);
      setMessage(`Automatic sharing is not available yet. Please manually share your folder with: ${serviceAccountEmail}`);
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setMessage('Copied to clipboard!');
    setMessageType('success');
    setTimeout(() => setMessage(''), 2000);
  };

  if (!state.userProfile) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">Please sign in to configure your master folder</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Master Folder Configuration</h3>
        <p className="text-sm text-gray-600">
          Configure which Google Drive folder to use as your master folder for organizing areas and projects.
        </p>
      </div>

      {/* Service Account Email */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-blue-900 mb-2">Service Account Email</h4>
        <p className="text-sm text-blue-800 mb-3">
          Share your master folder with this email to enable full functionality:
        </p>
        <div className="flex items-center space-x-2">
          <code className="flex-1 bg-white border border-blue-300 rounded px-3 py-2 text-sm text-blue-900 font-mono">
            {serviceAccountEmail}
          </code>
          <button
            onClick={() => copyToClipboard(serviceAccountEmail)}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Current Master Folder */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Current Master Folder</h4>
        {currentMasterFolderId ? (
          <div className="flex items-center space-x-3 mb-3">
            <code className="flex-1 bg-gray-100 border border-gray-300 rounded px-3 py-2 text-sm text-gray-800 font-mono">
              {currentMasterFolderId}
            </code>
            <a
              href={`https://drive.google.com/drive/folders/${currentMasterFolderId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
            >
              View
            </a>
            <button
              onClick={handleShareFolder}
              disabled={loading}
              className="px-3 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 text-sm disabled:opacity-50"
            >
              {loading ? 'Sharing...' : 'Share'}
            </button>
          </div>
        ) : (
          <p className="text-sm text-gray-500 mb-3">No master folder configured</p>
        )}
      </div>

      {/* Set New Master Folder */}
      <div>
        <h4 className="text-sm font-medium text-gray-900 mb-2">Change Master Folder</h4>
        <p className="text-sm text-gray-600 mb-3">
          Enter the URL of a Google Drive folder you want to use as your master folder:
        </p>
        <div className="flex items-center space-x-3 mb-3">
          <input
            type="text"
            value={newFolderUrl}
            onChange={(e) => setNewFolderUrl(e.target.value)}
            placeholder="https://drive.google.com/drive/folders/your-folder-id"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
            disabled={loading}
          />
          <button
            onClick={handleSetMasterFolder}
            disabled={loading || !newFolderUrl.trim()}
            className="px-4 py-2 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50 text-sm"
          >
            {loading ? 'Setting...' : 'Set Folder'}
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <h4 className="text-sm font-medium text-yellow-900 mb-2">Setup Instructions</h4>
        <ol className="text-sm text-yellow-800 space-y-1 list-decimal list-inside">
          <li>Create or choose a folder in Google Drive</li>
          <li>Copy the folder URL (must contain /folders/[ID])</li>
          <li>Paste the URL above and click "Set Folder"</li>
          <li>Click "Share" to give the service account access</li>
          <li>Alternatively, manually share the folder with: <code className="bg-yellow-100 px-1 rounded">{serviceAccountEmail}</code></li>
        </ol>
      </div>

      {/* Status Message */}
      {message && (
        <div className={`border rounded-lg p-3 ${
          messageType === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : messageType === 'error'
            ? 'bg-red-50 border-red-200 text-red-800'
            : 'bg-blue-50 border-blue-200 text-blue-800'
        }`}>
          <p className="text-sm">{message}</p>
        </div>
      )}
    </div>
  );
};

export default MasterFolderSetup;