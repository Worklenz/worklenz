import React, { useCallback, useMemo, useState } from 'react';
import {
  Badge,
  Button,
  ConfigProvider,
  Flex,
  Table,
  TableColumnsType,
  Typography,
  theme,
} from '@/shared/antd-imports';
import { RightOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import CustomTableTitle from '@/components/CustomTableTitle';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import { formatLoggedDuration } from '@/components/time-entries/time-entries-format';
import {
  ITimeLogGroup,
  ITimeLogsFilterRequest,
  TimeLogsGroupDimension,
} from '@/types/reporting/time-logs.types';
import { ELLIPSIS_STYLE, MemberCell } from './time-logs-cells';
import { NO_CLIENT_FILTER_ID } from './time-logs-filters';
import { ROW_HEIGHT, TABLE_CONFIG, useTableScrollY } from './time-logs-table-config';
import { TimeLogsEmptyState, TimeLogsTotalValue } from './time-logs-states';
import { TimeLogsGroupEntries } from './TimeLogsGroupEntries';
import { TimeLogsPaginationBar } from './TimeLogsPaginationBar';
import './time-logs.css';

const { Text } = Typography;

const EMPTY_KEYS: ReadonlySet<string> = new Set();

// Column widths in px, like the Projects report's grouped view (the table scrolls sideways below
// their sum).
const GROUP_COLUMN_WIDTH = 280;
const SECONDARY_COLUMN_WIDTH = 110;
const ROLLUP_COLUMN_WIDTH = 140;
// group | one dimension-dependent count | seven rollup counts and times | total time.
const COLUMN_COUNT = 10;
const SCROLL_X = 'max-content';

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
  /** Opens a task from its name in an open group; without it the names are plain text. */
  onOpenTask?: (taskId: string, projectId: string) => void;
}

/**
 * Time logs grouped by Member, Project or Client: one row per group with its rollup (entries,
 * tasks, billable and non-billable time), each opening onto its own entries. Laid out like the
 * Projects report's grouped view — a bordered card holding an antd table whose body scrolls under a
 * fixed header and above a fixed total row, with the pagination bar below it.
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
  onOpenTask,
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

  // The first load has no rows yet, so draw placeholder rows instead of an empty state.
  const isFirstLoad = loading && groups.length === 0 && !failed;
  const { containerRef, scrollY } = useTableScrollY([groups, loading]);

  const getGroupLabel = useCallback(
    (group: ITimeLogGroup): string =>
      group.group_label ??
      (group.group_key === NO_CLIENT_FILTER_ID
        ? t('timeLogsNoClient', { defaultValue: 'No client' })
        : t('timeLogsUnknown', { defaultValue: 'Unknown' })),
    [t]
  );

  const renderIdentity = useCallback(
    (group: ITimeLogGroup) => {
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
          {groupBy === 'project' && <Badge color={group.group_color || token.colorPrimary} />}
          <span
            style={{
              ...ELLIPSIS_STYLE,
              fontWeight: 500,
              opacity: group.group_label === null ? 0.65 : undefined,
            }}
          >
            {getGroupLabel(group)}
          </span>
        </Flex>
      );
    },
    [getGroupLabel, groupBy, token.colorPrimary]
  );

  const columns: TableColumnsType<ITimeLogGroup> = useMemo(() => {
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

    const rollup = (
      key: string,
      title: string,
      render: (group: ITimeLogGroup) => React.ReactNode
    ) => ({
      key,
      title: <CustomTableTitle title={title} />,
      width: ROLLUP_COLUMN_WIDTH,
      align: 'center' as const,
      render: (_: unknown, group: ITimeLogGroup) => render(group),
    });

    return [
      {
        key: 'group',
        title: <CustomTableTitle title={identityHeading[groupBy]} />,
        fixed: 'left' as const,
        width: GROUP_COLUMN_WIDTH,
        render: (_: unknown, group: ITimeLogGroup) => {
          const isOpen = openKeys.has(group.group_key);
          const label = getGroupLabel(group);
          return (
            <Flex gap={4} align="center" style={{ minWidth: 0 }}>
              <Button
                type="text"
                size="small"
                aria-expanded={isOpen}
                aria-controls={
                  isOpen ? `time-logs-group-${groupBy}-${group.group_key}` : undefined
                }
                aria-label={
                  isOpen
                    ? t('timeLogsGroupCollapse', {
                        defaultValue: 'Collapse {{group}}',
                        group: label,
                      })
                    : t('timeLogsGroupExpand', { defaultValue: 'Expand {{group}}', group: label })
                }
                icon={
                  <RightOutlined
                    style={{
                      fontSize: 10,
                      transition: 'transform 200ms',
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                    }}
                  />
                }
                onClick={event => {
                  // the row itself toggles too; one click must not toggle twice
                  event.stopPropagation();
                  toggle(group.group_key);
                }}
              />
              <div style={{ minWidth: 0 }}>{renderIdentity(group)}</div>
            </Flex>
          );
        },
      },
      rollup('secondary', secondaryHeading, group =>
        groupBy === 'project' ? group.member_count : group.project_count
      ),
      rollup(
        'entries',
        t('timeLogsColTotalEntries', { defaultValue: 'Total Entries' }),
        group => group.entry_count
      ),
      rollup(
        'billableEntries',
        t('timeLogsColBillableEntries', { defaultValue: 'Billable Entries' }),
        group => group.billable_entry_count
      ),
      rollup(
        'billableTasks',
        t('timeLogsColBillableTasks', { defaultValue: 'Billable Tasks' }),
        group => group.billable_task_count
      ),
      // Billable time is the one coloured figure of a group's row.
      rollup(
        'billableTime',
        t('timeLogsColBillableTime', { defaultValue: 'Billable Time' }),
        group => (
          <span style={{ fontWeight: 500, color: token.colorSuccess }}>
            {formatLoggedDuration(group.billable_time)}
          </span>
        )
      ),
      rollup(
        'nonBillableEntries',
        t('timeLogsColNonBillableEntries', { defaultValue: 'Non-billable Entries' }),
        group => group.non_billable_entry_count
      ),
      rollup(
        'nonBillableTasks',
        t('timeLogsColNonBillableTasks', { defaultValue: 'Non-billable Tasks' }),
        group => group.non_billable_task_count
      ),
      rollup(
        'nonBillableTime',
        t('timeLogsColNonBillableTime', { defaultValue: 'Non-billable Time' }),
        group => formatLoggedDuration(group.non_billable_time)
      ),
      rollup('totalTime', t('timeLogsColTotalTime', { defaultValue: 'Total Time' }), group => (
        <Text strong>{formatLoggedDuration(group.subtotal)}</Text>
      )),
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `renderIdentity` follows groupBy / theme
  }, [t, groupBy, openKeys, toggle, getGroupLabel, renderIdentity, token.colorSuccess]);

  const skeletonData = useMemo(() => buildSkeletonRows<ITimeLogGroup & { id?: string }>(pageSize), [
    pageSize,
  ]);
  const visibleColumns = useMemo(
    () => (isFirstLoad ? toSkeletonColumns(columns) : columns),
    [columns, isFirstLoad]
  );

  const scrollConfig = useMemo(() => ({ x: SCROLL_X, y: scrollY }), [scrollY]);
  const shownTotalGroups = failed ? 0 : totalGroups;

  const emptyContent = (
    <TimeLogsEmptyState failed={failed} onRetry={onRetry} onClearFilters={onClearFilters} />
  );

  // The total covers every group matching the filters — not just this page — pinned below the rows.
  const renderSummary = () => (
    <Table.Summary fixed="bottom">
      <Table.Summary.Row>
        <Table.Summary.Cell index={0} colSpan={COLUMN_COUNT - 1}>
          <Flex justify="space-between" align="center" gap={8}>
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
        </Table.Summary.Cell>
        <Table.Summary.Cell index={COLUMN_COUNT - 1} align="center">
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
          <Table<ITimeLogGroup>
            showSorterTooltip={false}
            columns={visibleColumns}
            dataSource={
              isFirstLoad ? (skeletonData as ITimeLogGroup[]) : failed ? [] : groups
            }
            rowKey={group => group.group_key ?? (group as { id?: string }).id ?? ''}
            pagination={false}
            scroll={scrollConfig}
            summary={renderSummary}
            loading={loading && !isFirstLoad}
            onRow={group => ({
              style: { height: ROW_HEIGHT, cursor: 'pointer' },
              onClick: isFirstLoad ? undefined : () => toggle(group.group_key),
            })}
            // While a later response is in flight the overlay spinner is the only thing to show —
            // not a premature "nothing logged" message underneath it.
            locale={{ emptyText: loading ? <div style={{ minHeight: 120 }} /> : emptyContent }}
            expandable={{
              showExpandColumn: false,
              expandedRowKeys: Array.from(openKeys),
              expandedRowRender: group => (
                <TimeLogsGroupEntries
                  id={`time-logs-group-${groupBy}-${group.group_key}`}
                  groupBy={groupBy}
                  groupKey={group.group_key}
                  groupLabel={getGroupLabel(group)}
                  entryCount={group.entry_count}
                  filterRequest={filterRequest}
                  onOpenTask={onOpenTask}
                />
              ),
            }}
          />
        </div>

        <TimeLogsPaginationBar
          page={page}
          pageSize={pageSize}
          total={shownTotalGroups}
          onPageChange={onPageChange}
        />
      </div>
    </ConfigProvider>
  );
};
