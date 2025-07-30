import React, { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Task } from '@/types/task-management.types';
import { useAppSelector } from '@/hooks/useAppSelector';
import { selectTaskById } from '@/features/task-management/task-management.slice';
import { selectIsTaskSelected } from '@/features/task-management/selection.slice';
import { useTaskRowState } from './hooks/useTaskRowState';
import { useTaskRowActions } from './hooks/useTaskRowActions';
import { useTaskRowColumns } from './hooks/useTaskRowColumns';

interface TaskRowProps {
  taskId: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
    key?: string;
    custom_column?: boolean;
    custom_column_obj?: any;
    isCustom?: boolean;
  }>;
  isSubtask?: boolean;
  isFirstInGroup?: boolean;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
  depth?: number;
}

const TaskRow: React.FC<TaskRowProps> = memo(({ 
  taskId, 
  projectId, 
  visibleColumns, 
  isSubtask = false, 
  isFirstInGroup = false, 
  updateTaskCustomColumnValue,
  depth = 0
}) => {
  // Get task data and selection state from Redux
  const task = useAppSelector(state => selectTaskById(state, taskId));
  const isSelected = useAppSelector(state => selectIsTaskSelected(state, taskId));
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const isDarkMode = themeMode === 'dark';

  // Early return if task is not found
  if (!task) {
    return null;
  }

  // Use extracted hooks for state management
  const {
    activeDatePicker,
    setActiveDatePicker,
    editTaskName,
    setEditTaskName,
    taskName,
    setTaskName,
    taskDisplayName,
    convertedTask,
    formattedDates,
    dateValues,
    labelsAdapter,
  } = useTaskRowState(task);

  const {
    handleCheckboxChange,
    handleTaskNameSave,
    handleTaskNameEdit,
  } = useTaskRowActions({
    task,
    taskId,
    taskName,
    editTaskName,
    setEditTaskName,
  });

  // Drag and drop functionality - only enable for parent tasks
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: task.id,
    data: {
      type: 'task',
      task,
    },
    disabled: isSubtask, // Disable drag and drop for subtasks
  });

  // Use extracted column renderer hook
  const { renderColumn } = useTaskRowColumns({
    task,
    projectId,
    isSubtask,
    isSelected,
    isDarkMode,
    visibleColumns,
    updateTaskCustomColumnValue,
    taskDisplayName,
    convertedTask,
    formattedDates,
    dateValues,
    labelsAdapter,
    activeDatePicker,
    setActiveDatePicker,
    editTaskName,
    taskName,
    setEditTaskName,
    setTaskName,
    handleCheckboxChange,
    handleTaskNameSave,
    handleTaskNameEdit,
    attributes,
    listeners,
    depth,
  });

  // Memoize style object to prevent unnecessary re-renders
  const style = useMemo(() => ({
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1, // Make original task slightly transparent while dragging
  }), [transform, transition, isDragging]);

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, height: '40px' }}
      className={`flex items-center min-w-max px-1 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
        isFirstInGroup ? 'border-t border-gray-200 dark:border-gray-700' : ''
      } ${
        isDragging ? 'opacity-50' : ''
      } ${
        isOver && !isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''
      }`}
    >
      {visibleColumns.map((column, index) => {
        // Calculate background state for sticky columns - custom dark mode colors
        const rowBackgrounds = {
          normal: isDarkMode ? '#1e1e1e' : '#ffffff', // custom dark : bg-white
          hover: isDarkMode ? '#1f2937' : '#f9fafb', // slightly lighter dark : bg-gray-50  
          dragOver: isDarkMode ? '#1e3a8a33' : '#dbeafe', // bg-blue-900/20 : bg-blue-50
        };
        
        let currentBg = rowBackgrounds.normal;
        if (isOver && !isDragging) {
          currentBg = rowBackgrounds.dragOver;
        }
        // Note: hover state is handled by CSS, so we'll use a CSS custom property
        
        return (
          <React.Fragment key={column.id}>
            {renderColumn(column.id, column.width, column.isSticky, index, currentBg, rowBackgrounds)}
          </React.Fragment>
        );
      })}
    </div>
  );
});

TaskRow.displayName = 'TaskRow';

export default TaskRow;
