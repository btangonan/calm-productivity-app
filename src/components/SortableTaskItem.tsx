import { useState, useRef, useEffect } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import TaskForm from './TaskForm';
import TaskDescription, { shouldTaskBeExpandable } from './TaskDescription';

interface SortableTaskItemProps {
  task: Task;
}

const SortableTaskItem: React.FC<SortableTaskItemProps> = ({ task }) => {
  const { state, dispatch } = useApp();
  const { tasks } = state;
  const [showEditForm, setShowEditForm] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editingTitle, setEditingTitle] = useState(task.title);
  const [isEditingDescription, setIsEditingDescription] = useState(false);
  const [editingDescription, setEditingDescription] = useState(task.description || '');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleTaskToggle = async (taskId: string, isCompleted: boolean) => {
    const originalTask = tasks.find(task => task.id === taskId);
    if (!originalTask) return;

    try {
      // Get authentication token
      const userProfile = state.userProfile;
      if (!userProfile) {
        throw new Error('User not authenticated');
      }

      // Optimistically update UI immediately
      dispatch({
        type: 'UPDATE_TASK',
        payload: { ...originalTask, isCompleted },
      });

      // Then update backend
      await apiService.updateTaskCompletion(taskId, isCompleted, userProfile.id_token);
      
    } catch (error) {
      console.error('Failed to update task:', error);
      // Revert the optimistic update on error
      dispatch({
        type: 'UPDATE_TASK',
        payload: originalTask,
      });
      dispatch({ type: 'SET_ERROR', payload: 'Failed to update task' });
    }
  };

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowEditForm(true);
  };

  const handleCloseEditForm = () => {
    setShowEditForm(false);
  };

  const handleDeleteTask = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        const token = state.userProfile?.id_token;
        if (!token) {
          throw new Error('User not authenticated');
        }

        console.log(`🗑️ Deleting task: ${task.id} - "${task.title}"`);
        
        // Call backend API to delete task
        await apiService.deleteTask(task.id, token);
        
        // Remove from frontend state after successful backend deletion
        dispatch({ type: 'DELETE_TASK', payload: task.id });
        setShowDropdown(false);
        
        console.log(`✅ Task deleted successfully: ${task.id}`);
      } catch (error) {
        console.error('Failed to delete task:', error);
        dispatch({ type: 'SET_ERROR', payload: 'Failed to delete task' });
      }
    }
  };

  const handleTitleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If task is already selected, start editing; otherwise select it
    if (selectedTaskId === task.id) {
      setIsEditingTitle(true);
      setEditingTitle(task.title);
    } else {
      setSelectedTaskId(task.id);
    }
  };

  const handleTitleSave = () => {
    if (editingTitle.trim() && editingTitle !== task.title) {
      const updatedTask = { ...task, title: editingTitle.trim() };
      dispatch({ type: 'UPDATE_TASK', payload: updatedTask });
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSave();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
      setEditingTitle(task.title);
    }
  };

  const handleDescriptionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If task is already selected, start editing; otherwise select it
    if (selectedTaskId === task.id) {
      setIsEditingDescription(true);
      setEditingDescription(task.description || '');
    } else {
      setSelectedTaskId(task.id);
    }
  };

  const handleDescriptionSave = () => {
    if (editingDescription !== task.description) {
      const updatedTask = { ...task, description: editingDescription };
      dispatch({ type: 'UPDATE_TASK', payload: updatedTask });
    }
    setIsEditingDescription(false);
  };

  const handleDescriptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.shiftKey) {
      // Shift+Enter allows new lines
      return;
    } else if (e.key === 'Enter') {
      handleDescriptionSave();
    } else if (e.key === 'Escape') {
      setIsEditingDescription(false);
      setEditingDescription(task.description || '');
    }
  };

  const toggleExpanded = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  };

  const getDateColor = (dateString: string | null) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    
    if (date < today) {
      return 'text-red-600'; // Overdue
    } else if (date.toDateString() === today.toDateString()) {
      return 'text-orange-600'; // Due today
    }
    return 'text-gray-500'; // Future dates
  };

  const isExpandable = shouldTaskBeExpandable(task);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`task-item group ${isDragging ? 'opacity-50' : ''} ${
        isDragging ? 'shadow-lg z-10' : ''
      }`}
    >
      <div className="flex items-start space-x-1">
        {/* Drag handle */}
        <div
          {...attributes}
          {...listeners}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-0.5 text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0"
          title="Drag to reorder"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
          </svg>
        </div>

        {/* Expand arrow */}
        {isExpandable ? (
          <button
            onClick={toggleExpanded}
            className="mt-0.5 p-0.5 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 -ml-0.5"
            title={isExpanded ? "Collapse task" : "Expand task"}
          >
            <svg 
              className={`w-3 h-3 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <div className="w-4 h-4 mt-0.5 flex-shrink-0 -ml-0.5" /> // Spacer for non-expandable tasks
        )}

        {/* Task checkbox */}
        <div
          className={`task-checkbox mt-0.5 flex-shrink-0 ${task.isCompleted ? 'completed' : ''}`}
          onClick={() => handleTaskToggle(task.id, !task.isCompleted)}
        >
          {task.isCompleted && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center flex-1 min-w-0">
              {isEditingTitle ? (
                <input
                  type="text"
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onBlur={handleTitleSave}
                  onKeyDown={handleTitleKeyDown}
                  className="text-sm font-medium bg-white border border-primary-300 rounded px-2 py-1 flex-1 min-w-0 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <h3 
                  className={`text-sm font-medium cursor-pointer px-2 py-1 rounded flex-1 min-w-0 ${
                    selectedTaskId === task.id 
                      ? 'bg-primary-50 border border-primary-200' 
                      : 'hover:bg-gray-100'
                  } ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}
                  onClick={handleTitleClick}
                  title={selectedTaskId === task.id ? "Click again to edit title" : "Click to select task"}
                >
                  {task.title}
                </h3>
              )}
              {/* Three dots menu */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDropdown(!showDropdown);
                  }}
                  className="opacity-100 ml-2 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                  title="Task options"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                  </svg>
                </button>
                
                {showDropdown && (
                  <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-md shadow-lg z-50 min-w-[120px]">
                    <button
                      onClick={handleEditClick}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 flex items-center"
                    >
                      <svg className="w-3 h-3 mr-2" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={handleDeleteTask}
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
            
            <div className="flex items-center space-x-2">
              {task.dueDate && (
                <span className={`text-xs ${getDateColor(task.dueDate)}`}>
                  {formatDate(task.dueDate)}
                </span>
              )}
              {task.context && (
                <span className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                  {task.context}
                </span>
              )}
            </div>
          </div>
          
          <TaskDescription 
            description={task.description || ''} 
            task={task} 
            isExpanded={isExpanded}
            isEditing={isEditingDescription}
            editingDescription={editingDescription}
            onDescriptionChange={(value) => setEditingDescription(value)}
            onDescriptionSave={handleDescriptionSave}
            onDescriptionKeyDown={handleDescriptionKeyDown}
            onDescriptionClick={handleDescriptionClick}
            isSelected={selectedTaskId === task.id}
          />
        </div>
      </div>
      
      {showEditForm && (
        <TaskForm 
          editingTask={task}
          onClose={handleCloseEditForm}
          onSubmit={handleCloseEditForm}
        />
      )}
    </div>
  );
};

export default SortableTaskItem;