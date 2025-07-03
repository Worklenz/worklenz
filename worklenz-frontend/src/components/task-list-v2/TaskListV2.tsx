import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { GroupedVirtuoso } from 'react-virtuoso';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
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
  reorderTasksInGroup,
  moveTaskBetweenGroups,
} from '@/features/task-management/task-management.slice';
import {
  selectCurrentGrouping,
  selectCollapsedGroups,
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
import { HolderOutlined } from '@ant-design/icons';
import { COLUMN_KEYS } from '@/features/tasks/tasks.slice';

// Base column configuration
const BASE_COLUMNS = [
  { id: 'dragHandle', label: '', width: '32px', isSticky: true, key: 'dragHandle' },
  { id: 'taskKey', label: 'Key', width: '100px', key: COLUMN_KEYS.KEY },
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
  
  // Drag and drop state
  const [activeId, setActiveId] = useState<string | null>(null);
  
  // Configure sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );
  
  // Using Redux state for collapsedGroups instead of local state
  const collapsedGroups = useAppSelector(selectCollapsedGroups);

  // Selectors
  const allTasks = useAppSelector(selectAllTasksArray); // Renamed to allTasks for clarity
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
      // Always show drag handle and title (sticky columns)
      if (column.isSticky) return true;
      // Check if field is visible for all other columns (including task key)
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
      const taskIds = allTasks.map(t => t.id); // Use allTasks here
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
  }, [dispatch, lastSelectedTaskId, allTasks]);

  const handleGroupCollapse = useCallback((groupId: string) => {
    dispatch(toggleGroupCollapsed(groupId)); // Dispatch Redux action to toggle collapsed state
  }, [dispatch]);

  // Drag and drop handlers
  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    // Find the active task and the item being dragged over
    const activeTask = allTasks.find(task => task.id === activeId);
    if (!activeTask) return;

    // Check if we're dragging over a task or a group
    const overTask = allTasks.find(task => task.id === overId);
    const overGroup = groups.find(group => group.id === overId);

    // Find the groups
    const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
    let targetGroup = overGroup;

    if (overTask) {
      targetGroup = groups.find(group => group.taskIds.includes(overTask.id));
    }

    if (!activeGroup || !targetGroup) return;

    // If dragging to a different group, we need to handle cross-group movement
    if (activeGroup.id !== targetGroup.id) {
      console.log('Cross-group drag detected:', {
        activeTask: activeTask.id,
        fromGroup: activeGroup.id,
        toGroup: targetGroup.id,
      });
    }
  }, [allTasks, groups]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const activeId = active.id;
    const overId = over.id;

    // Find the active task
    const activeTask = allTasks.find(task => task.id === activeId);
    if (!activeTask) {
      console.error('Active task not found:', activeId);
      return;
    }

    // Find the groups
    const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
    if (!activeGroup) {
      console.error('Could not find active group for task:', activeId);
      return;
    }

    // Check if we're dropping on a task or a group
    const overTask = allTasks.find(task => task.id === overId);
    const overGroup = groups.find(group => group.id === overId);

    let targetGroup = overGroup;
    let insertIndex = 0;

    if (overTask) {
      // Dropping on a task
      targetGroup = groups.find(group => group.taskIds.includes(overTask.id));
      if (targetGroup) {
        insertIndex = targetGroup.taskIds.indexOf(overTask.id);
      }
    } else if (overGroup) {
      // Dropping on a group (at the end)
      targetGroup = overGroup;
      insertIndex = targetGroup.taskIds.length;
    }

    if (!targetGroup) {
      console.error('Could not find target group');
      return;
    }

    const isCrossGroup = activeGroup.id !== targetGroup.id;
    const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);

    console.log('Drag operation:', {
      activeId,
      overId,
      activeTask: activeTask.name || activeTask.title,
      activeGroup: activeGroup.id,
      targetGroup: targetGroup.id,
      activeIndex,
      insertIndex,
      isCrossGroup,
    });

    if (isCrossGroup) {
      // Moving task between groups
      console.log('Moving task between groups:', {
        task: activeTask.name || activeTask.title,
        from: activeGroup.title,
        to: targetGroup.title,
        newPosition: insertIndex,
      });

      // Move task to the target group
      dispatch(moveTaskBetweenGroups({
        taskId: activeId as string,
        sourceGroupId: activeGroup.id,
        targetGroupId: targetGroup.id,
      }));

      // If we need to insert at a specific position (not at the end)
      if (insertIndex < targetGroup.taskIds.length) {
        const newTaskIds = [...targetGroup.taskIds];
        // Remove the task if it was already added at the end
        const taskIndex = newTaskIds.indexOf(activeId as string);
        if (taskIndex > -1) {
          newTaskIds.splice(taskIndex, 1);
        }
        // Insert at the correct position
        newTaskIds.splice(insertIndex, 0, activeId as string);
        
        dispatch(reorderTasksInGroup({
          taskIds: newTaskIds,
          groupId: targetGroup.id,
        }));
      }
    } else {
      // Reordering within the same group
      console.log('Reordering task within same group:', {
        task: activeTask.name || activeTask.title,
        group: activeGroup.title,
        from: activeIndex,
        to: insertIndex,
      });

      if (activeIndex !== insertIndex) {
        const newTaskIds = [...activeGroup.taskIds];
        // Remove task from old position
        newTaskIds.splice(activeIndex, 1);
        // Insert at new position
        newTaskIds.splice(insertIndex, 0, activeId as string);
        
        dispatch(reorderTasksInGroup({
          taskIds: newTaskIds,
          groupId: activeGroup.id,
        }));
      }
    }

  }, [allTasks, groups]);

  // Memoized values for GroupedVirtuoso
  const virtuosoGroups = useMemo(() => {
    let currentTaskIndex = 0;
    return groups.map(group => {
      const isCurrentGroupCollapsed = collapsedGroups.has(group.id);
      
      // Order tasks according to group.taskIds array to maintain proper order
      const visibleTasksInGroup = isCurrentGroupCollapsed 
        ? [] 
        : group.taskIds
            .map(taskId => allTasks.find(task => task.id === taskId))
            .filter((task): task is Task => task !== undefined); // Type guard to filter out undefined tasks
      
      const tasksForVirtuoso = visibleTasksInGroup.map(task => ({
        ...task,
        originalIndex: allTasks.indexOf(task),
      }));

      const groupData = {
        ...group,
        tasks: tasksForVirtuoso,
        startIndex: currentTaskIndex,
        count: tasksForVirtuoso.length,
      };
      currentTaskIndex += tasksForVirtuoso.length;
      return groupData;
    });
  }, [groups, allTasks, collapsedGroups]);

  const virtuosoGroupCounts = useMemo(() => {
    return virtuosoGroups.map(group => group.count);
  }, [virtuosoGroups]);

  const virtuosoItems = useMemo(() => {
    return virtuosoGroups.flatMap(group => group.tasks);
  }, [virtuosoGroups]);

  // Memoize column headers to prevent unnecessary re-renders
  const columnHeaders = useMemo(() => (
    <div className="flex items-center min-w-max px-4 py-2">
      {visibleColumns.map((column) => {
        const columnStyle: ColumnStyle = {
          width: column.width,
        };

        return (
          <div
            key={column.id}
            className="text-xs font-medium text-gray-500 dark:text-gray-400"
            style={columnStyle}
          >
            {column.id === 'dragHandle' ? (
              <HolderOutlined className="text-gray-400" />
            ) : (
              column.label
            )}
          </div>
        );
      })}
    </div>
  ), [visibleColumns]);

  // Render functions
  const renderGroup = useCallback((groupIndex: number) => {
    const group = virtuosoGroups[groupIndex];
    const isGroupEmpty = group.count === 0;
    
    return (
      <div>
        <TaskGroupHeader
          group={{
            id: group.id,
            name: group.title,
            count: group.count,
            color: group.color,
          }}
          isCollapsed={collapsedGroups.has(group.id)}
          onToggle={() => handleGroupCollapse(group.id)}
        />
        {/* Empty group drop zone */}
        {isGroupEmpty && !collapsedGroups.has(group.id) && (
          <div className="px-4 py-8 text-center text-gray-400 dark:text-gray-500 border-2 border-dashed border-transparent hover:border-blue-300 transition-colors">
            <div className="text-sm">Drop tasks here</div>
          </div>
        )}
      </div>
    );
  }, [virtuosoGroups, collapsedGroups, handleGroupCollapse]);

  const renderTask = useCallback((taskIndex: number) => {
    const task = virtuosoItems[taskIndex]; // Get task from the flattened virtuosoItems
    if (!task) return null; // Should not happen if logic is correct
    return (
      <TaskRow
        task={task}
        visibleColumns={visibleColumns}
      />
    );
  }, [virtuosoItems, visibleColumns]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <div className="flex flex-col h-screen bg-white dark:bg-gray-900">
        {/* Task Filters */}
        <div className="flex-none px-4 py-3">
          <ImprovedTaskFilters position="list" />
        </div>

        {/* Column Headers */}
        <div className="overflow-x-auto">
          <div className="flex-none border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            {columnHeaders}
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-hidden">
            <SortableContext
              items={virtuosoItems.map(task => task.id).filter((id): id is string => id !== undefined)}
              strategy={verticalListSortingStrategy}
            >
              <GroupedVirtuoso
                style={{ height: 'calc(100vh - 200px)' }}
                groupCounts={virtuosoGroupCounts}
                groupContent={renderGroup}
                itemContent={renderTask}
                components={{
                  // Removed custom Group component as TaskGroupHeader now handles stickiness
                  List: React.forwardRef<HTMLDivElement, { style?: React.CSSProperties; children?: React.ReactNode }>(({ style, children }, ref) => (
                    <div
                      ref={ref}
                      style={style || {}}
                      className="virtuoso-list-container" // Add a class for potential debugging/styling
                    >
                      {children}
                    </div>
                  )),
                }}
              />
            </SortableContext>
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay dropAnimation={null}>
          {activeId ? (
            <div className="bg-white dark:bg-gray-800 shadow-xl rounded-md border-2 border-blue-400 opacity-95">
              <div className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <HolderOutlined className="text-blue-500" />
                  <div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {allTasks.find(task => task.id === activeId)?.name || 
                       allTasks.find(task => task.id === activeId)?.title || 
                       'Task'}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      {allTasks.find(task => task.id === activeId)?.task_key}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DragOverlay>
      </div>
    </DndContext>
  );
};

export default TaskListV2; 