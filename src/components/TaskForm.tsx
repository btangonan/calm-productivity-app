import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import TaskAttachments from './TaskAttachments';
import type { Task, TaskAttachment } from '../types';

interface TaskFormProps {
  onClose: () => void;
  onSubmit?: () => void;
  editingTask?: Task | null;
}

const TaskForm: React.FC<TaskFormProps> = ({ onClose, onSubmit, editingTask }) => {
  const { state, dispatch } = useApp();
  const { projects, currentView, selectedProjectId } = state;
  
  const getInitialProjectId = () => {
    if (editingTask) return editingTask.projectId || '';
    if (currentView === 'project' && selectedProjectId) return selectedProjectId;
    return '';
  };
  
  const getInitialDueDate = () => {
    if (editingTask && editingTask.dueDate) {
      return new Date(editingTask.dueDate).toISOString().split('T')[0];
    }
    return '';
  };
  
  const [formData, setFormData] = useState({
    title: editingTask?.title || '',
    description: editingTask?.description || '',
    projectId: getInitialProjectId(),
    context: editingTask?.context || '',
    dueDate: getInitialDueDate(),
    createCalendarEvent: false,
  });

  const [attachments, setAttachments] = useState<TaskAttachment[]>(
    editingTask?.attachments || []
  );
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) return;

    setLoading(true);
    try {
      if (editingTask) {
        // Update existing task
        const updatedTask = {
          ...editingTask,
          title: formData.title,
          description: formData.description,
          projectId: formData.projectId || null,
          context: formData.context,
          dueDate: formData.dueDate || null,
          attachments: attachments,
        };
        
        dispatch({ type: 'UPDATE_TASK', payload: updatedTask });
        
        // TODO: Add API call to update task
        // await apiService.updateTask(editingTask.id, updatedTask);
      } else {
        // Create new task
        const newTask = await apiService.createTask(
          formData.title,
          formData.description,
          formData.projectId || undefined,
          formData.context,
          formData.dueDate || undefined,
          attachments
        );

        dispatch({ type: 'ADD_TASK', payload: newTask });
      }
      
      onSubmit?.();
      onClose();
    } catch (error) {
      console.error('Failed to save task:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save task' });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    setFormData(prev => ({ 
      ...prev, 
      [name]: type === 'checkbox' ? checked : value 
    }));
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">{editingTask ? 'Edit Task' : 'Add New Task'}</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title *
            </label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              autoFocus
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="What needs to be done?"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="Add more details..."
            />
          </div>

          <div>
            <label htmlFor="projectId" className="block text-sm font-medium text-gray-700 mb-1">
              Project
            </label>
            <select
              id="projectId"
              name="projectId"
              value={formData.projectId}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="">Inbox (No Project)</option>
              {projects
                .filter(p => p.status === 'Active')
                .map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label htmlFor="context" className="block text-sm font-medium text-gray-700 mb-1">
              Context
            </label>
            <input
              type="text"
              id="context"
              name="context"
              value={formData.context}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
              placeholder="@computer, @office, @errands..."
            />
          </div>

          <div>
            <label htmlFor="dueDate" className="block text-sm font-medium text-gray-700 mb-1">
              Due Date
            </label>
            <input
              type="date"
              id="dueDate"
              name="dueDate"
              value={formData.dueDate}
              onChange={handleChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {formData.dueDate && (
            <div className="flex items-center">
              <input
                type="checkbox"
                id="createCalendarEvent"
                name="createCalendarEvent"
                checked={formData.createCalendarEvent}
                onChange={handleChange}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              />
              <label htmlFor="createCalendarEvent" className="ml-2 block text-sm text-gray-700">
                Create Google Calendar event
              </label>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attachments
            </label>
            <TaskAttachments
              attachments={attachments}
              onAttachmentsChange={setAttachments}
              isEditing={true}
              maxFiles={3}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !formData.title.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-primary-600 border border-transparent rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (editingTask ? 'Updating...' : 'Creating...') : (editingTask ? 'Update Task' : 'Create Task')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TaskForm;