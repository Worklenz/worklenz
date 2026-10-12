import { useEffect, useCallback, useMemo } from 'react';
import { Button, Checkbox, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_overview } from '@/shared/worklenz-analytics-events';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleIncludeArchived } from '@/features/reporting/reporting.slice';
import { DashboardGrid, DashboardToolbar, useUnsavedChangesGuard } from '@/components/dashboard-grid';
import { OverviewDataProvider } from './widgets/OverviewDataContext';
import { OVERVIEW_WIDGETS, OverviewWidgetByKey, titleOf } from './widgets/overview-widgets';
import { useOverviewLayoutApi } from './useOverviewLayoutApi';

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

  useDocumentTitle('Reporting - Overview');

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_overview);
  }, [trackMixpanelEvent]);

  const handleArchiveToggle = useCallback(() => {
    dispatch(toggleIncludeArchived());
  }, [dispatch]);

  const headerChildren = useMemo(
    () => (
      <Flex gap={12} align="center" wrap="wrap">
        <Button type="text" onClick={handleArchiveToggle}>
          <Checkbox checked={includeArchivedProjects} />
          <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
        </Button>
        <DashboardToolbar layout={layout} catalogue={OVERVIEW_WIDGETS} titleOf={type => titleOf(type, t)} i18nNamespace="reporting-overview" />
      </Flex>
    ),
    [handleArchiveToggle, includeArchivedProjects, t, layout]
  );

  return (
    <Flex vertical gap={24}>
      <CustomPageHeader title={t('overviewTitle')} children={headerChildren} style={{ padding: 0 }} />

      <OverviewDataProvider includeArchivedProjects={includeArchivedProjects}>
        <DashboardGrid
          layout={layout}
          catalogue={OVERVIEW_WIDGETS}
          titleOf={type => titleOf(type, t)}
          mode="singleton"
          i18nNamespace="reporting-overview"
          renderWidget={widget => <OverviewWidgetByKey widgetKey={widget.type} />}
        />
      </OverviewDataProvider>
    </Flex>
  );
};

export default OverviewReports;
