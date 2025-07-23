import { useEffect, useCallback, useMemo } from 'react';
import { Button, Card, Checkbox, Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_overview } from '@/shared/worklenz-analytics-events';
import CustomPageHeader from '@/pages/reporting/page-header/custom-page-header';
import OverviewReportsTable from './overview-table/overview-reports-table';
import OverviewStats from './overview-stats';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { toggleIncludeArchived } from '@/features/reporting/reporting.slice';

const OverviewReports = () => {
  const { t } = useTranslation('reporting-overview');
  const dispatch = useAppDispatch();
  const { trackMixpanelEvent } = useMixpanelTracking();
  const includeArchivedProjects = useAppSelector(
    state => state.reportingReducer.includeArchivedProjects
  );

  useDocumentTitle('Reporting - Overview');

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_overview);
  }, [trackMixpanelEvent]);

  const handleArchiveToggle = useCallback(() => {
    dispatch(toggleIncludeArchived());
  }, [dispatch]);

  // Memoize the header children to prevent unnecessary re-renders
  const headerChildren = useMemo(
    () => (
      <Button type="text" onClick={handleArchiveToggle}>
        <Checkbox checked={includeArchivedProjects} />
        <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
      </Button>
    ),
    [handleArchiveToggle, includeArchivedProjects, t]
  );

  // Memoize the teams text to prevent unnecessary re-renders
  const teamsText = useMemo(
    () => (
      <Typography.Text strong style={{ fontSize: 16 }}>
        {t('teamsText')}
      </Typography.Text>
    ),
    [t]
  );

  return (
    <Flex vertical gap={24}>
      <CustomPageHeader title={t('overviewTitle')} children={headerChildren} />

      <OverviewStats />

      <Card>
        <Flex vertical gap={12}>
          {teamsText}
          <OverviewReportsTable />
        </Flex>
      </Card>
    </Flex>
  );
};

export default OverviewReports;
