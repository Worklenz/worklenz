import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { Flex, Input, Tooltip, Typography, message, theme } from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import { useGetProjectTasksQuery, useUpdatePortalTaskMutation } from '@/api/client-portal/portal-projects-api';
import {
  PortalAvatar,
  PortalPagedTable,
  VisibilitySwitch,
  formatPortalDate,
  useDebouncedValue,
  usePortalPaging,
  useVisibilityToast,
} from '@/components/client-portal/v2';
import type { PortalProject, PortalTask, PortalVisibility } from '@/types/client-portal/v2';
import { TaskDrawer } from './TaskDrawer';
import { useTaskStatusLabels } from './task-labels';

interface TasksTabProps {
  project: PortalProject;
}

type TaskFilter = 'all' | PortalVisibility;

/** Tasks stay managed in WorkLenz; here staff decide which ones the client sees, and in what words. */
export const TasksTab = ({ project }: TasksTabProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-projects');
  const { token } = theme.useToken();
  const labels = useTaskStatusLabels();
  const showVisibilityToast = useVisibilityToast();
  const paging = usePortalPaging();

  const [filter, setFilter] = useState<TaskFilter>('all');
  const [search, setSearch] = useState('');
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);
  const debouncedSearch = useDebouncedValue(search);

  useEffect(() => {
    paging.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, debouncedSearch]);

  const query = useGetProjectTasksQuery({
    projectId: project.id,
    params: {
      page: paging.page,
      limit: paging.limit,
      search: debouncedSearch.trim() || undefined,
      visibility: filter === 'all' ? undefined : filter,
    },
  });
  const [updateTask, { isLoading: isUpdating }] = useUpdatePortalTaskMutation();
  const list = query.data?.body;
  const counts = list?.counts;
  const openTask = list?.items.find(task => task.id === openTaskId) ?? null;

  const changeVisibility = async (task: PortalTask, visibility: PortalVisibility) => {
    try {
      await updateTask({ projectId: project.id, taskId: task.id, body: { visibility } }).unwrap();
      showVisibilityToast('task', task.client_title || task.title, visibility);
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('tasks.visibilityFailed', { defaultValue: 'The visibility could not be changed.' })));
    }
  };

  const columns: ColumnsType<PortalTask> = [
    {
      key: 'task',
      title: t('tasks.columns.task', { defaultValue: 'Task' }),
      render: (_value, task) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{task.title}</div>
          <div style={{ fontSize: 11.5, color: token.colorTextTertiary }}>{task.key}</div>
        </div>
      ),
    },
    {
      key: 'status',
      title: t('tasks.columns.status', { defaultValue: 'Status' }),
      render: (_value, task) => labels.internal[task.status],
    },
    {
      key: 'due',
      title: t('tasks.columns.due', { defaultValue: 'Due' }),
      render: (_value, task) => formatPortalDate(task.due_date, i18n.language) ?? '—',
    },
    {
      key: 'assignee',
      title: t('tasks.columns.assignee', { defaultValue: 'Assignee' }),
      render: (_value, task) =>
        task.assignee ? (
          <Tooltip title={task.assignee.name}>
            <span style={{ display: 'inline-flex' }}>
              <PortalAvatar name={task.assignee.name} color={task.assignee.color} />
            </span>
          </Tooltip>
        ) : (
          '—'
        ),
    },
    {
      key: 'client_sees',
      title: t('tasks.columns.clientSees', { defaultValue: 'Client sees' }),
      render: (_value, task) =>
        task.visibility === 'client' ? (
          <div style={{ fontSize: 12.5 }}>
            {task.client_title || task.title}
            <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>{labels.client[task.status]}</div>
          </div>
        ) : (
          <Typography.Text type="secondary">{t('tasks.hidden', { defaultValue: 'Hidden' })}</Typography.Text>
        ),
    },
    {
      key: 'visible',
      title: t('tasks.columns.visible', { defaultValue: 'Client visible' }),
      render: (_value, task) => (
        // The row opens the drawer on click, so the switch must not bubble to it.
        <span onClick={event => event.stopPropagation()}>
          <VisibilitySwitch
            visibility={task.visibility}
            itemLabel={task.title}
            disabled={isUpdating}
            onChange={visibility => void changeVisibility(task, visibility)}
          />
        </span>
      ),
    },
  ];

  return (
    <div>
      <Flex justify="space-between" align="center" wrap="wrap" gap={10} style={{ marginBottom: 12 }}>
        <PillToggle<TaskFilter>
          value={filter}
          onChange={setFilter}
          ariaLabel={t('tasks.filterLabel', { defaultValue: 'Filter tasks by visibility' })}
          options={[
            { value: 'all', label: t('tasks.filterAll', { count: counts?.all ?? 0, defaultValue: 'All ({{count}})' }) },
            {
              value: 'client',
              label: t('tasks.filterClient', { count: counts?.client ?? 0, defaultValue: 'Client visible ({{count}})' }),
            },
            {
              value: 'internal',
              label: t('tasks.filterInternal', { count: counts?.internal ?? 0, defaultValue: 'Internal only ({{count}})' }),
            },
          ]}
        />
        <Input
          allowClear
          style={{ maxWidth: 260 }}
          prefix={<SearchOutlined />}
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder={t('tasks.search', { defaultValue: 'Search tasks…' })}
          aria-label={t('tasks.search', { defaultValue: 'Search tasks…' })}
        />
      </Flex>
      <Typography.Paragraph type="secondary" style={{ fontSize: 12.5 }}>
        {t('tasks.intro', {
          defaultValue: 'Tasks are managed in WorkLenz as usual. Every task is Internal Only until you share it.',
        })}
      </Typography.Paragraph>

      <PortalPagedTable<PortalTask>
        ariaLabel={t('tasks.tableLabel', { defaultValue: 'Tasks' })}
        columns={columns}
        rows={list?.items ?? []}
        rowKey={task => task.id}
        total={list?.total ?? 0}
        paging={paging}
        loading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        onRowClick={task => setOpenTaskId(task.id)}
        emptyText={t('tasks.empty', { defaultValue: 'No tasks in this view.' })}
      />

      {openTask && <TaskDrawer key={openTask.id} project={project} task={openTask} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
};
