import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import {
  DndContext,
  DragOverlay,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { Card, Spin, Empty } from 'antd';
import { RootState } from '@/app/store';
import {
  taskManagementSelectors,
  reorderTasks,
  moveTaskToGroup,
  optimisticTaskMove,
  setLoading,
  fetchTasks,
  fetchTasksV3,
  selectTaskGroupsV3,
  selectCurrentGroupingV3,
} from '@/features/task-management/task-management.slice';
import {
  selectTaskGroups,
  selectCurrentGrouping,
  setCurrentGrouping,
} from '@/features/task-management/grouping.slice';
import {
  selectSelectedTaskIds,
  toggleTaskSelection,
  clearSelection,
} from '@/features/task-management/selection.slice';
import { Task } from '@/types/task-management.types';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import TaskRow from './task-row';
// import BulkActionBar from './bulk-action-bar';
import VirtualizedTaskList from './virtualized-task-list';
import { AppDispatch } from '@/app/store';

// Import the improved TaskListFilters component
const ImprovedTaskFilters = React.lazy(
  () => import('./improved-task-filters')
);

interface TaskListBoardProps {
  projectId: string;
  className?: string;
}

interface DragState {
  activeTask: Task | null;
  activeGroupId: string | null;
}

// Throttle utility for performance optimization
const throttle = <T extends (...args: any[]) => void>(func: T, delay: number): T => {
  let timeoutId: NodeJS.Timeout | null = null;
  let lastExecTime = 0;

  return ((...args: any[]) => {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      func(...args);
      lastExecTime = currentTime;
    } else {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(
        () => {
          func(...args);
          lastExecTime = Date.now();
        },
        delay - (currentTime - lastExecTime)
      );
    }
  }) as T;
};

const TaskListBoard: React.FC<TaskListBoardProps> = ({ projectId, className = '' }) => {
  const dispatch = useDispatch<AppDispatch>();
  const [dragState, setDragState] = useState<DragState>({
    activeTask: null,
    activeGroupId: null,
  });

  // Refs for performance optimization
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enable real-time socket updates for task changes
  useTaskSocketHandlers();

  // Redux selectors using V3 API (pre-processed data, minimal loops)
  const tasks = useSelector(taskManagementSelectors.selectAll);
  const taskGroups = useSelector(selectTaskGroupsV3); // Pre-processed groups from backend
  const currentGrouping = useSelector(selectCurrentGroupingV3); // Current grouping from backend
  const selectedTaskIds = useSelector(selectSelectedTaskIds);
  const loading = useSelector((state: RootState) => state.taskManagement.loading);
  const error = useSelector((state: RootState) => state.taskManagement.error);

  // Get theme from Redux store
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');

  // Drag and Drop sensors - optimized for better performance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Reduced from 8 for more responsive dragging
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Fetch task groups when component mounts or dependencies change
  useEffect(() => {
    if (projectId) {
      // Fetch real tasks from V3 API (minimal processing needed)
      dispatch(fetchTasksV3(projectId));
    }
  }, [dispatch, projectId, currentGrouping]);

  // Memoized calculations - optimized
  const allTaskIds = useMemo(() => tasks.map(task => task.id), [tasks]);
  const totalTasksCount = useMemo(() => tasks.length, [tasks]);
  const hasSelection = selectedTaskIds.length > 0;

  // Memoized handlers for better performance
  const handleGroupingChange = useCallback(
    (newGroupBy: 'status' | 'priority' | 'phase') => {
      dispatch(setCurrentGrouping(newGroupBy));
    },
    [dispatch]
  );

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const taskId = active.id as string;

      // Find the task and its group
      const activeTask = tasks.find(t => t.id === taskId) || null;
      let activeGroupId: string | null = null;

      if (activeTask) {
        // Determine group ID based on current grouping
        if (currentGrouping === 'status') {
          activeGroupId = `status-${activeTask.status}`;
        } else if (currentGrouping === 'priority') {
          activeGroupId = `priority-${activeTask.priority}`;
        } else if (currentGrouping === 'phase') {
          activeGroupId = `phase-${activeTask.phase}`;
        }
      }

      setDragState({
        activeTask,
        activeGroupId,
      });
    },
    [tasks, currentGrouping]
  );

  // Throttled drag over handler for better performance
  const handleDragOver = useCallback(
    throttle((event: DragOverEvent) => {
      const { active, over } = event;

      if (!over || !dragState.activeTask) return;

      const activeTaskId = active.id as string;
      const overContainer = over.id as string;

      // Clear any existing timeout
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
      }

      // Optimistic update with throttling
      dragOverTimeoutRef.current = setTimeout(() => {
        // Only update if we're hovering over a different container
        const targetTask = tasks.find(t => t.id === overContainer);
        let targetGroupId = overContainer;

        if (targetTask) {
          if (currentGrouping === 'status') {
            targetGroupId = `status-${targetTask.status}`;
          } else if (currentGrouping === 'priority') {
            targetGroupId = `priority-${targetTask.priority}`;
          } else if (currentGrouping === 'phase') {
            targetGroupId = `phase-${targetTask.phase}`;
          }
        }

        if (targetGroupId !== dragState.activeGroupId) {
          // Perform optimistic update for visual feedback
          const targetGroup = taskGroups.find(g => g.id === targetGroupId);
          if (targetGroup) {
            dispatch(
              optimisticTaskMove({
                taskId: activeTaskId,
                newGroupId: targetGroupId,
                newIndex: targetGroup.taskIds.length,
              })
            );
          }
        }
      }, 50); // 50ms throttle for drag over events
    }, 50),
    [dragState, tasks, taskGroups, currentGrouping, dispatch]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      // Clear any pending drag over timeouts
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
        dragOverTimeoutRef.current = null;
      }

      // Reset drag state immediately for better UX
      const currentDragState = dragState;
      setDragState({
        activeTask: null,
        activeGroupId: null,
      });

      if (!over || !currentDragState.activeTask || !currentDragState.activeGroupId) {
        return;
      }

      const activeTaskId = active.id as string;
      const overContainer = over.id as string;

      // Parse the group ID to get group type and value - optimized
      const parseGroupId = (groupId: string) => {
        const [groupType, ...groupValueParts] = groupId.split('-');
        return {
          groupType: groupType as 'status' | 'priority' | 'phase',
          groupValue: groupValueParts.join('-'),
        };
      };

      // Determine target group
      let targetGroupId = overContainer;
      let targetIndex = -1;

      // Check if dropping on a task or a group
      const targetTask = tasks.find(t => t.id === overContainer);
      if (targetTask) {
        // Dropping on a task, determine its group
        if (currentGrouping === 'status') {
          targetGroupId = `status-${targetTask.status}`;
        } else if (currentGrouping === 'priority') {
          targetGroupId = `priority-${targetTask.priority}`;
        } else if (currentGrouping === 'phase') {
          targetGroupId = `phase-${targetTask.phase}`;
        }

        // Find the index of the target task within its group
        const targetGroup = taskGroups.find(g => g.id === targetGroupId);
        if (targetGroup) {
          targetIndex = targetGroup.taskIds.indexOf(targetTask.id);
        }
      }

      const sourceGroupInfo = parseGroupId(currentDragState.activeGroupId);
      const targetGroupInfo = parseGroupId(targetGroupId);

      // If moving between different groups, update the task's group property
      if (currentDragState.activeGroupId !== targetGroupId) {
        dispatch(
          moveTaskToGroup({
            taskId: activeTaskId,
            groupType: targetGroupInfo.groupType,
            groupValue: targetGroupInfo.groupValue,
          })
        );
      }

      // Handle reordering within the same group or between groups
      const sourceGroup = taskGroups.find(g => g.id === currentDragState.activeGroupId);
      const targetGroup = taskGroups.find(g => g.id === targetGroupId);

      if (sourceGroup && targetGroup && targetIndex !== -1) {
        const sourceIndex = sourceGroup.taskIds.indexOf(activeTaskId);
        const finalTargetIndex = targetIndex === -1 ? targetGroup.taskIds.length : targetIndex;

        // Only reorder if actually moving to a different position
        if (sourceGroup.id !== targetGroup.id || sourceIndex !== finalTargetIndex) {
          // Calculate new order values - simplified
          const allTasksInTargetGroup = targetGroup.taskIds.map(
            id => tasks.find(t => t.id === id)!
          );
          const newOrder = allTasksInTargetGroup.map((task, index) => {
            if (index < finalTargetIndex) return task.order;
            if (index === finalTargetIndex) return currentDragState.activeTask!.order;
            return task.order + 1;
          });

          // Dispatch reorder action
          dispatch(
            reorderTasks({
              taskIds: [activeTaskId, ...allTasksInTargetGroup.map(t => t.id)],
              newOrder: [currentDragState.activeTask!.order, ...newOrder],
            })
          );
        }
      }
    },
    [dragState, tasks, taskGroups, currentGrouping, dispatch]
  );

  const handleSelectTask = useCallback(
    (taskId: string, selected: boolean) => {
      dispatch(toggleTaskSelection(taskId));
    },
    [dispatch]
  );

  const handleToggleSubtasks = useCallback((taskId: string) => {
    // Implementation for toggling subtasks
    console.log('Toggle subtasks for task:', taskId);
  }, []);

  // Memoized DragOverlay content for better performance
  const dragOverlayContent = useMemo(() => {
    if (!dragState.activeTask || !dragState.activeGroupId) return null;

    return (
      <TaskRow
        task={dragState.activeTask}
        projectId={projectId}
        groupId={dragState.activeGroupId}
        currentGrouping={(currentGrouping as 'status' | 'priority' | 'phase') || 'status'}
        isSelected={false}
        isDragOverlay
      />
    );
  }, [dragState.activeTask, dragState.activeGroupId, projectId, currentGrouping]);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
      }
    };
  }, []);

  if (error) {
    return (
      <Card className={className}>
        <Empty description={`Error loading tasks: ${error}`} image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </Card>
    );
  }

  return (
    <div className={`task-list-board ${className}`} ref={containerRef}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >
        {/* Task Filters */}
        <div className="mb-4">
          <React.Suspense fallback={<div>Loading filters...</div>}>
            <ImprovedTaskFilters position="list" />
          </React.Suspense>
        </div>

        {/* Virtualized Task Groups Container */}
        <div className="task-groups-container">
          {loading ? (
            <Card>
              <div className="flex justify-center items-center py-8">
                <Spin size="large" />
              </div>
            </Card>
          ) : taskGroups.length === 0 ? (
            <Card>
              <Empty description="No tasks found" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </Card>
          ) : (
            <div className="virtualized-task-groups">
              {taskGroups.map((group, index) => {
                // Calculate dynamic height for each group
                const groupTasks = group.taskIds.length;
                const baseHeight = 120; // Header + column headers + add task row
                const taskRowsHeight = groupTasks * 40; // 40px per task row
                const minGroupHeight = 300; // Minimum height for better visual appearance
                const maxGroupHeight = 600; // Increased maximum height per group
                const calculatedHeight = baseHeight + taskRowsHeight;
                const groupHeight = Math.max(
                  minGroupHeight,
                  Math.min(calculatedHeight, maxGroupHeight)
                );

                return (
                  <VirtualizedTaskList
                    key={group.id}
                    group={group}
                    projectId={projectId}
                    currentGrouping={
                      (currentGrouping as 'status' | 'priority' | 'phase') || 'status'
                    }
                    selectedTaskIds={selectedTaskIds}
                    onSelectTask={handleSelectTask}
                    onToggleSubtasks={handleToggleSubtasks}
                    height={groupHeight}
                    width={1200}
                  />
                );
              })}
            </div>
          )}
        </div>

        <DragOverlay
          adjustScale={false}
          dropAnimation={null}
          style={{
            cursor: 'grabbing',
          }}
        >
          {dragOverlayContent}
        </DragOverlay>
      </DndContext>

      <style>{`
        .task-groups-container {
          max-height: calc(100vh - 300px);
          overflow-y: auto;
          overflow-x: visible;
          padding: 8px 8px 8px 0;
          border-radius: 8px;
          position: relative;
          /* GPU acceleration for smooth scrolling */
          transform: translateZ(0);
          will-change: scroll-position;
        }

        .virtualized-task-groups {
          min-width: fit-content;
          position: relative;
          /* GPU acceleration for drag operations */
          transform: translateZ(0);
        }

        .virtualized-task-group {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          margin-bottom: 16px;
          background: var(--task-bg-primary, white);
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.1));
          overflow: hidden;
          transition: all 0.3s ease;
          position: relative;
        }

        .virtualized-task-group:last-child {
          margin-bottom: 0;
        }

        /* Task group header styles */
        .task-group-header {
          background: var(--task-bg-primary, white);
          transition: background-color 0.3s ease;
        }

        .task-group-header-row {
          display: inline-flex;
          height: auto;
          max-height: none;
          overflow: hidden;
        }

        .task-group-header-content {
          display: inline-flex;
          align-items: center;
          padding: 8px 12px;
          border-radius: 6px 6px 0 0;
          background-color: #f0f0f0;
          color: white;
          font-weight: 500;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .task-group-header-text {
          color: white !important;
          font-size: 13px !important;
          font-weight: 600 !important;
          margin: 0 !important;
        }

        /* Column headers styles */
        .task-group-column-headers {
          background: var(--task-bg-secondary, #f5f5f5);
          border-bottom: 1px solid var(--task-border-tertiary, #d9d9d9);
          transition: background-color 0.3s ease;
        }

        .task-group-column-headers-row {
          display: flex;
          height: 40px;
          max-height: 40px;
          overflow: visible;
          position: relative;
          min-width: 1200px;
        }

        .task-table-header-cell {
          background: var(--task-bg-secondary, #f5f5f5);
          font-weight: 600;
          color: var(--task-text-secondary, #595959);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--task-border-tertiary, #d9d9d9);
          height: 32px;
          max-height: 32px;
          overflow: hidden;
          transition: all 0.3s ease;
        }

        .column-header-text {
          font-size: 11px;
          font-weight: 600;
          color: var(--task-text-secondary, #595959);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          transition: color 0.3s ease;
        }

        /* Add task row styles */
        .task-group-add-task {
          background: var(--task-bg-primary, white);
          border-top: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: all 0.3s ease;
          padding: 0 12px;
          width: 100%;
          min-height: 40px;
          display: flex;
          align-items: center;
        }

        .task-group-add-task:hover {
          background: var(--task-hover-bg, #fafafa);
        }

        .task-table-fixed-columns {
          display: flex;
          background: var(--task-bg-secondary, #f5f5f5);
          position: sticky;
          left: 0;
          z-index: 11;
          border-right: 2px solid var(--task-border-primary, #e8e8e8);
          box-shadow: 2px 0 4px rgba(0, 0, 0, 0.1);
          transition: all 0.3s ease;
        }

        .task-table-scrollable-columns {
          display: flex;
          flex: 1;
          min-width: 0;
        }

        .task-table-cell {
          display: flex;
          align-items: center;
          padding: 0 12px;
          border-right: 1px solid var(--task-border-secondary, #f0f0f0);
          font-size: 12px;
          white-space: nowrap;
          height: 40px;
          max-height: 40px;
          min-height: 40px;
          overflow: hidden;
          color: var(--task-text-primary, #262626);
          transition: all 0.3s ease;
        }

        .task-table-cell:last-child {
          border-right: none;
        }

        /* Optimized drag overlay styles */
        [data-dnd-overlay] {
          /* GPU acceleration for smooth dragging */
          transform: translateZ(0);
          will-change: transform;
          pointer-events: none;
        }

        /* Fix drag overlay positioning */
        [data-rbd-drag-handle-dragging-id] {
          transform: none !important;
        }

        /* DndKit drag overlay specific styles */
        .dndkit-drag-overlay {
          z-index: 9999;
          pointer-events: none;
          transform: translateZ(0);
          will-change: transform;
        }

        /* Ensure drag overlay follows cursor properly */
        [data-dnd-context] {
          position: relative;
        }

        /* Fix for scrollable containers affecting drag overlay */
        .task-groups-container [data-dnd-overlay] {
          position: fixed !important;
          top: 0 !important;
          left: 0 !important;
          transform: translateZ(0);
          z-index: 9999;
        }

        /* Dark mode support */
        :root {
          --task-bg-primary: #ffffff;
          --task-bg-secondary: #f5f5f5;
          --task-bg-tertiary: #f8f9fa;
          --task-border-primary: #e8e8e8;
          --task-border-secondary: #f0f0f0;
          --task-border-tertiary: #d9d9d9;
          --task-text-primary: #262626;
          --task-text-secondary: #595959;
          --task-text-tertiary: #8c8c8c;
          --task-shadow: rgba(0, 0, 0, 0.1);
          --task-hover-bg: #fafafa;
          --task-selected-bg: #e6f7ff;
          --task-selected-border: #1890ff;
          --task-drag-over-bg: #f0f8ff;
          --task-drag-over-border: #40a9ff;
        }

        .dark .task-groups-container,
        [data-theme="dark"] .task-groups-container {
          --task-bg-primary: #1f1f1f;
          --task-bg-secondary: #141414;
          --task-bg-tertiary: #262626;
          --task-border-primary: #303030;
          --task-border-secondary: #404040;
          --task-border-tertiary: #505050;
          --task-text-primary: #ffffff;
          --task-text-secondary: #d9d9d9;
          --task-text-tertiary: #8c8c8c;
          --task-shadow: rgba(0, 0, 0, 0.3);
          --task-hover-bg: #2a2a2a;
          --task-selected-bg: #1a2332;
          --task-selected-border: #1890ff;
          --task-drag-over-bg: #1a2332;
          --task-drag-over-border: #40a9ff;
        }

        /* Performance optimizations */
        .virtualized-task-group {
          contain: layout style paint;
        }

        .task-row {
          contain: layout style;
        }

        /* Reduce layout thrashing */
        .task-table-cell {
          contain: layout;
        }

        /* React Window specific optimizations */
        .react-window-list {
          outline: none;
        }

        .react-window-list-item {
          contain: layout style;
        }
      `}</style>
    </div>
  );
};

export default TaskListBoard;
