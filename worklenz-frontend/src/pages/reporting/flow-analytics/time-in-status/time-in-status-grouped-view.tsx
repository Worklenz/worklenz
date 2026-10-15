import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Badge, Button, ConfigProvider, Empty, Flex, Table, Typography, theme } from '@/shared/antd-imports';
import type { TableColumnsType } from '@/shared/antd-imports';
import { RightOutlined } from '@/shared/antd-imports';
import CustomTableTitle from '@/components/CustomTableTitle';
import { buildSkeletonRows, toSkeletonColumns } from '@/components/reporting/table-skeleton';
import { useAppSelector } from '@/hooks/useAppSelector';
import {
  type TimeInStatusGroup,
  type TimeInStatusTask,
  type TimeInStatusTaskArgs,
  useGetTimeInStatusGroupsQuery,
} from '@/api/reporting/progress-chart.api.service';
import { formatDwell } from '../report-shell';
import { useTableMaxHeight } from './use-table-max-height';
import {
  AssigneesCell,
  ProjectNameCell,
  StatusCell,
  TaskKeyCell,
  TaskNameCell,
  TimeInStatusCell,
  TimeOverdueCell,
  useOpenTimeInStatusTask,
} from './time-in-status-cells';

const GROUP_COLUMN_WIDTH = 300;
const COUNT_COLUMN_WIDTH = 120;

const TimeInStatusGroupedView = ({ listArgs }: { listArgs: TimeInStatusTaskArgs }) => {
  const { t } = useTranslation('reporting-flow');
  const { token } = theme.useToken();
  const openTask = useOpenTimeInStatusTask();
  const { groupBy, field, order } = useAppSelector(state => state.timeInStatusReducer);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);

  const { data, isLoading, isFetching, isError, refetch } = useGetTimeInStatusGroupsQuery({
    ...listArgs,
    groupBy,
    field,
    order,
  });
  const groups = useMemo(() => data?.body?.groups ?? [], [data]);
  const truncated = data?.body?.truncated ?? false;

  useEffect(() => {
    setExpandedKeys([]);
  }, [groupBy, listArgs]);

  const groupLabel = (group: TimeInStatusGroup) =>
    group.group_id === 'unassigned' ? t('tis.unassigned', { defaultValue: 'Unassigned' }) : group.group_name;

  const groupHeader = {
    project: t('project', { defaultValue: 'Project' }),
    status: t('tis.currentStatus', { defaultValue: 'Current status' }),
    assignee: t('tis.assignee', { defaultValue: 'Assignee' }),
  }[groupBy];

  const taskColumns: TableColumnsType<TimeInStatusTask> = useMemo(
    () => [
      {
        key: 'taskKey',
        title: <CustomTableTitle title={t('tis.taskKey', { defaultValue: 'Key' })} />,
        width: 110,
        render: (_, task) => <TaskKeyCell task={task} />,
      },
      {
        key: 'name',
        title: <CustomTableTitle title={t('tis.task', { defaultValue: 'Task' })} />,
        width: 300,
        sorter: (a, b) => a.name.localeCompare(b.name),
        render: (_, task) => <TaskNameCell task={task} onOpen={openTask} />,
      },
      {
        key: 'project',
        title: <CustomTableTitle title={t('project', { defaultValue: 'Project' })} />,
        width: 200,
        render: (_, task) => <ProjectNameCell task={task} />,
      },
      {
        key: 'status',
        title: <CustomTableTitle title={t('tis.currentStatus', { defaultValue: 'Current status' })} />,
        width: 160,
        render: (_, task) => <StatusCell task={task} />,
      },
      {
        key: 'timeInStatus',
        title: <CustomTableTitle title={t('tis.timeInStatus', { defaultValue: 'Time in status' })} />,
        width: 150,
        sorter: (a, b) => a.hours_in_status - b.hours_in_status,
        render: (_, task) => <TimeInStatusCell task={task} />,
      },
      {
        key: 'timeOverdue',
        title: <CustomTableTitle title={t('tis.timeOverdue', { defaultValue: 'Time overdue' })} />,
        width: 150,
        render: (_, task) => <TimeOverdueCell task={task} />,
      },
      {
        key: 'assignees',
        title: <CustomTableTitle title={t('tis.assignedTo', { defaultValue: 'Assigned to' })} />,
        width: 170,
        render: (_, task) => <AssigneesCell task={task} />,
      },
    ],
    [t, openTask]
  );

  const groupColumns: TableColumnsType<TimeInStatusGroup> = useMemo(
    () => [
      {
        key: 'group',
        title: <CustomTableTitle title={groupHeader} />,
        fixed: 'left',
        width: GROUP_COLUMN_WIDTH,
        sorter: (a, b) => groupLabel(a).localeCompare(groupLabel(b)),
        render: (_, group) => {
          const isExpanded = expandedKeys.includes(group.group_id);
          const name = groupLabel(group);
          return (
            <Flex gap={4} align="center">
              <Button
                type="text"
                size="small"
                aria-expanded={isExpanded}
                aria-label={
                  isExpanded
                    ? t('tis.collapseRow', { name, defaultValue: 'Collapse {{name}}' })
                    : t('tis.expandRow', { name, defaultValue: 'Expand {{name}}' })
                }
                icon={
                  <RightOutlined
                    style={{ fontSize: 10, transition: 'transform 200ms', transform: isExpanded ? 'rotate(90deg)' : 'none' }}
                  />
                }
                onClick={() =>
                  setExpandedKeys(keys => (isExpanded ? keys.filter(key => key !== group.group_id) : [...keys, group.group_id]))
                }
              />
              <Badge color={group.group_color} />
              <Typography.Text strong ellipsis={{ tooltip: name }}>
                {name}
              </Typography.Text>
            </Flex>
          );
        },
      },
      {
        key: 'taskCount',
        title: <CustomTableTitle title={t('tis.tasksCount', { defaultValue: 'Tasks' })} />,
        width: COUNT_COLUMN_WIDTH,
        align: 'center',
        sorter: (a, b) => a.task_count - b.task_count,
        render: (_, group) => group.task_count,
      },
      {
        key: 'avgHours',
        title: <CustomTableTitle title={t('tis.avgTimeInStatus', { defaultValue: 'Avg time in status' })} />,
        width: 180,
        align: 'center',
        sorter: (a, b) => a.avg_hours - b.avg_hours,
        render: (_, group) => formatDwell(group.avg_hours),
      },
      {
        key: 'overdue',
        title: <CustomTableTitle title={t('tis.overdueTasks', { defaultValue: 'Overdue' })} />,
        width: COUNT_COLUMN_WIDTH,
        align: 'center',
        sorter: (a, b) => a.overdue_count - b.overdue_count,
        render: (_, group) =>
          group.overdue_count ? <Typography.Text type="danger">{group.overdue_count}</Typography.Text> : 0,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, groupHeader, expandedKeys]
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const maxHeight = useTableMaxHeight();
  const [scrollY, setScrollY] = useState<number>(240);
  useLayoutEffect(() => {
    const header = containerRef.current?.querySelector<HTMLElement>('.ant-table-header')?.offsetHeight ?? 40;
    setScrollY(Math.max(120, maxHeight - header - 2 - (truncated ? 40 : 0)));
  }, [maxHeight, groups, isLoading, truncated]);

  const tableTheme = useMemo(() => ({ components: { Table: { cellPaddingBlock: 12, cellPaddingInline: 10 } } }), []);

  if (isError) {
    return (
      <Alert
        type="error"
        showIcon
        message={t('loadFailed', { defaultValue: 'Could not load this report' })}
        action={
          <Button size="small" onClick={() => refetch()}>
            {t('retry', { defaultValue: 'Retry' })}
          </Button>
        }
      />
    );
  }

  return (
    <ConfigProvider theme={tableTheme}>
      <div
        className="flex min-h-0 flex-col overflow-hidden rounded-lg border"
        style={{ maxHeight, borderColor: token.colorBorderSecondary, background: token.colorBgContainer }}
      >
        {truncated && (
          <Alert
            type="warning"
            showIcon
            banner
            message={t('tis.truncatedNotice', { defaultValue: 'Only the first 2000 tasks are grouped. Narrow the filters to see the rest.' })}
          />
        )}
        <div ref={containerRef} className="min-h-0 overflow-hidden">
          <Table<TimeInStatusGroup>
            tableLayout="fixed"
            showSorterTooltip={false}
            loading={isFetching && !isLoading}
            pagination={false}
            rowKey={group => group.group_id}
            columns={isLoading ? toSkeletonColumns(groupColumns) : groupColumns}
            dataSource={
              isLoading
                ? buildSkeletonRows<TimeInStatusGroup & { id: string }>(10).map(row => ({ ...row, group_id: row.id }) as unknown as TimeInStatusGroup)
                : groups
            }
            scroll={{ x: 'max-content', y: scrollY }}
            onRow={() => ({ style: { height: 56 } })}
            locale={{ emptyText: <Empty description={t('noTasks', { defaultValue: 'No tasks found for this selection' })} /> }}
            expandable={{
              showExpandColumn: false,
              expandedRowKeys: expandedKeys,
              expandedRowRender: group => (
                <Table<TimeInStatusTask>
                  tableLayout="fixed"
                  showSorterTooltip={false}
                  rowKey="id"
                  columns={taskColumns}
                  dataSource={group.tasks}
                  pagination={group.tasks.length > 20 ? { pageSize: 20, showSizeChanger: false } : false}
                  onRow={() => ({ className: 'group', style: { height: 56 } })}
                />
              ),
            }}
          />
        </div>
      </div>
    </ConfigProvider>
  );
};

export default memo(TimeInStatusGroupedView);
