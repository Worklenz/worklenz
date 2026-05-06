import { Task, ViewMode } from 'gantt-task-react';

// Task data from API
export interface TaskTimelineItem {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  parent_task_id: string | null;
  project_id: string;
  project_name: string;
  project_color: string;
  status_id: string;
  status_name: string;
  status_color: string;
  is_done_status: boolean;
  priority_id: string;
  priority_name: string;
  priority_color: string;
  done: boolean;
  total_minutes: number;
  assignees: Array<{
    id: string;
    user_id: string;
    name: string;
    email: string;
    avatar_url: string | null;
  }>;
  subtask_count: number;
  completed_subtask_count: number;
}

// Time-off entry for overlay
export interface TimeOffEntry {
  id: string;
  team_member_id: string;
  start_date: string;
  end_date: string;
  reason: string | null;
  member_name: string;
}

/**
 * Calculate progress percentage based on subtasks or done status
 */
const calculateProgress = (task: TaskTimelineItem): number => {
  if (task.done || task.is_done_status) {
    return 100;
  }
  if (task.subtask_count > 0) {
    return Math.round((task.completed_subtask_count / task.subtask_count) * 100);
  }
  return 0;
};

/**
 * Get default dates for tasks without dates
 */
const getDefaultDates = (
  startDate: string | null,
  endDate: string | null
): { start: Date; end: Date } => {
  const today = new Date();
  const defaultStart = startDate ? new Date(startDate) : today;
  const defaultEnd = endDate
    ? new Date(endDate)
    : new Date(defaultStart.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days later

  // Ensure end is after start
  if (defaultEnd <= defaultStart) {
    defaultEnd.setDate(defaultStart.getDate() + 1);
  }

  return { start: defaultStart, end: defaultEnd };
};

/**
 * Adjust color brightness for dark/light mode
 */
const adjustColorForTheme = (color: string, isDarkMode: boolean): string => {
  if (!color) return isDarkMode ? '#4a5568' : '#e2e8f0';

  // Add alpha for background
  if (color.startsWith('#') && color.length === 7) {
    return isDarkMode ? `${color}40` : `${color}30`;
  }
  return color;
};

/**
 * Transform Worklenz task data to gantt-task-react format
 */
export const transformTasksToGanttFormat = (
  tasks: TaskTimelineItem[],
  isDarkMode: boolean = false
): Task[] => {
  if (!tasks || tasks.length === 0) return [];

  // Group tasks by project for project-level grouping
  const projectGroups = new Map<string, TaskTimelineItem[]>();

  tasks.forEach(task => {
    const projectId = task.project_id;
    if (!projectGroups.has(projectId)) {
      projectGroups.set(projectId, []);
    }
    projectGroups.get(projectId)!.push(task);
  });

  const ganttTasks: Task[] = [];

  // Create project groups and their tasks
  projectGroups.forEach((projectTasks, projectId) => {
    if (projectTasks.length === 0) return;

    const firstTask = projectTasks[0];

    // Calculate project date range from tasks
    const taskDates = projectTasks
      .filter(t => t.start_date || t.end_date)
      .map(t => ({
        start: t.start_date ? new Date(t.start_date) : null,
        end: t.end_date ? new Date(t.end_date) : null,
      }));

    let projectStart = new Date();
    let projectEnd = new Date();

    if (taskDates.length > 0) {
      const validStarts = taskDates.filter(d => d.start).map(d => d.start!.getTime());
      const validEnds = taskDates.filter(d => d.end).map(d => d.end!.getTime());

      if (validStarts.length > 0) {
        projectStart = new Date(Math.min(...validStarts));
      }
      if (validEnds.length > 0) {
        projectEnd = new Date(Math.max(...validEnds));
      }
    }

    // Ensure project end is after start
    if (projectEnd <= projectStart) {
      projectEnd = new Date(projectStart.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    }

    // Add project as a group header
    const projectTask: Task = {
      id: `project-${projectId}`,
      name: firstTask.project_name,
      start: projectStart,
      end: projectEnd,
      progress: Math.round(
        projectTasks.reduce((sum, t) => sum + calculateProgress(t), 0) / projectTasks.length
      ),
      type: 'project',
      hideChildren: false,
      styles: {
        progressColor: firstTask.project_color || '#3b82f6',
        progressSelectedColor: firstTask.project_color || '#2563eb',
        backgroundColor: adjustColorForTheme(firstTask.project_color, isDarkMode),
      },
    };
    ganttTasks.push(projectTask);

    // Add individual tasks under the project
    projectTasks.forEach(task => {
      const { start, end } = getDefaultDates(task.start_date, task.end_date);
      const progress = calculateProgress(task);

      const ganttTask: Task = {
        id: task.id,
        name: task.name,
        start,
        end,
        progress,
        type: 'task',
        project: `project-${projectId}`,
        styles: {
          progressColor: task.status_color || '#10b981',
          progressSelectedColor: task.status_color || '#059669',
          backgroundColor: adjustColorForTheme(task.status_color, isDarkMode),
        },
      };
      ganttTasks.push(ganttTask);
    });
  });

  return ganttTasks;
};

/**
 * Transform time-off entries to gantt milestone format for overlay
 */
export const transformTimeOffToGanttFormat = (
  timeOffEntries: TimeOffEntry[],
  isDarkMode: boolean = false
): Task[] => {
  if (!timeOffEntries || timeOffEntries.length === 0) return [];

  return timeOffEntries.map(entry => ({
    id: `timeoff-${entry.id}`,
    name: `${entry.member_name} - ${entry.reason || 'Time Off'}`,
    start: new Date(entry.start_date),
    end: new Date(entry.end_date),
    progress: 0,
    type: 'milestone' as const,
    styles: {
      progressColor: isDarkMode ? '#ef4444' : '#dc2626',
      progressSelectedColor: isDarkMode ? '#f87171' : '#ef4444',
      backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(220, 38, 38, 0.2)',
    },
  }));
};

/**
 * Map schedule view type to gantt-task-react ViewMode
 */
export const mapViewModeToGantt = (type: 'week' | 'month'): ViewMode => {
  switch (type) {
    case 'week':
      return ViewMode.Day;
    case 'month':
      return ViewMode.Week;
    default:
      return ViewMode.Week;
  }
};

/**
 * Get column width based on view mode
 */
export const getColumnWidth = (viewMode: ViewMode): number => {
  switch (viewMode) {
    case ViewMode.Day:
      return 60;
    case ViewMode.Week:
      return 200;
    case ViewMode.Month:
      return 300;
    default:
      return 200;
  }
};

/**
 * Filter tasks by assignee
 */
export const filterTasksByAssignee = (
  tasks: TaskTimelineItem[],
  memberId: string | null
): TaskTimelineItem[] => {
  if (!memberId) return tasks;
  return tasks.filter(task => task.assignees.some(assignee => assignee.id === memberId));
};

/**
 * Filter tasks by project
 */
export const filterTasksByProject = (
  tasks: TaskTimelineItem[],
  projectId: string | null
): TaskTimelineItem[] => {
  if (!projectId) return tasks;
  return tasks.filter(task => task.project_id === projectId);
};

/**
 * Filter tasks by status
 */
export const filterTasksByStatus = (
  tasks: TaskTimelineItem[],
  statusId: string | null
): TaskTimelineItem[] => {
  if (!statusId) return tasks;
  return tasks.filter(task => task.status_id === statusId);
};

/**
 * Filter tasks by priority
 */
export const filterTasksByPriority = (
  tasks: TaskTimelineItem[],
  priorityId: string | null
): TaskTimelineItem[] => {
  if (!priorityId) return tasks;
  return tasks.filter(task => task.priority_id === priorityId);
};
