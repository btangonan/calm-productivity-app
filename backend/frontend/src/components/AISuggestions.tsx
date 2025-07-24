import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

const AISuggestions = () => {
  const { state } = useApp();
  const { projects, tasks, selectedProjectId } = state;
  const [suggestions, setSuggestions] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const projectTasks = tasks.filter(t => t.projectId === selectedProjectId);

  const handleGetSuggestions = async () => {
    if (!selectedProject) return;

    setLoading(true);
    try {
      const aiSuggestions = await apiService.getAISuggestions(selectedProject.name, projectTasks);
      setSuggestions(aiSuggestions);
    } catch (error) {
      console.error('Failed to get AI suggestions:', error);
      setSuggestions('Failed to get AI suggestions. Please ensure Ollama is running locally.');
    } finally {
      setLoading(false);
    }
  };

  if (!selectedProject) {
    return null;
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-2">AI Suggestions</h2>
        <p className="text-sm text-gray-600 mb-4">
          Get intelligent suggestions for your project progress and next steps.
        </p>
        
        <button
          onClick={handleGetSuggestions}
          disabled={loading}
          className="w-full inline-flex items-center justify-center px-4 py-2 border border-transparent rounded-md text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Getting suggestions...
            </>
          ) : (
            <>
              <span className="mr-2">🤖</span>
              Get Suggestions
            </>
          )}
        </button>
      </div>

      {suggestions && (
        <div className="flex-1 p-4 overflow-y-auto">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Suggestions for "{selectedProject.name}"</h3>
            <div className="text-sm text-gray-700 whitespace-pre-wrap">
              {suggestions}
            </div>
          </div>
        </div>
      )}

      {!suggestions && !loading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-4xl mb-2">🤖</div>
            <p className="text-sm text-gray-500">
              Click "Get Suggestions" to see AI-powered recommendations for this project.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AISuggestions;