import React, { useCallback } from 'react';
import { Table, Typography, Tag, Tooltip, Space, theme } from '@/shared/antd-imports';
import { ClockCircleOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { fromNow, formatDate } from '@/utils/dateUtils';
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
      render: (record: IUserTimeLoggedTask) => (
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 10, 
            width: '100%',
            cursor: 'pointer',
            padding: '8px 0'
          }}
          onClick={() => handleTaskClick(record.task_id, record.project_id)}
          aria-label={`${t('tasks.timeLoggedTaskAriaLabel')} ${record.task_name}`}
        >
          {/* Clock Icon */}
          <div style={{ 
            color: token.colorSuccess,
            fontSize: 14,
            flexShrink: 0
          }}>
            <ClockCircleOutlined />
          </div>
          
          {/* Main Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Task Name */}
            <div style={{ marginBottom: 2 }}>
              <Text 
                strong 
                style={{ 
                  fontSize: 13,
                  lineHeight: 1.4,
                  color: token.colorText
                }}
                ellipsis={{ tooltip: record.task_name }}
              >
                {record.task_name}
              </Text>
            </div>
            
            {/* Project Name */}
            <Text 
              type="secondary" 
              style={{ 
                fontSize: 11,
                lineHeight: 1.2,
                display: 'block',
                marginBottom: 4
              }}
              ellipsis={{ tooltip: record.project_name }}
            >
              {record.project_name}
            </Text>
          </div>
          
          {/* Right Side - Time and Status */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'flex-end',
            gap: 3,
            flexShrink: 0
          }}>
            {/* Time Logged */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Tag 
                color="success" 
                style={{ 
                  margin: 0,
                  fontSize: 11,
                  padding: '0 6px',
                  height: 18,
                  lineHeight: '16px',
                  borderRadius: 3
                }}
              >
                {record.total_time_logged_string}
              </Tag>
              {record.logged_by_timer && (
                <Tag 
                  color="processing" 
                  style={{ 
                    margin: 0,
                    fontSize: 10,
                    padding: '0 4px',
                    height: 16,
                    lineHeight: '14px',
                    borderRadius: 2
                  }}
                >
                  {t('tasks.timerTag')}
                </Tag>
              )}
            </div>
            
            {/* Time Ago */}
            <Tooltip 
              title={formatDate(record.last_logged_at, 'MMMM Do YYYY, h:mm:ss a')}
              placement="topRight"
            >
              <Text 
                type="secondary" 
                style={{ 
                  fontSize: 10,
                  lineHeight: 1,
                  color: token.colorTextTertiary
                }}
              >
                {fromNow(record.last_logged_at)}
              </Text>
            </Tooltip>
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

export default TimeLoggedTaskList;
