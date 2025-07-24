import { useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';

const TaskList = () => {
  const { state, dispatch } = useApp();
  const { tasks, currentView, selectedProjectId } = state;

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
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📝</div>
          <p className="text-gray-500 text-lg">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
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
                  <h3 className={`text-sm font-medium ${task.isCompleted ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                    {task.title}
                  </h3>
                  
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
  );
};

export default TaskList;