import { Avatar, Button, Flex, Table, Typography } from '@/shared/antd-imports';
import { useState, useEffect } from 'react';
import { colors } from '@/styles/colors';
import { TableProps } from 'antd/lib';
import { PlusOutlined } from '@/shared/antd-imports';
import { IInsightTasks } from '@/types/project/projectInsights.types';
import logger from '@/utils/errorLogger';
import { projectInsightsApiService } from '@/api/projects/insights/project-insights.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';

const OverLoggedTasksTable = () => {
  const { includeArchivedTasks, projectId } = useAppSelector(state => state.projectInsightsReducer);

  const [overLoggedTaskList, setOverLoggedTaskList] = useState<IInsightTasks[]>([]);
  const [loading, setLoading] = useState(true);
  const { refreshTimestamp } = useAppSelector(state => state.projectReducer);

  const getOverLoggedTasks = async () => {
    try {
      setLoading(true);
      const res = await projectInsightsApiService.getOverloggedTasks(
        projectId,
        includeArchivedTasks
      );
      if (res.done) {
        setOverLoggedTaskList(res.body);
      }
    } catch (error) {
      logger.error('Error fetching over logged tasks', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getOverLoggedTasks();
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
      key: 'members',
      title: 'Members',
      render: (record: IInsightTasks) =>
        record.status_name ? (
          <Avatar.Group>
            {/* {record.names.map((member) => (
              <CustomAvatar avatarName={member.memberName} size={26} />
            ))} */}
          </Avatar.Group>
        ) : (
          <Button
            disabled
            type="dashed"
            shape="circle"
            size="small"
            icon={
              <PlusOutlined
                style={{
                  fontSize: 12,
                  width: 22,
                  height: 22,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              />
            }
          />
        ),
    },
    {
      key: 'overLoggedTime',
      title: 'Over Logged Time',
      render: (_, record: IInsightTasks) => (
        <Typography.Text>{record.overlogged_time_string}</Typography.Text>
      ),
    },
  ];

  return (
    <Table
      className="custom-two-colors-row-table"
      dataSource={overLoggedTaskList}
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

export default OverLoggedTasksTable;
