import React, { useState } from 'react';
import { useProjectTabs } from '../hooks/useProjectTabs';
import DraggableTaskList from './DraggableTaskList';
import ProjectFileList from './ProjectFileList';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

interface ProjectTabsProps {
  projectId: string;
}

export default function ProjectTabs({ projectId }: ProjectTabsProps) {
  const { activeTab, changeTab, error, clearError } = useProjectTabs(projectId);
  const { state, dispatch } = useApp();
  const [creatingDocument, setCreatingDocument] = useState<string | null>(null);
  const [showNameInput, setShowNameInput] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  
  const project = state.projects.find(p => p.id === projectId);
  
  const createDocument = async (type: 'doc' | 'sheet') => {
    if (!fileName.trim()) {
      alert('Please enter a file name');
      return;
    }

    setCreatingDocument(type);
    try {
      const userProfile = state.userProfile;
      if (!userProfile) throw new Error('Not authenticated');

      let result;
      if (type === 'doc') {
        result = await apiService.createGoogleDoc(projectId, fileName, null, userProfile.id_token);
      } else {
        result = await apiService.createGoogleSheet(projectId, fileName, null, userProfile.id_token);
      }

      if (result && result.data && result.data.documentUrl) {
        console.log('Document created successfully:', result);
        setFileName('');
        setShowNameInput(null);
        
        // Open the created document directly in a new tab
        window.open(result.data.documentUrl, '_blank', 'noopener,noreferrer');
        
      } else {
        console.error('Invalid response from document creation:', result);
        dispatch({ 
          type: 'SET_ERROR', 
          payload: `Failed to create ${type}: Invalid response from server` 
        });
      }
    } catch (error) {
      console.error('Failed to create document:', error);
      dispatch({ 
        type: 'SET_ERROR', 
        payload: `Failed to create ${type}: ${error instanceof Error ? error.message : 'Unknown error'}` 
      });
    } finally {
      setCreatingDocument(null);
    }
  };

  const handleCreateClick = (type: 'doc' | 'sheet') => {
    setShowNameInput(type);
    setFileName(`New ${type === 'doc' ? 'Document' : 'Spreadsheet'}`);
  };
  
  if (!project) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="text-red-800">Project not found</div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-white">
      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8 px-6">
          <TabButton 
            active={activeTab === 'tasks'} 
            onClick={() => changeTab('tasks')}
            icon="📋"
          >
            Tasks
          </TabButton>
          <TabButton 
            active={activeTab === 'files'} 
            onClick={() => changeTab('files')}
            icon="📁"
          >
            Files
          </TabButton>
          <TabButton 
            active={activeTab === 'documents'} 
            onClick={() => changeTab('documents')}
            icon="📝"
          >
            Documents
          </TabButton>
        </nav>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border-b border-red-200 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-red-800 text-sm">{error}</div>
            <button 
              onClick={clearError}
              className="text-red-600 hover:text-red-800"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'tasks' && <DraggableTaskList />}
        {activeTab === 'files' && (
          <div className="p-6">
            <ProjectFileList 
              projectId={projectId}
              refreshTrigger={0}
            />
          </div>
        )}
        {activeTab === 'documents' && (
          <div className="p-6">
            <div className="text-center mb-8">
              <div className="text-4xl mb-4">📝</div>
              <div className="text-lg font-medium mb-2">Create New Document</div>
              <div className="text-sm text-gray-600">Create Google Docs and Sheets directly in this project</div>
            </div>
            
            <div className="max-w-md mx-auto space-y-4">
              <button
                onClick={() => handleCreateClick('doc')}
                disabled={creatingDocument === 'doc'}
                className="w-full flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              >
                <span className="text-2xl mr-3">📝</span>
                <div className="text-left">
                  <div className="font-medium">Google Doc</div>
                  <div className="text-sm text-gray-500">Create a new document</div>
                </div>
                {creatingDocument === 'doc' && <span className="ml-auto">...</span>}
              </button>
              
              <button
                onClick={() => handleCreateClick('sheet')}
                disabled={creatingDocument === 'sheet'}
                className="w-full flex items-center justify-center px-6 py-4 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 transition-colors"
              >
                <span className="text-2xl mr-3">📊</span>
                <div className="text-left">
                  <div className="font-medium">Google Sheets</div>
                  <div className="text-sm text-gray-500">Create a new spreadsheet</div>
                </div>
                {creatingDocument === 'sheet' && <span className="ml-auto">...</span>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* File name input modal */}
      {showNameInput && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-96">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Create New {showNameInput === 'doc' ? 'Document' : 'Spreadsheet'}
            </h3>
            <input
              type="text"
              value={fileName}
              onChange={(e) => setFileName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && createDocument(showNameInput as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Enter file name"
              autoFocus
            />
            <div className="flex justify-end space-x-3 mt-4">
              <button
                onClick={() => {
                  setShowNameInput(null);
                  setFileName('');
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => createDocument(showNameInput as any)}
                disabled={!fileName.trim() || creatingDocument}
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 disabled:opacity-50"
              >
                {creatingDocument ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon?: string;
}

function TabButton({ active, onClick, children, icon }: TabButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap flex items-center space-x-2
        ${active 
          ? 'border-primary-500 text-primary-600' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
        }
      `}
    >
      {icon && <span>{icon}</span>}
      <span>{children}</span>
    </button>
  );
}