import React, { useCallback, useMemo } from 'react';
import { List, Typography, Tooltip, Space, Tag, theme } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('home');
  const dispatch = useAppDispatch();
  const { token } = theme.useToken();

  // Enhanced dark mode detection
  const isDarkMode = useMemo(() => {
    return token.colorBgContainer === '#1f1f1f' ||
           token.colorBgBase === '#141414' ||
           token.colorBgElevated === '#1f1f1f' ||
           document.documentElement.getAttribute('data-theme') === 'dark' ||
           document.body.classList.contains('dark');
  }, [token]);

  const handleTaskClick = useCallback(
    (taskId: string, projectId: string) => {
      dispatch(setSelectedTaskId(taskId));
      dispatch(setShowTaskDrawer(true));
      dispatch(fetchTask({ taskId, projectId }));
    },
    [dispatch]
  );

  // Enhanced styling with theme support
  const listItemStyles = useMemo(() => ({
    padding: '16px 20px',
    borderBottom: isDarkMode ? '1px solid #404040' : '1px solid #f0f2f5',
    cursor: 'pointer',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    borderRadius: '8px',
    margin: '0 0 2px 0',
    background: isDarkMode ? 'transparent' : 'transparent',
    position: 'relative' as const,
    overflow: 'hidden',
  }), [isDarkMode]);

  const listItemHoverStyles = useMemo(() => ({
    background: isDarkMode 
      ? 'linear-gradient(135deg, #2a2a2a 0%, #353535 100%)'
      : 'linear-gradient(135deg, #f8f9ff 0%, #f0f4ff 100%)',
    borderColor: isDarkMode ? '#505050' : '#d1d9e6',
    transform: 'translateY(-1px)',
    boxShadow: isDarkMode 
      ? '0 4px 16px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)'
      : '0 4px 16px rgba(24, 144, 255, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1)',
  }), [isDarkMode]);

  const iconStyles = useMemo(() => ({
    color: isDarkMode ? '#40a9ff' : '#1890ff',
    fontSize: '16px',
    padding: '8px',
    borderRadius: '6px',
    background: isDarkMode 
      ? 'linear-gradient(135deg, #1a2332 0%, #2a3441 100%)'
      : 'linear-gradient(135deg, #e6f7ff 0%, #f0f8ff 100%)',
    border: isDarkMode ? '1px solid #40a9ff20' : '1px solid #1890ff20',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '32px',
    minHeight: '32px',
  }), [isDarkMode]);

  const taskNameStyles = useMemo(() => ({
    color: isDarkMode ? '#ffffff' : '#1f2937',
    fontSize: '15px',
    fontWeight: 600,
    lineHeight: '1.4',
  }), [isDarkMode]);

  const tagStyles = useMemo(() => ({
    background: isDarkMode 
      ? 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)'
      : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
    color: isDarkMode ? '#ffffff' : '#1e40af',
    border: isDarkMode ? '1px solid #3b82f6' : '1px solid #93c5fd',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  }), [isDarkMode]);

  const metaTextStyles = useMemo(() => ({
    color: isDarkMode ? '#9ca3af' : '#6b7280',
    fontSize: '13px',
    fontWeight: 500,
  }), [isDarkMode]);

  const timeTextStyles = useMemo(() => ({
    color: isDarkMode ? '#8c8c8c' : '#9ca3af',
    fontSize: '12px',
    fontWeight: 400,
  }), [isDarkMode]);

  const activityCountStyles = useMemo(() => ({
    color: isDarkMode ? '#10b981' : '#059669',
    fontSize: '12px',
    fontWeight: 600,
    background: isDarkMode 
      ? 'linear-gradient(135deg, #064e3b20 0%, #065f4620 100%)'
      : 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
    padding: '2px 6px',
    borderRadius: '4px',
    border: isDarkMode ? '1px solid #065f4640' : '1px solid #a7f3d040',
  }), [isDarkMode]);

  return (
    <List
      dataSource={tasks}
      style={{ background: 'transparent' }}
      split={false}
      renderItem={item => (
        <List.Item
          onClick={() => handleTaskClick(item.task_id, item.project_id)}
          style={listItemStyles}
          onMouseEnter={(e) => {
            Object.assign(e.currentTarget.style, listItemHoverStyles);
          }}
          onMouseLeave={(e) => {
            Object.assign(e.currentTarget.style, listItemStyles);
          }}
          aria-label={`${t('recentTaskAriaLabel')} ${item.task_name}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={iconStyles}>
              <FileTextOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Text ellipsis style={taskNameStyles}>
                  {item.task_name}
                </Text>
                <Tag style={tagStyles}>
                  {t('activityTag')}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={metaTextStyles}>
                  {item.project_name}
                </Text>
                <Space size={16}>
                  <span style={activityCountStyles}>
                    {item.activity_count} {item.activity_count === 1 ? t('activitySingular') : t('activityPlural')}
                  </span>
                  <Tooltip 
                    title={moment(item.last_activity_at).format('MMMM Do YYYY, h:mm:ss a')}
                    placement="topRight"
                  >
                    <Text style={timeTextStyles}>
                      {moment(item.last_activity_at).fromNow()}
                    </Text>
                  </Tooltip>
                </Space>
              </div>
            </div>
          </div>
        </List.Item>
      )}
    />
  );
});

export default TaskActivityList;
