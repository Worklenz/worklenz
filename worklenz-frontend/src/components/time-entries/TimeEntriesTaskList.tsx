import React from 'react';
import { Flex, Typography, Skeleton, Empty, Alert, Button, Pagination } from '@/shared/antd-imports';
import { PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { theme } from 'antd';
import dayjs from 'dayjs';
import { IMyTaskWithLogs } from '@/api/tasks/task-time-logs.api.service';
import { TimeEntriesTaskRow } from './TimeEntriesTaskRow';

const { Text } = Typography;

interface TimeEntriesTaskListProps {
  tasks: IMyTaskWithLogs[];
  loading: boolean;
  fallbackDate: string | null;
  onEntryChange: () => void;
  onLogTime: () => void;
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export const TimeEntriesTaskList: React.FC<TimeEntriesTaskListProps> = ({
  tasks,
  loading,
  fallbackDate,
  onEntryChange,
  onLogTime,
  total,
  page,
  pageSize,
  onPageChange,
}) => {
  const { t } = useTranslation('time-entries');
  const { token } = theme.useToken();

  const fallbackLabel = React.useMemo(() => {
    if (!fallbackDate) return null;
    if (fallbackDate === 'yesterday') return dayjs().subtract(1, 'day').format('dddd, MMM D');
    return dayjs(fallbackDate).format('dddd, MMM D');
  }, [fallbackDate]);

  if (loading) {
    return (
      <div
        style={{
          border: `1px solid ${token.colorBorderSecondary}`,
          borderRadius: token.borderRadiusLG,
          overflow: 'hidden',
        }}
      >
        {[1, 2, 3].map(i => (
          <div key={i} style={{ padding: '12px 16px', borderBottom: `1px solid ${token.colorBorderSecondary}` }}>
            <Skeleton active paragraph={{ rows: 0 }} title={{ width: '60%' }} />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        overflow: 'hidden',
      }}
    >
      {/* Column header */}
      <Flex
        align="center"
        justify="space-between"
        style={{
          padding: '8px 16px',
          background: token.colorFillQuaternary,
          borderBottom: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, flex: 1, paddingLeft: 28 }}>
          {t('colTask', { defaultValue: 'Task' })}
        </Text>
        <Flex gap={16} style={{ flexShrink: 0 }}>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, minWidth: 140, textAlign: 'right' }}>
            {t('colProject', { defaultValue: 'Project' })}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, minWidth: 60, textAlign: 'center' }}>
            {t('colDueDate', { defaultValue: 'Due Date' })}
          </Text>
          <Text type="secondary" style={{ fontSize: 12, fontWeight: 500, minWidth: 60, textAlign: 'right' }}>
            {t('colTimeLogged', { defaultValue: 'Time Logged' })}
          </Text>
        </Flex>
      </Flex>

      {/* Fallback notice */}
      {fallbackLabel && (
        <Alert
          message={t('fallbackNotice', { defaultValue: `Showing time logged ${fallbackLabel}`, date: fallbackLabel })}
          type="info"
          showIcon
          style={{ borderRadius: 0, border: 'none', borderBottom: `1px solid ${token.colorBorderSecondary}` }}
        />
      )}

      {/* Task rows */}
      {tasks.length === 0 ? (
        <Empty
          description={t('noTasksDescription', { defaultValue: 'No tasks match your current filters.' })}
          style={{ padding: '32px 16px' }}
        />
      ) : (
        tasks.map(task => (
          <TimeEntriesTaskRow
            key={task.task_id}
            task={task}
            onEntryChange={onEntryChange}
          />
        ))
      )}

      {/* Log time row */}
      <Flex
        align="center"
        gap={8}
        style={{
          padding: '10px 16px',
          cursor: 'pointer',
          color: token.colorTextSecondary,
          borderTop: tasks.length > 0 ? `1px solid ${token.colorBorderSecondary}` : undefined,
        }}
        onClick={onLogTime}
      >
        <Button
          type="text"
          size="small"
          icon={<PlusOutlined />}
          style={{ color: token.colorPrimary, padding: 0 }}
        />
        <Text style={{ color: token.colorPrimary, fontSize: 13 }}>
          {t('logTimeRow', { defaultValue: 'Log time for a task' })}
        </Text>
      </Flex>

      {/* Pagination */}
      {total > pageSize && (
        <Flex justify="flex-end" style={{ padding: '12px 16px', borderTop: `1px solid ${token.colorBorderSecondary}` }}>
          <Pagination
            current={page}
            pageSize={pageSize}
            total={total}
            onChange={onPageChange}
            showSizeChanger={false}
            showTotal={tot => t('paginationTotal', { defaultValue: `{{total}} tasks`, total: tot })}
            size="small"
          />
        </Flex>
      )}
    </div>
  );
};
