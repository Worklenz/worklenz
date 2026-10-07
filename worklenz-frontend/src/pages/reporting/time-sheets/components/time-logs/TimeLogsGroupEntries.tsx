import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button, Skeleton, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { reportingTimeLogsApiService } from '@/api/reporting/reporting-time-logs.api.service';
import { formatLoggedDuration } from '@/components/time-entries/time-entries-format';
import {
  ITimeLogEntry,
  ITimeLogsFilterRequest,
  TimeLogsGroupDimension,
  isTaskRow,
} from '@/types/reporting/time-logs.types';
import { formatCalendarDate } from '@/utils/date-presets';
import logger from '@/utils/errorLogger';
import { ELLIPSIS_STYLE, EmptyCell, MemberCell, TextCell } from './time-logs-cells';

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

const ENTRY_COLUMN_WIDTHS: Record<EntryColumn, string> = {
  date: '96px',
  taskKey: '72px',
  task: 'minmax(140px, 2fr)',
  member: 'minmax(120px, 1.4fr)',
  project: 'minmax(110px, 1.4fr)',
  client: 'minmax(100px, 1.2fr)',
  description: 'minmax(120px, 1.6fr)',
  duration: '84px',
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
}) => {
  const { t } = useTranslation('time-report');
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
        return <TextCell value={entry.task_name} />;
      case 'member':
        return (
          <MemberCell
            name={entry.user_name}
            avatarUrl={entry.avatar_url}
            status={entry.member_status}
          />
        );
      case 'project':
        return <span style={ELLIPSIS_STYLE}>{entry.project_name}</span>;
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
  const gridStyle = {
    '--time-logs-entry-columns': columns.map(column => ENTRY_COLUMN_WIDTHS[column]).join(' '),
  } as React.CSSProperties;

  return (
    <div
      id={id}
      role="table"
      aria-label={t('timeLogsGroupEntriesLabel', {
        defaultValue: 'Entries of {{group}}',
        group: groupLabel,
      })}
      aria-busy={state.loading}
      className="time-logs-group-entries"
      style={gridStyle}
    >
      <div role="row" className="time-logs-group-entries-head">
        {columns.map(column => (
          <span key={column} role="columnheader" style={ELLIPSIS_STYLE}>
            {labels[column]}
          </span>
        ))}
      </div>

      {state.rows.map(entry => (
        <div key={entry.id} role="row" className="time-logs-group-entry">
          {columns.map(column => (
            <div key={column} role="cell" style={{ minWidth: 0 }}>
              {renderCell(column, entry)}
            </div>
          ))}
        </div>
      ))}

      {isFirstLoad &&
        Array.from({ length: SKELETON_ROWS }).map((_, row) => (
          <div key={row} className="time-logs-group-entry" aria-hidden="true">
            <div style={{ gridColumn: '1 / -1' }}>
              <Skeleton.Input active size="small" block style={{ height: 14, minWidth: 0 }} />
            </div>
          </div>
        ))}

      <div className="time-logs-group-entries-foot">
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
