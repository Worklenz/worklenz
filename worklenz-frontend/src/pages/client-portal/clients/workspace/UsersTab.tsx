import React from 'react';
import { useTranslation } from 'react-i18next';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Flex, Typography } from '@/shared/antd-imports';
import { ClientUsersPanel } from '../users/ClientUsersPanel';

interface UsersTabProps {
  organizationId: string;
  organizationName: string;
  onInviteUser: () => void;
}

/** The people at this organization who can sign in, each seeing only the projects assigned to them. */
export const UsersTab = ({ organizationId, organizationName, onInviteUser }: UsersTabProps) => {
  const { t } = useTranslation('client-portal-v2-clients');

  return (
    <div>
      <Flex justify="space-between" align="center" wrap="wrap" gap={12} style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ fontSize: 12.5 }}>
          {t('workspace.users.description', {
            name: organizationName,
            defaultValue:
              'People at {{name}} who can sign in. Each sees only the projects assigned to them.',
          })}
        </Typography.Text>
        <Button type="primary" size="small" icon={<PlusOutlined />} onClick={onInviteUser}>
          {t('workspace.users.invite', { defaultValue: 'Invite user' })}
        </Button>
      </Flex>
      <ClientUsersPanel organizationId={organizationId} />
    </div>
  );
};
