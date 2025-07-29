import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import { useState, useEffect } from 'react';

const Header = () => {
  const { state, dispatch } = useApp();
  const { currentView, selectedProjectId, projects } = state;
  const [backendStatus, setBackendStatus] = useState(apiService.getBackendStatus());
  const [isEditingProjectTitle, setIsEditingProjectTitle] = useState(false);
  const [editingProjectTitle, setEditingProjectTitle] = useState('');

  const getViewTitle = () => {
    switch (currentView) {
      case 'inbox':
        return 'Inbox';
      case 'today':
        return 'Today';
      case 'upcoming':
        return 'Upcoming';
      case 'anytime':
        return 'Anytime';
      case 'logbook':
        return 'Logbook';
      case 'drive':
        return 'Google Drive';
      case 'project':
        const project = projects.find(p => p.id === selectedProjectId);
        return project ? project.name : 'Project';
      default:
        return 'Calm Productivity';
    }
  };

  const getViewIcon = () => {
    switch (currentView) {
      case 'inbox':
        return '📥';
      case 'today':
        return '📅';
      case 'upcoming':
        return '📆';
      case 'anytime':
        return '⭐';
      case 'logbook':
        return '✅';
      case 'drive':
        return (
          <svg className="w-6 h-6" viewBox="0 -13.5 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
            <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"/>
            <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"/>
            <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"/>
            <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"/>
            <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"/>
            <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"/>
          </svg>
        );
      case 'project':
        return '📁';
      default:
        return '📋';
    }
  };

  const selectedProject = currentView === 'project' && selectedProjectId 
    ? projects.find(p => p.id === selectedProjectId) 
    : null;

  const handleProjectTitleClick = () => {
    if (selectedProject) {
      setIsEditingProjectTitle(true);
      setEditingProjectTitle(selectedProject.name);
    }
  };

  const handleProjectTitleSave = () => {
    if (editingProjectTitle.trim() && editingProjectTitle !== selectedProject?.name && selectedProject) {
      const updatedProject = { ...selectedProject, name: editingProjectTitle.trim() };
      dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
    }
    setIsEditingProjectTitle(false);
  };

  const handleProjectTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleProjectTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingProjectTitle(false);
      setEditingProjectTitle(selectedProject?.name || '');
    }
  };

  useEffect(() => {
    // Update status periodically
    const interval = setInterval(() => {
      setBackendStatus(apiService.getBackendStatus());
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{getViewIcon()}</span>
          <div>
            {currentView === 'project' && selectedProject ? (
              isEditingProjectTitle ? (
                <input
                  type="text"
                  value={editingProjectTitle}
                  onChange={(e) => setEditingProjectTitle(e.target.value)}
                  onBlur={handleProjectTitleSave}
                  onKeyDown={handleProjectTitleKeyDown}
                  className="text-2xl font-semibold bg-white border border-primary-300 rounded px-3 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                />
              ) : (
                <h1 
                  className="text-2xl font-semibold text-gray-900 cursor-pointer hover:bg-gray-100 px-3 py-1 rounded"
                  onClick={handleProjectTitleClick}
                  title="Click to edit project name"
                >
                  {selectedProject.name}
                </h1>
              )
            ) : (
              <h1 className="text-2xl font-semibold text-gray-900">{getViewTitle()}</h1>
            )}
            {selectedProject && selectedProject.description && (
              <p className="text-sm text-gray-600 mt-1">{selectedProject.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {/* Backend Status Indicator - Only show in development */}
          {process.env.NODE_ENV === 'development' && (
            <div className="flex items-center space-x-2">
              {backendStatus.usingMockData ? (
                <div className="flex items-center px-2 py-1 bg-yellow-100 border border-yellow-300 rounded-md">
                  <span className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></span>
                  <span className="text-xs font-medium text-yellow-800">Mock Data</span>
                </div>
              ) : (
                <div className="flex items-center px-2 py-1 bg-green-100 border border-green-300 rounded-md">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                  <span className="text-xs font-medium text-green-800">Live Data</span>
                </div>
              )}
            </div>
          )}

          {selectedProject && (
            <button
              onClick={async () => {
                console.log('Drive folder URL:', selectedProject.driveFolderUrl);
                console.log('Drive folder ID:', selectedProject.driveFolderId);
                
                let driveUrl = selectedProject.driveFolderUrl;
                
                // If we don't have a URL but have a folder ID, construct the URL
                if (!driveUrl && selectedProject.driveFolderId) {
                  driveUrl = `https://drive.google.com/drive/folders/${selectedProject.driveFolderId}`;
                  console.log('Constructed drive URL from ID:', driveUrl);
                }
                
                // Check if we have a valid URL now
                if (!driveUrl || !driveUrl.startsWith('http')) {
                  console.log('❌ No drive folder configured for project:', selectedProject.name);
                  
                  // Offer to automatically fix missing drive folders
                  if (confirm('Drive folder not configured for this project yet. Would you like me to automatically create drive folders for all your projects now? This will take a moment.')) {
                    try {
                      console.log('🔧 Attempting to fix missing drive folders...');
                      const token = state.userProfile?.access_token || state.userProfile?.id_token;
                      if (!token) {
                        alert('Authentication error. Please refresh the page and try again.');
                        return;
                      }
                      
                      const result = await apiService.fixMissingDriveFolders(token);
                      console.log('✅ Drive folder fix result:', result);
                      
                      if (result.fixed > 0) {
                        alert(`Success! Created drive folders for ${result.fixed} projects. Please refresh the page to see the changes.`);
                      } else {
                        alert('No projects needed drive folder fixes. If you still see this error, check the master folder settings in your user menu.');
                      }
                    } catch (error) {
                      console.error('❌ Failed to fix drive folders:', error);
                      alert('Failed to create drive folders automatically. You can still view and manage project files in the "Project Files" section below. To set up drive folder integration, check the master folder settings in your user menu.');
                    }
                  }
                  return;
                }
                
                // URL is valid, open it
                window.open(driveUrl, '_blank', 'noopener,noreferrer');
              }}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              title={
                selectedProject.driveFolderUrl && selectedProject.driveFolderUrl.startsWith('http') 
                  ? "Open project folder in Google Drive"
                  : selectedProject.driveFolderId
                  ? "Open project folder in Google Drive (URL will be constructed)"
                  : "Drive folder not configured - check master folder settings"
              }
            >
              <span className="mr-2">📂</span>
              Open Drive Folder
              {!selectedProject.driveFolderUrl && !selectedProject.driveFolderId && (
                <span className="ml-2 text-xs text-orange-600">(Not Ready)</span>
              )}
              {!selectedProject.driveFolderUrl && selectedProject.driveFolderId && (
                <span className="ml-2 text-xs text-blue-600">(Auto)</span>
              )}
              {backendStatus.usingMockData && (
                <span className="ml-2 text-xs text-gray-500">(Demo)</span>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;