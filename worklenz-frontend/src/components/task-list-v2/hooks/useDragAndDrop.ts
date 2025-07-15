import { useState, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { reorderTasksInGroup } from '@/features/task-management/task-management.slice';
import { selectCurrentGrouping } from '@/features/task-management/grouping.slice';
import { Task, TaskGroup, getSortOrderField } from '@/types/task-management.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useParams } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';

export const useDragAndDrop = (allTasks: Task[], groups: TaskGroup[]) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { projectId } = useParams();
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const currentSession = useAuthService().getCurrentSession();
  const [activeId, setActiveId] = useState<string | null>(null);

  // Helper function to emit socket event for persistence
  const emitTaskSortChange = useCallback(
    (taskId: string, sourceGroup: TaskGroup, targetGroup: TaskGroup, insertIndex: number) => {
      if (!socket || !connected || !projectId) {
        console.warn('Socket not connected or missing project ID');
        return;
      }

      const task = allTasks.find(t => t.id === taskId);
      if (!task) {
        console.error('Task not found for socket emission:', taskId);
        return;
      }

      // Get team_id from current session
      const teamId = currentSession?.team_id || '';

      // Calculate sort orders for socket emission using the appropriate sort field
      const sortField = getSortOrderField(currentGrouping);
      const fromIndex = (task as any)[sortField] || task.order || 0;
      let toIndex = 0;
      let toLastIndex = false;

      if (targetGroup.taskIds.length === 0) {
        toIndex = 0;
        toLastIndex = true;
      } else if (insertIndex >= targetGroup.taskIds.length) {
        // Dropping at the end
        const lastTask = allTasks.find(t => t.id === targetGroup.taskIds[targetGroup.taskIds.length - 1]);
        toIndex = ((lastTask as any)?.[sortField] || lastTask?.order || 0) + 1;
        toLastIndex = true;
      } else {
        // Dropping at specific position
        const targetTask = allTasks.find(t => t.id === targetGroup.taskIds[insertIndex]);
        toIndex = (targetTask as any)?.[sortField] || targetTask?.order || insertIndex;
        toLastIndex = false;
      }

      const socketData = {
        project_id: projectId,
        from_index: fromIndex,
        to_index: toIndex,
        to_last_index: toLastIndex,
        from_group: sourceGroup.id,
        to_group: targetGroup.id,
        group_by: currentGrouping || 'status',
        task: {
          id: task.id,
          project_id: projectId,
          status: task.status || '',
          priority: task.priority || '',
        },
        team_id: teamId,
      };

      console.log('Emitting TASK_SORT_ORDER_CHANGE:', socketData);
      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), socketData);
    },
    [socket, connected, projectId, allTasks, currentGrouping, currentSession]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
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
    },
    [allTasks, groups]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
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

        // reorderTasksInGroup handles both same-group and cross-group moves
        // No need for separate moveTaskBetweenGroups call
        dispatch(
          reorderTasksInGroup({
            sourceTaskId: activeId as string,
            destinationTaskId: over.id as string,
            sourceGroupId: activeGroup.id,
            destinationGroupId: targetGroup.id,
          })
        );

        // Emit socket event for persistence
        emitTaskSortChange(activeId as string, activeGroup, targetGroup, insertIndex);
      } else {
        // Reordering within the same group
        console.log('Reordering task within same group:', {
          task: activeTask.name || activeTask.title,
          group: activeGroup.title,
          from: activeIndex,
          to: insertIndex,
        });

        if (activeIndex !== insertIndex) {
          // Reorder task within same group at drop position
          dispatch(
            reorderTasksInGroup({
              sourceTaskId: activeId as string,
              destinationTaskId: over.id as string,
              sourceGroupId: activeGroup.id,
              destinationGroupId: activeGroup.id,
            })
          );

          // Emit socket event for persistence
          emitTaskSortChange(activeId as string, activeGroup, targetGroup, insertIndex);
        }
      }
    },
    [allTasks, groups, dispatch, emitTaskSortChange]
  );

  return {
    activeId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}; 