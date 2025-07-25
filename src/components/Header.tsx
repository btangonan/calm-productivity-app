import { useApp } from '../context/AppContext';

const Header = () => {
  const { state } = useApp();
  const { currentView, selectedProjectId, projects } = state;

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

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-2xl mr-3">{getViewIcon()}</span>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{getViewTitle()}</h1>
            {selectedProject && selectedProject.description && (
              <p className="text-sm text-gray-600 mt-1">{selectedProject.description}</p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {selectedProject && selectedProject.driveFolderUrl && (
            <a
              href={selectedProject.driveFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <span className="mr-2">📂</span>
              Open Drive Folder
            </a>
          )}
        </div>
      </div>
    </div>
  );
};

export default Header;