import { FileTextOutlined } from '@ant-design/icons';
import { Alert, Button, Flex, Typography, message } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useResendClientInvitationMutation } from '@/api/client-portal/client-portal-api';
import type { WorkspacePortalStatus } from '@/api/client-portal/client-workspace-api';
import { InvoicesTable } from '../../invoices/Invoices-table/invoices-table';
import { shouldWarnAboutPortalAccess } from './workspace-helpers';

const { Title } = Typography;

interface BillingTabProps {
  clientId: string;
  clientName: string;
  portalStatus: WorkspacePortalStatus | undefined;
  /** Called after an invitation is sent from here, so the header and rail pick up the new status. */
  onInvited: () => void;
}

/** This client's invoices, with an up-front warning when they cannot yet use their portal. */
export const BillingTab = ({ clientId, clientName, portalStatus, onInvited }: BillingTabProps) => {
  const { t } = useTranslation('client-portal-client-workspace');
  const navigate = useNavigate();
  const [resendInvitation, { isLoading: isInviting }] = useResendClientInvitationMutation();

  const showWarning = shouldWarnAboutPortalAccess(portalStatus);
  const hasNeverBeenInvited = portalStatus === 'not_invited';

  const handleInvite = async () => {
    try {
      await resendInvitation({ clientId }).unwrap();
      message.success(
        t('billing.inviteSent', { name: clientName, defaultValue: 'Invitation sent to {{name}}.' })
      );
      onInvited();
    } catch (error) {
      const serverMessage = (error as { data?: { message?: string } })?.data?.message;
      message.error(
        serverMessage ||
          t('billing.inviteError', { defaultValue: 'Could not send the invitation.' })
      );
    }
  };

  return (
    <Flex vertical gap={16}>
      {/* Shown before any billing action, not after one fails. */}
      {showWarning && (
        <Alert
          type="warning"
          showIcon
          message={t('billing.warningTitle', {
            name: clientName,
            defaultValue: '{{name}} can’t use their portal yet',
          })}
          description={t('billing.warningDescription', {
            defaultValue:
              'They haven’t accepted an invitation, so they can’t view or pay invoices in their portal. You can still create invoices. Send the invitation first if they should see them.',
          })}
          action={
            <Button size="small" loading={isInviting} onClick={handleInvite}>
              {hasNeverBeenInvited
                ? t('billing.sendInvite', { defaultValue: 'Send invite' })
                : t('billing.resendInvite', { defaultValue: 'Resend invite' })}
            </Button>
          }
        />
      )}

      <Flex justify="space-between" align="center" wrap="wrap" gap={12}>
        <Title level={5} style={{ margin: 0 }}>
          {t('billing.title', { defaultValue: 'Invoices' })}
        </Title>
        <Button
          type="primary"
          icon={<FileTextOutlined />}
          onClick={() => navigate(`/worklenz/client-portal/invoices/create?clientId=${clientId}`)}
        >
          {t('billing.createInvoice', { defaultValue: 'Create invoice' })}
        </Button>
      </Flex>

      <InvoicesTable clientId={clientId} embedded />
    </Flex>
  );
};
