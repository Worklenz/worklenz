import React from 'react';
import { Flex, Typography, Tooltip, Popconfirm, Button, Badge, Tag } from '@/shared/antd-imports';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import dayjs from 'dayjs';
import { IGroupedTimeEntry, TimeEntriesGroupBy, TimeEntriesScope } from '@/api/tasks/task-time-logs.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { TruncatedColoredTag } from '@/components/common/truncated-colored-tag/TruncatedColoredTag';
import { GROUPED_COLUMN_WIDTHS, flexCol, getGroupedColumnVisibility } from './time-entries-grouped-columns';
import { formatLoggedDuration, formatLoggedOnDate, formatLoggedOnTooltip } from './time-entries-format';
import { TimeEntryMemberAvatars } from './TimeEntryMemberAvatars';
import { useCanEditTimeEntry } from './useCanEditTimeEntry';
import { EditTimeEntryModal } from './EditTimeEntryModal';
import '@/pages/time-entries/time-entries.css';

const { Text } = Typography;

interface TimeEntriesGroupEntryRowProps {
  entry: IGroupedTimeEntry;
  groupBy: Exclude<TimeEntriesGroupBy, 'none'>;
  scope: TimeEntriesScope;
  onDelete: (entryId: string, taskId: string) => void;
  onUpdate: () => void;
}

export const TimeEntriesGroupEntryRow: React.FC<TimeEntriesGroupEntryRowProps> = ({
  entry,
  groupBy,
  scope,
  onDelete,
  onUpdate,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  // Only the person who logged an entry - or an owner/admin - may edit or delete it.
  const canEditEntry = useCanEditTimeEntry();
  const canEdit = canEditEntry(entry.user_id);
  const [editing, setEditing] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  // Same redundancy rules as the group header/column header: a column is
  // only shown when it isn't already the group's own identity.
  const { showMember, showProject } = getGroupedColumnVisibility(groupBy, scope);

  return (
    <>
      <Flex
        align="center"
        gap={12}
        style={{
          padding: '6px 16px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Leading spacer matching the group header's toggle-button + identity
            column — kept blank here (the group already carries that value) so
            every column to the right lines up with the header above. */}
        <span style={{ width: 20, flexShrink: 0 }} />
        <span style={{ ...flexCol(220), minWidth: 140 }} />

        <Flex align="center" gap={6} style={{ ...flexCol(200), minWidth: 130, overflow: 'hidden' }}>
          <Badge color={entry.project_color || token.colorPrimary} />
          <Text
            style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={entry.task_name}
          >
            {entry.task_name}
          </Text>
        </Flex>

        {showMember && (
          <Flex align="center" style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.member), overflow: 'hidden' }}>
            <TimeEntryMemberAvatars
              members={[
                {
                  user_id: entry.user_id,
                  user_name: entry.user_name,
                  avatar_url: entry.avatar_url,
                  color_code: entry.user_color_code,
                },
              ]}
            />
          </Flex>
        )}

        {showProject && (
          <Flex align="center" gap={6} style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.project), overflow: 'hidden' }}>
            <Badge color={entry.project_color || token.colorPrimary} />
            <Text style={{ fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.project_name}
            </Text>
          </Flex>
        )}

        <div style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.status), overflow: 'hidden' }}>
          {entry.status_name ? (
            <TruncatedColoredTag
              label={entry.status_name}
              color={themeMode === 'dark' ? entry.status_color_dark ?? undefined : entry.status_color ?? undefined}
            />
          ) : null}
        </div>

        <div style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.priority), overflow: 'hidden' }}>
          {entry.priority_name ? (
            <Tag
              color={(themeMode === 'dark' ? entry.priority_color_dark : entry.priority_color) ?? undefined}
              style={{ margin: 0, fontSize: 11 }}
            >
              {entry.priority_name}
            </Tag>
          ) : null}
        </div>

        <span style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.billable), fontSize: 12 }}>
          {entry.billable ? t('billableYes', { defaultValue: 'Yes' }) : t('billableNo', { defaultValue: 'No' })}
        </span>

        <Tooltip title={entry.description}>
          <Text
            type="secondary"
            style={{
              fontSize: 12,
              ...flexCol(160),
              minWidth: 120,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {entry.description || '—'}
          </Text>
        </Tooltip>

        <span style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.time), fontSize: 12 }}>
          {formatLoggedDuration(entry.time_spent)}
        </span>

        <span style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.dueDate), fontSize: 11, opacity: 0.65 }}>
          {entry.due_date ? dayjs(entry.due_date).format('MMM D') : t('noDueDate', { defaultValue: 'No due date' })}
        </span>

        <span
          style={{ ...flexCol(GROUPED_COLUMN_WIDTHS.createdAt), fontSize: 11, opacity: 0.75 }}
          title={formatLoggedOnTooltip(entry.created_at)}
        >
          {formatLoggedOnDate(entry.created_at)}
        </span>

        <Flex
          gap={4}
          className="time-entries-row-actions"
          style={{ width: GROUPED_COLUMN_WIDTHS.actions, flexShrink: 0, visibility: hovered ? 'visible' : 'hidden', justifyContent: 'flex-end' }}
        >
          {/* The slot stays (so columns line up) but is empty for entries you can't change. */}
          {canEdit && (
            <>
              <Tooltip title={t('editEntry', { defaultValue: 'Edit' })}>
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  aria-label={t('editEntry', { defaultValue: 'Edit' })}
                  onClick={() => setEditing(true)}
                />
              </Tooltip>
              <Popconfirm
                title={t('deleteEntryConfirm', { defaultValue: 'Delete this time entry?' })}
                okText={t('deleteEntryOk', { defaultValue: 'Delete' })}
                cancelText={t('deleteEntryCancel', { defaultValue: 'Cancel' })}
                onConfirm={() => onDelete(entry.id, entry.task_id)}
                okButtonProps={{ danger: true }}
              >
                <Button
                  type="text"
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  title={t('deleteEntry', { defaultValue: 'Delete' })}
                  aria-label={t('deleteEntry', { defaultValue: 'Delete' })}
                />
              </Popconfirm>
            </>
          )}
        </Flex>
      </Flex>

      <EditTimeEntryModal
        entry={editing ? entry : null}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          onUpdate();
        }}
      />
    </>
  );
};
