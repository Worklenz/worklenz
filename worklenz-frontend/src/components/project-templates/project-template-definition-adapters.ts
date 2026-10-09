import type {
  ICustomProjectTemplateDefinitionPayload,
  IProjectTemplateIncludes,
  IProjectTemplateSettingsSnapshot,
} from '@/types/project/projectTemplate.types';
import type { IProjectTemplate } from '@/types/project-templates/project-templates.types';

export type ProjectTemplateDefinitionMode = 'edit' | 'copy-from-builtin';

export interface EditablePhase {
  key: string;
  name: string;
  color_code: string;
}

export interface EditableStatus {
  key: string;
  name: string;
  category_id: string;
  sort_order: number;
}

export interface EditableLabel {
  key: string;
  name: string;
  color_code: string;
}

export interface EditableTask {
  key: string;
  name: string;
  status_name: string;
  priority_name: string;
  phase_name: string;
  parent_key: string | null;
  description: string;
  total_minutes: number;
  /** Pass-through fields preserved on save (assignees, deps, recurrence, offsets, …). */
  extras?: Record<string, unknown>;
}

export interface ProjectTemplateDefinitionState {
  name: string;
  phase_label: string;
  color_code: string;
  notes: string;
  phases: EditablePhase[];
  statuses: EditableStatus[];
  labels: EditableLabel[];
  tasks: EditableTask[];
  includes: IProjectTemplateIncludes | null;
  settings: IProjectTemplateSettingsSnapshot | null;
}

const createKey = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `k-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
};

export const stripColorAlpha = (color?: string | null): string => {
  if (!color) return '#1890ff';
  const trimmed = color.trim();
  if (trimmed.startsWith('#') && trimmed.length === 9) {
    return trimmed.slice(0, 7);
  }
  return trimmed;
};

export const createEmptyDefinitionState = (
  name = ''
): ProjectTemplateDefinitionState => ({
  name,
  phase_label: 'Phase',
  color_code: '#1890ff',
  notes: '',
  phases: [],
  statuses: [],
  labels: [],
  tasks: [],
  includes: null,
  settings: null,
});

export const createEmptyPhase = (): EditablePhase => ({
  key: createKey(),
  name: '',
  color_code: '#722ed1',
});

export const createEmptyStatus = (categoryId = ''): EditableStatus => ({
  key: createKey(),
  name: '',
  category_id: categoryId,
  sort_order: 0,
});

export const createEmptyLabel = (): EditableLabel => ({
  key: createKey(),
  name: '',
  color_code: '#13c2c2',
});

export const createEmptyTask = (defaults?: {
  status_name?: string;
  priority_name?: string;
  phase_name?: string;
}): EditableTask => ({
  key: createKey(),
  name: '',
  status_name: defaults?.status_name || '',
  priority_name: defaults?.priority_name || '',
  phase_name: defaults?.phase_name || '',
  parent_key: null,
  description: '',
  total_minutes: 0,
});

interface TemplateTaskLike {
  id?: string;
  original_task_id?: string;
  name?: string;
  status_name?: string;
  priority_name?: string;
  phase_name?: string;
  phases?: { name?: string }[];
  parent_task_id?: string | null;
  description?: string | null;
  total_minutes?: number;
  labels?: { name?: string }[];
  [key: string]: unknown;
}

/**
 * Map API template detail (custom or worklenz) into editable local state.
 */
export const templateDetailToDefinitionState = (
  detail: IProjectTemplate & {
    phase_label?: string;
    color_code?: string;
    notes?: string;
    description?: string;
    includes?: IProjectTemplateIncludes | null;
    settings?: IProjectTemplateSettingsSnapshot | null;
  },
  preferredName?: string
): ProjectTemplateDefinitionState => {
  const phases: EditablePhase[] = (detail.phases || []).map(phase => ({
    key: createKey(),
    name: phase.name || '',
    color_code: stripColorAlpha(phase.color_code),
  }));

  const statuses: EditableStatus[] = (detail.status || []).map((status, index) => ({
    key: createKey(),
    name: status.name || '',
    category_id: status.category_id || '',
    sort_order:
      status.sort_order !== undefined && status.sort_order !== null
        ? Number(status.sort_order) || index
        : index,
  }));

  const labels: EditableLabel[] = (detail.labels || []).map(label => ({
    key: createKey(),
    name: label.name || '',
    color_code: stripColorAlpha(label.color_code),
  }));

  const rawTasks = (detail.tasks || []) as TemplateTaskLike[];
  const sourceIdToKey = new Map<string, string>();

  for (const task of rawTasks) {
    const sourceId = task.original_task_id || task.id;
    if (sourceId) {
      sourceIdToKey.set(sourceId, createKey());
    }
  }

  const tasks: EditableTask[] = rawTasks.map(task => {
    const sourceId = task.original_task_id || task.id;
    const key = (sourceId && sourceIdToKey.get(sourceId)) || createKey();
    const phaseName =
      task.phase_name ||
      (Array.isArray(task.phases) && task.phases[0]?.name) ||
      '';

    const {
      id: _id,
      original_task_id: _oid,
      name: _name,
      status_name: _sn,
      priority_name: _pn,
      phase_name: _phn,
      phases: _phases,
      parent_task_id: _ptid,
      description: _desc,
      total_minutes: _tm,
      labels: _labels,
      ...extras
    } = task;

    return {
      key,
      name: task.name || '',
      status_name: task.status_name || '',
      priority_name: task.priority_name || '',
      phase_name: phaseName,
      parent_key:
        task.parent_task_id && sourceIdToKey.has(task.parent_task_id)
          ? sourceIdToKey.get(task.parent_task_id) || null
          : null,
      description: typeof task.description === 'string' ? task.description : '',
      total_minutes:
        typeof task.total_minutes === 'number' ? task.total_minutes : Number(task.total_minutes) || 0,
      extras: Object.keys(extras).length ? extras : undefined,
    };
  });

  return {
    name: preferredName ?? detail.name ?? '',
    phase_label: detail.phase_label || 'Phase',
    color_code: stripColorAlpha(detail.color_code),
    notes: detail.notes || detail.description || '',
    phases,
    statuses,
    labels,
    tasks,
    includes: detail.includes ?? null,
    settings: detail.settings ?? null,
  };
};

/**
 * Build API payload from editable state for PUT / from-worklenz.
 */
export const definitionStateToPayload = (
  state: ProjectTemplateDefinitionState
): ICustomProjectTemplateDefinitionPayload => {
  const keyToId = new Map<string, string>();
  state.tasks.forEach(task => {
    keyToId.set(task.key, task.key);
  });

  return {
    name: state.name.trim(),
    phase_label: state.phase_label.trim() || 'Phase',
    color_code: state.color_code || '#1890ff',
    notes: state.notes || undefined,
    phases: state.phases
      .filter(phase => phase.name.trim())
      .map(phase => ({
        name: phase.name.trim(),
        color_code: phase.color_code || '#722ed1',
      })),
    status: state.statuses
      .filter(status => status.name.trim())
      .map((status, index) => ({
        name: status.name.trim(),
        category_id: status.category_id || undefined,
        sort_order: status.sort_order ?? index,
      })),
    labels: state.labels
      .filter(label => label.name.trim())
      .map(label => ({
        name: label.name.trim(),
        color_code: label.color_code || '#13c2c2',
      })),
    tasks: state.tasks
      .filter(task => task.name.trim())
      .map((task, index) => {
        const parentId =
          task.parent_key && keyToId.has(task.parent_key)
            ? keyToId.get(task.parent_key)
            : undefined;

        return {
          ...(task.extras || {}),
          id: task.key,
          original_task_id: task.key,
          name: task.name.trim(),
          status_name: task.status_name || undefined,
          priority_name: task.priority_name || undefined,
          phase_name: task.phase_name || undefined,
          phases: task.phase_name ? [{ name: task.phase_name }] : [],
          parent_task_id: parentId || null,
          description: task.description || null,
          total_minutes: task.total_minutes || 0,
          task_no: index + 1,
          sort_order: index,
          status_sort_order: index,
          priority_sort_order: index,
          phase_sort_order: index,
        };
      }),
    includes: state.includes || undefined,
    settings: state.settings || undefined,
  };
};
