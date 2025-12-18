import { useEffect, useCallback, useRef } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Space, Typography, Input } from '@/shared/antd-imports';
import { DownOutlined, ReloadOutlined, SearchOutlined } from '@/shared/antd-imports';
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
  setSearchQuery,
  setIncludeArchived,
  resetAllFilters,
  setIndex,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';

const SEARCH_DEBOUNCE_MS = 400;

const AllTasksReports = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - All Tasks');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);

  const { total, isLoading, includeArchived, searchQuery } = useAppSelector(
    state => state.allTasksReportsReducer
  );

  const handleRefresh = useCallback(() => {
    dispatch(fetchAllTasks());
  }, [dispatch]);

  const handleSearch = useCallback((value: string) => {
    dispatch(setSearchQuery(value));
    
    // Clear previous debounce timer
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    
    // Debounce the API call
    searchDebounceRef.current = setTimeout(() => {
      dispatch(setIndex(1)); // Reset to first page on search
      dispatch(fetchAllTasks());
    }, SEARCH_DEBOUNCE_MS);
  }, [dispatch]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  const handleExport = useCallback((key: string) => {
    // TODO: Implement export functionality
    console.log('Export:', key);
  }, []);

  const exportMenuItems = [
    { key: 'csv', label: t('exportToCsv') },
    { key: 'excel', label: t('exportToExcel') },
  ];

  useEffect(() => {
    dispatch(fetchAllTasksTeams());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchAllTasks());
  }, [dispatch]);

  return (
    <Flex vertical gap={16}>
      <CustomPageHeader
        title={`${t('pageTitle')} (${total})`}
        children={
          <Space>
            <Button>
              <Checkbox
                checked={includeArchived}
                onChange={() => dispatch(setIncludeArchived(!includeArchived))}
              >
                <Typography.Text>{t('archivedFilter')}</Typography.Text>
              </Checkbox>
            </Button>

            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
              {t('refreshButton')}
            </Button>

            <Button onClick={() => dispatch(resetAllFilters())}>{t('clearFilters')}</Button>

            <Dropdown
              menu={{
                items: exportMenuItems,
                onClick: ({ key }) => handleExport(key),
              }}
            >
              <Button type="primary" icon={<DownOutlined />} iconPosition="end">
                {t('exportButton')}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <AllTasksStatsCards />

      <Card
        title={
          <Flex justify="space-between" align="center" wrap="wrap" gap={16}>
            <AllTasksReportsFilters />
            <Input
              placeholder={t('searchPlaceholder')}
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              prefix={<SearchOutlined style={{ color: 'var(--ant-color-text-tertiary)' }} />}
              allowClear
              style={{ width: 220 }}
            />
          </Flex>
        }
      >
        <AllTasksReportsTable />
      </Card>
    </Flex>
  );
};

export default AllTasksReports;
