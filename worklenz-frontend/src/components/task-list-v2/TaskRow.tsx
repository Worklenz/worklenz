import React, { memo, useMemo } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useAppSelector } from '@/hooks/useAppSelector';
import { selectTaskById } from '@/features/task-management/task-management.slice';
import { selectIsTaskSelected } from '@/features/task-management/selection.slice';
import { useTaskRowState } from './hooks/useTaskRowState';
import { useTaskRowActions } from './hooks/useTaskRowActions';
import { useTaskRowColumns } from './hooks/useTaskRowColumns';
import { useAppDispatch } from '@/hooks/useAppDispatch';

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
  canCreateTask?: boolean;
}

const TaskRow: React.FC<TaskRowProps> = memo(
  ({
    taskId,
    projectId,
    visibleColumns,
    isSubtask = false,
    isFirstInGroup = false,
    updateTaskCustomColumnValue,
    depth = 0,
    canCreateTask = true,
  }) => {
    // Get task data and selection state from Redux
    const task = useAppSelector(state => selectTaskById(state, taskId));
    const isSelected = useAppSelector(state => selectIsTaskSelected(state, taskId));
    const drawerSelectedTaskId = useAppSelector(state => state.taskDrawerReducer.selectedTaskId);
    const themeMode = useAppSelector(state => state.themeReducer.mode);
    const isDarkMode = themeMode === 'dark';
    const isDrawerActive = drawerSelectedTaskId === taskId;
    const safeTask = useMemo(
      () =>
        task || {
          id: taskId,
          title: '',
          name: '',
          status: 'todo',
          priority: 'medium',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          sub_tasks: [],
          sub_tasks_count: 0,
          show_sub_tasks: false,
        },
      [task, taskId]
    );

    // Use extracted hooks for state management
    const {
      activeDatePicker,
      setActiveDatePicker,
      editTaskName,
      setEditTaskName,
      taskName,
      setTaskName,
      originalTaskNameRef,
      taskDisplayName,
      convertedTask,
      formattedDates,
      dateValues,
      labelsAdapter,
    } = useTaskRowState(safeTask);

    const { handleCheckboxChange, handleTaskNameSave, handleTaskNameEdit, handleTaskNameChangeLive, handleCancelEdit } = useTaskRowActions({
      task: safeTask,
      taskId,
      taskName,
      editTaskName,
      setEditTaskName,
      originalTaskNameRef,
    });

    // Drag and drop functionality - only enable for parent tasks
    const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } =
      useSortable({
        id: safeTask.id || taskId,
        data: {
          type: 'task',
          task: safeTask,
        },
        disabled: isSubtask || !task, // Disable drag and drop for subtasks and placeholders
      });

    const { renderColumn } = useTaskRowColumns({
      task: safeTask,
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
      handleTaskNameChangeLive,
      handleCancelEdit,
      attributes,
      listeners,
      depth,
      canCreateTask,
    });

    // Render null only after all hooks are called to keep hook ordering stable
    if (!task) {
      return null;
    }

    // Memoize style object to prevent unnecessary re-renders
    const style = useMemo(
      () => ({
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
      }),
      [transform, transition, isDragging]
    );

    return (
      <div
        ref={setNodeRef}
        style={{ ...style, height: '40px' }}
        className={`flex items-center min-w-max px-1 border-t border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
          isDragging ? 'opacity-50' : ''
        } ${isOver && !isDragging ? 'bg-blue-50 dark:bg-blue-900/20' : ''} ${
          isDrawerActive ? 'bg-blue-50 dark:bg-blue-900/25' : ''
        }`}
      >
        {visibleColumns.map((column, index) => {
          const rowBackgrounds = {
            normal: isDarkMode ? (isSubtask ? '#141414' : '#1e1e1e') : '#ffffff',
            hover: isDarkMode ? '#1f2937' : '#f9fafb',
            dragOver: isDarkMode ? '#1e3a8a33' : '#dbeafe',
          };

          let currentBg = rowBackgrounds.normal;
          if (isOver && !isDragging) {
            currentBg = rowBackgrounds.dragOver;
          }

          return (
            <React.Fragment key={column.id}>
              {renderColumn(
                column.id,
                column.width,
                column.isSticky,
                index,
                currentBg,
                rowBackgrounds
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  }
);

TaskRow.displayName = 'TaskRow';

export default TaskRow;
