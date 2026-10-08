import { Button, Modal, Typography, theme } from '@/shared/antd-imports';
import { CopyOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface ClientInvitationLinkModalProps {
  open: boolean;
  link: string;
  onClose: () => void;
  onCopy: () => void;
}

export const ClientInvitationLinkModal = ({
  open,
  link,
  onClose,
  onCopy,
}: ClientInvitationLinkModalProps) => {
  const { t } = useTranslation('client-portal-clients');
  const { token } = theme.useToken();

  return (
    <Modal
      title={t('invitationModalTitle', { defaultValue: 'Invitation Link Generated' })}
      open={open}
      onCancel={onClose}
      width={600}
      footer={[
        <Button key="close" onClick={onClose}>
          {t('closeButton', { defaultValue: 'Close' })}
        </Button>,
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={onCopy}>
          {t('invitationModalCopyLink', { defaultValue: 'Copy Link' })}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 16 }}>
        <Typography.Text type="secondary">
          {t('invitationModalDescription', {
            defaultValue:
              'Share this link with the client to invite them to create their portal account. The link will expire in 7 days.',
          })}
        </Typography.Text>
      </div>

      <div
        style={{
          padding: 12,
          marginBottom: 16,
          wordBreak: 'break-all',
          borderRadius: token.borderRadius,
          backgroundColor: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text copyable={{ text: link }}>{link}</Typography.Text>
      </div>

      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {t('invitationModalFooterText', {
          defaultValue:
            "When the client clicks this link, they'll be able to create their portal account and access their projects and services.",
        })}
      </Typography.Text>
    </Modal>
  );
};
