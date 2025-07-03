import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  selectAllTasksArray,
  selectGroups,
  selectGrouping,
  selectLoading,
  selectError,
  selectSelectedPriorities,
  selectSearch,
  fetchTasksV3,
} from '@/features/task-management/task-management.slice';
import {
  selectCurrentGrouping,
  selectCollapsedGroups,
  selectIsGroupCollapsed,
  toggleGroupCollapsed,
} from '@/features/task-management/grouping.slice';
import {
  selectSelectedTaskIds,
  selectLastSelectedTaskId,
  selectIsTaskSelected,
  selectTask,
  deselectTask,
  toggleTaskSelection,
  selectRange,
  clearSelection,
} from '@/features/task-management/selection.slice';
import TaskRow from './TaskRow';
import TaskGroupHeader from './TaskGroupHeader';
import { Task, TaskGroup } from '@/types/task-management.types';
import { RootState } from '@/app/store';
import { TaskListField } from '@/types/task-list-field.types';
import { useParams } from 'react-router-dom';
import ImprovedTaskFilters from '@/components/task-management/improved-task-filters';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { COLUMN_KEYS } from '@/features/tasks/tasks.slice';

// Base column configuration
const BASE_COLUMNS = [
  { id: 'dragHandle', label: '', width: '32px', isSticky: true, key: 'dragHandle' },
  { id: 'taskKey', label: 'Key', width: '100px', isSticky: true, key: COLUMN_KEYS.KEY },
  { id: 'title', label: 'Title', width: '300px', isSticky: true, key: COLUMN_KEYS.NAME },
  { id: 'status', label: 'Status', width: '120px', key: COLUMN_KEYS.STATUS },
  { id: 'assignees', label: 'Assignees', width: '150px', key: COLUMN_KEYS.ASSIGNEES },
  { id: 'priority', label: 'Priority', width: '120px', key: COLUMN_KEYS.PRIORITY },
  { id: 'dueDate', label: 'Due Date', width: '120px', key: COLUMN_KEYS.DUE_DATE },
  { id: 'progress', label: 'Progress', width: '120px', key: COLUMN_KEYS.PROGRESS },
  { id: 'labels', label: 'Labels', width: '150px', key: COLUMN_KEYS.LABELS },
  { id: 'phase', label: 'Phase', width: '120px', key: COLUMN_KEYS.PHASE },
  { id: 'timeTracking', label: 'Time Tracking', width: '120px', key: COLUMN_KEYS.TIME_TRACKING },
  { id: 'estimation', label: 'Estimation', width: '120px', key: COLUMN_KEYS.ESTIMATION },
  { id: 'startDate', label: 'Start Date', width: '120px', key: COLUMN_KEYS.START_DATE },
  { id: 'dueTime', label: 'Due Time', width: '120px', key: COLUMN_KEYS.DUE_TIME },
  { id: 'completedDate', label: 'Completed Date', width: '120px', key: COLUMN_KEYS.COMPLETED_DATE },
  { id: 'createdDate', label: 'Created Date', width: '120px', key: COLUMN_KEYS.CREATED_DATE },
  { id: 'lastUpdated', label: 'Last Updated', width: '120px', key: COLUMN_KEYS.LAST_UPDATED },
  { id: 'reporter', label: 'Reporter', width: '120px', key: COLUMN_KEYS.REPORTER },
];

type ColumnStyle = {
  width: string;
  position?: 'static' | 'relative' | 'absolute' | 'sticky' | 'fixed';
  left?: number;
  backgroundColor?: string;
  zIndex?: number;
};

interface TaskListV2Props {
  projectId: string;
}

const TaskListV2: React.FC<TaskListV2Props> = ({ projectId }) => {
  const dispatch = useAppDispatch();
  const { projectId: urlProjectId } = useParams();
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Selectors
  const tasks = useAppSelector(selectAllTasksArray);
  const groups = useAppSelector(selectGroups);
  const grouping = useAppSelector(selectGrouping);
  const loading = useAppSelector(selectLoading);
  const error = useAppSelector(selectError);
  const selectedPriorities = useAppSelector(selectSelectedPriorities);
  const searchQuery = useAppSelector(selectSearch);
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const selectedTaskIds = useAppSelector(selectSelectedTaskIds);
  const lastSelectedTaskId = useAppSelector(selectLastSelectedTaskId);

  const fields = useAppSelector(state => state.taskManagementFields) || [];

  // Filter visible columns based on fields
  const visibleColumns = useMemo(() => {
    return BASE_COLUMNS.filter(column => {
      // Always show drag handle, task key, and title
      if (column.isSticky) return true;
      // Check if field is visible
      const field = fields.find(f => f.key === column.key);
      return field?.visible ?? false;
    });
  }, [fields]);

  // Effects
  useEffect(() => {
    if (urlProjectId) {
      dispatch(fetchTasksV3(urlProjectId));
    }
  }, [dispatch, urlProjectId]);

  // Handlers
  const handleTaskSelect = useCallback((taskId: string, event: React.MouseEvent) => {
    if (event.ctrlKey || event.metaKey) {
      dispatch(toggleTaskSelection(taskId));
    } else if (event.shiftKey && lastSelectedTaskId) {
      const taskIds = tasks.map(t => t.id);
      const startIdx = taskIds.indexOf(lastSelectedTaskId);
      const endIdx = taskIds.indexOf(taskId);
      const rangeIds = taskIds.slice(
        Math.min(startIdx, endIdx),
        Math.max(startIdx, endIdx) + 1
      );
      dispatch(selectRange(rangeIds));
    } else {
      dispatch(clearSelection());
      dispatch(selectTask(taskId));
    }
  }, [dispatch, lastSelectedTaskId, tasks]);

  const handleGroupCollapse = useCallback((groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  // Memoized values
  const groupCounts = useMemo(() => {
    return groups.map(group => {
      const visibleTasks = tasks.filter(task => group.taskIds.includes(task.id));
      return visibleTasks.length;
    });
  }, [groups, tasks]);

  const visibleGroups = useMemo(() => {
    return groups.filter(group => !collapsedGroups.has(group.id));
  }, [groups, collapsedGroups]);

  // Render functions
  const renderGroup = useCallback((groupIndex: number) => {
    const group = groups[groupIndex];
    return (
      <TaskGroupHeader
        group={{
          id: group.id,
          name: group.title,
          count: groupCounts[groupIndex],
          color: group.color,
        }}
        isCollapsed={collapsedGroups.has(group.id)}
        onToggle={() => handleGroupCollapse(group.id)}
      />
    );
  }, [groups, groupCounts, collapsedGroups, handleGroupCollapse]);

  const renderTask = useCallback((taskIndex: number) => {
    const task = tasks[taskIndex];
    return (
      <TaskRow
        task={task}
        visibleColumns={visibleColumns}
      />
    );
  }, [tasks, visibleColumns]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  // Log data for debugging
  console.log('Rendering with:', {
    groups,
    tasks,
    groupCounts
  });

  return (
    <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
      {/* Task Filters */}
      <div className="flex-none px-4 py-3">
        <ImprovedTaskFilters position="list" />
      </div>

      {/* Column Headers */}
      <div className="overflow-x-auto">
        <div className="flex-none border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center min-w-max px-4 py-2">
            {visibleColumns.map((column, index) => {
              const columnStyle: ColumnStyle = {
                width: column.width,
                ...(column.isSticky ? {
                  position: 'sticky',
                  left: index === 0 ? 0 : index === 1 ? 32 : 132,
                  backgroundColor: 'inherit',
                  zIndex: 2,
                } : {}),
              };

              return (
                <div
                  key={column.id}
                  className="text-xs font-medium text-gray-500 dark:text-gray-400"
                  style={columnStyle}
                >
                  {column.id === 'dragHandle' ? (
                    <Bars3Icon className="w-4 h-4 text-gray-400" />
                  ) : (
                    column.label
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-hidden">
          <GroupedVirtuoso
            style={{ height: 'calc(100vh - 200px)' }}
            groupCounts={groupCounts}
            groupContent={renderGroup}
            itemContent={renderTask}
            components={{
              Group: ({ children, ...props }) => (
                <div
                  {...props}
                  className="sticky top-0 z-10 bg-white dark:bg-gray-800"
                >
                  {children}
                </div>
              ),
              List: React.forwardRef(({ style, children }, ref) => (
                <div
                  ref={ref as any}
                  style={style}
                  className="divide-y divide-gray-200 dark:divide-gray-700"
                >
                  {children}
                </div>
              )),
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default TaskListV2; 