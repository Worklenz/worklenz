import { useMemo } from 'react';
import { reconcileLayout, useDashboardLayoutDraft, type DashboardLayoutApi } from '@/components/dashboard-grid';
import {
  useGetOverviewLayoutQuery,
  useResetOverviewLayoutMutation,
  useSaveOverviewLayoutMutation,
  type OverviewLayout,
  type OverviewWidgetKey,
} from '@/api/reporting/overview-layout.api.service';
import { OVERVIEW_WIDGETS } from './widgets/overview-widgets';

/**
 * Wires the generic dashboard-grid draft/save hook to the Reports > Overview backend
 * (reporting_overview_layouts, one row per team+user). See components/dashboard-grid for the
 * shared engine this and Custom Dashboards both build on.
 */
export const useOverviewLayoutApi = (): DashboardLayoutApi<OverviewWidgetKey> => {
  const query = useGetOverviewLayoutQuery();
  const [saveLayout] = useSaveOverviewLayoutMutation();
  const [resetLayout] = useResetOverviewLayoutMutation();

  const layout = useMemo(
    () => reconcileLayout<OverviewWidgetKey>(query.data?.body.layout ?? null, { widgets: OVERVIEW_WIDGETS }),
    [query.data]
  );

  return useDashboardLayoutDraft<OverviewWidgetKey>(
    {
      layout,
      isLoading: query.isLoading,
      save: async (next: OverviewLayout) => {
        await saveLayout(next).unwrap();
      },
      reset: async () => {
        await resetLayout().unwrap();
      },
    },
    'reporting-overview'
  );
};
