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

          {selectedProject && selectedProject.driveFolderUrl && (
            <a
              href={selectedProject.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              title={backendStatus.usingMockData ? "Connect Google Apps Script backend to create real Drive folders" : "Open project folder in Google Drive"}
            >
              <span className="mr-2">📂</span>
              Open Drive Folder
              {backendStatus.usingMockData && (
                <span className="ml-2 text-xs text-gray-500">(Demo)</span>
              )}
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;