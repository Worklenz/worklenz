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
import { Card, Spin, Empty, Alert } from '@/shared/antd-imports';
import { RootState } from '@/app/store';
import {
  selectAllTasks,
  selectLoading,
  selectError,
  reorderTasksInGroup,
  toggleTaskExpansion,
  fetchTasksV3,
  selectTaskGroupsV3,
  fetchSubTasks,
} from '@/features/task-management/task-management.slice';
import {
  selectCurrentGrouping,
} from '@/features/task-management/grouping.slice';
import {
  selectSelectedTaskIds,
  clearSelection,
  selectTask,
} from '@/features/task-management/selection.slice';
import {
  selectTasks,
  deselectAll as deselectAllBulk,
} from '@/features/projects/bulkActions/bulkActionSlice';
import { Task, TaskGroup } from '@/types/task-management.types';
import { useTaskSocketHandlers } from '@/hooks/useTaskSocketHandlers';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import TaskRow from './task-row';
// import BulkActionBar from './bulk-action-bar';
import OptimizedBulkActionBar from './optimized-bulk-action-bar';
// import OptimizedBulkActionBar from './optimized-bulk-action-bar';
import VirtualizedTaskList from './virtualized-task-list';
import { AppDispatch } from '@/app/store';
import { shallowEqual } from 'react-redux';
import { taskListBulkActionsApiService } from '@/api/tasks/task-list-bulk-actions.api.service';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import {
  evt_project_task_list_bulk_archive,
  evt_project_task_list_bulk_assign_me,
  evt_project_task_list_bulk_assign_members,
  evt_project_task_list_bulk_change_phase,
  evt_project_task_list_bulk_change_priority,
  evt_project_task_list_bulk_change_status,
  evt_project_task_list_bulk_delete,
  evt_project_task_list_bulk_update_labels,
} from '@/shared/worklenz-analytics-events';
import {
  IBulkTasksLabelsRequest,
  IBulkTasksPhaseChangeRequest,
  IBulkTasksPriorityChangeRequest,
  IBulkTasksStatusChangeRequest,
} from '@/types/tasks/bulk-action-bar.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';
import alertService from '@/services/alerts/alertService';
import logger from '@/utils/errorLogger';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';

// Import the improved TaskListFilters component synchronously to avoid suspense
import ImprovedTaskFilters from './improved-task-filters';
import PerformanceAnalysis from './performance-analysis';

// Import asset optimizations
import { AssetPreloader, LazyLoader } from '@/utils/asset-optimizations';

// Import performance monitoring
import { CustomPerformanceMeasurer } from '@/utils/enhanced-performance-monitoring';

// Import drag and drop performance optimizations
import './drag-drop-optimized.css';
import './optimized-bulk-action-bar.css';

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
  const { t } = useTranslation(['task-management', 'task-list-table']);
  const { trackMixpanelEvent } = useMixpanelTracking();
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

  // Socket connection for drag and drop
  const { socket, connected } = useSocket();

  // Redux selectors using V3 API (pre-processed data, minimal loops)
  const tasks = useSelector(selectAllTasks);
  const loading = useSelector(selectLoading);
  const error = useSelector(selectError);
  const taskGroups = useSelector(selectTaskGroupsV3, shallowEqual);
  const currentGrouping = useSelector(selectCurrentGrouping);
  const selectedTaskIds = useSelector(selectSelectedTaskIds);

  // Bulk action selectors
  const statusList = useSelector((state: RootState) => state.taskStatusReducer.status);
  const priorityList = useSelector((state: RootState) => state.priorityReducer.priorities);
  const phaseList = useSelector((state: RootState) => state.phaseReducer.phaseList);
  const labelsList = useSelector((state: RootState) => state.taskLabelsReducer.labels);
  const members = useSelector((state: RootState) => state.teamMembersReducer.teamMembers);
  const archived = useSelector((state: RootState) => state.taskReducer.archived);

  // Get theme from Redux store
  const isDarkMode = useSelector((state: RootState) => state.themeReducer?.mode === 'dark');
  const themeClass = isDarkMode ? 'dark' : 'light';

  // PERFORMANCE OPTIMIZATION: Build a tasksById map with memory-conscious approach
  const tasksById = useMemo(() => {
    const map: Record<string, Task> = {};
    // Cache all tasks for full functionality - performance optimizations are handled at the virtualization level
    if (Array.isArray(tasks)) {
      tasks.forEach((task: Task) => {
        map[task.id] = task;
      });
    }
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

  // Initialize asset optimization
  useEffect(() => {
    // Preload critical task management assets
    AssetPreloader.preloadAssets([
      { url: '/icons/task-status.svg', priority: 'high' },
      { url: '/icons/priority-high.svg', priority: 'high' },
      { url: '/icons/priority-medium.svg', priority: 'high' },
      { url: '/icons/priority-low.svg', priority: 'high' },
      { url: '/icons/phase.svg', priority: 'medium' },
      { url: '/icons/assignee.svg', priority: 'medium' },
    ]);

    // Preload critical images for better performance
    LazyLoader.preloadCriticalImages([
      '/icons/task-status.svg',
      '/icons/priority-high.svg',
      '/icons/priority-medium.svg',
      '/icons/priority-low.svg',
    ]);
  }, []);

  // Fetch task groups when component mounts or dependencies change
  useEffect(() => {
    if (projectId && !hasInitialized.current) {
      hasInitialized.current = true;

      // Measure task loading performance
      CustomPerformanceMeasurer.mark('task-load-time');
      
      // Fetch real tasks from V3 API (minimal processing needed)
      dispatch(fetchTasksV3(projectId)).finally(() => {
        CustomPerformanceMeasurer.measure('task-load-time');
      });
    }
  }, [projectId, dispatch]);

  // Memoized calculations - optimized
  const totalTasks = useMemo(() => {
    const total = taskGroups.reduce((sum, g) => sum + g.taskIds.length, 0);
    return total;
  }, [taskGroups, tasks.length]);

  const hasAnyTasks = useMemo(() => totalTasks > 0, [totalTasks]);

  // Add isDragging state
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      setIsDragging(true);
      const { active } = event;
      const taskId = active.id as string;

      // Find the task and its group
      const activeTask = Array.isArray(tasks) ? tasks.find((t: Task) => t.id === taskId) || null : null;
      let activeGroupId: string | null = null;

      if (activeTask) {
        // Find which group contains this task by looking through all groups
        for (const group of taskGroups) {
          if (group.taskIds.includes(taskId)) {
            activeGroupId = group.id;
            break;
          }
        }
      }

      setDragState({
        activeTask,
        activeGroupId,
      });
    },
    [tasks, currentGrouping, taskGroups]
  );

  // Throttled drag over handler for smoother performance
  const handleDragOver = useCallback(
    throttle((event: DragOverEvent) => {
      const { active, over } = event;

      if (!over || !dragState.activeTask) return;

      const activeTaskId = active.id as string;
      const overId = over.id as string;

      // Check if we're hovering over a task or a group container
      const targetTask = Array.isArray(tasks) ? tasks.find((t: Task) => t.id === overId) : undefined;
      let targetGroupId = overId;

      if (targetTask) {
        // We're hovering over a task, determine its group
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
    }, 16), // 60fps throttling for smooth performance
    [dragState, tasks, taskGroups, currentGrouping]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragging(false);
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

      if (!event.over || !currentDragState.activeTask || !currentDragState.activeGroupId) {
        return;
      }

      const { active, over } = event;
      const activeTaskId = active.id as string;
      const overId = over.id as string;

      // Determine target group and position
      let targetGroupId = overId;
      let targetIndex = -1;

      // Check if dropping on a task or a group
      const targetTask = Array.isArray(tasks) ? tasks.find((t: Task) => t.id === overId) : undefined;
      if (targetTask) {
        // Dropping on a task, find which group contains this task
        for (const group of taskGroups) {
          if (group.taskIds.includes(targetTask.id)) {
            targetGroupId = group.id;
            break;
          }
        }

        // Find the index of the target task within its group
        const targetGroup = taskGroups.find(g => g.id === targetGroupId);
        if (targetGroup) {
          targetIndex = targetGroup.taskIds.indexOf(targetTask.id);
        }
      } else {
        // Dropping on a group container, add to the end
        const targetGroup = taskGroups.find(g => g.id === targetGroupId);
        if (targetGroup) {
          targetIndex = targetGroup.taskIds.length;
        }
      }

      // Find source and target groups
      const sourceGroup = taskGroups.find(g => g.id === currentDragState.activeGroupId);
      const targetGroup = taskGroups.find(g => g.id === targetGroupId);

      if (sourceGroup && targetGroup && targetIndex !== -1) {
        const sourceIndex = sourceGroup.taskIds.indexOf(activeTaskId);
        const finalTargetIndex = targetIndex === -1 ? targetGroup.taskIds.length : targetIndex;

        // Only reorder if actually moving to a different position
        if (sourceGroup.id !== targetGroup.id || sourceIndex !== finalTargetIndex) {
          // Use the new reorderTasksInGroup action that properly handles group arrays
          dispatch(
            reorderTasksInGroup({
              sourceTaskId: activeTaskId,
              destinationTaskId: targetTask?.id || '',
              sourceGroupId: currentDragState.activeGroupId,
              destinationGroupId: targetGroupId,
            })
          );

          // Emit socket event to backend
          if (connected && socket && currentDragState.activeTask) {
            const currentSession = JSON.parse(localStorage.getItem('session') || '{}');

            const socketData = {
              from_index: sourceIndex,
              to_index: finalTargetIndex,
              to_last_index: finalTargetIndex >= targetGroup.taskIds.length,
              from_group: currentDragState.activeGroupId,
              to_group: targetGroupId,
              group_by: currentGrouping,
              project_id: projectId,
              task: currentDragState.activeTask,
              team_id: currentSession.team_id,
            };

            socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), socketData);
          }
        }
      }
    },
    [dragState, tasks, taskGroups, currentGrouping, dispatch, connected, socket, projectId]
  );

  const handleSelectTask = useCallback(
    (taskId: string, selected: boolean) => {
      // Create a new Set from existing selections for efficient lookup and modification
      const currentSelectedIds = new Set(selectedTaskIds);

      // Update the selection state based on the checkbox action
      if (selected) {
        currentSelectedIds.add(taskId);
      } else {
        currentSelectedIds.delete(taskId);
      }

      // Convert Set back to array for Redux state
      const newSelectedIds = Array.from(currentSelectedIds);

      // Map selected tasks to the required format
      const newSelectedTasks = Array.isArray(tasks) ? tasks
        .filter((t: Task) => newSelectedIds.includes(t.id))
        .map(
          (task: Task): IProjectTask => ({
            id: task.id,
            name: task.title,
            task_key: task.task_key,
            status: task.status,
            status_id: task.status,
            priority: task.priority,
            phase_id: task.phase,
            phase_name: task.phase,
            description: task.description,
            start_date: task.startDate,
            end_date: task.dueDate,
            total_hours: task.timeTracking?.estimated || 0,
            total_minutes: task.timeTracking?.logged || 0,
            progress: task.progress,
            sub_tasks_count: task.sub_tasks_count || 0,
            assignees: task.assignees?.map((assigneeId: string) => ({
              id: assigneeId,
              name: '',
              email: '',
              avatar_url: '',
              team_member_id: assigneeId,
              project_member_id: assigneeId,
            })),
            labels: task.labels,
            manual_progress: false,
            created_at: (task as any).createdAt || (task as any).created_at,
            updated_at: (task as any).updatedAt || (task as any).updated_at,
            sort_order: task.order,
          })
        ) : [];

      // Dispatch both actions to update the Redux state
      dispatch(selectTasks(newSelectedTasks));
      // Update selection state with the new task IDs
      newSelectedIds.forEach(taskId => dispatch(selectTask(taskId)));
    },
    [dispatch, selectedTaskIds, tasks]
  );

  const handleToggleSubtasks = useCallback(
    (taskId: string) => {
      const task = tasksById[taskId];
      if (
        task &&
        !task.show_sub_tasks &&
        task.sub_tasks_count &&
        task.sub_tasks_count > 0 &&
        (!task.sub_tasks || task.sub_tasks.length === 0)
      ) {
        dispatch(fetchSubTasks({ taskId, projectId }));
      }
      dispatch(toggleTaskExpansion(taskId));
    },
    [dispatch, projectId, tasksById]
  );

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

  // Bulk action handlers - implementing real functionality from task-list-bulk-actions-bar
  const handleClearSelection = useCallback(() => {
    dispatch(deselectAllBulk());
    dispatch(clearSelection());
  }, [dispatch]);

  const handleBulkStatusChange = useCallback(
    async (statusId: string) => {
      if (!statusId || !projectId) return;
      try {
        // Find the status object
        const status = statusList.find(s => s.id === statusId);
        if (!status || !status.id) return;

        const body: IBulkTasksStatusChangeRequest = {
          tasks: selectedTaskIds,
          status_id: status.id,
        };

        // Check task dependencies first
        for (const taskId of selectedTaskIds) {
          const canContinue = await checkTaskDependencyStatus(taskId, status.id);
          if (!canContinue) {
            if (selectedTaskIds.length > 1) {
              alertService.warning(
                'Incomplete Dependencies!',
                'Some tasks were not updated. Please ensure all dependent tasks are completed before proceeding.'
              );
            } else {
              alertService.error(
                'Task is not completed',
                'Please complete the task dependencies before proceeding'
              );
            }
            return;
          }
        }

        const res = await taskListBulkActionsApiService.changeStatus(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_status);
          dispatch(deselectAllBulk());
          dispatch(clearSelection());
          dispatch(fetchTasksV3(projectId));
        }
      } catch (error) {
        logger.error('Error changing status:', error);
      }
    },
    [selectedTaskIds, statusList, projectId, trackMixpanelEvent, dispatch]
  );

  const handleBulkPriorityChange = useCallback(
    async (priorityId: string) => {
      if (!priorityId || !projectId) return;
      try {
        const priority = priorityList.find(p => p.id === priorityId);
        if (!priority || !priority.id) return;

        const body: IBulkTasksPriorityChangeRequest = {
          tasks: selectedTaskIds,
          priority_id: priority.id,
        };
        const res = await taskListBulkActionsApiService.changePriority(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_priority);
          dispatch(deselectAllBulk());
          dispatch(clearSelection());
          dispatch(fetchTasksV3(projectId));
        }
      } catch (error) {
        logger.error('Error changing priority:', error);
      }
    },
    [selectedTaskIds, priorityList, projectId, trackMixpanelEvent, dispatch]
  );

  const handleBulkPhaseChange = useCallback(
    async (phaseId: string) => {
      if (!phaseId || !projectId) return;
      try {
        const phase = phaseList.find(p => p.id === phaseId);
        if (!phase || !phase.id) return;

        const body: IBulkTasksPhaseChangeRequest = {
          tasks: selectedTaskIds,
          phase_id: phase.id,
        };
        const res = await taskListBulkActionsApiService.changePhase(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_change_phase);
          dispatch(deselectAllBulk());
          dispatch(clearSelection());
          dispatch(fetchTasksV3(projectId));
        }
      } catch (error) {
        logger.error('Error changing phase:', error);
      }
    },
    [selectedTaskIds, phaseList, projectId, trackMixpanelEvent, dispatch]
  );

  const handleBulkAssignToMe = useCallback(async () => {
    if (!projectId) return;
    try {
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.assignToMe(body);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_assign_me);
        dispatch(deselectAllBulk());
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
      }
    } catch (error) {
      logger.error('Error assigning to me:', error);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch]);

  const handleBulkAssignMembers = useCallback(
    async (memberIds: string[]) => {
      if (!projectId || !members?.data) return;
      try {
        // Convert memberIds to member objects with proper type checking
        const selectedMembers = members.data.filter(
          member => member.id && memberIds.includes(member.id)
        );

        const body = {
          tasks: selectedTaskIds,
          project_id: projectId,
          members: selectedMembers.map(member => ({
            id: member.id!,
            name: member.name || '',
            email: member.email || '',
            avatar_url: member.avatar_url || '',
            team_member_id: member.id!,
            project_member_id: member.id!,
          })),
        };
        const res = await taskListBulkActionsApiService.assignTasks(body);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_assign_members);
          dispatch(deselectAllBulk());
          dispatch(clearSelection());
          dispatch(fetchTasksV3(projectId));
        }
      } catch (error) {
        logger.error('Error assigning tasks:', error);
      }
    },
    [selectedTaskIds, projectId, members, trackMixpanelEvent, dispatch]
  );

  const handleBulkAddLabels = useCallback(
    async (labelIds: string[]) => {
      if (!projectId) return;
      try {
        // Convert labelIds to label objects with proper type checking
        const selectedLabels = labelsList.filter(label => label.id && labelIds.includes(label.id));

        const body: IBulkTasksLabelsRequest = {
          tasks: selectedTaskIds,
          labels: selectedLabels,
          text: null,
        };
        const res = await taskListBulkActionsApiService.assignLabels(body, projectId);
        if (res.done) {
          trackMixpanelEvent(evt_project_task_list_bulk_update_labels);
          dispatch(deselectAllBulk());
          dispatch(clearSelection());
          dispatch(fetchTasksV3(projectId));
          dispatch(fetchLabels());
        }
      } catch (error) {
        logger.error('Error updating labels:', error);
      }
    },
    [selectedTaskIds, projectId, labelsList, trackMixpanelEvent, dispatch]
  );

  const handleBulkArchive = useCallback(async () => {
    if (!projectId) return;
    try {
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.archiveTasks(body, archived);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_archive);
        dispatch(deselectAllBulk());
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
      }
    } catch (error) {
      logger.error('Error archiving tasks:', error);
    }
  }, [selectedTaskIds, projectId, archived, trackMixpanelEvent, dispatch]);

  const handleBulkDelete = useCallback(async () => {
    if (!projectId) return;
    try {
      const body = {
        tasks: selectedTaskIds,
        project_id: projectId,
      };
      const res = await taskListBulkActionsApiService.deleteTasks(body, projectId);
      if (res.done) {
        trackMixpanelEvent(evt_project_task_list_bulk_delete);
        dispatch(deselectAllBulk());
        dispatch(clearSelection());
        dispatch(fetchTasksV3(projectId));
      }
    } catch (error) {
      logger.error('Error deleting tasks:', error);
    }
  }, [selectedTaskIds, projectId, trackMixpanelEvent, dispatch]);

  // Additional handlers for new actions
  const handleBulkDuplicate = useCallback(async () => {
    // This would need to be implemented in the API service
  }, [selectedTaskIds]);

  const handleBulkExport = useCallback(async () => {
    // This would need to be implemented in the API service
  }, [selectedTaskIds]);

  const handleBulkSetDueDate = useCallback(
    async (date: string) => {
      // This would need to be implemented in the API service
    },
    [selectedTaskIds]
  );

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (dragOverTimeoutRef.current) {
        clearTimeout(dragOverTimeoutRef.current);
      }
    };
  }, []);

  // Remove translation loading check since we're using simple load-as-you-go approach

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
        autoScroll={false}
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
          <div className={`task-groups-scrollable${isDragging ? ' lock-scroll' : ''}`}>
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
                      <div
                        style={{ fontSize: '12px', color: 'var(--task-text-secondary, #595959)' }}
                      >
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

        <DragOverlay adjustScale={false} dropAnimation={null}>
          {dragOverlayContent}
        </DragOverlay>
      </DndContext>

      {/* Optimized Bulk Action Bar */}
      <OptimizedBulkActionBar
        selectedTaskIds={selectedTaskIds}
        totalSelected={selectedTaskIds.length}
        projectId={projectId}
        onClearSelection={handleClearSelection}
        onBulkStatusChange={handleBulkStatusChange}
        onBulkPriorityChange={handleBulkPriorityChange}
        onBulkPhaseChange={handleBulkPhaseChange}
        onBulkAssignToMe={handleBulkAssignToMe}
        onBulkAssignMembers={handleBulkAssignMembers}
        onBulkAddLabels={handleBulkAddLabels}
        onBulkArchive={handleBulkArchive}
        onBulkDelete={handleBulkDelete}
        onBulkDuplicate={handleBulkDuplicate}
        onBulkExport={handleBulkExport}
        onBulkSetDueDate={handleBulkSetDueDate}
      />

      <style>{`
        /* Fixed height container - Asana style */
        .task-groups-container-fixed {
          height: calc(100vh - 200px); /* Fixed height, adjust based on your header height */
          min-height: 400px;
          max-height: calc(100vh - 120px);
          position: relative;
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
          font-size: 14px !important;
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
          --task-border-hover-top: #c0c0c0; /* Slightly darker for visibility */
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
          --task-border-hover-top-dark: #505050; /* Slightly darker for visibility in dark mode */
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

        .task-groups-scrollable.lock-scroll {
          overflow: hidden !important;
        }
      `}</style>
    </div>
  );
};

export default TaskListBoard;
