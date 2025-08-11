import React from 'react';
import { Button, Divider, Flex, Popconfirm, Typography, Space } from '@/shared/antd-imports';
import { colors } from '@/styles/colors';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { formatDateTimeWithUserTimezone } from '@/utils/format-date-time-with-user-timezone';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import './time-log-item.css';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTimeLogEditing } from '@/features/task-drawer/task-drawer.slice';
import TimeLogForm from './time-log-form';
import { useAuthService } from '@/hooks/useAuth';

type TimeLogItemProps = {
  log: ITaskLogViewModel;
  onDelete?: () => void;
};

const TimeLogItem = ({ log, onDelete }: TimeLogItemProps) => {
  const {
    user_name,
    avatar_url,
    time_spent_text,
    logged_by_timer,
    created_at,
    user_id,
    description,
  } = log;
  const { selectedTaskId } = useAppSelector(state => state.taskDrawerReducer);
  const dispatch = useAppDispatch();
  const currentSession = useAuthService().getCurrentSession();

  const renderLoggedByTimer = () => {
    if (!logged_by_timer) return null;
    return (
      <>
        via Timer about{' '}
        <Typography.Text strong style={{ fontSize: 15 }}>
          {logged_by_timer}
        </Typography.Text>
      </>
    );
  };

  const canDelete = user_id === currentSession?.id;

  const handleDeleteTimeLog = async (logId: string | undefined) => {
    if (!logId || !selectedTaskId) return;
    const res = await taskTimeLogsApiService.delete(logId, selectedTaskId);
    if (res.done) {
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
        <Button
          type="link"
          onClick={handleEdit}
          style={{ padding: '0', height: 'auto', fontSize: '14px' }}
        >
          Edit
        </Button>
        <Popconfirm
          title="Are you sure you want to delete this time log?"
          onConfirm={() => handleDeleteTimeLog(log.id)}
        >
          <Button type="link" style={{ padding: '0', height: 'auto', fontSize: '14px' }}>
            Delete
          </Button>
        </Popconfirm>
      </Space>
    );
  };

  return (
    <div className="time-log-item">
      <Flex vertical gap={8}>
        <Flex align="start" gap={12}>
          <SingleAvatar avatarUrl={avatar_url} name={user_name} />
          <Flex vertical style={{ flex: 1 }}>
            <Flex justify="space-between" align="start">
              <Flex vertical>
                <Typography.Text>
                  <Typography.Text strong>{user_name}</Typography.Text> logged{' '}
                  <Typography.Text strong>{time_spent_text}</Typography.Text>{' '}
                  {renderLoggedByTimer()} {calculateTimeGap(created_at || '')}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  {formatDateTimeWithUserTimezone(created_at || '', currentSession?.timezone_name)}
                </Typography.Text>
              </Flex>
              {renderActionButtons()}
            </Flex>

            {description && (
              <Typography.Text style={{ marginTop: 8, display: 'block' }}>
                {description}
              </Typography.Text>
            )}
          </Flex>
        </Flex>
        <Divider style={{ margin: '8px 0' }} />
      </Flex>
    </div>
  );
};

export default TimeLogItem;
