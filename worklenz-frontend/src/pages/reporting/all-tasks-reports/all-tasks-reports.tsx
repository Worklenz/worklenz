import { useEffect, useCallback, useRef } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined, ReloadOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import AllTasksReportsFilters from './all-tasks-reports-filters/all-tasks-reports-filters';
import AllTasksReportsTable from './all-tasks-reports-table/all-tasks-reports-table';
import AllTasksStatsCards from './all-tasks-stats-cards/all-tasks-stats-cards';
import {
  fetchAllTasks,
  fetchAllTasksTeams,
  setIncludeArchived,
  resetAllFilters,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const AllTasksReports = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - All Tasks');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const { total, isLoading, includeArchived } = useAppSelector(
    state => state.allTasksReportsReducer
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchAllTasks());
  }, [dispatch]);

  const handleExport = useCallback((key: string) => {
    // TODO: Implement export functionality
    console.log('Export:', key);
  }, []);

  const exportMenuItems = [
    { key: 'csv', label: t('exportToCsv', { defaultValue: 'Export to CSV' }) },
    { key: 'excel', label: t('exportToExcel', { defaultValue: 'Export to Excel' }) },
  ];

  useEffect(() => {
    dispatch(fetchAllTasksTeams());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchAllTasks());
  }, [dispatch]);

  return (
    <Flex vertical gap={24}>
      <CustomPageHeader
        title={`${t('pageTitle', { defaultValue: 'All Tasks' })} (${total})`}
        children={
          <Space>
            <Button>
              <Checkbox
                checked={includeArchived}
                onChange={() => dispatch(setIncludeArchived(!includeArchived))}
              >
                <Typography.Text>{t('archivedFilter', { defaultValue: 'Include Archived' })}</Typography.Text>
              </Checkbox>
            </Button>

            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
              {t('refreshButton', { defaultValue: 'Refresh' })}
            </Button>

            <Button onClick={() => dispatch(resetAllFilters())}>{t('clearFilters', { defaultValue: 'Clear Filters' })}</Button>

            <Dropdown
              menu={{
                items: exportMenuItems,
                onClick: ({ key }) => handleExport(key),
              }}
            >
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('exportButton', { defaultValue: 'Export' })}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <AllTasksStatsCards />

      <Card
        title={
          <Flex justify="space-between" align="center" wrap="wrap" gap={24} style={{ paddingBlock: 10 }}>
            <AllTasksReportsFilters />
          </Flex>
        }
      >
        <AllTasksReportsTable />
      </Card>
    </Flex>
  );
};

export default AllTasksReports;
