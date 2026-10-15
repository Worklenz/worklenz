import React from 'react';
import { useTranslation } from 'react-i18next';
import { CheckOutlined, CheckCircleOutlined, MailOutlined, MinusOutlined } from '@ant-design/icons';
import { Alert, Button, theme } from '@/shared/antd-imports';
import { useGetClientRolesQuery } from '@/api/client-portal/portal-counts-api';
import type { ClientCapability, PortalSettingsV2 } from '@/types/client-portal/v2';
import { SectionCard } from './SectionCard';
import { SettingsToggleRow } from './SettingsToggleRow';
import { PortalLoader } from '@/components/client-portal/v2';

interface ClientRolesSectionProps {
  settings: PortalSettingsV2;
  onChange: (patch: Partial<PortalSettingsV2>) => void;
}

const CAPABILITY_ROWS: { capability: ClientCapability; key: string; defaultValue: string }[] = [
  {
    capability: 'view',
    key: 'roles.capability.view',
    defaultValue: 'View assigned projects, milestones, client-visible tasks and files',
  },
  {
    capability: 'comment',
    key: 'roles.capability.comment',
    defaultValue: 'Comment and reply in client-visible discussions',
  },
  {
    capability: 'upload',
    key: 'roles.capability.upload',
    defaultValue: 'Upload files (where the project allows it)',
  },
  {
    capability: 'submit_change_request',
    key: 'roles.capability.submitChangeRequest',
    defaultValue: 'Submit and follow change requests',
  },
  {
    capability: 'approve',
    key: 'roles.capability.approve',
    defaultValue: 'Approve items or request changes',
  },
  {
    capability: 'manage_users',
    key: 'roles.capability.manageUsers',
    defaultValue: 'Manage users in their own organization (if enabled below)',
  },
];

const SIGN_IN_FACTS: { key: string; defaultValue: string }[] = [
  {
    key: 'roles.signIn.code',
    defaultValue:
      'There are no passwords. A client signs in with a 6-digit code sent to their email address. It works once and expires after 10 minutes.',
  },
  {
    key: 'roles.signIn.addedOnly',
    defaultValue:
      'Only an address that you, or a Client Admin you allow, has added can receive a code. Anyone else gets nothing.',
  },
  {
    key: 'roles.signIn.link',
    defaultValue:
      'An invitation email carries a sign-in link with the address built in. Opening it sends the code straight away. Links expire after 7 days and can be resent from Users.',
  },
  {
    key: 'roles.signIn.direct',
    defaultValue:
      'Clients can also open the portal, type their address and receive a code, without the link.',
  },
];

const ALWAYS_TRUE: { key: string; defaultValue: string }[] = [
  {
    key: 'roles.alwaysTrue.oneOrganization',
    defaultValue:
      'A client user belongs to exactly one organization and sees only the projects assigned to them.',
  },
  {
    key: 'roles.alwaysTrue.ownOrganizationOnly',
    defaultValue:
      "A Client Admin can only see and manage users in their own organization, never another client's.",
  },
  {
    key: 'roles.alwaysTrue.noTeamDirectory',
    defaultValue:
      'A client user never sees your internal team directory and can never become an admin of your workspace.',
  },
  {
    key: 'roles.alwaysTrue.nextRequest',
    defaultValue:
      'Deactivating a user, or removing a project assignment, takes effect on their next request, not at their next sign-in.',
  },
];

export const ClientRolesSection: React.FC<ClientRolesSectionProps> = ({ settings, onChange }) => {
  const { t } = useTranslation('client-portal-v2-settings');
  const { token } = theme.useToken();
  const { data, isLoading, isError, refetch, isFetching } = useGetClientRolesQuery();
  const roles = data?.body ?? [];

  const renderMatrix = () => {
    if (isLoading) return <PortalLoader />;

    if (isError || roles.length === 0) {
      return (
        <Alert
          type="error"
          showIcon
          message={t('roles.matrixError', { defaultValue: 'The role permissions could not be loaded.' })}
          action={
            <Button size="small" onClick={() => refetch()} loading={isFetching}>
              {t('retry', { defaultValue: 'Retry' })}
            </Button>
          }
        />
      );
    }

    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr>
              <th
                scope="col"
                style={{
                  textAlign: 'left',
                  padding: '8px 12px 8px 0',
                  fontWeight: 600,
                  borderBottom: `1px solid ${token.colorBorderSecondary}`,
                }}
              >
                {t('roles.capabilityColumn', { defaultValue: 'Capability' })}
              </th>
              {roles.map(role => (
                <th
                  key={role.role}
                  scope="col"
                  title={role.description}
                  style={{
                    textAlign: 'center',
                    padding: '8px 12px',
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  {role.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CAPABILITY_ROWS.map(row => (
              <tr key={row.capability}>
                <td
                  style={{
                    padding: '10px 12px 10px 0',
                    borderBottom: `1px solid ${token.colorBorderSecondary}`,
                  }}
                >
                  {t(row.key, { defaultValue: row.defaultValue })}
                </td>
                {roles.map(role => {
                  const allowed = role.can[row.capability] === true;
                  return (
                    <td
                      key={role.role}
                      style={{
                        textAlign: 'center',
                        padding: '10px 12px',
                        borderBottom: `1px solid ${token.colorBorderSecondary}`,
                        color: allowed ? token.colorSuccess : token.colorTextTertiary,
                      }}
                    >
                      {allowed ? (
                        <CheckOutlined
                          aria-label={t('roles.allowed', { defaultValue: 'Allowed' })}
                        />
                      ) : (
                        <MinusOutlined
                          aria-label={t('roles.notAllowed', { defaultValue: 'Not allowed' })}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard
        title={t('roles.matrixTitle', { defaultValue: 'What each role can do' })}
        description={t('roles.matrixDescription', {
          defaultValue:
            'Three roles, no permission builder. A role applies to every project the user is assigned to.',
        })}
      >
        {renderMatrix()}
      </SectionCard>

      <SectionCard
        title={t('roles.selfManagement.title', { defaultValue: 'Client Admin self-management' })}
        description={t('roles.selfManagement.description', {
          defaultValue:
            'Let a Client Admin manage who from their own organization has portal access, instead of routing every change through your team.',
        })}
      >
        <SettingsToggleRow
          label={t('roles.selfManagement.invite.label', { defaultValue: 'Let Client Admins invite users' })}
          description={t('roles.selfManagement.invite.description', {
            defaultValue: 'A Client Admin can invite a colleague from their own organization.',
          })}
          checked={settings.admins_can_invite_users}
          onChange={checked => onChange({ admins_can_invite_users: checked })}
        />
        <SettingsToggleRow
          label={t('roles.selfManagement.remove.label', { defaultValue: 'Let Client Admins remove users' })}
          description={t('roles.selfManagement.remove.description', {
            defaultValue: 'A Client Admin can remove another user from their own organization.',
          })}
          checked={settings.admins_can_remove_users}
          onChange={checked => onChange({ admins_can_remove_users: checked })}
          isLast
        />
      </SectionCard>

      <SectionCard
        title={t('roles.signIn.title', { defaultValue: 'How clients sign in' })}
        description={t('roles.signIn.description', {
          defaultValue: 'Nothing to configure. Every client signs in the same way.',
        })}
      >
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {SIGN_IN_FACTS.map((fact, index) => (
            <li
              key={fact.key}
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 0',
                fontSize: 12.5,
                borderBottom:
                  index === SIGN_IN_FACTS.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <MailOutlined style={{ color: token.colorTextTertiary, marginTop: 3 }} aria-hidden />
              <span style={{ color: token.colorTextSecondary }}>
                {t(fact.key, { defaultValue: fact.defaultValue })}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>

      <SectionCard title={t('roles.alwaysTrue.title', { defaultValue: 'Always true' })}>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {ALWAYS_TRUE.map((rule, index) => (
            <li
              key={rule.key}
              style={{
                display: 'flex',
                gap: 8,
                padding: '8px 0',
                fontSize: 12.5,
                borderBottom:
                  index === ALWAYS_TRUE.length - 1 ? 'none' : `1px solid ${token.colorBorderSecondary}`,
              }}
            >
              <CheckCircleOutlined style={{ color: token.colorTextTertiary, marginTop: 3 }} aria-hidden />
              <span style={{ color: token.colorTextSecondary }}>
                {t(rule.key, { defaultValue: rule.defaultValue })}
              </span>
            </li>
          ))}
        </ul>
      </SectionCard>
    </div>
  );
};

export default ClientRolesSection;
