import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Typography } from '@/shared/antd-imports';
import type { OrganizationPortalAccess } from '@/types/client-portal/v2';
import { InvoicesTable } from '../../invoices/Invoices-table/invoices-table';
import type { WorkspaceTab } from './workspace-helpers';

interface BillingTabProps {
  organizationId: string;
  organizationName: string;
  portalAccess: OrganizationPortalAccess;
  onOpenTab: (tab: WorkspaceTab) => void;
}

/** This client's invoices, with an up-front warning when nobody there can sign in to see them yet. */
export const BillingTab = ({ organizationId, organizationName, portalAccess, onOpenTab }: BillingTabProps) => {
  const { t } = useTranslation('client-portal-v2-clients');
  const navigate = useNavigate();
  const nobodyCanSignIn = portalAccess !== 'active';

  return (
    <Flex vertical gap={16}>
      {/* Shown before any billing action, not after one fails. */}
      {nobodyCanSignIn && (
        <Alert
          type="warning"
          showIcon
          message={t('workspace.billing.warningTitle', {
            name: organizationName,
            defaultValue: '{{name}} can’t use their portal yet',
          })}
          description={t('workspace.billing.warningDescription', {
            defaultValue:
              'None of their users has accepted an invitation, so they can’t view or pay invoices in their portal. You can still create invoices. Invite a user first if they should see them.',
          })}
          action={
            <Button size="small" onClick={() => onOpenTab('users')}>
              {t('workspace.billing.manageUsers', { defaultValue: 'Manage users' })}
            </Button>
          }
        />
      )}

      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          {t('workspace.billing.title', { defaultValue: 'Invoices' })}
        </Typography.Title>
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/worklenz/client-portal/invoices/create?clientId=${organizationId}`)}
        >
          {t('workspace.billing.createInvoice', { defaultValue: 'Create invoice' })}
        </Button>
      </Flex>

      <InvoicesTable clientId={organizationId} embedded />
    </Flex>
  );
};
