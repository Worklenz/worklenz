import dayjs from 'dayjs';
import {
  REPORTING_DATE_PRESET_LABELS,
  type ReportingDatePreset,
  resolveReportingDateRange,
  formatResolvedRange,
} from '@/utils/date-presets';

export interface AnalyticsPdfFilterDetailsInput {
  datePreset?: ReportingDatePreset | string | null;
  customRange?: [string, string] | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  selectedProjectIds?: string[];
  projectOptionsCount?: number;
  selectedTeamIds?: string[];
  selectedMemberIds?: string[];
  selectedHealthIds?: string[];
  selectedStatusIds?: string[];
  /** When true, projects are treated as live/all (team-scoped reports). */
  forceLiveProjectScope?: boolean;
}

function formatPresetLabel(preset: string): string {
  const known = REPORTING_DATE_PRESET_LABELS[preset as ReportingDatePreset];
  if (known) return known.defaultValue;
  return preset.replace(/_/g, ' ');
}

function formatTimeRange(input: AnalyticsPdfFilterDetailsInput): string | null {
  const preset = input.datePreset || null;
  if (!preset) {
    if (input.dateFrom || input.dateTo) {
      const from = input.dateFrom ? dayjs(input.dateFrom).format('D MMM YYYY') : '';
      const to = input.dateTo ? dayjs(input.dateTo).format('D MMM YYYY') : '';
      if (from && to) return from === to ? from : `${from} – ${to}`;
      return from || to || null;
    }
    return null;
  }

  if (preset === 'all_time') return 'All time';

  const range =
    preset === 'custom' && input.customRange
      ? { from: input.customRange[0], to: input.customRange[1] }
      : resolveReportingDateRange({
          datePreset: preset as ReportingDatePreset,
          customRange: input.customRange ?? null,
        });

  const rangeLabel =
    formatResolvedRange(range) ||
    (input.dateFrom && input.dateTo
      ? `${dayjs(input.dateFrom).format('D MMM YYYY')} – ${dayjs(input.dateTo).format('D MMM YYYY')}`
      : null);

  const presetLabel = formatPresetLabel(preset);
  if (preset !== 'custom' && rangeLabel) return `${presetLabel} (${rangeLabel})`;
  if (rangeLabel) return rangeLabel;
  return presetLabel;
}

/**
 * Compact filter summary for manual analytics PDF headers.
 * Example: "Time range: Last 3 Months (1 Aug 2026 – 20 Nov 2026) · Projects: All · Teams: 1 selected"
 */
export function buildAnalyticsPdfFilterDetails(
  input: AnalyticsPdfFilterDetailsInput
): string | null {
  const parts: string[] = [];

  const timeRange = formatTimeRange(input);
  if (timeRange) parts.push(`Time range: ${timeRange}`);

  const selectedProjects = (input.selectedProjectIds || []).filter(Boolean);
  const projectOptionsCount = input.projectOptionsCount ?? 0;
  const isSelectAll =
    input.forceLiveProjectScope ||
    selectedProjects.length === 0 ||
    (projectOptionsCount > 0 && selectedProjects.length >= projectOptionsCount);

  if (isSelectAll) {
    parts.push('Projects: All');
  } else {
    parts.push(`Projects: ${selectedProjects.length} selected`);
  }

  const teamCount = (input.selectedTeamIds || []).filter(Boolean).length;
  if (teamCount > 0) parts.push(`Teams: ${teamCount} selected`);

  const memberCount = (input.selectedMemberIds || []).filter(Boolean).length;
  if (memberCount > 0) parts.push(`Members: ${memberCount} selected`);

  const healthCount = (input.selectedHealthIds || []).filter(Boolean).length;
  if (healthCount > 0) parts.push(`Health: ${healthCount} selected`);

  const statusCount = (input.selectedStatusIds || []).filter(Boolean).length;
  if (statusCount > 0) parts.push(`Status: ${statusCount} selected`);

  return parts.length ? parts.join(' · ') : null;
}
