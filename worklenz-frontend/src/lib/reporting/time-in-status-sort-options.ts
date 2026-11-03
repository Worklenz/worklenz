import type { FilterOption } from '@/components/common/filters/MultiSelectFilterPill';
import type {
  TimeInStatusSort,
  TimeInStatusViewMode,
} from '@/types/reporting/analytics-time-in-status.types';

export interface TimeInStatusSortLabels {
  avgDesc: string;
  avgAsc: string;
  medianDesc: string;
  countDesc: string;
  statusName: string;
  totalDesc: string;
  totalAsc: string;
  taskKey: string;
  taskName: string;
}

/**
 * Server-side sort options for Time in Status.
 * Per-issue responses are capped (default 100); changing sort is how users
 * retrieve rows outside the fixed first page of the default sort.
 */
export const getTimeInStatusSortOptions = (
  viewMode: TimeInStatusViewMode,
  labels: TimeInStatusSortLabels
): Array<FilterOption & { value: TimeInStatusSort }> =>
  viewMode === 'aggregate'
    ? [
        { value: 'avg_desc', label: labels.avgDesc },
        { value: 'avg_asc', label: labels.avgAsc },
        { value: 'median_desc', label: labels.medianDesc },
        { value: 'count_desc', label: labels.countDesc },
        { value: 'name_asc', label: labels.statusName },
      ]
    : [
        { value: 'total_desc', label: labels.totalDesc },
        { value: 'total_asc', label: labels.totalAsc },
        { value: 'key_asc', label: labels.taskKey },
        { value: 'name_asc', label: labels.taskName },
      ];
