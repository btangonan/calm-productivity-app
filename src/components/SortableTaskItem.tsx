import { useState } from 'react';
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

  const handleTaskToggle = async (taskId: string, isCompleted: boolean) => {
    try {
      await apiService.updateTaskCompletion(taskId, isCompleted);
      const updatedTask = tasks.find(task => task.id === taskId);
      if (updatedTask) {
        dispatch({
          type: 'UPDATE_TASK',
          payload: { ...updatedTask, isCompleted },
        });
      }
    } catch (error) {
      console.error('Failed to update task:', error);
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
      <div className="flex items-start space-x-3">
        {/* Expand arrow */}
        {isExpandable ? (
          <button
            onClick={toggleExpanded}
            className="mt-0.5 p-0.5 text-gray-400 hover:text-gray-600 transition-colors"
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
          <div className="w-4 h-4 mt-0.5" /> // Spacer for non-expandable tasks
        )}

        {/* Task checkbox */}
        <div
          className={`task-checkbox mt-0.5 ${task.isCompleted ? 'completed' : ''}`}
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
            <div className="flex items-center">
              <h3 className={`text-sm font-medium ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                {task.title}
              </h3>
              <button
                onClick={handleEditClick}
                className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                title="Edit task"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                </svg>
              </button>
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
              <div
                {...attributes}
                {...listeners}
                className="opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
                title="Drag to reorder"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </div>
            </div>
          </div>
          
          {task.description && (
            <TaskDescription 
              description={task.description} 
              task={task} 
              isExpanded={isExpanded}
            />
          )}
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