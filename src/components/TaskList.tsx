import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import TaskForm from './TaskForm';
import type { Task } from '../types';

const TaskList = () => {
  const { state, dispatch } = useApp();
  const { tasks, currentView, selectedProjectId } = state;
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    
    if (currentView === 'project' && selectedProjectId) {
      filtered = filtered.filter(task => task.projectId === selectedProjectId);
    } else if (currentView !== 'project') {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      switch (currentView) {
        case 'inbox':
          filtered = filtered.filter(task => !task.projectId && !task.isCompleted);
          break;
        case 'today':
          filtered = filtered.filter(task => 
            !task.isCompleted && task.dueDate && new Date(task.dueDate) <= today
          );
          break;
        case 'upcoming':
          filtered = filtered.filter(task => 
            !task.isCompleted && task.dueDate && new Date(task.dueDate) > today
          );
          break;
        case 'anytime':
          filtered = filtered.filter(task => !task.isCompleted && !task.dueDate);
          break;
        case 'logbook':
          filtered = filtered.filter(task => task.isCompleted);
          break;
      }
    }
    
    return filtered.sort((a, b) => {
      if (a.sortOrder !== b.sortOrder) {
        return (a.sortOrder || 0) - (b.sortOrder || 0);
      }
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });
  }, [tasks, currentView, selectedProjectId]);

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

  const handleEditClick = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTask(task);
  };

  const handleCloseEditForm = () => {
    setEditingTask(null);
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

  if (filteredTasks.length === 0) {
    const emptyMessage = currentView === 'logbook' 
      ? 'No completed tasks yet'
      : 'No tasks found';
      
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <div className="text-center">
          <p className="text-gray-500 text-lg mb-4">{emptyMessage}</p>
          {currentView !== 'logbook' && (
            <button 
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => setShowTaskForm(true)}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Task
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {filteredTasks.map((task) => (
            <div key={task.id} className="task-item group">
              <div className="flex items-start space-x-3">
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
                        onClick={(e) => handleEditClick(task, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity ml-2 p-0.5 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600"
                        title="Edit task"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M20.71,7.04C21.1,6.65 21.1,6 20.71,5.63L18.37,3.29C18,2.9 17.35,2.9 16.96,3.29L15.12,5.12L18.87,8.87M3,17.25V21H6.75L17.81,9.93L14.06,6.18L3,17.25Z" />
                        </svg>
                      </button>
                    </div>
                    
                    <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
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
                  
                  {task.description && (
                    <p className="text-sm text-gray-600 mt-1 truncate">
                      {task.description}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {showTaskForm && (
        <TaskForm 
          onClose={() => setShowTaskForm(false)}
          onSubmit={() => setShowTaskForm(false)}
        />
      )}
      
      {editingTask && (
        <TaskForm 
          editingTask={editingTask}
          onClose={handleCloseEditForm}
          onSubmit={handleCloseEditForm}
        />
      )}
    </>
  );
};

export default TaskList;