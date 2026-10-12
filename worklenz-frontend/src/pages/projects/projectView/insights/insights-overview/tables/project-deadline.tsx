import { Card, Flex, Skeleton, Table, Typography } from '@/shared/antd-imports';
import { useCallback, useEffect, useRef, useState } from 'react';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import logger from '@/utils/errorLogger';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import ProjectStatsCard from '@/components/projects/project-stats-card';
import warningIcon from '@assets/icons/insightsIcons/warning.png';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { IDeadlineTaskStats } from '@/types/project/project-insights.types';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import { useSocket } from '@/socket/socketContext';
import { SocketEvents } from '@/shared/socket-events';
import { useAdaptivePageSize } from './use-adaptive-page-size';

const ProjectDeadline = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);
  const { t } = useTranslation('project-view-insights');
  const { socket } = useSocket();

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IDeadlineTaskStats | null>(null);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);
  const requestIdRef = useRef(0);
  const [pageSizeOverride, setPageSizeOverride] = useState<number | null>(null);
  const tableWrapperRef = useRef<HTMLDivElement>(null);
  const { pageSize: adaptivePageSize } = useAdaptivePageSize(tableWrapperRef);
  const pageSize = pageSizeOverride ?? adaptivePageSize;

  const getProjectDeadline = useCallback(async () => {
    if (!projectId) return;
    const currentRequestId = ++requestIdRef.current;
    try {
      setLoading(true);
      const res = await projectInsightsApiService.getProjectDeadlineStats(
        projectId,
        includeArchivedTasks
      );
      if (currentRequestId !== requestIdRef.current) return;
      if (res.done) {
        setData(res.body);
      }
    } catch {
      if (currentRequestId === requestIdRef.current) {
        logger.error('Error fetching project deadline stats', { projectId, includeArchivedTasks });
      }
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  }, [projectId, includeArchivedTasks]);

  useEffect(() => {
    getProjectDeadline();
  }, [projectId, includeArchivedTasks, refreshTimestamp, getProjectDeadline]);

  useEffect(() => {
    if (!socket) return;

    const handleUpdate = () => {
      getProjectDeadline();
    };

    socket.on(SocketEvents.TASK_STATUS_CHANGE.toString(), handleUpdate);
    socket.on(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleUpdate);
    socket.on(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleUpdate);

    return () => {
      socket.off(SocketEvents.TASK_STATUS_CHANGE.toString(), handleUpdate);
      socket.off(SocketEvents.PROJECT_UPDATES_AVAILABLE.toString(), handleUpdate);
      socket.off(SocketEvents.PROJECT_STATUS_CHANGE.toString(), handleUpdate);
    };
  }, [socket, getProjectDeadline]);

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('common.name', { defaultValue: 'Name' }),
      dataIndex: 'name',
      render: (_: any, record: IInsightTasks) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'status',
      title: t('common.status', { defaultValue: 'Status' }),
      dataIndex: 'status',
      render: (_: any, record: IInsightTasks) => (
        <Flex
          gap={4}
          style={{
            width: 'fit-content',
            borderRadius: 24,
            paddingInline: 6,
            backgroundColor: record.status_color,
            color: colors.darkGray,
            cursor: 'pointer',
          }}
        >
          <Typography.Text
            ellipsis={{ expanded: false }}
            style={{
              color: colors.darkGray,
              fontSize: 13,
            }}
          >
            {record.status_name || record.status}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'dueDate',
      title: t('common.dueDate', { defaultValue: 'Due Date' }),
      // render: (record: IInsightTasks) => (
      render: (_: any, record: IInsightTasks) => (
        <Typography.Text>
          {record.end_date ? simpleDateFormat(record.end_date) : t('common.na', { defaultValue: 'N/A' })}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Card
      className="custom-insights-card"
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('projectDeadline.title', { defaultValue: 'Project Deadline' })}{' '}
          <span style={{ color: colors.lightGray }}>{data?.project_end_date?format(new Date(data.project_end_date),'yyyy-MM-dd'):''}</span>
        </Typography.Text>
      }
      style={{ width: '100%' }}
    >
      <Flex vertical gap={24}>
        <Flex gap={12} style={{ width: '100%' }}>
          <Skeleton active loading={loading}>
            <ProjectStatsCard
              icon={warningIcon}
              title={t('projectDeadline.overdueTasksHours', { defaultValue: 'Overdue tasks (hours)' })}
              tooltip={t('projectDeadline.overdueTasksHoursTooltip', { defaultValue: 'Tasks that has time logged past the end date of the project' })}
              children={data?.deadline_logged_hours_string || t('common.na', { defaultValue: 'N/A' })}
            />
            <ProjectStatsCard
              icon={warningIcon}
              title={t('projectDeadline.overdueTasks', { defaultValue: 'Overdue tasks' })}
              tooltip={t('projectDeadline.overdueTasksTooltip', { defaultValue: 'Tasks that are past the end date of the project' })}
              children={data?.deadline_tasks_count || t('common.na', { defaultValue: 'N/A' })}
            />
          </Skeleton>
        </Flex>
        <div ref={tableWrapperRef}>
          <Table
            className="custom-two-colors-row-table insights-overview-table"
            dataSource={data?.tasks}
            columns={columns}
            // rowKey={record => record.taskId}
            rowKey={record => record.id}
            pagination={{
              showSizeChanger: true,
              pageSize,
              pageSizeOptions: ['10', '20', '50', '100'],
              onChange: (_page, size) => {
                if (size !== pageSize) {
                  setPageSizeOverride(size);
                }
              },
              showTotal: (totalCount, range) =>
                t('common.paginationRange', {
                  from: range[0],
                  to: range[1],
                  total: totalCount,
                  defaultValue: '{{from}}–{{to}} of {{total}}',
                }),
            }}
            onRow={record => {
              return {
                style: {
                  cursor: 'pointer',
                },
              };
            }}
          />
        </div>
      </Flex>
    </Card>
  );
};

export default ProjectDeadline;
