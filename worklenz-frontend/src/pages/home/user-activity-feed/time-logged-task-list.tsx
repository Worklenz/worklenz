import React, { useCallback } from 'react';
import { List, Typography, Tag, Tooltip, Space } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  setSelectedTaskId,
  setShowTaskDrawer,
  fetchTask,
} from '@/features/task-drawer/task-drawer.slice';
import { IUserTimeLoggedTask } from '@/types/home/user-activity.types';

const { Text } = Typography;

interface TimeLoggedTaskListProps {
  tasks: IUserTimeLoggedTask[];
}

const TimeLoggedTaskList: React.FC<TimeLoggedTaskListProps> = React.memo(({ tasks }) => {
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
          aria-label={`Time logged task: ${item.task_name}`}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <ClockCircleOutlined style={{ color: '#52c41a' }} />
              <Text strong ellipsis style={{ flex: 1 }}>
                {item.task_name}
              </Text>
              <Tag color="lime" style={{ marginLeft: 4, fontWeight: 500 }}>
                Time Log
              </Tag>
              <Space>
                <Text strong style={{ color: '#52c41a', fontSize: 12 }}>
                  {item.total_time_logged_string}
                </Text>
                {item.logged_by_timer && (
                  <Tag color="green">
                    Timer
                  </Tag>
                )}
                <Tooltip title={moment(item.last_logged_at).format('MMMM Do YYYY, h:mm:ss a')}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    {moment(item.last_logged_at).fromNow()}
                  </Text>
                </Tooltip>
              </Space>
            </div>
            <Text type="secondary" style={{ fontSize: 12 }}>
              {item.project_name}
            </Text>
          </Space>
        </List.Item>
      )}
    />
  );
});

export default TimeLoggedTaskList;
