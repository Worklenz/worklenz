import { useMemo } from 'react';
import { reconcileLayout, useDashboardLayoutDraft, type DashboardLayoutApi } from '@/components/dashboard-grid';
import {
  fromWireLayout,
  useGetOverviewLayoutQuery,
  useResetOverviewLayoutMutation,
  useSaveOverviewLayoutMutation,
  type OverviewLayout,
  type OverviewWidgetConfig,
  type OverviewWidgetKey,
} from '@/api/reporting/overview-layout.api.service';
import { OVERVIEW_WIDGETS } from './widgets/overview-widgets';

/** chartType values retired when the chart-type picker was unified to bar/stacked/line/donut/number.
 *  A layout saved under the old scheme (or still cached from before this change) is migrated on
 *  load rather than left to render oddly until the next save round-trips it through the backend's
 *  own migration (reporting-overview-layout.service.ts). */
const LEGACY_CHART_TYPES: Record<string, OverviewWidgetConfig['chartType']> = { pie: 'donut', doughnut: 'donut' };

const normalizeConfig = (_type: OverviewWidgetKey, config: unknown): OverviewWidgetConfig | undefined => {
  if (!config || typeof config !== 'object') return undefined;
  const result = { ...(config as OverviewWidgetConfig) };
  if (result.chartType && result.chartType in LEGACY_CHART_TYPES) {
    result.chartType = LEGACY_CHART_TYPES[result.chartType];
  }
  return result;
};

/**
 * Wires the generic dashboard-grid draft/save hook to the Reports > Overview backend
 * (reporting_overview_layouts, one row per team+user). See components/dashboard-grid for the
 * shared engine this and Custom Dashboards both build on.
 */
export const useOverviewLayoutApi = (): DashboardLayoutApi<OverviewWidgetKey, OverviewWidgetConfig> => {
  const query = useGetOverviewLayoutQuery();
  const [saveLayout] = useSaveOverviewLayoutMutation();
  const [resetLayout] = useResetOverviewLayoutMutation();

  const layout = useMemo(
    () =>
      reconcileLayout<OverviewWidgetKey, OverviewWidgetConfig>(fromWireLayout(query.data?.body?.layout ?? null), {
        widgets: OVERVIEW_WIDGETS,
        normalizeConfig,
      }),
    [query.data]
  );

  return useDashboardLayoutDraft<OverviewWidgetKey, OverviewWidgetConfig>(
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
