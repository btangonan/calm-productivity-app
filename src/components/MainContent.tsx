import Header from './Header';
import DraggableTaskList from './DraggableTaskList';
import AISuggestions from './AISuggestions';
import GoogleIntegrations from './GoogleIntegrations';
import FileDropzone from './FileDropzone';
import ProjectFileList from './ProjectFileList';
import TaskForm from './TaskForm';
import { useApp } from '../context/AppContext';
import { useState, useEffect } from 'react';

const MainContent = () => {
  const { state } = useApp();
  const { currentView, selectedProjectId } = state;
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [rightSidebarWidth, setRightSidebarWidth] = useState(384); // 24rem = 384px
  const [isResizingRight, setIsResizingRight] = useState(false);

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
        <DraggableTaskList />
      </div>
      
      {/* Add Task button positioned at the divider */}
      <div 
        className="absolute top-4 z-10"
        style={{ right: `${rightSidebarWidth + 16}px` }}
      >
        <button 
          onClick={() => setShowTaskForm(true)}
          className="inline-flex items-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 transition-colors shadow-lg"
        >
          <span className="mr-2">+</span>
          Add Task
        </button>
      </div>
      
      {/* Right sidebar with integrations and project features */}
      <div 
        className="border-l border-gray-200 bg-gray-50 flex flex-col relative flex-shrink-0"
        style={{ width: `${rightSidebarWidth}px` }}
      >
        {/* Resize handle */}
        <div
          className="absolute top-0 left-0 w-2 h-full cursor-col-resize hover:bg-blue-400 bg-gray-200 border-l border-gray-300"
          onMouseDown={handleRightMouseDown}
          style={{ left: '-1px' }}
        />
        {/* Project features section */}
        {showProjectFeatures && (
          <div className="p-4 space-y-4 border-b border-gray-200">
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
        
        {/* Google integrations - always visible, spans full height */}
        {showGoogleIntegrations && (
          <div className="flex-1 overflow-y-auto">
            <GoogleIntegrations />
          </div>
        )}
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