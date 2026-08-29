import { useState, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  moveTaskToGroupWithAPI,
  reorderTasksInGroup,
} from '@/features/task-management/task-management.slice';
import { selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { Task, TaskGroup } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useParams } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import logger from '@/utils/errorLogger';

export const useDragAndDrop = (allTasks: Task[], groups: TaskGroup[]) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { projectId } = useParams();
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const currentSession = useAuthService().getCurrentSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [overGroupId, setOverGroupId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  const getTaskGroup = useCallback(
    (taskId: string) => groups.find(group => group.taskIds.includes(taskId)),
    [groups]
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
      const taskUpdates: any[] = [];

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

      // Now assign sequential sort orders to ALL tasks across ALL groups
      let currentSortOrder = 0;
      updatedGroups.forEach(grp => {
        grp.taskIds.forEach(id => {
          taskUpdates.push({
            task_id: id,
            sort_order: currentSortOrder,
          });
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

        if (activeGroup.id === overGroup.id) {
          const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);
          const overIndex = overGroup.taskIds.indexOf(overTask.id);
          setDropPosition(activeIndex < overIndex ? 'after' : 'before');
        } else {
          setDropPosition('before');
        }
      } else {
        setOverId(null);
        setDropPosition(activeGroup.id === overGroup.id ? null : 'after');
      }
    },
    [allTasks, getOverGroup, getOverTask, getTaskGroup]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);
      setOverGroupId(null);
      setDropPosition(null);

      if (!over) {
        return;
      }

      const activeId = active.id;
      // Find the active task
      const activeTask = allTasks.find(task => task.id === activeId);
      if (!activeTask) {
        logger.error('Active task not found:', activeId);
        return;
      }

      // Find the active task's group
      const activeGroup = getTaskGroup(activeTask.id);
      if (!activeGroup) {
        logger.error('Could not find active group for task:', activeId);
        return;
      }

      const overTask = getOverTask(over);
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

      const insertIndex =
        overTask && overIndex !== -1
          ? overIndex
          : overGroup.taskIds.filter(taskId => taskId !== activeTask.id).length;

      if (!isSameGroup || activeIndex !== overIndex) {
        dispatch(
          reorderTasksInGroup({
            sourceTaskId: activeId as string,
            destinationTaskId: (overTask?.id || activeId) as string,
            sourceGroupId: activeGroup.id,
            destinationGroupId: overGroup.id,
          })
        );

        emitTaskSortChange(activeId as string, activeGroup, overGroup, insertIndex);
      }
    },
    [allTasks, dispatch, emitTaskSortChange, getOverGroup, getOverTask, getTaskGroup]
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
