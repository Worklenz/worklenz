import dayjs, { Dayjs } from 'dayjs';
import {
  TimeLogsDatePreset,
  resolveDateRange,
} from '@/pages/reporting/time-sheets/components/time-logs/time-logs-filters';
import type { AuditEventCategoryId } from '@/shared/audit-log-constants';
import { IAuditLogQueryParams } from '@/types/admin-center/audit-log.types';

export const AUDIT_LOG_PAGE_SIZE_OPTIONS = [20, 50, 100];
export const DEFAULT_AUDIT_LOG_PAGE_SIZE = 20;

/** The audit log opens on today's events by default. */
export const DEFAULT_AUDIT_LOG_DATE_PRESET: TimeLogsDatePreset = 'today';

export const AUDIT_LOG_DATE_PRESETS: TimeLogsDatePreset[] = [
  'today',
  'last_7_days',
  'last_30_days',
  'last_90_days',
  'all_time',
];

/**
 * The current moment as a local `Dayjs` whose calendar date is today's date in `timezone`.
 * The backend reads `start_date`/`end_date` as calendar days in the viewer's profile timezone,
 * so "today" has to be that zone's date, not the browser's. Falls back to the browser clock
 * when the zone is missing or unknown.
 */
export const getAuditLogNow = (timezone?: string | null, instant: Date = new Date()): Dayjs => {
  if (!timezone) return dayjs(instant);
  try {
    const date = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(instant);
    return dayjs(date);
  } catch {
    return dayjs(instant);
  }
};

export interface IAuditLogFilterState {
  datePreset: TimeLogsDatePreset;
  /** Inclusive `[from, to]`, `YYYY-MM-DD`. Only read when `datePreset === 'custom'`. */
  customRange: [string, string] | null;
  categories: AuditEventCategoryId[];
  actorUserIds: string[];
  search: string;
}

export const DEFAULT_AUDIT_LOG_FILTERS: IAuditLogFilterState = {
  datePreset: DEFAULT_AUDIT_LOG_DATE_PRESET,
  customRange: null,
  categories: [],
  actorUserIds: [],
  search: '',
};

/**
 * The filter state as API query params. `includeCategories: false` is for the summary
 * endpoint, whose chip counts must not be narrowed by the selected chips themselves.
 */
export const toAuditLogQueryParams = (
  filters: IAuditLogFilterState,
  { includeCategories = true }: { includeCategories?: boolean } = {},
  now: Dayjs = dayjs()
): IAuditLogQueryParams => {
  const params: IAuditLogQueryParams = {};
  const range = resolveDateRange(filters, now);
  if (range) {
    params.start_date = range.from;
    params.end_date = range.to;
  }
  if (includeCategories && filters.categories.length) params.category = filters.categories.join(',');
  if (filters.actorUserIds.length) params.actor_user_id = filters.actorUserIds.join(',');
  const search = filters.search.trim();
  if (search) params.search = search;
  return params;
};

export const hasActiveAuditLogFilters = (filters: IAuditLogFilterState): boolean =>
  filters.datePreset !== DEFAULT_AUDIT_LOG_DATE_PRESET ||
  filters.categories.length > 0 ||
  filters.actorUserIds.length > 0 ||
  filters.search.trim().length > 0;
