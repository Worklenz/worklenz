import { useMemo, useCallback, useState } from 'react';
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
import { selectTaskGroups, selectGroupBy } from '@/features/tasks/tasks.selectors';
import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

interface UseTaskDragAndDropProps {
  taskGroups: ITaskListGroup[];
  groupBy: string;
}

export const useTaskDragAndDrop = (props?: UseTaskDragAndDropProps) => {
  const dispatch = useAppDispatch();
  
  // Use memoized selectors to avoid creating new objects
  const taskGroupsFromState = useAppSelector(selectTaskGroups);
  const groupByFromState = useAppSelector(selectGroupBy);
  
  // Use props if provided, otherwise use state
  const taskGroups = props?.taskGroups || taskGroupsFromState;
  const groupBy = props?.groupBy || groupByFromState;
  
  // Track active drag item
  const [activeId, setActiveId] = useState<string | null>(null);

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

  const resetTaskRowStyles = useCallback(() => {
    // Reset any drag-related styles
    const draggedElements = document.querySelectorAll('[data-is-dragging="true"]');
    draggedElements.forEach(element => {
      element.removeAttribute('data-is-dragging');
    });
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    // Add visual feedback for drag start
    const { active } = event;
    if (active) {
      setActiveId(active.id as string);
      document.body.style.cursor = 'grabbing';
      
      // Add dragging attribute to the element
      const draggedElement = document.querySelector(`[data-task-id="${active.id}"]`);
      if (draggedElement) {
        draggedElement.setAttribute('data-is-dragging', 'true');
      }
    }
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    // Handle drag over logic if needed
    // This can be used for visual feedback during drag
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      // Reset cursor and active state
      document.body.style.cursor = '';
      setActiveId(null);

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

  // Return the expected interface
  return {
    activeId,
    sensors,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    resetTaskRowStyles,
    // Legacy support - return the old interface as well
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragEnd: handleDragEnd,
  };
}; 