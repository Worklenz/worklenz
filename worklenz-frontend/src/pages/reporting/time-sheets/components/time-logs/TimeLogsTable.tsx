import React, { useCallback, useMemo } from 'react';
import { Flex, Skeleton, Table, TableProps, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import TablePagination from '@/components/TablePagination';
import { SortArrows } from '@/components/common/SortArrows';
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
  TaskMembersCell,
  TextCell,
} from './time-logs-cells';
import { TimeLogsEmptyState, TimeLogsTotalValue } from './time-logs-states';
import { useScrollbarGutter } from './useScrollbarGutter';
import './time-logs.css';

const { Text } = Typography;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
// Horizontal padding of a table cell — see time-logs.css (`padding: 4px 8px`). The pagination bar
// below uses the same inset so its text lines up with the data.
const CELL_PADDING = 8;
// The total row spans every column but Duration, so its total lands under Duration.
const SUMMARY_LABEL_COLUMNS = 7;
// Skeleton rows shown on the very first load (capped: a 100-row page is not worth drawing 100).
const MAX_SKELETON_ROWS = 12;
const SKELETON_ROW_HEIGHT = 45;

// Column widths as relative weights (they total 100).
const COLUMN_WIDTHS = {
  date: '10%',
  taskKey: '8%',
  task: '17%',
  member: '15%',
  project: '14%',
  client: '12%',
  description: '15%',
  duration: '9%',
} as const;

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
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();

  const renderSortableTitle = useCallback(
    (label: string, field: TimeLogSortField) => (
      <span
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => onSortChange(field)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSortChange(field);
          }
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 4,
          width: '100%',
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <span>{label}</span>
        <SortArrows active={sortField === field ? sortOrder : null} />
      </span>
    ),
    [sortField, sortOrder, onSortChange]
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

  const isTaskView = view === 'task';

  const columns: TableProps<TimeLogRow>['columns'] = useMemo(
    () => [
      {
        key: 'date',
        // In the By task view a row spans several days, so its date is the latest entry's.
        title: renderSortableTitle(
          isTaskView
            ? t('timeLogsLastLogged', { defaultValue: 'Last logged' })
            : t('Date', { defaultValue: 'Date' }),
          'date'
        ),
        onHeaderCell: sortHeaderCell('date'),
        width: COLUMN_WIDTHS.date,
        render: (_, record) => formatCalendarDate(record.log_day),
      },
      {
        key: 'taskKey',
        title: renderSortableTitle(t('timeLogsTaskId', { defaultValue: 'Task ID' }), 'task_key'),
        onHeaderCell: sortHeaderCell('task_key'),
        width: COLUMN_WIDTHS.taskKey,
        render: (_, record) =>
          record.task_key ? <span style={ELLIPSIS_STYLE}>{record.task_key}</span> : <EmptyCell />,
      },
      {
        key: 'task',
        title: renderSortableTitle(t('timeLogsTaskName', { defaultValue: 'Task name' }), 'task'),
        onHeaderCell: sortHeaderCell('task'),
        width: COLUMN_WIDTHS.task,
        ellipsis: { showTitle: false },
        render: (_, record) => <TextCell value={record.task_name} />,
      },
      {
        key: 'member',
        title: renderSortableTitle(t('Member', { defaultValue: 'Member' }), 'member'),
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
        title: renderSortableTitle(t('Project', { defaultValue: 'Project' }), 'project'),
        onHeaderCell: sortHeaderCell('project'),
        width: COLUMN_WIDTHS.project,
        ellipsis: true,
        render: (_, record) => <span style={{ fontWeight: 500 }}>{record.project_name}</span>,
      },
      {
        key: 'client',
        title: renderSortableTitle(t('timeLogsClient', { defaultValue: 'Client' }), 'client'),
        onHeaderCell: sortHeaderCell('client'),
        width: COLUMN_WIDTHS.client,
        ellipsis: { showTitle: false },
        render: (_, record) => <TextCell value={record.client_name} />,
      },
      {
        key: 'description',
        title: t('Description', { defaultValue: 'Description' }),
        width: COLUMN_WIDTHS.description,
        ellipsis: { showTitle: false },
        render: (_, record) => <TextCell value={record.description} />,
      },
      {
        key: 'duration',
        title: renderSortableTitle(t('Duration', { defaultValue: 'Duration' }), 'duration'),
        onHeaderCell: sortHeaderCell('duration'),
        width: COLUMN_WIDTHS.duration,
        render: (_, record) => formatLoggedDuration(record.time_spent),
      },
    ],
    [renderSortableTitle, sortHeaderCell, t, isTaskView]
  );

  // The very first load has nothing to show yet, so it gets skeleton rows (like Home > My Tasks).
  // Later loads (paging, sorting, filtering) keep the current rows with antd's own loading overlay
  // instead of blanking the table.
  const isFirstLoad = loading && logs.length === 0 && !failed;

  // The rows scroll inside this element; the pagination bar below insets itself by the width of
  // its scrollbar (when it has one) so both stay lined up with the data cells.
  const { scrollAreaRef, scrollbarWidth } = useScrollbarGutter([
    logs.length,
    pageSize,
    loading,
    isFirstLoad,
  ]);

  const emptyContent = (
    <TimeLogsEmptyState failed={failed} onRetry={onRetry} onClearFilters={onClearFilters} />
  );

  // The total is a real table row (a `<tfoot>`): it shares the column grid with the data, so
  // "Total" sits under the Duration column and "Entries" under the first column's text, and it
  // scrolls horizontally with them. Like the header sticks to the top of the scrolling area, this
  // row sticks to the bottom (time-logs.css), so the total stays in view however many rows scroll
  // past. It covers every entry matching the filters — not just this page — so it can be used for
  // an invoice straight away.
  //
  // antd's Table.Summary.Cell takes `className` but ignores `style`, so the row is styled from
  // time-logs.css, with the theme colours handed over as CSS variables on the scrolling area.
  const renderSummary = () => (
    <Table.Summary>
      <Table.Summary.Row>
        <Table.Summary.Cell
          index={0}
          colSpan={SUMMARY_LABEL_COLUMNS}
          className="time-logs-summary-cell"
        >
          <Flex justify="space-between" align="center" gap={8}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {isTaskView
                ? t('timeLogsTasksCount', {
                    defaultValue: 'Tasks: {{count}}',
                    count: failed ? 0 : total,
                  })
                : t('timeLogsEntriesCount', {
                    defaultValue: 'Entries: {{count}}',
                    count: failed ? 0 : total,
                  })}
            </Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t('timeLogsTotalLabel', { defaultValue: 'Total time logged' })}
            </Text>
          </Flex>
        </Table.Summary.Cell>
        <Table.Summary.Cell index={SUMMARY_LABEL_COLUMNS} className="time-logs-summary-cell">
          <TimeLogsTotalValue totalSeconds={totalSeconds} failed={failed} />
        </Table.Summary.Cell>
      </Table.Summary.Row>
    </Table.Summary>
  );

  // Column-shaped placeholder rows, sized like the real cells so the layout does not jump.
  const skeletonColumns: { width: string; shape: 'text' | 'avatar' }[] = [
    { width: COLUMN_WIDTHS.date, shape: 'text' },
    { width: COLUMN_WIDTHS.taskKey, shape: 'text' },
    { width: COLUMN_WIDTHS.task, shape: 'text' },
    { width: COLUMN_WIDTHS.member, shape: 'avatar' },
    { width: COLUMN_WIDTHS.project, shape: 'text' },
    { width: COLUMN_WIDTHS.client, shape: 'text' },
    { width: COLUMN_WIDTHS.description, shape: 'text' },
    { width: COLUMN_WIDTHS.duration, shape: 'text' },
  ];
  const skeletonRows = Math.min(pageSize, MAX_SKELETON_ROWS);

  return (
    // Same workflow as the Home > My Tasks table: a bordered card that shrinks to fit its rows and
    // is capped at the height the page gives it (`maxHeight: 100%`). Inside, one element scrolls
    // (the rows, with a sticky header and a sticky total row) while the pagination bar stays
    // pinned below it — so a long page, or a larger "rows per page", scrolls the table and never
    // the page.
    <div
      className="time-logs-table"
      style={{
        maxHeight: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 10,
        border: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorBgContainer,
        overflow: 'hidden',
      }}
    >
      {isFirstLoad ? (
        <div
          role="status"
          aria-busy="true"
          aria-label={t('timeLogsLoading', { defaultValue: 'Loading time logs' })}
          style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
        >
          {Array.from({ length: skeletonRows }).map((_, row) => (
            <div
              key={row}
              style={{
                display: 'flex',
                alignItems: 'center',
                height: SKELETON_ROW_HEIGHT,
                boxSizing: 'border-box',
                borderBottom:
                  row < skeletonRows - 1 ? `1px solid ${token.colorBorderSecondary}` : 'none',
              }}
            >
              {skeletonColumns.map((col, i) => (
                <div
                  key={i}
                  style={{
                    width: col.width,
                    flexShrink: 0,
                    boxSizing: 'border-box',
                    padding: `0 ${CELL_PADDING}px`,
                  }}
                >
                  {col.shape === 'avatar' ? (
                    <Flex align="center" gap={8}>
                      <Skeleton.Avatar active size={22} shape="circle" />
                      <Skeleton.Input active size="small" style={{ height: 14, minWidth: 0 }} />
                    </Flex>
                  ) : (
                    <Skeleton.Input active size="small" block style={{ height: 14, minWidth: 0 }} />
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          ref={scrollAreaRef}
          className="time-logs-table-card"
          style={
            {
              '--time-logs-sticky-bg': token.colorBgContainer,
              '--time-logs-summary-bg': token.colorFillAlter,
              '--time-logs-summary-border': token.colorBorderSecondary,
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
            } as React.CSSProperties
          }
        >
          <Table<TimeLogRow>
            dataSource={failed ? [] : logs}
            rowKey={record => record.id}
            columns={columns}
            size="middle"
            pagination={false}
            tableLayout="fixed"
            summary={renderSummary}
            loading={loading}
            // While a later response is in flight the overlay spinner is the only thing to show —
            // not a premature "nothing logged" message underneath it.
            locale={{ emptyText: loading ? <div style={{ minHeight: 120 }} /> : emptyContent }}
          />
        </div>
      )}

      <div style={{ flexShrink: 0 }}>
        <TablePagination
          variant="dropdown"
          page={page}
          pageSize={pageSize}
          total={failed ? 0 : total}
          onPageChange={onPageChange}
          // Line up with the data cells: same side padding, plus the scrollbar gutter on the right.
          insetStart={CELL_PADDING}
          insetEnd={CELL_PADDING + scrollbarWidth}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          rowsPerPageLabel={t('timeLogsRowsPerPage', { defaultValue: 'Rows per page' })}
        />
      </div>
    </div>
  );
};
