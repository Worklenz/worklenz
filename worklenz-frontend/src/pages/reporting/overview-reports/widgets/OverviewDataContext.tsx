import React, { createContext, useContext, useMemo } from 'react';
import { IRPTOverviewStatistics } from '@/types/reporting/reporting.types';
import { useOverviewStatistics } from './use-overview-statistics';

type OverviewDateRange = { from: string; to: string } | null | undefined;

interface OverviewDataValue {
  stats: IRPTOverviewStatistics;
  loading: boolean;
  includeArchivedProjects: boolean;
  /** The toolbar's date range filter, for the stats widgets. Not applied to the KPI tiles, which
   *  are current-state snapshots (counts), not windowed metrics. */
  dateRange: OverviewDateRange;
}

const OverviewDataContext = createContext<OverviewDataValue | null>(null);

/**
 * Fetches the Overview statistics payload once per page and shares it with every KPI widget, so
 * showing/hiding widgets never changes how many requests the page makes (all the KPIs come from
 * the same one), and every KPI refreshes together on the same socket events.
 */
export const OverviewDataProvider: React.FC<{
  includeArchivedProjects: boolean;
  dateRange?: OverviewDateRange;
  children: React.ReactNode;
}> = ({ includeArchivedProjects, dateRange, children }) => {
  const { stats, loading } = useOverviewStatistics(includeArchivedProjects);
  const value = useMemo(
    () => ({ stats, loading, includeArchivedProjects, dateRange }),
    [stats, loading, includeArchivedProjects, dateRange]
  );
  return <OverviewDataContext.Provider value={value}>{children}</OverviewDataContext.Provider>;
};

export const useOverviewData = (): OverviewDataValue => {
  const ctx = useContext(OverviewDataContext);
  if (!ctx) throw new Error('useOverviewData must be used within OverviewDataProvider');
  return ctx;
};

/** Like useOverviewData, but null outside the Overview page: the standalone flow report pages
 *  render the same chart widgets and pass their own filters instead. */
export const useOptionalOverviewData = (): OverviewDataValue | null => useContext(OverviewDataContext);
