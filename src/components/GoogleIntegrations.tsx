import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

const GoogleIntegrations = () => {
  const { state, dispatch } = useApp();
  const { selectedProjectId, projects } = state;
  const [loading, setLoading] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<any>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);

  const handleProcessGmail = async () => {
    setLoading(true);
    try {
      const newTasks = await apiService.processGmailToTasks();
      newTasks.forEach(task => {
        dispatch({ type: 'ADD_TASK', payload: task });
      });
      alert(`Processed ${newTasks.length} emails into tasks`);
    } catch (error) {
      console.error('Failed to process Gmail:', error);
      alert('Failed to process Gmail. Check your setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleSyncCalendar = async () => {
    setLoading(true);
    try {
      const syncResults = await apiService.syncTasksWithCalendar();
      alert(`Calendar sync completed: ${syncResults.length} tasks processed`);
    } catch (error) {
      console.error('Failed to sync calendar:', error);
      alert('Failed to sync calendar. Check your setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateDocument = async (templateType: 'project-notes' | 'meeting-notes' | 'project-plan') => {
    if (!selectedProject) return;
    
    setLoading(true);
    try {
      const document = await apiService.createProjectDocument(
        selectedProject.id, 
        selectedProject.name, 
        templateType
      );
      window.open(document.documentUrl, '_blank');
    } catch (error) {
      console.error('Failed to create document:', error);
      alert('Failed to create document. Check your setup.');
    } finally {
      setLoading(false);
    }
  };

  const handleTestIntegrations = async () => {
    setLoading(true);
    try {
      const results = await apiService.testGoogleIntegrations();
      setIntegrationStatus(results);
    } catch (error) {
      console.error('Failed to test integrations:', error);
      setIntegrationStatus({ error: 'Failed to test integrations' });
    } finally {
      setLoading(false);
    }
  };

  const handleSetupTriggers = async () => {
    setLoading(true);
    try {
      await apiService.setupGoogleTriggers();
      alert('Google triggers set up successfully! Email-to-task conversion and calendar sync are now automated.');
    } catch (error) {
      console.error('Failed to setup triggers:', error);
      alert('Failed to setup triggers. Check your permissions.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Google Integrations</h2>
      
      {/* Gmail Integration */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-800 mb-2">📧 Gmail</h3>
        <p className="text-sm text-gray-600 mb-3">
          Convert emails with the "to-task" label into tasks automatically.
        </p>
        <button
          onClick={handleProcessGmail}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <span className="mr-2">📧</span>
          Process Gmail
        </button>
      </div>

      {/* Calendar Integration */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-800 mb-2">📅 Google Calendar</h3>
        <p className="text-sm text-gray-600 mb-3">
          Sync tasks with due dates to your Google Calendar.
        </p>
        <button
          onClick={handleSyncCalendar}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <span className="mr-2">📅</span>
          Sync Calendar
        </button>
      </div>

      {/* Google Docs Integration */}
      {selectedProject && (
        <div className="mb-6">
          <h3 className="text-md font-medium text-gray-800 mb-2">📄 Google Docs</h3>
          <p className="text-sm text-gray-600 mb-3">
            Create project documents in your project folder.
          </p>
          <div className="space-x-2">
            <button
              onClick={() => handleCreateDocument('project-notes')}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="mr-2">📝</span>
              Project Notes
            </button>
            <button
              onClick={() => handleCreateDocument('meeting-notes')}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="mr-2">🤝</span>
              Meeting Notes
            </button>
            <button
              onClick={() => handleCreateDocument('project-plan')}
              disabled={loading}
              className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
            >
              <span className="mr-2">📋</span>
              Project Plan
            </button>
          </div>
        </div>
      )}

      {/* Automation Setup */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-800 mb-2">⚡ Automation</h3>
        <p className="text-sm text-gray-600 mb-3">
          Set up automated triggers for Gmail processing and calendar sync.
        </p>
        <button
          onClick={handleSetupTriggers}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <span className="mr-2">⚡</span>
          Setup Automation
        </button>
      </div>

      {/* Test Integrations */}
      <div className="mb-6">
        <h3 className="text-md font-medium text-gray-800 mb-2">🔧 Test & Setup</h3>
        <p className="text-sm text-gray-600 mb-3">
          Test your Google services integration setup.
        </p>
        <button
          onClick={handleTestIntegrations}
          disabled={loading}
          className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
        >
          <span className="mr-2">🔧</span>
          Test Integrations
        </button>
      </div>

      {/* Integration Status */}
      {integrationStatus && (
        <div className="bg-gray-50 rounded-md p-4">
          <h4 className="text-sm font-medium text-gray-800 mb-2">Integration Status:</h4>
          <div className="space-y-1 text-sm">
            {Object.entries(integrationStatus).map(([service, status]) => (
              <div key={service} className="flex items-center">
                <span className="capitalize mr-2 font-medium">{service}:</span>
                <span className={String(status).includes('✓') ? 'text-green-600' : 'text-red-600'}>
                  {String(status)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center mt-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          <span className="ml-2 text-sm text-gray-600">Processing...</span>
        </div>
      )}
    </div>
  );
};

export default GoogleIntegrations;