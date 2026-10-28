import React from 'react';
import { Button, Card, Flex, Typography, LockOutlined, theme } from '@/shared/antd-imports';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import AuthPageHeader from '@/components/AuthPageHeader';
import { isAccessRemovedReason, type AccessRemovedReason } from '@/utils/accessRemoved';

/**
 * What each reason says, and who to talk to. Generic on purpose: no company, team or person is named, so
 * this screen cannot be used to find out who is a client, and the same words work in every case.
 */
const REASON_COPY: Record<AccessRemovedReason, { title: string; body: string }> = {
  organization_unavailable: {
    title: 'This portal is no longer available',
    body: 'The portal you were using was deactivated or removed, so you were signed out. Contact your project team if you think this is a mistake.',
  },
  account_deleted: {
    title: 'Your account was deleted',
    body: 'This account was deleted, so you were signed out. If that was a mistake, contact a Client Admin of your organization or your project team: a deleted account can be restored for 30 days.',
  },
  access_disabled: {
    title: 'Your access was deactivated',
    body: 'Your access was deactivated, so you were signed out. Contact a Client Admin of your organization or your project team to have it turned back on.',
  },
  access_removed: {
    title: 'Your access was removed',
    body: 'You are no longer a user of this portal, so you were signed out. Contact a Client Admin of your organization or your project team if you think this is a mistake.',
  },
};

/**
 * Where a client lands when the server says their access ended (401, or 403 ACCESS_REVOKED). The `reason` in
 * the address picks the wording. It is a public route: the session is already cleared by the time this shows.
 */
const AccessRemovedPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const [searchParams] = useSearchParams();

  // Only the four known reasons are ever shown; anything else in the address falls back to the general text.
  const requested = searchParams.get('reason');
  const reason = isAccessRemovedReason(requested) ? requested : null;

  const title = reason
    ? t(`accessRemoved.reasons.${reason}.title`, { defaultValue: REASON_COPY[reason].title })
    : t('accessRemoved.title', { defaultValue: 'Your access has been removed' });
  const body = reason
    ? t(`accessRemoved.reasons.${reason}.body`, { defaultValue: REASON_COPY[reason].body })
    : t('accessRemoved.body', {
        defaultValue:
          'Your request was blocked and you were signed out. Contact your project contact if you think this is a mistake.',
      });

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
          {title}
        </Typography.Title>
        <Typography.Paragraph type="secondary">{body}</Typography.Paragraph>
        <Typography.Paragraph type="secondary" style={{ fontSize: 13 }}>
          {t('accessRemoved.otherOrganization', {
            defaultValue: 'If you belong to another organization, sign in again to open it.',
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
