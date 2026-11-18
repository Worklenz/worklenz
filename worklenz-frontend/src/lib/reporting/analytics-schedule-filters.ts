import { DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT } from '@/lib/reporting/analytics-chart-projects';

/**
 * Build filter payload stored on analytics report schedules.
 *
 * - Select-all / empty → live team scope (`project_ids: []`)
 * - Default latest-N selection → live + `project_scope: 'latest'` (re-pick at send)
 * - Custom subset → frozen explicit IDs
 * - `forceLiveProjectScope` → always live (team-scoped series pages like Project Health)
 * - Relative date presets (`yesterday`, `last_30_days`, …) store `date_preset` only;
 *   absolute `date_from`/`date_to` are re-resolved at each scheduled send
 * - `custom` date ranges freeze `date_from`/`date_to` (and `custom_range` via extra)
 */

/** Presets that must re-resolve calendar bounds at send time (not custom). */
function shouldFreezeScheduleDates(datePreset: string | undefined): boolean {
  return datePreset === 'custom';
}
export function resolveScheduleProjectIds(options: {
  selectedProjectIds: string[];
  projectOptionsCount: number;
}): string[] {
  const selected = options.selectedProjectIds.filter(Boolean);
  if (selected.length === 0) return [];

  const isSelectAll =
    options.projectOptionsCount > 0 && selected.length >= options.projectOptionsCount;

  if (isSelectAll) return [];
  return selected;
}

export type AnalyticsScheduleProjectScope = 'live' | 'latest' | 'explicit';

export function resolveScheduleProjectScope(options: {
  selectedProjectIds: string[];
  projectOptionsCount: number;
  forceLiveProjectScope?: boolean;
  defaultLatestLimit?: number;
}): { projectIds: string[]; projectScope: AnalyticsScheduleProjectScope } {
  const limit = options.defaultLatestLimit ?? DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT;
  const selected = options.selectedProjectIds.filter(Boolean);
  const isSelectAll =
    options.projectOptionsCount > 0 && selected.length >= options.projectOptionsCount;

  if (options.forceLiveProjectScope || selected.length === 0 || isSelectAll) {
    return { projectIds: [], projectScope: 'live' };
  }

  // Default "latest N" seed — do not freeze; re-resolve at each send.
  const isDefaultLatest =
    selected.length > 0 &&
    selected.length <= limit &&
    options.projectOptionsCount > selected.length;

  if (isDefaultLatest) {
    return { projectIds: [], projectScope: 'latest' };
  }

  return { projectIds: selected, projectScope: 'explicit' };
}

export function buildAnalyticsScheduleFilters(input: {
  selectedProjectIds: string[];
  projectOptionsCount: number;
  selectedTeamIds?: string[];
  selectedMemberIds?: string[];
  selectedHealthIds?: string[];
  selectedStatusIds?: string[];
  datePreset?: string;
  dateFrom?: string | null;
  dateTo?: string | null;
  /** Team-scoped series pages: KPIs use all team projects; never freeze chart picks. */
  forceLiveProjectScope?: boolean;
  defaultLatestLimit?: number;
  extra?: Record<string, unknown>;
}): Record<string, unknown> {
  const { projectIds, projectScope } = resolveScheduleProjectScope({
    selectedProjectIds: input.selectedProjectIds,
    projectOptionsCount: input.projectOptionsCount,
    forceLiveProjectScope: input.forceLiveProjectScope,
    defaultLatestLimit: input.defaultLatestLimit,
  });

  const freezeDates = shouldFreezeScheduleDates(input.datePreset);

  return {
    project_ids: projectIds,
    team_ids: input.selectedTeamIds ?? [],
    member_ids: input.selectedMemberIds ?? [],
    ...(input.selectedHealthIds ? { health_ids: input.selectedHealthIds } : {}),
    ...(input.selectedStatusIds ? { status_ids: input.selectedStatusIds } : {}),
    ...(input.datePreset ? { date_preset: input.datePreset } : {}),
    // Only custom ranges freeze absolute bounds; relative presets stay live at send.
    ...(freezeDates && input.dateFrom != null ? { date_from: input.dateFrom } : {}),
    ...(freezeDates && input.dateTo != null ? { date_to: input.dateTo } : {}),
    project_scope: projectScope,
    ...(projectScope === 'latest'
      ? {
          chart_project_limit:
            input.defaultLatestLimit ?? DEFAULT_ANALYTICS_CHART_PROJECT_LIMIT,
        }
      : {}),
    ...(input.extra ?? {}),
  };
}
