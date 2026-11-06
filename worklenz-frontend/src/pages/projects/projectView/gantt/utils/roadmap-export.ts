import { GanttGroupingMode, GanttTask } from '../types/gantt-types';
import { formatDateLocal } from './date-utils';

export type RoadmapExportFormat = 'pdf' | 'xlsx';

export interface RoadmapExportRowPayload {
  kind: 'group' | 'task' | 'subtask';
  name: string;
  group: string;
  startDate: string | null;
  endDate: string | null;
  progress: number | null;
  status: string;
  priority: string;
  assignees: string;
  dependencies: string;
  parent: string;
  color: string | null;
}

export interface RoadmapExportPayload {
  project_id: string;
  format: RoadmapExportFormat;
  group_by: GanttGroupingMode;
  grouping_label: string;
  rows: RoadmapExportRowPayload[];
}

const toIsoDate = (value: Date | null | undefined): string | null => {
  if (!value || Number.isNaN(value.getTime())) return null;
  return formatDateLocal(value);
};

const normalizeColor = (value: string | null | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const short = /^#([0-9a-f]{3})$/i.exec(trimmed);
  if (short) {
    const [r, g, b] = short[1].split('');
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  const full = /^#([0-9a-f]{6})$/i.exec(trimmed);
  return full ? `#${full[1].toLowerCase()}` : null;
};

const progressValue = (value: number | null | undefined): number | null => {
  if (value == null || Number.isNaN(value)) return null;
  return Math.max(0, Math.min(100, Math.round(value)));
};

const assigneeLabel = (task: GanttTask): string =>
  (task.assignees || [])
    .map(assignee => assignee.assignee_name || assignee.name || '')
    .filter(Boolean)
    .join(', ');

const isGroup = (task: GanttTask): boolean => task.type === 'milestone' || task.is_milestone === true;

/**
 * Flatten the roadmap the user is looking at.
 * The Gantt list already contains each section followed by its tasks. Subtasks
 * stay nested on the task, so they are written under their parent. Collapsed
 * sections are still included: the file is meant for people who cannot open
 * the project.
 */
export const buildRoadmapExportRows = (tasks: GanttTask[]): RoadmapExportRowPayload[] => {
  const names = new Map<string, string>();
  tasks.forEach(task => {
    names.set(task.id, task.name);
    (task.children || []).forEach(child => names.set(child.id, child.name));
  });

  const dependencyLabel = (task: GanttTask): string =>
    (task.dependencies || [])
      .map(id => names.get(id))
      .filter((name): name is string => Boolean(name))
      .join(', ');

  const rows: RoadmapExportRowPayload[] = [];
  let currentGroup = '';

  const pushTask = (task: GanttTask, kind: 'task' | 'subtask', parent: string) => {
    rows.push({
      kind,
      name: task.name || '',
      group: currentGroup,
      startDate: toIsoDate(task.start_date),
      endDate: toIsoDate(task.end_date),
      progress: progressValue(task.progress),
      status: task.status || '',
      priority: task.priority || '',
      assignees: assigneeLabel(task),
      dependencies: kind === 'task' ? dependencyLabel(task) : '',
      parent,
      color: null,
    });
  };

  tasks.forEach(task => {
    if (task.type === 'add-task-button') return;

    if (isGroup(task)) {
      currentGroup = task.name || '';
      rows.push({
        kind: 'group',
        name: currentGroup,
        group: currentGroup,
        startDate: toIsoDate(task.start_date),
        endDate: toIsoDate(task.end_date),
        progress: progressValue(task.done_progress),
        status: '',
        priority: '',
        assignees: '',
        dependencies: '',
        parent: '',
        color: normalizeColor(task.color),
      });
      return;
    }

    pushTask(task, 'task', '');
    (task.children || []).forEach(child => {
      if (child.type === 'add-task-button' || isGroup(child)) return;
      pushTask(child, 'subtask', task.name || '');
    });
  });

  return rows;
};
