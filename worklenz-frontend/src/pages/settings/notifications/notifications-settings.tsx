import React, { useEffect, useState, useCallback } from 'react';
import {
  Button,
  Card,
  Divider,
  Flex,
  Form,
  Select,
  Switch,
  TimePicker,
  Typography,
  message,
  dayjs,
} from '@/shared/antd-imports';
import type { Dayjs } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useDocumentTitle } from '@/hooks/useDoumentTItle';
import { IDigestPreferences, INotificationSettings } from '@/types/settings/notifications.types';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import logger from '@/utils/errorLogger';
import { useMixpanelTracking } from '@/hooks/useMixpanelTracking';
import { evt_settings_notifications_visit } from '@/shared/worklenz-analytics-events';

const DEFAULT_DAILY_TIME = '09:00';
const DEFAULT_WEEKLY_START_TIME = '08:00';
const DEFAULT_WEEKLY_END_TIME = '16:00';

function toTimeStr(d: Dayjs | null, fallback: string): string {
  return d ? d.format('HH:mm') : fallback;
}

function toDayjs(timeStr: string | undefined, fallback: string): Dayjs {
  return dayjs(timeStr ?? fallback, 'HH:mm');
}

interface SettingsToggleRowProps {
  title: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled: boolean;
  subTextStyle: React.CSSProperties;
  children?: React.ReactNode;
}

const SettingsToggleRow: React.FC<SettingsToggleRowProps> = ({
  title,
  description,
  checked,
  onChange,
  disabled,
  subTextStyle,
  children,
}) => (
  <Flex vertical gap={8}>
    <Flex gap={10} align="center">
      <Switch size="small" checked={checked} onChange={onChange} disabled={disabled} />
      <Typography.Title level={5} style={{ marginBlockEnd: 0 }}>
        {title}
      </Typography.Title>
    </Flex>
    <Typography.Text style={subTextStyle}>{description}</Typography.Text>
    {checked && children}
  </Flex>
);

interface DigestRowProps {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (checked: boolean) => void;
  time: Dayjs;
  onTimeChange: (value: Dayjs | null) => void;
  disabled: boolean;
  subTextStyle: React.CSSProperties;
  channelLabel: string;
  timeLabel: string;
}

const DigestRow: React.FC<DigestRowProps> = ({
  title,
  description,
  enabled,
  onToggle,
  time,
  onTimeChange,
  disabled,
  subTextStyle,
  channelLabel,
  timeLabel,
}) => (
  <SettingsToggleRow
    title={title}
    description={description}
    checked={enabled}
    onChange={onToggle}
    disabled={disabled}
    subTextStyle={subTextStyle}
  >
    <Flex gap={16} align="center" wrap="wrap" style={{ marginTop: 4 }}>
      <Flex gap={6} align="center">
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {timeLabel}
        </Typography.Text>
        <TimePicker
          value={time}
          format="HH:mm"
          minuteStep={5}
          size="small"
          allowClear={false}
          onChange={onTimeChange}
          style={{ width: 96 }}
        />
      </Flex>
      <Flex gap={6} align="center">
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
          {channelLabel}
        </Typography.Text>
        <Select
          value="email"
          size="small"
          disabled
          style={{ width: 90 }}
          options={[{ value: 'email', label: 'Email' }]}
        />
      </Flex>
    </Flex>
  </SettingsToggleRow>
);

const NotificationsSettings = () => {
  const { t } = useTranslation('settings/notifications');
  const [form] = Form.useForm();
  const themeMode = useAppSelector(state => state.themeReducer.mode);
  const { trackMixpanelEvent } = useMixpanelTracking();

  const [notificationsSettings, setNotificationsSettings] = useState<INotificationSettings>({});
  const [digestPrefs, setDigestPrefs] = useState<IDigestPreferences>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isDigestLoading, setIsDigestLoading] = useState(false);
  const [isSavingDigest, setIsSavingDigest] = useState(false);

  const [dailyTime, setDailyTime] = useState<Dayjs>(toDayjs(DEFAULT_DAILY_TIME, DEFAULT_DAILY_TIME));
  const [weeklyStartTime, setWeeklyStartTime] = useState<Dayjs>(
    toDayjs(DEFAULT_WEEKLY_START_TIME, DEFAULT_WEEKLY_START_TIME)
  );
  const [weeklyEndTime, setWeeklyEndTime] = useState<Dayjs>(
    toDayjs(DEFAULT_WEEKLY_END_TIME, DEFAULT_WEEKLY_END_TIME)
  );

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

  const fetchDigestPreferences = useCallback(async () => {
    try {
      setIsDigestLoading(true);
      const res = await profileSettingsApiService.getDigestPreferences();
      if (res.done && res.body) {
        setDigestPrefs(res.body);
        setDailyTime(toDayjs(res.body.daily_send_time, DEFAULT_DAILY_TIME));
        setWeeklyStartTime(toDayjs(res.body.weekly_start_send_time, DEFAULT_WEEKLY_START_TIME));
        setWeeklyEndTime(toDayjs(res.body.weekly_end_send_time, DEFAULT_WEEKLY_END_TIME));
      }
    } catch (error) {
      logger.error('Error fetching digest preferences', error);
    } finally {
      setIsDigestLoading(false);
    }
  }, []);

  const updateNotificationSettings = useCallback(
    async (settings: INotificationSettings) => {
      try {
        const res = await profileSettingsApiService.updateNotificationSettings(settings);
        if (res.done) {
          setNotificationsSettings(prev => res.body || prev);
          return true;
        }
        return false;
      } catch (error) {
        logger.error('Error updating notifications settings', error);
        await fetchNotificationsSettings();
        return false;
      }
    },
    [fetchNotificationsSettings]
  );

  const toggleNotificationSetting = useCallback(
    async (key: keyof INotificationSettings) => {
      setNotificationsSettings(prev => {
        const newValue = !prev[key];
        const newSettings = { ...prev, [key]: newValue };
        updateNotificationSettings(newSettings);
        return newSettings;
      });

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

  const handleSaveDigestPreferences = useCallback(async () => {
    try {
      setIsSavingDigest(true);
      const payload: IDigestPreferences = {
        ...digestPrefs,
        daily_send_time: toTimeStr(dailyTime, DEFAULT_DAILY_TIME),
        weekly_start_send_time: toTimeStr(weeklyStartTime, DEFAULT_WEEKLY_START_TIME),
        weekly_end_send_time: toTimeStr(weeklyEndTime, DEFAULT_WEEKLY_END_TIME),
      };
      const res = await profileSettingsApiService.updateDigestPreferences(payload);
      if (res.done) {
        setDigestPrefs(res.body ?? payload);
        message.success(
          t('digestPreferencesSaved', { defaultValue: 'Your notification preferences have been saved' })
        );
      }
    } catch (error) {
      logger.error('Error saving digest preferences', error);
    } finally {
      setIsSavingDigest(false);
    }
  }, [digestPrefs, dailyTime, weeklyStartTime, weeklyEndTime, t]);

  useEffect(() => {
    trackMixpanelEvent(evt_settings_notifications_visit);
    fetchNotificationsSettings();
    fetchDigestPreferences();
  }, [trackMixpanelEvent, fetchNotificationsSettings, fetchDigestPreferences]);

  const subTextStyle: React.CSSProperties = {
    fontSize: 14,
    color: themeMode === 'dark' ? '#9CA3AF' : '#00000073',
  };

  return (
    <Flex vertical gap={24}>
      <Card
        style={{ width: '100%' }}
        title={
          <Flex vertical gap={4} style={{ padding: '4px 0' }}>
            <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
              {t('generalSectionTitle', { defaultValue: 'General Notifications' })}
            </Typography.Title>
            <Typography.Text style={{ ...subTextStyle, fontWeight: 400 }}>
              {t('generalSectionDescription', {
                defaultValue: 'Applies immediately when toggled — no separate save needed.',
              })}
            </Typography.Text>
          </Flex>
        }
      >
        <SettingsToggleRow
          title={t('emailTitle')}
          description={t('emailDescription')}
          checked={!!notificationsSettings.email_notifications_enabled}
          onChange={() => toggleNotificationSetting('email_notifications_enabled')}
          disabled={isLoading}
          subTextStyle={subTextStyle}
        />
        <Divider style={{ marginBlock: 12 }} />
        <SettingsToggleRow
          title={t('dailyDigestTitle')}
          description={t('dailyDigestDescription')}
          checked={!!notificationsSettings.daily_digest_enabled}
          onChange={() => toggleNotificationSetting('daily_digest_enabled')}
          disabled={isLoading}
          subTextStyle={subTextStyle}
        />
        <Divider style={{ marginBlock: 12 }} />
        <SettingsToggleRow
          title={t('popupTitle')}
          description={t('popupDescription')}
          checked={!!notificationsSettings.popup_notifications_enabled}
          onChange={() => toggleNotificationSetting('popup_notifications_enabled')}
          disabled={isLoading}
          subTextStyle={subTextStyle}
        />
        <Divider style={{ marginBlock: 12 }} />
        <SettingsToggleRow
          title={t('unreadItemsTitle')}
          description={t('unreadItemsDescription')}
          checked={!!notificationsSettings.show_unread_items_count}
          onChange={() => toggleNotificationSetting('show_unread_items_count')}
          disabled={isLoading}
          subTextStyle={subTextStyle}
        />
      </Card>

      <Card
        style={{ width: '100%' }}
        title={
          <Flex vertical gap={4} style={{ padding: '4px 0' }}>
            <Typography.Title level={4} style={{ marginBlockEnd: 0 }}>
              {t('taskDigestSectionTitle', { defaultValue: 'Scheduled Task Digest Emails' })}
            </Typography.Title>
            <Typography.Text style={{ ...subTextStyle, fontWeight: 400 }}>
              {t('taskDigestSectionDescription', {
                defaultValue:
                  'Receive a personalised task summary email on your schedule. Admin and PM sections appear automatically based on your role.',
              })}
            </Typography.Text>
          </Flex>
        }
      >
        <DigestRow
          title={t('dailyReminderTitle', { defaultValue: 'Daily Task Reminder' })}
          description={t('dailyReminderDescription', {
            defaultValue:
              'Sent every day at your chosen time. Includes tasks due today, tomorrow, and overdue.',
          })}
          enabled={!!digestPrefs.daily_enabled}
          onToggle={checked => setDigestPrefs(p => ({ ...p, daily_enabled: checked }))}
          time={dailyTime}
          onTimeChange={v => v && setDailyTime(v)}
          disabled={isDigestLoading}
          subTextStyle={subTextStyle}
          channelLabel={t('channelLabel', { defaultValue: 'Channel' })}
          timeLabel={t('timeLabel', { defaultValue: 'Send at' })}
        />

        <Divider style={{ marginBlock: 12 }} />

        <DigestRow
          title={t('weeklyStartTitle', { defaultValue: 'Weekly Start Summary' })}
          description={t('weeklyStartDescription', {
            defaultValue:
              'Sent every Monday. Covers your full week ahead with tasks due this week and overdue.',
          })}
          enabled={!!digestPrefs.weekly_start_enabled}
          onToggle={checked => setDigestPrefs(p => ({ ...p, weekly_start_enabled: checked }))}
          time={weeklyStartTime}
          onTimeChange={v => v && setWeeklyStartTime(v)}
          disabled={isDigestLoading}
          subTextStyle={subTextStyle}
          channelLabel={t('channelLabel', { defaultValue: 'Channel' })}
          timeLabel={t('timeLabel', { defaultValue: 'Send at' })}
        />

        <Divider style={{ marginBlock: 12 }} />

        <DigestRow
          title={t('weeklyEndTitle', { defaultValue: 'Weekly End Summary' })}
          description={t('weeklyEndDescription', {
            defaultValue:
              'Sent every Friday. A wrap-up of completed tasks, overdue, and a look at next week.',
          })}
          enabled={!!digestPrefs.weekly_end_enabled}
          onToggle={checked => setDigestPrefs(p => ({ ...p, weekly_end_enabled: checked }))}
          time={weeklyEndTime}
          onTimeChange={v => v && setWeeklyEndTime(v)}
          disabled={isDigestLoading}
          subTextStyle={subTextStyle}
          channelLabel={t('channelLabel', { defaultValue: 'Channel' })}
          timeLabel={t('timeLabel', { defaultValue: 'Send at' })}
        />

        <Flex justify="flex-end" style={{ marginTop: 20 }}>
          <Button type="primary" loading={isSavingDigest} onClick={handleSaveDigestPreferences}>
            {t('saveDigestPreferences', { defaultValue: 'Save Notification Preferences' })}
          </Button>
        </Flex>
      </Card>
    </Flex>
  );
};

export default NotificationsSettings;
