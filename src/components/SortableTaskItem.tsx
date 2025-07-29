import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
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
  const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0, placement: 'bottom' as 'top' | 'bottom' });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

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
      const target = event.target as Node;
      
      // Check if click is outside both the button and the dropdown
      if (
        buttonRef.current && !buttonRef.current.contains(target) &&
        (!showDropdown || !document.querySelector('.fixed.bg-white')?.contains(target))
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showDropdown]);

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
      const token = userProfile.access_token || userProfile.id_token;
      if (!token) {
        throw new Error('No authentication token available');
      }
      await apiService.updateTaskCompletion(taskId, isCompleted, token);
      
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

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDeleteModal(true);
    setShowDropdown(false);
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const token = state.userProfile?.access_token || state.userProfile?.id_token;
      if (!token) {
        throw new Error('User not authenticated');
      }

      console.log(`🗑️ Deleting task: ${task.id} - "${task.title}"`);
      
      // Call backend API to delete task
      await apiService.deleteTask(task.id, token);
      
      // Remove from frontend state after successful backend deletion
      dispatch({ type: 'DELETE_TASK', payload: task.id });
      
      console.log(`✅ Task deleted successfully: ${task.id}`);
      setShowDeleteModal(false);
    } catch (error) {
      console.error('Failed to delete task:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to delete task' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteModal(false);
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
        {/* Three dots menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            ref={buttonRef}
            onClick={(e) => {
              e.stopPropagation();
              
              if (!showDropdown && buttonRef.current) {
                const rect = buttonRef.current.getBoundingClientRect();
                const spaceBelow = window.innerHeight - rect.bottom;
                const spaceAbove = rect.top;
                
                // Calculate absolute position for portal
                const placement = spaceBelow < 120 && spaceAbove > 120 ? 'top' : 'bottom';
                const x = rect.left;
                const y = placement === 'top' ? rect.top - 120 : rect.bottom + 8;
                
                setDropdownPosition({ x, y, placement });
              }
              
              setShowDropdown(!showDropdown);
            }}
            className="opacity-100 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 mt-0.5 flex-shrink-0"
            title="Task options"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
            </svg>
          </button>
          
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
                  } ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'} ${
                    (task as any).isOptimistic ? 'opacity-60' : ''
                  }`}
                  onClick={handleTitleClick}
                  title={selectedTaskId === task.id ? "Click again to edit title" : "Click to select task"}
                >
                  {task.title}
                </h3>
              )}
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
              {/* Drag handle */}
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600 flex-shrink-0"
                title="Drag to reorder"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M3 15h18v-2H3v2zm0 4h18v-2H3v2zm0-8h18V9H3v2zm0-6v2h18V5H3z"/>
                </svg>
              </div>
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

      {/* Portal dropdown - renders outside scroll container */}
      {showDropdown && createPortal(
        <div 
          className="fixed bg-white border border-gray-200 rounded-md shadow-xl z-[9999] min-w-[120px]"
          style={{
            left: dropdownPosition.x,
            top: dropdownPosition.y,
          }}
        >
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
            onClick={handleDeleteClick}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-red-600 hover:bg-red-50 flex items-center"
          >
            <svg className="w-3 h-3 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete
          </button>
        </div>,
        document.body
      )}

      {/* Delete confirmation modal */}
      {showDeleteModal && createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
          <div className="bg-white rounded-lg p-6 w-96 max-w-md mx-4">
            <div className="flex items-start mb-4">
              <div className="flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.728-.833-2.498 0L4.316 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Task</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Are you sure you want to delete "<strong>{task.title}</strong>"? This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 flex items-center"
              >
                {isDeleting ? (
                  <>
                    <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Task'
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default SortableTaskItem;