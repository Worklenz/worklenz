import React from 'react';
import { Modal, Button, Input, Typography, Alert, Space, message } from '@/shared/antd-imports';
import { CopyOutlined, ReloadOutlined, LinkOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGenerateClientInvitationLinkMutation } from '@/api/client-portal/client-portal-api';
import { useResponsive } from '@/hooks/useResponsive';

const { Text, Paragraph } = Typography;

interface InviteLinkModalProps {
  visible: boolean;
  onClose: () => void;
}

const InviteLinkModal: React.FC<InviteLinkModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation('client-portal-clients');
  const { isMobile, isTablet, isDesktop } = useResponsive();
  const [orgInviteLink, setOrgInviteLink] = React.useState<string>('');
  const [linkExpiry, setLinkExpiry] = React.useState<string>('');

  const [generateOrgInviteLink, { isLoading: isGeneratingLink }] =
    useGenerateClientInvitationLinkMutation();

  const handleGenerateOrgInviteLink = async () => {
    try {
      const response = await generateOrgInviteLink({ clientId: 'organization' }).unwrap();
      // Handle wrapped response structure
      const data = response.body || response;
      if (data && data.invitationLink) {
        setOrgInviteLink(data.invitationLink);
        setLinkExpiry(data.expiresAt);
        message.success(
          t('generateLinkSuccess') || 'Organization invite link generated successfully!'
        );
      }
    } catch (error: any) {
      console.error('Failed to generate organization invite link:', error);
      const errorMessage =
        error?.data?.message ||
        error?.message ||
        t('generateLinkError') ||
        'Failed to generate organization invite link';
      message.error(errorMessage);
      // Show error in modal instead of just console
      setOrgInviteLink('error');
    }
  };

  const handleCopyInviteLink = () => {
    if (orgInviteLink && orgInviteLink !== 'error') {
      navigator.clipboard.writeText(orgInviteLink);
      message.success(t('linkCopiedSuccess') || 'Invite link copied to clipboard!');
      onClose();
    }
  };

  const formatExpiryDate = (dateString: string) => {
    if (!dateString) return '';
    return (
      new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString()
    );
  };

  React.useEffect(() => {
    // Reset state when modal closes
    if (!visible) {
      setOrgInviteLink('');
      setLinkExpiry('');
    } else if (visible && !orgInviteLink) {
      // Generate link when modal opens
      handleGenerateOrgInviteLink();
    }
  }, [visible]);

  return (
    <Modal
      title={
        <Space>
          <LinkOutlined />
          <span>{t('organizationInviteLinkTitle') || 'Organization Invite Link'}</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      footer={null}
      width={isMobile ? '100%' : 600}
    >
      <div style={{ marginBottom: 16 }}>
        <Paragraph type="secondary">
          {t('organizationInviteLinkDescription') ||
            "Share this link with clients to allow them to join your organization's client portal. The link expires after 7 days for security."}
        </Paragraph>
      </div>

      {orgInviteLink === 'error' ? (
        <Alert
          message={t('generateLinkError') || 'Failed to generate organization invite link'}
          description={
            t('tryAgainMessage') || 'Please try again or contact support if the issue persists.'
          }
          type="error"
          showIcon
          action={
            <Button
              icon={<ReloadOutlined />}
              onClick={handleGenerateOrgInviteLink}
              loading={isGeneratingLink}
            >
              {t('retryButton') || 'Retry'}
            </Button>
          }
        />
      ) : orgInviteLink ? (
        <>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <Input.Group
              compact
              style={{
                display: 'flex',
                flexDirection: isMobile ? 'column' : 'row',
                gap: isMobile ? 8 : 0,
              }}
            >
              <Input
                value={orgInviteLink}
                readOnly
                size={isMobile ? 'middle' : 'large'}
                style={{ flex: 1, width: isMobile ? '100%' : 'auto' }}
              />
              <Button
                icon={<CopyOutlined />}
                onClick={handleCopyInviteLink}
                size={isMobile ? 'middle' : 'large'}
                type="primary"
                style={{ width: isMobile ? '100%' : 'auto' }}
              >
                {t('copyButton') || 'Copy'}
              </Button>
            </Input.Group>

            {linkExpiry && (
              <Alert
                message={`${t('linkExpiresAt') || 'Link expires at'}: ${formatExpiryDate(linkExpiry)}`}
                type="info"
                showIcon
              />
            )}

            <Button
              icon={<ReloadOutlined />}
              onClick={handleGenerateOrgInviteLink}
              loading={isGeneratingLink}
              block
            >
              {t('regenerateLink') || 'Regenerate Link'}
            </Button>
          </Space>
        </>
      ) : (
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Alert
            message={
              isGeneratingLink
                ? t('generatingLink') || 'Generating invite link...'
                : t('noInviteLinkGenerated') || 'Click the button below to generate an invite link'
            }
            type="info"
            showIcon
          />
          {!isGeneratingLink && (
            <Button
              icon={<ReloadOutlined />}
              onClick={handleGenerateOrgInviteLink}
              loading={isGeneratingLink}
              block
            >
              {t('generateLink') || 'Generate Link'}
            </Button>
          )}
        </Space>
      )}
    </Modal>
  );
};

export default InviteLinkModal;
