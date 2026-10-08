import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { reportingTimeLogsApiService } from '@/api/reporting/reporting-time-logs.api.service';
import {
  ITimeLogGroupsRequest,
  ITimeLogsListRequest,
  TimeLogSortField,
  TimeLogSortOrder,
  TimeLogsExportFormat,
  TimeLogsExportMode,
  TimeLogsGroupBy,
  TimeLogsTableView,
} from '@/types/reporting/time-logs.types';
import { TimeLogsFilters } from './components/time-logs/TimeLogsFilters';
import { TimeLogsGroupedList } from './components/time-logs/TimeLogsGroupedList';
import { TimeLogsTable } from './components/time-logs/TimeLogsTable';
import {
  DEFAULT_TIME_LOGS_FILTERS,
  ITimeLogsFilterState,
  areFiltersEqual,
  countActiveFilters,
  formatResolvedRange,
  resolveDateRange,
  toFilterRequest,
} from './components/time-logs/time-logs-filters';
import { useTimeLogGroupsData } from './components/time-logs/useTimeLogGroupsData';
import { useTimeLogsData } from './components/time-logs/useTimeLogsData';
import {
  useMemberFilterOptions,
  useStaticFilterOptions,
} from './components/time-logs/useTimeLogFilterOptions';

const { Title, Text } = Typography;

const DEFAULT_PAGE_SIZE = 20;

// `group_by` and `view` live in the URL (like Projects > Time Entries), so a shared link reproduces
// the same layout. Anything else — an old bookmark, a typo — falls back to the default.
const GROUP_BY_PARAM = 'group_by';
const VIEW_PARAM = 'view';

const parseGroupBy = (value: string | null): TimeLogsGroupBy =>
  value === 'member' || value === 'project' || value === 'client' ? value : 'none';

const parseTableView = (value: string | null): TimeLogsTableView =>
  value === 'task' ? 'task' : 'flat';

const TimeLogsPage: React.FC = () => {
  const { t } = useTranslation('time-report');
  const [searchParams, setSearchParams] = useSearchParams();

  const [filters, setFilters] = useState<ITimeLogsFilterState>(DEFAULT_TIME_LOGS_FILTERS);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sortField, setSortField] = useState<TimeLogSortField | null>(null);
  const [sortOrder, setSortOrder] = useState<TimeLogSortOrder>('desc');
  const [groupBy, setGroupBy] = useState<TimeLogsGroupBy>(() =>
    parseGroupBy(searchParams.get(GROUP_BY_PARAM))
  );
  const [tableView, setTableView] = useState<TimeLogsTableView>(() =>
    parseTableView(searchParams.get(VIEW_PARAM))
  );

  const isGrouped = groupBy !== 'none';

  const { datePreset, customRange } = filters;
  const range = useMemo(
    () => resolveDateRange({ datePreset, customRange }),
    [datePreset, customRange]
  );

  const filterRequest = useMemo(
    () => toFilterRequest(filters, search, range),
    [filters, search, range]
  );

  const request = useMemo<ITimeLogsListRequest>(
    () => ({
      ...filterRequest,
      page,
      page_size: pageSize,
      view: tableView,
      ...(sortField ? { sort_field: sortField, sort_order: sortOrder } : {}),
    }),
    [filterRequest, page, pageSize, tableView, sortField, sortOrder]
  );

  const groupsRequest = useMemo<ITimeLogGroupsRequest | null>(
    () => (isGrouped ? { ...filterRequest, group_by: groupBy, page, page_size: pageSize } : null),
    [isGrouped, filterRequest, groupBy, page, pageSize]
  );

  // Only the view on screen loads: the table (flat or by task) or the grouped list.
  const table = useTimeLogsData(request, !isGrouped);
  const grouped = useTimeLogGroupsData(groupsRequest);
  const { projects, practices, clients } = useStaticFilterOptions();
  const members = useMemberFilterOptions(range, filters.userIds);

  // Keep the layout shareable through the URL.
  useEffect(() => {
    if (
      searchParams.get(GROUP_BY_PARAM) === groupBy &&
      searchParams.get(VIEW_PARAM) === tableView
    ) {
      return;
    }
    setSearchParams(
      prev => {
        const next = new URLSearchParams(prev);
        next.set(GROUP_BY_PARAM, groupBy);
        next.set(VIEW_PARAM, tableView);
        return next;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to the layout, not to the URL
  }, [groupBy, tableView]);

  const handleApplyFilters = useCallback((next: ITimeLogsFilterState) => {
    setFilters(prev => (areFiltersEqual(prev, next) ? prev : next));
    setPage(1);
  }, []);

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    setPage(1);
  }, []);

  const handleSortChange = useCallback(
    (field: TimeLogSortField) => {
      setPage(1);
      setSortOrder(prev => (sortField === field && prev === 'asc' ? 'desc' : 'asc'));
      setSortField(field);
    },
    [sortField]
  );

  // (page, pageSize) matches TablePagination's contract: it resets to page 1 itself when
  // rows-per-page changes.
  const handlePageChange = useCallback((nextPage: number, nextPageSize: number) => {
    setPage(nextPage);
    setPageSize(nextPageSize);
  }, []);

  // A different layout is a different list: start from its first page.
  const handleTableViewChange = useCallback((next: TimeLogsTableView) => {
    setTableView(next);
    setPage(1);
  }, []);

  const handleGroupByChange = useCallback((next: TimeLogsGroupBy) => {
    setGroupBy(next);
    setPage(1);
  }, []);

  const handleClearFilters = useCallback(() => {
    setFilters(DEFAULT_TIME_LOGS_FILTERS);
    setSearch('');
    setPage(1);
  }, []);

  const handleExport = useCallback(
    (mode: TimeLogsExportMode, format: TimeLogsExportFormat) => {
      // "Filtered" exports the screen as it is — all of it, not just the page on screen: the groups
      // when grouped, otherwise the entries or tasks in the table's view and sort.
      reportingTimeLogsApiService.exportTimeLogs({
        format,
        mode,
        filters: filterRequest,
        groupBy: groupsRequest?.group_by,
        sortField: isGrouped ? undefined : (sortField ?? undefined),
        sortOrder: !isGrouped && sortField ? sortOrder : undefined,
        view: isGrouped ? undefined : tableView,
      });
    },
    [filterRequest, groupsRequest, isGrouped, sortField, sortOrder, tableView]
  );

  const canClearFilters = countActiveFilters(filters) > 0 || search.trim().length > 0;
  const rangeLabel =
    formatResolvedRange(range) ?? t('timeLogsPresetAllTime', { defaultValue: 'All Time' });

  return (
    // Fills the Reports content pane exactly (ReportingLayout gives it a definite height via
    // flex-stretch) as a flex column, like Home > My Tasks: the title and the controls row are
    // fixed-height (flexShrink: 0) and the table region is the one flexible area (flex: 1,
    // minHeight: 0). The table card inside it shrinks to fit its rows and is capped at that
    // region's height, scrolling its own rows — so the page itself never scrolls, not even when
    // "rows per page" is raised.
    <div style={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Flex align="baseline" wrap="wrap" gap={12} style={{ marginBottom: 16, flexShrink: 0 }}>
        <Title level={4} style={{ margin: 0 }}>
          {t('Time Logs', { defaultValue: 'Time Logs' })}
        </Title>
        <Text type="secondary" style={{ fontSize: 13 }}>
          {rangeLabel}
        </Text>
      </Flex>

      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <TimeLogsFilters
          search={search}
          onSearch={handleSearch}
          filters={filters}
          onApplyFilters={handleApplyFilters}
          projects={projects}
          practices={practices}
          clients={clients}
          members={members}
          tableView={tableView}
          onTableViewChange={handleTableViewChange}
          groupBy={groupBy}
          onGroupByChange={handleGroupByChange}
          onExport={handleExport}
        />
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0 }}>
        {groupsRequest ? (
          <TimeLogsGroupedList
            groups={grouped.groups}
            groupBy={groupsRequest.group_by}
            filterRequest={filterRequest}
            loading={grouped.loading}
            failed={grouped.failed}
            onRetry={grouped.reload}
            totalGroups={grouped.totalGroups}
            totalEntries={grouped.totalEntries}
            totalSeconds={grouped.totalSeconds}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            onClearFilters={canClearFilters ? handleClearFilters : undefined}
          />
        ) : (
          <TimeLogsTable
            logs={table.logs}
            view={tableView}
            loading={table.loading}
            failed={table.failed}
            onRetry={table.reload}
            total={table.total}
            totalSeconds={table.totalSeconds}
            page={page}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            sortField={sortField}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
            onClearFilters={canClearFilters ? handleClearFilters : undefined}
          />
        )}
      </div>
    </div>
  );
};

export default TimeLogsPage;
