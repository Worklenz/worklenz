import { useEffect } from 'react';
import { Button, Card, Checkbox, Flex, Typography } from 'antd';
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

  const handleArchiveToggle = () => {
    dispatch(toggleIncludeArchived());
  };

  return (
    <Flex vertical gap={24}>
      <CustomPageHeader
        title={t('overviewTitle')}
        children={
          <Button type="text" onClick={handleArchiveToggle}>
            <Checkbox checked={includeArchivedProjects} />
            <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
          </Button>
        }
      />

      <OverviewStats />

      <Card>
        <Flex vertical gap={12}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            {t('teamsText')}
          </Typography.Text>
          <OverviewReportsTable />
        </Flex>
      </Card>
    </Flex>
  );
};

export default OverviewReports;
