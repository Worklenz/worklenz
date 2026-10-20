import { useState, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  convertTaskToSubtask,
  fetchSubTasks,
  fetchTasksV3,
  moveTaskToGroupWithAPI,
  reorderSubtasks,
  reorderTasksInGroup,
} from '@/features/task-management/task-management.slice';
import { selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import {
  setTaskPhase,
  setTaskPriority,
  setTaskStatus,
} from '@/features/task-drawer/task-drawer.slice';
import { store } from '@/app/store';
import { Task, TaskGroup } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { UNMAPPED } from '@/shared/constants';
import { useParams } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { tasksApiService } from '@/api/tasks/tasks.api.service';
import logger from '@/utils/errorLogger';
import { message } from '@/shared/antd-imports';
import type { TFunction } from 'i18next';

interface TaskSortUpdate {
  task_id: string;
  sort_order: number;
  status_id?: string;
  priority_id?: string;
  phase_id?: string;
}

export type DropPosition = 'before' | 'after' | 'into' | null;

export const useDragAndDrop = (
  allTasks: Task[],
  groups: TaskGroup[],
  t?: TFunction
) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { projectId } = useParams();
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const currentSession = useAuthService().getCurrentSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<DropPosition>(null);

  const getTaskById = useCallback(
    (taskId: string | undefined | null) =>
      taskId ? allTasks.find(task => task.id === taskId) : undefined,
    [allTasks]
  );

  const getTaskGroup = useCallback(
    (taskId: string) => {
      const direct = groups.find(group => group.taskIds.includes(taskId));
      if (direct) return direct;

      // Subtasks are not in group.taskIds — resolve via ancestor parent chain
      let current = getTaskById(taskId);
      const visited = new Set<string>();
      while (current?.parent_task_id && !visited.has(current.id)) {
        visited.add(current.id);
        const parentGroup = groups.find(group => group.taskIds.includes(current!.parent_task_id!));
        if (parentGroup) return parentGroup;
        current = getTaskById(current.parent_task_id);
      }
      return null;
    },
    [getTaskById, groups]
  );

  const getOverGroup = useCallback(
    (over: DragEndEvent['over'] | DragOverEvent['over']) => {
      if (!over) return null;

      const overData = over.data.current as
        | { type?: string; groupId?: string; task?: Task }
        | undefined;

      if (overData?.groupId) {
        return groups.find(group => group.id === overData.groupId) || null;
      }

      if (overData?.type === 'group') {
        return groups.find(group => group.id === over.id) || null;
      }

      const overTask = allTasks.find(task => task.id === over.id);
      return overTask ? getTaskGroup(overTask.id) || null : null;
    },
    [allTasks, getTaskGroup, groups]
  );

  const getOverTask = useCallback(
    (over: DragEndEvent['over'] | DragOverEvent['over']) => {
      if (!over) return null;

      const overData = over.data.current as { type?: string; task?: Task } | undefined;
      if (overData?.type === 'task' && overData.task) {
        return overData.task;
      }

      return allTasks.find(task => task.id === over.id) || null;
    },
    [allTasks]
  );

  const isDescendantOf = useCallback(
    (candidateId: string, ancestorId: string) => {
      let current = getTaskById(candidateId);
      const visited = new Set<string>();
      while (current?.parent_task_id && !visited.has(current.id)) {
        if (current.parent_task_id === ancestorId) return true;
        visited.add(current.id);
        current = getTaskById(current.parent_task_id);
      }
      return false;
    },
    [getTaskById]
  );

  /** Resolve the parent task id to move a subtask under when dropping on `overTask`. */
  const resolveMoveTargetParentId = useCallback(
    (activeTask: Task, overTask: Task): string | null => {
      if (activeTask.id === overTask.id) return null;

      // Dropping onto a top-level task → that task becomes the new parent
      if (!overTask.parent_task_id) {
        if (overTask.id === activeTask.parent_task_id) return null; // already under it
        if (isDescendantOf(overTask.id, activeTask.id)) return null; // cycle
        return overTask.id;
      }

      // Dropping onto a subtask of a different parent → move under that subtask's parent
      if (overTask.parent_task_id !== activeTask.parent_task_id) {
        if (isDescendantOf(overTask.parent_task_id, activeTask.id)) return null;
        return overTask.parent_task_id;
      }

      // Same parent — reorder, not move
      return null;
    },
    [isDescendantOf]
  );

  const emitSubtaskReorder = useCallback(
    (parentTaskId: string, orderedSubtasks: Task[]) => {
      dispatch(reorderSubtasks({ parentTaskId, orderedSubtasks }));

      if (!socket || !connected) return;

      socket.emit(SocketEvents.SUBTASK_SORT_ORDER_CHANGE.toString(), {
        parent_task_id: parentTaskId,
        subtask_updates: orderedSubtasks.map((subtask, index) => ({
          task_id: subtask.id,
          sort_order: index,
        })),
      });
    },
    [connected, dispatch, socket]
  );

  const moveSubtaskToParent = useCallback(
    async (subtaskId: string, newParentId: string) => {
      if (!projectId) return;

      dispatch(convertTaskToSubtask({ taskId: subtaskId, parentTaskId: newParentId }));
      // Ensure the destination parent's full subtask list is loaded/visible
      dispatch(fetchSubTasks({ taskId: newParentId, projectId }));

      try {
        const res = await tasksApiService.moveSubtask(subtaskId, projectId, newParentId);
        if (!res.done) {
          dispatch(fetchTasksV3(projectId));
          message.error(
            res.message ||
              t?.('contextMenu.moveSubtaskFailed', { defaultValue: 'Failed to move subtask' }) ||
              'Failed to move subtask'
          );
          return;
        }
        message.success(
          t?.('contextMenu.moveSubtaskSuccess', { defaultValue: 'Subtask moved successfully' }) ||
            'Subtask moved successfully'
        );
      } catch (error) {
        logger.error('Error moving subtask via drag and drop:', error);
        dispatch(fetchTasksV3(projectId));
        message.error(
          t?.('contextMenu.moveSubtaskFailed', { defaultValue: 'Failed to move subtask' }) ||
            'Failed to move subtask'
        );
      }
    },
    [dispatch, projectId, t]
  );

  // Keep Task Drawer Phase/Status/Priority fields in sync when the open task is dragged
  const syncOpenTaskDrawerGrouping = useCallback(
    (taskId: string, targetGroupId: string) => {
      const state = store.getState();
      if (state.taskDrawerReducer.selectedTaskId !== taskId) return;

      if (currentGrouping === 'phase') {
        dispatch(
          setTaskPhase({
            phase_id: targetGroupId === UNMAPPED ? null : targetGroupId,
            id: taskId,
          })
        );
        return;
      }

      if (currentGrouping === 'status') {
        const status = state.taskStatusReducer?.status?.find(s => s.id === targetGroupId);
        dispatch(
          setTaskStatus({
            id: taskId,
            status_id: targetGroupId,
            parent_task: '',
            color_code: status?.color_code || '',
            color_code_dark: status?.color_code_dark || '',
            complete_ratio: 0,
          })
        );
        return;
      }

      if (currentGrouping === 'priority') {
        const priority = state.priorityReducer?.priorities?.find(p => p.id === targetGroupId);
        dispatch(
          setTaskPriority({
            id: taskId,
            priority_id: targetGroupId,
            color_code: priority?.color_code || '',
            color_code_dark: priority?.color_code_dark || '',
          })
        );
      }
    },
    [currentGrouping, dispatch]
  );

  // Helper function to emit socket event for persistence
  const emitTaskSortChange = useCallback(
    (taskId: string, sourceGroup: TaskGroup, targetGroup: TaskGroup, insertIndex: number) => {
      if (!projectId) return;

      const task = allTasks.find(t => t.id === taskId);
      if (!task) {
        logger.error('Task not found for socket emission:', taskId);
        return;
      }

      // Get team_id from current session
      const teamId = currentSession?.team_id || '';

      // Use new bulk update approach - recalculate ALL task orders to prevent duplicates
      const taskUpdates: TaskSortUpdate[] = [];

      // Create a copy of all groups
      const updatedGroups = groups.map(g => ({
        ...g,
        taskIds: [...g.taskIds],
      }));

      const sourceGroupCopy = updatedGroups.find(g => g.id === sourceGroup.id);
      const targetGroupCopy = updatedGroups.find(g => g.id === targetGroup.id);

      if (!sourceGroupCopy || !targetGroupCopy) return;

      sourceGroupCopy.taskIds = sourceGroupCopy.taskIds.filter(id => id !== taskId);
      targetGroupCopy.taskIds = targetGroupCopy.taskIds.filter(id => id !== taskId);
      targetGroupCopy.taskIds.splice(insertIndex, 0, taskId);

      // Now assign sequential sort orders to ALL tasks across ALL groups.
      // Include the active grouping field so cross-group drops persist status/priority/phase
      // (same pattern as EnhancedKanbanBoardNativeDnD.getAllTaskUpdates).
      let currentSortOrder = 0;
      updatedGroups.forEach(grp => {
        grp.taskIds.forEach(id => {
          const update: TaskSortUpdate = {
            task_id: id,
            sort_order: currentSortOrder,
          };

          if (currentGrouping === 'status') {
            update.status_id = grp.id;
          } else if (currentGrouping === 'priority') {
            update.priority_id = grp.id;
          } else if (currentGrouping === 'phase' && grp.id !== UNMAPPED) {
            update.phase_id = grp.id;
          }

          taskUpdates.push(update);
          currentSortOrder++;
        });
      });

      const socketData = {
        project_id: projectId,
        group_by: currentGrouping || 'status',
        task_updates: taskUpdates,
        from_group: sourceGroup.id,
        to_group: targetGroup.id,
        task: {
          id: task.id,
          project_id: projectId,
          status: task.status || '',
          priority: task.priority || '',
        },
        team_id: teamId,
      };

      if (socket && connected) {
        socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), socketData);

        // Bulk sort updates cannot clear phase_id; emit an explicit phase clear for Unmapped.
        if (
          currentGrouping === 'phase' &&
          sourceGroup.id !== targetGroup.id &&
          targetGroup.id === UNMAPPED
        ) {
          socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
            task_id: taskId,
            phase_id: null,
            parent_task: task.parent_task_id || null,
          });
        }
        return;
      }

      if (
        sourceGroup.id !== targetGroup.id &&
        currentGrouping &&
        ['status', 'priority', 'phase'].includes(currentGrouping)
      ) {
        dispatch(
          moveTaskToGroupWithAPI({
            taskId,
            groupType: currentGrouping as 'status' | 'priority' | 'phase',
            groupValue: targetGroup.id,
            projectId,
          })
        );
      } else {
        logger.warning('Socket not connected or missing project ID');
      }
    },
    [socket, connected, projectId, allTasks, groups, currentGrouping, currentSession, dispatch]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) {
        setOverId(null);
        setOverGroupId(null);
        setDropPosition(null);
        return;
      }

      const activeTask = allTasks.find(task => task.id === active.id);
      const overTask = getOverTask(over);

      if (!activeTask) {
        setOverId(null);
        setOverGroupId(null);
        setDropPosition(null);
        return;
      }

      const activeGroup = getTaskGroup(activeTask.id);
      const overGroup = getOverGroup(over);

      if (!activeGroup || !overGroup) {
        setOverId(null);
        setOverGroupId(null);
        setDropPosition(null);
        return;
      }

      setOverGroupId(overGroup.id);

      if (overTask) {
        setOverId(overTask.id);

        // Subtask over a different parent (or top-level task) → nest/move indicator
        if (activeTask.parent_task_id) {
          const moveTarget = resolveMoveTargetParentId(activeTask, overTask);
          if (moveTarget) {
            setDropPosition('into');
            return;
          }
        }

        if (activeGroup.id === overGroup.id) {
          const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);
          const overIndex = overGroup.taskIds.indexOf(overTask.id);
          // Subtask↔sibling reorder doesn't use group indexes
          if (activeTask.parent_task_id && overTask.parent_task_id === activeTask.parent_task_id) {
            setDropPosition('before');
            return;
          }
          setDropPosition(activeIndex < overIndex ? 'after' : 'before');
        } else {
          setDropPosition('before');
        }
      } else {
        setOverId(null);
        setDropPosition(activeGroup.id === overGroup.id ? null : 'after');
      }
    },
    [allTasks, getOverGroup, getOverTask, getTaskGroup, resolveMoveTargetParentId]
  );

  const handleSubtaskDragEnd = useCallback(
    (activeTask: Task, overTask: Task) => {
      const moveTargetParentId = resolveMoveTargetParentId(activeTask, overTask);

      if (moveTargetParentId) {
        void moveSubtaskToParent(activeTask.id, moveTargetParentId);
        return;
      }

      // Same-parent sibling reorder
      if (
        !activeTask.parent_task_id ||
        overTask.parent_task_id !== activeTask.parent_task_id ||
        activeTask.id === overTask.id
      ) {
        return;
      }

      const parent = getTaskById(activeTask.parent_task_id);
      const siblings = parent?.sub_tasks ? [...parent.sub_tasks] : [];
      const oldIndex = siblings.findIndex(s => s.id === activeTask.id);
      const newIndex = siblings.findIndex(s => s.id === overTask.id);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      emitSubtaskReorder(activeTask.parent_task_id, arrayMove(siblings, oldIndex, newIndex));
    },
    [emitSubtaskReorder, getTaskById, moveSubtaskToParent, resolveMoveTargetParentId]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);
      setOverGroupId(null);
      setDropPosition(null);

      if (!over || currentGrouping === 'assignee') {
        return;
      }

      const draggedId = active.id;
      const activeTask = allTasks.find(task => task.id === draggedId);
      if (!activeTask) {
        logger.error('Active task not found:', draggedId);
        return;
      }

      const overTask = getOverTask(over);

      // Subtasks: reorder within parent or move to a new parent
      if (activeTask.parent_task_id) {
        if (!overTask) return;
        handleSubtaskDragEnd(activeTask, overTask);
        return;
      }

      // Top-level tasks: existing group reorder / cross-group move
      const activeGroup = getTaskGroup(activeTask.id);
      if (!activeGroup) {
        logger.error('Could not find active group for task:', draggedId);
        return;
      }

      const overGroup = getOverGroup(over);

      if (!overGroup) {
        return;
      }

      const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);
      const overIndex = overTask
        ? overGroup.taskIds.indexOf(overTask.id)
        : overGroup.taskIds.length;
      const isSameGroup = activeGroup.id === overGroup.id;

      if (isSameGroup && !overTask) {
        return;
      }

      // Don't reorder top-level tasks against a subtask target — resolve to parent row
      const effectiveOverTask =
        overTask?.parent_task_id ? getTaskById(overTask.parent_task_id) || overTask : overTask;
      const effectiveOverIndex = effectiveOverTask
        ? overGroup.taskIds.indexOf(effectiveOverTask.id)
        : overIndex;

      const insertIndex =
        effectiveOverTask && effectiveOverIndex !== -1
          ? effectiveOverIndex
          : overGroup.taskIds.filter(taskId => taskId !== activeTask.id).length;

      if (!isSameGroup || activeIndex !== effectiveOverIndex) {
        dispatch(
          reorderTasksInGroup({
            sourceTaskId: draggedId as string,
            destinationTaskId: (effectiveOverTask?.id || draggedId) as string,
            sourceGroupId: activeGroup.id,
            destinationGroupId: overGroup.id,
          })
        );

        if (!isSameGroup) {
          syncOpenTaskDrawerGrouping(draggedId as string, overGroup.id);
        }

        emitTaskSortChange(draggedId as string, activeGroup, overGroup, insertIndex);
      }
    },
    [
      allTasks,
      currentGrouping,
      dispatch,
      emitTaskSortChange,
      getOverGroup,
      getOverTask,
      getTaskById,
      getTaskGroup,
      handleSubtaskDragEnd,
      syncOpenTaskDrawerGrouping,
    ]
  );

  return {
    activeId,
    overId,
    overGroupId,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
