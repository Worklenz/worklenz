import { useState, useEffect, useMemo, useRef } from 'react';
import { Task } from '@/types/task-management.types';
import { InlineMember } from '@/types/teamMembers/inlineMember.types';
import { dayjs } from '@/shared/antd-imports';
import { getTaskDisplayName, formatDate } from '../components/TaskRowColumns';
import { decodeHtmlEntities } from '@/utils/html-entities';

export const useTaskRowState = (task: Task) => {
  // State for tracking which date picker is open
  const [activeDatePicker, setActiveDatePicker] = useState<string | null>(null);

  // State for editing task name
  const [editTaskName, setEditTaskName] = useState(false);
  const decodedTaskName = decodeHtmlEntities(task.title || task.name);
  const [taskName, setTaskName] = useState(decodedTaskName);

  // Captures the name at the moment the user starts editing so handleTaskNameSave
  // can compare against the true pre-edit value. We cannot use task.title for this
  // because handleTaskNameChangeLive updates task.title in Redux in real time —
  // making the comparison always equal and preventing the socket save from firing.
  const originalTaskNameRef = useRef<string>(decodedTaskName);

  // Update local taskName state when task name changes from Redux,
  // but only when NOT actively editing to avoid overwriting what the user is typing
  useEffect(() => {
    if (!editTaskName) {
      setTaskName(decodedTaskName);
    }
  }, [decodedTaskName, editTaskName]);

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
      name: decodedTaskName,
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
      decodedTaskName,
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
    originalTaskNameRef,

    // Computed values
    taskDisplayName,
    convertedTask,
    formattedDates,
    dateValues,
    labelsAdapter,
  };
};
