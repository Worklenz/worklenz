import dayjs from 'dayjs';
import {
  REPORTING_DATE_PRESETS,
  formatResolvedRange,
  resolveReportingDateRange,
  type IDatePresetRange,
  type ReportingCustomRange,
  type ReportingDatePreset,
} from '@/utils/date-presets';
import { ITimeLogBillableFilter, ITimeLogsFilterRequest } from '@/types/reporting/time-logs.types';

/** Same sentinel the Members time sheet and the backend use for "member has no practice". */
export const NO_PRACTICE_FILTER_ID = '__no_practice__';

/** Sentinel for "entries whose project has no client"; the backend understands it. */
export const NO_CLIENT_FILTER_ID = '__no_client__';

export type TimeLogsDatePreset = ReportingDatePreset;
export type TimeLogsBillableValue = 'billable' | 'non_billable';

export interface ITimeLogsFilterState {
  datePreset: TimeLogsDatePreset;
  /** Inclusive `[from, to]`, `YYYY-MM-DD`. Only read when `datePreset === 'custom'`. */
  customRange: ReportingCustomRange;
  projectIds: string[];
  /** May contain {@link NO_PRACTICE_FILTER_ID}. */
  practiceIds: string[];
  /** May contain {@link NO_CLIENT_FILTER_ID}. */
  clientIds: string[];
  /** User ids (not team-member ids), so deactivated and removed members stay filterable. */
  userIds: string[];
  /** Empty (or both) = no billable filter. */
  billable: TimeLogsBillableValue[];
}

export type IResolvedDateRange = IDatePresetRange;

/** What the page shows before any filter is applied: the current week, up to and including today. */
export const DEFAULT_TIME_LOGS_DATE_PRESET: TimeLogsDatePreset = 'this_week';

export const DEFAULT_TIME_LOGS_FILTERS: ITimeLogsFilterState = {
  datePreset: DEFAULT_TIME_LOGS_DATE_PRESET,
  customRange: null,
  projectIds: [],
  practiceIds: [],
  clientIds: [],
  userIds: [],
  billable: [],
};

/** @see REPORTING_DATE_PRESETS */
export const TIME_LOGS_DATE_PRESETS: TimeLogsDatePreset[] = REPORTING_DATE_PRESETS;

export const isTimeLogsFilterState = (value: unknown): value is ITimeLogsFilterState => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const filters = value as Record<string, unknown>;
  const isStringArray = (item: unknown): item is string[] =>
    Array.isArray(item) && item.every(entry => typeof entry === 'string');
  const isCalendarDate = (date: string): boolean =>
    /^\d{4}-\d{2}-\d{2}$/.test(date) && dayjs(date).isValid() && dayjs(date).format('YYYY-MM-DD') === date;
  return typeof filters.datePreset === 'string' &&
    TIME_LOGS_DATE_PRESETS.includes(filters.datePreset as TimeLogsDatePreset) &&
    (filters.customRange === null || (isStringArray(filters.customRange) && filters.customRange.length === 2 &&
      filters.customRange.every(isCalendarDate) && filters.customRange[0] <= filters.customRange[1])) &&
    isStringArray(filters.projectIds) && isStringArray(filters.practiceIds) &&
    isStringArray(filters.clientIds) && isStringArray(filters.userIds) &&
    isStringArray(filters.billable) && filters.billable.every(item => item === 'billable' || item === 'non_billable');
};

/** @see resolveReportingDateRange */
export const resolveDateRange = resolveReportingDateRange;

export { formatResolvedRange };

/** Both sides ticked is the same as neither: no billable filter. */
export const toBillableRequest = (
  values: TimeLogsBillableValue[]
): ITimeLogBillableFilter | undefined => {
  const hasBillable = values.includes('billable');
  const hasNonBillable = values.includes('non_billable');
  if (hasBillable === hasNonBillable) return undefined;
  return { billable: hasBillable, nonBillable: hasNonBillable };
};

export const toFilterRequest = (
  state: ITimeLogsFilterState,
  search: string,
  range: IResolvedDateRange | null
): ITimeLogsFilterRequest => {
  const request: ITimeLogsFilterRequest = {};
  if (range) {
    request.date_from = range.from;
    request.date_to = range.to;
  }
  if (state.userIds.length) request.user_ids = state.userIds;
  if (state.projectIds.length) request.project_ids = state.projectIds;
  if (state.practiceIds.length) request.practice_ids = state.practiceIds;
  if (state.clientIds.length) request.client_ids = state.clientIds;
  const billable = toBillableRequest(state.billable);
  if (billable) request.billable = billable;
  const trimmed = search.trim();
  if (trimmed) request.search = trimmed;
  return request;
};

/** Number of filter groups that differ from the defaults (shown on the Filter button). */
export const countActiveFilters = (state: ITimeLogsFilterState): number => {
  let count = 0;
  if (state.datePreset !== DEFAULT_TIME_LOGS_DATE_PRESET) count++;
  if (state.projectIds.length) count++;
  if (state.practiceIds.length) count++;
  if (state.clientIds.length) count++;
  if (state.userIds.length) count++;
  if (toBillableRequest(state.billable)) count++;
  return count;
};

/** A custom range needs both ends before it can be applied. */
export const isApplicable = (state: ITimeLogsFilterState): boolean =>
  state.datePreset !== 'custom' || state.customRange !== null;

/** Drops a redundant "both billable values" selection so state, badge and request agree. */
export const normalizeFilters = (state: ITimeLogsFilterState): ITimeLogsFilterState => ({
  ...state,
  customRange: state.datePreset === 'custom' ? state.customRange : null,
  billable: toBillableRequest(state.billable) ? state.billable : [],
});

export const areFiltersEqual = (a: ITimeLogsFilterState, b: ITimeLogsFilterState): boolean =>
  JSON.stringify(normalizeFilters(a)) === JSON.stringify(normalizeFilters(b));
