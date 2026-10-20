import React from 'react';
import { useTranslation } from 'react-i18next';
import { SafetyCertificateOutlined } from '@ant-design/icons';
import { Alert, Switch, theme } from '@/shared/antd-imports';
import type {
  ClientNotificationEvent,
  PortalSettingsV2,
  TeamNotificationEvent,
} from '@/types/client-portal/v2';
import { SectionCard } from './SectionCard';

interface NotificationsSectionProps {
  settings: PortalSettingsV2;
  onChange: (patch: Partial<PortalSettingsV2>) => void;
}

interface EventRow<E extends string> {
  event: E;
  key: string;
  labelDefault: string;
  descriptionDefault: string;
}

const CLIENT_EVENTS: EventRow<ClientNotificationEvent>[] = [
  {
    event: 'approval_request',
    key: 'notifications.client.approvalRequest',
    labelDefault: 'New approval request',
    descriptionDefault: 'A client approver is asked to approve an item.',
  },
  {
    event: 'comment_or_reply',
    key: 'notifications.client.commentOrReply',
    labelDefault: 'Comment or reply',
    descriptionDefault: 'Someone replies in a client-visible discussion.',
  },
  {
    event: 'file_shared',
    key: 'notifications.client.fileShared',
    labelDefault: 'File shared',
    descriptionDefault: 'A file is marked Client Visible or a new version is uploaded.',
  },
  {
    event: 'milestone_change',
    key: 'notifications.client.milestoneChange',
    labelDefault: 'Milestone change',
    descriptionDefault: 'A client-visible milestone changes status or date.',
  },
  {
    event: 'project_update',
    key: 'notifications.client.projectUpdate',
    labelDefault: 'Project update',
    descriptionDefault: 'Project status changes or an update is published.',
  },
  {
    event: 'change_request_update',
    key: 'notifications.client.changeRequestUpdate',
    labelDefault: 'Change request update',
    descriptionDefault: 'Status, response or estimate changes on a request.',
  },
  {
    event: 'access_changes',
    key: 'notifications.client.accessChanges',
    labelDefault: 'Access changes',
    descriptionDefault: 'Invitation, role change or project assignment.',
  },
];

const TEAM_EVENTS: EventRow<TeamNotificationEvent>[] = [
  {
    event: 'client_comment',
    key: 'notifications.team.clientComment',
    labelDefault: 'New client comment',
    descriptionDefault: 'A client comments in a discussion.',
  },
  {
    event: 'approval_decision',
    key: 'notifications.team.approvalDecision',
    labelDefault: 'Client approval decision',
    descriptionDefault: 'A client approves or requests changes.',
  },
  {
    event: 'change_request',
    key: 'notifications.team.changeRequest',
    labelDefault: 'New change request or follow-up',
    descriptionDefault: 'A client submits a request or replies to a question.',
  },
  {
    event: 'client_file_upload',
    key: 'notifications.team.clientFileUpload',
    labelDefault: 'Client file upload',
    descriptionDefault: 'A client uploads a file to a project.',
  },
];

interface EventTableProps<E extends string> {
  title: string;
  rows: EventRow<E>[];
  values: Record<E, boolean>;
  onToggle: (event: E, enabled: boolean) => void;
}

const EventTable = <E extends string>({ title, rows, values, onToggle }: EventTableProps<E>) => {
  const { t } = useTranslation('client-portal-v2-settings');
  const { token } = theme.useToken();

  const headerCell: React.CSSProperties = {
    padding: '8px 12px',
    fontWeight: 600,
    textAlign: 'center',
    width: 90,
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  };
  const bodyCell: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'center',
    borderBottom: `1px solid ${token.colorBorderSecondary}`,
  };

  return (
    <SectionCard title={title}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th
                scope="col"
                style={{ ...headerCell, textAlign: 'left', width: 'auto', paddingLeft: 0 }}
              >
                {t('notifications.eventColumn', { defaultValue: 'Event' })}
              </th>
              <th scope="col" style={headerCell}>
                {t('notifications.inAppColumn', { defaultValue: 'In-app' })}
              </th>
              <th scope="col" style={headerCell}>
                {t('notifications.emailColumn', { defaultValue: 'Email' })}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(row => {
              const label = t(row.key, { defaultValue: row.labelDefault });
              return (
                <tr key={row.event}>
                  <td style={{ ...bodyCell, textAlign: 'left', paddingLeft: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{label}</div>
                    <div style={{ fontSize: 11.5, color: token.colorTextSecondary }}>
                      {t(`${row.key}Description`, { defaultValue: row.descriptionDefault })}
                    </div>
                  </td>
                  <td style={bodyCell}>
                    <Switch
                      checked
                      disabled
                      aria-label={t('notifications.inAppLabel', {
                        event: label,
                        defaultValue: 'In-app: {{event}} (always on)',
                      })}
                    />
                  </td>
                  <td style={bodyCell}>
                    <Switch
                      checked={values[row.event] === true}
                      onChange={checked => onToggle(row.event, checked)}
                      aria-label={t('notifications.emailLabel', {
                        event: label,
                        defaultValue: 'Email: {{event}}',
                      })}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
};

export const NotificationsSection: React.FC<NotificationsSectionProps> = ({ settings, onChange }) => {
  const { t } = useTranslation('client-portal-v2-settings');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Alert
        type="info"
        showIcon
        icon={<SafetyCertificateOutlined />}
        message={t('notifications.banner', {
          defaultValue:
            'Notifications sent to clients never contain internal-only content in the title or body. In-app alerts are always on. Email is optional per event.',
        })}
      />
      <EventTable<ClientNotificationEvent>
        title={t('notifications.client.title', { defaultValue: 'Notifications to clients' })}
        rows={CLIENT_EVENTS}
        values={settings.client_email_events}
        onToggle={(event, enabled) =>
          onChange({ client_email_events: { ...settings.client_email_events, [event]: enabled } })
        }
      />
      <EventTable<TeamNotificationEvent>
        title={t('notifications.team.title', { defaultValue: 'Notifications to your team' })}
        rows={TEAM_EVENTS}
        values={settings.team_email_events}
        onToggle={(event, enabled) =>
          onChange({ team_email_events: { ...settings.team_email_events, [event]: enabled } })
        }
      />
    </div>
  );
};

export default NotificationsSection;
