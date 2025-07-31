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
import logger from '@/utils/errorLogger';

export const useDragAndDrop = (allTasks: Task[], groups: TaskGroup[]) => {
  const dispatch = useAppDispatch();
  const { socket, connected } = useSocket();
  const { projectId } = useParams();
  const currentGrouping = useAppSelector(selectCurrentGrouping);
  const currentSession = useAuthService().getCurrentSession();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);

  // Helper function to emit socket event for persistence (within-group only)
  const emitTaskSortChange = useCallback(
    (taskId: string, group: TaskGroup, insertIndex: number) => {
      if (!socket || !connected || !projectId) {
        logger.warning('Socket not connected or missing project ID');
        return;
      }

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
        taskIds: [...g.taskIds]
      }));
      
      // Find the group in our copy
      const groupCopy = updatedGroups.find(g => g.id === group.id)!;
      
      // Reorder within the group
      const sourceIndex = groupCopy.taskIds.indexOf(taskId);
      // Remove task from old position
      groupCopy.taskIds.splice(sourceIndex, 1);
      // Insert at new position
      groupCopy.taskIds.splice(insertIndex, 0, taskId);
      
      // Now assign sequential sort orders to ALL tasks across ALL groups
      let currentSortOrder = 0;
      updatedGroups.forEach(grp => {
        grp.taskIds.forEach(id => {
          taskUpdates.push({
            task_id: id,
            sort_order: currentSortOrder
          });
          currentSortOrder++;
        });
      });

      const socketData = {
        project_id: projectId,
        group_by: currentGrouping || 'status',
        task_updates: taskUpdates,
        from_group: group.id,
        to_group: group.id,
        task: {
          id: task.id,
          project_id: projectId,
          status: task.status || '',
          priority: task.priority || '',
        },
        team_id: teamId,
      };

      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), socketData);
    },
    [socket, connected, projectId, allTasks, groups, currentGrouping, currentSession]
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragOver = useCallback(
    (event: DragOverEvent) => {
      const { active, over } = event;

      if (!over) {
        setOverId(null);
        setDropPosition(null);
        return;
      }

      const activeTask = allTasks.find(task => task.id === active.id);
      const overTask = allTasks.find(task => task.id === over.id);
      
      if (activeTask && overTask) {
        const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
        const overGroup = groups.find(group => group.taskIds.includes(overTask.id));
        
        // Only set overId if both tasks are in the same group
        if (activeGroup && overGroup && activeGroup.id === overGroup.id) {
          setOverId(over.id as string);
          
          // Calculate drop position based on task indices
          const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);
          const overIndex = activeGroup.taskIds.indexOf(overTask.id);
          
          if (activeIndex < overIndex) {
            setDropPosition('after');
          } else {
            setDropPosition('before');
          }
        } else {
          setOverId(null);
          setDropPosition(null);
        }
      } else {
        setOverId(null);
        setDropPosition(null);
      }
    },
    [allTasks, groups]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);
      setDropPosition(null);

      if (!over || active.id === over.id) {
        return;
      }

      const activeId = active.id;
      const overId = over.id;

      // Find the active task
      const activeTask = allTasks.find(task => task.id === activeId);
      if (!activeTask) {
        logger.error('Active task not found:', activeId);
        return;
      }

      // Find the active task's group
      const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
      if (!activeGroup) {
        logger.error('Could not find active group for task:', activeId);
        return;
      }

      // Only allow dropping on tasks in the same group
      const overTask = allTasks.find(task => task.id === overId);
      if (!overTask) {
        return;
      }

      const overGroup = groups.find(group => group.taskIds.includes(overTask.id));
      if (!overGroup || overGroup.id !== activeGroup.id) {
        return;
      }

      const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);
      const overIndex = activeGroup.taskIds.indexOf(overTask.id);

      if (activeIndex !== overIndex) {
        // Reorder task within same group
        dispatch(
          reorderTasksInGroup({
            sourceTaskId: activeId as string,
            destinationTaskId: overId as string,
            sourceGroupId: activeGroup.id,
            destinationGroupId: activeGroup.id,
          })
        );

        // Calculate the final index after reordering for socket emission
        let finalIndex = overIndex;
        if (activeIndex < overIndex) {
          // When dragging down, the task ends up just after the destination
          finalIndex = overIndex;
        } else {
          // When dragging up, the task ends up at the destination position
          finalIndex = overIndex;
        }

        // Emit socket event for persistence
        emitTaskSortChange(activeId as string, activeGroup, finalIndex);
      }
    },
    [allTasks, groups, dispatch, emitTaskSortChange]
  );

  return {
    activeId,
    overId,
    dropPosition,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
};
