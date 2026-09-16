import { Alert, Button, Flex, Popconfirm, Select, Typography } from 'antd';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { profileSettingsApiService } from '@/api/settings/profile/profile-settings.api.service';
import { IGoogleCalendarSyncResult } from '@/types/settings/profile.types';
import logger from '@/utils/errorLogger';

export const GoogleCalendarIntegration = () => {
  const { t } = useTranslation('settings/integrations');
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
  const [projectId, setProjectId] = useState<string>();
  const [result, setResult] = useState<IGoogleCalendarSyncResult>();

  useEffect(() => {
    profileSettingsApiService
      .getGoogleCalendarStatus()
      .then((response) => {
        if (response.done) {
          setConnected(response.body.connected);
          setProjects(response.body.projects);
          setProjectId(response.body.projects[0]?.id);
        }
      })
      .catch((error) => logger.error('Error loading Google Calendar status', error));
  }, []);

  const connect = async () => {
    setLoading(true);
    try {
      const response = await profileSettingsApiService.getGoogleCalendarConnectUrl();
      if (!response.done || !response.body?.url) throw new Error('Google Calendar connection URL was not returned');
      window.location.assign(response.body.url);
    } catch (error) {
      logger.error('Error connecting Google Calendar', error);
      setLoading(false);
    }
  };

  const sync = async () => {
    setSyncing(true);
    try {
      const response = await profileSettingsApiService.syncGoogleCalendar(projectId);
      if (!response.done) throw new Error('Google Calendar sync failed');
      setResult(response.body);
    } catch (error) {
      logger.error('Error syncing Google Calendar', error);
    } finally {
      setSyncing(false);
    }
  };

  const disconnect = async () => {
    setLoading(true);
    try {
      const response = await profileSettingsApiService.disconnectGoogleCalendar();
      if (!response.done) throw new Error('Google Calendar disconnect failed');
      setConnected(false);
      setResult(undefined);
    } catch (error) {
      logger.error('Error disconnecting Google Calendar', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Flex vertical gap={12}>
      <Typography.Text type="secondary">
        {t('googleCalendar.description', {
          defaultValue: 'Import calendar meetings as Worklenz tasks and publish task due dates to your calendar.',
        })}
      </Typography.Text>
      {connected ? (
        <>
          <Alert
            type="success"
            showIcon
            message={t('googleCalendar.connected', { defaultValue: 'Google Calendar is connected' })}
          />
          <Flex gap={8} wrap="wrap">
            <Select
              value={projectId}
              onChange={setProjectId}
              options={projects.map((project) => ({ value: project.id, label: project.name }))}
              placeholder={t('googleCalendar.projectPlaceholder', { defaultValue: 'Import meetings into project' })}
              style={{ minWidth: 220 }}
              aria-label={t('googleCalendar.projectLabel', { defaultValue: 'Calendar import project' })}
            />
            <Button type="primary" onClick={sync} loading={syncing}>
              {t('googleCalendar.sync', { defaultValue: 'Sync calendar' })}
            </Button>
            <Popconfirm
              title={t('googleCalendar.disconnectConfirm', { defaultValue: 'Disconnect Google Calendar?' })}
              onConfirm={disconnect}
              okText={t('disconnect', { defaultValue: 'Disconnect' })}
              cancelText={t('cancel', { defaultValue: 'Cancel' })}
            >
              <Button danger loading={loading}>
                {t('googleCalendar.disconnect', { defaultValue: 'Disconnect' })}
              </Button>
            </Popconfirm>
          </Flex>
          {result && (
            <Typography.Text type="secondary">
              {t('googleCalendar.syncResult', {
                imported: result.imported,
                updated: result.updated,
                removed: result.removed,
                pushed: result.pushed,
                defaultValue:
                  'Imported {{imported}}, updated {{updated}} and removed {{removed}} meetings, and published {{pushed}} task due dates.',
              })}
            </Typography.Text>
          )}
        </>
      ) : (
        <Button type="primary" onClick={connect} loading={loading}>
          {t('googleCalendar.connect', { defaultValue: 'Connect Google Calendar' })}
        </Button>
      )}
    </Flex>
  );
};
