import { useState } from 'react';
import { useApp } from '../context/AppContext';
import type { ViewType } from '../types';
import ProjectForm from './ProjectForm';

const Sidebar = () => {
  const { state, dispatch } = useApp();
  const { currentView, selectedProjectId, projects, tasks } = state;
  const [showProjectForm, setShowProjectForm] = useState(false);

  const handleViewChange = (view: ViewType) => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  };

  const handleProjectSelect = (projectId: string) => {
    dispatch({ type: 'SET_SELECTED_PROJECT', payload: projectId });
  };

  const getTaskCountForView = (view: ViewType): number => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    switch (view) {
      case 'inbox':
        return tasks.filter(task => !task.projectId && !task.isCompleted).length;
      case 'today':
        return tasks.filter(task => 
          !task.isCompleted && task.dueDate && new Date(task.dueDate) <= today
        ).length;
      case 'upcoming':
        return tasks.filter(task => 
          !task.isCompleted && task.dueDate && new Date(task.dueDate) > today
        ).length;
      case 'anytime':
        return tasks.filter(task => !task.isCompleted && !task.dueDate).length;
      case 'logbook':
        return tasks.filter(task => task.isCompleted).length;
      default:
        return 0;
    }
  };

  const getProjectTaskCount = (projectId: string): number => {
    return tasks.filter(task => task.projectId === projectId && !task.isCompleted).length;
  };

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen overflow-y-auto">
      <div className="p-4">
        <h1 className="text-xl font-semibold text-gray-900 mb-6">Calm Productivity</h1>
        
        {/* Standard Views */}
        <div className="mb-6">
          <div className="space-y-1">
            <div
              className={`sidebar-item ${currentView === 'inbox' ? 'active' : ''}`}
              onClick={() => handleViewChange('inbox')}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-lg mr-3">📥</span>
                  <span>Inbox</span>
                </div>
                {getTaskCountForView('inbox') > 0 && (
                  <span className="text-sm text-gray-500">{getTaskCountForView('inbox')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'today' ? 'active' : ''}`}
              onClick={() => handleViewChange('today')}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-lg mr-3">📅</span>
                  <span>Today</span>
                </div>
                {getTaskCountForView('today') > 0 && (
                  <span className="text-sm text-gray-500">{getTaskCountForView('today')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'upcoming' ? 'active' : ''}`}
              onClick={() => handleViewChange('upcoming')}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-lg mr-3">📆</span>
                  <span>Upcoming</span>
                </div>
                {getTaskCountForView('upcoming') > 0 && (
                  <span className="text-sm text-gray-500">{getTaskCountForView('upcoming')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'anytime' ? 'active' : ''}`}
              onClick={() => handleViewChange('anytime')}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-lg mr-3">⭐</span>
                  <span>Anytime</span>
                </div>
                {getTaskCountForView('anytime') > 0 && (
                  <span className="text-sm text-gray-500">{getTaskCountForView('anytime')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'logbook' ? 'active' : ''}`}
              onClick={() => handleViewChange('logbook')}
            >
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center">
                  <span className="text-lg mr-3">✅</span>
                  <span>Logbook</span>
                </div>
                {getTaskCountForView('logbook') > 0 && (
                  <span className="text-sm text-gray-500">{getTaskCountForView('logbook')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Projects</h2>
            <button 
              onClick={() => setShowProjectForm(true)}
              className="text-gray-400 hover:text-gray-600 text-lg"
            >
              +
            </button>
          </div>
          
          <div className="space-y-1">
            {projects
              .filter(project => project.status === 'Active')
              .map(project => (
                <div
                  key={project.id}
                  className={`sidebar-item ${
                    currentView === 'project' && selectedProjectId === project.id ? 'active' : ''
                  }`}
                  onClick={() => handleProjectSelect(project.id)}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center">
                      <span className="text-lg mr-3">📁</span>
                      <span className="truncate">{project.name}</span>
                    </div>
                    {getProjectTaskCount(project.id) > 0 && (
                      <span className="text-sm text-gray-500">{getProjectTaskCount(project.id)}</span>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>
      
      {showProjectForm && (
        <ProjectForm 
          onClose={() => setShowProjectForm(false)}
          onSubmit={() => setShowProjectForm(false)}
        />
      )}
    </div>
  );
};

export default Sidebar;