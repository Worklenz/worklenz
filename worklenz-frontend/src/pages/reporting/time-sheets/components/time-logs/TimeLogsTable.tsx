import React, { useCallback, useMemo } from 'react';
import {
  ConfigProvider,
  Flex,
  Table,
  TableColumnsType,
  TableProps,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import CustomTableTitle from '@/components/CustomTableTitle';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import { formatLoggedDuration } from '@/components/time-entries/time-entries-format';
import { formatCalendarDate } from '@/utils/date-presets';
import {
  TimeLogRow,
  TimeLogSortField,
  TimeLogSortOrder,
  TimeLogsTableView,
  isTaskRow,
} from '@/types/reporting/time-logs.types';
import {
  ELLIPSIS_STYLE,
  EmptyCell,
  MemberCell,
  ProjectNameCell,
  TaskMembersCell,
  TaskNameCell,
  TextCell,
} from './time-logs-cells';
import { ROW_HEIGHT, TABLE_CONFIG, useTableScrollY } from './time-logs-table-config';
import { TimeLogsPaginationBar } from './TimeLogsPaginationBar';
import './time-logs.css';
import { TimeLogsEmptyState, TimeLogsTotalValue } from './time-logs-states';

const { Text } = Typography;

// The total row spans every column but Duration, so its total lands under Duration.
const SUMMARY_LABEL_COLUMNS = 7;
// Column widths in px, like the Projects report table (the table scrolls sideways below their sum).
const COLUMN_WIDTHS = {
  date: 130,
  taskKey: 110,
  task: 240,
  member: 200,
  project: 200,
  client: 180,
  description: 240,
  duration: 130,
} as const;

// Column key -> the field the server sorts by.
const SORT_FIELD_BY_COLUMN: Record<string, TimeLogSortField> = {
  date: 'date',
  taskKey: 'task_key',
  task: 'task',
  member: 'member',
  project: 'project',
  client: 'client',
  duration: 'duration',
};

const SCROLL_X = 'max-content';

interface TimeLogsTableProps {
  logs: TimeLogRow[];
  /** Entries as logged, or one row per task — decides the columns' wording and the Member cell. */
  view: TimeLogsTableView;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** What the pager counts: entries in the flat view, tasks in the By task view. */
  total: number;
  totalSeconds: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  sortField: TimeLogSortField | null;
  sortOrder: TimeLogSortOrder;
  onSortChange: (field: TimeLogSortField) => void;
  /** Offered in the empty state when something is narrowing the result. */
  onClearFilters?: () => void;
  /** Opens a task from its name; without it the task names are plain text. */
  onOpenTask?: (taskId: string, projectId: string) => void;
}

export const TimeLogsTable: React.FC<TimeLogsTableProps> = ({
  logs,
  view,
  loading,
  failed,
  onRetry,
  total,
  totalSeconds,
  page,
  pageSize,
  onPageChange,
  sortField,
  sortOrder,
  onSortChange,
  onClearFilters,
  onOpenTask,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();

  const isTaskView = view === 'task';

  // Only the active sort field shows a sort indicator.
  const sortOrderFor = useCallback(
    (field: TimeLogSortField) =>
      sortField === field ? (sortOrder === 'asc' ? ('ascend' as const) : ('descend' as const)) : null,
    [sortField, sortOrder]
  );

  // Tells assistive tech which column the rows are sorted by, and in which direction.
  const sortHeaderCell = useCallback(
    (field: TimeLogSortField) => () => ({
      'aria-sort':
        sortField === field
          ? sortOrder === 'asc'
            ? ('ascending' as const)
            : ('descending' as const)
          : undefined,
    }),
    [sortField, sortOrder]
  );

  const columns: TableColumnsType<TimeLogRow> = useMemo(
    () => [
      {
        key: 'date',
        // In the By task view a row spans several days, so its date is the latest entry's.
        title: (
          <CustomTableTitle
            title={
              isTaskView
                ? t('timeLogsLastLogged', { defaultValue: 'Last logged' })
                : t('Date', { defaultValue: 'Date' })
            }
          />
        ),
        sorter: true,
        sortOrder: sortOrderFor('date'),
        onHeaderCell: sortHeaderCell('date'),
        width: COLUMN_WIDTHS.date,
        render: (_, record) => formatCalendarDate(record.log_day),
      },
      {
        key: 'taskKey',
        title: <CustomTableTitle title={t('timeLogsTaskId', { defaultValue: 'Task ID' })} />,
        sorter: true,
        sortOrder: sortOrderFor('task_key'),
        onHeaderCell: sortHeaderCell('task_key'),
        width: COLUMN_WIDTHS.taskKey,
        render: (_, record) =>
          record.task_key ? <span style={ELLIPSIS_STYLE}>{record.task_key}</span> : <EmptyCell />,
      },
      {
        key: 'task',
        title: <CustomTableTitle title={t('timeLogsTaskName', { defaultValue: 'Task name' })} />,
        sorter: true,
        sortOrder: sortOrderFor('task'),
        onHeaderCell: sortHeaderCell('task'),
        width: COLUMN_WIDTHS.task,
        ellipsis: { showTitle: false },
        render: (_, record) => (
          <TaskNameCell
            name={record.task_name}
            taskId={record.task_id}
            projectId={record.project_id}
            onOpenTask={onOpenTask}
          />
        ),
      },
      {
        key: 'member',
        title: <CustomTableTitle title={t('Member', { defaultValue: 'Member' })} />,
        sorter: true,
        sortOrder: sortOrderFor('member'),
        onHeaderCell: sortHeaderCell('member'),
        width: COLUMN_WIDTHS.member,
        render: (_, record) =>
          isTaskRow(record) ? (
            <TaskMembersCell members={record.members} />
          ) : (
            <MemberCell
              name={record.user_name}
              avatarUrl={record.avatar_url}
              status={record.member_status}
            />
          ),
      },
      {
        key: 'project',
        title: <CustomTableTitle title={t('Project', { defaultValue: 'Project' })} />,
        sorter: true,
        sortOrder: sortOrderFor('project'),
        onHeaderCell: sortHeaderCell('project'),
        width: COLUMN_WIDTHS.project,
        ellipsis: true,
        render: (_, record) => (
          <ProjectNameCell name={record.project_name} color={record.project_color} />
        ),
      },
      {
        key: 'client',
        title: <CustomTableTitle title={t('timeLogsClient', { defaultValue: 'Client' })} />,
        sorter: true,
        sortOrder: sortOrderFor('client'),
        onHeaderCell: sortHeaderCell('client'),
        width: COLUMN_WIDTHS.client,
        ellipsis: { showTitle: false },
        render: (_, record) => <TextCell value={record.client_name} />,
      },
      {
        key: 'description',
        title: <CustomTableTitle title={t('Description', { defaultValue: 'Description' })} />,
        width: COLUMN_WIDTHS.description,
        ellipsis: { showTitle: false },
        render: (_, record) => <TextCell value={record.description} />,
      },
      {
        key: 'duration',
        title: <CustomTableTitle title={t('Duration', { defaultValue: 'Duration' })} />,
        sorter: true,
        sortOrder: sortOrderFor('duration'),
        onHeaderCell: sortHeaderCell('duration'),
        width: COLUMN_WIDTHS.duration,
        render: (_, record) => formatLoggedDuration(record.time_spent),
      },
    ],
    [sortHeaderCell, sortOrderFor, t, isTaskView, onOpenTask]
  );

  // The first load has no rows yet, so draw placeholder rows instead of an empty state. Later loads
  // (paging, sorting, filtering) keep the current rows under antd's own loading overlay.
  const isFirstLoad = loading && logs.length === 0 && !failed;

  const skeletonData = useMemo(() => buildSkeletonRows<TimeLogRow>(pageSize), [pageSize]);
  const visibleColumns = useMemo(
    () => (isFirstLoad ? toSkeletonColumns(columns) : columns),
    [columns, isFirstLoad]
  );

  const handleTableChange = useCallback<NonNullable<TableProps<TimeLogRow>['onChange']>>(
    (_pagination, _filters, sorter) => {
      const columnKey = (Array.isArray(sorter) ? sorter[0] : sorter)?.columnKey;
      const field = columnKey ? SORT_FIELD_BY_COLUMN[String(columnKey)] : undefined;
      if (field) onSortChange(field);
    },
    [onSortChange]
  );

  const { containerRef, scrollY } = useTableScrollY([logs, loading]);

  const shownTotal = failed ? 0 : total;

  const scrollConfig = useMemo(() => ({ x: SCROLL_X, y: scrollY }), [scrollY]);
  const getRowKey = useCallback((record: TimeLogRow) => record.id, []);
  const rowProps = useMemo(() => ({ style: { height: ROW_HEIGHT }, className: 'group' }), []);
  const getRowProps = useCallback(() => rowProps, [rowProps]);

  const emptyContent = (
    <TimeLogsEmptyState failed={failed} onRetry={onRetry} onClearFilters={onClearFilters} />
  );

  // The total is a summary row pinned to the bottom of the table: it shares the column grid with the
  // data, so "Total" sits under the Duration column and "Entries" under the first column's text, and
  // it stays in view however many rows scroll past. It covers every entry matching the filters — not
  // just this page — so it can be used for an invoice straight away.
  const renderSummary = () => (
    <Table.Summary fixed="bottom">
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={SUMMARY_LABEL_COLUMNS}>
          <Flex justify="space-between" align="center" gap={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isTaskView
                ? t('timeLogsTasksCount', {
                    defaultValue: 'Tasks: {{count}}',
                    count: shownTotal,
                  })
                : t('timeLogsEntriesCount', {
                    defaultValue: 'Entries: {{count}}',
                    count: shownTotal,
                  })}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('timeLogsTotalLabel', { defaultValue: 'Total time logged' })}
            </Text>
          </Flex>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={SUMMARY_LABEL_COLUMNS}>
          <TimeLogsTotalValue totalSeconds={totalSeconds} failed={failed} />
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  return (
    <ConfigProvider {...TABLE_CONFIG}>
      <div
        className="flex min-h-0 flex-col overflow-hidden rounded-lg border"
        style={{
          height: '100%',
          borderColor: token.colorBorderSecondary,
          background: token.colorBgContainer,
        }}
      >
        <div
          ref={containerRef}
          className="time-logs-fill min-h-0 flex-1 overflow-hidden"
          style={{ '--time-logs-body-height': `${scrollY}px` } as React.CSSProperties}
          {...(isFirstLoad
            ? {
                role: 'status',
                'aria-busy': true,
                'aria-label': t('timeLogsLoading', { defaultValue: 'Loading time logs' }),
              }
            : {})}
        >
          <Table<TimeLogRow>
            showSorterTooltip={false}
            columns={visibleColumns}
            dataSource={isFirstLoad ? skeletonData : failed ? [] : logs}
            pagination={false}
            scroll={scrollConfig}
            summary={renderSummary}
            loading={loading && !isFirstLoad}
            onChange={handleTableChange}
            rowKey={getRowKey}
            onRow={getRowProps}
            // While a later response is in flight the overlay spinner is the only thing to show —
            // not a premature "nothing logged" message underneath it.
            locale={{ emptyText: loading ? <div style={{ minHeight: 120 }} /> : emptyContent }}
          />
        </div>
        <TimeLogsPaginationBar
          page={page}
          pageSize={pageSize}
          total={shownTotal}
          onPageChange={onPageChange}
        />
      </div>
    </ConfigProvider>
  );
};
