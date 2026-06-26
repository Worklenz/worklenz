import React, { memo, useState, useCallback, useRef, useEffect } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  selectTaskById,
  createSubtask,
  selectSubtaskLoading,
  fetchSubTasks,
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
  depth?: number;
  maxDepth?: number;
  canCreateTask?: boolean;
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
  depth?: number;
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

      dispatch(
        createSubtask({
          parentTaskId,
          name: subtaskName.trim(),
          projectId,
          reporterName: currentSession.name || '',
        })
      );

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

      setSubtaskName('');
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);

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
                  <div className="w-2" />
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
                        placeholder={t('addSubTaskInputPlaceholder', {
                          defaultValue: 'Type subtask name and press Enter to save',
                        })}
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

const getSubtaskBackgroundColor = (depth: number) => {
  switch (depth) {
    case 1:
      return 'bg-gray-50 dark:bg-transparent';
    case 2:
      return 'bg-blue-50 dark:bg-transparent';
    case 3:
      return 'bg-green-50 dark:bg-transparent';
    default:
      return 'bg-gray-50 dark:bg-transparent';
  }
};

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
    canCreateTask = true,
  }) => {
    const task = useAppSelector(state => selectTaskById(state, taskId));
    const isLoadingSubtasks = useAppSelector(state => selectSubtaskLoading(state, taskId));
    const dispatch = useAppDispatch();

    const selectedMemberIds = useAppSelector(
      state =>
        state.taskReducer?.taskAssignees?.filter((m: any) => m.selected).map((m: any) => m.id) ||
        [],
      (a, b) => JSON.stringify(a) === JSON.stringify(b)
    );
    const selectedLabelIds = useAppSelector(
      state =>
        state.taskReducer?.labels?.filter((l: any) => l.selected).map((l: any) => l.id) || [],
      (a, b) => JSON.stringify(a) === JSON.stringify(b)
    );
    const priorities = useAppSelector(state => state.taskReducer?.priorities || []);

    const activeFilters = React.useMemo(
      () => ({
        members: selectedMemberIds,
        labels: selectedLabelIds,
        priorities: priorities,
      }),
      [selectedMemberIds, selectedLabelIds, priorities]
    );

    const allPriorities = useAppSelector(state => state.priorityReducer?.priorities || []);

    const priorityIdToName = React.useMemo(() => {
      const map: Record<string, string> = {};
      allPriorities.forEach((p: any) => {
        if (p.value === 0) map[p.id] = 'low';
        if (p.value === 1) map[p.id] = 'medium';
        if (p.value === 2) map[p.id] = 'high';
        if (p.value === 3) map[p.id] = 'critical';
      });
      return map;
    }, [allPriorities]);

    // FIX: Moved above the early return — hooks must always be called
    // unconditionally. Previously this useMemo was below `if (!task) return null`,
    // which caused React's "Rendered fewer hooks than expected" crash when a task
    // was deleted and task became null mid-render.
    const filteredSubtasks = React.useMemo(() => {
      if (!task?.sub_tasks || task.sub_tasks.length === 0) return [];

      const hasActiveFilters =
        activeFilters.members.length > 0 ||
        activeFilters.labels.length > 0 ||
        activeFilters.priorities.length > 0;

      if (!hasActiveFilters) {
        return task.sub_tasks;
      }

      return task.sub_tasks.filter((subtask: Task) => {
        if (subtask.has_filtered_children) return true;
        if (subtask.sub_tasks_count && subtask.sub_tasks_count > 0) return true;

        let matchesFilters = true;

        if (activeFilters.members.length > 0) {
          const hasMatchingMember = subtask.assignees?.some((a: any) => {
            const assigneeId = typeof a === 'string' ? a : a.team_member_id || a.id;
            return activeFilters.members.includes(assigneeId);
          });
          if (!hasMatchingMember) matchesFilters = false;
        }

        if (matchesFilters && activeFilters.labels.length > 0) {
          const hasMatchingLabel = subtask.labels?.some((l: any) =>
            activeFilters.labels.includes(l.id)
          );
          if (!hasMatchingLabel) matchesFilters = false;
        }

        if (matchesFilters && activeFilters.priorities.length > 0) {
          const filterPriorityNames = activeFilters.priorities
            .map(id => priorityIdToName[id])
            .filter(Boolean);
          if (!filterPriorityNames.includes(subtask.priority)) {
            matchesFilters = false;
          }
        }

        return matchesFilters;
      });
    }, [task?.sub_tasks, activeFilters, priorityIdToName]);

    // FIX: Also moved above early return for the same reason
    useEffect(() => {
      if (
        task?.has_filtered_children &&
        task?.show_sub_tasks &&
        (!task.sub_tasks || task.sub_tasks.length === 0) &&
        !isLoadingSubtasks
      ) {
        dispatch(
          fetchSubTasks({
            taskId,
            projectId,
            parentTaskIdForQuery: task.parent_task_container_id || taskId,
          })
        );
      }
    }, [
      task?.has_filtered_children,
      task?.show_sub_tasks,
      task?.sub_tasks,
      task?.parent_task_container_id,
      isLoadingSubtasks,
      dispatch,
      taskId,
      projectId,
    ]);

    // FIX: Also moved above early return for the same reason
    const handleSubtaskAdded = useCallback(() => {}, []);

    // Safe to early return here — all hooks have been called above
    if (!task) {
      return null;
    }

    const canHaveSubtasks = depth < maxDepth;

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
          canCreateTask={canCreateTask}
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
                    canCreateTask={canCreateTask}
                  />
                </div>
              ))}

            {/* Add subtask row - only show when not loading and task creation is allowed */}
            {!isLoadingSubtasks && !task.is_parent_container && canCreateTask && (
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