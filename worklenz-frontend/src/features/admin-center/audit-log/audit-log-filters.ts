import dayjs, { Dayjs } from 'dayjs';
import {
  TimeLogsDatePreset,
  resolveDateRange,
} from '@/pages/reporting/time-sheets/components/time-logs/time-logs-filters';
import type { AuditEventCategoryId } from '@/shared/audit-log-constants';
import { IAuditLogQueryParams } from '@/types/admin-center/audit-log.types';

export const AUDIT_LOG_PAGE_SIZE_OPTIONS = [20, 50, 100];
export const DEFAULT_AUDIT_LOG_PAGE_SIZE = 20;

/** The audit log opens on the last 7 days by default. */
export const DEFAULT_AUDIT_LOG_DATE_PRESET: TimeLogsDatePreset = 'last_7_days';

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
