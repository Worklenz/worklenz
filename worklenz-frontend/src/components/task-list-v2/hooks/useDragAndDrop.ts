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

  // Helper function to emit socket event for persistence
  const emitTaskSortChange = useCallback(
    (taskId: string, sourceGroup: TaskGroup, targetGroup: TaskGroup, insertIndex: number) => {
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
      
      // Create a copy of all groups and perform the move operation
      const updatedGroups = groups.map(group => ({
        ...group,
        taskIds: [...group.taskIds]
      }));
      
      // Find the source and target groups in our copy
      const sourceGroupCopy = updatedGroups.find(g => g.id === sourceGroup.id)!;
      const targetGroupCopy = updatedGroups.find(g => g.id === targetGroup.id)!;
      
      if (sourceGroup.id === targetGroup.id) {
        // Same group - reorder within the group
        const sourceIndex = sourceGroupCopy.taskIds.indexOf(taskId);
        // Remove task from old position
        sourceGroupCopy.taskIds.splice(sourceIndex, 1);
        // Insert at new position
        sourceGroupCopy.taskIds.splice(insertIndex, 0, taskId);
      } else {
        // Different groups - move task between groups
        // Remove from source group
        const sourceIndex = sourceGroupCopy.taskIds.indexOf(taskId);
        sourceGroupCopy.taskIds.splice(sourceIndex, 1);
        
        // Add to target group
        targetGroupCopy.taskIds.splice(insertIndex, 0, taskId);
      }
      
      // Now assign sequential sort orders to ALL tasks across ALL groups
      let currentSortOrder = 0;
      updatedGroups.forEach(group => {
        group.taskIds.forEach(id => {
          const update: any = {
            task_id: id,
            sort_order: currentSortOrder
          };
          
          // Add group-specific fields for the moved task if it changed groups
          if (id === taskId && sourceGroup.id !== targetGroup.id) {
            if (currentGrouping === 'status') {
              update.status_id = targetGroup.id;
            } else if (currentGrouping === 'priority') {
              update.priority_id = targetGroup.id;
            } else if (currentGrouping === 'phase') {
              update.phase_id = targetGroup.id;
            }
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

      socket.emit(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), socketData);

      // Also emit the specific grouping field change event for the moved task
      if (sourceGroup.id !== targetGroup.id) {
        if (currentGrouping === 'phase') {
          // Emit phase change event
          socket.emit(SocketEvents.TASK_PHASE_CHANGE.toString(), {
            task_id: taskId,
            phase_id: targetGroup.id,
            parent_task: task.parent_task_id || null,
          });
        } else if (currentGrouping === 'priority') {
          // Emit priority change event
          socket.emit(SocketEvents.TASK_PRIORITY_CHANGE.toString(), JSON.stringify({
            task_id: taskId,
            priority_id: targetGroup.id,
            team_id: teamId,
          }));
        } else if (currentGrouping === 'status') {
          // Emit status change event
          socket.emit(SocketEvents.TASK_STATUS_CHANGE.toString(), JSON.stringify({
            task_id: taskId,
            status_id: targetGroup.id,
            team_id: teamId,
          }));
        }
      }
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
        return;
      }

      const activeId = active.id;
      const overId = over.id;

      // Set the overId for drop indicators
      setOverId(overId as string);

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
    },
    [allTasks, groups]
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setOverId(null);

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

      // Find the groups
      const activeGroup = groups.find(group => group.taskIds.includes(activeTask.id));
      if (!activeGroup) {
        logger.error('Could not find active group for task:', activeId);
        return;
      }

      // Check if we're dropping on a task, group, or empty group
      const overTask = allTasks.find(task => task.id === overId);
      const overGroup = groups.find(group => group.id === overId);
      
      // Check if dropping on empty group drop zone
      const isEmptyGroupDrop = typeof overId === 'string' && overId.startsWith('empty-group-');
      const emptyGroupId = isEmptyGroupDrop ? overId.replace('empty-group-', '') : null;
      const emptyGroup = emptyGroupId ? groups.find(group => group.id === emptyGroupId) : null;

      let targetGroup = overGroup || emptyGroup;
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
      } else if (emptyGroup) {
        // Dropping on an empty group
        targetGroup = emptyGroup;
        insertIndex = 0; // First position in empty group
      }

      if (!targetGroup) {
        logger.error('Could not find target group');
        return;
      }

      const isCrossGroup = activeGroup.id !== targetGroup.id;
      const activeIndex = activeGroup.taskIds.indexOf(activeTask.id);

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
    overId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}; 