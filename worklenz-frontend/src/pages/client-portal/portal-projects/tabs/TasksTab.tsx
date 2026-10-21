import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { SearchOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import {
  Button,
  Flex,
  Input,
  Tooltip,
  Typography,
  message,
  theme,
} from '@/shared/antd-imports';
import PillToggle from '@/pages/home/PillToggle';
import { getPortalErrorMessage } from '@/api/client-portal/portal-api-utils';
import {
  useGetProjectTasksQuery,
  useUpdatePortalTaskMutation,
  useBulkUpdatePortalTaskVisibilityMutation,
} from '@/api/client-portal/portal-projects-api';
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
import { decodeHtmlEntities } from '@/utils/html-entities';

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

  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isBulkSaving, setIsBulkSaving] = useState(false);
  const bulkRequestInProgress = useRef(false);

  useEffect(() => {
    setSelectedTaskIds([]);
  }, [
    project.id,
    filter,
    search,
    paging.page,
    paging.limit,
  ]);

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
  const [bulkUpdateVisibility] =
    useBulkUpdatePortalTaskVisibilityMutation();

  const controlsDisabled =
    isUpdating ||
    isBulkSaving ||
    query.isFetching ||
    query.isError ||
    search !== debouncedSearch;

  const changeVisibility = async (task: PortalTask, visibility: PortalVisibility) => {
    if (controlsDisabled) return;
    try {
      await updateTask({ projectId: project.id, taskId: task.id, body: { visibility } }).unwrap();
      showVisibilityToast('task', task.client_title || decodeHtmlEntities(task.title), visibility);
    } catch (error) {
      message.error(getPortalErrorMessage(error, t('tasks.visibilityFailed', { defaultValue: 'The visibility could not be changed.' })));
    }
  };

  const changeSelectedVisibility = async (
    visibility: PortalVisibility
  ) => {
    if (
      bulkRequestInProgress.current ||
      controlsDisabled ||
      selectedTaskIds.length === 0
    ) {
      return;
    }

    const taskIds = [...selectedTaskIds];

    bulkRequestInProgress.current = true;
    setIsBulkSaving(true);

    try {
      await bulkUpdateVisibility({
        projectId: project.id,
        body: {
          task_ids: taskIds,
          visibility,
        },
      }).unwrap();

      setSelectedTaskIds([]);

      // A visibility filter may lose rows after this update.
      // Returning to page 1 avoids landing on an empty later page.
      paging.reset();

      message.success(
        t('tasks.bulkUpdated', {
          defaultValue: 'Visibility updated for the selected tasks.',
        })
      );
    } catch (error) {
      message.error(
        getPortalErrorMessage(
          error,
          t('tasks.bulkFailed', {
            defaultValue:
              'Task visibility could not be updated. Please try again.',
          })
        )
      );
    } finally {
      bulkRequestInProgress.current = false;
      setIsBulkSaving(false);
    }
  };

  const columns: ColumnsType<PortalTask> = [
    {
      key: 'task',
      title: t('tasks.columns.task', { defaultValue: 'Task' }),
      render: (_value, task) => (
        <div>
          <div style={{ fontWeight: 600, fontSize: 13 }}>{decodeHtmlEntities(task.title)}</div>
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
            {task.client_title || decodeHtmlEntities(task.title)}
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
            itemLabel={decodeHtmlEntities(task.title)}
            disabled={controlsDisabled}
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

      <Flex
        align="center"
        wrap="wrap"
        gap={8}
        style={{ marginBottom: 12 }}
      >
        <Typography.Text>
          {t('tasks.bulkSelected', {
            count: selectedTaskIds.length,
            defaultValue: 'Selected: {{count}}',
          })}
        </Typography.Text>

        <Button
          type="primary"
          loading={isBulkSaving}
          disabled={controlsDisabled || selectedTaskIds.length === 0}
          onClick={() => void changeSelectedVisibility('client')}
        >
          {t('tasks.bulkEnable', {
            defaultValue: 'Enable Client Visible',
          })}
        </Button>

        <Button
          disabled={controlsDisabled || selectedTaskIds.length === 0}
          onClick={() => void changeSelectedVisibility('internal')}
        >
          {t('tasks.bulkDisable', {
            defaultValue: 'Disable Client Visible',
          })}
        </Button>

        <Button
          type="text"
          disabled={isBulkSaving || selectedTaskIds.length === 0}
          onClick={() => setSelectedTaskIds([])}
        >
          {t('tasks.bulkClear', {
            defaultValue: 'Clear selection',
          })}
        </Button>

        <Typography.Text type="secondary">
          {t('tasks.bulkPageHint', {
            defaultValue: 'Select all applies to this page only.',
          })}
        </Typography.Text>
      </Flex>

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
        onRowClick={
          controlsDisabled
            ? undefined
            : task => setOpenTaskId(task.id)
        }
        emptyText={t('tasks.empty', { defaultValue: 'No tasks in this view.' })}
        rowSelection={{
          selectedRowKeys: selectedTaskIds,
          preserveSelectedRowKeys: false,
          onChange: keys => {
            if (!controlsDisabled) {
              setSelectedTaskIds(keys.map(String));
            }
          },
          getCheckboxProps: () => ({
            disabled: controlsDisabled,
          }),
          renderCell: (_checked, _task, _index, originNode) => (
            <span onClick={event => event.stopPropagation()}>
              {originNode}
            </span>
          ),
        }}
      />

      {openTask && <TaskDrawer key={openTask.id} project={project} task={openTask} onClose={() => setOpenTaskId(null)} />}
    </div>
  );
};
