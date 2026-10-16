import React from 'react';
import { useTranslation } from 'react-i18next';
import { FileDoneOutlined, AccountBookOutlined, UserAddOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Typography, theme } from '@/shared/antd-imports';
import type { ClientOrganization } from '@/types/client-portal/v2';
import type { WorkspaceTab } from './workspace-helpers';

interface WorkspaceRailProps {
  organization: ClientOrganization;
  onInviteUser: () => void;
  onRequestApproval: () => void;
  onOpenTab: (tab: WorkspaceTab) => void;
}

const formatOutstanding = (outstanding: ClientOrganization['outstanding'], locale?: string): string[] =>
  outstanding.map(entry => {
    try {
      return new Intl.NumberFormat(locale, { style: 'currency', currency: entry.currency }).format(entry.amount);
    } catch {
      // An unknown currency code should still show the number.
      return `${entry.currency} ${entry.amount.toFixed(2)}`;
    }
  });

const Row = ({ label, children }: { label: string; children: React.ReactNode }) => {
  const { token } = theme.useToken();
  return (
    <Flex justify="space-between" gap={8} style={{ fontSize: 12.5, padding: '5px 0' }}>
      <span style={{ color: token.colorTextSecondary }}>{label}</span>
      <span style={{ fontWeight: 600, textAlign: 'right', minWidth: 0, wordBreak: 'break-word' }}>{children}</span>
    </Flex>
  );
};

/** The organization at a glance, its portal-user counts, and the actions staff reach for most. */
export const WorkspaceRail = ({ organization, onInviteUser, onRequestApproval, onOpenTab }: WorkspaceRailProps) => {
  const { t, i18n } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();
  const owed = formatOutstanding(organization.outstanding, i18n.language);

  return (
    <Flex vertical gap={12}>
      <Card size="small" title={t('workspace.rail.organization', { defaultValue: 'Organization' })}>
        <Row label={t('workspace.rail.primaryContact', { defaultValue: 'Primary contact' })}>
          {organization.primary_contact_name ?? '—'}
        </Row>
        <Row label={t('workspace.rail.email', { defaultValue: 'Email' })}>
          {organization.primary_contact_email ?? '—'}
        </Row>
        <Row label={t('workspace.rail.portalProjects', { defaultValue: 'Portal projects' })}>
          {organization.portal_projects}
        </Row>
        <Row label={t('workspace.rail.balance', { defaultValue: 'Balance' })}>
          {owed.length > 0 ? owed.map(amount => <div key={amount}>{amount}</div>) : '—'}
        </Row>
      </Card>

      <Card size="small" title={t('workspace.rail.portalAccess', { defaultValue: 'Portal access' })}>
        <Row label={t('workspace.rail.active', { defaultValue: 'Active' })}>
          <span style={{ color: token.colorSuccess }}>{organization.active_users}</span>
        </Row>
        <Row label={t('workspace.rail.invited', { defaultValue: 'Invited' })}>
          <span style={{ color: token.colorWarning }}>{organization.invited_users}</span>
        </Row>
        <Row label={t('workspace.rail.deactivated', { defaultValue: 'Deactivated' })}>
          {organization.deactivated_users}
        </Row>
      </Card>

      <Card size="small" title={t('workspace.rail.quickActions', { defaultValue: 'Quick actions' })}>
        <Flex vertical align="stretch" gap={4}>
          <Button type="text" icon={<UserAddOutlined />} onClick={onInviteUser} style={{ justifyContent: 'flex-start' }}>
            {t('workspace.rail.inviteUser', { defaultValue: 'Invite a user' })}
          </Button>
          <Button type="text" icon={<FileDoneOutlined />} onClick={onRequestApproval} style={{ justifyContent: 'flex-start' }}>
            {t('workspace.rail.requestApproval', { defaultValue: 'Request approval' })}
          </Button>
          <Button type="text" icon={<AccountBookOutlined />} onClick={() => onOpenTab('billing')} style={{ justifyContent: 'flex-start' }}>
            {t('workspace.rail.billing', { defaultValue: 'Billing' })}
          </Button>
        </Flex>
      </Card>
      <Typography.Text type="secondary" style={{ fontSize: 11.5 }}>
        {t('workspace.rail.hint', {
          defaultValue: 'A client user sees only the projects assigned to them.',
        })}
      </Typography.Text>
    </Flex>
  );
};
