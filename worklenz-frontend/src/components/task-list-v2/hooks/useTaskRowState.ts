import { useState, useEffect, useMemo } from 'react';
import { Task } from '@/types/task-management.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { dayjs } from '@/shared/antd-imports';
import { getTaskDisplayName, formatDate } from '../components/TaskRowColumns';

export const useTaskRowState = (task: Task) => {
  // State for tracking which date picker is open
  const [activeDatePicker, setActiveDatePicker] = useState<string | null>(null);

  // State for editing task name
  const [editTaskName, setEditTaskName] = useState(false);
  const [taskName, setTaskName] = useState(task.title || task.name || '');

  // Update local taskName state when task name changes
  useEffect(() => {
    setTaskName(task.title || task.name || '');
  }, [task.title, task.name]);

  // Memoize task display name
  const taskDisplayName = useMemo(
    () => getTaskDisplayName(task),
    [task.title, task.name, task.task_key]
  );

  // Memoize converted task for AssigneeSelector to prevent recreation
  const convertedTask = useMemo(
    () => ({
      id: task.id,
      name: taskDisplayName,
      task_key: task.task_key || taskDisplayName,
      assignees:
        task.assignee_names?.map((assignee: InlineMember, index: number) => ({
          team_member_id: assignee.team_member_id || `assignee-${index}`,
          id: assignee.team_member_id || `assignee-${index}`,
          project_member_id: assignee.team_member_id || `assignee-${index}`,
          name: assignee.name || '',
        })) || [],
      parent_task_id: task.parent_task_id,
      status_id: undefined,
      project_id: undefined,
      manual_progress: undefined,
    }),
    [task.id, taskDisplayName, task.task_key, task.assignee_names, task.parent_task_id]
  );

  // Memoize formatted dates
  const formattedDates = useMemo(
    () => ({
      due: (() => {
        const dateValue = task.dueDate || task.due_date;
        return dateValue ? formatDate(dateValue) : null;
      })(),
      start: task.startDate ? formatDate(task.startDate) : null,
      completed: task.completedAt ? formatDate(task.completedAt) : null,
      created:
        task.createdAt || task.created_at ? formatDate(task.createdAt || task.created_at) : null,
      updated: task.updatedAt ? formatDate(task.updatedAt) : null,
    }),
    [
      task.dueDate,
      task.due_date,
      task.startDate,
      task.completedAt,
      task.createdAt,
      task.created_at,
      task.updatedAt,
    ]
  );

  // Debug log for completedAt
  if (task.id === 'a30278bb-26c5-43a5-b86d-68fe2b740689') {
    console.log(
      '[DEBUG useTaskRowState] formattedDates.completed:',
      formattedDates.completed,
      'task.completedAt:',
      task.completedAt
    );
  }

  // Memoize date values for DatePicker
  // Use startOf('day') to ensure we're working with the date only, no time component
  const dateValues = useMemo(
    () => ({
      start: task.startDate ? dayjs(task.startDate, 'YYYY-MM-DD').startOf('day') : undefined,
      due:
        task.dueDate || task.due_date
          ? dayjs(task.dueDate || task.due_date, 'YYYY-MM-DD').startOf('day')
          : undefined,
    }),
    [task.startDate, task.dueDate, task.due_date]
  );

  // Create labels adapter for LabelsSelector
  const labelsAdapter = useMemo(
    () => ({
      id: task.id,
      name: task.title || task.name,
      parent_task_id: task.parent_task_id,
      manual_progress: false,
      all_labels:
        task.all_labels?.map(label => ({
          id: label.id,
          name: label.name,
          color_code: label.color_code,
        })) || [],
      labels:
        task.labels?.map(label => ({
          id: label.id,
          name: label.name,
          color_code: label.color,
        })) || [],
    }),
    [
      task.id,
      task.title,
      task.name,
      task.parent_task_id,
      task.all_labels,
      task.labels,
      task.all_labels?.length,
      task.labels?.length,
    ]
  );

  return {
    // State
    activeDatePicker,
    setActiveDatePicker,
    editTaskName,
    setEditTaskName,
    taskName,
    setTaskName,

    // Computed values
    taskDisplayName,
    convertedTask,
    formattedDates,
    dateValues,
    labelsAdapter,
  };
};
