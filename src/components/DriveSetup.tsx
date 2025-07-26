import { useState, useEffect } from 'react';
import { apiService } from '../services/api';
import type { DriveStructure, DriveFolder } from '../types';

interface DriveSetupProps {
  onSetupComplete?: () => void;
  className?: string;
}

const DriveSetup: React.FC<DriveSetupProps> = ({ onSetupComplete, className = '' }) => {
  const [driveStructure, setDriveStructure] = useState<DriveStructure | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatingMasterFolder, setIsCreatingMasterFolder] = useState(false);
  const [masterFolderName, setMasterFolderName] = useState('Productivity App');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDriveStructure();
  }, []);

  const loadDriveStructure = async () => {
    try {
      setIsLoading(true);
      const structure = await apiService.getDriveStructure();
      setDriveStructure(structure);
    } catch (error) {
      console.error('Failed to load drive structure:', error);
      setError('Failed to load Google Drive structure');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateMasterFolder = async () => {
    if (!masterFolderName.trim()) {
      setError('Please enter a folder name');
      return;
    }

    try {
      setIsCreatingMasterFolder(true);
      setError(null);
      
      const masterFolder = await apiService.createMasterFolder(masterFolderName.trim());
      
      // Update the drive structure with the new master folder
      setDriveStructure(prev => ({
        ...prev,
        masterFolderId: masterFolder.id,
        masterFolderName: masterFolder.name,
        areas: prev?.areas || {},
        projects: prev?.projects || {}
      }));

      onSetupComplete?.();
    } catch (error) {
      console.error('Failed to create master folder:', error);
      setError('Failed to create master folder. Please try again.');
    } finally {
      setIsCreatingMasterFolder(false);
    }
  };

  const handleSetExistingFolder = async (folderId: string) => {
    try {
      setError(null);
      await apiService.setMasterFolder(folderId);
      await loadDriveStructure(); // Reload to get updated structure
      onSetupComplete?.();
    } catch (error) {
      console.error('Failed to set master folder:', error);
      setError('Failed to set master folder. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <span className="ml-3 text-gray-600">Loading Google Drive setup...</span>
        </div>
      </div>
    );
  }

  // If master folder is already set up
  if (driveStructure?.masterFolderId) {
    return (
      <div className={`bg-green-50 border border-green-200 rounded-lg p-6 ${className}`}>
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-green-800">
              Google Drive Setup Complete
            </h3>
            <div className="mt-2 text-sm text-green-700">
              <p>Master folder: <strong>{driveStructure.masterFolderName}</strong></p>
              <a 
                href={`https://drive.google.com/drive/folders/${driveStructure.masterFolderId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-green-600 hover:text-green-800 underline"
              >
                View in Google Drive
                <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Setup needed
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}>
      <div className="text-center">
        <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-100">
          <svg className="h-6 w-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        <h3 className="mt-4 text-lg font-medium text-gray-900">
          Set up Google Drive Integration
        </h3>
        
        <p className="mt-2 text-sm text-gray-500">
          Create or select a master folder in Google Drive to organize your areas and projects.
        </p>

        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="mt-6 space-y-4">
          {/* Create new master folder */}
          <div className="border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Create New Master Folder
            </h4>
            
            <div className="flex items-center space-x-3">
              <input
                type="text"
                value={masterFolderName}
                onChange={(e) => setMasterFolderName(e.target.value)}
                placeholder="Enter folder name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                disabled={isCreatingMasterFolder}
              />
              <button
                onClick={handleCreateMasterFolder}
                disabled={isCreatingMasterFolder || !masterFolderName.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
              >
                {isCreatingMasterFolder ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </>
                ) : (
                  'Create Folder'
                )}
              </button>
            </div>
            
            <p className="mt-2 text-xs text-gray-500">
              This will create a new folder in your Google Drive root directory.
            </p>
          </div>

          {/* Use existing folder - placeholder for future implementation */}
          <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
            <h4 className="text-sm font-medium text-gray-900 mb-2">
              Use Existing Folder
            </h4>
            <p className="text-sm text-gray-500 mb-3">
              Select an existing Google Drive folder to use as your master folder.
            </p>
            <button
              disabled={true}
              className="px-4 py-2 bg-gray-300 text-gray-500 rounded-md cursor-not-allowed"
            >
              Browse Folders (Coming Soon)
            </button>
          </div>
        </div>

        <div className="mt-6">
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-800">
                  How it works
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Your master folder will contain all your areas and projects</li>
                    <li>Each area will have its own subfolder</li>
                    <li>Each project will have its own subfolder within its area</li>
                    <li>Files uploaded to projects will be stored in their respective folders</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DriveSetup;