import type { TFunction } from 'i18next';

import { getIssueTypeLabel } from '@/components/projects/software/issue-type-badge';
import { IssueType } from '@/types/project/softwareIssue.types';
import {
  CustomReportFilter,
  CustomReportGroup,
  CustomReportMetric,
  CustomReportSource,
  CustomReportUnit,
  CustomReportVisibility,
  CustomReportVisualization,
  ICustomReportInput,
  ICustomReportRow,
} from '@/types/project/softwareReports.types';
import { formatDuration, formatPoints } from './report-utils';

interface SourceRules {
  metrics: CustomReportMetric[];
  groups: CustomReportGroup[];
  supportsFilter: boolean;
}

const TASK_GROUPS: CustomReportGroup[] = [
  'assignee',
  'status',
  'epic',
  'priority',
  'type',
  'sprint',
  'release',
];

/** Mirrors the backend rules in custom-reports-controller. */
export const CUSTOM_REPORT_SOURCES: Record<CustomReportSource, SourceRules> = {
  items: { metrics: ['count', 'points', 'cycle', 'blocked'], groups: TASK_GROUPS, supportsFilter: true },
  sprints: { metrics: ['points', 'committed', 'count'], groups: ['sprint'], supportsFilter: false },
  releases: { metrics: ['count', 'points'], groups: ['release'], supportsFilter: false },
  time: { metrics: ['time'], groups: TASK_GROUPS, supportsFilter: true },
};

export const CUSTOM_REPORT_SOURCE_KEYS = Object.keys(CUSTOM_REPORT_SOURCES) as CustomReportSource[];
export const CUSTOM_REPORT_FILTERS: CustomReportFilter[] = ['all', 'active', 'bugs', 'blocked'];
export const CUSTOM_REPORT_VISUALIZATIONS: CustomReportVisualization[] = [
  'bar',
  'line',
  'donut',
  'table',
  'kpi',
];
export const CUSTOM_REPORT_VISIBILITIES: CustomReportVisibility[] = ['project', 'private'];
export const CUSTOM_REPORT_NAME_MAX_LENGTH = 100;

export const DEFAULT_CUSTOM_REPORT: ICustomReportInput = {
  name: '',
  source: 'items',
  metric: 'count',
  group_by: 'assignee',
  filter: 'all',
  visualization: 'bar',
  visibility: 'project',
};

export const getSourceLabel = (t: TFunction, source: CustomReportSource): string =>
  t(`customReportSource.${source}`, { defaultValue: SOURCE_LABELS[source] });

export const getMetricLabel = (
  t: TFunction,
  metric: CustomReportMetric,
  source?: CustomReportSource
): string => {
  if (metric === 'points' && (source === 'sprints' || source === 'releases')) {
    return t('customReportMetric.completedPoints', { defaultValue: 'Completed points' });
  }
  if (metric === 'count' && source === 'sprints') {
    return t('customReportMetric.completedCount', { defaultValue: 'Completed work items' });
  }
  return t(`customReportMetric.${metric}`, { defaultValue: METRIC_LABELS[metric] });
};

export const getGroupLabel = (t: TFunction, group: CustomReportGroup): string =>
  t(`customReportGroup.${group}`, { defaultValue: GROUP_LABELS[group] });

export const getFilterLabel = (t: TFunction, filter: CustomReportFilter): string =>
  t(`customReportFilter.${filter}`, { defaultValue: FILTER_LABELS[filter] });

export const getVisualizationLabel = (t: TFunction, visual: CustomReportVisualization): string =>
  t(`customReportVisual.${visual}`, { defaultValue: VISUALIZATION_LABELS[visual] });

export const getVisibilityLabel = (t: TFunction, visibility: CustomReportVisibility): string =>
  t(`customReportVisibility.${visibility}`, { defaultValue: VISIBILITY_LABELS[visibility] });

/** Display label for a result row, including the localized "none" bucket. */
export const getRowLabel = (
  t: TFunction,
  row: ICustomReportRow,
  group: CustomReportGroup
): string => {
  if (group === 'type' && row.key) return getIssueTypeLabel(row.key as IssueType, t);
  if (row.label) return row.label;
  return t(`customReportNone.${group}`, { defaultValue: NONE_LABELS[group] });
};

export const formatReportValue = (
  t: TFunction,
  value: number | null,
  unit: CustomReportUnit
): string => {
  if (value === null) return '–';
  if (unit === 'days') return formatDuration(t, value);
  if (unit === 'hours') {
    return t('customReportHoursValue', { defaultValue: '{{value}}h', value: formatPoints(value) });
  }
  if (unit === 'points') {
    return t('customReportPointsValue', { defaultValue: '{{value}} pts', value: formatPoints(value) });
  }
  return formatPoints(value);
};

/** Builds a CSV file and starts the download. */
export const downloadReportCsv = (
  fileName: string,
  header: [string, string],
  rows: [string, number][]
) => {
  const lines = [header, ...rows].map(cells => cells.map(toCsvCell).join(','));
  const blob = new Blob([`\uFEFF${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${toFileSlug(fileName)}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
};

/** Quotes a CSV cell and neutralises spreadsheet formula prefixes. */
const toCsvCell = (value: string | number): string => {
  const text = String(value);
  const safeText = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
};

const toFileSlug = (name: string): string =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'report';

const SOURCE_LABELS: Record<CustomReportSource, string> = {
  items: 'Work items',
  sprints: 'Sprints',
  releases: 'Releases',
  time: 'Time logs',
};

const METRIC_LABELS: Record<CustomReportMetric, string> = {
  count: 'Work item count',
  points: 'Story points',
  cycle: 'Cycle time',
  blocked: 'Blocked work items',
  time: 'Time logged',
  committed: 'Committed points',
};

const GROUP_LABELS: Record<CustomReportGroup, string> = {
  assignee: 'Assignee',
  status: 'Status',
  epic: 'Epic',
  priority: 'Priority',
  type: 'Work type',
  sprint: 'Sprint',
  release: 'Release',
};

const FILTER_LABELS: Record<CustomReportFilter, string> = {
  all: 'All work',
  active: 'Active sprint',
  bugs: 'Bugs only',
  blocked: 'Blocked only',
};

const VISUALIZATION_LABELS: Record<CustomReportVisualization, string> = {
  bar: 'Bar chart',
  line: 'Line chart',
  donut: 'Donut chart',
  table: 'Table',
  kpi: 'KPI',
};

const VISIBILITY_LABELS: Record<CustomReportVisibility, string> = {
  project: 'Project',
  private: 'Private',
};

const NONE_LABELS: Record<CustomReportGroup, string> = {
  assignee: 'Unassigned',
  status: 'No status',
  epic: 'No epic',
  priority: 'No priority',
  type: 'Task',
  sprint: 'Backlog',
  release: 'No release',
};
