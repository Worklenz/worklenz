import { useEffect, useState, useRef, useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import TaskListFilters from '../taskList/task-list-filters/task-list-filters';
import { Flex, Skeleton } from 'antd';
import BoardSectionCardContainer from './board-section/board-section-container';
import {
  fetchBoardTaskGroups,
  reorderTaskGroups,
  moveTaskBetweenGroups,
  IGroupBy,
  updateTaskProgress,
} from '@features/board/board-slice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  closestCorners,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import BoardViewTaskCard from './board-section/board-task-card/board-view-task-card';
import { fetchStatusesCategories } from '@/features/taskAttributes/taskStatusSlice';
import useTabSearchParam from '@/hooks/useTabSearchParam';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { SocketEvents } from '@/shared/socket-events';
import alertService from '@/services/alerts/alertService';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_board_visit, evt_project_task_list_drag_and_move } from '@/shared/worklenz-analytics-events';
import { ITaskStatusCreateRequest } from '@/types/tasks/task-status-create-request';
import { statusApiService } from '@/api/taskAttributes/status/status.api.service';
import logger from '@/utils/errorLogger';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';

const ProjectViewBoard = () => {
  const dispatch = useAppDispatch();
  const { projectView } = useTabSearchParam();
  const { socket } = useSocket();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const [currentTaskIndex, setCurrentTaskIndex] = useState(-1);
  // Add local loading state to immediately show skeleton
  const [isLoading, setIsLoading] = useState(true);
  
  const { projectId } = useAppSelector(state => state.projectReducer);
  const { taskGroups, groupBy, loadingGroups, search, archived } = useAppSelector(state => state.boardReducer);
  const { statusCategories, loading: loadingStatusCategories } = useAppSelector(
    state => state.taskStatusReducer
  );
  const [activeItem, setActiveItem] = useState<any>(null);

  // Store the original source group ID when drag starts
  const originalSourceGroupIdRef = useRef<string | null>(null);

  // Update loading state based on all loading conditions
  useEffect(() => {
    setIsLoading(loadingGroups || loadingStatusCategories);
  }, [loadingGroups, loadingStatusCategories]);

  // Load data efficiently with async/await and Promise.all
  useEffect(() => {
    const loadData = async () => {
      if (projectId && groupBy && projectView === 'kanban') {
        const promises = [];
        
        if (!loadingGroups) {
          promises.push(dispatch(fetchBoardTaskGroups(projectId)));
        }
        
        if (!statusCategories.length) {
          promises.push(dispatch(fetchStatusesCategories()));
        }
        
        // Wait for all data to load
        await Promise.all(promises);
      }
    };
    
    loadData();
  }, [dispatch, projectId, groupBy, projectView, search, archived]);

  // Create sensors with memoization to prevent unnecessary re-renders
  const sensors = useSensors(
    useSensor(MouseSensor, {
      // Require the mouse to move by 10 pixels before activating
      activationConstraint: {
        distance: 10,
      },
    }),
    useSensor(TouchSensor, {
      // Press delay of 250ms, with tolerance of 5px of movement
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleTaskProgress = (data: {
    id: string;
    status: string;
    complete_ratio: number;
    completed_count: number;
    total_tasks_count: number;  
    parent_task: string;
  }) => {
    dispatch(updateTaskProgress(data));
  };

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveItem(active.data.current);
    setCurrentTaskIndex(active.data.current?.sortable.index);
    // Store the original source group ID when drag starts
    if (active.data.current?.type === 'task') {
      originalSourceGroupIdRef.current = active.data.current.sectionId;
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id;
    const overId = over.id;

    if (activeId === overId) return;

    const isActiveTask = active.data.current?.type === 'task';
    const isOverTask = over.data.current?.type === 'task';
    const isOverSection = over.data.current?.type === 'section';

    // Handle task movement between sections
    if (isActiveTask && (isOverTask || isOverSection)) {
      // If we're over a task, we want to insert at that position
      // If we're over a section, we want to append to the end
      const activeTaskId = active.data.current?.task.id;

      // Use the original source group ID from ref instead of the potentially modified one
      const sourceGroupId = originalSourceGroupIdRef.current || active.data.current?.sectionId;

      // Fix: Ensure we correctly identify the target group ID
      let targetGroupId;
      if (isOverTask) {
        // If over a task, get its section ID
        targetGroupId = over.data.current?.sectionId;
      } else if (isOverSection) {
        // If over a section directly
        targetGroupId = over.id;
      } else {
        // Fallback
        targetGroupId = over.id;
      }

      // Find the target index
      let targetIndex = -1;
      if (isOverTask) {
        const overTaskId = over.data.current?.task.id;
        const targetGroup = taskGroups.find(group => group.id === targetGroupId);
        if (targetGroup) {
          targetIndex = targetGroup.tasks.findIndex(task => task.id === overTaskId);
        }
      }

      // Dispatch the action to move the task
      dispatch(
        moveTaskBetweenGroups({
          taskId: activeTaskId,
          sourceGroupId,
          targetGroupId,
          targetIndex,
        })
      );
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || !projectId) {
      setActiveItem(null);
      originalSourceGroupIdRef.current = null; // Reset the ref
      return;
    }

    const isActiveTask = active.data.current?.type === 'task';
    const isActiveSection = active.data.current?.type === 'section';

    // Handle task dragging between columns
    if (isActiveTask) {
      const task = active.data.current?.task;

      // Use the original source group ID from ref instead of the potentially modified one
      const sourceGroupId = originalSourceGroupIdRef.current || active.data.current?.sectionId;

      // Fix: Ensure we correctly identify the target group ID
      let targetGroupId;
      if (over.data.current?.type === 'task') {
        // If dropping on a task, get its section ID
        targetGroupId = over.data.current?.sectionId;
      } else if (over.data.current?.type === 'section') {
        // If dropping directly on a section
        targetGroupId = over.id;
      } else {
        // Fallback to the over ID if type is not specified
        targetGroupId = over.id;
      }

      // Find source and target groups
      const sourceGroup = taskGroups.find(group => group.id === sourceGroupId);
      const targetGroup = taskGroups.find(group => group.id === targetGroupId);

      if (!sourceGroup || !targetGroup || !task) {
        logger.error('Could not find source or target group, or task is undefined');
        setActiveItem(null);
        originalSourceGroupIdRef.current = null; // Reset the ref
        return;
      }
      if (targetGroupId !== sourceGroupId) {
        const canContinue = await checkTaskDependencyStatus(task.id, targetGroupId);
        if (!canContinue) {
          alertService.error(
            'Task is not completed',
            'Please complete the task dependencies before proceeding'
          );
          dispatch(
            moveTaskBetweenGroups({
              taskId: task.id,
              sourceGroupId: targetGroupId, // Current group (where it was moved optimistically)
              targetGroupId: sourceGroupId, // Move it back to the original source group
              targetIndex: currentTaskIndex !== -1 ? currentTaskIndex : 0, // Original position or append to end
            })
          );
  
          setActiveItem(null);
          originalSourceGroupIdRef.current = null;
          return;
        }
      }

      // Find indices
      let fromIndex = sourceGroup.tasks.findIndex(t => t.id === task.id);

      // Handle case where task is not found in source group (might have been moved already in UI)
      if (fromIndex === -1) {
        logger.info('Task not found in source group. Using task sort_order from task object.');

        // Use the sort_order from the task object itself
        const fromSortOrder = task.sort_order;

        // Calculate target index and position
        let toIndex = -1;
        if (over.data.current?.type === 'task') {
          const overTaskId = over.data.current?.task.id;
          toIndex = targetGroup.tasks.findIndex(t => t.id === overTaskId);
        } else {
          // If dropping on a section, append to the end
          toIndex = targetGroup.tasks.length;
        }

        // Calculate toPos similar to Angular implementation
        const toPos = targetGroup.tasks[toIndex]?.sort_order ||
          targetGroup.tasks[targetGroup.tasks.length - 1]?.sort_order ||
          -1;

        // Prepare socket event payload
        const body = {
          project_id: projectId,
          from_index: fromSortOrder,
          to_index: toPos,
          to_last_index: !toPos,
          from_group: sourceGroupId,
          to_group: targetGroupId,
          group_by: groupBy || 'status',
          task,
          team_id: currentSession?.team_id
        };

        logger.error('Emitting socket event with payload (task not found in source):', body);

        // Emit socket event
        if (socket) {
          socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), body);

          // Set up listener for task progress update
          socket.once(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), () => {
            if (task.is_sub_task) {
              socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
            } else {
              socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
            }
          });
        }

        // Track analytics event
        trackMixpanelEvent(evt_project_task_list_drag_and_move);

        setActiveItem(null);
        originalSourceGroupIdRef.current = null; // Reset the ref
        return;
      }

      // Calculate target index and position
      let toIndex = -1;
      if (over.data.current?.type === 'task') {
        const overTaskId = over.data.current?.task.id;
        toIndex = targetGroup.tasks.findIndex(t => t.id === overTaskId);
      } else {
        // If dropping on a section, append to the end
        toIndex = targetGroup.tasks.length;
      }

      // Calculate toPos similar to Angular implementation
      const toPos = targetGroup.tasks[toIndex]?.sort_order ||
        targetGroup.tasks[targetGroup.tasks.length - 1]?.sort_order ||
        -1;

      // Prepare socket event payload
      const body = {
        project_id: projectId,
        from_index: sourceGroup.tasks[fromIndex].sort_order,
        to_index: toPos,
        to_last_index: !toPos,
        from_group: sourceGroupId, // Use the direct IDs instead of group objects
        to_group: targetGroupId,   // Use the direct IDs instead of group objects
        group_by: groupBy || 'status', // Use the current groupBy value
        task,
        team_id: currentSession?.team_id
      };

      // Emit socket event
      if (socket) {
        socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), body);

        // Set up listener for task progress update
        socket.once(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), () => {
          if (task.is_sub_task) {
            socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.parent_task_id);
          } else {
            socket.emit(SocketEvents.GET_TASK_PROGRESS.toString(), task.id);
          }
        });
      }

      // Track analytics event
      trackMixpanelEvent(evt_project_task_list_drag_and_move);
    }
    // Handle column reordering
    else if (isActiveSection) {
      // Don't allow reordering if groupBy is phases
      if (groupBy === IGroupBy.PHASE) {
        setActiveItem(null);
        originalSourceGroupIdRef.current = null;
        return;
      }

      const sectionId = active.id;
      const fromIndex = taskGroups.findIndex(group => group.id === sectionId);
      const toIndex = taskGroups.findIndex(group => group.id === over.id);

      if (fromIndex !== -1 && toIndex !== -1) {
        // Create a new array with the reordered groups
        const reorderedGroups = [...taskGroups];
        const [movedGroup] = reorderedGroups.splice(fromIndex, 1);
        reorderedGroups.splice(toIndex, 0, movedGroup);

        // Dispatch action to reorder columns with the new array
        dispatch(reorderTaskGroups(reorderedGroups));

        // Prepare column order for API
        const columnOrder = reorderedGroups.map(group => group.id);

        // Call API to update status order
        try {
          // Use the correct API endpoint based on the Angular code
          const requestBody: ITaskStatusCreateRequest = {
            status_order: columnOrder
          };

          const response = await statusApiService.updateStatusOrder(requestBody, projectId);
          if (!response.done) {
            const revertedGroups = [...reorderedGroups];
            const [movedBackGroup] = revertedGroups.splice(toIndex, 1);
            revertedGroups.splice(fromIndex, 0, movedBackGroup);
            dispatch(reorderTaskGroups(revertedGroups));
            alertService.error('Failed to update column order', 'Please try again');
          }
        } catch (error) {
          // Revert the change if API call fails
          const revertedGroups = [...reorderedGroups];
          const [movedBackGroup] = revertedGroups.splice(toIndex, 1);
          revertedGroups.splice(fromIndex, 0, movedBackGroup);
          dispatch(reorderTaskGroups(revertedGroups));
          alertService.error('Failed to update column order', 'Please try again');
        }
      }
    }

    setActiveItem(null);
    originalSourceGroupIdRef.current = null; // Reset the ref
  };

  useEffect(() => {   
    if (socket) {
      socket.on(SocketEvents.GET_TASK_PROGRESS.toString(), handleTaskProgress);
    }

    return () => {
      socket?.off(SocketEvents.GET_TASK_PROGRESS.toString(), handleTaskProgress);
    };
  }, [socket]);

  // Track analytics event on component mount
  useEffect(() => {
    trackMixpanelEvent(evt_project_board_visit);
  }, []);

  return (
    <Flex vertical gap={16}>
      <TaskListFilters position={'board'} />

      <Skeleton active loading={isLoading} className='mt-4 p-4'>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <BoardSectionCardContainer
            datasource={taskGroups}
            group={groupBy as 'status' | 'priority' | 'phases'}
          />
          <DragOverlay>
            {activeItem?.type === 'task' && (
              <BoardViewTaskCard task={activeItem.task} sectionId={activeItem.sectionId} />
            )}
          </DragOverlay>
        </DndContext>
      </Skeleton>
    </Flex>
  );
};

export default ProjectViewBoard;
