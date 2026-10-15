import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge, Flex, Tag, Typography } from '@/shared/antd-imports';
import { ExpandAltOutlined } from '@/shared/antd-imports';
import AvatarGroup from '@/components/AvatarGroup';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { openReportingTaskDrawer } from '@/utils/reporting/openReportingTaskDrawer';
import type { TimeInStatusTask } from '@/api/reporting/progress-chart.api.service';
import { formatDwell } from '../report-shell';

/** Opens the shared task drawer for a report row. */
export const useOpenTimeInStatusTask = () => {
  const dispatch = useAppDispatch();
  return useCallback(
    (task: TimeInStatusTask) =>
      openReportingTaskDrawer(
        dispatch,
        {
          id: task.id,
          name: task.name,
          task_key: task.task_key ?? undefined,
          status_name: task.status_name,
          status_color: task.status_color,
        },
        task.project_id
      ),
    [dispatch]
  );
};

export const TaskKeyCell = ({ task }: { task: TimeInStatusTask }) => (
  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
    {task.task_key || '-'}
  </Typography.Text>
);

/** Task name that opens the drawer; the expand icon only shows on row hover (row needs the `group` class). */
export const TaskNameCell = ({ task, onOpen }: { task: TimeInStatusTask; onOpen: (task: TimeInStatusTask) => void }) => {
  const { t } = useTranslation('reporting-flow');
  return (
    <Flex
      align="center"
      justify="space-between"
      gap={8}
      style={{ cursor: 'pointer' }}
      role="button"
      tabIndex={0}
      aria-label={t('tis.openTask', { defaultValue: 'Open task {{name}}', name: task.name })}
      onClick={() => onOpen(task)}
      onKeyDown={event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onOpen(task);
        }
      }}
    >
      <Typography.Text ellipsis={{ tooltip: task.name }} style={{ minWidth: 0 }}>
        {task.name}
      </Typography.Text>
      <ExpandAltOutlined className="hidden group-hover:flex" style={{ flexShrink: 0 }} aria-hidden />
    </Flex>
  );
};

export const ProjectNameCell = ({ task }: { task: TimeInStatusTask }) => (
  <Flex align="center" gap={6} style={{ minWidth: 0 }}>
    <Badge color={task.project_color} />
    <Typography.Text ellipsis={{ tooltip: task.project_name }}>{task.project_name}</Typography.Text>
  </Flex>
);

export const StatusCell = ({ task }: { task: TimeInStatusTask }) => (
  <Tag color={task.status_color} style={{ margin: 0, borderRadius: 48 }}>
    {task.status_name}
  </Tag>
);

export const TimeInStatusCell = ({ task }: { task: TimeInStatusTask }) => (
  <Typography.Text type={task.hours_overdue !== null ? 'danger' : undefined}>{formatDwell(task.hours_in_status)}</Typography.Text>
);

export const TimeOverdueCell = ({ task }: { task: TimeInStatusTask }) =>
  task.hours_overdue === null ? (
    <Typography.Text type="secondary">-</Typography.Text>
  ) : (
    <Typography.Text type="danger">{formatDwell(task.hours_overdue)}</Typography.Text>
  );

export const AssigneesCell = ({ task }: { task: TimeInStatusTask }) => {
  const { t } = useTranslation('reporting-flow');
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');
  if (!task.assignees.length) {
    return <Typography.Text type="secondary">{t('tis.unassigned', { defaultValue: 'Unassigned' })}</Typography.Text>;
  }
  return <AvatarGroup members={task.assignees.map(a => ({ id: a.id, name: a.name, avatar_url: a.avatar_url ?? undefined }))} maxCount={3} isDarkMode={isDarkMode} size={24} />;
};

export const LastUpdatedCell = ({ task }: { task: TimeInStatusTask }) => (
  <Typography.Text style={{ fontSize: 12 }}>
    {new Date(task.updated_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
  </Typography.Text>
);
