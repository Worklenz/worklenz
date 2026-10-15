import { memo, useCallback, useEffect, useState } from 'react';
import { Button, Dropdown, Flex, Input } from '@/shared/antd-imports';
import { DownOutlined, SearchOutlined } from '@/shared/antd-imports';
import AllTasksFilterPanel from './all-tasks-filter-panel';
import AllTasksShowFieldsDropdown from './all-tasks-show-fields-dropdown';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import {
  fetchAllTasks,
  setSearchQuery,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';
import { allTasksReportsApiService } from '@/api/reporting/all-tasks-reports.api.service';

// How long to wait after the user stops typing before firing the API call (ms)
const SEARCH_DEBOUNCE_MS = 500;

const AllTasksReportsFilters = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('reporting-all-tasks');
  const state = useAppSelector(state => state.allTasksReportsReducer);
  const { searchQuery, total, sortField, sortOrder } = state;
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const [isExporting, setIsExporting] = useState(false);

  // Debounce the Redux dispatch so the API only fires after the user stops typing
  useEffect(() => {
    if (localSearch === searchQuery) return;
    const timer = setTimeout(() => {
      dispatch(setSearchQuery(localSearch));
      dispatch(fetchAllTasks());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, dispatch]);

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
          teams: state.teams.filter(team => team.selected).map(team => team.id),
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

        const fileName = `All_Tasks_Report_${new Date().toISOString().split('T')[0]}`;
        const isCsv = key === 'csv';
        const blob = isCsv
          ? await allTasksReportsApiService.exportAllTasksToCsv(body)
          : await allTasksReportsApiService.exportAllTasksToExcel(body);
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${fileName}.${isCsv ? 'csv' : 'xlsx'}`;
        a.click();
        window.URL.revokeObjectURL(url);
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

  return (
    <Flex gap={8} wrap="wrap" align="center" justify="end">
      <Input
        allowClear
        prefix={<SearchOutlined />}
        value={localSearch}
        onChange={event => setLocalSearch(event.target.value)}
        placeholder={t('searchPlaceholder', {
          defaultValue: 'Search by task name, key, or description',
        })}
        aria-label={t('searchLabel', { defaultValue: 'Search tasks' })}
        className="w-[320px] max-w-full"
      />
      <Flex gap={8} align="center">
        <AllTasksFilterPanel />
        <Dropdown
          menu={{ items: exportMenuItems, onClick: ({ key }) => handleExport(key) }}
          disabled={isExporting}
        >
          <Button icon={<DownOutlined />} iconPosition="end" loading={isExporting}>
            {t('exportButton', { defaultValue: 'Export' })}
          </Button>
        </Dropdown>
        <AllTasksShowFieldsDropdown />
      </Flex>
    </Flex>
  );
};

export default memo(AllTasksReportsFilters);
