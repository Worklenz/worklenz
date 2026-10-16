import React from 'react';
import { Flex, Skeleton, Empty, Badge, Button } from '@/shared/antd-imports';
import { RightOutlined, DownOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import {
  ITimeEntriesGroup,
  TimeEntriesGroupBy,
  TimeEntriesScope,
  taskTimeLogsApiService,
} from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesGroupEntryRow } from './TimeEntriesGroupEntryRow';
import AvatarGroup from '@/components/AvatarGroup';
import { useAppSelector } from '@/hooks/useAppSelector';
import TablePagination from '@/components/TablePagination';
import {
  GROUPED_COLUMN_WIDTHS,
  ROLLUP_COLUMN_WIDTHS,
  flexCol,
  getGroupedColumnVisibility,
  getGroupIdentityColumnKey,
  getRollupSecondaryColumn,
} from './time-entries-grouped-columns';
import { formatLoggedDuration } from './time-entries-format';
import '@/pages/time-entries/time-entries.css';

const headerTextStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

interface GroupColumnHeaderProps {
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>;
  scope: TimeEntriesScope;
}

// A rollup summary, not a mirror of the flat table's per-entry columns — a
// collapsed group has no single Status/Priority/Description etc. across
// however many entries it holds, so this header describes what the group
// ROW actually shows: how much of the group's time is billable vs not, and
// (depending on what's being grouped by) how many distinct projects or
// members contributed to it. The per-entry column set only applies once a
// group is expanded — see GroupEntryColumnHeader below.
const GroupColumnHeader: React.FC<GroupColumnHeaderProps> = ({ groupBy, scope }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const secondary = getRollupSecondaryColumn(groupBy, scope);
  // Full-contrast text, matching the flat table's own header
  // (.time-entries-log-table .ant-table-thead th in time-entries.css) — not
  // dimmed to colorTextSecondary, which read as noticeably fainter than the
  // flat table's headers when placed side by side.
  const textStyle: React.CSSProperties = { ...headerTextStyle, color: token.colorText };

  return (
    <Flex
      align="center"
      gap={12}
      style={{
        padding: '8px 16px',
        background: token.colorFillQuaternary,
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      <span style={{ width: 20, flexShrink: 0 }} />
      <span style={{ ...textStyle, ...flexCol(220), minWidth: 140 }}>
        {t(getGroupIdentityColumnKey(groupBy), { defaultValue: 'Group' })}
      </span>
      {secondary && (
        <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.secondary) }}>
          {t(secondary.labelKey, { defaultValue: secondary.defaultLabel })}
        </span>
      )}
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.totalEntries) }}>
        {t('colTotalEntries', { defaultValue: 'Total Entries' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.billableEntries) }}>
        {t('colBillableEntries', { defaultValue: 'Billable Entries' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.billableTasks) }}>
        {t('colBillableTasks', { defaultValue: 'Billable Tasks' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.billableTime) }}>
        {t('colBillableTime', { defaultValue: 'Billable Time' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.nonBillableEntries) }}>
        {t('colNonBillableEntries', { defaultValue: 'Non-billable Entries' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.nonBillableTasks) }}>
        {t('colNonBillableTasks', { defaultValue: 'Non-billable Tasks' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(ROLLUP_COLUMN_WIDTHS.nonBillableTime) }}>
        {t('colNonBillableTime', { defaultValue: 'Non-billable Time' })}
      </span>
    </Flex>
  );
};

interface GroupEntryColumnHeaderProps {
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>;
  scope: TimeEntriesScope;
}

// Shown only above an expanded group's own entries — this is where the
// flat table's per-entry column set (Task/Member/Project/Status/Priority/
// Billable/Description/Time/Due Date/Created) actually applies, since only
// individual entries have single values for those fields.
const GroupEntryColumnHeader: React.FC<GroupEntryColumnHeaderProps> = ({ groupBy, scope }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const { showMember, showProject } = getGroupedColumnVisibility(groupBy, scope);
  const textStyle: React.CSSProperties = { ...headerTextStyle, color: token.colorText };

  return (
    <Flex align="center" gap={12} style={{ padding: '6px 16px', background: token.colorFillQuaternary, borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
      <span style={{ width: 20, flexShrink: 0 }} />
      <span style={{ ...flexCol(220), minWidth: 140 }} />
      <span style={{ ...textStyle, ...flexCol(200), minWidth: 130 }}>
        {t('colTask', { defaultValue: 'Task' })}
      </span>
      {showMember && (
        <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.member) }}>
          {t('colMember', { defaultValue: 'Member' })}
        </span>
      )}
      {showProject && (
        <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.project) }}>
          {t('colProject', { defaultValue: 'Project' })}
        </span>
      )}
      <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.status) }}>
        {t('colStatus', { defaultValue: 'Status' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.priority) }}>
        {t('colPriority', { defaultValue: 'Priority' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.billable) }}>
        {t('colBillable', { defaultValue: 'Billable' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(160), minWidth: 120 }}>
        {t('colDescription', { defaultValue: 'Description' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.time) }}>
        {t('colTimeLogged', { defaultValue: 'Time Logged' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.dueDate) }}>
        {t('colDueDate', { defaultValue: 'Due Date' })}
      </span>
      <span style={{ ...textStyle, ...flexCol(GROUPED_COLUMN_WIDTHS.createdAt) }}>
        {t('colLoggedOn', { defaultValue: 'Logged On' })}
      </span>
      <span style={{ width: GROUPED_COLUMN_WIDTHS.actions, flexShrink: 0 }} />
    </Flex>
  );
};

interface GroupHeaderProps {
  group: ITimeEntriesGroup;
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>;
  scope: TimeEntriesScope;
  expanded: boolean;
  onToggle: () => void;
}

const GroupHeader: React.FC<GroupHeaderProps> = ({ group, groupBy, scope, expanded, onToggle }) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const [hovered, setHovered] = React.useState(false);
  const secondary = getRollupSecondaryColumn(groupBy, scope);
  const secondaryValue = secondary?.field === 'project_count' ? group.project_count : group.member_count;

  const label = group.group_label || (
    groupBy === 'client' ? t('noClient', { defaultValue: 'No client' }) : t('unknown', { defaultValue: 'Unknown' })
  );

  return (
    <Flex
      align="center"
      gap={12}
      style={{
        padding: '10px 16px',
        cursor: 'pointer',
        background: hovered || expanded ? token.colorFillQuaternary : 'transparent',
        transition: 'background 0.15s ease',
      }}
      onClick={onToggle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Button
        type="text"
        size="small"
        icon={expanded ? <DownOutlined style={{ fontSize: 10 }} /> : <RightOutlined style={{ fontSize: 10 }} />}
        style={{ flexShrink: 0, padding: 0, width: 20, height: 20 }}
        onClick={e => { e.stopPropagation(); onToggle(); }}
      />

      {/* Identity column — the group's own dimension (member/client/project),
          taking the place of whichever regular column it would otherwise
          duplicate. */}
      <Flex align="center" gap={8} style={{ ...flexCol(220), minWidth: 140, overflow: 'hidden' }}>
        {groupBy === 'member' && (
          <AvatarGroup
            members={[
              {
                team_member_id: group.group_key,
                name: group.group_label || '',
                avatar_url: group.group_avatar_url || undefined,
                color_code: group.group_color || undefined,
              },
            ]}
            size={22}
            isDarkMode={themeMode === 'dark'}
          />
        )}
        {groupBy === 'project' && group.group_color && (
          <Badge color={group.group_color} />
        )}

        <span style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </Flex>

      {secondary && (
        <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.secondary), fontSize: 12 }}>
          {secondaryValue}
        </span>
      )}

      <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.totalEntries), fontSize: 12 }}>
        {group.entry_count}
      </span>

      <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.billableEntries), fontSize: 12, opacity: 0.85 }}>
        {group.billable_entry_count}
      </span>
      <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.billableTasks), fontSize: 12, opacity: 0.85 }}>
        {group.billable_task_count}
      </span>
      <span
        style={{
          ...flexCol(ROLLUP_COLUMN_WIDTHS.billableTime),
          fontSize: 12,
          fontWeight: 500,
          color: '#52c41a',
        }}
      >
        {formatLoggedDuration(group.billable_time)}
      </span>

      <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.nonBillableEntries), fontSize: 12, opacity: 0.85 }}>
        {group.non_billable_entry_count}
      </span>
      <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.nonBillableTasks), fontSize: 12, opacity: 0.85 }}>
        {group.non_billable_task_count}
      </span>
      <span style={{ ...flexCol(ROLLUP_COLUMN_WIDTHS.nonBillableTime), fontSize: 12, opacity: 0.75 }}>
        {formatLoggedDuration(group.non_billable_time)}
      </span>
    </Flex>
  );
};

interface TimeEntriesGroupedListProps {
  groups: ITimeEntriesGroup[];
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>;
  scope: TimeEntriesScope;
  loading: boolean;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number, pageSize: number) => void;
  onEntryChange: () => void;
}

export const TimeEntriesGroupedList: React.FC<TimeEntriesGroupedListProps> = ({
  groups,
  groupBy,
  scope,
  loading,
  total,
  page,
  pageSize,
  onPageChange,
  onEntryChange,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const [expandedKeys, setExpandedKeys] = React.useState<Set<string>>(new Set());

  const toggle = (key: string) => {
    setExpandedKeys(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleDelete = async (entryId: string, taskId: string) => {
    try {
      await taskTimeLogsApiService.deleteEntry(entryId, taskId);
      onEntryChange();
    } catch {
      // The API client already toasted the reason (e.g. "You can only delete your own time entries.").
    }
  };

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        overflow: 'hidden',
      }}
    >
      {loading ? (
        [1, 2, 3].map(i => (
          <div key={i} style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Skeleton active paragraph={{ rows: 0 }} title={{ width: '60%' }} />
          </div>
        ))
      ) : groups.length === 0 ? (
        <Empty
          description={t('noEntriesDescription', { defaultValue: 'No time entries match your current filters.' })}
          style={{ padding: '32px 16px' }}
        />
      ) : (
        <>
          {/* Hand-rolled flex rows (not an antd Table) don't reflow onto
              multiple lines the way table columns collapse — below the phone
              breakpoint this scrolls horizontally instead of overflowing the
              viewport, mirroring the flat table's own mobile handling.
              The same element also scrolls vertically at every screen size,
              capped to the space actually available — as the flex sibling of
              the fixed-size pagination bar below it (flex: 1 1 auto), the
              browser's own layout keeps its height exactly in sync with it,
              so the page itself never scrolls — only the group list does,
              matching the Flat table's `scroll.y` / Recurring Tasks' own
              table. */}
          <div className="time-entries-scroll-list" style={{ overflowY: 'auto', flex: '1 1 auto', minHeight: 200 }}>
            <div className="time-entries-scroll-list-inner">
              <GroupColumnHeader groupBy={groupBy} scope={scope} />
              {groups.map(group => {
                const expanded = expandedKeys.has(group.group_key);
                return (
                  <div key={group.group_key} style={{ borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
                    <GroupHeader group={group} groupBy={groupBy} scope={scope} expanded={expanded} onToggle={() => toggle(group.group_key)} />
                    {expanded && group.entries.length > 0 && (
                      <>
                        <GroupEntryColumnHeader groupBy={groupBy} scope={scope} />
                        {group.entries.map(entry => (
                          <TimeEntriesGroupEntryRow
                            key={entry.id}
                            entry={entry}
                            groupBy={groupBy}
                            scope={scope}
                            onDelete={handleDelete}
                            onUpdate={onEntryChange}
                          />
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ flexShrink: 0 }}>
            <TablePagination
              page={page}
              pageSize={pageSize}
              total={total}
              onPageChange={onPageChange}
              rowsPerPageLabel={t('rowsPerPage', { defaultValue: 'Rows per page:' })}
            />
          </div>
        </>
      )}
    </div>
  );
};
