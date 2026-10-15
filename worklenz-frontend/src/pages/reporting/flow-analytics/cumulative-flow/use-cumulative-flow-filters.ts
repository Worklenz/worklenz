import { useCallback, useMemo, useState } from 'react';
import type { GetFlowArgs } from '@/api/reporting/progress-chart.api.service';
import { buildFlowArgs, type ReportDateRange } from '../report-shell';

export interface CumulativeFlowFilters {
  selectedProjects: string[];
  /** Stage (band) ids drawn on the chart; empty draws every stage. */
  selectedStages: string[];
  selectedAssignees: string[];
  includeSubtasks: boolean;
  includeArchived: boolean;
}

const INITIAL_FILTERS: CumulativeFlowFilters = {
  selectedProjects: [],
  selectedStages: [],
  selectedAssignees: [],
  includeSubtasks: false,
  includeArchived: false,
};

/** Filter state of the Cumulative Flow page and the query args built from it. */
export const useCumulativeFlowFilters = (dateRange: ReportDateRange) => {
  const [filters, setFilters] = useState<CumulativeFlowFilters>(INITIAL_FILTERS);

  const updateFilters = useCallback(
    (patch: Partial<CumulativeFlowFilters>) => setFilters(previous => ({ ...previous, ...patch })),
    []
  );
  const resetFilters = useCallback(() => setFilters(INITIAL_FILTERS), []);

  const { selectedProjects, selectedAssignees, includeSubtasks, includeArchived } = filters;
  const flowArgs = useMemo<GetFlowArgs>(
    () => buildFlowArgs({ selectedProjects, selectedAssignees, includeSubtasks, includeArchived }, dateRange),
    [selectedProjects, selectedAssignees, includeSubtasks, includeArchived, dateRange]
  );

  return { filters, updateFilters, resetFilters, flowArgs };
};
