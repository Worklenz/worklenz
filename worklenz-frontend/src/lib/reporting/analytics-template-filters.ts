import type { AnalyticsDatePreset } from '@/components/reporting/analytics';
import {
  REPORTING_DATE_PRESETS,
  type ReportingCustomRange,
} from '@/utils/date-presets';

export interface CommonAnalyticsTemplateFilterSetters {
  setSelectedProjectIds?: (ids: string[]) => void;
  setSelectedMemberIds?: (ids: string[]) => void;
  setSelectedTeamIds?: (ids: string[]) => void;
  setSelectedStatusIds?: (ids: string[]) => void;
  setSelectedHealthIds?: (ids: string[]) => void;
  setDatePreset?: (preset: AnalyticsDatePreset) => void;
  setCustomRange?: (range: ReportingCustomRange) => void;
  setDateFilter?: (preset: AnalyticsDatePreset, customRange: ReportingCustomRange) => void;
}

const isCalendarDate = (date: string): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(date));

const parseCustomRange = (value: unknown): ReportingCustomRange | undefined => {
  if (value === null) return null;
  if (!Array.isArray(value) || value.length !== 2) return undefined;
  if (!value.every((item): item is string => typeof item === 'string' && isCalendarDate(item))) {
    return undefined;
  }
  if (value[0] > value[1]) return undefined;
  return [value[0], value[1]];
};

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
  const customRange = parseCustomRange(filters.custom_range ?? filters.customRange);
  const hasValidPreset =
    typeof preset === 'string' && REPORTING_DATE_PRESETS.includes(preset as AnalyticsDatePreset);

  if (hasValidPreset) {
    const nextPreset = preset as AnalyticsDatePreset;
    const nextRange = nextPreset === 'custom' ? (customRange ?? null) : null;
    if (setters.setDateFilter) {
      setters.setDateFilter(nextPreset, nextRange);
    } else {
      if (setters.setDatePreset) setters.setDatePreset(nextPreset);
      if (setters.setCustomRange) setters.setCustomRange(nextRange);
    }
  }
};
