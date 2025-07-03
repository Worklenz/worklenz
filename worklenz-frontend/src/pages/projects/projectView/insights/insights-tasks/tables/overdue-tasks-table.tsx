import { Flex, Table, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { simpleDateFormat } from '@/utils/simpleDateFormat';
import { useAppSelector } from '@/hooks/useAppSelector';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';

const OverdueTasksTable = ({
  projectId,
  includeArchivedTasks,
}: {
  projectId: string;
  includeArchivedTasks: boolean;
}) => {
  const [overdueTaskList, setOverdueTaskList] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getOverdueTasks = async () => {
    setLoading(true);
    try {
      const res = await projectInsightsApiService.getOverdueTasks(projectId, includeArchivedTasks);
      if (res.done) {
        setOverdueTaskList(res.body);
      }
    } catch (error) {
      console.error('Error fetching overdue tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getOverdueTasks();
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
        <Typography.Text>
          {record.end_date ? simpleDateFormat(record.end_date) : 'N/A'}
        </Typography.Text>
      ),
    },
    {
      key: 'daysOverdue',
      title: 'Days overdue',
      render: (record: IInsightTasks) => <Typography.Text>{record.days_overdue}</Typography.Text>,
    },
  ];

  return (
    <Table
      className="custom-two-colors-row-table"
      dataSource={overdueTaskList}
      columns={columns}
      rowKey={record => record.taskId}
      pagination={{
        showSizeChanger: false,
        defaultPageSize: 10,
      }}
      loading={loading}
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

export default OverdueTasksTable;
