import { memo, useMemo, Suspense } from 'react';
import {
  Table,
  TableColumnsType,
  Tag,
  Typography,
  Flex,
  Badge,
  Avatar,
  Tooltip,
  Pagination,
  Empty,
  Spin,
} from '@/shared/antd-imports';
import { DoubleRightOutlined, UserOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { colors } from '@/styles/colors';
import dayjs from 'dayjs';
import React from 'react';
import CustomTableTitle from '@/components/CustomTableTitle';
import {
  setIndex,
  setPageSize,
  setSort,
  fetchAllTasks,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';
import {
  setShowTaskDrawer,
  fetchTask,
  setSelectedTaskId,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import './all-tasks-reports-table.css';

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

const AllTasksReportsTable = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const { tasksList, total, isLoading, index, pageSize, sortField, sortOrder, visibleColumns } =
    useAppSelector(state => state.allTasksReportsReducer);

  const handleTaskClick = (task: IProjectTask) => {
    if (!task.id || !task.project_id) return;
    dispatch(setSelectedTaskId(task.id));
    dispatch(setProjectId(task.project_id));
    dispatch(fetchPhasesByProjectId(task.project_id));
    dispatch(fetchTask({ taskId: task.id, projectId: task.project_id }));
    dispatch(setShowTaskDrawer(true));
  };

  const handleTableChange = (pagination: any, filters: any, sorter: any) => {
    if (sorter.field && sorter.order) {
      dispatch(
        setSort({
          field: sorter.field,
          order: sorter.order === 'ascend' ? 'asc' : 'desc',
        })
      );
      dispatch(fetchAllTasks());
    }
  };

  const handlePaginationChange = (page: number, size: number) => {
    dispatch(setIndex(page));
    if (size !== pageSize) {
      dispatch(setPageSize(size));
    }
    dispatch(fetchAllTasks());
  };

  const allColumns: TableColumnsType<IProjectTask> = useMemo(
    () => [
      {
        key: 'taskName',
        dataIndex: 'name',
        title: <CustomTableTitle title={t('taskNameColumn', { defaultValue: 'Task' })} />,
        fixed: 'left' as const,
        width: 200,
        ellipsis: true,
        sorter: true,
        render: (_, record) => (
          <Flex
            align="center"
            gap={4}
            className="task-name-cell"
            onClick={() => handleTaskClick(record)}
          >
            {Number(record.sub_tasks_count) > 0 && (
              <DoubleRightOutlined style={{ fontSize: 10, flexShrink: 0 }} />
            )}
            <Typography.Text ellipsis={{ tooltip: record.name }} style={{ maxWidth: 160 }}>
              {record.name}
            </Typography.Text>
          </Flex>
        ),
      },
      {
        key: 'taskKey',
        dataIndex: 'task_key',
        title: <CustomTableTitle title={t('taskKeyColumn', { defaultValue: 'Key' })} />,
        width: 90,
        render: value => (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {value || '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'project',
        dataIndex: 'project_name',
        title: <CustomTableTitle title={t('projectColumn', { defaultValue: 'Project' })} />,
        width: 140,
        ellipsis: true,
        sorter: true,
        render: (_, record) => (
          <Flex align="center" gap={6}>
            <Badge color={record.color_code || '#1890ff'} />
            <Typography.Text ellipsis={{ tooltip: record.project_name }} style={{ maxWidth: 110 }}>
              {record.project_name || '-'}
            </Typography.Text>
          </Flex>
        ),
      },
      {
        key: 'status',
        dataIndex: 'status_name',
        title: <CustomTableTitle title={t('statusColumn', { defaultValue: 'Status' })} />,
        width: 100,
        sorter: true,
        render: (_, record) => (
          <Tag
            style={{ color: colors.darkGray, borderRadius: 48, fontSize: 11, margin: 0 }}
            color={record.status_color}
          >
            {record.status_name || '-'}
          </Tag>
        ),
      },
      {
        key: 'priority',
        dataIndex: 'priority_name',
        title: <CustomTableTitle title={t('priorityColumn', { defaultValue: 'Priority' })} />,
        width: 90,
        sorter: true,
        render: (_, record) =>
          record.priority_name ? (
            <Tag
              style={{ color: colors.darkGray, borderRadius: 48, fontSize: 11, margin: 0 }}
              color={record.priority_color}
            >
              {record.priority_name}
            </Tag>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
      {
        key: 'assignees',
        dataIndex: 'names',
        title: <CustomTableTitle title={t('assigneesColumn', { defaultValue: 'Assignees' })} />,
        width: 100,
        render: (_, record) => {
          const assignees = record.names || [];
          if (!assignees.length) {
            return (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                -
              </Typography.Text>
            );
          }
          return (
            <Avatar.Group max={{ count: 3 }} size={22}>
              {assignees.map((assignee, idx) => (
                <Tooltip key={idx} title={assignee.name}>
                  <Avatar
                    size={22}
                    src={assignee.avatar_url}
                    style={{ backgroundColor: assignee.color_code }}
                  >
                    {!assignee.avatar_url && assignee.name?.charAt(0).toUpperCase()}
                  </Avatar>
                </Tooltip>
              ))}
            </Avatar.Group>
          );
        },
      },
      {
        key: 'startDate',
        dataIndex: 'start_date',
        title: <CustomTableTitle title={t('startDateColumn', { defaultValue: 'Start Date' })} />,
        width: 95,
        sorter: true,
        render: value => (
          <Typography.Text style={{ fontSize: 12 }}>
            {value ? dayjs(value).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'dueDate',
        dataIndex: 'end_date',
        title: <CustomTableTitle title={t('dueDateColumn', { defaultValue: 'Due Date' })} />,
        width: 95,
        sorter: true,
        render: (value, record) => (
          <Typography.Text type={record.is_overdue ? 'danger' : undefined} style={{ fontSize: 12 }}>
            {value ? dayjs(value).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'createdDate',
        dataIndex: 'created_at',
        title: <CustomTableTitle title={t('createdDateColumn', { defaultValue: 'Created' })} />,
        width: 95,
        sorter: true,
        render: value => (
          <Typography.Text style={{ fontSize: 12 }}>
            {value ? dayjs(value).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'completedDate',
        dataIndex: 'completed_at',
        title: <CustomTableTitle title={t('completedDateColumn', { defaultValue: 'Completed' })} />,
        width: 95,
        sorter: true,
        render: value => (
          <Typography.Text style={{ fontSize: 12 }}>
            {value ? dayjs(value).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'lastUpdated',
        dataIndex: 'updated_at',
        title: (
          <CustomTableTitle title={t('lastUpdatedColumn', { defaultValue: 'Last Updated' })} />
        ),
        width: 95,
        sorter: true,
        render: value => (
          <Typography.Text style={{ fontSize: 12 }}>
            {value ? dayjs(value).format('MMM DD') : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'daysOverdue',
        dataIndex: 'overdue_days',
        title: (
          <CustomTableTitle title={t('daysOverdueColumn', { defaultValue: 'Days Overdue' })} />
        ),
        width: 70,
        align: 'center' as const,
        sorter: true,
        render: value => (
          <Typography.Text
            type={value && Number(value) > 0 ? 'danger' : undefined}
            style={{ fontSize: 12 }}
          >
            {value || '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'estimatedTime',
        dataIndex: 'total_time_string',
        title: <CustomTableTitle title={t('estimatedTimeColumn', { defaultValue: 'Estimated' })} />,
        width: 80,
        align: 'center' as const,
        render: value => <Typography.Text style={{ fontSize: 12 }}>{value || '-'}</Typography.Text>,
      },
      {
        key: 'loggedTime',
        dataIndex: 'time_spent_string',
        title: <CustomTableTitle title={t('loggedTimeColumn', { defaultValue: 'Logged' })} />,
        width: 80,
        align: 'center' as const,
        render: value => <Typography.Text style={{ fontSize: 12 }}>{value || '-'}</Typography.Text>,
      },
      {
        key: 'overloggedTime',
        dataIndex: 'overlogged_time_string',
        title: (
          <CustomTableTitle title={t('overloggedTimeColumn', { defaultValue: 'Overlogged' })} />
        ),
        width: 80,
        align: 'center' as const,
        render: value => (
          <Typography.Text type={value ? 'danger' : undefined} style={{ fontSize: 12 }}>
            {value || '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'phase',
        dataIndex: 'phase_name',
        title: <CustomTableTitle title={t('phaseColumn', { defaultValue: 'Phase' })} />,
        width: 100,
        render: (_, record) =>
          record.phase_name ? (
            <Tag
              style={{ color: colors.darkGray, borderRadius: 48, fontSize: 11, margin: 0 }}
              color={record.phase_color}
            >
              {record.phase_name}
            </Tag>
          ) : (
            <Typography.Text type="secondary">-</Typography.Text>
          ),
      },
      {
        key: 'labels',
        dataIndex: 'labels',
        title: <CustomTableTitle title={t('labelsColumn', { defaultValue: 'Labels' })} />,
        width: 120,
        render: (_, record) => {
          const labels = record.labels || [];
          if (!labels.length) return <Typography.Text type="secondary">-</Typography.Text>;
          return (
            <Flex gap={2} wrap="nowrap">
              {labels.slice(0, 1).map((label, idx) => (
                <Tag key={idx} color={label.color_code} style={{ margin: 0, fontSize: 11 }}>
                  {label.name}
                </Tag>
              ))}
              {labels.length > 1 && (
                <Tooltip
                  title={labels
                    .slice(1)
                    .map(l => l.name)
                    .join(', ')}
                >
                  <Tag style={{ fontSize: 11, margin: 0 }}>+{labels.length - 1}</Tag>
                </Tooltip>
              )}
            </Flex>
          );
        },
      },
      {
        key: 'progress',
        dataIndex: 'progress',
        title: <CustomTableTitle title={t('progressColumn', { defaultValue: 'Progress' })} />,
        width: 70,
        align: 'center' as const,
        sorter: true,
        render: value => (
          <Typography.Text style={{ fontSize: 12 }}>
            {value !== undefined && value !== null ? `${value}%` : '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'subtasksCount',
        dataIndex: 'sub_tasks_count',
        title: <CustomTableTitle title={t('subtasksCountColumn', { defaultValue: 'Subtasks' })} />,
        width: 70,
        align: 'center' as const,
        sorter: true,
        render: value => <Typography.Text style={{ fontSize: 12 }}>{value || '0'}</Typography.Text>,
      },
      {
        key: 'client',
        dataIndex: 'client_name',
        title: <CustomTableTitle title={t('clientColumn', { defaultValue: 'Client' })} />,
        width: 120,
        ellipsis: true,
        sorter: true,
        render: (value: string) => (
          <Typography.Text ellipsis={{ tooltip: value }} style={{ maxWidth: 100, fontSize: 12 }}>
            {value || '-'}
          </Typography.Text>
        ),
      },
    ],
    [t]
  );

  const filteredColumns = useMemo(() => {
    return allColumns.filter(col => visibleColumns.includes(col.key as string));
  }, [allColumns, visibleColumns]);

  if (!isLoading && tasksList.length === 0) {
    return (
      <Empty
        description={
          <Flex vertical align="center" gap={8}>
            <Typography.Text>
              {t('noTasksFound', { defaultValue: 'No tasks found' })}
            </Typography.Text>
            <Typography.Text type="secondary">
              {t('noTasksDescription', {
                defaultValue: 'Try adjusting your filters or search criteria',
              })}
            </Typography.Text>
          </Flex>
        }
      />
    );
  }

  return (
    <Flex vertical gap={16}>
      <Table
        columns={filteredColumns}
        dataSource={tasksList}
        rowKey={record => record.id || ''}
        loading={isLoading}
        pagination={false}
        scroll={{ x: 'max-content' }}
        onChange={handleTableChange}
        size="small"
        onRow={() => ({
          className: 'all-tasks-table-row',
        })}
        className="all-tasks-table"
      />

      <Flex justify="flex-end">
        <Pagination
          current={index}
          pageSize={pageSize}
          total={total}
          showSizeChanger
          showQuickJumper
          pageSizeOptions={['25', '50', '100', '200']}
          onChange={handlePaginationChange}
          showTotal={(total, range) =>
            t('showingResults', {
              from: range[0],
              to: range[1],
              total,
              defaultValue: `Showing ${range[0]}-${range[1]} of ${total} tasks`,
            })
          }
        />
      </Flex>

      <Suspense fallback={<Spin size="small" />}>
        <TaskDrawer />
      </Suspense>
    </Flex>
  );
};

export default memo(AllTasksReportsTable);
