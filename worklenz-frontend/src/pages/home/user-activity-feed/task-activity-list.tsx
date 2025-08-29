import React, { useCallback } from 'react';
import { Table, Typography, Tooltip, theme } from '@/shared/antd-imports';
import { FileTextOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fromNow, formatDate } from '@/utils/dateUtils';
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
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  const handleTaskClick = useCallback(
    (taskId: string, projectId: string) => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );

  const columns = [
    {
      key: 'task',
      render: (record: IUserRecentTask) => (
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            width: '100%',
            cursor: 'pointer',
            padding: '8px 0',
          }}
          onClick={() => handleTaskClick(record.task_id, record.project_id)}
          aria-label={`${t('tasks.recentTaskAriaLabel')} ${record.task_name}`}
        >
          <div
            style={{
              marginTop: 2,
              color: token.colorPrimary,
              fontSize: 16,
            }}
          >
            <FileTextOutlined />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ marginBottom: 4 }}>
              <Text strong style={{ fontSize: 14 }}>
                {record.task_name}
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {record.project_name}
              </Text>
              <Tooltip
                title={formatDate(record.last_activity_at, 'MMMM Do YYYY, h:mm:ss a')}
                placement="topRight"
              >
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {fromNow(record.last_activity_at)}
                </Text>
              </Tooltip>
            </div>
          </div>
        </div>
      ),
    },
  ];

  return (
    <Table
      className="custom-two-colors-row-table"
      dataSource={tasks}
      columns={columns}
      rowKey="task_id"
      showHeader={false}
      pagination={false}
      size="small"
    />
  );
});

export default TaskActivityList;
