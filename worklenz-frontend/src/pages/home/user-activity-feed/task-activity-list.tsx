import React, { useCallback } from 'react';
import { List, Typography, Tooltip, Space, Tag } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import moment from 'moment';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { IUserRecentTask } from '@/types/home/user-activity.types';

const { Text } = Typography;

interface TaskActivityListProps {
  tasks: IUserRecentTask[];
}

const TaskActivityList: React.FC<TaskActivityListProps> = React.memo(({ tasks }) => {
  const dispatch = useAppDispatch();

  const handleTaskClick = useCallback(
    (taskId: string, projectId: string) => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );

  return (
    <List
      dataSource={tasks}
      renderItem={item => (
        <List.Item
          onClick={() => handleTaskClick(item.task_id, item.project_id)}
          style={{
            padding: '12px 0',
            borderBottom: '1px solid #f0f0f0',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          aria-label={`Recent task: ${item.task_name}`}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <FileTextOutlined style={{ color: '#1890ff' }} />
              <Text strong ellipsis style={{ flex: 1 }}>
                {item.task_name}
              </Text>
              <Tag color="geekblue" style={{ marginLeft: 4, fontWeight: 500 }}>
                Activity
              </Tag>
              <Tooltip title={moment(item.last_activity_at).format('MMMM Do YYYY, h:mm:ss a')}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {moment(item.last_activity_at).fromNow()}
                </Text>
              </Tooltip>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.project_name}
              </Text>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {item.activity_count} {item.activity_count === 1 ? 'activity' : 'activities'}
              </Text>
            </div>
          </Space>
        </List.Item>
      )}
    />
  );
});

export default TaskActivityList;
