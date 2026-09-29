import React, { useEffect } from 'react';
import { Flex, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { verifyAuthentication } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSession } from '@/utils/session-helper';
import { setUser } from '@/features/user/userSlice';
import logger from '@/utils/errorLogger';
import { WORKLENZ_REDIRECT_PROJ_KEY } from '@/shared/constants';
import { invitationRedirectService } from '@/services/invitation-redirect.service';
import { WorklenzLogoLoader } from '@/components/worklenz-loader/worklenz-loader';
import { getDefaultAuthenticatedPath } from '@/utils/guest-session';
import { ILocalSession } from '@/types/auth/local-session.types';

const REDIRECT_DELAY = 500; // Delay in milliseconds before redirecting

const AuthenticatingPage: React.FC = () => {
  const { t } = useTranslation('auth/auth-common');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleSuccessRedirect = (user: ILocalSession) => {
    // Check for pending invitation first (highest priority)
    const pendingInvitation = invitationRedirectService.getPendingInvitation();
    if (pendingInvitation) {
      console.log(
        '[Authenticating] Found pending invitation, redirecting to:',
        pendingInvitation.url
      );
      // Don't clear here - let the invite page clear it after successful join.
      // Full reload rehydrates auth/session state after login before the invite page runs.
      window.location.href = pendingInvitation.url;
      return;
    }

    // Check for project redirect
    const project = localStorage.getItem(WORKLENZ_REDIRECT_PROJ_KEY);
    if (project) {
      localStorage.removeItem(WORKLENZ_REDIRECT_PROJ_KEY);
      // Full reload matches LoginPage and remounts project state for the post-login redirect.
      window.location.href = `/worklenz/projects/${project}?tab=tasks-list`;
      return;
    }

    navigate(getDefaultAuthenticatedPath(user));
  };

  useEffect(() => {
    const handleAuthentication = async () => {
      try {
        const session = await dispatch(verifyAuthentication()).unwrap();

        if (!session.authenticated) {
          return navigate('/auth/login');
        }

        // Set user session and state
        setSession(session.user);
        dispatch(setUser(session.user));

        if (!session.user.setup_completed) {
          return navigate('/worklenz/setup');
        }

        // Redirect based on setup status
        setTimeout(() => {
          handleSuccessRedirect(session.user);
        }, REDIRECT_DELAY);
      } catch (error) {
        logger.error('Authentication verification failed:', error);
        navigate('/auth/login');
      }
    };

    void handleAuthentication();
  }, [dispatch, navigate]);

  return (
    <Flex vertical align="center" justify="center" gap="middle">
      <WorklenzLogoLoader />
      <Typography.Title level={3}>
        {t('authenticating', { defaultValue: 'Authenticating...' })}
      </Typography.Title>
      <Typography.Text>
        {t('gettingThingsReady', { defaultValue: 'Getting things ready for you...' })}
      </Typography.Text>
    </Flex>
  );
};

export default AuthenticatingPage;
