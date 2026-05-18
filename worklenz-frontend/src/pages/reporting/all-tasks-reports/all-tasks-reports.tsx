import { useEffect, useCallback, useRef, useMemo, useState } from 'react';
import { Button, Card, Checkbox, Dropdown, Flex, Space, Typography } from '@/shared/antd-imports';
import { DownOutlined, ReloadOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { useAuthService } from '@/hooks/useAuth';
import CustomPageHeader from '@/components/reporting/common/CustomPageHeader';
import AllTasksReportsFilters from './components/all-tasks-reports-filters/all-tasks-reports-filters';
import AllTasksReportsTable from './components/all-tasks-reports-table/all-tasks-reports-table';
import AllTasksStatsCards from './components/all-tasks-stats-cards/all-tasks-stats-cards';
import {
  fetchAllTasks,
  fetchAllTasksTeams,
  setIncludeArchived,
  resetAllFilters,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';
import { allTasksReportsApiService } from '@/api/reporting/all-tasks-reports.api.service';

const AllTasksReports = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();
  useDocumentTitle('Reporting - All Tasks');
  const searchDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const authService = useAuthService();
  const currentSession = useMemo(() => authService.getCurrentSession(), [authService]);

  const state = useAppSelector(state => state.allTasksReportsReducer);
  const { total, isLoading, includeArchived, sortField, sortOrder, searchQuery } = state;
  const [isExporting, setIsExporting] = useState(false);

  const handleRefresh = useCallback(() => {
    dispatch(fetchAllTasks());
  }, [dispatch]);

  const handleExport = useCallback(
    async (key: string) => {
      setIsExporting(true);
      try {
        const body = {
          index: 1,
          size: total,
          sortField,
          sortOrder,
          search: searchQuery,
          teams: state.teams.filter(t => t.selected).map(t => t.id),
          projects: state.selectedProjects,
          statuses: state.selectedStatuses,
          priorities: state.selectedPriorities,
          assignees: state.selectedAssignees,
          labels: state.selectedLabels,
          phases: state.selectedPhases,
          clients: state.selectedClients,
          dateField: state.dateFilterField,
          dateFrom: state.dateFrom,
          dateTo: state.dateTo,
          includeArchived: state.includeArchived,
          includeSubtasks: state.includeSubtasks,
          completionStatus: state.completionStatus,
          billable: state.billableFilter,
          groupBy: state.groupBy,
        };

        let blob: Blob;
        const fileName = `All_Tasks_Report_${new Date().toISOString().split('T')[0]}`;

        if (key === 'csv') {
          blob = await allTasksReportsApiService.exportAllTasksToCsv(body);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.csv`;
          a.click();
          window.URL.revokeObjectURL(url);
        } else if (key === 'excel') {
          blob = await allTasksReportsApiService.exportAllTasksToExcel(body);
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${fileName}.xlsx`;
          a.click();
          window.URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error('Export failed:', error);
      } finally {
        setIsExporting(false);
      }
    },
    [state, total, sortField, sortOrder, searchQuery]
  );

  const exportMenuItems = [
    { key: 'csv', label: t('exportToCsv', { defaultValue: 'Export to CSV' }) },
    { key: 'excel', label: t('exportToExcel', { defaultValue: 'Export to Excel' }) },
  ];

  // Fetch teams first, then fetch tasks only after teams are loaded
  // This prevents the race condition where fetchAllTasks fires with an empty
  // teams array (state.teams = []), causing the backend to fall back to the
  // default team instead of querying all teams.
  useEffect(() => {
    dispatch(fetchAllTasksTeams()).then(() => {
      dispatch(fetchAllTasks());
    });
  }, [dispatch, currentSession?.team_id]);

  const handleResetFilters = useCallback(() => {
    dispatch(resetAllFilters());
    // Re-fetch after reset so the table reflects the cleared filter state
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
                onChange={() => {
                  dispatch(setIncludeArchived(!includeArchived));
                  dispatch(fetchAllTasks());
                }}
              >
                <Typography.Text>
                  {t('archivedFilter', { defaultValue: 'Include Archived' })}
                </Typography.Text>
              </Checkbox>
            </Button>

            <Button icon={<ReloadOutlined />} onClick={handleRefresh} loading={isLoading}>
              {t('refreshButton', { defaultValue: 'Refresh' })}
            </Button>

            <Button onClick={handleResetFilters}>
              {t('clearFilters', { defaultValue: 'Clear Filters' })}
            </Button>

            <Dropdown
              menu={{
                items: exportMenuItems,
                onClick: ({ key }) => handleExport(key),
              }}
              disabled={isExporting}
            >
              <Button
                type="primary"
                icon={<DownOutlined />}
                iconPosition="end"
                loading={isExporting}
              >
                {t('exportButton', { defaultValue: 'Export' })}
              </Button>
            </Dropdown>
          </Space>
        }
      />

      <AllTasksStatsCards />

      <Card
        title={
          <Flex
            justify="space-between"
            align="center"
            wrap="wrap"
            gap={24}
            style={{ paddingBlock: 10 }}
          >
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