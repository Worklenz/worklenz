import React from 'react';
import { useTranslation } from 'react-i18next';
import { Radio, theme } from '@/shared/antd-imports';
import { CLIENT_ROLES, type ClientRole } from '@/types/client-portal/v2';

interface RoleCardsProps {
  value: ClientRole;
  onChange: (role: ClientRole) => void;
  /** Roles that cannot be chosen here, e.g. a new organization's first user is always a Client Admin. */
  disabledRoles?: readonly ClientRole[];
  disabled?: boolean;
  /** Accessible name for the group. */
  ariaLabel?: string;
}

const ROLE_COPY: Record<ClientRole, { labelKey: string; label: string; descKey: string; desc: string }> = {
  admin: {
    labelKey: 'roleAdmin',
    label: 'Client Admin',
    descKey: 'roleAdminDescription',
    desc: 'Views assigned projects, comments, uploads permitted files, submits change requests, approves items and can manage client users if enabled.',
  },
  member: {
    labelKey: 'roleMember',
    label: 'Client Member',
    descKey: 'roleMemberDescription',
    desc: 'Views assigned projects, comments, uploads permitted files and submits change requests. Cannot approve or manage users.',
  },
  viewer: {
    labelKey: 'roleViewer',
    label: 'Client Viewer',
    descKey: 'roleViewerDescription',
    desc: 'Read-only: project information, milestones, client-visible tasks and files. Cannot comment, upload, approve or submit change requests.',
  },
};

/** The three client roles as selectable cards (Add Client wizard, Edit user). */
export const RoleCards = ({ value, onChange, disabledRoles = [], disabled, ariaLabel }: RoleCardsProps) => {
  const { t } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  return (
    <Radio.Group
      value={value}
      onChange={event => onChange(event.target.value as ClientRole)}
      disabled={disabled}
      aria-label={ariaLabel ?? t('roleGroupLabel', { defaultValue: 'Client role' })}
      style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}
    >
      {CLIENT_ROLES.map(role => {
        const copy = ROLE_COPY[role];
        const selected = value === role;
        return (
          <Radio
            key={role}
            value={role}
            disabled={disabledRoles.includes(role)}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              margin: 0,
              padding: '10px 12px',
              border: `1px solid ${selected ? token.colorPrimary : token.colorBorderSecondary}`,
              borderRadius: 8,
              background: selected ? token.colorPrimaryBg : token.colorBgContainer,
            }}
          >
            <span style={{ display: 'block', fontWeight: 600, fontSize: 13 }}>
              {t(copy.labelKey, { defaultValue: copy.label })}
            </span>
            <span style={{ display: 'block', fontSize: 11.5, color: token.colorTextSecondary, marginTop: 2 }}>
              {t(copy.descKey, { defaultValue: copy.desc })}
            </span>
          </Radio>
        );
      })}
    </Radio.Group>
  );
};
