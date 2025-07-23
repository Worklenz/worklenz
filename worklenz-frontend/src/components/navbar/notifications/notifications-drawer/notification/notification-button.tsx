import { BellOutlined } from '@/shared/antd-imports';
import { Badge, Button, Tooltip } from '@/shared/antd-imports';
import { toggleDrawer } from '@features/navbar/notificationSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';

const NotificationButton = () => {
  const dispatch = useAppDispatch();
  const { notifications, invitations } = useAppSelector(state => state.notificationReducer);
  const { t } = useTranslation('navbar');

  const hasNotifications = () => {
    return notifications.length > 0 || invitations.length > 0;
  };

  const notificationCount = () => {
    return notifications.length + invitations.length;
  };

  return (
    <Tooltip title={t('notificationTooltip')} trigger={'hover'}>
      <Button
        style={{ height: '62px', width: '60px' }}
        type="text"
        icon={
          hasNotifications() ? (
            <Badge count={notificationCount()}>
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
