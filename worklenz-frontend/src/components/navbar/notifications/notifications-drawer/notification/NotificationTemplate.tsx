import React, { memo, useCallback, useMemo } from 'react';
import { Button, Typography, Tag } from '@/shared/antd-imports';
import { BankOutlined } from '@/shared/antd-imports';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleDrawer } from '@features/navbar/notificationSlice';
import { teamsApiService } from '@/api/teams/teams.api.service';
import { formatDistanceToNow } from 'date-fns';
import { tagBackground } from '@/utils/colorUtils';
import logger from '@/utils/errorLogger';
import './NotificationItem.css';

interface NotificationTemplateProps {
  item: IWorklenzNotification;
  isUnreadNotifications: boolean;
  markNotificationAsRead: (id: string) => Promise<void>;
  loadersMap: Record<string, boolean>;
}

const NotificationTemplate = memo<NotificationTemplateProps>(({
  item,
  isUnreadNotifications,
  markNotificationAsRead,
  loadersMap,
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const goToUrl = useCallback(
    async (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (!item.url) return;

      try {
        dispatch(toggleDrawer());

        if (item.team_id) {
          await teamsApiService.setActiveTeam(item.team_id);
        }

        navigate(item.url, {
          state: item.params || null,
        });
      } catch (error) {
        logger.error('Error navigating to notification URL', error);
      }
    },
    [item.url, item.team_id, item.params, dispatch, navigate]
  );

  const formattedDate = useMemo(() => {
    if (!item.created_at) return '';
    try {
      return formatDistanceToNow(new Date(item.created_at), { addSuffix: true });
    } catch (error) {
      logger.error('Error formatting date', error);
      return '';
    }
  }, [item.created_at]);

  const handleMarkAsRead = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      markNotificationAsRead(item.id);
    },
    [markNotificationAsRead, item.id]
  );

  const containerStyle = useMemo(
    () => ({
      border: item.color ? `2px solid ${item.color}4d` : undefined,
    }),
    [item.color]
  );

  const containerClassName = useMemo(
    () => [
      'w-auto p-3 mb-3 rounded border border-gray-200 bg-white shadow-sm transition-all duration-300',
      'hover:shadow-md hover:bg-gray-50',
      item.url ? 'cursor-pointer' : 'cursor-default',
      'dark:border-gray-600 dark:bg-gray-800 dark:hover:bg-gray-700'
    ].join(' '),
    [item.url]
  );

  const messageHtml = useMemo(
    () => ({ __html: item.message }),
    [item.message]
  );

  const tagStyle = useMemo(
    () => (item.color ? { backgroundColor: tagBackground(item.color) } : {}),
    [item.color]
  );

  const shouldShowProject = useMemo(
    () => Boolean(item.project && item.color),
    [item.project, item.color]
  );

  const isLoading = useMemo(
    () => Boolean(loadersMap[item.id]),
    [loadersMap, item.id]
  );

  return (
    <div
      style={containerStyle}
      onClick={goToUrl}
      className={containerClassName}
    >
      <div className="notification-content">
        <div className="notification-description">
          <Typography.Text type="secondary" className="mb-2 flex items-center gap-2">
            <BankOutlined /> {item.team}
          </Typography.Text>
          <div className="mb-2" dangerouslySetInnerHTML={messageHtml} />
          {shouldShowProject && (
            <div className="mb-2">
              <Tag style={tagStyle}>{item.project}</Tag>
            </div>
          )}
        </div>

        <div className="flex items-baseline justify-between mt-2">
          {isUnreadNotifications && (
            <Button
              type="link"
              shape="round"
              size="small"
              loading={isLoading}
              onClick={handleMarkAsRead}
            >
              <u>Mark as read</u>
            </Button>
          )}
          <Typography.Text type="secondary" className="text-xs">
            {formattedDate}
          </Typography.Text>
        </div>
      </div>
    </div>
  );
});

NotificationTemplate.displayName = 'NotificationTemplate';

export default NotificationTemplate;
