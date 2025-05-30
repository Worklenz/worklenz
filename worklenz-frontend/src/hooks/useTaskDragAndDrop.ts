import { useMemo, useCallback } from 'react';
import {
  DndContext,
  DragEndEvent,
  DragOverEvent,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  KeyboardSensor,
  TouchSensor,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { updateTaskStatus } from '@/features/tasks/tasks.slice';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

export const useTaskDragAndDrop = () => {
  const dispatch = useAppDispatch();
  const taskGroups = useAppSelector(state => state.taskReducer.taskGroups);
  const groupBy = useAppSelector(state => state.taskReducer.groupBy);

  // Memoize sensors configuration for better performance
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250,
        tolerance: 5,
      },
    })
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Add visual feedback for drag start
    const { active } = event;
    if (active) {
      document.body.style.cursor = 'grabbing';
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle drag over logic if needed
    // This can be used for visual feedback during drag
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Reset cursor
      document.body.style.cursor = '';

      const { active, over } = event;
      
      if (!active || !over || !taskGroups) {
        return;
      }

      try {
        const activeId = active.id as string;
        const overId = over.id as string;

        // Find the task being dragged
        let draggedTask: IProjectTask | null = null;
        let sourceGroupId: string | null = null;

        for (const group of taskGroups) {
          const task = group.tasks?.find((t: IProjectTask) => t.id === activeId);
          if (task) {
            draggedTask = task;
            sourceGroupId = group.id;
            break;
          }
        }

        if (!draggedTask || !sourceGroupId) {
          console.warn('Could not find dragged task');
          return;
        }

        // Determine target group
        let targetGroupId: string | null = null;

        // Check if dropped on a group container
        const targetGroup = taskGroups.find((group: ITaskListGroup) => group.id === overId);
        if (targetGroup) {
          targetGroupId = targetGroup.id;
        } else {
          // Check if dropped on another task
          for (const group of taskGroups) {
            const targetTask = group.tasks?.find((t: IProjectTask) => t.id === overId);
            if (targetTask) {
              targetGroupId = group.id;
              break;
            }
          }
        }

        if (!targetGroupId || targetGroupId === sourceGroupId) {
          return; // No change needed
        }

        // Update task status based on group change
        const targetGroupData = taskGroups.find((group: ITaskListGroup) => group.id === targetGroupId);
        if (targetGroupData && groupBy === 'status') {
          const updatePayload: any = {
            task_id: draggedTask.id,
            status_id: targetGroupData.id,
          };
          
          if (draggedTask.parent_task_id) {
            updatePayload.parent_task = draggedTask.parent_task_id;
          }
          
          dispatch(updateTaskStatus(updatePayload));
        }
      } catch (error) {
        console.error('Error handling drag end:', error);
      }
    },
    [taskGroups, groupBy, dispatch]
  );

  // Memoize the drag and drop configuration
  const dragAndDropConfig = useMemo(
    () => ({
      sensors,
      onDragStart: handleDragStart,
      onDragOver: handleDragOver,
      onDragEnd: handleDragEnd,
    }),
    [sensors, handleDragStart, handleDragOver, handleDragEnd]
  );

  return dragAndDropConfig;
}; 