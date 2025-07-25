import { Card, Flex, Skeleton, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import logger from '@/utils/errorLogger';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { IDeadlineTaskStats, IInsightTasks } from '@/types/project/project-insights.types';
import ProjectStatsCard from '@/components/projects/project-stats-card';
import warningIcon from '@assets/icons/insightsIcons/warning.png';
import { useAppSelector } from '@/hooks/useAppSelector';

const ProjectDeadline = () => {
  const { t } = useTranslation('project-insights');
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<IDeadlineTaskStats | null>(null);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getProjectDeadline = async () => {
    if (!projectId) return;
    try {
      setLoading(true);
      const res = await projectInsightsApiService.getProjectDeadlineStats(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setData(res.body);
      }
    } catch {
      logger.error('Error fetching project deadline stats', { projectId, includeArchivedTasks });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getProjectDeadline();
  }, [projectId, includeArchivedTasks,refreshTimestamp]);

  // table columns
  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: t('name'),
      render: (record: IInsightTasks) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'status',
      title: t('status'),
      render: (record: IInsightTasks) => (
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
            {record.status}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'dueDate',
      title: t('dueDate'),
      render: (record: IInsightTasks) => (
        <Typography.Text>
          {record.end_date ? simpleDateFormat(record.end_date) : t('noData')}
        </Typography.Text>
      ),
    },
  ];

  return (
    <Card
      className="custom-insights-card"
      title={
        <Typography.Text style={{ fontSize: 16, fontWeight: 500 }}>
          {t('projectDeadline')} <span style={{ color: colors.lightGray }}>{data?.project_end_date}</span>
        </Typography.Text>
      }
      style={{ width: '100%' }}
    >
      <Flex vertical gap={24}>
        <Flex gap={12} style={{ width: '100%' }}>
          <Skeleton active loading={loading}>
            <ProjectStatsCard
              icon={warningIcon}
              title={t('overdueTasksHours')}
              tooltip={t('overdueTasksHoursTooltip')}
              children={data?.deadline_logged_hours_string || t('noData')}
            />
            <ProjectStatsCard
              icon={warningIcon}
              title={t('overdueTasks')}
              tooltip={t('overdueTasksTooltip')}
              children={data?.deadline_tasks_count || t('noData')}
            />
          </Skeleton>
        </Flex>
        <Table
          className="custom-two-colors-row-table"
          dataSource={data?.tasks}
          columns={columns}
          rowKey={record => record.taskId}
          pagination={{
            showSizeChanger: true,
            defaultPageSize: 20,
          }}
          onRow={record => {
            return {
              style: {
                cursor: 'pointer',
                height: 36,
              },
            };
          }}
        />
      </Flex>
    </Card>
  );
};

export default ProjectDeadline;
