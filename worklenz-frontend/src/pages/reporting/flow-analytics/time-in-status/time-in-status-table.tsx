import { memo, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  ConfigProvider,
  Empty,
  Flex,
  Pagination,
  Table,
  theme,
} from '@/shared/antd-imports';
import type { TableColumnsType, TableProps } from '@/shared/antd-imports';
import CustomTableTitle from '@/components/CustomTableTitle';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import { PAGE_SIZE_OPTIONS } from '@/shared/constants';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  type TimeInStatusTask,
  type TimeInStatusTaskArgs,
  useGetTimeInStatusTasksQuery,
} from '@/api/reporting/progress-chart.api.service';
import {
  setIndex,
  setPageSize,
  setSelectedAssignees,
  setSelectedProjects,
  setSelectedStatuses,
  setSort,
} from '@/features/reporting/timeInStatus/time-in-status-slice';
import type { TimeInStatusColumnKey } from '@/features/reporting/timeInStatus/time-in-status-slice';
import { useReportOptions } from '../report-shell';
import { useTableMaxHeight } from './use-table-max-height';
import {
  AssigneesCell,
  LastUpdatedCell,
  ProjectNameCell,
  StatusCell,
  TaskKeyCell,
  TaskNameCell,
  TimeInStatusCell,
  TimeOverdueCell,
  useOpenTimeInStatusTask,
} from './time-in-status-cells';

/** Column key -> API sort field. */
const SORT_FIELDS: Partial<Record<TimeInStatusColumnKey, string>> = {
  taskKey: 'task_key',
  name: 'name',
  project: 'project_name',
  status: 'status_name',
  timeInStatus: 'hours_in_status',
  timeOverdue: 'hours_overdue',
  lastUpdated: 'updated_at',
};

const sameIds = (a: string[], b: string[]) => a.length === b.length && a.every((id, i) => id === b[i]);

const TimeInStatusTable = ({ listArgs }: { listArgs: TimeInStatusTaskArgs }) => {
  const { t } = useTranslation('reporting-flow');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();
  const openTask = useOpenTimeInStatusTask();
  const { index, pageSize, field, order, columns: visibility, selectedProjects, selectedStatuses, selectedAssignees, includeArchived } =
    useAppSelector(state => state.timeInStatusReducer);
  const { projects, members, statuses } = useReportOptions(includeArchived);

  const { data, isLoading, isFetching, isError, refetch } = useGetTimeInStatusTasksQuery({
    ...listArgs,
    field,
    order,
    index,
    size: pageSize,
  });
  const tasks = useMemo(() => data?.body?.tasks ?? [], [data]);
  const total = data?.body?.total ?? 0;
  const showSkeleton = isLoading;

  const sortOrderFor = useCallback(
    (key: TimeInStatusColumnKey) =>
      SORT_FIELDS[key] === field ? (order === 'asc' ? ('ascend' as const) : ('descend' as const)) : null,
    [field, order]
  );

  const allColumns: (TableColumnsType<TimeInStatusTask>[number] & { key: TimeInStatusColumnKey })[] = useMemo(
    () => [
      {
        key: 'taskKey',
        title: <CustomTableTitle title={t('tis.taskKey', { defaultValue: 'Key' })} />,
        width: 110,
        sorter: true,
        sortOrder: sortOrderFor('taskKey'),
        render: (_, task) => <TaskKeyCell task={task} />,
      },
      {
        key: 'name',
        title: <CustomTableTitle title={t('tis.task', { defaultValue: 'Task' })} />,
        width: 300,
        sorter: true,
        sortOrder: sortOrderFor('name'),
        render: (_, task) => <TaskNameCell task={task} onOpen={openTask} />,
      },
      {
        key: 'project',
        title: <CustomTableTitle title={t('project', { defaultValue: 'Project' })} />,
        width: 220,
        sorter: true,
        sortOrder: sortOrderFor('project'),
        filters: projects.map(project => ({ text: project.name, value: project.id })),
        filterSearch: true,
        filteredValue: selectedProjects.length ? selectedProjects : null,
        render: (_, task) => <ProjectNameCell task={task} />,
      },
      {
        key: 'status',
        title: <CustomTableTitle title={t('tis.currentStatus', { defaultValue: 'Current status' })} />,
        width: 170,
        sorter: true,
        sortOrder: sortOrderFor('status'),
        filters: statuses.map(status => ({ text: status.name, value: status.name })),
        filterSearch: true,
        filteredValue: selectedStatuses.length ? selectedStatuses : null,
        render: (_, task) => <StatusCell task={task} />,
      },
      {
        key: 'timeInStatus',
        title: <CustomTableTitle title={t('tis.timeInStatus', { defaultValue: 'Time in status' })} />,
        width: 150,
        sorter: true,
        sortOrder: sortOrderFor('timeInStatus'),
        render: (_, task) => <TimeInStatusCell task={task} />,
      },
      {
        key: 'timeOverdue',
        title: <CustomTableTitle title={t('tis.timeOverdue', { defaultValue: 'Time overdue' })} />,
        width: 150,
        sorter: true,
        sortOrder: sortOrderFor('timeOverdue'),
        render: (_, task) => <TimeOverdueCell task={task} />,
      },
      {
        key: 'assignees',
        title: <CustomTableTitle title={t('tis.assignedTo', { defaultValue: 'Assigned to' })} />,
        width: 170,
        filters: members.map(member => ({ text: member.name, value: member.id })),
        filterSearch: true,
        filteredValue: selectedAssignees.length ? selectedAssignees : null,
        render: (_, task) => <AssigneesCell task={task} />,
      },
      {
        key: 'lastUpdated',
        title: <CustomTableTitle title={t('tis.lastUpdated', { defaultValue: 'Last updated' })} />,
        width: 150,
        sorter: true,
        sortOrder: sortOrderFor('lastUpdated'),
        render: (_, task) => <LastUpdatedCell task={task} />,
      },
    ],
    [t, sortOrderFor, openTask, projects, statuses, members, selectedProjects, selectedStatuses, selectedAssignees]
  );

  const visibleColumns = useMemo(() => {
    const visible = allColumns.filter(column => visibility[column.key]);
    return showSkeleton ? toSkeletonColumns(visible) : visible;
  }, [allColumns, visibility, showSkeleton]);

  const skeletonData = useMemo(() => buildSkeletonRows<TimeInStatusTask>(pageSize), [pageSize]);

  const handleTableChange = useCallback<NonNullable<TableProps<TimeInStatusTask>['onChange']>>(
    (_pagination, filters, sorter) => {
      const current = Array.isArray(sorter) ? sorter[0] : sorter;
      const sortField = current?.order ? SORT_FIELDS[current.columnKey as TimeInStatusColumnKey] : undefined;
      if (sortField && current.order) {
        if (sortField !== field || (current.order === 'ascend' ? 'asc' : 'desc') !== order) {
          dispatch(setSort({ field: sortField, order: current.order === 'ascend' ? 'asc' : 'desc' }));
        }
      } else if (field !== 'hours_in_status' || order !== 'desc') {
        dispatch(setSort(null));
      }

      // Hidden columns are absent from `filters`; leave their selections (set in the Filter popover) alone.
      const syncFilter = (key: string, current: string[], apply: (ids: string[]) => void) => {
        if (!(key in filters)) return;
        const next = (filters[key] ?? []).map(String);
        if (!sameIds(next, current)) apply(next);
      };
      syncFilter('project', selectedProjects, ids => dispatch(setSelectedProjects(ids)));
      syncFilter('status', selectedStatuses, ids => dispatch(setSelectedStatuses(ids)));
      syncFilter('assignees', selectedAssignees, ids => dispatch(setSelectedAssignees(ids)));
    },
    [dispatch, field, order, selectedProjects, selectedStatuses, selectedAssignees]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const footerRef = useRef<HTMLDivElement>(null);
  const maxHeight = useTableMaxHeight();
  const [scrollY, setScrollY] = useState<number>(240);

  // The card grows with its rows up to `maxHeight`; the body scrolls beyond that, header and footer stay put.
  useLayoutEffect(() => {
    const header = containerRef.current?.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
    const footer = footerRef.current?.offsetHeight ?? 64;
    setScrollY(Math.max(120, maxHeight - header - footer - 2));
  }, [maxHeight, tasks, isLoading, visibility]);

  const rangeStart = total === 0 ? 0 : (index - 1) * pageSize + 1;
  const rangeEnd = Math.min(index * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const tableTheme = useMemo(() => ({ components: { Table: { cellPaddingBlock: 12, cellPaddingInline: 10 } } }), []);
  const scrollConfig = useMemo(() => ({ x: 'max-content', y: scrollY }), [scrollY]);
  const rowProps = useCallback(() => ({ style: { height: 56 }, className: 'group' }), []);

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('loadFailed', { defaultValue: 'Could not load this report' })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <ConfigProvider theme={tableTheme}>
      <div
        className="flex min-h-0 flex-col overflow-hidden rounded-lg border"
        style={{ maxHeight, borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
      >
        <div ref={containerRef} className="min-h-0 overflow-hidden">
          <Table<TimeInStatusTask>
            showSorterTooltip={false}
            columns={visibleColumns}
            dataSource={showSkeleton ? skeletonData : tasks}
            pagination={false}
            scroll={scrollConfig}
            loading={isFetching && !showSkeleton}
            onChange={handleTableChange}
            rowKey="id"
            onRow={rowProps}
            locale={{
              emptyText: <Empty description={t('noTasks', { defaultValue: 'No tasks found for this selection' })} />,
            }}
          />
        </div>
        <Flex
          ref={footerRef}
          align="center"
          justify="space-between"
          gap={12}
          wrap="wrap"
          className="px-4 py-3"
          style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
        >
          <Flex align="center" gap={8}>
            <label htmlFor="time-in-status-page-size" className="text-xs">
              {t('tis.rowsPerPage', { defaultValue: 'Rows per page:' })}
            </label>
            <select
              id="time-in-status-page-size"
              value={pageSize}
              onChange={event => dispatch(setPageSize(Number(event.target.value)))}
              className="rounded-md border px-2 py-1 text-xs"
              style={{ background: token.colorBgContainer, color: token.colorText, borderColor: token.colorBorder }}
            >
              {PAGE_SIZE_OPTIONS.map(size => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-xs" style={{ color: token.colorTextSecondary }}>
              {t('tis.rangeOfTotal', {
                start: rangeStart,
                end: rangeEnd,
                total,
                defaultValue: '{{start}}-{{end}} of {{total}}',
              })}
            </span>
          </Flex>
          <Flex align="center" gap={8}>
            <Button
              size="small"
              aria-label={t('tis.firstPage', { defaultValue: 'First page' })}
              disabled={index <= 1}
              onClick={() => dispatch(setIndex(1))}
            >
              «
            </Button>
            <Pagination
              current={index}
              pageSize={pageSize}
              total={total}
              showSizeChanger={false}
              onChange={page => dispatch(setIndex(page))}
            />
            <Button
              size="small"
              aria-label={t('tis.lastPage', { defaultValue: 'Last page' })}
              disabled={index >= lastPage}
              onClick={() => dispatch(setIndex(lastPage))}
            >
              »
            </Button>
          </Flex>
        </Flex>
      </div>
    </ConfigProvider>
  );
};

export default memo(TimeInStatusTable);
