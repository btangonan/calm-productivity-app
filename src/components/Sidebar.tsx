import { useState, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import type { ViewType } from '../types';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { useDrag, useDrop } from 'react-dnd';
import { googleLogout } from '@react-oauth/google';
import { apiService } from '../services/api';
import TaskForm from './TaskForm';

const Sidebar = () => {
  const { state, dispatch } = useApp();
  const { currentView, selectedProjectId, areas, projects, tasks, userProfile } = state;
  const [expandedAreas, setExpandedAreas] = useState<Set<string>>(new Set());
  const [showCreateDropdown, setShowCreateDropdown] = useState(false);
  const [editingItem, setEditingItem] = useState<{ id: string; type: 'area' | 'project'; name: string } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [showOptionsDropdown, setShowOptionsDropdown] = useState<string | null>(null);
  const optionsDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowCreateDropdown(false);
      }
      if (optionsDropdownRef.current && !optionsDropdownRef.current.contains(event.target as Node)) {
        setShowOptionsDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close options dropdown when switching between different items
  const handleOptionsDropdownToggle = (itemId: string) => {
    setShowOptionsDropdown(showOptionsDropdown === itemId ? null : itemId);
  };

  const handleViewChange = (view: ViewType) => {
    dispatch({ type: 'SET_CURRENT_VIEW', payload: view });
  };

  const handleProjectSelect = (projectId: string) => {
    dispatch({ type: 'SET_SELECTED_PROJECT', payload: projectId });
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      googleLogout();
      dispatch({ type: 'LOGOUT' });
    }
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

  const toggleAreaExpansion = (areaId: string) => {
    const newExpanded = new Set(expandedAreas);
    if (newExpanded.has(areaId)) {
      newExpanded.delete(areaId);
    } else {
      newExpanded.add(areaId);
    }
    setExpandedAreas(newExpanded);
  };


  const getProjectsForArea = (areaId: string) => {
    return projects.filter(project => project.areaId === areaId && project.status === 'Active');
  };

  const moveProjectToArea = async (projectId: string, areaId: string) => {
    console.log(`Moving project ${projectId} to area ${areaId}`);
    try {
      // Update project's areaId
      await apiService.updateProjectArea(projectId, areaId);
      
      // Update local state
      const project = projects.find(p => p.id === projectId);
      if (project) {
        console.log(`Updating project ${project.name} from area ${project.areaId} to ${areaId}`);
        dispatch({
          type: 'UPDATE_PROJECT',
          payload: {
            ...project,
            areaId: areaId,
          },
        });
      }
    } catch (error) {
      console.error('Failed to update project area:', error);
    }
  };

  const createNewArea = async () => {
    if (isCreating) return;
    setIsCreating(true);
    console.log('Creating new area...', Date.now());
    try {
      const newArea = await apiService.createArea('New Area', '');
      console.log('Created area:', newArea, Date.now());
      dispatch({ type: 'ADD_AREA', payload: newArea });
      setEditingItem({ id: newArea.id, type: 'area', name: newArea.name });
      setExpandedAreas(prev => new Set([...prev, newArea.id]));
    } catch (error) {
      console.error('Failed to create area:', error);
    } finally {
      setTimeout(() => setIsCreating(false), 500);
    }
  };

  const createNewProject = async (areaId?: string) => {
    if (isCreating) return;
    setIsCreating(true);
    console.log('Creating new project...', { areaId });
    try {
      const newProject = await apiService.createProject('New Project', '', areaId);
      console.log('Created project:', newProject);
      dispatch({ type: 'ADD_PROJECT', payload: newProject });
      setEditingItem({ id: newProject.id, type: 'project', name: newProject.name });
      if (areaId) {
        setExpandedAreas(prev => new Set([...prev, areaId]));
      }
    } catch (error) {
      console.error('Failed to create project:', error);
    } finally {
      setTimeout(() => setIsCreating(false), 500);
    }
  };

  const saveItemName = async (id: string, type: 'area' | 'project', newName: string) => {
    if (!newName.trim()) return;
    
    try {
      if (type === 'area') {
        const area = areas.find(a => a.id === id);
        if (area) {
          const updatedArea = { ...area, name: newName.trim() };
          dispatch({ type: 'UPDATE_AREA', payload: updatedArea });
        }
      } else {
        const project = projects.find(p => p.id === id);
        if (project) {
          const updatedProject = { ...project, name: newName.trim() };
          dispatch({ type: 'UPDATE_PROJECT', payload: updatedProject });
        }
      }
      setEditingItem(null);
    } catch (error) {
      console.error('Failed to save item name:', error);
    }
  };

  const handleItemClick = (id: string, type: 'area' | 'project', name: string) => {
    if (type === 'project') {
      // For projects: if already selected, start editing; otherwise select it
      if (selectedProjectId === id && currentView === 'project') {
        setEditingItem({ id, type, name });
      } else {
        handleProjectSelect(id);
      }
    } else {
      // For areas: if area is expanded and not currently editing, start editing
      if (expandedAreas.has(id)) {
        setEditingItem({ id, type, name });
      } else {
        toggleAreaExpansion(id);
      }
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to delete the project "${projectName}"?`)) {
      try {
        const userProfile = state.userProfile;
        if (!userProfile) {
          throw new Error('Not authenticated');
        }

        // Call backend API to delete project
        await apiService.deleteProject(projectId, userProfile.id_token);
        
        // Update local state after successful backend deletion
        dispatch({ type: 'DELETE_PROJECT', payload: projectId });
        setShowOptionsDropdown(null);
      } catch (error) {
        console.error('Failed to delete project:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to delete project' });
      }
    }
  };

  const handleDeleteArea = async (areaId: string, areaName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const areaProjects = getProjectsForArea(areaId);
    if (areaProjects.length > 0) {
      if (!window.confirm(`The area "${areaName}" contains ${areaProjects.length} project(s). Deleting this area will move its projects to "Unorganized Projects". Continue?`)) {
        return;
      }
    } else {
      if (!window.confirm(`Are you sure you want to delete the area "${areaName}"?`)) {
        return;
      }
    }
    
    try {
      const userProfile = state.userProfile;
      if (!userProfile) {
        throw new Error('Not authenticated');
      }

      // Call backend API to delete area (this also moves projects to unorganized)
      await apiService.deleteArea(areaId, userProfile.id_token);
      
      // Update local state after successful backend deletion
      // Move projects to unorganized (null areaId)
      areaProjects.forEach(project => {
        dispatch({ type: 'UPDATE_PROJECT', payload: { ...project, areaId: null } });
      });
      
      dispatch({ type: 'DELETE_AREA', payload: areaId });
      setShowOptionsDropdown(null);
    } catch (error) {
      console.error('Failed to delete area:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete area' });
    }
  };

  // Draggable Project Component
  const DraggableProject = ({ project }: { project: any }) => {
    const [{ isDragging }, drag] = useDrag({
      type: 'project',
      item: { id: project.id, type: 'project' },
      end: (item, monitor) => {
        const didDrop = monitor.didDrop();
        console.log(`Drag ended for project ${item.id}, dropped: ${didDrop}`);
      },
      collect: (monitor) => ({
        isDragging: monitor.isDragging(),
      }),
    });

    return (
      <div
        className={`sidebar-item group ${
          currentView === 'project' && selectedProjectId === project.id ? 'active' : ''
        } ${isDragging ? 'opacity-50' : ''}`}
      >
        <div className="flex items-center w-full min-w-0">
          <div
            ref={drag as any}
            className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 mr-1 flex-shrink-0"
            title="Drag to move to different area"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </div>
          <div 
            className="flex items-center flex-1 cursor-pointer min-w-0"
            onClick={() => handleItemClick(project.id, 'project', project.name)}
          >
            <span className="text-lg mr-2 flex-shrink-0">📁</span>
            {editingItem?.id === project.id && editingItem?.type === 'project' ? (
              <input
                type="text"
                value={editingItem.name}
                onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                onBlur={() => saveItemName(project.id, 'project', editingItem.name)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    saveItemName(project.id, 'project', editingItem.name);
                  } else if (e.key === 'Escape') {
                    setEditingItem(null);
                  }
                }}
                className="bg-transparent border-none outline-none flex-1 min-w-0"
                autoFocus
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span className="truncate min-w-0" title={project.name}>
                {project.name}
              </span>
            )}
          </div>
          <div className="flex items-center">
            {getProjectTaskCount(project.id) > 0 && (
              <span className="text-sm text-gray-500 flex-shrink-0 ml-1 w-4 text-right">{getProjectTaskCount(project.id)}</span>
            )}
            {/* Three dots menu for project */}
            <div className="relative ml-1" ref={showOptionsDropdown === `project-${project.id}` ? optionsDropdownRef : null}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOptionsDropdownToggle(`project-${project.id}`);
                }}
                className="opacity-100 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="Project options"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                </svg>
              </button>
              
              {showOptionsDropdown === `project-${project.id}` && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[120px]">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingItem({ id: project.id, type: 'project', name: project.name });
                      setShowOptionsDropdown(null);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 flex items-center"
                  >
                    <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                    </svg>
                    Edit
                  </button>
                  <button
                    onClick={(e) => handleDeleteProject(project.id, project.name, e)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 hover:bg-red-50 flex items-center"
                  >
                    <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Droppable Area Component
  const DroppableArea = ({ area, children }: { area: any; children: React.ReactNode }) => {
    const [{ isOver }, drop] = useDrop({
      accept: 'project',
      drop: (item: { id: string; type: string }) => {
        console.log(`Dropping project ${item.id} into area ${area.id}`);
        moveProjectToArea(item.id, area.id);
        return { dropped: true };
      },
      collect: (monitor) => ({
        isOver: monitor.isOver(),
      }),
    });

    return (
      <div
        ref={drop as any}
        className={`transition-colors ${isOver ? 'bg-blue-50 border border-blue-300 border-dashed rounded' : ''}`}
      >
        {children}
      </div>
    );
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="w-full h-full overflow-y-auto">
        <div className="p-4">
        <div className="mb-6 px-3">
          {/* Header with app name and quick task button */}
          <div className="flex items-center justify-between mb-4">
            <svg width="120" height="32" viewBox="0 0 937.41 591.4" className="fill-gray-900">
              <path d="M254.22,298.5c-13.17-39.02-24.99-77.71-43.12-114.03-3.81-7.63-8-14.98-13.88-21.19-12.19-12.88-29.42-9.17-35.46,7.7-2.53,7.08-3.29,14.49-3.29,22.09.09,127.25.05,254.51.03,381.76,0,9.86-5,14.79-15.01,14.79-43.07,0-86.14-.27-129.21.22-9.63.11-12-3.02-11.98-12.25.28-143.57-.37-287.14.64-430.7.3-42.19,13.18-81.03,45.92-110.58,18.72-16.89,41.19-26.16,65.77-30.15C159.87-1.19,204.85-.89,248.93,13.28c44.46,14.29,76.19,43.85,99.53,83.56,25,42.54,39.93,89.09,54.76,135.68,24.4,76.64,47.11,153.84,75.28,229.23,6.84,18.3,14.32,36.4,24.1,53.46,16.86,29.42,40.11,51.95,70.52,67.06,2.46,1.22,5.74,1.79,6.12,5.72-3.31,2.99-7.39,1.61-11.05,1.62-47.31.09-94.63.24-141.94-.06-38.41-.24-67.53-18.05-87.73-49.92-18.33-28.91-27.55-61.84-37.97-94.06-15.74-48.66-30.74-97.56-46.33-147.07h0Z"/>
              <path d="M547.09,518.86c-30.72-38.05-46.99-81.5-55.12-128.51-3.41-19.7-3.9-39.49-3.88-59.39.12-103.74.05-207.48.06-311.21,0-12.98.05-13.02,12.75-13.02,46.65-.02,93.3-.01,139.95,0,12.97,0,13.04.05,13.04,12.96.02,117.77.05,235.53-.01,353.3-.01,24.99,8.2,45.98,28.84,61.06,11.17,8.17,23.95,11.43,37.7,11.42,66.88-.04,133.75.16,200.62-.22,9.7-.06,13.09,2.48,12.97,12.56-.5,40.45-.37,80.9-.05,121.35.06,8.16-2.76,10.65-10.75,10.62-79.92-.24-159.87.97-239.76-.62-51.8-1.03-94.41-24.77-129.4-62.47-2.22-2.39-4.36-4.85-6.96-7.84h0Z"/>
            </svg>
            <button 
              onClick={() => setShowTaskForm(true)} 
              className="inline-flex items-center justify-center px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded border border-primary-600 transition-colors whitespace-nowrap"
              title="Add Task"
            >
              Add Task +
            </button>
          </div>
          
          {/* User profile section with logout */}
          {userProfile && (
            <div className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
              <div className="flex items-center min-w-0 flex-1">
                <img 
                  src={userProfile.picture} 
                  alt={userProfile.name}
                  className="w-6 h-6 rounded-full mr-2 flex-shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {userProfile.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate">
                    {userProfile.email}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="ml-2 p-1 text-gray-400 hover:text-red-600 transition-colors"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
        
        {/* Standard Views */}
        <div className="mb-6">
          <div className="space-y-1">
            <div
              className={`sidebar-item ${currentView === 'inbox' ? 'active' : ''}`}
              onClick={() => handleViewChange('inbox')}
            >
              <div className="flex items-center w-full">
                <span className="text-lg mr-3">📥</span>
                <span>Inbox</span>
                {getTaskCountForView('inbox') > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">{getTaskCountForView('inbox')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'today' ? 'active' : ''}`}
              onClick={() => handleViewChange('today')}
            >
              <div className="flex items-center w-full">
                <span className="text-lg mr-3">📅</span>
                <span>Today</span>
                {getTaskCountForView('today') > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">{getTaskCountForView('today')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'upcoming' ? 'active' : ''}`}
              onClick={() => handleViewChange('upcoming')}
            >
              <div className="flex items-center w-full">
                <span className="text-lg mr-3">📆</span>
                <span>Upcoming</span>
                {getTaskCountForView('upcoming') > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">{getTaskCountForView('upcoming')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'anytime' ? 'active' : ''}`}
              onClick={() => handleViewChange('anytime')}
            >
              <div className="flex items-center w-full">
                <span className="text-lg mr-3">⭐</span>
                <span>Anytime</span>
                {getTaskCountForView('anytime') > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">{getTaskCountForView('anytime')}</span>
                )}
              </div>
            </div>

            <div
              className={`sidebar-item ${currentView === 'logbook' ? 'active' : ''}`}
              onClick={() => handleViewChange('logbook')}
            >
              <div className="flex items-center w-full">
                <span className="text-lg mr-3">✅</span>
                <span>Logbook</span>
                {getTaskCountForView('logbook') > 0 && (
                  <span className="text-sm text-gray-500 ml-auto">{getTaskCountForView('logbook')}</span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Google Drive Section */}
        <div className="mb-6">
          <div
            className={`sidebar-item ${currentView === 'drive' ? 'active' : ''}`}
            onClick={() => handleViewChange('drive')}
          >
            <div className="flex items-center">
              <svg className="w-5 h-5 mr-3" viewBox="0 -13.5 256 256" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
                <path d="M19.3542312,196.033928 L30.644172,215.534816 C32.9900287,219.64014 36.3622164,222.86588 40.3210929,225.211737 C51.6602421,210.818376 59.5534225,199.772864 64.000634,192.075201 C68.5137119,184.263529 74.0609657,172.045039 80.6423954,155.41973 C62.9064315,153.085282 49.4659974,151.918058 40.3210929,151.918058 C31.545465,151.918058 18.1051007,153.085282 0,155.41973 C0,159.964996 1.17298825,164.510261 3.51893479,168.615586 L19.3542312,196.033928 Z" fill="#0066DA"/>
                <path d="M215.681443,225.211737 C219.64032,222.86588 223.012507,219.64014 225.358364,215.534816 L230.050377,207.470615 L252.483511,168.615586 C254.829368,164.510261 256.002446,159.964996 256.002446,155.41973 C237.79254,153.085282 224.376613,151.918058 215.754667,151.918058 C206.488712,151.918058 193.072785,153.085282 175.506888,155.41973 C182.010479,172.136093 187.484394,184.354584 191.928633,192.075201 C196.412073,199.863919 204.329677,210.909431 215.681443,225.211737 Z" fill="#EA4335"/>
                <path d="M128.001268,73.3111515 C141.121182,57.4655263 150.162898,45.2470011 155.126415,36.6555757 C159.123121,29.7376196 163.521739,18.6920726 168.322271,3.51893479 C164.363395,1.1729583 159.818129,0 155.126415,0 L100.876121,0 C96.1841079,0 91.638842,1.31958557 87.6799655,3.51893479 C93.7861943,20.9210065 98.9675428,33.3058067 103.224011,40.6733354 C107.927832,48.8151881 116.186918,59.6944602 128.001268,73.3111515 Z" fill="#00832D"/>
                <path d="M175.360141,155.41973 L80.6420959,155.41973 L40.3210929,225.211737 C44.2799694,227.557893 48.8252352,228.730672 53.5172481,228.730672 L202.485288,228.730672 C207.177301,228.730672 211.722567,227.411146 215.681443,225.211737 L175.360141,155.41973 Z" fill="#2684FC"/>
                <path d="M128.001268,73.3111515 L87.680265,3.51893479 C83.7213885,5.86488134 80.3489013,9.09044179 78.0030446,13.1960654 L3.51893479,142.223575 C1.17298825,146.329198 0,150.874464 0,155.41973 L80.6423954,155.41973 L128.001268,73.3111515 Z" fill="#00AC47"/>
                <path d="M215.241501,77.7099697 L177.999492,13.1960654 C175.653635,9.09044179 172.281148,5.86488134 168.322271,3.51893479 L128.001268,73.3111515 L175.360141,155.41973 L255.855999,155.41973 C255.855999,150.874464 254.682921,146.329198 252.337064,142.223575 L215.241501,77.7099697 Z" fill="#FFBA00"/>
              </svg>
              <span>Google Drive</span>
            </div>
          </div>
        </div>

        {/* Areas & Projects Section */}
        <div>
          <div className="flex items-center justify-between mb-3 px-3">
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Areas & Projects</h2>
            <div className="relative" ref={dropdownRef}>
              <span 
                onClick={() => setShowCreateDropdown(!showCreateDropdown)}
                className="text-sm text-gray-500 hover:text-gray-600 cursor-pointer"
                title="Add Area or Project"
              >
                +
              </span>
              
              {showCreateDropdown && (
                <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[120px]">
                  <button 
                    onClick={() => {
                      console.log('New Area clicked');
                      createNewArea();
                      setShowCreateDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100"
                  >
                    📁 New Area
                  </button>
                  <button 
                    onClick={() => {
                      console.log('New Project clicked');
                      createNewProject();
                      setShowCreateDropdown(false);
                    }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                  >
                    📄 New Project
                  </button>
                </div>
              )}
            </div>
          </div>
          
            <div className="space-y-1">
              {areas.map(area => {
                const areaProjects = getProjectsForArea(area.id);
                const isExpanded = expandedAreas.has(area.id);
                
                return (
                  <DroppableArea key={area.id} area={area}>
                    {/* Area Header */}
                    <div 
                      className="sidebar-item cursor-pointer group"
                      onClick={() => toggleAreaExpansion(area.id)}
                    >
                      <div className="flex items-center w-full">
                        <span className={`mr-2 text-xs transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                          ▶
                        </span>
                        <span className="text-lg mr-3">🏷️</span>
                          {editingItem?.id === area.id && editingItem?.type === 'area' ? (
                            <input
                              type="text"
                              value={editingItem.name}
                              onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                              onBlur={() => saveItemName(area.id, 'area', editingItem.name)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  saveItemName(area.id, 'area', editingItem.name);
                                } else if (e.key === 'Escape') {
                                  setEditingItem(null);
                                }
                              }}
                              className="bg-transparent border-none outline-none flex-1"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <span 
                              className="truncate cursor-pointer" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleItemClick(area.id, 'area', area.name);
                              }}
                            >
                              {area.name}
                            </span>
                          )}
                        {areaProjects.length > 0 && (
                          <span className="text-sm text-gray-500 mr-1 ml-auto">{areaProjects.length}</span>
                        )}
                          {/* Three dots menu for area */}
                          <div className="relative" ref={showOptionsDropdown === `area-${area.id}` ? optionsDropdownRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOptionsDropdownToggle(`area-${area.id}`);
                              }}
                              className="opacity-100 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                              title="Area options"
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                              </svg>
                            </button>
                            
                            {showOptionsDropdown === `area-${area.id}` && (
                              <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[120px]">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingItem({ id: area.id, type: 'area', name: area.name });
                                    setShowOptionsDropdown(null);
                                  }}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 flex items-center"
                                >
                                  <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                                  </svg>
                                  Edit
                                </button>
                                <button
                                  onClick={(e) => handleDeleteArea(area.id, area.name, e)}
                                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 hover:bg-red-50 flex items-center"
                                >
                                  <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                  </svg>
                                  Delete
                                </button>
                              </div>
                            )}
                          </div>
                      </div>
                    </div>
                    
                    {/* Projects under this Area */}
                    {isExpanded && (
                      <div className="space-y-1">
                        {areaProjects.map(project => (
                          <DraggableProject key={project.id} project={project} />
                        ))}
                        {areaProjects.length === 0 && (
                          <div className="text-sm text-gray-400 italic ml-4">
                            No projects yet
                          </div>
                        )}
                      </div>
                    )}
                  </DroppableArea>
                );
              })}
            </div>
            
          {/* Projects without an Area */}
          {projects.filter(p => !p.areaId && p.status === 'Active').length > 0 && (
            <div className="mt-4">
              <div className="text-sm text-gray-500 mb-2 uppercase tracking-wide">
                Unorganized Projects
              </div>
              <div className="space-y-1">
                {projects
                  .filter(p => !p.areaId && p.status === 'Active')
                  .map(project => (
                    <DraggableProject key={project.id} project={project} />
                  ))}
              </div>
            </div>
          )}
        </div>
        </div>
      </div>
      
      {showTaskForm && (
        <TaskForm 
          onClose={() => setShowTaskForm(false)}
          onSubmit={() => setShowTaskForm(false)}
        />
      )}
    </DndProvider>
  );
};

export default Sidebar;