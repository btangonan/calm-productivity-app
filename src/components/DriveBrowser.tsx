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

  useEffect(() => {
    loadDriveFiles(currentFolderId);
  }, [currentFolderId]);

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
      const driveFiles = await apiService.listDriveFiles(folderId, userProfile.id_token);
      
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
    
    // Clear search when navigating to new folder
    setSearchQuery('');
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

  const handleFileClick = (file: DriveFile) => {
    console.log('📂 File clicked:', file.name, 'isFolder:', file.isFolder, 'id:', file.id);
    if (file.isFolder) {
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
    
    if (file.mimeType.startsWith('image/')) return '🖼️';
    if (file.mimeType.includes('document')) return '📄';
    if (file.mimeType.includes('spreadsheet')) return '📊';
    if (file.mimeType.includes('presentation')) return '📽️';
    if (file.mimeType.includes('pdf')) return '📕';
    if (file.mimeType.includes('video')) return '🎥';
    if (file.mimeType.includes('audio')) return '🎵';
    
    return '📄';
  };

  const filteredFiles = files.filter(file => 
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
          <h1 className="text-2xl font-semibold text-gray-900 flex items-center">
            <svg className="w-8 h-8 mr-3" viewBox="0 -13.5 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
              <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"/>
              <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"/>
              <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"/>
              <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"/>
              <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"/>
              <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"/>
            </svg>
            Google Drive
          </h1>
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
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
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
                {searchQuery ? 'No files match your search' : 'This folder is empty'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => handleFileClick(file)}
                  className="flex items-center p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex-shrink-0 mr-4">
                    <span className="text-2xl">{getFileIcon(file)}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {file.isFolder ? 'Folder' : file.mimeType.split('/')[1].toUpperCase()}
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