import {
  Drawer,
  Empty,
  Segmented,
  Typography,
  Spin,
  Button,
  Flex,
  theme,
} from '@/shared/antd-imports';
import { useEffect, useState } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import {
  fetchInvitations,
  fetchNotifications,
  setNotificationType,
  toggleDrawer,
  fetchUnreadCount,
} from '../../../../../features/navbar/notificationSlice';
import { setTargetCommentId } from '@/features/task-drawer/task-drawer.slice';

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
import taskCommentsApiService from '@/api/tasks/task-comments.api.service';
import { shouldShowAppSumoPromo } from '@/ee/utils/subscription-utils';
import { openUpgradeModal } from '@/features/admin-center/admin-center.slice';
import { APPSUMO_DRAWER_IMAGE_URL } from '@/config/appsumo-promo.config';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { MixpanelBillingEvents } from '@/types/mixpanel-events.types';
import { stripHtmlTags } from '@/utils/sanitizeInput';

const NotificationDrawer = () => {
  const { token } = theme.useToken();
  const { isDrawerOpen, notificationType, notifications, invitations } = useAppSelector(
    state => state.notificationReducer
  );
  const billingInfo = useAppSelector(state => state.adminCenterReducer.billingInfo);
  const dispatch = useAppDispatch();
  const { t } = useTranslation('navbar');
  const { trackMixpanelEvent } = useMixpanelTracking();
  const { socket, connected } = useSocket();
  const [notificationsSettings, setNotificationsSettings] = useState<INotificationSettings>({});
  const [showBrowserPush, setShowBrowserPush] = useState(false);
  const [isMarkAllHovered, setIsMarkAllHovered] = useState(false);

  const isDarkMode =
    token.colorBgContainer === '#141414' ||
    token.colorBgContainer.includes('dark') ||
    document.documentElement.getAttribute('data-theme') === 'dark';

  const notificationCount = notifications?.length || 0;
  const [isLoading, setIsLoading] = useState(false);
  const [appSumoBannerImageLoaded, setAppSumoBannerImageLoaded] = useState(false);

  const isPushEnabled = () => {
    return notificationsSettings.popup_notifications_enabled && showBrowserPush;
  };

  const navigate = useNavigate();
  const authService = createAuthService(navigate);

  const createPush = (message: string, title: string, teamId: string | null, url?: string) => {
    if (Notification.permission === 'granted' && showBrowserPush) {
      const img = 'https://worklenz.com/assets/icons/icon-128x128.png';
      const notification = new Notification(title, {
        body: stripHtmlTags(message),
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
    dispatch(fetchUnreadCount()); // Fetch updated unread count
  };

  const handleNotificationsUpdate = async (notification: IWorklenzNotification) => {
    dispatch(fetchNotifications(notificationType));
    dispatch(fetchInvitations());
    dispatch(fetchUnreadCount()); // Fetch updated unread count

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
    dispatch(fetchUnreadCount()); // Fetch updated unread count
  };

  const handleTeamMemberRemoved = async (data: { teamId: string; message: string; removedUserId?: string }) => {
    // Only show the removal notification if:
    // 1. If removedUserId is provided (new format), only show if current user is the removed one
    // 2. If removedUserId is not provided (old format for backward compatibility), show the notification
    // This ensures the removed user always sees the notification
    
    if (data.removedUserId !== undefined) {
      const profile = getUserSession();
      if (!profile || profile.id !== data.removedUserId) {
        return;
      }
    }

    const notification: IWorklenzNotification = {
      id: '',
      team: '',
      team_id: data.teamId,
      message: data.message,
    };

    if (isPushEnabled()) {
      createPush(notification.message, 'Worklenz', notification.team_id || null);
    }

    showNotification(notification);
    // Don't fetch invitations - this is a removal, not an invitation
    dispatch(fetchUnreadCount()); // Still update unread count
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
      dispatch(fetchUnreadCount()); // Fetch updated unread count
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
    if (!notification.url) return;

    dispatch(toggleDrawer());
    setIsLoading(true);
    try {
      const currentSession = getUserSession();

      // Resolve the comment ID to scroll to:
      // - new notifications have comment_id stored in DB
      // - old notifications fall back to fetching the latest comment for the task
      let resolvedCommentId: string | null = notification.comment_id || null;
      if (!resolvedCommentId && notification.task_id) {
        try {
          const res = await taskCommentsApiService.getByTaskId(notification.task_id);
          if (res.done && res.body?.length > 0) {
            const sorted = [...res.body].sort(
              (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
            );
            resolvedCommentId = sorted[0]?.id || null;
          }
        } catch {
          // non-fatal
        }
      }

      // Dispatch before navigate so it's in Redux before the drawer opens
      dispatch(setTargetCommentId(resolvedCommentId));

      // Build target URL (include comment param for URL sync)
      let targetUrl = notification.url;
      if (notification.project && notification.task_id) {
        const qParams: Record<string, string | undefined> = {
          task: notification.params?.task,
          tab: notification.params?.tab,
          comment: resolvedCommentId || undefined,
        };
        targetUrl = `${notification.url}${toQueryString(qParams)}`;
      }

      // If different team, switch teams first then full reload
      if (currentSession?.team_id && notification.team_id && notification.team_id !== currentSession.team_id) {
        await teamsApiService.setActiveTeam(notification.team_id);
        await handleVerifyAuth();
        window.location.href = targetUrl;
      } else {
        navigate(targetUrl);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
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
    dispatch(fetchUnreadCount()); // Fetch updated unread count
  };

  useEffect(() => {
    socket?.on(SocketEvents.INVITATIONS_UPDATE.toString(), handleInvitationsUpdate);
    socket?.on(SocketEvents.NOTIFICATIONS_UPDATE.toString(), handleNotificationsUpdate);
    socket?.on(SocketEvents.TEAM_MEMBER_REMOVED.toString(), handleTeamMemberRemoved);
    fetchNotificationsSettings();
    askPushPermission();
    dispatch(fetchUnreadCount()); // Initial fetch of unread count

    return () => {
      socket?.removeListener(SocketEvents.INVITATIONS_UPDATE.toString(), handleInvitationsUpdate);
      socket?.removeListener(
        SocketEvents.NOTIFICATIONS_UPDATE.toString(),
        handleNotificationsUpdate
      );
      socket?.removeListener(SocketEvents.TEAM_MEMBER_REMOVED.toString(), handleTeamMemberRemoved);
    };
  }, [socket, dispatch]);

  useEffect(() => {
    setIsLoading(true);
    dispatch(fetchInvitations());
    if (notificationType) {
      dispatch(fetchNotifications(notificationType)).finally(() => setIsLoading(false));
    }
    dispatch(fetchUnreadCount()); // Fetch unread count when notification type changes
  }, [notificationType, dispatch]);

  // Determine hover color based on theme
  const getMarkAllHoverColor = () => {
    return isDarkMode ? '#69b1ff' : '#1677ff';
  };

  const showAppSumoBanner =
    Boolean(APPSUMO_DRAWER_IMAGE_URL) &&
    shouldShowAppSumoPromo(getUserSession(), billingInfo) &&
    authService.isOwnerOrAdmin();

  // Preload the banner image in the background so it's already cached by the
  // time the user opens the drawer, instead of loading on first render.
  useEffect(() => {
    if (!showAppSumoBanner || !APPSUMO_DRAWER_IMAGE_URL) return;

    const preloadImage = new Image();
    preloadImage.onload = () => setAppSumoBannerImageLoaded(true);
    preloadImage.onerror = () => setAppSumoBannerImageLoaded(true);
    preloadImage.src = APPSUMO_DRAWER_IMAGE_URL;

    return () => {
      preloadImage.onload = null;
      preloadImage.onerror = null;
    };
  }, [showAppSumoBanner]);

  const handleAppSumoBannerClick = () => {
    trackMixpanelEvent(MixpanelBillingEvents.APPSUMO_PROMO_DRAWER_BANNER_CLICKED, {
      source_component: 'NotificationDrawer',
    });
    dispatch(toggleDrawer());
    dispatch(openUpgradeModal());
  };

  return (
    <Drawer
      title={
        <Typography.Text style={{ fontWeight: 500, fontSize: 16 }}>
          {notificationType === NOTIFICATION_OPTION_READ
            ? t('notificationsDrawer.read', { defaultValue: 'Read' })
            : t('notificationsDrawer.unread', { defaultValue: 'Unread' })}{' '}
          ({notificationCount})
        </Typography.Text>
      }
      open={isDrawerOpen}
      onClose={() => dispatch(toggleDrawer())}
      width={400}
      styles={showAppSumoBanner ? { footer: { padding: 8 } } : undefined}
      footer={
        showAppSumoBanner ? (
          <div
            role="button"
            tabIndex={0}
            className="appsumo-drawer-banner"
            onClick={handleAppSumoBannerClick}
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleAppSumoBannerClick();
              }
            }}
          >
            {!appSumoBannerImageLoaded && (
              <Flex align="center" justify="center" style={{ minHeight: 60 }}>
                <Spin size="small" />
              </Flex>
            )}
            <img
              src={APPSUMO_DRAWER_IMAGE_URL}
              alt="AppSumo"
              style={{ display: appSumoBannerImageLoaded ? 'block' : 'none' }}
              onLoad={() => setAppSumoBannerImageLoaded(true)}
            />
          </div>
        ) : undefined
      }
    >
      <Flex justify="space-between" align="center">
        <Segmented<string>
          options={[
            { label: t('notificationsDrawer.unread', { defaultValue: 'Unread' }), value: NOTIFICATION_OPTION_UNREAD },
            { label: t('notificationsDrawer.read', { defaultValue: 'Read' }), value: NOTIFICATION_OPTION_READ },
          ]}
          defaultValue={NOTIFICATION_OPTION_UNREAD}
          onChange={(value: string) => {
            dispatch(setNotificationType(value));
          }}
        />

        {notificationType === NOTIFICATION_OPTION_UNREAD && (
          <Button
            type="link"
            onClick={handleMarkAllAsRead}
            onMouseEnter={() => setIsMarkAllHovered(true)}
            onMouseLeave={() => setIsMarkAllHovered(false)}
            style={{
              color: isMarkAllHovered ? getMarkAllHoverColor() : 'var(--ant-primary-color)',
              transition: 'color 0.3s ease',
            }}
          >
            {t('notificationsDrawer.markAsRead', { defaultValue: 'Mark all as read' })}
          </Button>
        )}
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
          description={t('notificationsDrawer.noNotifications', { defaultValue: 'No notifications' })}
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
