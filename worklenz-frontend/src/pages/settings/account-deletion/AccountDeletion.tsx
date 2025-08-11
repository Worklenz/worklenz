import React, { useState } from 'react';
import { Button, Card, Modal, Typography, Space, Alert, Input, message } from '@/shared/antd-imports';
import { ExclamationCircleOutlined, DeleteOutlined } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useAuthService } from '@/hooks/useAuth';
import { accountApiService } from '@/api/account/account.api.service';
import { authApiService } from '@/api/auth/auth.api.service';
import CacheCleanup from '@/utils/cache-cleanup';
import logger from '@/utils/errorLogger';

const { Title, Text, Paragraph } = Typography;

const AccountDeletion: React.FC = () => {
  const { t } = useTranslation('settings/account-deletion');
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const authService = useAuthService();
  const currentSession = authService.getCurrentSession();

  const showModal = () => {
    setIsModalVisible(true);
  };

  const handleCancel = () => {
    setIsModalVisible(false);
    setConfirmText('');
  };

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') {
      message.error(t('invalidConfirmation'));
      return;
    }

    if (!currentSession?.id) {
      message.error('User session not found');
      return;
    }

    setLoading(true);
    try {
      const response = await accountApiService.requestDeletion({
        userId: currentSession.id,
        userEmail: currentSession.email,
        userName: currentSession.name
      });

      if (response.done) {
        message.success(t('deletionRequestSuccess'));
        Modal.success({
          title: t('requestSubmitted'),
          content: t('deletionConfirmationMessage'),
          onOk: async () => {
            // Custom logout flow for account deletion - redirect to signup instead of login
            try {
              // Clear local session
              await authService.signOut();
              
              // Call backend logout
              await authApiService.logout();
              
              // Clear all caches using the utility
              await CacheCleanup.clearAllCaches();
              
              // Force a hard reload to signup page
              CacheCleanup.forceReload('/auth/signup');
              
            } catch (error) {
              console.error('Logout error after account deletion:', error);
              // Fallback: force reload to signup page
              CacheCleanup.forceReload('/auth/signup');
            }
          },
        });
      } else {
        message.error(t('deletionRequestFailed'));
      }
    } catch (error) {
      logger.error('Account deletion request failed:', error);
      message.error(t('deletionRequestFailed'));
    } finally {
      setLoading(false);
      handleCancel();
    }
  };

  return (
    <div className="p-6">
      <Title level={3}>{t('title')}</Title>
      
      <Card className="mt-4">
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div>
            <Title level={4}>{t('dangerZone')}</Title>
            <Alert
              message={t('warningTitle')}
              description={
                <div>
                  <Paragraph>{t('warningDescription1')}</Paragraph>
                  <ul>
                    <li>{t('warningPoint1')}</li>
                    <li>{t('warningPoint2')}</li>
                    <li>{t('warningPoint3')}</li>
                    <li>{t('warningPoint4')}</li>
                  </ul>
                  <Paragraph strong>{t('warningDescription2')}</Paragraph>
                </div>
              }
              type="warning"
              showIcon
              icon={<ExclamationCircleOutlined />}
              className="mb-4"
            />
          </div>

          <div>
            <Paragraph>{t('beforeDeletion')}</Paragraph>
            <ul>
              <li>{t('exportData')}</li>
              <li>{t('cancelSubscription')}</li>
              <li>{t('informTeam')}</li>
            </ul>
          </div>

          <Button 
            danger 
            type="primary" 
            icon={<DeleteOutlined />}
            onClick={showModal}
            size="large"
          >
            {t('deleteAccountButton')}
          </Button>
        </Space>
      </Card>

      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>{t('confirmDeletionTitle')}</span>
          </Space>
        }
        open={isModalVisible}
        onOk={handleDelete}
        onCancel={handleCancel}
        okText={t('confirmDelete')}
        cancelText={t('cancel')}
        okButtonProps={{ 
          danger: true, 
          disabled: confirmText !== 'DELETE',
          loading: loading 
        }}
        width={600}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Alert
            message={t('finalWarning')}
            type="error"
            showIcon
          />
          
          <div>
            <Text strong>{t('confirmationInstructions')}</Text>
            <Paragraph>{t('typeDeleteToConfirm')}</Paragraph>
            <Input
              placeholder="DELETE"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              size="large"
              style={{ marginTop: 8 }}
            />
          </div>

          <Alert
            message={t('dataRetentionNotice')}
            description={t('dataRetentionDescription')}
            type="info"
            showIcon
          />
        </Space>
      </Modal>
    </div>
  );
};

export default AccountDeletion;