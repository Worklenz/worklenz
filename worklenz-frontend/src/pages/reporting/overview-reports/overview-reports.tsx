import { useEffect, useCallback, useMemo, useState } from 'react';
import { Button, Checkbox, Flex, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_overview } from '@/shared/worklenz-analytics-events';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleIncludeArchived } from '@/features/reporting/reporting.slice';
import { DashboardGrid, DashboardToolbar, useUnsavedChangesGuard } from '@/components/dashboard-grid';
import { fetchReportingTeams } from '@/features/reporting/projectReports/project-reports-slice';
import { OverviewDataProvider } from './widgets/OverviewDataContext';
import { descriptionOf, OVERVIEW_WIDGETS, OverviewWidgetByKey, titleOf } from './widgets/overview-widgets';
import { OverviewWidgetFilterSettings } from './widgets/overview-widget-filter-settings';
import {
  DEFAULT_OVERVIEW_DATE_RANGE,
  OverviewDateRangeFilter,
  type OverviewDateRangeValue,
} from './components/overview-date-range-filter';
import { useOverviewLayoutApi } from './useOverviewLayoutApi';
import { InlineSuspenseFallback } from '@/components/suspense-fallback/suspense-fallback';

/**
 * Reports > Overview, as a customisable widget grid (spec: Worklenz/worklenz-business#2558).
 * The default layout reproduces the page as it was before this change: the three stat cards
 * across the top and the teams table below. See components/dashboard-grid for the shared engine.
 */
const OverviewReports = () => {
  const { t } = useTranslation('reporting-overview');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const includeArchivedProjects = useAppSelector(
    state => state.reportingReducer.includeArchivedProjects
  );
  const layout = useOverviewLayoutApi();
  useUnsavedChangesGuard(layout.isDirty, layout.cancel, 'reporting-overview');
  const [dateRange, setDateRange] = useState<OverviewDateRangeValue>(DEFAULT_OVERVIEW_DATE_RANGE);
  const { token } = theme.useToken();

  useDocumentTitle('Reporting - Overview');

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_overview);
    // Needed for the "Teams" filter in the extra stats widgets' per-widget settings popover.
    dispatch(fetchReportingTeams());
  }, [trackMixpanelEvent, dispatch]);

  const handleArchiveToggle = useCallback(() => {
    dispatch(toggleIncludeArchived());
  }, [dispatch]);

  const headerChildren = useMemo(
    () => (
      <Flex gap={12} align="center" wrap="wrap">
        <OverviewDateRangeFilter value={dateRange} onChange={setDateRange} />
        {layout.isEditing && (
          <Button type="text" onClick={handleArchiveToggle}>
            <Checkbox checked={includeArchivedProjects} />
            <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
          </Button>
        )}
        <DashboardToolbar
          layout={layout}
          catalogue={OVERVIEW_WIDGETS}
          titleOf={type => titleOf(type, t)}
          descriptionOf={type => descriptionOf(type, t)}
          i18nNamespace="reporting-overview"
        />
      </Flex>
    ),
    [handleArchiveToggle, includeArchivedProjects, t, layout, dateRange]
  );

  return (
    <Flex vertical gap={24}>
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 10,
          // Negative margins on a sticky element throw off the browser's sticky offset
          // calculation (it can end up stuck at the wrong scroll position instead of flush
          // under the navbar) — isolate makes this its own stacking context instead, so
          // nothing in the grid below can paint over it regardless of z-index quirks there.
          isolation: 'isolate',
          background: token.colorBgContainer,
        }}
      >
        <CustomPageHeader title={t('overviewTitle')} children={headerChildren} style={{ padding: 0 }} />
      </div>

      {layout.isLoading ? (
        <InlineSuspenseFallback />
      ) : (
        <OverviewDataProvider includeArchivedProjects={includeArchivedProjects} dateRange={dateRange.range}>
          <div style={{ position: 'relative', zIndex: 0 }}>
            <DashboardGrid
              layout={layout}
              catalogue={OVERVIEW_WIDGETS}
              titleOf={type => titleOf(type, t)}
              descriptionOf={type => descriptionOf(type, t)}
              mode="singleton"
              i18nNamespace="reporting-overview"
              extraSettingsFor={widget => (
                <OverviewWidgetFilterSettings widget={widget} onChange={patch => layout.updateWidgetConfig(widget.id, patch)} />
              )}
              renderWidget={widget => <OverviewWidgetByKey widgetKey={widget.type} config={widget.config} />}
            />
          </div>
        </OverviewDataProvider>
      )}
    </Flex>
  );
};

export default OverviewReports;
