import { Button, Typography, Tag } from '@/shared/antd-imports';
import { BankOutlined } from '@/shared/antd-imports';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { toggleDrawer } from '../../../../../features/navbar/notificationSlice';
import { teamsApiService } from '@/api/teams/teams.api.service';
import { formatDistanceToNow } from 'date-fns';
import { tagBackground } from '@/utils/colorUtils';

interface NotificationTemplateProps {
  item: IWorklenzNotification;
  isUnreadNotifications: boolean;
  markNotificationAsRead: (id: string) => Promise<void>;
  loadersMap: Record<string, boolean>;
}

const NotificationTemplate: React.FC<NotificationTemplateProps> = ({
  item,
  isUnreadNotifications,
  markNotificationAsRead,
  loadersMap,
}) => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const goToUrl = async (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    console.log('goToUrl triggered', { url: item.url, teamId: item.team_id });

    if (item.url) {
      dispatch(toggleDrawer());

      if (item.team_id) {
        await teamsApiService.setActiveTeam(item.team_id);
      }

      navigate(item.url, {
        state: item.params || null,
      });
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    return formatDistanceToNow(new Date(dateString), { addSuffix: true });
  };

  const handleMarkAsRead = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    markNotificationAsRead(item.id);
  };

  return (
    <div
      style={{ width: 'auto', border: `2px solid ${item.color}4d` }}
      onClick={goToUrl}
      className={`ant-notification-notice worklenz-notification rounded-4 ${item.url ? 'cursor-pointer' : ''}`}
    >
      <div className="ant-notification-notice-content">
        <div className="ant-notification-notice-description">
          <Typography.Text type="secondary" className="mb-1">
            <BankOutlined /> {item.team}
          </Typography.Text>
          <div className="mb-1" dangerouslySetInnerHTML={{ __html: item.message }} />
          {item.project && item.color && (
            <Tag style={{ backgroundColor: tagBackground(item.color) }}>{item.project}</Tag>
          )}
        </div>

        <div className="d-flex align-items-baseline justify-content-between mt-1">
          {isUnreadNotifications && (
            <Button
              type="link"
              shape="round"
              size="small"
              loading={loadersMap[item.id]}
              onClick={handleMarkAsRead}
            >
              <u>Mark as read</u>
            </Button>
          )}
          <Typography.Text type="secondary" className="small">
            {formatDate(item.created_at)}
          </Typography.Text>
        </div>
      </div>
    </div>
  );
};

export default NotificationTemplate;
