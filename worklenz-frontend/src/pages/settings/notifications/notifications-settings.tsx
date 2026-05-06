import { useEffect, useState, useCallback } from 'react';
import { Card, Checkbox, Divider, Flex, Form, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { INotificationSettings } from '@/types/settings/notifications.types';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import logger from '@/utils/errorLogger';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_notifications_visit } from '@/shared/worklenz-analytics-events';

const NotificationsSettings = () => {
  const { t } = useTranslation('settings/notifications');
  const [form] = Form.useForm();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [notificationsSettings, setNotificationsSettings] = useState<INotificationSettings>({});
  const [isLoading, setIsLoading] = useState(false);

  useDocumentTitle(t('title'));

  const fetchNotificationsSettings = useCallback(async () => {
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
  }, []);

  const updateNotificationSettings = useCallback(
    async (settings: INotificationSettings) => {
      try {
        const res = await profileSettingsApiService.updateNotificationSettings(settings);
        if (res.done) {
          // Update with server response if available
          setNotificationsSettings(prev => res.body || prev);
          return true;
        }
        return false;
      } catch (error) {
        logger.error('Error updating notifications settings', error);
        // On error, refetch to revert to server state
        await fetchNotificationsSettings();
        return false;
      }
    },
    [fetchNotificationsSettings]
  );

  const toggleNotificationSetting = useCallback(
    async (key: keyof INotificationSettings) => {
      // Optimistic update - update UI immediately using functional update
      setNotificationsSettings(prev => {
        const newValue = !prev[key];
        const newSettings = { ...prev, [key]: newValue };

        // Sync with server in the background (don't block UI)
        updateNotificationSettings(newSettings);

        return newSettings;
      });

      // Handle push notification permission
      if (key === 'popup_notifications_enabled') {
        askPushPermission();
      }
    },
    [updateNotificationSettings]
  );

  const askPushPermission = () => {
    if ('Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window) {
      if (Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
          if (permission === 'granted') {
            logger.info('Permission granted');
          }
        });
      }
    } else {
      logger.error('This browser does not support notification permission.');
      return;
    }
  };

  useEffect(() => {
    trackMixpanelEvent(evt_settings_notifications_visit);
    fetchNotificationsSettings();
  }, [trackMixpanelEvent, fetchNotificationsSettings]);

  return (
    <Card style={{ width: '100%' }}>
      <Flex vertical gap={4}>
        <Flex gap={8} align="center">
          <Checkbox
            disabled={isLoading}
            checked={!!notificationsSettings.email_notifications_enabled}
            onChange={() => toggleNotificationSetting('email_notifications_enabled')}
          >
            <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
              {t('emailTitle')}
            </Typography.Title>
          </Checkbox>
        </Flex>
        <Typography.Text
          style={{ fontSize: 14, color: themeMode === 'dark' ? '#9CA3AF' : '#00000073' }}
        >
          {t('emailDescription')}
        </Typography.Text>
      </Flex>
      <Divider />
      <Flex vertical gap={4}>
        <Flex gap={8} align="center">
          <Checkbox
            disabled={isLoading}
            checked={!!notificationsSettings.daily_digest_enabled}
            onChange={() => toggleNotificationSetting('daily_digest_enabled')}
          >
            <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
              {t('dailyDigestTitle')}
            </Typography.Title>
          </Checkbox>
        </Flex>
        <Typography.Text
          style={{ fontSize: 14, color: themeMode === 'dark' ? '#9CA3AF' : '#00000073' }}
        >
          {t('dailyDigestDescription')}
        </Typography.Text>
      </Flex>
      <Divider />
      <Flex vertical gap={4}>
        <Flex gap={8} align="center">
          <Checkbox
            disabled={isLoading}
            checked={!!notificationsSettings.popup_notifications_enabled}
            onChange={() => toggleNotificationSetting('popup_notifications_enabled')}
          >
            <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
              {t('popupTitle')}
            </Typography.Title>
          </Checkbox>
        </Flex>
        <Typography.Text
          style={{ fontSize: 14, color: themeMode === 'dark' ? '#9CA3AF' : '#00000073' }}
        >
          {t('popupDescription')}
        </Typography.Text>
      </Flex>
      <Divider />
      <Flex vertical gap={4}>
        <Flex gap={8} align="center">
          <Checkbox
            disabled={isLoading}
            checked={!!notificationsSettings.show_unread_items_count}
            onChange={() => toggleNotificationSetting('show_unread_items_count')}
          >
            <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
              {t('unreadItemsTitle')}
            </Typography.Title>
          </Checkbox>
        </Flex>
        <Typography.Text
          style={{ fontSize: 14, color: themeMode === 'dark' ? '#9CA3AF' : '#00000073' }}
        >
          {t('unreadItemsDescription')}
        </Typography.Text>
      </Flex>
    </Card>
  );
};

export default NotificationsSettings;
