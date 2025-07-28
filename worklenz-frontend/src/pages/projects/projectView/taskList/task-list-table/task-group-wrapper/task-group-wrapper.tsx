import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useSocket } from '@/socket/socketContext';
import { useAuthService } from '@/hooks/useAuth';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import Flex from 'antd/es/flex';
import useIsomorphicLayoutEffect from '@/hooks/useIsomorphicLayoutEffect';

import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  pointerWithin,
} from '@dnd-kit/core';

import { SocketEvents } from '@/shared/socket-events';
import logger from '@/utils/errorLogger';
import alertService from '@/services/alerts/alertService';
import { tasksApiService } from '@/api/tasks/tasks.api.service';

import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { ITaskAssigneesUpdateResponse } from '@/types/tasks/task-assignee-update-response';
import { ILabelsChangeResponse } from '@/types/tasks/taskList.types';
import { ITaskListStatusChangeResponse } from '@/types/tasks/task-list-status.types';
import { ITaskListPriorityChangeResponse } from '@/types/tasks/task-list-priority.types';
import { ITaskPhaseChangeResponse } from '@/types/tasks/task-phase-change-response';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

import {
  fetchTaskAssignees,
  updateTaskAssignees,
  fetchLabelsByProject,
  updateTaskLabel,
  updateTaskStatus,
  updateTaskPriority,
  updateTaskEndDate,
  updateTaskEstimation,
  updateTaskName,
  updateTaskPhase,
  updateTaskStartDate,
  IGroupBy,
  updateTaskDescription,
  updateSubTasks,
  updateTaskProgress,
} from '@/features/tasks/tasks.slice';
import { fetchLabels } from '@/features/taskAttributes/taskLabelSlice';
import {
  setStartDate,
  setTaskAssignee,
  setTaskEndDate,
  setTaskLabels,
  setTaskPriority,
  setTaskStatus,
  setTaskSubscribers,
} from '@/features/task-drawer/task-drawer.slice';
import { deselectAll } from '@/features/projects/bulkActions/bulkActionSlice';

import TaskListTableWrapper from '@/pages/projects/projectView/taskList/task-list-table/task-list-table-wrapper/task-list-table-wrapper';

import TaskTemplateDrawer from '@/components/task-templates/task-template-drawer';

import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_project_task_list_drag_and_move } from '@/shared/worklenz-analytics-events';
import { ALPHA_CHANNEL } from '@/shared/constants';
import { checkTaskDependencyStatus } from '@/utils/check-task-dependency-status';

interface TaskGroupWrapperProps {
  taskGroups: ITaskListGroup[];
  groupBy: string;
}

const TaskGroupWrapper = ({ taskGroups, groupBy }: TaskGroupWrapperProps) => {
  const [groups, setGroups] = useState(taskGroups);
  const [activeId, setActiveId] = useState<string | null>(null);

  const dispatch = useAppDispatch();
  const { socket } = useSocket();
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const loadingAssignees = useAppSelector(state => state.taskReducer.loadingAssignees);
  const { projectId } = useAppSelector(state => state.projectReducer);

  // Move useSensors to top level and memoize its configuration
  const sensorConfig = useMemo(
    () => ({
      activationConstraint: { distance: 8 },
    }),
    []
  );

  const pointerSensor = useSensor(PointerSensor, sensorConfig);
  const sensors = useSensors(pointerSensor);

  useEffect(() => {
    setGroups(taskGroups);
  }, [taskGroups]);

  // Memoize resetTaskRowStyles to prevent unnecessary re-renders
  const resetTaskRowStyles = useCallback(() => {
    document.querySelectorAll<HTMLElement>('.task-row').forEach(row => {
      row.style.transition = 'transform 0.2s ease, opacity 0.2s ease';
      row.style.cssText =
        'opacity: 1 !important; position: relative !important; z-index: auto !important; transform: none !important;';
      row.setAttribute('data-is-dragging', 'false');
    });
  }, []);

  // Memoize socket event handlers
  const handleAssigneesUpdate = useCallback(
    (data: ITaskAssigneesUpdateResponse) => {
      if (!data) return;

      const updatedAssignees =
        data.assignees?.map(assignee => ({
          ...assignee,
          selected: true,
        })) || [];

      const groupId = groups?.find(group =>
        group.tasks?.some(
          task =>
            task.id === data.id ||
            (task.sub_tasks && task.sub_tasks.some(subtask => subtask.id === data.id))
        )
      )?.id;

      if (groupId) {
        dispatch(
          updateTaskAssignees({
            groupId,
            taskId: data.id,
            assignees: updatedAssignees,
          })
        );

        dispatch(
          setTaskAssignee({
            ...data,
            manual_progress: false,
          } as IProjectTask)
        );

        if (currentSession?.team_id && !loadingAssignees) {
          dispatch(fetchTaskAssignees(currentSession.team_id));
        }
      }
    },
    [groups, dispatch, currentSession?.team_id, loadingAssignees]
  );

  // Memoize socket event handlers
  const handleLabelsChange = useCallback(
    async (labels: ILabelsChangeResponse) => {
      if (!labels) return;

      await Promise.all([
        dispatch(updateTaskLabel(labels)),
        dispatch(setTaskLabels(labels)),
        dispatch(fetchLabels()),
        projectId && dispatch(fetchLabelsByProject(projectId)),
      ]);
    },
    [dispatch, projectId]
  );

  // Memoize socket event handlers
  const handleTaskStatusChange = useCallback(
    (response: ITaskListStatusChangeResponse) => {
      if (!response) return;

      if (response.completed_deps === false) {
        alertService.error(
          'Task is not completed',
          'Please complete the task dependencies before proceeding'
        );
        return;
      }

      dispatch(updateTaskStatus(response));
      dispatch(deselectAll());
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleTaskProgress = useCallback(
    (data: {
      id: string;
      status: string;
      complete_ratio: number;
      completed_count: number;
      total_tasks_count: number;
      parent_task: string;
    }) => {
      if (!data) return;

      dispatch(
        updateTaskProgress({
          taskId: data.parent_task || data.id,
          progress: data.complete_ratio,
          totalTasksCount: data.total_tasks_count,
          completedCount: data.completed_count,
        })
      );
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handlePriorityChange = useCallback(
    (response: ITaskListPriorityChangeResponse) => {
      if (!response) return;

      dispatch(updateTaskPriority(response));
      dispatch(setTaskPriority(response));
      dispatch(deselectAll());
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleEndDateChange = useCallback(
    (task: { id: string; parent_task: string | null; end_date: string }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskEndDate({ task: taskWithProgress }));
      dispatch(setTaskEndDate(taskWithProgress));
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleTaskNameChange = useCallback(
    (data: { id: string; parent_task: string; name: string }) => {
      if (!data) return;

      dispatch(updateTaskName(data));
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handlePhaseChange = useCallback(
    (data: ITaskPhaseChangeResponse) => {
      if (!data) return;

      dispatch(updateTaskPhase(data));
      dispatch(deselectAll());
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleStartDateChange = useCallback(
    (task: { id: string; parent_task: string | null; start_date: string }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskStartDate({ task: taskWithProgress }));
      dispatch(setStartDate(taskWithProgress));
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleTaskSubscribersChange = useCallback(
    (data: InlineMember[]) => {
      if (!data) return;

      dispatch(setTaskSubscribers(data));
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleEstimationChange = useCallback(
    (task: { id: string; parent_task: string | null; estimation: number }) => {
      if (!task) return;

      const taskWithProgress = {
        ...task,
        manual_progress: false,
      } as IProjectTask;

      dispatch(updateTaskEstimation({ task: taskWithProgress }));
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleTaskDescriptionChange = useCallback(
    (data: { id: string; parent_task: string; description: string }) => {
      if (!data) return;

      dispatch(updateTaskDescription(data));
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleNewTaskReceived = useCallback(
    (data: IProjectTask) => {
      if (!data) return;

      if (data.parent_task_id) {
        dispatch(updateSubTasks(data));
      }
    },
    [dispatch]
  );

  // Memoize socket event handlers
  const handleTaskProgressUpdated = useCallback(
    (data: { task_id: string; progress_value?: number; weight?: number }) => {
      if (!data || !taskGroups) return;

      if (data.progress_value !== undefined) {
        for (const group of taskGroups) {
          const task = group.tasks?.find(task => task.id === data.task_id);
          if (task) {
            dispatch(
              updateTaskProgress({
                taskId: data.task_id,
                progress: data.progress_value,
                totalTasksCount: task.total_tasks_count || 0,
                completedCount: task.completed_count || 0,
              })
            );
            break;
          }
        }
      }
    },
    [dispatch, taskGroups]
  );

  // Set up socket event listeners
  useEffect(() => {
    if (!socket) return;

    const eventHandlers = {
      [SocketEvents.QUICK_ASSIGNEES_UPDATE.toString()]: handleAssigneesUpdate,
      [SocketEvents.TASK_LABELS_CHANGE.toString()]: handleLabelsChange,
      [SocketEvents.CREATE_LABEL.toString()]: handleLabelsChange,
      [SocketEvents.TASK_STATUS_CHANGE.toString()]: handleTaskStatusChange,
      [SocketEvents.GET_TASK_PROGRESS.toString()]: handleTaskProgress,
      [SocketEvents.TASK_PRIORITY_CHANGE.toString()]: handlePriorityChange,
      [SocketEvents.TASK_END_DATE_CHANGE.toString()]: handleEndDateChange,
      [SocketEvents.TASK_NAME_CHANGE.toString()]: handleTaskNameChange,
      [SocketEvents.TASK_PHASE_CHANGE.toString()]: handlePhaseChange,
      [SocketEvents.TASK_START_DATE_CHANGE.toString()]: handleStartDateChange,
      [SocketEvents.TASK_SUBSCRIBERS_CHANGE.toString()]: handleTaskSubscribersChange,
      [SocketEvents.TASK_TIME_ESTIMATION_CHANGE.toString()]: handleEstimationChange,
      [SocketEvents.TASK_DESCRIPTION_CHANGE.toString()]: handleTaskDescriptionChange,
      [SocketEvents.QUICK_TASK.toString()]: handleNewTaskReceived,
      [SocketEvents.TASK_PROGRESS_UPDATED.toString()]: handleTaskProgressUpdated,
    };

    // Register all event handlers
    Object.entries(eventHandlers).forEach(([event, handler]) => {
      if (handler) {
        socket.on(event, handler);
      }
    });

    // Cleanup function
    return () => {
      Object.entries(eventHandlers).forEach(([event, handler]) => {
        if (handler) {
          socket.off(event, handler);
        }
      });
    };
  }, [
    socket,
    handleAssigneesUpdate,
    handleLabelsChange,
    handleTaskStatusChange,
    handleTaskProgress,
    handlePriorityChange,
    handleEndDateChange,
    handleTaskNameChange,
    handlePhaseChange,
    handleStartDateChange,
    handleTaskSubscribersChange,
    handleEstimationChange,
    handleTaskDescriptionChange,
    handleNewTaskReceived,
    handleTaskProgressUpdated,
  ]);

  // Memoize drag handlers
  const handleDragStart = useCallback(({ active }: DragStartEvent) => {
    setActiveId(active.id as string);

    const draggedElement = document.querySelector(`[data-id="${active.id}"]`);
    if (draggedElement) {
      (draggedElement as HTMLElement).style.transition = 'transform 0.2s ease';
    }
  }, []);

  // Memoize drag handlers
  const handleDragEnd = useCallback(
    async ({ active, over }: DragEndEvent) => {
      setActiveId(null);
      if (!over) return;

      const activeGroupId = active.data.current?.groupId;
      const overGroupId = over.data.current?.groupId;
      const activeTaskId = active.id;
      const overTaskId = over.id;

      const sourceGroup = taskGroups.find(g => g.id === activeGroupId);
      const targetGroup = taskGroups.find(g => g.id === overGroupId);

      if (!sourceGroup || !targetGroup) return;

      const fromIndex = sourceGroup.tasks.findIndex(t => t.id === activeTaskId);
      if (fromIndex === -1) return;

      const task = JSON.parse(JSON.stringify(sourceGroup.tasks[fromIndex]));

      if (activeGroupId !== overGroupId) {
        const canContinue = await checkTaskDependencyStatus(task.id, overGroupId);
        if (!canContinue) {
          alertService.error(
            'Task is not completed',
            'Please complete the task dependencies before proceeding'
          );
          resetTaskRowStyles();
          return;
        }

        switch (groupBy) {
          case IGroupBy.STATUS:
            task.status = overGroupId;
            task.status_color = targetGroup.color_code;
            task.status_color_dark = targetGroup.color_code_dark;
            break;
          case IGroupBy.PRIORITY:
            task.priority = overGroupId;
            task.priority_color = targetGroup.color_code;
            task.priority_color_dark = targetGroup.color_code_dark;
            break;
          case IGroupBy.PHASE:
            const baseColor = targetGroup.color_code.endsWith(ALPHA_CHANNEL)
              ? targetGroup.color_code.slice(0, -ALPHA_CHANNEL.length)
              : targetGroup.color_code;
            task.phase_id = overGroupId;
            task.phase_color = baseColor;
            break;
        }
      }

      const isTargetGroupEmpty = targetGroup.tasks.length === 0;
      const toIndex = isTargetGroupEmpty
        ? 0
        : overTaskId
          ? targetGroup.tasks.findIndex(t => t.id === overTaskId)
          : targetGroup.tasks.length;

      const toPos = isTargetGroupEmpty
        ? -1
        : targetGroup.tasks[toIndex]?.sort_order ||
          targetGroup.tasks[targetGroup.tasks.length - 1]?.sort_order ||
          -1;

      if (activeGroupId === overGroupId) {
        const updatedTasks = [...sourceGroup.tasks];
        updatedTasks.splice(fromIndex, 1);
        updatedTasks.splice(toIndex, 0, task);

        dispatch({
          type: 'taskReducer/reorderTasks',
          payload: {
            activeGroupId,
            overGroupId,
            fromIndex,
            toIndex,
            task,
            updatedSourceTasks: updatedTasks,
            updatedTargetTasks: updatedTasks,
          },
        });
      } else {
        const updatedSourceTasks = sourceGroup.tasks.filter((_, i) => i !== fromIndex);
        const updatedTargetTasks = [...targetGroup.tasks];

        if (isTargetGroupEmpty) {
          updatedTargetTasks.push(task);
        } else if (toIndex >= 0 && toIndex <= updatedTargetTasks.length) {
          updatedTargetTasks.splice(toIndex, 0, task);
        } else {
          updatedTargetTasks.push(task);
        }

        dispatch({
          type: 'taskReducer/reorderTasks',
          payload: {
            activeGroupId,
            overGroupId,
            fromIndex,
            toIndex,
            task,
            updatedSourceTasks,
            updatedTargetTasks,
          },
        });
      }

      // NEW SIMPLIFIED APPROACH: Calculate all affected task updates and send them
      const taskUpdates: Array<{
        task_id: string;
        sort_order: number;
        status_id?: string;
        priority_id?: string;
        phase_id?: string;
      }> = [];

      // Add updates for all tasks in affected groups
      if (activeGroupId === overGroupId) {
        // Same group - just reorder
        const updatedTasks = [...sourceGroup.tasks];
        updatedTasks.splice(fromIndex, 1);
        updatedTasks.splice(toIndex, 0, task);

        updatedTasks.forEach((task, index) => {
          taskUpdates.push({
            task_id: task.id,
            sort_order: index + 1, // 1-based indexing
          });
        });
      } else {
        // Different groups - update both source and target
        const updatedSourceTasks = sourceGroup.tasks.filter((_, i) => i !== fromIndex);
        const updatedTargetTasks = [...targetGroup.tasks];

        if (isTargetGroupEmpty) {
          updatedTargetTasks.push(task);
        } else if (toIndex >= 0 && toIndex <= updatedTargetTasks.length) {
          updatedTargetTasks.splice(toIndex, 0, task);
        } else {
          updatedTargetTasks.push(task);
        }

        // Add updates for source group
        updatedSourceTasks.forEach((task, index) => {
          taskUpdates.push({
            task_id: task.id,
            sort_order: index + 1,
          });
        });

        // Add updates for target group (including the moved task)
        updatedTargetTasks.forEach((task, index) => {
          const update: any = {
            task_id: task.id,
            sort_order: index + 1,
          };

          // Add group-specific updates
          if (groupBy === IGroupBy.STATUS) {
            update.status_id = targetGroup.id;
          } else if (groupBy === IGroupBy.PRIORITY) {
            update.priority_id = targetGroup.id;
          } else if (groupBy === IGroupBy.PHASE) {
            update.phase_id = targetGroup.id;
          }

          taskUpdates.push(update);
        });
      }

      socket?.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), {
        project_id: projectId,
        from_index: sourceGroup.tasks[fromIndex].sort_order,
        to_index: toPos,
        to_last_index: isTargetGroupEmpty,
        from_group: sourceGroup.id,
        to_group: targetGroup.id,
        group_by: groupBy,
        task: sourceGroup.tasks[fromIndex],
        team_id: currentSession?.team_id,
        task_updates: taskUpdates, // NEW: Send calculated updates
      });

      setTimeout(resetTaskRowStyles, 0);
      trackMixpanelEvent(evt_project_task_list_drag_and_move);
    },
    [
      taskGroups,
      groupBy,
      projectId,
      currentSession?.team_id,
      dispatch,
      socket,
      resetTaskRowStyles,
      trackMixpanelEvent,
    ]
  );

  // Memoize drag handlers
  const handleDragOver = useCallback(
    ({ active, over }: DragEndEvent) => {
      if (!over) return;

      const activeGroupId = active.data.current?.groupId;
      const overGroupId = over.data.current?.groupId;
      const activeTaskId = active.id;
      const overTaskId = over.id;

      const sourceGroup = taskGroups.find(g => g.id === activeGroupId);
      const targetGroup = taskGroups.find(g => g.id === overGroupId);

      if (!sourceGroup || !targetGroup) return;

      const fromIndex = sourceGroup.tasks.findIndex(t => t.id === activeTaskId);
      const toIndex = targetGroup.tasks.findIndex(t => t.id === overTaskId);

      if (fromIndex === -1 || toIndex === -1) return;

      const task = JSON.parse(JSON.stringify(sourceGroup.tasks[fromIndex]));

      if (activeGroupId === overGroupId) {
        const updatedTasks = [...sourceGroup.tasks];
        updatedTasks.splice(fromIndex, 1);
        updatedTasks.splice(toIndex, 0, task);

        dispatch({
          type: 'taskReducer/reorderTasks',
          payload: {
            activeGroupId,
            overGroupId,
            fromIndex,
            toIndex,
            task,
            updatedSourceTasks: updatedTasks,
            updatedTargetTasks: updatedTasks,
          },
        });
      } else {
        const updatedSourceTasks = sourceGroup.tasks.filter((_, i) => i !== fromIndex);
        const updatedTargetTasks = [...targetGroup.tasks];
        updatedTargetTasks.splice(toIndex, 0, task);

        dispatch({
          type: 'taskReducer/reorderTasks',
          payload: {
            activeGroupId,
            overGroupId,
            fromIndex,
            toIndex,
            task,
            updatedSourceTasks,
            updatedTargetTasks,
          },
        });
      }
    },
    [taskGroups, dispatch]
  );

  // Add CSS styles for drag and drop animations
  useIsomorphicLayoutEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      .task-row {
        opacity: 1 !important;
        position: relative !important;
        z-index: auto !important;
        transform: none !important;
        transition: transform 0.2s ease, opacity 0.2s ease !important;
        will-change: transform, opacity;
      }
      
      .task-row[data-is-dragging="true"] {
        z-index: 100 !important;
        transition: none !important;
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // Handle animation cleanup after drag ends
  useIsomorphicLayoutEffect(() => {
    if (activeId === null) {
      const timeoutId = setTimeout(resetTaskRowStyles, 50);
      return () => clearTimeout(timeoutId);
    }
  }, [activeId, resetTaskRowStyles]);

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
    >
      <Flex gap={24} vertical>
        {taskGroups?.map(taskGroup => (
          <TaskListTableWrapper
            key={taskGroup.id}
            taskList={taskGroup.tasks}
            tableId={taskGroup.id}
            name={taskGroup.name}
            groupBy={groupBy}
            statusCategory={taskGroup.category_id}
            color={themeMode === 'dark' ? taskGroup.color_code_dark : taskGroup.color_code}
            activeId={activeId}
          />
        ))}

        {createPortal(
          <TaskTemplateDrawer showDrawer={false} selectedTemplateId="" onClose={() => {}} />,
          document.body,
          'task-template-drawer'
        )}
      </Flex>
    </DndContext>
  );
};

export default TaskGroupWrapper;
