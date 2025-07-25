import Header from './Header';
import DraggableTaskList from './DraggableTaskList';
import AISuggestions from './AISuggestions';
import GoogleIntegrations from './GoogleIntegrations';
import FileDropzone from './FileDropzone';
import ProjectFileList from './ProjectFileList';
import { useApp } from '../context/AppContext';
import { useState } from 'react';

const MainContent = () => {
  const { state } = useApp();
  const { currentView, selectedProjectId } = state;
  const [fileRefreshTrigger, setFileRefreshTrigger] = useState(0);

  const showProjectFeatures = currentView === 'project' && selectedProjectId;
  const showGoogleIntegrations = true; // Always show Google integrations

  const handleFilesUploaded = (files: File[]) => {
    // Refresh the file list when new files are uploaded
    setFileRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-h-0">
          <DraggableTaskList />
        </div>
        
        <div className="w-96 border-l border-gray-200 bg-gray-50 p-4 space-y-4 overflow-y-auto">
          {showProjectFeatures && (
            <>
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
            </>
          )}
          
          {showGoogleIntegrations && (
            <GoogleIntegrations />
          )}
        </div>
      </div>
    </div>
  );
};

export default MainContent;