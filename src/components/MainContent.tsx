import Header from './Header';
import DraggableTaskList from './DraggableTaskList';
import AISuggestions from './AISuggestions';
import CalendarPanel from './CalendarPanel';
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
  const [gmailPanelHeight, setGmailPanelHeight] = useState(400); // Initial height in pixels
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const [useEnhancedProjectView, setUseEnhancedProjectView] = useState(
    localStorage.getItem('enhanced-project-view') !== 'false' // Default to true
  );

  const showProjectFeatures = currentView === 'project' && selectedProjectId;

  const handleFilesUploaded = (files: File[]) => {
    // Refresh the file list when new files are uploaded
    setFileRefreshTrigger(prev => prev + 1);
  };

  const handleRightMouseDown = (e: React.MouseEvent) => {
    setIsResizingRight(true);
    e.preventDefault();
  };

  const handleVerticalMouseDown = (e: React.MouseEvent) => {
    setIsResizingVertical(true);
    e.preventDefault();
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRight) {
        const rightEdgeX = window.innerWidth - e.clientX;
        // Constrain width between 280px and 800px (allow dragging further left)
        const constrainedWidth = Math.min(Math.max(rightEdgeX, 280), 800);
        setRightSidebarWidth(constrainedWidth);
      }
      
      if (isResizingVertical) {
        // Constrain Gmail panel height between 200px and 600px
        const constrainedHeight = Math.min(Math.max(e.clientY - 60, 200), 600); // 60px offset for header
        setGmailPanelHeight(constrainedHeight);
      }
    };

    const handleMouseUp = () => {
      setIsResizingRight(false);
      setIsResizingVertical(false);
    };

    if (isResizingRight || isResizingVertical) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingRight ? 'col-resize' : 'row-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingRight, isResizingVertical]);

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
        
        {/* All content in a flex column container */}
        <div className="flex flex-col h-full">
          {/* Gmail Panel - Fixed height, scrollable */}
          <div 
            className="flex-shrink-0 border-b border-gray-200 overflow-hidden"
            style={{ height: `${gmailPanelHeight}px` }}
          >
            <GmailPanel />
          </div>
          
          {/* Horizontal resize handle */}
          <div
            className="h-2 cursor-row-resize hover:bg-blue-400 bg-gray-200 border-t border-gray-300 flex-shrink-0"
            onMouseDown={handleVerticalMouseDown}
          />
          
          {/* Scrollable content below Gmail - takes remaining space */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
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
            
            {/* Google Calendar - always visible */}
            <div className={`bg-white rounded-lg shadow-sm border border-gray-200 ${showProjectFeatures && !useEnhancedProjectView ? "border-t border-gray-200 pt-4" : ""}`}>
              <CalendarPanel />
            </div>
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