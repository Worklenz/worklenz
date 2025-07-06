import { useState, useCallback } from 'react';
import { DragEndEvent, DragOverEvent, DragStartEvent } from '@dnd-kit/core';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { reorderTasksInGroup, moveTaskBetweenGroups } from '@/features/task-management/task-management.slice';
import { Task, TaskGroup } from '@/types/task-management.types';

export const useDragAndDrop = (allTasks: Task[], groups: TaskGroup[]) => {
  const dispatch = useAppDispatch();
  const [activeId, setActiveId] = useState<string | null>(null);

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

        // Move task to the target group
        dispatch(
          moveTaskBetweenGroups({
            taskId: activeId as string,
            sourceGroupId: activeGroup.id,
            targetGroupId: targetGroup.id,
          })
        );

        // Reorder task within target group at drop position
        dispatch(
          reorderTasksInGroup({
            sourceTaskId: activeId as string,
            destinationTaskId: over.id as string,
            sourceGroupId: activeGroup.id,
            destinationGroupId: targetGroup.id,
          })
        );
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
        }
      }
    },
    [allTasks, groups, dispatch]
  );

  return {
    activeId,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
  };
}; 