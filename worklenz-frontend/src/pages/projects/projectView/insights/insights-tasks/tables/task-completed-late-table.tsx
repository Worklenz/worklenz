import { Flex, Table, Typography } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import logger from '@/utils/errorLogger';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';

const TaskCompletedLateTable = ({
  projectId,
  includeArchivedTasks,
}: {
  projectId: string;
  includeArchivedTasks: boolean;
}) => {
  const [lateCompletedTaskList, setLateCompletedTaskList] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getLateCompletedTasks = async () => {
    try {
      setLoading(true);
      const res = await projectInsightsApiService.getTasksCompletedLate(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setLateCompletedTaskList(res.body);
      }
    } catch (error) {
      logger.error('Error fetching late completed tasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getLateCompletedTasks();
  }, [projectId, includeArchivedTasks, refreshTimestamp]);

  // table columns
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
        <Typography.Text>{simpleDateFormat(record.end_date || null)}</Typography.Text>
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
      dataSource={lateCompletedTaskList}
      columns={columns}
      rowKey={record => record.taskId}
      pagination={{
        showSizeChanger: false,
        defaultPageSize: 10,
      }}
      loading={loading}
      size="small"
      onRow={record => {
        return {
          style: {
            cursor: 'pointer',
            height: 36,
          },
        };
      }}
    />
  );
};

export default TaskCompletedLateTable;
