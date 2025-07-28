import React from 'react';
import { useProjectTabs } from '../hooks/useProjectTabs';
import DraggableTaskList from './DraggableTaskList';
import ProjectFileList from './ProjectFileList';
import { useApp } from '../context/AppContext';

interface ProjectTabsProps {
  projectId: string;
}

export default function ProjectTabs({ projectId }: ProjectTabsProps) {
  const { activeTab, changeTab, error, clearError } = useProjectTabs(projectId);
  const { state } = useApp();
  
  const project = state.projects.find(p => p.id === projectId);
  
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
      </div>

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