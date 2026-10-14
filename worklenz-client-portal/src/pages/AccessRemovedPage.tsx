import React from 'react';
import { Button, Card, Flex, Typography, LockOutlined, theme } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthPageHeader from '@/components/AuthPageHeader';

/**
 * Where a client lands when the server says their access was removed (401, or 403 ACCESS_REVOKED).
 * It is a public route: the session is already cleared by the time this shows.
 */
const AccessRemovedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  return (
    <Flex
      align="center"
      justify="center"
      style={{ minHeight: '100vh', background: token.colorBgLayout, padding: 24 }}
    >
      <Card style={{ width: 420, maxWidth: '100%', textAlign: 'center' }} styles={{ body: { padding: 32 } }}>
        <AuthPageHeader />
        <LockOutlined aria-hidden style={{ fontSize: 34, color: token.colorError, margin: '8px 0' }} />
        <Typography.Title level={4} style={{ marginTop: 8 }}>
          {t('accessRemoved.title', { defaultValue: 'Your access has been removed' })}
        </Typography.Title>
        <Typography.Paragraph type="secondary">
          {t('accessRemoved.body', {
            defaultValue:
              'Your request was blocked and you were signed out. Contact your project contact if you think this is a mistake.',
          })}
        </Typography.Paragraph>
        <Button block onClick={() => navigate('/auth/login', { replace: true })}>
          {t('accessRemoved.back', { defaultValue: 'Back to sign in' })}
        </Button>
      </Card>
    </Flex>
  );
};

export default AccessRemovedPage;
