import React from 'react';
import { useTranslation } from 'react-i18next';
import { Descriptions, Flex, Modal, Typography, theme } from '@/shared/antd-imports';
import { PortalAvatar, RoleTag, UserStatusTag, formatPortalDateTime } from '@/components/client-portal/v2';
import type { ClientRole, ClientUser } from '@/types/client-portal/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface ClientUserProfileModalProps {
  user: ClientUser | null;
  onClose: () => void;
}

const ROLE_DESCRIPTIONS: Record<ClientRole, { key: string; defaultValue: string }> = {
  admin: {
    key: 'roleAdminDescription',
    defaultValue:
      'Views assigned projects, comments, uploads permitted files, submits change requests, approves items and can manage client users if enabled.',
  },
  member: {
    key: 'roleMemberDescription',
    defaultValue:
      'Views assigned projects, comments, uploads permitted files and submits change requests. Cannot approve or manage users.',
  },
  viewer: {
    key: 'roleViewerDescription',
    defaultValue:
      'Read-only: project information, milestones, client-visible tasks and files. Cannot comment, upload, approve or submit change requests.',
  },
};

export const ClientUserProfileModal = ({ user, onClose }: ClientUserProfileModalProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const { t: tShared } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  if (!user) return null;

  const dash = '—';
  const roleCopy = ROLE_DESCRIPTIONS[user.role];

  return (
    <Modal
      open
      title={t('profile.title', { defaultValue: 'Client user' })}
      footer={null}
      onCancel={onClose}
      width={540}
      destroyOnHidden
    >
      <Flex align="center" gap={14} style={{ marginBottom: 16 }}>
        <PortalAvatar name={user.name} size={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{user.name}</div>
          <div style={{ fontSize: 12.5, color: token.colorTextSecondary, marginTop: 2 }}>
            {user.job_title || t('profile.noJobTitle', { defaultValue: 'No job title on file' })} ·{' '}
            {user.organization_name}
          </div>
          <Flex gap={6} wrap style={{ marginTop: 6 }}>
            <RoleTag role={user.role} />
            <UserStatusTag user={user} />
          </Flex>
        </div>
      </Flex>

      <Descriptions size="small" column={1} bordered style={{ marginBottom: 12 }}>
        <Descriptions.Item label={t('fields.email', { defaultValue: 'Email (login address)' })}>
          {user.email}
        </Descriptions.Item>
        <Descriptions.Item label={t('profile.phone', { defaultValue: 'Phone' })}>
          {user.phone || dash}
        </Descriptions.Item>
        <Descriptions.Item label={t('profile.lastAccess', { defaultValue: 'Last access' })}>
          {formatPortalDateTime(user.last_access_at, i18n.language) ??
            t('profile.neverAccessed', { defaultValue: 'Never' })}
        </Descriptions.Item>
      </Descriptions>

      <Typography.Paragraph type="secondary" style={{ fontSize: 12 }}>
        {tShared(roleCopy.key, { defaultValue: roleCopy.defaultValue })}
      </Typography.Paragraph>

      <Typography.Text strong style={{ display: 'block', marginBottom: 8 }}>
        {t('profile.assignedProjects', {
          count: user.projects.length,
          defaultValue: 'Assigned projects ({{count}})',
        })}
      </Typography.Text>
      {user.projects.length === 0 ? (
        <Typography.Text type="secondary">
          {t('profile.noProjects', {
            defaultValue: 'No projects assigned yet. This user signs in to an empty portal.',
          })}
        </Typography.Text>
      ) : (
        user.projects.map(project => (
          <div
            key={project.id}
            style={{
              padding: '9px 12px',
              marginBottom: 6,
              border: `1px solid ${token.colorBorderSecondary}`,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {decodeHtmlEntities(project.name)}
          </div>
        ))
      )}
    </Modal>
  );
};
