import { BellOutlined } from '@/shared/antd-imports';
import { Badge, Tooltip } from '@/shared/antd-imports';
import { toggleDrawer } from '@features/navbar/notificationSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useTooltipTheme } from '@/hooks/useTooltipTheme';
import '@/features/navbar/navbar-icon-hover.css';

const NotificationButton = () => {
  const dispatch = useAppDispatch();
  const { unreadNotificationsCount } = useAppSelector(state => state.notificationReducer);
  const { t } = useTranslation('navbar');
  const { tooltipProps } = useTooltipTheme();

  const hasUnreadNotifications = () => {
    return unreadNotificationsCount > 0;
  };

  return (
    <Tooltip title={t('notificationTooltip')} trigger={'hover'} {...tooltipProps}>
      <button className="navbar-icon-hover" onClick={() => dispatch(toggleDrawer())}>
        {hasUnreadNotifications() ? (
          <Badge count={unreadNotificationsCount}>
            <BellOutlined style={{ fontSize: 20 }} />
          </Badge>
        ) : (
          <BellOutlined style={{ fontSize: 20 }} />
        )}
      </button>
    </Tooltip>
  );
};

export default NotificationButton;
