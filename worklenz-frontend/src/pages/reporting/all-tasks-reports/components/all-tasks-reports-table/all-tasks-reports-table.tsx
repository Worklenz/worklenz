import { memo, useLayoutEffect, useMemo, useRef, useState, Suspense } from 'react';
import {
  Table,
  TableColumnsType,
  Tag,
  Typography,
  Flex,
  Badge,
  Tooltip,
  Pagination,
  Empty,
  Spin,
  Button,
  theme,
} from '@/shared/antd-imports';
import { DoubleRightOutlined, ExpandAltOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IProjectTask } from '@/types/project/projectTasksViewModel.types';
import { colors } from '@/styles/colors';
import dayjs from 'dayjs';
import React from 'react';
import CustomTableTitle from '@/components/CustomTableTitle';
import AssigneeSelector from '@/components/AssigneeSelector';
import AvatarGroup from '@/components/AvatarGroup';
import {
  setIndex,
  setPageSize,
  setSort,
  fetchAllTasks,
  setSelectedProjects,
  setSelectedStatuses,
  setSelectedPriorities,
  setSelectedAssignees,
  updateTaskAssignees,
} from '@/features/reporting/allTasksReports/all-tasks-reports-slice';
import {
  setShowTaskDrawer,
  fetchTask,
  setSelectedTaskId,
} from '@/features/task-drawer/task-drawer.slice';
import { setProjectId } from '@/features/project/project.slice';
import { fetchPhasesByProjectId } from '@/features/projects/singleProject/phase/phases.slice';
import { useAllTasksReportsFilterOptions } from '../../hooks/useAllTasksReportsFilterOptions';
import './all-tasks-reports-table.css';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const TaskDrawer = React.lazy(() => import('@components/task-drawer/task-drawer'));

const AllTasksReportsTable = () => {
  const { t } = useTranslation('reporting-all-tasks');
  const dispatch = useAppDispatch();

  const {
    tasksList,
    total,
    isLoading,
    index,
    pageSize,
    visibleColumns,
    selectedProjects,
    selectedStatuses,
    selectedPriorities,
    selectedAssignees,
  } = useAppSelector(state => state.allTasksReportsReducer);

  const { token } = theme.useToken();
  const isDarkMode = useAppSelector(state => state.themeReducer.mode === 'dark');

  // Get filter options for columns
  const filterOptions = useAllTasksReportsFilterOptions();

  const handleTaskClick = (task: IProjectTask) => {
    if (!task.id || !task.project_id) return;
    dispatch(setSelectedTaskId(task.id));
    dispatch(setProjectId(task.project_id));
    dispatch(fetchPhasesByProjectId(task.project_id));
    dispatch(fetchTask({ taskId: task.id, projectId: task.project_id }));
    dispatch(setShowTaskDrawer(true));
  };

  /**
   * Helper function to check if two arrays are equal
   */
  const arraysEqual = (a: string[], b: string[]): boolean => {
    if (a.length !== b.length) return false;
    return a.every((val, idx) => val === b[idx]);
  };

  const handleTableChange = (_pagination: unknown, filters: Record<string, unknown>, sorter: any) => {
    let hasFilterChanges = false;

    // Handle column filters
    if (filters) {
      // Project filter
      if (filters.project !== undefined) {
        const projectIds = (filters.project as string[] || []).map(String);
        if (!arraysEqual(projectIds, selectedProjects)) {
          dispatch(setSelectedProjects(projectIds));
          hasFilterChanges = true;
        }
      }

      // Status filter
      if (filters.status !== undefined) {
        const statusKeys = (filters.status as string[] || []).map(String);
        if (!arraysEqual(statusKeys, selectedStatuses)) {
          dispatch(setSelectedStatuses(statusKeys));
          hasFilterChanges = true;
        }
      }

      // Priority filter
      if (filters.priority !== undefined) {
        const priorityIds = (filters.priority as string[] || []).map(String);
        if (!arraysEqual(priorityIds, selectedPriorities)) {
          dispatch(setSelectedPriorities(priorityIds));
          hasFilterChanges = true;
        }
      }

      // Assignees filter
      if (filters.assignees !== undefined) {
        const assigneeIds = (filters.assignees as string[] || []).map(String);
        if (!arraysEqual(assigneeIds, selectedAssignees)) {
          dispatch(setSelectedAssignees(assigneeIds));
          hasFilterChanges = true;
        }
      }
    }

    // Handle sorting
    let hasSortChanges = false;
    if (sorter.field && sorter.order) {
      dispatch(
        setSort({
          field: sorter.field,
          order: sorter.order === 'ascend' ? 'asc' : 'desc',
        })
      );
      hasSortChanges = true;
    }

    // Fetch data if filters or sort changed
    if (hasFilterChanges || hasSortChanges) {
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
        key: 'taskKey',
        dataIndex: 'task_key',
        title: <CustomTableTitle title={t('taskKeyColumn', { defaultValue: 'Key' })} />,
        width: 90,
        fixed: 'left' as const,
        render: value => (
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            {value || '-'}
          </Typography.Text>
        ),
      },
      {
        key: 'taskName',
        dataIndex: 'name',
        title: <CustomTableTitle title={t('taskNameColumn', { defaultValue: 'Task' })} />,
        fixed: 'left' as const,
        width: 240,
        ellipsis: true,
        sorter: true,
        render: (_, record) => (
          <Flex
            align="center"
            justify="space-between"
            gap={8}
            className="task-name-cell"
            onClick={() => handleTaskClick(record)}
          >
            <Flex align="center" gap={4} style={{ minWidth: 0 }}>
            {Number(record.sub_tasks_count) > 0 && (
              <DoubleRightOutlined style={{ fontSize: 10, flexShrink: 0 }} />
            )}
            <Typography.Text ellipsis={{ tooltip: record.name }} style={{ maxWidth: 190 }}>
              {record.name}
            </Typography.Text>
            </Flex>
            <ExpandAltOutlined
              className="hidden group-hover:flex"
              style={{ flexShrink: 0 }}
              aria-label={t('openButton', { defaultValue: 'Open' })}
            />
          </Flex>
        ),
      },
      {
        key: 'project',
        dataIndex: 'project_name',
        title: <CustomTableTitle title={t('projectColumn', { defaultValue: 'Project' })} />,
        width: 140,
        ellipsis: true,
        sorter: true,
        filters: filterOptions.project,
        filteredValue: selectedProjects,
        filterMultiple: true,
        filterSearch: true,
        filterDropdownProps: {
          placement: 'bottomLeft' as const,
        },
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
        filters: filterOptions.status,
        filteredValue: selectedStatuses,
        filterMultiple: true,
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
        filters: filterOptions.priority,
        filteredValue: selectedPriorities,
        filterMultiple: true,
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
        filters: filterOptions.assignees,
        filteredValue: selectedAssignees,
        filterMultiple: true,
        filterSearch: true,
        render: (_, record) => {
          const assignees = record.names || [];
          // AssigneeSelector determines which members are pre-checked from
          // `task.assignees[].team_member_id`. The initial REST fetch for
          // this report only returns `.names` (reporting-all-tasks-controller.ts),
          // never `.assignees`, so derive it from `.names` as a fallback.
          // Once an assign/unassign happens, `updateTaskAssignees` populates
          // the real `.assignees` from the socket ack's full, untruncated
          // getAssignees() result — prefer that over `.names`, since the
          // ack's `.names` is capped to 4 entries plus a synthetic "+N"
          // placeholder by createTagList() (on-quick-assign-or-remove.ts)
          // and would otherwise make the 5th+ assignee wrongly show as
          // unchecked (and un-removable) in the picker.
          const task: IProjectTask = {
            ...record,
            assignees:
              record.assignees ??
              assignees.map(member => {
                const raw = member as unknown as { id?: string; team_member_id?: string };
                const memberId = raw.team_member_id || raw.id || '';
                return {
                  id: memberId,
                  team_member_id: memberId,
                  project_member_id: '',
                  name: member.name,
                };
              }),
          };
          const handleAssigneesChanged = (data: unknown) => {
            const ack = data as { id?: string; assignees?: IProjectTask['assignees']; names?: IProjectTask['names'] } | null;
            if (!ack?.id) return;
            dispatch(updateTaskAssignees({ id: ack.id, assignees: ack.assignees, names: ack.names }));
          };
          if (!assignees.length) {
            return (
              <AssigneeSelector
                task={task}
                groupId={null}
                isDarkMode={isDarkMode}
                projectIdOverride={record.project_id}
                onAssigneesChanged={handleAssigneesChanged}
              />
            );
          }
          return (
            <AssigneeSelector
              task={task}
              groupId={null}
              isDarkMode={isDarkMode}
              projectIdOverride={record.project_id}
              onAssigneesChanged={handleAssigneesChanged}
              triggerElement={
                <AvatarGroup
                  members={assignees}
                  maxCount={3}
                  isDarkMode={isDarkMode}
                  size={24}
                />
              }
            />
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
    [t, filterOptions, selectedProjects, selectedStatuses, selectedPriorities, selectedAssignees, isDarkMode]
  );

  const filteredColumns = useMemo(() => {
    return allColumns.filter(col => visibleColumns.includes(col.key as string));
  }, [allColumns, visibleColumns]);

  // The first load has no rows yet, so draw placeholder rows instead of an empty state.
  const showSkeleton = isLoading && tasksList.length === 0;

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollY, setScrollY] = useState<number>(240);

  // Size the table body to the space left above the pagination footer so the header stays visible.
  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return;
    const measure = () => {
      const header = element.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
      setScrollY(Math.max(120, element.clientHeight - header - 2));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [tasksList, isLoading]);

  const handlePageSizeChange = (nextSize: number) => handlePaginationChange(1, nextSize);

  const rangeStart = total === 0 ? 0 : (index - 1) * pageSize + 1;
  const rangeEnd = Math.min(index * pageSize, total);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div
      className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border"
      style={{ borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
    >
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden">
        <Table
          columns={showSkeleton ? toSkeletonColumns(filteredColumns) : filteredColumns}
          dataSource={showSkeleton ? buildSkeletonRows<IProjectTask>(pageSize) : tasksList}
          rowKey={record => record.id || ''}
          loading={isLoading && !showSkeleton}
          pagination={false}
          showSorterTooltip={false}
          scroll={{ x: 'max-content', y: scrollY }}
          onChange={handleTableChange}
          onRow={() => ({
            className: 'all-tasks-table-row group',
            style: { height: 56 },
          })}
          className="all-tasks-table"
          locale={{
            emptyText: (
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
            ),
          }}
        />
      </div>
      <Flex
        align="center"
        justify="space-between"
        gap={12}
        wrap="wrap"
        className="px-4 py-3"
        style={{ borderTop: `1px solid ${token.colorBorderSecondary}` }}
      >
        <Flex align="center" gap={8}>
          <label htmlFor="all-tasks-page-size" className="text-xs">
            {t('rowsPerPage', { defaultValue: 'Rows per page:' })}
          </label>
          <select
            id="all-tasks-page-size"
            value={pageSize}
            onChange={event => handlePageSizeChange(Number(event.target.value))}
            className="rounded-md border px-2 py-1 text-xs"
            style={{
              background: token.colorBgContainer,
              color: token.colorText,
              borderColor: token.colorBorder,
            }}
          >
            {PAGE_SIZE_OPTIONS.map(size => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-xs" style={{ color: token.colorTextSecondary }}>
            {t('rangeOfTotal', {
              start: rangeStart,
              end: rangeEnd,
              total,
              defaultValue: '{{start}}-{{end}} of {{total}}',
            })}
          </span>
        </Flex>
        <Flex align="center" gap={8}>
          <Button
            size="small"
            aria-label={t('firstPage', { defaultValue: 'First page' })}
            disabled={index <= 1}
            onClick={() => handlePaginationChange(1, pageSize)}
          >
            «
          </Button>
          <Pagination
            current={index}
            pageSize={pageSize}
            total={total}
            showSizeChanger={false}
            onChange={handlePaginationChange}
          />
          <Button
            size="small"
            aria-label={t('lastPage', { defaultValue: 'Last page' })}
            disabled={index >= lastPage}
            onClick={() => handlePaginationChange(lastPage, pageSize)}
          >
            »
          </Button>
        </Flex>
      </Flex>

      <Suspense fallback={<Spin size="small" />}>
        <TaskDrawer />
      </Suspense>
    </div>
  );
};

export default memo(AllTasksReportsTable);
