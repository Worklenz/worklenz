import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
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
import { Card, Spin, Empty, Alert } from 'antd';
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
import { shallowEqual } from 'react-redux';
import { performanceMonitor } from '@/utils/performance-monitor';
import debugPerformance from '@/utils/debug-performance';

// Import the improved TaskListFilters component synchronously to avoid suspense
import ImprovedTaskFilters from './improved-task-filters';
import PerformanceAnalysis from './performance-analysis';

// Import drag and drop performance optimizations
import './drag-drop-optimized.css';

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
  const { t } = useTranslation('task-management');
  const [dragState, setDragState] = useState<DragState>({
    activeTask: null,
    activeGroupId: null,
  });

  // Prevent duplicate API calls in React StrictMode
  const hasInitialized = useRef(false);
  
  // PERFORMANCE OPTIMIZATION: Frame rate monitoring and throttling
  const frameTimeRef = useRef(performance.now());
  const renderCountRef = useRef(0);
  const [shouldThrottle, setShouldThrottle] = useState(false);


  // Refs for performance optimization
  const dragOverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Enable real-time socket updates for task changes
  useTaskSocketHandlers();

  // Redux selectors using V3 API (pre-processed data, minimal loops)
  const tasks = useSelector(taskManagementSelectors.selectAll);
  const taskGroups = useSelector(selectTaskGroupsV3, shallowEqual);
  const currentGrouping = useSelector(selectCurrentGroupingV3, shallowEqual);
  const selectedTaskIds = useSelector(selectSelectedTaskIds);
  const loading = useSelector((state: RootState) => state.taskManagement.loading, shallowEqual);
  const error = useSelector((state: RootState) => state.taskManagement.error);

  // Get theme from Redux store
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');
  const themeClass = isDarkMode ? 'dark' : 'light';

  // PERFORMANCE OPTIMIZATION: Build a tasksById map with memory-conscious approach
  const tasksById = useMemo(() => {
    const map: Record<string, Task> = {};
    // Cache all tasks for full functionality - performance optimizations are handled at the virtualization level
    tasks.forEach(task => { map[task.id] = task; });
    return map;
  }, [tasks]);

  // Drag and Drop sensors - optimized for smoother experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3, // Small distance to prevent accidental drags
        delay: 0, // No delay for immediate activation
        tolerance: 5, // Tolerance for small movements
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // PERFORMANCE OPTIMIZATION: Monitor frame rate and enable throttling if needed
  useEffect(() => {
    const monitorPerformance = () => {
      const now = performance.now();
      const frameTime = now - frameTimeRef.current;
      renderCountRef.current++;
      
      // If frame time is consistently over 16.67ms (60fps), enable throttling
      if (frameTime > 20 && renderCountRef.current > 10) {
        setShouldThrottle(true);
      } else if (frameTime < 12 && renderCountRef.current > 50) {
        setShouldThrottle(false);
        renderCountRef.current = 0; // Reset counter
      }
      
      frameTimeRef.current = now;
    };
    
    const interval = setInterval(monitorPerformance, 100);
    return () => clearInterval(interval);
  }, []);

  // Fetch task groups when component mounts or dependencies change
  useEffect(() => {
    if (projectId && !hasInitialized.current) {
      hasInitialized.current = true;
      
      // Fetch real tasks from V3 API (minimal processing needed)
      dispatch(fetchTasksV3(projectId));
    }
  }, [projectId, dispatch]);

  // Memoized calculations - optimized
  const totalTasks = useMemo(() => {
    const total = taskGroups.reduce((sum, g) => sum + g.taskIds.length, 0);
    console.log(`[TASK-LIST-BOARD] Total tasks in groups: ${total}, Total tasks in store: ${tasks.length}, Groups: ${taskGroups.length}`);
    return total;
  }, [taskGroups, tasks.length]);

  const hasAnyTasks = useMemo(() => totalTasks > 0, [totalTasks]);

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

  // Throttled drag over handler for smoother performance
  const handleDragOver = useCallback(
    throttle((event: DragOverEvent) => {
      const { active, over } = event;

      if (!over || !dragState.activeTask) return;

      const activeTaskId = active.id as string;
      const overContainer = over.id as string;

      // PERFORMANCE OPTIMIZATION: Immediate response for instant UX
      // Only update if we're hovering over a different container
      const targetTask = tasks.find(t => t.id === overContainer);
      let targetGroupId = overContainer;

      if (targetTask) {
        // PERFORMANCE OPTIMIZATION: Use switch instead of multiple if statements
        switch (currentGrouping) {
          case 'status':
            targetGroupId = `status-${targetTask.status}`;
            break;
          case 'priority':
            targetGroupId = `priority-${targetTask.priority}`;
            break;
          case 'phase':
            targetGroupId = `phase-${targetTask.phase}`;
            break;
        }
      }

      if (targetGroupId !== dragState.activeGroupId) {
        // PERFORMANCE OPTIMIZATION: Use findIndex for better performance
        const targetGroupIndex = taskGroups.findIndex(g => g.id === targetGroupId);
        if (targetGroupIndex !== -1) {
          const targetGroup = taskGroups[targetGroupIndex];
          dispatch(
            optimisticTaskMove({
              taskId: activeTaskId,
              newGroupId: targetGroupId,
              newIndex: targetGroup.taskIds.length,
            })
          );
        }
      }
    }, 16), // 60fps throttling for smooth performance
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
            (id: string) => tasks.find((t: any) => t.id === id)!
          );
          const newOrder = allTasksInTargetGroup.map((task, index) => {
            if (index < finalTargetIndex) return task.order;
            if (index === finalTargetIndex) return currentDragState.activeTask!.order;
            return task.order + 1;
          });

          // Dispatch reorder action
          dispatch(
            reorderTasks({
              taskIds: [activeTaskId, ...allTasksInTargetGroup.map((t: any) => t.id)],
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
    <div className={`task-list-board ${className} ${themeClass}`} ref={containerRef}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
      >




        {/* Task Filters */}
        <div className="mb-4">
          <ImprovedTaskFilters position="list" />
        </div>

        {/* Performance Analysis - Only show in development */}
        {/* {process.env.NODE_ENV === 'development' && (
          <PerformanceAnalysis projectId={projectId} />
        )} */}

        {/* Fixed Height Task Groups Container - Asana Style */}
        <div className="task-groups-container-fixed">
          <div className="task-groups-scrollable">
            {loading ? (
              <div className="loading-container">
                <div className="flex justify-center items-center py-8">
                  <Spin size="large" />
                </div>
              </div>
            ) : taskGroups.length === 0 ? (
              <div className="empty-container">
                <Empty 
                  description={
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '14px', fontWeight: 500, marginBottom: '4px' }}>
                        No task groups available
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--task-text-secondary, #595959)' }}>
                        Create tasks to see them organized in groups
                      </div>
                    </div>
                  }
                  image={Empty.PRESENTED_IMAGE_SIMPLE} 
                />
              </div>
            ) : (
              <div className="virtualized-task-groups">
                {taskGroups.map((group, index) => {
                  // PERFORMANCE OPTIMIZATION: More aggressive height calculation for better performance
                  const groupTasks = group.taskIds.length;
                  const baseHeight = 120; // Header + column headers + add task row
                  const taskRowsHeight = groupTasks * 40; // 40px per task row
                  
                  // PERFORMANCE OPTIMIZATION: Enhanced virtualization threshold for better UX
                  const shouldVirtualizeGroup = groupTasks > 25; // Increased threshold for smoother experience
                  const minGroupHeight = shouldVirtualizeGroup ? 200 : 120; // Minimum height for virtualized groups
                  const maxGroupHeight = shouldVirtualizeGroup ? 600 : 1000; // Allow more height for virtualized groups
                  const calculatedHeight = baseHeight + taskRowsHeight;
                  const groupHeight = Math.max(
                    minGroupHeight,
                    Math.min(calculatedHeight, maxGroupHeight)
                  );

                  // PERFORMANCE OPTIMIZATION: Removed group throttling to show all tasks
                  // Virtualization within each group handles performance for large task lists

                  // PERFORMANCE OPTIMIZATION: Memoize group rendering
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
                      tasksById={tasksById}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <DragOverlay
          adjustScale={false}
          dropAnimation={{
            duration: 200,
            easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
          }}
          style={{
            cursor: 'grabbing',
            zIndex: 9999,
          }}
        >
          {dragOverlayContent}
        </DragOverlay>
      </DndContext>

      <style>{`
        /* Fixed height container - Asana style */
        .task-groups-container-fixed {
          height: calc(100vh - 200px); /* Fixed height, adjust based on your header height */
          min-height: 400px;
          max-height: calc(100vh - 120px);
          position: relative;
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          background: var(--task-bg-primary, white);
          overflow: hidden;
          /* GPU acceleration for smooth scrolling */
          transform: translateZ(0);
          will-change: scroll-position;
          /* Responsive adjustments */
          margin-bottom: 16px;
        }

        /* Responsive height adjustments */
        @media (max-height: 800px) {
          .task-groups-container-fixed {
            height: calc(100vh - 160px);
            min-height: 300px;
          }
        }

        @media (max-height: 600px) {
          .task-groups-container-fixed {
            height: calc(100vh - 120px);
            min-height: 250px;
          }
        }

        @media (min-height: 1200px) {
          .task-groups-container-fixed {
            height: calc(100vh - 240px);
            max-height: none;
          }
        }

        .task-groups-scrollable {
          height: 100%;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 8px 8px 8px 0;
          /* Smooth scrolling */
          scroll-behavior: smooth;
          /* Custom scrollbar styling */
          scrollbar-width: thin;
          scrollbar-color: var(--task-border-tertiary, #d9d9d9) transparent;
          /* Performance optimizations */
          contain: layout style paint;
          transform: translateZ(0);
          will-change: scroll-position;
        }

        .task-groups-scrollable::-webkit-scrollbar {
          width: 6px;
        }

        .task-groups-scrollable::-webkit-scrollbar-track {
          background: transparent;
        }

        .task-groups-scrollable::-webkit-scrollbar-thumb {
          background-color: var(--task-border-tertiary, #d9d9d9);
          border-radius: 3px;
          transition: background-color 0.2s ease;
        }

        .task-groups-scrollable::-webkit-scrollbar-thumb:hover {
          background-color: var(--task-border-primary, #e8e8e8);
        }

        /* Loading and empty state containers */
        .loading-container,
        .empty-container {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          min-height: 300px;
        }

        .virtualized-task-groups {
          min-width: fit-content;
          position: relative;
          /* GPU acceleration for drag operations */
          transform: translateZ(0);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .virtualized-task-list {
          border: 1px solid var(--task-border-primary, #e8e8e8);
          border-radius: 8px;
          background: var(--task-bg-primary, white);
          box-shadow: 0 1px 3px var(--task-shadow, rgba(0, 0, 0, 0.1));
          overflow: hidden;
          transition: all 0.3s ease;
          position: relative;
        }

        /* Task group header styles */
        .task-group-header {
          background: var(--task-bg-primary, white);
          transition: background-color 0.3s ease;
        }

        .task-group-header-row {
          display: inline-flex;
          height: inherit;
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

        /* Add task row styles - Fixed width responsive design */
        .task-group-add-task {
          background: var(--task-bg-primary, white);
          border-top: 1px solid var(--task-border-secondary, #f0f0f0);
          transition: all 0.3s ease;
          padding: 0 12px;
          width: 100%;
          max-width: 500px; /* Fixed maximum width */
          min-width: 300px; /* Minimum width for mobile */
          min-height: 40px;
          display: flex;
          align-items: center;
          border-radius: 0 0 6px 6px;
          margin-left: 0;
          position: relative;
        }

        .task-group-add-task:hover {
          background: var(--task-hover-bg, #fafafa);
          transform: translateX(2px);
        }

        /* Responsive adjustments for add task row */
        @media (max-width: 768px) {
          .task-group-add-task {
            max-width: 400px;
            min-width: 280px;
          }
        }

        @media (max-width: 480px) {
          .task-group-add-task {
            max-width: calc(100vw - 40px);
            min-width: 250px;
          }
        }

        @media (min-width: 1200px) {
          .task-group-add-task {
            max-width: 600px;
          }
        }

        .task-table-fixed-columns {
          display: flex;
          position: sticky;
          left: 0;
          z-index: 11;
          transition: all 0.3s ease;
          /* Background will be set inline to match theme */
        }

        /* Ensure task rows have proper overflow handling */
        .task-row-container {
          display: flex;
          width: 100%;
          min-width: fit-content;
        }

        .task-row {
          display: flex;
          width: 100%;
          min-width: fit-content;
        }

        .task-table-scrollable-columns {
          display: flex;
          flex: 1;
          min-width: 0;
          overflow: visible;
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

        /* Simplified drag overlay styles */
        .drag-overlay-simplified {
          position: relative;
          z-index: 9999;
          pointer-events: none;
          transform: translateZ(0);
          will-change: transform;
          user-select: none;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          animation: dragOverlayEntrance 0.15s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes dragOverlayEntrance {
          0% {
            transform: scale(0.95) translateZ(0);
            opacity: 0.8;
          }
          100% {
            transform: scale(1.02) translateZ(0);
            opacity: 1;
          }
        }

        .drag-overlay-simplified:hover {
          /* Disable hover effects during drag */
          background-color: inherit !important;
        }

        /* Smooth drag handle animation */
        .drag-handle-icon {
          transition: transform 0.1s ease-out;
        }

        .task-title-drag {
          transition: color 0.1s ease-out;
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

        /* Empty state styles */
        .empty-tasks-container .ant-empty-description {
          color: var(--task-text-secondary, #595959);
        }

        .empty-tasks-container .ant-empty-image svg {
          opacity: 0.4;
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

        .dark .task-groups-container-fixed,
        [data-theme="dark"] .task-groups-container-fixed,
        .dark .task-groups-scrollable,
        [data-theme="dark"] .task-groups-scrollable {
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

        /* Dark mode scrollbar */
        .dark .task-groups-scrollable::-webkit-scrollbar-thumb,
        [data-theme="dark"] .task-groups-scrollable::-webkit-scrollbar-thumb {
          background-color: #505050;
        }

        .dark .task-groups-scrollable::-webkit-scrollbar-thumb:hover,
        [data-theme="dark"] .task-groups-scrollable::-webkit-scrollbar-thumb:hover {
          background-color: #606060;
        }

        /* Dark mode empty state */
        .dark .empty-tasks-container .ant-empty-description,
        [data-theme="dark"] .empty-tasks-container .ant-empty-description {
          color: var(--task-text-secondary, #d9d9d9);
        }

        .dark .empty-tasks-container .ant-empty-image svg,
        [data-theme="dark"] .empty-tasks-container .ant-empty-image svg {
          opacity: 0.6;
        }

        /* Performance optimizations */
        .virtualized-task-group {
          contain: layout style paint;
        }

        .task-row {
          contain: layout style;
          /* GPU acceleration for smooth scrolling */
          transform: translateZ(0);
          will-change: transform;
          transition: opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1), filter 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .task-row.is-dragging {
          transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1), filter 0.15s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Smooth hover effects */
        .task-row:hover:not(.is-dragging) {
          transform: translateZ(0) translateY(-1px);
          transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }

        /* Reduce layout thrashing */
        .task-table-cell {
          contain: layout;
        }

        /* Optimize progressive component loading */
        .progressive-component-placeholder {
          contain: layout style paint;
          transform: translateZ(0);
        }

        /* Shimmer animation optimization */
        @keyframes shimmer {
          0% { 
            background-position: -200px 0; 
            transform: translateX(-100%);
          }
          100% { 
            background-position: calc(200px + 100%) 0; 
            transform: translateX(100%);
          }
        }

        /* Optimize shimmer performance */
        .shimmer-element {
          background: linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.2) 50%, transparent 75%);
          background-size: 200px 100%;
          animation: shimmer 1.5s infinite linear;
          transform: translateZ(0);
          will-change: background-position;
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
