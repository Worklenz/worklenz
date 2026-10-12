import React, { createContext, useContext, useMemo } from 'react';
import { IRPTOverviewStatistics } from '@/types/reporting/reporting.types';
import { useOverviewStatistics } from './use-overview-statistics';

interface OverviewDataValue {
  stats: IRPTOverviewStatistics;
  loading: boolean;
  includeArchivedProjects: boolean;
}

const OverviewDataContext = createContext<OverviewDataValue | null>(null);

/**
 * Fetches the Overview statistics payload once per page and shares it with every KPI widget, so
 * showing/hiding widgets never changes how many requests the page makes (all the KPIs come from
 * the same one), and every KPI refreshes together on the same socket events.
 */
export const OverviewDataProvider: React.FC<{ includeArchivedProjects: boolean; children: React.ReactNode }> = ({
  includeArchivedProjects,
  children,
}) => {
  const { stats, loading } = useOverviewStatistics(includeArchivedProjects);
  const value = useMemo(() => ({ stats, loading, includeArchivedProjects }), [stats, loading, includeArchivedProjects]);
  return <OverviewDataContext.Provider value={value}>{children}</OverviewDataContext.Provider>;
};

export const useOverviewData = (): OverviewDataValue => {
  const ctx = useContext(OverviewDataContext);
  if (!ctx) throw new Error('useOverviewData must be used within OverviewDataProvider');
  return ctx;
};
