import { BellOutlined } from '@/shared/antd-imports';
import { Badge, Button, Tooltip } from '@/shared/antd-imports';
import { toggleDrawer } from '@features/navbar/notificationSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const NotificationButton = () => {
  const dispatch = useAppDispatch();
  const { unreadNotificationsCount } = useAppSelector(state => state.notificationReducer);
  const { t } = useTranslation('navbar');

  const hasUnreadNotifications = () => {
    return unreadNotificationsCount > 0;
  };

  return (
    <Tooltip title={t('notificationTooltip')} trigger={'hover'}>
      <Button
        style={{ height: '62px', width: '60px' }}
        type="text"
        icon={
          hasUnreadNotifications() ? (
            <Badge count={unreadNotificationsCount}>
              <BellOutlined style={{ fontSize: 20 }} />
            </Badge>
          ) : (
            <BellOutlined style={{ fontSize: 20 }} />
          )
        }
        onClick={() => dispatch(toggleDrawer())}
      />
    </Tooltip>
  );
};

export default NotificationButton;
