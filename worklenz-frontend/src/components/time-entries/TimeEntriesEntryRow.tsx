import React from 'react';
import { Flex, Typography, Tooltip, Popconfirm, Button } from '@/shared/antd-imports';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import dayjs from 'dayjs';
import { IMyTaskTimeLog } from '@/api/tasks/task-time-logs.api.service';
import TimeLogForm from '@/components/task-drawer/shared/time-log/time-log-form';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';

const { Text } = Typography;

const formatSeconds = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

interface TimeEntriesEntryRowProps {
  entry: IMyTaskTimeLog;
  taskId: string;
  projectId: string;
  onDelete: (entryId: string) => void;
  onUpdate: () => void;
}

export const TimeEntriesEntryRow: React.FC<TimeEntriesEntryRowProps> = ({
  entry,
  taskId,
  projectId,
  onDelete,
  onUpdate,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();
  const [editing, setEditing] = React.useState(false);
  const [hovered, setHovered] = React.useState(false);

  const initialValues: ITaskLogViewModel = {
    id: entry.id,
    time_spent: entry.time_spent,
    description: entry.description ?? undefined,
    created_at: entry.created_at,
    logged_by_timer: entry.logged_by_timer,
  };

  if (editing) {
    return (
      <div
        style={{
          padding: '8px 16px 8px 48px',
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
          background: token.colorFillQuaternary,
        }}
      >
        <TimeLogForm
          mode="edit"
          initialValues={initialValues}
          taskId={taskId}
          projectId={projectId}
          onCancel={() => setEditing(false)}
          onSubmitSuccess={() => {
            setEditing(false);
            onUpdate();
          }}
        />
      </div>
    );
  }

  return (
    <Flex
      align="center"
      justify="space-between"
      style={{
        padding: '6px 16px 6px 48px',
        borderBottom: `1px solid ${token.colorBorderSecondary}`,
        background: token.colorFillQuaternary,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Text type="secondary" style={{ fontSize: 12, minWidth: 90 }}>
        {dayjs(entry.created_at).format('MMM D, YYYY')}
      </Text>
      <Text
        style={{
          fontSize: 12,
          fontFamily: 'monospace',
          fontWeight: 600,
          minWidth: 60,
          color: token.colorTextSecondary,
        }}
      >
        {formatSeconds(entry.time_spent)}
      </Text>
      <Tooltip title={entry.description}>
        <Text
          type="secondary"
          style={{
            fontSize: 12,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            marginInline: 16,
          }}
        >
          {entry.description || '—'}
        </Text>
      </Tooltip>
      <Flex gap={4} style={{ visibility: hovered ? 'visible' : 'hidden' }}>
        <Tooltip title={t('editEntry', { defaultValue: 'Edit' })}>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => setEditing(true)}
          />
        </Tooltip>
        <Popconfirm
          title={t('deleteEntryConfirm', { defaultValue: 'Delete this time entry?' })}
          okText={t('deleteEntryOk', { defaultValue: 'Delete' })}
          cancelText={t('deleteEntryCancel', { defaultValue: 'Cancel' })}
          onConfirm={() => onDelete(entry.id)}
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      </Flex>
    </Flex>
  );
};
