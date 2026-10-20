import dayjs, { Dayjs } from 'dayjs';
import { DatePresetKey, formatCalendarDate, getDatePresetRange } from '@/utils/date-presets';
import { ITimeLogBillableFilter, ITimeLogsFilterRequest } from '@/types/reporting/time-logs.types';

/** Same sentinel the Members time sheet and the backend use for "member has no practice". */
export const NO_PRACTICE_FILTER_ID = '__no_practice__';

/** Sentinel for "entries whose project has no client"; the backend understands it. */
export const NO_CLIENT_FILTER_ID = '__no_client__';

export type TimeLogsDatePreset = DatePresetKey | 'custom';
export type TimeLogsBillableValue = 'billable' | 'non_billable';

export interface ITimeLogsFilterState {
  datePreset: TimeLogsDatePreset;
  /** Inclusive `[from, to]`, `YYYY-MM-DD`. Only read when `datePreset === 'custom'`. */
  customRange: [string, string] | null;
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

export interface IResolvedDateRange {
  from: string;
  to: string;
}

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

/**
 * Order the presets are offered in: shortest span first, grouped by period
 * (day, week, month), the current period before the previous one, then the
 * unbounded and manual choices.
 */
export const TIME_LOGS_DATE_PRESETS: TimeLogsDatePreset[] = [
  'today',
  'yesterday',
  'this_week',
  'last_week',
  'last_7_days',
  'this_month',
  'last_month',
  'last_30_days',
  'last_3_months',
  'all_time',
  'custom',
];

/**
 * The concrete calendar range a state stands for, or `null` for "all time"
 * (and for a custom range that has not been picked yet). Evaluated on demand
 * so relative presets like "This Month" follow the clock.
 */
export const resolveDateRange = (
  state: Pick<ITimeLogsFilterState, 'datePreset' | 'customRange'>,
  now: Dayjs = dayjs()
): IResolvedDateRange | null => {
  if (state.datePreset === 'custom') {
    return state.customRange ? { from: state.customRange[0], to: state.customRange[1] } : null;
  }
  return getDatePresetRange(state.datePreset, now);
};

/** "Sep 1, 2026 – Sep 17, 2026", a single date for one day, or `null` when unbounded. */
export const formatResolvedRange = (range: IResolvedDateRange | null): string | null => {
  if (!range) return null;
  if (range.from === range.to) return formatCalendarDate(range.from);
  return `${formatCalendarDate(range.from)} – ${formatCalendarDate(range.to)}`;
};

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
