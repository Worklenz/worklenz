import { useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import type { GetFlowArgs, TimeInStatusTaskArgs } from '@/api/reporting/progress-chart.api.service';
import { buildFlowArgs, type ReportDateRange } from '../report-shell';

/** Query args shared by the chart, table and grouped view. */
export const useTimeInStatusArgs = (dateRange: ReportDateRange) => {
  const { selectedProjects, selectedAssignees, selectedStatuses, includeSubtasks, includeArchived, searchQuery } =
    useAppSelector(state => state.timeInStatusReducer);

  const flowArgs = useMemo<GetFlowArgs>(
    () => buildFlowArgs({ selectedProjects, selectedAssignees, includeSubtasks, includeArchived }, dateRange),
    [selectedProjects, selectedAssignees, includeSubtasks, includeArchived, dateRange]
  );

  const listArgs = useMemo<TimeInStatusTaskArgs>(
    () => ({ ...flowArgs, search: searchQuery.trim() || undefined, statuses: selectedStatuses }),
    [flowArgs, selectedStatuses, searchQuery]
  );

  return { flowArgs, listArgs };
};
