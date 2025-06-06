import React from 'react';
import { Button, Divider, Flex, Popconfirm, Typography, Space, Tag, Card } from 'antd';
import { ClockCircleOutlined } from '@ant-design/icons';
import { colors } from '@/styles/colors';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { formatDateTimeWithLocale } from '@/utils/format-date-time-with-locale';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import './time-log-item.css';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTimeLogEditing } from '@/features/task-drawer/task-drawer.slice';
import TimeLogForm from './time-log-form';
import { useAuthService } from '@/hooks/useAuth';
import { setRefreshTimestamp } from '@/features/project/project.slice';

type TimeLogItemProps = {
  log: ITaskLogViewModel;
  onDelete?: () => void;
};

const TimeLogItem = ({ log, onDelete }: TimeLogItemProps) => {
  const { user_name, avatar_url, time_spent_text, logged_by_timer, created_at, user_id, description, task_name, task_id, start_time, end_time } = log;
  const { selectedTaskId, taskFormViewModel } = useAppSelector(state => state.taskDrawerReducer);
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();

  const renderLoggedByTimer = () => {
    if (!logged_by_timer) return null;
    return (
      <Tag icon={<ClockCircleOutlined />} color="green" style={{ fontSize: '11px', margin: 0 }}>
        Timer
      </Tag>
    );
  };

  const canDelete = user_id === currentSession?.id;

  const handleDeleteTimeLog = async (logId: string | undefined) => {
    if (!logId || !selectedTaskId) return;
    const res = await taskTimeLogsApiService.delete(logId, selectedTaskId);
    if (res.done) {
      // Trigger refresh of finance data
      dispatch(setRefreshTimestamp());
      
      if (onDelete) onDelete();
    }
  };

  const handleEdit = () => {
    dispatch(
      setTimeLogEditing({
        isEditing: true,
        logBeingEdited: log,
      })
    );
  };

  const renderActionButtons = () => {
    if (!canDelete) return null;
    
    return (
      <Space size={8}>
        <Button type="link" onClick={handleEdit} style={{ padding: '0', height: 'auto', fontSize: '12px' }}>
          Edit
        </Button>
        <Popconfirm
          title="Are you sure you want to delete this time log?"
          onConfirm={() => handleDeleteTimeLog(log.id)}
        >
          <Button type="link" style={{ padding: '0', height: 'auto', fontSize: '12px', color: '#ff4d4f' }}>
            Delete
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  // Check if this time log is from a subtask
  const isFromSubtask = task_id && task_id !== selectedTaskId;

  const formatTime = (timeString: string | undefined) => {
    if (!timeString) return '';
    try {
      return new Date(timeString).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: true 
      });
    } catch {
      return timeString;
    }
  };

  const formatDate = (timeString: string | undefined) => {
    if (!timeString) return '';
    try {
      return new Date(timeString).toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return timeString;
    }
  };

  const isDarkMode = themeMode === 'dark';

  return (
    <div className="time-log-item">
      <Card 
        size="small" 
        style={{ 
          marginBottom: 8, 
          borderRadius: 8,
          boxShadow: isDarkMode ? '0 1px 3px rgba(255,255,255,0.1)' : '0 1px 3px rgba(0,0,0,0.1)',
          border: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0',
          backgroundColor: isDarkMode ? '#1f1f1f' : '#ffffff'
        }}
        bodyStyle={{ padding: '12px 16px' }}
      >
        <Flex vertical gap={12}>
          {/* Header with user info and task name */}
          <Flex align="center" justify="space-between">
            <Flex align="center" gap={12}>
              <SingleAvatar avatarUrl={avatar_url} name={user_name} />
              <Flex vertical gap={2}>
                <Flex align="center" gap={8} wrap>
                  <Typography.Text strong style={{ fontSize: '14px' }}>
                    {user_name}
                  </Typography.Text>
                  {task_name && (
                    <Tag color={isFromSubtask ? "blue" : "default"} style={{ fontSize: '11px', margin: 0 }}>
                      {task_name}
                    </Tag>
                  )}
                  {renderLoggedByTimer()}
                </Flex>
                <Typography.Text type="secondary" style={{ fontSize: '12px' }}>
                  {calculateTimeGap(created_at || '')}
                </Typography.Text>
              </Flex>
            </Flex>
            {renderActionButtons()}
          </Flex>

          {/* Time tracking details */}
          <Flex align="center" justify="space-between" style={{ 
            backgroundColor: isDarkMode ? '#262626' : '#fafafa', 
            padding: '8px 12px', 
            borderRadius: 6,
            border: isDarkMode ? '1px solid #303030' : '1px solid #f0f0f0'
          }}>
            <Flex align="center" gap={16}>
              <Flex vertical gap={2}>
                <Typography.Text type="secondary" style={{ fontSize: '11px', lineHeight: 1 }}>
                  Start Time
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '12px', lineHeight: 1 }}>
                  {formatTime(start_time)}
                </Typography.Text>
              </Flex>
              
              <Divider type="vertical" style={{ height: '24px', margin: 0 }} />
              
              <Flex vertical gap={2}>
                <Typography.Text type="secondary" style={{ fontSize: '11px', lineHeight: 1 }}>
                  End Time
                </Typography.Text>
                <Typography.Text strong style={{ fontSize: '12px', lineHeight: 1 }}>
                  {formatTime(end_time)}
                </Typography.Text>
              </Flex>
              
              <Divider type="vertical" style={{ height: '24px', margin: 0 }} />
              
              <Flex align="center" gap={6}>
                <ClockCircleOutlined style={{ color: '#1890ff', fontSize: '14px' }} />
                <Flex vertical gap={2}>
                  <Typography.Text type="secondary" style={{ fontSize: '11px', lineHeight: 1 }}>
                    Duration
                  </Typography.Text>
                  <Typography.Text strong style={{ fontSize: '12px', lineHeight: 1, color: '#1890ff' }}>
                    {time_spent_text}
                  </Typography.Text>
                </Flex>
              </Flex>
            </Flex>
            
            <Typography.Text type="secondary" style={{ fontSize: '11px' }}>
              {formatDate(created_at)}
            </Typography.Text>
          </Flex>

          {/* Description */}
          {description && (
            <Flex vertical gap={4}>
              <Typography.Text type="secondary" style={{ fontSize: '11px', fontWeight: 500 }}>
                Description:
              </Typography.Text>
              <Typography.Text style={{ fontSize: '13px', lineHeight: 1.4 }}>
                {description}
              </Typography.Text>
            </Flex>
          )}
        </Flex>
      </Card>
    </div>
  );
};

export default TimeLogItem;
