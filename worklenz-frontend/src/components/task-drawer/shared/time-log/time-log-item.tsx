import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Divider, Flex, Popconfirm, Typography, Space, Tag, theme } from '@/shared/antd-imports';
import { ITaskLogViewModel } from '@/types/tasks/task-log-view.types';
import SingleAvatar from '@/components/common/single-avatar/single-avatar';
import { formatDateTimeWithUserTimezone } from '@/utils/format-date-time-with-user-timezone';
import { calculateTimeGap } from '@/utils/calculate-time-gap';
import './time-log-item.css';
import { taskTimeLogsApiService } from '@/api/tasks/task-time-logs.api.service';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setTimeLogEditing } from '@/features/task-drawer/task-drawer.slice';
import { useAuthService } from '@/hooks/useAuth';
import useIsProjectManager from '@/hooks/useIsProjectManager';

type TimeLogItemProps = {
  log: ITaskLogViewModel;
  onDelete?: () => void;
  isGuest?: boolean;
};

const TimeLogItem = ({ log, onDelete, isGuest = false }: TimeLogItemProps) => {
  const { t } = useTranslation('task-drawer/task-drawer');
  const {
    user_name,
    avatar_url,
    time_spent_text,
    logged_by_timer,
    created_at,
    user_id,
    description,
  } = log;
  const { selectedTaskId, taskFormViewModel } = useAppSelector(
    state => state.taskDrawerReducer
  );
  const dispatch = useAppDispatch();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();
  const projectId = taskFormViewModel?.task?.project_id ?? null;
  const { token } = theme.useToken();
  const isProjectManager = useIsProjectManager(projectId);
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();

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

  const isOwnLog = user_id === currentSession?.id;
  // Own logs, or Owner/Admin / PM on this project (full task actions).
  const canManageLog =
    !isGuest && (isOwnLog || isOwnerOrAdmin || isProjectManager);

  const handleDeleteTimeLog = async () => {
    if (!selectedTaskId) return;
    const idsToDelete =
      log.part_log_ids && log.part_log_ids.length > 0 ? log.part_log_ids : log.id ? [log.id] : [];
    if (idsToDelete.length === 0) return;

    let allDone = true;
    for (const id of idsToDelete) {
      const res = await taskTimeLogsApiService.delete(id, selectedTaskId);
      if (!res.done) {
        allDone = false;
      }
    }
    if (allDone && onDelete) {
      onDelete();
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
    if (!canManageLog) return null;

    return (
      <Space size={8}>
        <Button
          type="link"
          onClick={handleEdit}
          style={{ padding: '0', height: 'auto', fontSize: '14px' }}
          aria-label={t('taskTimeLogTab.edit', { defaultValue: 'Edit' })}
        >
          {t('taskTimeLogTab.edit', { defaultValue: 'Edit' })}
        </Button>
        <Popconfirm
          title={t('taskTimeLogTab.confirmDelete', {
            defaultValue: 'Are you sure you want to delete this time log?',
          })}
          onConfirm={handleDeleteTimeLog}
          okText={t('taskTimeLogTab.confirmDeleteYes', { defaultValue: 'Yes' })}
          cancelText={t('taskTimeLogTab.confirmDeleteNo', { defaultValue: 'No' })}
        >
          <Button
            type="link"
            style={{ padding: '0', height: 'auto', fontSize: '14px' }}
            aria-label={t('taskTimeLogTab.delete', { defaultValue: 'Delete' })}
          >
            {t('taskTimeLogTab.delete', { defaultValue: 'Delete' })}
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

            {log.is_overnight_split && log.daily_breakdown && log.daily_breakdown.length > 0 && (
              <div
                style={{
                  marginTop: 8,
                  padding: '6px 10px',
                  borderRadius: token.borderRadiusSM,
                  background: token.colorFillAlter,
                  border: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                <Flex vertical gap={4}>
                  <Typography.Text type="secondary" style={{ fontSize: 11, fontWeight: 500 }}>
                    {t('taskTimeLogTab.dailyBreakdownTitle', { defaultValue: 'Daily Breakdown' })}:
                  </Typography.Text>
                  <Flex gap={6} wrap="wrap">
                    {log.daily_breakdown.map((item, idx) => (
                      <Tag key={idx} style={{ margin: 0, fontSize: 11 }}>
                        <strong>{item.date_formatted}</strong>: {item.time_spent_text} ({item.time_range_text})
                      </Tag>
                    ))}
                  </Flex>
                </Flex>
              </div>
            )}
          </Flex>
        </Flex>
        <Divider style={{ margin: '8px 0' }} />
      </Flex>
    </div>
  );
};

export default TimeLogItem;
