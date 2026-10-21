import React from 'react';
import { useTranslation } from 'react-i18next';
import { Flex, theme } from '@/shared/antd-imports';
import { OrganizationAccessTag, PortalAvatar } from '@/components/client-portal/v2';
import type { ClientOrganization } from '@/types/client-portal/v2';

interface WorkspaceHeaderProps {
  organization: ClientOrganization;
}

/** Who this workspace is about, and whether anyone there can sign in. */
export const WorkspaceHeader = ({ organization }: WorkspaceHeaderProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const { token } = theme.useToken();

  return (
    <Flex align="center" gap={14} style={{ marginBottom: 20 }}>
      <PortalAvatar name={organization.name} color={organization.color} size={44} />
      <div style={{ minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 17 }}>{organization.name}</div>
        <Flex align="center" gap={8} wrap="wrap" style={{ fontSize: 12, color: token.colorTextSecondary }}>
          <OrganizationAccessTag access={organization.portal_access} />
          <span>
            {t('organizations.usersSummary', {
              active: organization.active_users,
              total: organization.total_users,
              defaultValue: '{{active}} active · {{total}} total',
            })}
          </span>
        </Flex>
      </div>
    </Flex>
  );
};
