import { Flex, Table, Typography } from 'antd';
import { TableProps } from 'antd/lib';
import { useEffect, useState } from 'react';

import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import { colors } from '@/styles/colors';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import logger from '@/utils/errorLogger';
import { useAppSelector } from '@/hooks/useAppSelector';

const TaskCompletedEarlyTable = ({
  projectId,
  includeArchivedTasks,
}: {
  projectId: string;
  includeArchivedTasks: boolean;
}) => {
  const [earlyCompletedTaskList, setEarlyCompletedTaskList] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getEarlyCompletedTasks = async () => {
    try {
      setLoading(true);
      const res = await projectInsightsApiService.getTasksCompletedEarly(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setEarlyCompletedTaskList(res.body);
      }
    } catch (error) {
      logger.error('Error fetching early completed tasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getEarlyCompletedTasks();
  }, [projectId, includeArchivedTasks, refreshTimestamp]);

  const columns: TableProps['columns'] = [
    {
      key: 'name',
      title: 'Name',
      render: (record: IInsightTasks) => <Typography.Text>{record.name}</Typography.Text>,
    },
    {
      key: 'status',
      title: 'Status',
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
            {record.status_name}
          </Typography.Text>
        </Flex>
      ),
    },
    {
      key: 'dueDate',
      title: 'End Date',
      render: (record: IInsightTasks) => (
        <Typography.Text>
          {record.end_date ? simpleDateFormat(record.end_date) : 'N/A'}
        </Typography.Text>
      ),
    },
    {
      key: 'completedDate',
      title: 'Completed At',
      render: (record: IInsightTasks) => (
        <Typography.Text>{simpleDateFormat(record.completed_at || null)}</Typography.Text>
      ),
    },
  ];

  return (
    <Table
      className="custom-two-colors-row-table"
      dataSource={earlyCompletedTaskList}
      columns={columns}
      rowKey={record => record.taskId}
      loading={loading}
      pagination={{
        showSizeChanger: false,
        defaultPageSize: 10,
      }}
      onRow={record => ({
        style: {
          cursor: 'pointer',
          height: 36,
        },
      })}
    />
  );
};

export default TaskCompletedEarlyTable;
