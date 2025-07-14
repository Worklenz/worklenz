import React, { useCallback, useMemo } from 'react';
import { List, Typography, Tag, Tooltip, Space, theme } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import moment from 'moment';
import { useTranslation } from 'react-i18next';
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
      : 'linear-gradient(135deg, #f6ffed 0%, #f0fff4 100%)',
    borderColor: isDarkMode ? '#505050' : '#b7eb8f',
    transform: 'translateY(-1px)',
    boxShadow: isDarkMode 
      ? '0 4px 16px rgba(0, 0, 0, 0.3), 0 1px 4px rgba(0, 0, 0, 0.2)'
      : '0 4px 16px rgba(82, 196, 26, 0.15), 0 1px 4px rgba(0, 0, 0, 0.1)',
  }), [isDarkMode]);

  const iconStyles = useMemo(() => ({
    color: isDarkMode ? '#73d13d' : '#52c41a',
    fontSize: '16px',
    padding: '8px',
    borderRadius: '6px',
    background: isDarkMode 
      ? 'linear-gradient(135deg, #1b2918 0%, #273622 100%)'
      : 'linear-gradient(135deg, #f6ffed 0%, #f0fff4 100%)',
    border: isDarkMode ? '1px solid #52c41a20' : '1px solid #52c41a20',
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

  const timeLogTagStyles = useMemo(() => ({
    background: isDarkMode 
      ? 'linear-gradient(135deg, #365314 0%, #4d7c0f 100%)'
      : 'linear-gradient(135deg, #f0fff4 0%, #d9f7be 100%)',
    color: isDarkMode ? '#ffffff' : '#365314',
    border: isDarkMode ? '1px solid #4d7c0f' : '1px solid #95de64',
    borderRadius: '6px',
    fontSize: '11px',
    fontWeight: 600,
    padding: '2px 8px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  }), [isDarkMode]);

  const timerTagStyles = useMemo(() => ({
    background: isDarkMode 
      ? 'linear-gradient(135deg, #0f766e 0%, #14b8a6 100%)'
      : 'linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 100%)',
    color: isDarkMode ? '#ffffff' : '#0f766e',
    border: isDarkMode ? '1px solid #14b8a6' : '1px solid #5eead4',
    borderRadius: '6px',
    fontSize: '10px',
    fontWeight: 600,
    padding: '1px 6px',
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

  const timeLoggedStyles = useMemo(() => ({
    color: isDarkMode ? '#73d13d' : '#52c41a',
    fontSize: '13px',
    fontWeight: 700,
    background: isDarkMode 
      ? 'linear-gradient(135deg, #1b291820 0%, #27362220 100%)'
      : 'linear-gradient(135deg, #f6ffed 0%, #f0fff4 100%)',
    padding: '4px 8px',
    borderRadius: '6px',
    border: isDarkMode ? '1px solid #52c41a40' : '1px solid #b7eb8f40',
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
          aria-label={`${t('timeLoggedTaskAriaLabel')} ${item.task_name}`}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={iconStyles}>
              <ClockCircleOutlined />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <Text ellipsis style={taskNameStyles}>
                  {item.task_name}
                </Text>
                <Tag style={timeLogTagStyles}>
                  {t('timeLogTag')}
                </Tag>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={metaTextStyles}>
                  {item.project_name}
                </Text>
                <Space size={12} align="center">
                  <span style={timeLoggedStyles}>
                    {item.total_time_logged_string}
                  </span>
                  {item.logged_by_timer && (
                    <Tag style={timerTagStyles}>
                      {t('timerTag')}
                    </Tag>
                  )}
                  <Tooltip 
                    title={moment(item.last_logged_at).format('MMMM Do YYYY, h:mm:ss a')}
                    placement="topRight"
                  >
                    <Text style={timeTextStyles}>
                      {moment(item.last_logged_at).fromNow()}
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

export default TimeLoggedTaskList;
