import TaskAttachments from './TaskAttachments';
import { useApp } from '../context/AppContext';
import type { Task, TaskAttachment } from '../types';

interface TaskDescriptionProps {
  description: string;
  task?: Task;
  isExpanded?: boolean;
  maxLength?: number;
  className?: string;
}

const TaskDescription: React.FC<TaskDescriptionProps> = ({ 
  description,
  task,
  isExpanded = false,
  maxLength = 80, 
  className = "text-sm text-gray-600 mt-1" 
}) => {
  const { dispatch } = useApp();

  const handleAttachmentsChange = (attachments: TaskAttachment[]) => {
    if (task) {
      const updatedTask = {
        ...task,
        attachments
      };
      dispatch({ type: 'UPDATE_TASK', payload: updatedTask });
    }
  };

  // For the main task list, show only the first line of the description
  const lines = description.split('\n');
  const firstLine = lines[0] || '';
  const previewLength = 60; // Max characters for first line preview
  const needsPreview = firstLine.length > previewLength || lines.length > 1;
  const previewDescription = needsPreview 
    ? (firstLine.length > previewLength 
        ? firstLine.substring(0, previewLength).trim() + '...'
        : firstLine + (lines.length > 1 ? '...' : ''))
    : firstLine;

  return (
    <>
      {/* Description text */}
      <div className={className}>
        {isExpanded ? (
          // Expanded: full description with proper formatting
          <div className="whitespace-pre-wrap break-words">
            {description}
          </div>
        ) : (
          // Collapsed: single line only, truncated
          <div className="text-sm text-gray-600 truncate">
            {previewDescription}
          </div>
        )}
      </div>

      {/* Full expandable content area when expanded */}
      {isExpanded && (
        <div className="mt-3 space-y-3">
          {/* Full attachments display */}
          <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
            <TaskAttachments
              attachments={task?.attachments}
              onAttachmentsChange={handleAttachmentsChange}
              isEditing={true}
              maxFiles={5}
              compact={false}
            />
          </div>
        </div>
      )}
    </>
  );
};

// Helper function to determine if a task should be expandable
export const shouldTaskBeExpandable = (task: Task): boolean => {
  // Check if description is long enough to need truncation
  const hasLongDescription = task.description && task.description.length > 60;
  
  // Check if task has attachments
  const hasAttachments = task.attachments && task.attachments.length > 0;
  
  // Task is expandable if it has long description OR attachments OR could benefit from attachments
  return hasLongDescription || hasAttachments || true; // Always allow for adding attachments
};

export default TaskDescription;