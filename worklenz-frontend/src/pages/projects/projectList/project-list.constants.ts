import type { PayloadAction } from '@reduxjs/toolkit';
import type { ColumnFilterItem, FilterValue } from 'antd/es/table/interface';

import {
  setFilteredCategories,
  setFilteredClients,
  setFilteredPriorities,
  setFilteredStatuses,
} from '@/features/projects/projectsSlice';
import { IProjectFilter } from '@/types/project/project.types';
import { ProjectListField, ProjectListFieldKey } from '@/types/project-list-field.types';

export const SEARCH_DEBOUNCE_MS = 500;
export const MAX_SEARCH_LENGTH = 100;

export const DEFAULT_PROJECT_SORT_FIELD = 'name';
export const DEFAULT_PROJECT_SORT_ORDER = 'ascend';
export const DEFAULT_GROUPED_PROJECT_SORT_FIELD = 'priority';
export const DEFAULT_GROUPED_PROJECT_SORT_ORDER = 'descend';

export const SEARCH_QUERY_PARAM = 'search';
export const PAGE_QUERY_PARAM = 'page';
export const SIZE_QUERY_PARAM = 'size';

/** "All" / "Favorites" / "Archived" — the index doubles as the `filter` request param. */
export const PROJECT_FILTER_SEGMENTS = Object.values(IProjectFilter);

/** Columns that are never hidden by the field-visibility dropdown. */
export const ALWAYS_VISIBLE_COLUMN_KEYS: ReadonlySet<string> = new Set([
  ProjectListFieldKey.NAME,
  'actions',
]);

/**
 * Whether a column is currently rendered, per the field-visibility dropdown.
 *
 * antd only reports filter state for columns it actually rendered — a hidden
 * column's key is simply absent from the `filters` object `Table#onChange`
 * receives, indistinguishable from "the user cleared this filter". Callers
 * that would otherwise treat a missing key as "cleared" must check this first,
 * or hiding a filtered column silently drops that filter on the next table
 * interaction.
 */
export const isColumnVisible = (fields: readonly ProjectListField[], key: string): boolean => {
  if (ALWAYS_VISIBLE_COLUMN_KEYS.has(key)) return true;
  return fields.find(field => field.key === key)?.visible ?? true;
};

/** Request params driven by a column filter dropdown. */
export type ProjectFilterParam = 'statuses' | 'categories' | 'priorities' | 'clients';

/**
 * Ant Design keys the `filters` record it hands to `Table#onChange` by each
 * column's `key`, not its `dataIndex` (`antd/lib/table/util#getColumnKey` —
 * `key` wins whenever it is defined). These columns use `ProjectListFieldKey`
 * values as their `key` so the visibility dropdown can address them, which
 * means the filter handler, the column definitions and the request params all
 * have to agree on that mapping. This table is its single source of truth.
 */
export const FILTERABLE_COLUMNS = [
  {
    columnKey: ProjectListFieldKey.STATUS,
    param: 'statuses',
    setFiltered: setFilteredStatuses,
  },
  {
    columnKey: ProjectListFieldKey.CATEGORY,
    param: 'categories',
    setFiltered: setFilteredCategories,
  },
  {
    columnKey: ProjectListFieldKey.PRIORITY,
    param: 'priorities',
    setFiltered: setFilteredPriorities,
  },
  {
    columnKey: ProjectListFieldKey.CLIENT,
    param: 'clients',
    setFiltered: setFilteredClients,
  },
] as const satisfies ReadonlyArray<{
  columnKey: ProjectListFieldKey;
  param: ProjectFilterParam;
  setFiltered: (ids: string[]) => PayloadAction<string[]>;
}>;

export type FilterableColumnKey = (typeof FILTERABLE_COLUMNS)[number]['columnKey'];

/** Options rendered in each filterable column's dropdown. */
export type ColumnFilterOptions = Record<FilterableColumnKey, ColumnFilterItem[]>;
/** Currently-checked ids for each filterable column. */
export type ColumnFilterValues = Record<FilterableColumnKey, FilterValue>;

export const NONE_FILTER_VALUE = 'none';

export const toColumnFilterItems = (
  items: readonly { id?: string; name?: string }[]
): ColumnFilterItem[] => items.map(item => ({ text: item.name || '', value: item.id || '' }));

/**
 * antd hands back a fresh array on every `onChange`, so comparing by reference
 * always reports "changed" and triggers a needless refetch. Compare contents.
 */
export const serializeFilterValue = (value: FilterValue | null | undefined): string =>
  value?.length ? [...value].map(String).sort().join(' ') : '';

/**
 * The request param is the source of truth for what is currently applied —
 * unlike antd's local filter state it survives a remount, so paginating after
 * navigating back to the page doesn't look like a fresh filter change.
 */
export const normalizeFilterParam = (value: string | null | undefined): string =>
  value ? value.split(' ').filter(Boolean).sort().join(' ') : '';

export const parsePositiveIntegerParam = (value: string | null): number | null => {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) return null;
  return parsed;
};

export const buildProjectRoute = (projectId: string, defaultView: string | undefined): string => {
  const tab = defaultView === 'BOARD' ? 'board' : 'tasks-list';
  return `/worklenz/projects/${projectId}?tab=${tab}&pinned_tab=${tab}`;
};
