import TaskAttachments from './TaskAttachments';
import { useApp } from '../context/AppContext';
import type { Task, TaskAttachment } from '../types';

interface TaskDescriptionProps {
  description: string;
  task?: Task;
  isExpanded?: boolean;
  maxLength?: number;
  className?: string;
  isEditing?: boolean;
  editingDescription?: string;
  onDescriptionChange?: (value: string) => void;
  onDescriptionSave?: () => void;
  onDescriptionKeyDown?: (e: React.KeyboardEvent) => void;
  onDescriptionClick?: (e: React.MouseEvent) => void;
  isSelected?: boolean;
}

const TaskDescription: React.FC<TaskDescriptionProps> = ({ 
  description,
  task,
  isExpanded = false,
  maxLength = 80, 
  className = "text-sm text-gray-600 mt-1",
  isEditing = false,
  editingDescription = '',
  onDescriptionChange,
  onDescriptionSave,
  onDescriptionKeyDown,
  onDescriptionClick,
  isSelected = false
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


  return (
    <>
      {/* Description text - only show when expanded or editing */}
      {(isExpanded || isEditing) && (
        <div className={className}>
          {isEditing ? (
            // Editing mode: textarea for multiline editing
            <textarea
              value={editingDescription}
              onChange={(e) => onDescriptionChange?.(e.target.value)}
              onBlur={onDescriptionSave}
              onKeyDown={onDescriptionKeyDown}
              className="w-full text-sm bg-white border border-primary-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500 resize-none"
              rows={3}
              placeholder="Add description..."
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div 
              className={`cursor-pointer rounded px-2 py-1 ${
                isSelected 
                  ? 'bg-primary-50 border border-primary-200' 
                  : 'hover:bg-gray-100'
              }`}
              onClick={onDescriptionClick}
              title={isSelected ? "Click again to edit description" : "Click to select task"}
            >
              {/* Expanded: full description with proper formatting */}
              <div className="whitespace-pre-wrap break-words text-sm text-gray-600">
                {description || "No description"}
              </div>
            </div>
          )}
        </div>
      )}

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