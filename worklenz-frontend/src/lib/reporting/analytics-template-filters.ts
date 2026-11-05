import type { AnalyticsDatePreset } from '@/components/reporting/analytics';

export interface CommonAnalyticsTemplateFilterSetters {
  setSelectedProjectIds?: (ids: string[]) => void;
  setSelectedMemberIds?: (ids: string[]) => void;
  setSelectedTeamIds?: (ids: string[]) => void;
  setSelectedStatusIds?: (ids: string[]) => void;
  setSelectedHealthIds?: (ids: string[]) => void;
  setDatePreset?: (preset: AnalyticsDatePreset) => void;
}

const DATE_PRESETS: AnalyticsDatePreset[] = [
  'last_7_days',
  'last_14_days',
  'last_30_days',
  'last_60_days',
  'last_90_days',
  'this_quarter',
  'custom',
];

const asStringIds = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) return null;
  return value.map(String).filter(Boolean);
};

/** Apply common filter fields saved on analytics report templates. */
export const applyCommonAnalyticsTemplateFilters = (
  filters: Record<string, unknown> | undefined | null,
  setters: CommonAnalyticsTemplateFilterSetters
): void => {
  if (!filters) return;

  const projectIds = asStringIds(filters.project_ids);
  if (projectIds && setters.setSelectedProjectIds) {
    setters.setSelectedProjectIds(projectIds);
  }

  const memberIds = asStringIds(filters.member_ids ?? filters.assignee_ids);
  if (memberIds && setters.setSelectedMemberIds) {
    setters.setSelectedMemberIds(memberIds);
  }

  const teamIds = asStringIds(filters.team_ids);
  if (teamIds && setters.setSelectedTeamIds) {
    setters.setSelectedTeamIds(teamIds);
  }

  const statusIds = asStringIds(filters.status_ids);
  if (statusIds && setters.setSelectedStatusIds) {
    setters.setSelectedStatusIds(statusIds);
  }

  const healthIds = asStringIds(filters.health_ids);
  if (healthIds && setters.setSelectedHealthIds) {
    setters.setSelectedHealthIds(healthIds);
  }

  const preset = filters.date_preset;
  if (
    typeof preset === 'string' &&
    DATE_PRESETS.includes(preset as AnalyticsDatePreset) &&
    setters.setDatePreset
  ) {
    setters.setDatePreset(preset as AnalyticsDatePreset);
  }
};
