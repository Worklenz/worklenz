import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { createSelector } from '@reduxjs/toolkit';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  selectTaskById,
  createSubtask,
  selectSubtaskLoading,
  fetchSubTasks,
  selectActiveFilters,
} from '@/features/task-management/task-management.slice';
import TaskRow from './TaskRow';
import SubtaskLoadingSkeleton from './SubtaskLoadingSkeleton';
import { Task } from '@/types/task-management.types';
import { Input, Button } from '@/shared/antd-imports';
import { PlusOutlined } from '@/shared/antd-imports';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useTranslation } from 'react-i18next';
import { useAuthService } from '@/hooks/useAuth';

interface TaskRowWithSubtasksProps {
  taskId: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  isFirstInGroup?: boolean;
  updateTaskCustomColumnValue?: (taskId: string, columnKey: string, value: string) => void;
  depth?: number; // Add depth prop to track nesting level
  maxDepth?: number; // Add maxDepth prop to limit nesting
}

interface AddSubtaskRowProps {
  parentTaskId: string;
  projectId: string;
  visibleColumns: Array<{
    id: string;
    width: string;
    isSticky?: boolean;
  }>;
  onSubtaskAdded: () => void;
  rowId: string;
  autoFocus?: boolean;
  isActive?: boolean;
  onActivate?: () => void;
  depth?: number; // Add depth prop for proper indentation
}

const AddSubtaskRow: React.FC<AddSubtaskRowProps> = memo(
  ({
    parentTaskId,
    projectId,
    visibleColumns,
    onSubtaskAdded,
    rowId,
    autoFocus = false,
    isActive = true,
    onActivate,
    depth = 0,
  }) => {
    const { t } = useTranslation('task-list-table');
    const [isAdding, setIsAdding] = useState(false);
    const [subtaskName, setSubtaskName] = useState('');
    const inputRef = useRef<any>(null);
    const dispatch = useAppDispatch();
    const { socket, connected } = useSocket();
    const currentSession = useAuthService().getCurrentSession();

    useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    const handleAddSubtask = useCallback(() => {
      if (!subtaskName.trim() || !currentSession) return;

      // Create optimistic subtask immediately for better UX
      dispatch(
        createSubtask({
          parentTaskId,
          name: subtaskName.trim(),
          projectId,
        })
      );

      // Emit socket event for server-side creation
      if (connected && socket) {
        socket.emit(
          SocketEvents.QUICK_TASK.toString(),
          JSON.stringify({
            name: subtaskName.trim(),
            project_id: projectId,
            parent_task_id: parentTaskId,
            reporter_id: currentSession.id,
            team_id: currentSession.team_id,
          })
        );
      }

      // Clear the input but keep it focused for the next subtask
      setSubtaskName('');
      // Keep isAdding as true so the input stays visible
      // Focus the input again after a short delay to ensure it's ready
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);

      // Notify parent that subtask was added
      onSubtaskAdded();
    }, [
      subtaskName,
      dispatch,
      parentTaskId,
      projectId,
      connected,
      socket,
      currentSession,
      onSubtaskAdded,
    ]);

    const handleCancel = useCallback(() => {
      setSubtaskName('');
      setIsAdding(false);
    }, []);

    const handleBlur = useCallback(() => {
      // Only cancel if the input is empty, otherwise keep it active
      if (subtaskName.trim() === '') {
        handleCancel();
      }
    }, [subtaskName, handleCancel]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === 'Escape') {
          handleCancel();
        }
      },
      [handleCancel]
    );

    const renderColumn = useCallback(
      (columnId: string, width: string) => {
        const baseStyle = { width };

        switch (columnId) {
          case 'dragHandle':
            return <div style={baseStyle} />;
          case 'checkbox':
            return <div style={baseStyle} />;
          case 'taskKey':
            return <div style={baseStyle} />;
          case 'description':
            return <div style={baseStyle} />;
          case 'title':
            return (
              <div className="flex items-center h-full" style={baseStyle}>
                <div className="flex items-center w-full h-full">
                  {/* Match subtask indentation pattern - reduced spacing for level 1 */}
                  <div className="w-2" />
                  {/* Add additional indentation for deeper levels - increased spacing for level 2+ */}
                  {Array.from({ length: depth }).map((_, i) => (
                    <div key={i} className="w-6" />
                  ))}
                  <div className="w-1" />

                  {isActive ? (
                    !isAdding ? (
                      <button
                        onClick={() => {
                          if (onActivate) {
                            onActivate();
                          }
                          setIsAdding(true);
                        }}
                        className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors h-full"
                      >
                        <PlusOutlined className="text-xs" />
                        {t('addSubTaskText')}
                      </button>
                    ) : (
                      <Input
                        ref={inputRef}
                        value={subtaskName}
                        onChange={e => setSubtaskName(e.target.value)}
                        onPressEnter={handleAddSubtask}
                        onBlur={handleBlur}
                        onKeyDown={handleKeyDown}
                        placeholder="Type subtask name and press Enter to save"
                        className="w-full h-full border-none shadow-none bg-transparent"
                        style={{
                          height: '100%',
                          minHeight: '32px',
                          padding: '4px 8px',
                          fontSize: '14px',
                        }}
                        autoFocus
                      />
                    )
                  ) : (
                    // Empty space when not active
                    <div className="h-full" />
                  )}
                </div>
              </div>
            );
          default:
            return <div style={baseStyle} />;
        }
      },
      [
        isAdding,
        subtaskName,
        handleAddSubtask,
        handleCancel,
        handleBlur,
        handleKeyDown,
        t,
        isActive,
        onActivate,
        depth,
      ]
    );

    return (
      <div className="flex items-center min-w-max px-1 py-0.5 hover:bg-gray-50 dark:hover:bg-gray-800 min-h-[36px] border-b border-gray-200 dark:border-gray-700">
        {visibleColumns.map((column, index) => (
          <React.Fragment key={column.id}>{renderColumn(column.id, column.width)}</React.Fragment>
        ))}
      </div>
    );
  }
);

AddSubtaskRow.displayName = 'AddSubtaskRow';

// Helper function to get background color based on depth
const getSubtaskBackgroundColor = (depth: number) => {
  switch (depth) {
    case 1:
      return 'bg-gray-50 dark:bg-gray-800/50';
    case 2:
      return 'bg-blue-50 dark:bg-blue-900/20';
    case 3:
      return 'bg-green-50 dark:bg-green-900/20';
    default:
      return 'bg-gray-50 dark:bg-gray-800/50';
  }
};

// Helper function to get border color based on depth
const getBorderColor = (depth: number) => {
  switch (depth) {
    case 1:
      return 'border-blue-200 dark:border-blue-700';
    case 2:
      return 'border-green-200 dark:border-green-700';
    case 3:
      return 'border-purple-200 dark:border-purple-700';
    default:
      return 'border-blue-200 dark:border-blue-700';
  }
};

const TaskRowWithSubtasks: React.FC<TaskRowWithSubtasksProps> = memo(
  ({
    taskId,
    projectId,
    visibleColumns,
    isFirstInGroup = false,
    updateTaskCustomColumnValue,
    depth = 0,
    maxDepth = 3,
  }) => {
    const task = useAppSelector(state => selectTaskById(state, taskId));
    const isLoadingSubtasks = useAppSelector(state => selectSubtaskLoading(state, taskId));
    const dispatch = useAppDispatch();

    // Get active filters from Redux (tasks.slice - used by improved-task-filters)
    // Using memoized selector to prevent unnecessary re-renders
    const activeFilters = useAppSelector(selectActiveFilters);

    // Get all priorities to create ID-to-name mapping
    const allPriorities = useAppSelector(state => state.priorityReducer?.priorities || []);

    // Create priority ID to name mapping
    const priorityIdToName = React.useMemo(() => {
      const map: Record<string, string> = {};
      allPriorities.forEach((p: any) => {
        // Map priority value (0=low, 1=medium, 2=high) to name
        if (p.value === 0) map[p.id] = 'low';
        if (p.value === 1) map[p.id] = 'medium';
        if (p.value === 2) map[p.id] = 'high';
      });
      return map;
    }, [allPriorities]);

    // Auto-fetch subtasks when task has filtered children and is expanded
    useEffect(() => {
      if (task?.has_filtered_children && task?.show_sub_tasks && (!task.sub_tasks || task.sub_tasks.length === 0) && !isLoadingSubtasks) {
        dispatch(fetchSubTasks({ taskId, projectId }));
      }
    }, [task?.has_filtered_children, task?.show_sub_tasks, task?.sub_tasks, isLoadingSubtasks, dispatch, taskId, projectId]);

    const handleSubtaskAdded = useCallback(() => {
      // After adding a subtask, the AddSubtaskRow will handle its own state reset
      // We don't need to do anything here
    }, []);

    if (!task) {
      return null;
    }

    // Don't render subtasks if we've reached the maximum depth
    const canHaveSubtasks = depth < maxDepth;

    // Filter subtasks based on active filters
    const filteredSubtasks = React.useMemo(() => {
      if (!task.sub_tasks || task.sub_tasks.length === 0) return [];

      // If no filters are active, show all subtasks
      const hasActiveFilters =
        activeFilters.members.length > 0 ||
        activeFilters.labels.length > 0 ||
        activeFilters.priorities.length > 0;

      if (!hasActiveFilters) {
        return task.sub_tasks;
      }

      // Filter subtasks based on active filters
      // A subtask should be shown if:
      // 1. It directly matches the filter, OR
      // 2. It has descendants (sub_tasks_count > 0) that might match the filter
      //    (the backend already calculated this count considering the filters)
      return task.sub_tasks.filter((subtask: Task) => {
        // If subtask has descendants with matching filters, always show it
        // The backend's sub_tasks_count already accounts for filtered descendants
        if (subtask.sub_tasks_count && subtask.sub_tasks_count > 0) {
          return true;
        }

        // Check if subtask directly matches the filters
        let matchesFilters = true;

        // Check member filter
        if (activeFilters.members.length > 0) {
          const hasMatchingMember = subtask.assignees?.some((a: any) => {
            // Assignees can be either strings (IDs) or objects with team_member_id/id
            const assigneeId = typeof a === 'string' ? a : a.team_member_id || a.id;
            return activeFilters.members.includes(assigneeId);
          });
          if (!hasMatchingMember) matchesFilters = false;
        }

        // Check label filter
        if (matchesFilters && activeFilters.labels.length > 0) {
          const hasMatchingLabel = subtask.labels?.some((l: any) => 
            activeFilters.labels.includes(l.id)
          );
          if (!hasMatchingLabel) matchesFilters = false;
        }

        // Check priority filter
        if (matchesFilters && activeFilters.priorities.length > 0) {
          // Subtask has priority name (low/medium/high), but filter has priority IDs
          // Convert filter IDs to names and check if subtask priority matches
          const filterPriorityNames = activeFilters.priorities
            .map(id => priorityIdToName[id])
            .filter(Boolean);

          if (!filterPriorityNames.includes(subtask.priority)) {
            matchesFilters = false;
          }
        }

        return matchesFilters;
      });
    }, [task.sub_tasks, activeFilters, priorityIdToName]);

    return (
      <>
        {/* Main task row */}
        <TaskRow
          taskId={taskId}
          projectId={projectId}
          visibleColumns={visibleColumns}
          isFirstInGroup={isFirstInGroup}
          updateTaskCustomColumnValue={updateTaskCustomColumnValue}
          isSubtask={depth > 0}
          depth={depth}
        />

        {/* Subtasks and add subtask row when expanded */}
        {canHaveSubtasks && task.show_sub_tasks && (
          <>
            {/* Show loading skeleton while fetching subtasks */}
            {isLoadingSubtasks && (
              <>
                <SubtaskLoadingSkeleton visibleColumns={visibleColumns} />
              </>
            )}

            {/* Render existing subtasks when not loading - RECURSIVELY */}
            {!isLoadingSubtasks &&
              filteredSubtasks.map((subtask: Task) => (
                <div
                  key={subtask.id}
                  className={`${getSubtaskBackgroundColor(depth + 1)} border-l-2 ${getBorderColor(depth + 1)}`}
                >
                  <TaskRowWithSubtasks
                    taskId={subtask.id}
                    projectId={projectId}
                    visibleColumns={visibleColumns}
                    updateTaskCustomColumnValue={updateTaskCustomColumnValue}
                    depth={depth + 1}
                    maxDepth={maxDepth}
                  />
                </div>
              ))}

            {/* Add subtask row - only show when not loading */}
            {!isLoadingSubtasks && (
              <div
                className={`${getSubtaskBackgroundColor(depth + 1)} border-l-2 ${getBorderColor(depth + 1)}`}
              >
                <AddSubtaskRow
                  parentTaskId={taskId}
                  projectId={projectId}
                  visibleColumns={visibleColumns}
                  onSubtaskAdded={handleSubtaskAdded}
                  rowId={`add-subtask-${taskId}`}
                  autoFocus={false}
                  isActive={true}
                  onActivate={undefined}
                  depth={depth + 1}
                />
              </div>
            )}
          </>
        )}
      </>
    );
  }
);

TaskRowWithSubtasks.displayName = 'TaskRowWithSubtasks';

export default TaskRowWithSubtasks;