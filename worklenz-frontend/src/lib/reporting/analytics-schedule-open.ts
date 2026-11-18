import type { AnalyticsDatePreset } from '@/components/reporting/analytics';
import type { AnalyticsPersistedFilterState } from '@/lib/reporting/analytics-filter-persistence';
import {
  VALID_REPORTING_DATE_PRESETS,
  isCalendarDate,
  type ReportingCustomRange,
} from '@/utils/date-presets';

const PENDING_KEY = 'worklenz.analytics.pendingScheduleFilters';
const MAX_AGE_MS = 5 * 60 * 1000;

interface PendingScheduleOpen {
  reportKind: string;
  templateId: string | null;
  filters: Record<string, unknown>;
  at: number;
}

export interface AppliedScheduleFilterState {
  state: AnalyticsPersistedFilterState;
  explicitProjects: boolean;
  explicitTeams: boolean;
}

const asStringIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  return value.map(String).filter(Boolean);
};

const parseCustomRange = (value: unknown): ReportingCustomRange | undefined => {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  if (!value.every((item): item is string => typeof item === 'string' && isCalendarDate(item))) {
    return undefined;
  }
  if (value[0] > value[1]) return undefined;
  return [value[0], value[1]];
};

/** Stash schedule filters so the target report page can hydrate them on Open. */
export function stashScheduleFiltersForOpen(input: {
  reportKind: string;
  templateId?: string | null;
  filters: Record<string, unknown>;
}): void {
  if (typeof sessionStorage === 'undefined') return;
  const payload: PendingScheduleOpen = {
    reportKind: input.reportKind,
    templateId: input.templateId?.trim() || null,
    filters: input.filters && typeof input.filters === 'object' ? input.filters : {},
    at: Date.now(),
  };
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private-mode failures; Open still navigates without hydrate.
  }
}

/**
 * Map saved schedule filters_json into persisted filter fields.
 * Live/latest project scope leaves project picks unset so pages can re-seed charts.
 */
export function mapScheduleFiltersToPersistedState(
  filters: Record<string, unknown>
): AppliedScheduleFilterState {
  const state: AnalyticsPersistedFilterState = {};
  let explicitProjects = false;
  let explicitTeams = false;

  const projectIds = asStringIds(filters.project_ids);
  const projectScope =
    typeof filters.project_scope === 'string' ? filters.project_scope : null;
  if (projectIds) {
    if (projectIds.length > 0 || projectScope === 'explicit') {
      state.selectedProjectIds = projectIds;
      explicitProjects = true;
    }
  }

  const memberIds = asStringIds(filters.member_ids ?? filters.assignee_ids);
  if (memberIds) state.selectedMemberIds = memberIds;

  const teamIds = asStringIds(filters.team_ids);
  if (teamIds) {
    state.selectedTeamIds = teamIds;
    explicitTeams = true;
  }

  const statusIds = asStringIds(filters.status_ids);
  if (statusIds) state.selectedStatusIds = statusIds;

  const healthIds = asStringIds(filters.health_ids);
  if (healthIds) state.selectedHealthIds = healthIds;

  if (typeof filters.include_done === 'boolean') {
    state.includeDone = filters.include_done;
  } else if (typeof filters.includeDone === 'boolean') {
    state.includeDone = filters.includeDone;
  }

  const preset = filters.date_preset;
  const customRange = parseCustomRange(filters.custom_range ?? filters.customRange);
  if (
    typeof preset === 'string' &&
    VALID_REPORTING_DATE_PRESETS.includes(preset as AnalyticsDatePreset)
  ) {
    const nextPreset = preset as AnalyticsDatePreset;
    if (nextPreset !== 'custom' || customRange) {
      state.datePreset = nextPreset;
      state.customRange = nextPreset === 'custom' ? (customRange ?? null) : null;
    }
  }

  return { state, explicitProjects, explicitTeams };
}

/**
 * Consume a one-shot pending Open payload when it matches this report page.
 * Returns null when nothing is pending or the target does not match.
 */
export function consumePendingScheduleFilters(
  reportKind: string,
  templateId?: string | null
): AppliedScheduleFilterState | null {
  if (typeof sessionStorage === 'undefined') return null;

  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(PENDING_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;

  try {
    const pending = JSON.parse(raw) as PendingScheduleOpen;
    if (!pending || typeof pending !== 'object') {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }
    if (Date.now() - Number(pending.at || 0) > MAX_AGE_MS) {
      sessionStorage.removeItem(PENDING_KEY);
      return null;
    }

    const pendingTemplate = pending.templateId?.trim() || null;
    const pageTemplate = templateId?.trim() || null;
    if (pending.reportKind !== reportKind || pendingTemplate !== pageTemplate) {
      return null;
    }

    sessionStorage.removeItem(PENDING_KEY);
    return mapScheduleFiltersToPersistedState(
      pending.filters && typeof pending.filters === 'object' ? pending.filters : {}
    );
  } catch {
    try {
      sessionStorage.removeItem(PENDING_KEY);
    } catch {
      // ignore
    }
    return null;
  }
}
