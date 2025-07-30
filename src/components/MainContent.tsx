import Header from './Header';
import DraggableTaskList from './DraggableTaskList';
import AISuggestions from './AISuggestions';
import GoogleIntegrations from './GoogleIntegrations';
import FileDropzone from './FileDropzone';
import ProjectFileList from './ProjectFileList';
import ProjectTabs from './ProjectTabs';
import TaskForm from './TaskForm';
import DriveBrowser from './DriveBrowser';
import GmailPanel from './GmailPanel';
import { useApp } from '../context/AppContext';
import { useState, useEffect } from 'react';

const MainContent = () => {
  const { state } = useApp();
  const { currentView, selectedProjectId } = state;
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(384); // 24rem = 384px
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [useEnhancedProjectView, setUseEnhancedProjectView] = useState(
    localStorage.getItem('enhanced-project-view') !== 'false' // Default to true
  );

  const showProjectFeatures = currentView === 'project' && selectedProjectId;
  const showGoogleIntegrations = true; // Always show Google integrations

  const handleFilesUploaded = (files: File[]) => {
    // Refresh the file list when new files are uploaded
    setFileRefreshTrigger(prev => prev + 1);
  };

  const handleRightMouseDown = (e: React.MouseEvent) => {
    setIsResizingRight(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizingRight) return;
      
      const rightEdgeX = window.innerWidth - e.clientX;
      // Constrain width between 300px and 600px
      const constrainedWidth = Math.min(Math.max(rightEdgeX, 300), 600);
      setRightSidebarWidth(constrainedWidth);
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
    };

    if (isResizingRight) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingRight]);

  return (
    <div className="flex-1 flex bg-gray-50 relative">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0">
        <Header />
        {currentView === 'drive' ? (
          <DriveBrowser className="flex-1 overflow-y-auto" />
        ) : currentView === 'project' && selectedProjectId && useEnhancedProjectView ? (
          <ProjectTabs projectId={selectedProjectId} />
        ) : (
          <DraggableTaskList />
        )}
      </div>
      
      
      {/* Right sidebar with integrations and project features */}
      <div 
        className="border-l border-gray-200 bg-gray-50 relative flex-shrink-0 h-screen overflow-y-auto"
        style={{ width: `${rightSidebarWidth}px` }}
      >
        {/* Resize handle */}
        <div
          className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-gray-200 border-l border-gray-300 z-10"
          onMouseDown={handleRightMouseDown}
          style={{ left: '-1px' }}
        />
        
        {/* All content in a single scrollable container */}
        <div className="flex flex-col h-full">
          {/* Gmail Panel - Always at the top */}
          <div className="border-b border-gray-200">
            <GmailPanel />
          </div>
          
          {/* Scrollable content below Gmail */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {/* Project features section - only show when not using enhanced view */}
            {showProjectFeatures && !useEnhancedProjectView && (
              <div className="space-y-4">
                <FileDropzone 
                  projectId={selectedProjectId!} 
                  onFilesUploaded={handleFilesUploaded}
                />
                <ProjectFileList 
                  projectId={selectedProjectId!}
                  refreshTrigger={fileRefreshTrigger}
                />
                <div className="bg-white rounded-lg">
                  <AISuggestions />
                </div>
              </div>
            )}
            
            {/* Google integrations - always visible */}
            {showGoogleIntegrations && (
              <div className={showProjectFeatures && !useEnhancedProjectView ? "border-t border-gray-200 pt-4" : ""}>
                <GoogleIntegrations />
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Task form modal */}
      {showTaskForm && (
        <TaskForm 
          onClose={() => setShowTaskForm(false)}
          onSubmit={() => setShowTaskForm(false)}
        />
      )}
    </div>
  );
};

export default MainContent;