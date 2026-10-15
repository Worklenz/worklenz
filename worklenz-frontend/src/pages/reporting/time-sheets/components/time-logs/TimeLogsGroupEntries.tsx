import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Table, TableColumnsType, Typography, theme } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { reportingTimeLogsApiService } from '@/api/reporting/reporting-time-logs.api.service';
import CustomTableTitle from '@/components/CustomTableTitle';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import { formatLoggedDuration } from '@/components/time-entries/time-entries-format';
import {
  ITimeLogEntry,
  ITimeLogsFilterRequest,
  TimeLogsGroupDimension,
  isTaskRow,
} from '@/types/reporting/time-logs.types';
import { formatCalendarDate } from '@/utils/date-presets';
import logger from '@/utils/errorLogger';
import {
  ELLIPSIS_STYLE,
  EmptyCell,
  MemberCell,
  ProjectNameCell,
  TaskNameCell,
  TextCell,
} from './time-logs-cells';
import { ROW_HEIGHT } from './time-logs-table-config';
import './time-logs.css';

const { Text } = Typography;

/** Entries fetched per click — a group can hold far more than is worth drawing at once. */
const ENTRIES_PAGE_SIZE = 25;
const SKELETON_ROWS = 3;

type EntryColumn =
  | 'date'
  | 'taskKey'
  | 'task'
  | 'member'
  | 'project'
  | 'client'
  | 'description'
  | 'duration';

// The columns of an open group, in the order of the table. The dimension a group is already named
// after is not repeated as a column.
const ENTRY_COLUMNS: EntryColumn[] = [
  'date',
  'taskKey',
  'task',
  'member',
  'project',
  'client',
  'description',
  'duration',
];

const COLUMN_HIDDEN_BY_GROUP: Record<TimeLogsGroupDimension, EntryColumn> = {
  member: 'member',
  project: 'project',
  client: 'client',
};

const ENTRY_COLUMN_WIDTHS: Record<EntryColumn, number> = {
  date: 130,
  taskKey: 110,
  task: 240,
  member: 200,
  project: 200,
  client: 180,
  description: 240,
  duration: 130,
};

/** The request that lists just this group's entries: the page's filters, narrowed to the group. */
const narrowToGroup = (
  groupBy: TimeLogsGroupDimension,
  groupKey: string
): Partial<ITimeLogsFilterRequest> => {
  switch (groupBy) {
    case 'member':
      return { user_ids: [groupKey] };
    case 'project':
      return { project_ids: [groupKey] };
    case 'client':
      return { client_ids: [groupKey] };
  }
};

interface IEntriesState {
  rows: ITimeLogEntry[];
  /** The last page that has been loaded (0 = none yet). */
  page: number;
  loading: boolean;
  failed: boolean;
}

interface TimeLogsGroupEntriesProps {
  /** DOM id, so the group's toggle can point at what it opens. */
  id: string;
  groupBy: TimeLogsGroupDimension;
  groupKey: string;
  groupLabel: string;
  /** How many entries the group holds, from its rollup. */
  entryCount: number;
  /** The filters the groups were built with; the entries are loaded with the same ones. */
  filterRequest: ITimeLogsFilterRequest;
  /** Opens a task from its name; without it the task names are plain text. */
  onOpenTask?: (taskId: string, projectId: string) => void;
}

/**
 * The entries of one open group, loaded on demand through the ordinary list endpoint narrowed to
 * the group — so a large team never ships every entry up front. Newest first, a page at a time.
 */
export const TimeLogsGroupEntries: React.FC<TimeLogsGroupEntriesProps> = ({
  id,
  groupBy,
  groupKey,
  groupLabel,
  entryCount,
  filterRequest,
  onOpenTask,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();
  const [state, setState] = useState<IEntriesState>({
    rows: [],
    page: 0,
    loading: true,
    failed: false,
  });
  const latestRequestRef = useRef(0);
  // `filterRequest` is rebuilt by the parent; its serialized form decides whether it changed.
  const filterKey = JSON.stringify(filterRequest);
  const filterRef = useRef(filterRequest);
  filterRef.current = filterRequest;

  const loadPage = useCallback(
    async (page: number) => {
      const requestId = ++latestRequestRef.current;
      setState(prev => ({
        rows: page === 1 ? [] : prev.rows,
        page: page === 1 ? 0 : prev.page,
        loading: true,
        failed: false,
      }));
      try {
        const res = await reportingTimeLogsApiService.getTimeLogs({
          ...filterRef.current,
          ...narrowToGroup(groupBy, groupKey),
          page,
          page_size: ENTRIES_PAGE_SIZE,
        });
        if (requestId !== latestRequestRef.current) return;
        if (!res.done || !res.body) {
          setState(prev => ({ ...prev, loading: false, failed: true }));
          return;
        }
        const entries = res.body.logs.filter((row): row is ITimeLogEntry => !isTaskRow(row));
        setState(prev => ({
          rows: page === 1 ? entries : [...prev.rows, ...entries],
          page,
          loading: false,
          failed: false,
        }));
      } catch (error) {
        if (requestId !== latestRequestRef.current) return;
        logger.error('Error fetching the entries of a time log group', error);
        setState(prev => ({ ...prev, loading: false, failed: true }));
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the serialized filters
    [filterKey, groupBy, groupKey]
  );

  // Starts from the first page again whenever the filters change; closing the group (unmounting)
  // drops a response that is still on its way.
  useEffect(() => {
    void loadPage(1);
    return () => {
      latestRequestRef.current += 1;
    };
  }, [loadPage]);

  const columns = ENTRY_COLUMNS.filter(column => column !== COLUMN_HIDDEN_BY_GROUP[groupBy]);
  const labels: Record<EntryColumn, string> = {
    date: t('Date', { defaultValue: 'Date' }),
    taskKey: t('timeLogsTaskId', { defaultValue: 'Task ID' }),
    task: t('timeLogsTaskName', { defaultValue: 'Task name' }),
    member: t('Member', { defaultValue: 'Member' }),
    project: t('Project', { defaultValue: 'Project' }),
    client: t('timeLogsClient', { defaultValue: 'Client' }),
    description: t('Description', { defaultValue: 'Description' }),
    duration: t('Duration', { defaultValue: 'Duration' }),
  };

  const renderCell = (column: EntryColumn, entry: ITimeLogEntry): React.ReactNode => {
    switch (column) {
      case 'date':
        return formatCalendarDate(entry.log_day);
      case 'taskKey':
        return entry.task_key ? (
          <span style={ELLIPSIS_STYLE}>{entry.task_key}</span>
        ) : (
          <EmptyCell />
        );
      case 'task':
        return (
          <TaskNameCell
            name={entry.task_name}
            taskId={entry.task_id}
            projectId={entry.project_id}
            onOpenTask={onOpenTask}
          />
        );
      case 'member':
        return (
          <MemberCell
            name={entry.user_name}
            avatarUrl={entry.avatar_url}
            status={entry.member_status}
          />
        );
      case 'project':
        return <ProjectNameCell name={entry.project_name} color={entry.project_color} />;
      case 'client':
        return <TextCell value={entry.client_name} />;
      case 'description':
        return <TextCell value={entry.description} />;
      case 'duration':
        return formatLoggedDuration(entry.time_spent);
    }
  };

  const hasMore = state.rows.length < entryCount;
  const isFirstLoad = state.loading && state.rows.length === 0 && !state.failed;

  const tableColumns: TableColumnsType<ITimeLogEntry> = useMemo(() => {
    const built = columns.map(column => ({
      key: column,
      title: <CustomTableTitle title={labels[column]} />,
      width: ENTRY_COLUMN_WIDTHS[column],
      ...(column === 'task' || column === 'client' || column === 'description'
        ? { ellipsis: { showTitle: false } }
        : {}),
      render: (_: unknown, entry: ITimeLogEntry) => renderCell(column, entry),
    }));
    return isFirstLoad ? toSkeletonColumns(built) : built;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- labels / renderCell follow `t`, `onOpenTask`
  }, [groupBy, isFirstLoad, onOpenTask, t]);

  return (
    <div
      id={id}
      role="region"
      aria-label={t('timeLogsGroupEntriesLabel', {
        defaultValue: 'Entries of {{group}}',
        group: groupLabel,
      })}
      aria-busy={state.loading}
    >
      <Table<ITimeLogEntry>
        className="time-logs-entries-table"
        showSorterTooltip={false}
        tableLayout="fixed"
        pagination={false}
        rowKey="id"
        columns={tableColumns}
        dataSource={isFirstLoad ? buildSkeletonRows<ITimeLogEntry>(SKELETON_ROWS) : state.rows}
        scroll={{ x: 'max-content' }}
        onRow={() => ({ className: 'group', style: { height: ROW_HEIGHT } })}
        locale={{ emptyText: <span /> }}
      />

      <div
        className="flex items-center justify-between gap-2 px-4 py-2"
        style={{ borderTop: `1px solid ${token.colorBorderSecondary}`, minHeight: 40 }}
      >
        {state.failed ? (
          <>
            <span role="alert">
              <Text type="danger" style={{ fontSize: 12 }}>
                {t('timeLogsGroupEntriesError', { defaultValue: "Couldn't load these entries" })}
              </Text>
            </span>
            <Button size="small" onClick={() => void loadPage(state.page + 1)}>
              {t('timeLogsRetry', { defaultValue: 'Retry' })}
            </Button>
          </>
        ) : (
          !isFirstLoad && (
            <>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('timeLogsGroupEntriesShowing', {
                  defaultValue: 'Showing {{shown}} of {{total}} entries',
                  shown: state.rows.length,
                  total: entryCount,
                })}
              </Text>
              {hasMore && (
                <Button
                  size="small"
                  loading={state.loading}
                  onClick={() => void loadPage(state.page + 1)}
                >
                  {t('timeLogsGroupLoadMore', { defaultValue: 'Load more' })}
                </Button>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
};
