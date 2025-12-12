import { ITaskListGroup } from '@/types/tasks/taskList.types';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';

/**
 * Extract all task IDs from task groups (for task list and kanban views)
 * @param groups - Array of task groups
 * @param includeSubtasks - Whether to include subtasks in the navigation
 * @returns Array of task IDs in order
 */
export const getTaskIdsFromGroups = (
  groups: ITaskListGroup[],
  includeSubtasks: boolean = false
): string[] => {
  const taskIds: string[] = [];

  groups.forEach(group => {
    group.tasks.forEach(task => {
      if (task.id) {
        taskIds.push(task.id);
      }

      // Include subtasks if requested and they are visible
      if (includeSubtasks && task.sub_tasks && task.show_sub_tasks) {
        task.sub_tasks.forEach(subtask => {
          if (subtask.id) {
            taskIds.push(subtask.id);
          }
        });
      }
    });
  });

  return taskIds;
};

/**
 * Extract all task IDs from a flat task array
 * @param tasks - Array of tasks
 * @param includeSubtasks - Whether to include subtasks in the navigation
 * @returns Array of task IDs in order
 */
export const getTaskIdsFromArray = (
  tasks: IProjectTask[],
  includeSubtasks: boolean = false
): string[] => {
  const taskIds: string[] = [];

  tasks.forEach(task => {
    if (task.id) {
      taskIds.push(task.id);
    }

    // Include subtasks if requested
    if (includeSubtasks && task.sub_tasks) {
      task.sub_tasks.forEach(subtask => {
        if (subtask.id) {
          taskIds.push(subtask.id);
        }
      });
    }
  });

  return taskIds;
};

/**
 * Find the index of a task ID in an array
 * @param taskIds - Array of task IDs
 * @param targetTaskId - The task ID to find
 * @returns Index of the task, or -1 if not found
 */
export const findTaskIndex = (taskIds: string[], targetTaskId: string): number => {
  return taskIds.indexOf(targetTaskId);
};
