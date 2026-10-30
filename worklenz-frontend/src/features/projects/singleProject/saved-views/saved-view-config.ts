import {
  ISavedViewConfig,
  SAVED_VIEW_CONFIG_VERSION,
} from '@/types/project/project-saved-views.types';

export const SAVED_VIEW_TAB_PREFIX = 'view:';

export const toSavedViewTabKey = (viewId: string): string => `${SAVED_VIEW_TAB_PREFIX}${viewId}`;

export const parseSavedViewTabKey = (tabKey: string | null | undefined): string | null => {
  if (!tabKey?.startsWith(SAVED_VIEW_TAB_PREFIX)) return null;
  return tabKey.slice(SAVED_VIEW_TAB_PREFIX.length) || null;
};

/** True for the List tab and for saved-view tabs that reuse the task list UI. */
export const isListTabKey = (tabKey: string | null | undefined): boolean =>
  tabKey === 'tasks-list' || !!parseSavedViewTabKey(tabKey);

/** The slices of Redux state a saved view is captured from. */
export interface SavedViewSourceState {
  taskReducer: {
    priorities: string[];
    phases: string[];
    statuses: { id?: string }[];
    taskAssignees: { id?: string; selected?: boolean }[];
    labels: { id?: string; selected?: boolean }[];
  };
  taskManagement: {
    search: string;
    archived: boolean;
    sortField: string;
    sortOrder: 'ASC' | 'DESC';
  };
  grouping: {
    currentGrouping: ISavedViewConfig['group'] | null;
  };
}

const sortedUnique = (values: (string | undefined | null)[]): string[] =>
  Array.from(new Set(values.filter((value): value is string => !!value))).sort();

const selectedIds = (items: { id?: string; selected?: boolean }[]): string[] =>
  sortedUnique(items.filter(item => item.selected).map(item => item.id));

export const serializeSavedViewConfig = (state: SavedViewSourceState): ISavedViewConfig => ({
  version: SAVED_VIEW_CONFIG_VERSION,
  priorities: sortedUnique(state.taskReducer.priorities),
  statuses: sortedUnique(state.taskReducer.statuses.map(status => status.id)),
  phases: sortedUnique(state.taskReducer.phases),
  members: selectedIds(state.taskReducer.taskAssignees),
  labels: selectedIds(state.taskReducer.labels),
  search: (state.taskManagement.search || '').trim(),
  archived: !!state.taskManagement.archived,
  group: state.grouping.currentGrouping || 'status',
  sort_field: state.taskManagement.sortField || '',
  sort_order: state.taskManagement.sortOrder === 'DESC' ? 'DESC' : 'ASC',
});

const normalizeSavedViewConfig = (config: ISavedViewConfig): ISavedViewConfig => ({
  version: SAVED_VIEW_CONFIG_VERSION,
  priorities: sortedUnique(config.priorities ?? []),
  statuses: sortedUnique(config.statuses ?? []),
  phases: sortedUnique(config.phases ?? []),
  members: sortedUnique(config.members ?? []),
  labels: sortedUnique(config.labels ?? []),
  search: (config.search || '').trim(),
  archived: !!config.archived,
  group: config.group || 'status',
  sort_field: config.sort_field || '',
  // Without a sort field the order has no effect, so it must not make a view look changed.
  sort_order: config.sort_field && config.sort_order === 'DESC' ? 'DESC' : 'ASC',
});

export const areSavedViewConfigsEqual = (a: ISavedViewConfig, b: ISavedViewConfig): boolean =>
  JSON.stringify(normalizeSavedViewConfig(a)) === JSON.stringify(normalizeSavedViewConfig(b));

/** True when the config narrows or reorders the list, i.e. there is something worth saving as a tab. */
export const hasSavedViewCriteria = (config: ISavedViewConfig): boolean =>
  config.priorities.length > 0 ||
  config.statuses.length > 0 ||
  config.phases.length > 0 ||
  config.members.length > 0 ||
  config.labels.length > 0 ||
  !!config.search ||
  config.archived ||
  !!config.sort_field;

/** "List", then "List 2", "List 3"... so new tabs never share a name. */
export const nextSavedViewName = (baseName: string, existingNames: string[]): string => {
  const taken = new Set(existingNames.map(name => name.trim().toLowerCase()));
  if (!taken.has(baseName.toLowerCase())) return baseName;
  let suffix = 2;
  while (taken.has(`${baseName} ${suffix}`.toLowerCase())) suffix += 1;
  return `${baseName} ${suffix}`;
};
