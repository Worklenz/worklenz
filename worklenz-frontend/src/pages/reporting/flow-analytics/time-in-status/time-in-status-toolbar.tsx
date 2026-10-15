import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AppstoreOutlined, TableOutlined } from '@ant-design/icons';
import { Button, Dropdown, Flex, Input, Select } from '@/shared/antd-imports';
import { DownOutlined, SearchOutlined } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAuthService } from '@/hooks/useAuth';
import { reportingExportApiService } from '@/api/reporting/reporting-export.api.service';
import type { TimeInStatusGroupBy } from '@/api/reporting/progress-chart.api.service';
import {
  setGroupBy,
  setSearchQuery,
  setViewMode,
} from '@/features/reporting/timeInStatus/time-in-status-slice';
import type { TimeInStatusViewMode } from '@/features/reporting/timeInStatus/time-in-status-slice';
import TimeWiseFilter from '@/components/reporting/time-wise-filter';
import TimeInStatusFilterPanel from './time-in-status-filter-panel';
import TimeInStatusShowFieldsDropdown from './time-in-status-show-fields-dropdown';

// How long to wait after the user stops typing before the list is refetched (ms)
const SEARCH_DEBOUNCE_MS = 500;

const TimeInStatusToolbar = () => {
  const { t } = useTranslation('reporting-flow');
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();
  const state = useAppSelector(s => s.timeInStatusReducer);
  const { viewMode, groupBy, searchQuery } = state;
  const [localSearch, setLocalSearch] = useState(searchQuery);

  // Keep the box in step when the store clears the search (Clear in the filter popover).
  useEffect(() => {
    setLocalSearch(searchQuery);
  }, [searchQuery]);

  useEffect(() => {
    if (localSearch === searchQuery) return;
    const timer = setTimeout(() => dispatch(setSearchQuery(localSearch)), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [localSearch, searchQuery, dispatch]);

  const viewOptions = useMemo(
    () => [
      {
        value: 'table' as TimeInStatusViewMode,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <TableOutlined />
            {t('tis.viewTable', { defaultValue: 'Table' })}
          </span>
        ),
      },
      {
        value: 'grouped' as TimeInStatusViewMode,
        label: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14 }}>
            <AppstoreOutlined />
            {t('tis.viewGrouped', { defaultValue: 'Grouped' })}
          </span>
        ),
      },
    ],
    [t]
  );

  const groupOptions = useMemo(
    () => [
      { value: 'project', label: t('project', { defaultValue: 'Project' }) },
      { value: 'status', label: t('tis.currentStatus', { defaultValue: 'Current status' }) },
      { value: 'assignee', label: t('tis.assignee', { defaultValue: 'Assignee' }) },
    ],
    [t]
  );

  const exportReport = useCallback(
    (detailed: boolean) => {
      const teamName = currentSession?.team_name || 'Team';
      if (detailed) {
        reportingExportApiService.exportTimeInStatus({ detailed: true, team_name: teamName });
        return;
      }
      const isSingleProject = state.selectedProjects.length === 1;
      reportingExportApiService.exportTimeInStatus({
        view: state.viewMode,
        group_by: state.groupBy,
        search: state.searchQuery.trim() || undefined,
        field: state.field,
        order: state.order,
        scope: isSingleProject ? 'project' : 'team',
        projectId: isSingleProject ? state.selectedProjects[0] : undefined,
        projectIds: isSingleProject ? undefined : state.selectedProjects.join(','),
        assigneeIds: state.selectedAssignees.join(','),
        statuses: state.selectedStatuses.join(','),
        includeSubtasks: state.includeSubtasks,
        archived: state.includeArchived,
        columns: Object.entries(state.columns)
          .filter(([, visible]) => visible)
          .map(([key]) => key)
          .join(','),
        team_name: teamName,
      });
    },
    [state, currentSession?.team_name]
  );

  const exportMenuItems = useMemo(
    () => [
      {
        key: 'detailed',
        label: t('tis.detailedReport', { defaultValue: 'Detailed Report' }),
        onClick: () => exportReport(true),
      },
      {
        key: 'filtered',
        label: t('tis.filteredReport', { defaultValue: 'Filtered Report' }),
        onClick: () => exportReport(false),
      },
    ],
    [t, exportReport]
  );

  return (
    <Flex gap={8} wrap="wrap" align="center" justify="space-between">
      <Flex gap={8} wrap="wrap" align="center">
        <PillToggle<TimeInStatusViewMode>
          value={viewMode}
          options={viewOptions}
          onChange={mode => dispatch(setViewMode(mode))}
          style={{ height: 32 }}
          ariaLabel={t('tis.viewMode', { defaultValue: 'View mode' })}
        />
        {viewMode === 'grouped' && (
          <Select
            value={groupBy}
            options={groupOptions}
            onChange={(value: TimeInStatusGroupBy) => dispatch(setGroupBy(value))}
            style={{ width: 170 }}
            popupMatchSelectWidth={false}
            aria-label={t('tis.groupBy', { defaultValue: 'Group by' })}
          />
        )}
      </Flex>
      <Flex gap={8} wrap="wrap" align="center" justify="end">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          value={localSearch}
          onChange={event => setLocalSearch(event.target.value)}
          placeholder={t('tis.searchPlaceholder', { defaultValue: 'Search by task name or key' })}
          aria-label={t('tis.searchLabel', { defaultValue: 'Search tasks' })}
          className="w-[320px] max-w-full"
        />
        <TimeWiseFilter isPrimary />
        <Flex gap={8} align="center">
          <TimeInStatusFilterPanel />
          <Dropdown menu={{ items: exportMenuItems }}>
            <Button icon={<DownOutlined />} iconPosition="end">
              {t('tis.exportButton', { defaultValue: 'Export' })}
            </Button>
          </Dropdown>
          <TimeInStatusShowFieldsDropdown />
        </Flex>
      </Flex>
    </Flex>
  );
};

export default memo(TimeInStatusToolbar);
