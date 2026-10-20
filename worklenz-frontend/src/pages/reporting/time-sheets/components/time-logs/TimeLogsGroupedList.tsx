import React, { useCallback, useState } from 'react';
import { Button, Flex, Skeleton, Typography, theme } from '@/shared/antd-imports';
import { DownOutlined, RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import TablePagination from '@/components/TablePagination';
import { formatLoggedDuration } from '@/components/time-entries/time-entries-format';
import {
  ITimeLogGroup,
  ITimeLogsFilterRequest,
  TimeLogsGroupDimension,
} from '@/types/reporting/time-logs.types';
import { ELLIPSIS_STYLE, MemberCell } from './time-logs-cells';
import { NO_CLIENT_FILTER_ID } from './time-logs-filters';
import { TimeLogsEmptyState, TimeLogsTotalValue } from './time-logs-states';
import { TimeLogsGroupEntries } from './TimeLogsGroupEntries';
import { useScrollbarGutter } from './useScrollbarGutter';
import './time-logs.css';

const { Text } = Typography;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];
// Horizontal padding of a row — see time-logs.css. The pagination bar uses the same inset so its
// text lines up with the rows.
const ROW_PADDING = 8;
const SKELETON_ROWS = 6;
const SKELETON_ROW_HEIGHT = 45;
const EMPTY_KEYS: ReadonlySet<string> = new Set();

// toggle | name | one dimension-dependent count | seven rollup counts and times | total time.
const GROUP_COLUMNS = '32px minmax(180px, 2.4fr) repeat(9, minmax(88px, 1fr))';
const COLUMN_COUNT = 11;
// Billable time — the 5th value after the name — is the one coloured figure of a group's row.
const BILLABLE_TIME_CELL_INDEX = 4;

interface TimeLogsGroupedListProps {
  groups: ITimeLogGroup[];
  groupBy: TimeLogsGroupDimension;
  /** The filters the groups were built with — an open group lists its entries with the same ones. */
  filterRequest: ITimeLogsFilterRequest;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
  /** What the pager counts. */
  totalGroups: number;
  /** Entries and seconds across *all* groups, not just this page's. */
  totalEntries: number;
  totalSeconds: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  /** Offered in the empty state when something is narrowing the result. */
  onClearFilters?: () => void;
}

/**
 * Time logs grouped by Member, Project or Client: one row per group with its rollup (entries,
 * tasks, billable and non-billable time), each opening onto its own entries. Laid out like the
 * table it replaces — a bordered card whose rows scroll under a sticky header and above a sticky
 * total row, with the pagination bar pinned below — so the page itself never scrolls.
 */
export const TimeLogsGroupedList: React.FC<TimeLogsGroupedListProps> = ({
  groups,
  groupBy,
  filterRequest,
  loading,
  failed,
  onRetry,
  totalGroups,
  totalEntries,
  totalSeconds,
  page,
  pageSize,
  onPageChange,
  onClearFilters,
}) => {
  const { t } = useTranslation('time-report');
  const { token } = theme.useToken();

  // Which groups are open. It belongs to one set of groups: another filter, dimension or page
  // closes them all (derived from `scope`, so there is never a frame of stale open groups).
  const scope = JSON.stringify([groupBy, filterRequest, page, pageSize]);
  const [openState, setOpenState] = useState<{ scope: string; keys: ReadonlySet<string> }>({
    scope,
    keys: EMPTY_KEYS,
  });
  const openKeys = openState.scope === scope ? openState.keys : EMPTY_KEYS;

  const toggle = useCallback(
    (key: string) => {
      setOpenState(prev => {
        const keys = new Set(prev.scope === scope ? prev.keys : EMPTY_KEYS);
        if (keys.has(key)) keys.delete(key);
        else keys.add(key);
        return { scope, keys };
      });
    },
    [scope]
  );

  const isFirstLoad = loading && groups.length === 0 && !failed;
  const { scrollAreaRef, scrollbarWidth } = useScrollbarGutter([
    groups.length,
    pageSize,
    loading,
    isFirstLoad,
  ]);

  const identityHeading: Record<TimeLogsGroupDimension, string> = {
    member: t('Member', { defaultValue: 'Member' }),
    project: t('Project', { defaultValue: 'Project' }),
    client: t('timeLogsClient', { defaultValue: 'Client' }),
  };
  // Members and clients span several projects; a project spans several members.
  const secondaryHeading =
    groupBy === 'project'
      ? t('timeLogsColMembers', { defaultValue: 'Members' })
      : t('timeLogsColProjects', { defaultValue: 'Projects' });
  const headings = [
    t('timeLogsColTotalEntries', { defaultValue: 'Total Entries' }),
    t('timeLogsColBillableEntries', { defaultValue: 'Billable Entries' }),
    t('timeLogsColBillableTasks', { defaultValue: 'Billable Tasks' }),
    t('timeLogsColBillableTime', { defaultValue: 'Billable Time' }),
    t('timeLogsColNonBillableEntries', { defaultValue: 'Non-billable Entries' }),
    t('timeLogsColNonBillableTasks', { defaultValue: 'Non-billable Tasks' }),
    t('timeLogsColNonBillableTime', { defaultValue: 'Non-billable Time' }),
    t('timeLogsColTotalTime', { defaultValue: 'Total Time' }),
  ];

  const getGroupLabel = (group: ITimeLogGroup): string =>
    group.group_label ??
    (group.group_key === NO_CLIENT_FILTER_ID
      ? t('timeLogsNoClient', { defaultValue: 'No client' })
      : t('timeLogsUnknown', { defaultValue: 'Unknown' }));

  const renderIdentity = (group: ITimeLogGroup) => {
    const label = getGroupLabel(group);
    if (groupBy === 'member' && group.group_status) {
      return (
        <MemberCell
          name={group.group_label}
          avatarUrl={group.group_avatar_url}
          status={group.group_status}
        />
      );
    }
    return (
      <Flex align="center" gap={8} style={{ minWidth: 0 }}>
        {groupBy === 'project' && (
          <span
            aria-hidden="true"
            style={{
              width: 8,
              height: 8,
              flexShrink: 0,
              borderRadius: '50%',
              background: group.group_color || token.colorPrimary,
            }}
          />
        )}
        <span
          style={{
            ...ELLIPSIS_STYLE,
            fontWeight: 500,
            opacity: group.group_label === null ? 0.65 : undefined,
          }}
        >
          {label}
        </span>
      </Flex>
    );
  };

  const renderGroup = (group: ITimeLogGroup) => {
    const isOpen = openKeys.has(group.group_key);
    const label = getGroupLabel(group);
    const entriesId = `time-logs-group-${groupBy}-${group.group_key}`;
    const secondaryCount = groupBy === 'project' ? group.member_count : group.project_count;
    const cells: React.ReactNode[] = [
      secondaryCount,
      group.entry_count,
      group.billable_entry_count,
      group.billable_task_count,
      formatLoggedDuration(group.billable_time),
      group.non_billable_entry_count,
      group.non_billable_task_count,
      formatLoggedDuration(group.non_billable_time),
      <Text key="total" strong style={{ fontSize: 12 }}>
        {formatLoggedDuration(group.subtotal)}
      </Text>,
    ];

    return (
      <div
        key={group.group_key}
        role="listitem"
        className={`time-logs-group${isOpen ? ' time-logs-group--expanded' : ''}`}
      >
        <div className="time-logs-group-row" onClick={() => toggle(group.group_key)}>
          <Button
            type="text"
            size="small"
            aria-expanded={isOpen}
            aria-controls={isOpen ? entriesId : undefined}
            aria-label={
              isOpen
                ? t('timeLogsGroupCollapse', { defaultValue: 'Collapse {{group}}', group: label })
                : t('timeLogsGroupExpand', { defaultValue: 'Expand {{group}}', group: label })
            }
            icon={
              isOpen ? (
                <DownOutlined style={{ fontSize: 10 }} />
              ) : (
                <RightOutlined style={{ fontSize: 10 }} />
              )
            }
            style={{ padding: 0, width: 20, height: 20 }}
            onClick={event => {
              // the row itself toggles too; one click must not toggle twice
              event.stopPropagation();
              toggle(group.group_key);
            }}
          />
          <div className="time-logs-group-cell">{renderIdentity(group)}</div>
          {cells.map((cell, index) => (
            <div
              key={index}
              className={`time-logs-group-cell${
                index === BILLABLE_TIME_CELL_INDEX ? ' time-logs-group-cell--billable-time' : ''
              }`}
            >
              {cell}
            </div>
          ))}
        </div>

        {isOpen && (
          <TimeLogsGroupEntries
            id={entriesId}
            groupBy={groupBy}
            groupKey={group.group_key}
            groupLabel={label}
            entryCount={group.entry_count}
            filterRequest={filterRequest}
          />
        )}
      </div>
    );
  };

  let body: React.ReactNode;
  if (isFirstLoad) {
    body = (
      <div
        role="status"
        aria-busy="true"
        aria-label={t('timeLogsLoading', { defaultValue: 'Loading time logs' })}
      >
        {Array.from({ length: SKELETON_ROWS }).map((_, row) => (
          <div
            key={row}
            style={{
              height: SKELETON_ROW_HEIGHT,
              display: 'flex',
              alignItems: 'center',
              padding: `0 ${ROW_PADDING}px`,
              borderBottom: `1px solid ${token.colorBorderSecondary}`,
            }}
          >
            <Skeleton.Input active size="small" block style={{ height: 14, minWidth: 0 }} />
          </div>
        ))}
      </div>
    );
  } else if (failed || groups.length === 0) {
    body = <TimeLogsEmptyState failed={failed} onRetry={onRetry} onClearFilters={onClearFilters} />;
  } else {
    body = (
      // dimmed while a later response is in flight, instead of blanking the list
      <div
        role="list"
        aria-busy={loading}
        style={{ opacity: loading ? 0.6 : 1, transition: 'opacity 0.15s ease' }}
      >
        {groups.map(renderGroup)}
      </div>
    );
  }

  return (
    // Same card as the table: shrinks to fit its rows, capped at the height the page gives it.
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
      <div
        ref={scrollAreaRef}
        className="time-logs-groups-scroll"
        style={
          {
            '--time-logs-sticky-bg': token.colorBgContainer,
            '--time-logs-summary-bg': token.colorFillAlter,
            '--time-logs-summary-border': token.colorBorderSecondary,
            '--time-logs-border': token.colorBorderSecondary,
            '--time-logs-hover-bg': token.colorFillQuaternary,
            '--time-logs-billable': token.colorSuccess,
            flex: 1,
            minHeight: 0,
            overflow: 'auto',
          } as React.CSSProperties
        }
      >
        <div
          className="time-logs-groups"
          style={{ '--time-logs-group-columns': GROUP_COLUMNS } as React.CSSProperties}
        >
          <div className="time-logs-groups-head">
            <span />
            <span>{identityHeading[groupBy]}</span>
            {[secondaryHeading, ...headings].map(heading => (
              <span key={heading}>{heading}</span>
            ))}
          </div>

          {body}

          <div className="time-logs-groups-foot">
            <Flex
              justify="space-between"
              align="center"
              gap={8}
              style={{ gridColumn: `1 / span ${COLUMN_COUNT - 1}` }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('timeLogsEntriesCount', {
                  defaultValue: 'Entries: {{count}}',
                  count: failed ? 0 : totalEntries,
                })}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t('timeLogsTotalLabel', { defaultValue: 'Total time logged' })}
              </Text>
            </Flex>
            <TimeLogsTotalValue totalSeconds={totalSeconds} failed={failed} />
          </div>
        </div>
      </div>

      <div style={{ flexShrink: 0 }}>
        <TablePagination
          variant="dropdown"
          page={page}
          pageSize={pageSize}
          total={failed ? 0 : totalGroups}
          onPageChange={onPageChange}
          insetStart={ROW_PADDING}
          insetEnd={ROW_PADDING + scrollbarWidth}
          pageSizeOptions={PAGE_SIZE_OPTIONS}
          rowsPerPageLabel={t('timeLogsRowsPerPage', { defaultValue: 'Rows per page' })}
        />
      </div>
    </div>
  );
};
