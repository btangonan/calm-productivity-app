import Header from './Header';
import DraggableTaskList from './DraggableTaskList';
import AISuggestions from './AISuggestions';
import GoogleIntegrations from './GoogleIntegrations';
import { useApp } from '../context/AppContext';

const MainContent = () => {
  const { state } = useApp();
  const { currentView, selectedProjectId } = state;

  const showAISuggestions = currentView === 'project' && selectedProjectId;
  const showGoogleIntegrations = true; // Always show Google integrations

  return (
    <div className="flex-1 flex flex-col bg-gray-50">
      <Header />
      
      <div className="flex-1 flex">
        <div className="flex-1 flex flex-col">
          <DraggableTaskList />
        </div>
        
        <div className="w-96 border-l border-gray-200 bg-gray-50 p-4 space-y-4 overflow-y-auto">
          {showAISuggestions && (
            <div className="bg-white rounded-lg">
              <AISuggestions />
            </div>
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