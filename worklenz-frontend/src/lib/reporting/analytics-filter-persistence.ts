import type { AnalyticsDatePreset } from '@/components/reporting/analytics';
import {
  VALID_REPORTING_DATE_PRESETS,
  isCalendarDate,
  type ReportingCustomRange,
} from '@/utils/date-presets';
import { getUserSession } from '@/utils/session-helper';

const STORAGE_KEY_PREFIX = 'worklenz.analyticsReportFilters';

export interface AnalyticsPersistedFilterState {
  datePreset?: AnalyticsDatePreset;
  customRange?: ReportingCustomRange;
  selectedProjectIds?: string[];
  selectedMemberIds?: string[];
  selectedTeamIds?: string[];
  selectedStatusIds?: string[];
  selectedHealthIds?: string[];
  includeDone?: boolean;
}

export const getAnalyticsFilterStorageKey = (
  reportKey: string,
  teamId?: string | null,
  userId?: string | null
): string => {
  const team = teamId?.trim() || 'no-team';
  const user = userId?.trim() || 'no-user';
  return `${STORAGE_KEY_PREFIX}:${team}:${user}:${reportKey}`;
};

export const resolveAnalyticsFilterReportKey = (
  reportKind: string,
  customTemplateId?: string
): string =>
  customTemplateId?.trim()
    ? `${reportKind}:custom:${customTemplateId.trim()}`
    : reportKind;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
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

/** Read persisted analytics filters for the active session/workspace. */
export const readAnalyticsFilterSession = <T extends AnalyticsPersistedFilterState>(
  reportKey: string,
  defaults: T
): {
  state: T;
  wasRestored: boolean;
  hasExplicitFilters: boolean;
  explicitProjects?: boolean;
  explicitTeams?: boolean;
} => {
  if (typeof sessionStorage === 'undefined') {
    return { state: defaults, wasRestored: false, hasExplicitFilters: false };
  }

  const session = getUserSession();
  const storageKey = getAnalyticsFilterStorageKey(
    reportKey,
    session?.team_id,
    session?.id
  );

  try {
    const raw = sessionStorage.getItem(storageKey);
    if (!raw) return { state: defaults, wasRestored: false, hasExplicitFilters: false };

    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return { state: defaults, wasRestored: false, hasExplicitFilters: false };

    const next: AnalyticsPersistedFilterState = { ...defaults };

    const projectIds = asStringArray(parsed.selectedProjectIds);
    if (projectIds) next.selectedProjectIds = projectIds;

    const memberIds = asStringArray(parsed.selectedMemberIds);
    if (memberIds) next.selectedMemberIds = memberIds;

    const teamIds = asStringArray(parsed.selectedTeamIds);
    if (teamIds) next.selectedTeamIds = teamIds;

    const statusIds = asStringArray(parsed.selectedStatusIds);
    if (statusIds) next.selectedStatusIds = statusIds;

    const healthIds = asStringArray(parsed.selectedHealthIds);
    if (healthIds) next.selectedHealthIds = healthIds;

    // Ignore unknown presets while preserving those saved by earlier versions.
    if (
      typeof parsed.datePreset === 'string' &&
      VALID_REPORTING_DATE_PRESETS.includes(parsed.datePreset as AnalyticsDatePreset)
    ) {
      next.datePreset = parsed.datePreset as AnalyticsDatePreset;
    }

    const customRange = parseCustomRange(parsed.customRange);
    if (customRange !== undefined) {
      next.customRange = next.datePreset === 'custom' ? customRange : null;
    } else if (next.datePreset !== 'custom') {
      next.customRange = null;
    }
    if (next.datePreset === 'custom' && !next.customRange) {
      next.datePreset = defaults.datePreset;
      next.customRange = defaults.customRange;
    }

    if (typeof parsed.includeDone === 'boolean') {
      next.includeDone = parsed.includeDone;
    }

    return {
      state: next as T,
      wasRestored: true,
      hasExplicitFilters: parsed.hasExplicitFilters === true,
      explicitProjects:
        typeof parsed.explicitProjects === 'boolean' ? parsed.explicitProjects : undefined,
      explicitTeams: typeof parsed.explicitTeams === 'boolean' ? parsed.explicitTeams : undefined,
    };
  } catch {
    return { state: defaults, wasRestored: false, hasExplicitFilters: false };
  }
};

/** Persist analytics filters for the active session/workspace. */
export const writeAnalyticsFilterSession = (
  reportKey: string,
  state: AnalyticsPersistedFilterState,
  hasExplicitFilters = true,
  explicitProjects?: boolean,
  explicitTeams?: boolean
): void => {
  if (typeof sessionStorage === 'undefined') return;

  const session = getUserSession();
  const storageKey = getAnalyticsFilterStorageKey(
    reportKey,
    session?.team_id,
    session?.id
  );

  try {
    sessionStorage.setItem(
      storageKey,
      JSON.stringify({ ...state, hasExplicitFilters, explicitProjects, explicitTeams })
    );
  } catch {
    // Quota / private mode — ignore; in-memory React state still works for the visit.
  }
};
