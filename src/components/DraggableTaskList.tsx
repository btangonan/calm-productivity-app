import { useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import {
  restrictToVerticalAxis,
  restrictToParentElement,
} from '@dnd-kit/modifiers';

import { useApp } from '../context/AppContext';
import { apiService } from '../services/api';
import SortableTaskItem from './SortableTaskItem';
import TaskForm from './TaskForm';

const DraggableTaskList = () => {
  const { state, dispatch } = useApp();
  const { tasks, currentView, selectedProjectId } = state;
  const [showTaskForm, setShowTaskForm] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const filteredTasks = useMemo(() => {
    let filtered = [...tasks];
    
    if (currentView === 'project' && selectedProjectId) {
      filtered = filtered.filter(task => task.projectId === selectedProjectId && !task.isCompleted);
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = filteredTasks.findIndex(task => task.id === active.id);
    const newIndex = filteredTasks.findIndex(task => task.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const reorderedTasks = arrayMove(filteredTasks, oldIndex, newIndex);
    
    // Update sort orders
    const updatedTasks = reorderedTasks.map((task, index) => ({
      ...task,
      sortOrder: index + 1,
    }));

    // Optimistically update the UI
    const allTasksUpdated = tasks.map(task => {
      const updatedTask = updatedTasks.find(ut => ut.id === task.id);
      return updatedTask || task;
    });
    
    dispatch({ type: 'REORDER_TASKS', payload: allTasksUpdated });

    // Save to backend
    try {
      const taskIds = updatedTasks.map(task => task.id);
      await apiService.reorderTasks(taskIds);
    } catch (error) {
      console.error('Failed to reorder tasks:', error);
      dispatch({ type: 'SET_ERROR', payload: 'Failed to reorder tasks' });
      // Revert the optimistic update
      dispatch({ type: 'REORDER_TASKS', payload: tasks });
    }
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
              onClick={() => {
                console.log('🖱️ Add Task button clicked in DraggableTaskList - zero tasks view');
                console.log('Current state:', { currentView, selectedProjectId, showTaskForm });
                setShowTaskForm(true);
                console.log('✅ setShowTaskForm(true) called');
              }}
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        >
          <SortableContext
            items={filteredTasks.map(task => task.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="divide-y divide-gray-100">
              {filteredTasks.map((task) => (
                <SortableTaskItem
                  key={task.id}
                  task={task}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
      
      {showTaskForm && (
        <TaskForm 
          onClose={() => {
            console.log('📝 TaskForm onClose called in DraggableTaskList');
            setShowTaskForm(false);
          }}
          onSubmit={() => {
            console.log('📝 TaskForm onSubmit called in DraggableTaskList');
            setShowTaskForm(false);
          }}
        />
      )}
      {console.log('🔍 DraggableTaskList render - showTaskForm:', showTaskForm)}
    </>
  );
};

export default DraggableTaskList;