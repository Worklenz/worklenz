import { useMemo } from 'react';
import { Task } from '@/types/task-management.types';
import { AddTaskRowItem } from '../constants/columns';

export type VirtuosoItem = (Task & { originalIndex: number }) | AddTaskRowItem;

/**
 * Assignee grouping can repeat an issue across groups; sortable ids must stay unique.
 * Also include expanded subtasks so they can be dragged to a new parent in the outer DndContext.
 */
export const useSortableTaskIds = (
  allTasks: Task[],
  virtuosoItems: VirtuosoItem[]
): string[] => {
  return useMemo(() => {
    const taskById = new Map(allTasks.map(task => [task.id, task]));

    const collectExpandedSubtaskIds = (taskId: string, acc: string[]) => {
      const task = taskById.get(taskId);
      if (!task?.show_sub_tasks || !task.sub_tasks?.length) return;
      for (const subtask of task.sub_tasks) {
        if (!subtask.id) continue;
        acc.push(subtask.id);
        collectExpandedSubtaskIds(subtask.id, acc);
      }
    };

    const ids: string[] = [];
    for (const item of virtuosoItems) {
      if ('isAddTaskRow' in item || !item.id) continue;
      if (!item.parent_task_id) {
        ids.push(item.id);
        collectExpandedSubtaskIds(item.id, ids);
      }
    }
    return Array.from(new Set(ids));
  }, [allTasks, virtuosoItems]);
};
