import { Drawer, Empty, Segmented, Typography, Spin, Button, Flex } from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchInvitations,
  fetchNotifications,
  setNotificationType,
  toggleDrawer,
} from '../../../../../features/navbar/notificationSlice';
import { NOTIFICATION_OPTION_READ, NOTIFICATION_OPTION_UNREAD } from '@/shared/constants';
import { useTranslation } from 'react-i18next';
import { SocketEvents } from '@/shared/socket-events';
import { IWorklenzNotification } from '@/types/notifications/notifications.types';
import { useSocket } from '@/socket/socketContext';
import { ITeamInvitationViewModel } from '@/types/notifications/notifications.types';
import logger from '@/utils/errorLogger';
import NotificationItem from './notification-item';
import InvitationItem from './invitation-item';
import { notificationsApiService } from '@/api/notifications/notifications.api.service';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { INotificationSettings } from '@/types/settings/notifications.types';
import { toQueryString } from '@/utils/toQueryString';
import { showNotification } from './push-notification-template';
import { teamsApiService } from '@/api/teams/teams.api.service';
import { verifyAuthentication } from '@/features/auth/authSlice';
import { getUserSession } from '@/utils/session-helper';
import { setUser } from '@/features/user/userSlice';
import { useNavigate } from 'react-router-dom';
import { createAuthService } from '@/services/auth/auth.service';
const HTML_TAG_REGEXP = /<[^>]*>/g;

const NotificationDrawer = () => {
  const { isDrawerOpen, notificationType, notifications, invitations } = useAppSelector(
    state => state.notificationReducer
  );
  const dispatch = useAppDispatch();
  const { t } = useTranslation('navbar');
  const { socket, connected } = useSocket();
  const [notificationsSettings, setNotificationsSettings] = useState<INotificationSettings>({});
  const [showBrowserPush, setShowBrowserPush] = useState(false);

  const notificationCount = notifications?.length || 0;
  const [isLoading, setIsLoading] = useState(false);

  const isPushEnabled = () => {
    return notificationsSettings.popup_notifications_enabled && showBrowserPush;
  };

  const navigate = useNavigate();
  const authService = createAuthService(navigate);

  const createPush = (message: string, title: string, teamId: string | null, url?: string) => {
    if (Notification.permission === 'granted' && showBrowserPush) {
      const img = 'https://worklenz.com/assets/icons/icon-128x128.png';
      const notification = new Notification(title, {
        body: message.replace(HTML_TAG_REGEXP, ''),
        icon: img,
        badge: img,
      });

      notification.onclick = async event => {
        if (url) {
          window.focus();

          if (teamId) {
            await teamsApiService.setActiveTeam(teamId);
          }

          window.location.href = url;
        }
      };
    }
  };

  const handleInvitationsUpdate = (data: ITeamInvitationViewModel[]) => {
    dispatch(fetchInvitations());
  };

  const handleNotificationsUpdate = async (notification: IWorklenzNotification) => {
    dispatch(fetchNotifications(notificationType));
    dispatch(fetchInvitations());

    if (isPushEnabled()) {
      const title = notification.team ? `${notification.team} | Worklenz` : 'Worklenz';
      let url = notification.url;
      if (url && notification.params && Object.keys(notification.params).length) {
        const q = toQueryString(notification.params);
        url += q;
      }

      createPush(notification.message, title, notification.team_id, url);
    }

    // Show notification using the template
    showNotification(notification);
  };

  const handleTeamInvitationsUpdate = async (data: ITeamInvitationViewModel) => {
    const notification: IWorklenzNotification = {
      id: data.id || '',
      team: data.team_name || '',
      team_id: data.team_id || '',
      message: `You have been invited to join ${data.team_name || 'a team'}`,
    };

    if (isPushEnabled()) {
      createPush(
        notification.message,
        notification.team || 'Worklenz',
        notification.team_id || null
      );
    }

    // Show notification using the template
    showNotification(notification);
    dispatch(fetchInvitations());
  };

  const askPushPermission = () => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            setShowBrowserPush(true);
            logger.info('Permission granted');
          }
        });
      } else if (Notification.permission === 'granted') {
        setShowBrowserPush(true);
      }
    } else {
      logger.error('This browser does not support notification permission.');
      return;
    }
  };

  const markNotificationAsRead = async (id: string) => {
    if (!id) return;

    const res = await notificationsApiService.updateNotification(id);
    if (res.done) {
      dispatch(fetchNotifications(notificationType));
      dispatch(fetchInvitations());
    }
  };
  const handleVerifyAuth = async () => {
    const result = await dispatch(verifyAuthentication()).unwrap();
    if (result.authenticated) {
      dispatch(setUser(result.user));
      authService.setCurrentSession(result.user);
    }
  };

  const goToUrl = async (event: React.MouseEvent, notification: IWorklenzNotification) => {
    event.preventDefault();
    event.stopPropagation();
    if (notification.url) {
      dispatch(toggleDrawer());
      setIsLoading(true);
      try {
        const currentSession = getUserSession();
        if (currentSession?.team_id && notification.team_id !== currentSession.team_id) {
          await handleVerifyAuth();
        }
        if (notification.project && notification.task_id) {
          navigate(
            `${notification.url}${toQueryString({ task: notification.params?.task, tab: notification.params?.tab })}`
          );
        }
      } catch (error) {
        console.error('Error navigating to URL:', error);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const fetchNotificationsSettings = async () => {
    try {
      setIsLoading(true);
      const res = await profileSettingsApiService.getNotificationSettings();
      if (res.done) {
        setNotificationsSettings(res.body);
      }
    } catch (error) {
      logger.error('Error fetching notifications settings', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    await notificationsApiService.readAllNotifications();
    dispatch(fetchNotifications(notificationType));
    dispatch(fetchInvitations());
  };

  useEffect(() => {
    socket?.on(SocketEvents.INVITATIONS_UPDATE.toString(), handleInvitationsUpdate);
    socket?.on(SocketEvents.NOTIFICATIONS_UPDATE.toString(), handleNotificationsUpdate);
    socket?.on(SocketEvents.TEAM_MEMBER_REMOVED.toString(), handleTeamInvitationsUpdate);
    fetchNotificationsSettings();
    askPushPermission();

    return () => {
      socket?.removeListener(SocketEvents.INVITATIONS_UPDATE.toString(), handleInvitationsUpdate);
      socket?.removeListener(
        SocketEvents.NOTIFICATIONS_UPDATE.toString(),
        handleNotificationsUpdate
      );
      socket?.removeListener(
        SocketEvents.TEAM_MEMBER_REMOVED.toString(),
        handleTeamInvitationsUpdate
      );
    };
  }, [socket]);

  useEffect(() => {
    setIsLoading(true);
    dispatch(fetchInvitations());
    if (notificationType) {
      dispatch(fetchNotifications(notificationType)).finally(() => setIsLoading(false));
    }
  }, [notificationType, dispatch]);

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {notificationType === NOTIFICATION_OPTION_READ
            ? t('notificationsDrawer.read')
            : t('notificationsDrawer.unread')}{' '}
          ({notificationCount})
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleDrawer())}
      width={400}
    >
      <Flex justify="space-between" align="center">
        <Segmented<string>
          options={['Unread', 'Read']}
          defaultValue={NOTIFICATION_OPTION_UNREAD}
          onChange={(value: string) => {
            if (value === NOTIFICATION_OPTION_UNREAD)
              dispatch(setNotificationType(NOTIFICATION_OPTION_UNREAD));
            if (value === NOTIFICATION_OPTION_READ)
              dispatch(setNotificationType(NOTIFICATION_OPTION_READ));
          }}
        />

        <Button type="link" onClick={handleMarkAllAsRead}>
          {t('notificationsDrawer.markAsRead')}
        </Button>
      </Flex>

      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 40 }}>
          <Spin />
        </div>
      )}
      {invitations && invitations.length > 0 && notificationType === NOTIFICATION_OPTION_UNREAD ? (
        <div className="notification-list mt-3">
          {invitations.map(invitation => (
            <InvitationItem
              key={invitation.id}
              item={invitation}
              isUnreadNotifications={notificationType === NOTIFICATION_OPTION_UNREAD}
              t={t}
            />
          ))}
        </div>
      ) : null}
      {notifications && notifications.length > 0 ? (
        <div className="notification-list mt-3">
          {notifications.map(notification => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              isUnreadNotifications={notificationType === NOTIFICATION_OPTION_UNREAD}
              markNotificationAsRead={id => Promise.resolve(markNotificationAsRead(id))}
              goToUrl={goToUrl}
            />
          ))}
        </div>
      ) : (
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={t('notificationsDrawer.noNotifications')}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            marginBlockStart: 32,
          }}
        />
      )}
    </Drawer>
  );
};

export default NotificationDrawer;
