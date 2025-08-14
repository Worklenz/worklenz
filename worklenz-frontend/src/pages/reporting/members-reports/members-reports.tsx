import { Button, Card, Checkbox, Dropdown, Flex, Skeleton, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined } from '@/shared/antd-imports';
import MembersReportsTable from './members-reports-table/members-reports-table';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import CustomSearchbar from '@components/CustomSearchbar';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import CustomPageHeader from '../page-header/custom-page-header';
import {
  fetchMembersData,
  setArchived,
  setDuration,
  setDateRange,
  setSearchQuery,
} from '@/features/reporting/membersReports/membersReportsSlice';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import { useEffect } from 'react';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_reporting_allocation } from '@/shared/worklenz-analytics-events';

const MembersReports = () => {
  const { t } = useTranslation('reporting-members');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - Members');
  const currentSession = useAuthService().getCurrentSession();
  const { trackMixpanelEvent } = useMixpanelTracking();

  const { archived, searchQuery, total } = useAppSelector(state => state.membersReportsReducer);
  const { duration, dateRange } = useAppSelector(state => state.reportingReducer);

  const handleExport = () => {
    if (!currentSession?.team_name) return;
    reportingExportApiService.exportMembers(
      currentSession.team_name,
      duration,
      dateRange,
      archived
    );
  };

  useEffect(() => {
    trackMixpanelEvent(evt_reporting_allocation);
  }, [trackMixpanelEvent]);

  useEffect(() => {
    dispatch(setDuration(duration));
    dispatch(setDateRange(dateRange));
  }, [dateRange, duration]);

  return (
    <Flex vertical>
      <CustomPageHeader
        title={`Members (${total})`}
        children={
          <Space>
            <Button>
              <Checkbox checked={archived} onChange={() => dispatch(setArchived(!archived))}>
                <Typography.Text>{t('includeArchivedButton')}</Typography.Text>
              </Checkbox>
            </Button>

            <TimeWiseFilter />

            <Dropdown
              menu={{ items: [{ key: '1', label: t('excelButton') }], onClick: handleExport }}
            >
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('exportButton')}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <Card
        title={
          <Flex justify="flex-end">
            <CustomSearchbar
              placeholderText={t('searchByNameInputPlaceholder')}
              searchQuery={searchQuery}
              setSearchQuery={query => dispatch(setSearchQuery(query))}
            />
          </Flex>
        }
      >
        <MembersReportsTable />
      </Card>
    </Flex>
  );
};

export default MembersReports;
