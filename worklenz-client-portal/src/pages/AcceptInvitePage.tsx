import React, { useEffect, useRef, useState } from 'react';
import { Button, Flex, Result, Spin, message } from '@/shared/antd-imports';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useAcceptInviteMutation } from '@/store/api';
import { logoutUser } from '@/store/slices/authSlice';
import { applyTeamSession } from '@/utils/teamSession';
import { errorMessage } from '@/components/v2';
import { decodeHtmlEntities } from '@/utils/html-entities';

interface AcceptInvitePageProps {
  inviteToken: string;
}

const errorCodeOf = (error: unknown): string | undefined =>
  (error as { data?: { body?: { code?: unknown } } } | undefined)?.data?.body?.code as string | undefined;

/**
 * An invitation link opened by someone who is already signed in. Their session proves the address, so
 * the invitation is accepted straight away with no code, and they land in the portal they were just
 * invited to. (Someone who is signed out gets the code sign-in instead; see `InviteRoute`.)
 */
export const AcceptInvitePage: React.FC<AcceptInvitePageProps> = ({ inviteToken }) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [accept] = useAcceptInviteMutation();
  const [failure, setFailure] = useState<{ code?: string; message?: string } | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // One attempt per link: a re-render (or React strict mode) must not accept it twice.
    if (started.current) return;
    started.current = true;

    void accept(inviteToken)
      .unwrap()
      .then(async response => {
        if (!response.done) throw new Error(response.message ?? undefined);
        await applyTeamSession(dispatch, response.body);
        const name = decodeHtmlEntities(response.body.organizationName);
        message.success(
          name
            ? t('invite.accepted', { defaultValue: 'You were added to {{name}}', name })
            : t('invite.acceptedGeneric', { defaultValue: 'You were added to the portal' })
        );
        navigate('/dashboard', { replace: true });
      })
      .catch((error: unknown) => setFailure({ code: errorCodeOf(error), message: errorMessage(error) }));
  }, [accept, dispatch, inviteToken, navigate, t]);

  // The link is for another address: sign out and open it again, which asks for the code.
  const signOutAndUseLink = async () => {
    await dispatch(logoutUser());
    window.location.assign(`/invite?token=${encodeURIComponent(inviteToken)}`);
  };

  if (!failure) {
    return (
      <Flex vertical align="center" justify="center" gap={12} style={{ minHeight: '100vh' }} role="status">
        <Spin size="large" />
        <span>{t('invite.adding', { defaultValue: 'Adding you to the portal...' })}</span>
      </Flex>
    );
  }

  const isDifferentAddress = failure.code === 'EMAIL_MISMATCH';
  const isInvalidLink = failure.code === 'LINK_INVALID';

  return (
    <Result
      status={isDifferentAddress ? 'warning' : 'error'}
      title={
        isDifferentAddress
          ? t('invite.differentAddressTitle', { defaultValue: 'This invitation is for a different email address' })
          : isInvalidLink
            ? t('invite.invalidTitle', { defaultValue: 'This invitation link is no longer valid' })
            : t('invite.failedTitle', { defaultValue: 'We could not add you to the portal' })
      }
      subTitle={
        failure.message ??
        t('invite.failedBody', { defaultValue: 'Ask your project team to send you a new invitation.' })
      }
      extra={[
        isDifferentAddress && (
          <Button key="switch" type="primary" onClick={() => void signOutAndUseLink()}>
            {t('invite.signOutAndUse', { defaultValue: 'Sign out and use this invitation' })}
          </Button>
        ),
        <Button key="back" type={isDifferentAddress ? 'default' : 'primary'} onClick={() => navigate('/dashboard', { replace: true })}>
          {t('invite.backToDashboard', { defaultValue: 'Back to the overview' })}
        </Button>,
      ]}
    />
  );
};

export default AcceptInvitePage;
