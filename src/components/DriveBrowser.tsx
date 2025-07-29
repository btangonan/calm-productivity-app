import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: number;
  modifiedTime: string;
  webViewLink: string;
  thumbnailLink?: string;
  isFolder: boolean;
  parents?: string[];
}

interface DriveBrowserProps {
  className?: string;
}

const DriveBrowser: React.FC<DriveBrowserProps> = ({ className = '' }) => {
  const { state } = useApp();
  const { userProfile } = state;
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<string>('root');
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{id: string, name: string}>>([{id: 'root', name: 'My Drive'}]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchResults, setGlobalSearchResults] = useState<DriveFile[]>([]);
  const [isGlobalSearch, setIsGlobalSearch] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [clickTimer, setClickTimer] = useState<NodeJS.Timeout | null>(null);
  const [selectedFilePath, setSelectedFilePath] = useState<string>('');

  const getFileTypeLabel = (mimeType: string): string => {
    // Google Workspace files
    if (mimeType === 'application/vnd.google-apps.document') return 'Google Doc';
    if (mimeType === 'application/vnd.google-apps.spreadsheet') return 'Google Sheets';
    if (mimeType === 'application/vnd.google-apps.presentation') return 'Google Slides';
    if (mimeType === 'application/vnd.google-apps.form') return 'Google Form';
    if (mimeType === 'application/vnd.google-apps.drawing') return 'Google Drawing';
    if (mimeType === 'application/vnd.google-apps.script') return 'Apps Script';
    
    // Regular file types
    if (mimeType === 'application/pdf') return 'PDF';
    if (mimeType.startsWith('image/')) return 'Image';
    if (mimeType.startsWith('video/')) return 'Video';
    if (mimeType.startsWith('audio/')) return 'Audio';
    if (mimeType.includes('word') || mimeType.includes('document')) return 'Document';
    if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Spreadsheet';
    if (mimeType.includes('powerpoint') || mimeType.includes('presentation')) return 'Presentation';
    if (mimeType.includes('zip') || mimeType.includes('compressed')) return 'Archive';
    if (mimeType.includes('text/')) return 'Text';
    
    // Fallback to file extension or generic
    const parts = mimeType.split('/');
    return parts.length > 1 ? parts[1].toUpperCase() : 'File';
  };

  useEffect(() => {
    loadDriveFiles(currentFolderId);
  }, [currentFolderId]);

  useEffect(() => {
    return () => {
      if (clickTimer) {
        clearTimeout(clickTimer);
      }
    };
  }, [clickTimer]);

  const loadDriveFiles = async (folderId: string = 'root') => {
    if (!userProfile?.id_token) {
      setError('Please sign in to access Google Drive');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      console.log('🔍 Loading Drive files for folder:', folderId);
      
      // Use the real API to get Google Drive files
      const token = userProfile.access_token || userProfile.id_token;
      if (!token) {
        throw new Error('No authentication token available');
      }
      const driveFiles = await apiService.listDriveFiles(folderId, token);
      
      console.log('📁 Received Drive files:', driveFiles.length, 'files');
      
      // Convert the backend response to our frontend interface
      const files: DriveFile[] = driveFiles.map((file: any) => ({
        id: file.id,
        name: file.name,
        mimeType: file.mimeType,
        size: file.size,
        modifiedTime: file.modifiedTime,
        webViewLink: file.webViewLink,
        thumbnailLink: file.thumbnailLink,
        isFolder: file.isFolder,
        parents: file.parents,
      }));

      console.log('🔍 Converted files:', files.length, 'files');
      console.log('📋 First 5 files:', files.slice(0, 5).map(f => ({ name: f.name, isFolder: f.isFolder, mimeType: f.mimeType })));

      setFiles(files);

    } catch (error) {
      console.error('Failed to load Drive files:', error);
      setError('Failed to load Google Drive files. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const navigateToFolder = async (folderId: string, folderName: string) => {
    console.log('🚀 Navigating to folder:', folderId, 'name:', folderName);
    
    // Clear search and selection when navigating to new folder
    setSearchQuery('');
    setIsGlobalSearch(false);
    setGlobalSearchResults([]);
    setSelectedFileId(null);
    setSelectedFilePath('');
    setCurrentFolderId(folderId);
    
    if (folderId === 'root') {
      setBreadcrumbs([{id: 'root', name: 'My Drive'}]);
    } else {
      // Add to breadcrumbs if not already present
      const existingIndex = breadcrumbs.findIndex(b => b.id === folderId);
      if (existingIndex >= 0) {
        // Navigate back to existing breadcrumb
        setBreadcrumbs(breadcrumbs.slice(0, existingIndex + 1));
      } else {
        // Add new breadcrumb
        setBreadcrumbs([...breadcrumbs, {id: folderId, name: folderName}]);
      }
    }
  };

  const getFilePath = async (file: DriveFile): Promise<string> => {
    if (!file.parents || file.parents.length === 0) {
      return 'My Drive';
    }
    
    try {
      // For search results, we need to build the path from the parent folders
      const pathParts = ['My Drive'];
      let currentParentId = file.parents[0];
      
      // Note: In a real implementation, you'd want to call the backend to get folder names
      // For now, we'll show a simplified path
      if (currentParentId !== 'root') {
        pathParts.push('...');  // Placeholder for folder names
      }
      
      return pathParts.join(' > ');
    } catch (error) {
      return 'My Drive';
    }
  };

  const handleFileClick = async (file: DriveFile) => {
    console.log('📂 File clicked:', file.name, 'isFolder:', file.isFolder, 'id:', file.id);
    
    // Clear any existing timer
    if (clickTimer) {
      clearTimeout(clickTimer);
      setClickTimer(null);
    }
    
    // Single click - select the file and get its path
    if (selectedFileId === file.id) {
      // If already selected, this might be a double-click
      handleFileDoubleClick(file);
    } else {
      setSelectedFileId(file.id);
      
      // Get file path for search results
      if (isGlobalSearch && userProfile?.id_token) {
        try {
          const token = userProfile.access_token || userProfile.id_token;
          if (!token) {
            throw new Error('No authentication token available');
          }
          const pathData = await apiService.getFilePath(file.id, token);
          const pathString = pathData.map(p => p.name).join(' > ');
          setSelectedFilePath(pathString);
        } catch (error) {
          setSelectedFilePath('My Drive > ...');
        }
      }
      
      // Set timer to clear selection behavior for double-click detection
      const timer = setTimeout(() => {
        setClickTimer(null);
      }, 300);
      setClickTimer(timer);
    }
  };

  const handleFileDoubleClick = (file: DriveFile) => {
    console.log('📂 File double-clicked:', file.name);
    
    if (file.isFolder) {
      // Clear search when navigating to folder
      setSearchQuery('');
      setIsGlobalSearch(false);
      setGlobalSearchResults([]);
      setSelectedFileId(null);
      setSelectedFilePath('');
      navigateToFolder(file.id, file.name);
    } else {
      // Open file in new tab
      window.open(file.webViewLink, '_blank');
    }
  };

  const formatFileSize = (bytes: number | undefined): string => {
    if (!bytes) return '';
    
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  const getFileIcon = (file: DriveFile): string => {
    if (file.isFolder) return '📁';
    
    // Google Workspace files (specific MIME types)
    if (file.mimeType === 'application/vnd.google-apps.document') return '📝'; // Google Docs
    if (file.mimeType === 'application/vnd.google-apps.spreadsheet') return '📊'; // Google Sheets
    if (file.mimeType === 'application/vnd.google-apps.presentation') return '📈'; // Google Slides
    if (file.mimeType === 'application/vnd.google-apps.form') return '📋'; // Google Forms
    if (file.mimeType === 'application/vnd.google-apps.drawing') return '🎨'; // Google Drawings
    if (file.mimeType === 'application/vnd.google-apps.script') return '⚙️'; // Apps Script
    
    // Regular file types
    if (file.mimeType === 'application/pdf') return '📕'; // PDF files
    if (file.mimeType.startsWith('image/')) return '🖼️';
    if (file.mimeType.startsWith('video/')) return '🎥';
    if (file.mimeType.startsWith('audio/')) return '🎵';
    if (file.mimeType.includes('word') || file.mimeType.includes('document')) return '📄';
    if (file.mimeType.includes('excel') || file.mimeType.includes('spreadsheet')) return '📊';
    if (file.mimeType.includes('powerpoint') || file.mimeType.includes('presentation')) return '📽️';
    if (file.mimeType.includes('zip') || file.mimeType.includes('compressed')) return '🗜️';
    if (file.mimeType.includes('text/')) return '📃';
    
    return '📄';
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    setSelectedFileId(null); // Clear selection when searching
    setSelectedFilePath(''); // Clear path when searching
    
    if (!query.trim()) {
      setIsGlobalSearch(false);
      setGlobalSearchResults([]);
      return;
    }

    if (query.length >= 3) { // Start global search after 3+ characters
      setSearchLoading(true);
      setIsGlobalSearch(true);
      
      try {
        if (userProfile?.id_token) {
          const token = userProfile.access_token || userProfile.id_token;
          if (!token) {
            throw new Error('No authentication token available');
          }
          const searchResults = await apiService.searchDriveFiles(query, token);
          const convertedResults: DriveFile[] = searchResults.map((file: any) => ({
            id: file.id,
            name: file.name,
            mimeType: file.mimeType,
            size: file.size,
            modifiedTime: file.modifiedTime,
            webViewLink: file.webViewLink,
            thumbnailLink: file.thumbnailLink,
            isFolder: file.isFolder,
            parents: file.parents,
          }));
          setGlobalSearchResults(convertedResults);
        }
      } catch (error) {
        console.error('Global search failed:', error);
        setError('Search failed. Please try again.');
      } finally {
        setSearchLoading(false);
      }
    }
  };

  const filteredFiles = isGlobalSearch 
    ? globalSearchResults
    : files.filter(file => 
        file.name.toLowerCase().includes(searchQuery.toLowerCase())
      );

  console.log('🔍 Files state:', files.length, 'files');
  console.log('🔍 Filtered files:', filteredFiles.length, 'files');
  console.log('🔍 Search query:', searchQuery);

  if (!userProfile) {
    return (
      <div className={`p-6 ${className}`}>
        <div className="text-center">
          <div className="text-gray-500 mb-4">
            <svg className="w-16 h-16 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6.5 2.5l5.5 9.5h11l-5.5-9.5H6.5zm11 15h-11l5.5-9.5h11l-5.5 9.5zM1 12l5.5 9.5h11L12 12H1z"/>
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">Google Drive Access</h3>
          <p className="text-gray-500">Please sign in to browse your Google Drive files</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`p-6 ${className}`}>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-600">My Drive</h2>
          <button
            onClick={() => loadDriveFiles(currentFolderId)}
            className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>

        {/* Breadcrumbs */}
        <nav className="flex mb-4" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.id} className="inline-flex items-center">
                {index > 0 && (
                  <svg className="w-4 h-4 text-gray-400 mx-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                )}
                <button
                  onClick={() => navigateToFolder(crumb.id, crumb.name)}
                  className={`text-sm font-medium ${
                    index === breadcrumbs.length - 1
                      ? 'text-gray-500 cursor-default'
                      : 'text-blue-600 hover:text-blue-800'
                  }`}
                  disabled={index === breadcrumbs.length - 1}
                >
                  {crumb.name}
                </button>
              </li>
            ))}
          </ol>
        </nav>

        {/* Search */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder={isGlobalSearch ? "Searching all of Google Drive..." : "Search files and folders..."}
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            className="block w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {searchLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
            )}
            {searchQuery && (
              <button
                onClick={() => handleSearch('')}
                className="text-gray-400 hover:text-gray-600"
                title="Clear search"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        {/* Selected File Path - only show for search results */}
        {selectedFileId && isGlobalSearch && selectedFilePath && (
          <div className="text-sm text-gray-600 mt-2 mb-2">
            <span className="font-medium">Path:</span> {selectedFilePath}
          </div>
        )}

        {/* Search status */}
        {isGlobalSearch && (
          <div className="text-sm text-gray-600 mt-2">
            {searchLoading ? 
              'Searching all of Google Drive...' : 
              `Found ${filteredFiles.length} result${filteredFiles.length !== 1 ? 's' : ''} for "${searchQuery}"`
            }
          </div>
        )}
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Loading State */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
          <span className="ml-3 text-gray-600">Loading Google Drive files...</span>
        </div>
      ) : (
        /* Files List */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {filteredFiles.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-gray-500">
                {searchLoading ? 'Searching...' : searchQuery ? 'No files match your search' : 'This folder is empty'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className={`flex items-center p-4 cursor-pointer transition-colors ${
                    selectedFileId === file.id 
                      ? 'bg-blue-50 border-l-4 border-blue-500' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex-shrink-0 mr-4">
                    <span className="text-2xl">{getFileIcon(file)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {file.isFolder ? 'Folder' : getFileTypeLabel(file.mimeType)}
                      {file.size && ` • ${formatFileSize(file.size)}`}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-sm text-gray-500">
                      {formatDate(file.modifiedTime)}
                    </p>
                    {!file.isFolder && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(file.webViewLink, '_blank');
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Open
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DriveBrowser;