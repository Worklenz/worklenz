import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, Typography, message, theme } from '@/shared/antd-imports';
import { CopyOutlined } from '@ant-design/icons';

interface InvitationLinkModalProps {
  open: boolean;
  /** The sign-in link: shown when the email could not be delivered, or when staff asked to create one. */
  link: string;
  email: string;
  /** `created`: staff asked for a link to share. `emailFailed`: the invitation email did not go out. */
  reason?: 'created' | 'emailFailed';
  onClose: () => void;
}

export const InvitationLinkModal = ({
  open,
  link,
  email,
  reason = 'emailFailed',
  onClose,
}: InvitationLinkModalProps) => {
  const { t } = useTranslation('client-portal-v2');
  const { token } = theme.useToken();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      message.success(t('invitationLinkCopied', { defaultValue: 'Sign-in link copied.' }));
    } catch {
      message.error(t('invitationLinkCopyFailed', { defaultValue: 'Could not copy the link.' }));
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={
        reason === 'created'
          ? t('signInLinkTitle', { defaultValue: 'Sign-in link' })
          : t('invitationLinkTitle', { defaultValue: 'Share the sign-in link' })
      }
      width={560}
      destroyOnHidden
      footer={[
        <Button key="close" onClick={onClose}>
          {t('close', { defaultValue: 'Close' })}
        </Button>,
        <Button key="copy" type="primary" icon={<CopyOutlined />} onClick={copyLink}>
          {t('invitationLinkCopy', { defaultValue: 'Copy link' })}
        </Button>,
      ]}
    >
      <Typography.Paragraph type="secondary">
        {reason === 'created'
          ? t('signInLinkDescription', {
              email,
              defaultValue:
                'Opening this link emails a 6-digit code to {{email}}, and entering it signs them in. There is no password. The link works for 7 days and replaces any earlier link.',
            })
          : t('invitationLinkDescription', {
              email,
              defaultValue:
                'The email to {{email}} could not be sent. Share this link with them instead. Opening it emails them a 6-digit code. It expires after 7 days.',
            })}
      </Typography.Paragraph>
      <div
        style={{
          padding: 12,
          wordBreak: 'break-all',
          borderRadius: token.borderRadius,
          background: token.colorFillQuaternary,
          border: `1px solid ${token.colorBorderSecondary}`,
        }}
      >
        <Typography.Text>{link}</Typography.Text>
      </div>
    </Modal>
  );
};
