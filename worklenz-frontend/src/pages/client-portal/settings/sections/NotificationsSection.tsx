import React from 'react';
import { useTranslation } from 'react-i18next';
import { IClientPortalSettings } from '@/types/settings/client-portal-settings.types';
import { SectionCard } from './SectionCard';
import { SettingsToggleRow } from './SettingsToggleRow';

interface NotificationsSectionProps {
  settings: IClientPortalSettings;
  onChange: (patch: Partial<IClientPortalSettings>) => void;
}

const ROWS: {
  field: keyof IClientPortalSettings;
  labelKey: string;
  labelDefault: string;
  descKey: string;
  descDefault: string;
}[] = [
  {
    field: 'notify_new_message',
    labelKey: 'notifications.newMessage.label',
    labelDefault: 'New message',
    descKey: 'notifications.newMessage.description',
    descDefault: 'Notify the team when a client sends a new message.',
  },
  {
    field: 'notify_task_status_change',
    labelKey: 'notifications.taskStatusChange.label',
    labelDefault: 'Task status change',
    descKey: 'notifications.taskStatusChange.description',
    descDefault: 'Notify the team when a client-visible task changes status.',
  },
  {
    field: 'notify_file_uploaded',
    labelKey: 'notifications.fileUploaded.label',
    labelDefault: 'File uploaded',
    descKey: 'notifications.fileUploaded.description',
    descDefault: 'Notify the team when a client uploads a file.',
  },
];

/** Preferences are saved now; the events themselves (chat messages, task status changes, file
 * uploads) don't send any notification yet on either side of the app — wiring actual sends is
 * a separate, larger piece of work. */
export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ settings, onChange }) => {
  const { t } = useTranslation('client-portal-settings');

  return (
    <SectionCard
      title={t('notificationsTitle', { defaultValue: 'Notifications' })}
      description={t('notificationsDescription', {
        defaultValue: 'Choose what your team is notified about from client activity.',
      })}
    >
      {ROWS.map((row, index) => (
        <SettingsToggleRow
          key={row.field}
          label={t(row.labelKey, { defaultValue: row.labelDefault })}
          description={t(row.descKey, { defaultValue: row.descDefault })}
          checked={Boolean(settings[row.field])}
          onChange={checked => onChange({ [row.field]: checked } as Partial<IClientPortalSettings>)}
          isLast={index === ROWS.length - 1}
        />
      ))}
    </SectionCard>
  );
};

export default NotificationsSection;
