import React, { useEffect } from 'react';
import { Card, Flex, Spin, Typography } from '@/shared/antd-imports';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { verifyAuthentication } from '@/features/auth/authSlice';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { setSession } from '@/utils/session-helper';
import { setUser } from '@/features/user/userSlice';
import logger from '@/utils/errorLogger';
import { WORKLENZ_REDIRECT_PROJ_KEY } from '@/shared/constants';

const REDIRECT_DELAY = 500; // Delay in milliseconds before redirecting

const AuthenticatingPage: React.FC = () => {
  const { t } = useTranslation('auth/auth-common');
  const navigate = useNavigate();
  const dispatch = useAppDispatch();

  const handleSuccessRedirect = () => {
    const project = localStorage.getItem(WORKLENZ_REDIRECT_PROJ_KEY);
    if (project) {
      localStorage.removeItem(WORKLENZ_REDIRECT_PROJ_KEY);
      window.location.href = `/worklenz/projects/${project}?tab=tasks-list`;
      return;
    }

    navigate('/worklenz/home');
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
          handleSuccessRedirect();
        }, REDIRECT_DELAY);
      } catch (error) {
        logger.error('Authentication verification failed:', error);
        navigate('/auth/login');
      }
    };

    void handleAuthentication();
  }, [dispatch, navigate]);

  const cardStyles = {
    width: '100%',
    boxShadow: 'none',
  };

  return (
    <Card style={cardStyles}>
      <Flex vertical align="center" gap="middle">
        <Spin size="large" />
        <Typography.Title level={3}>
          {t('authenticating', { defaultValue: 'Authenticating...' })}
        </Typography.Title>
        <Typography.Text>
          {t('gettingThingsReady', { defaultValue: 'Getting things ready for you...' })}
        </Typography.Text>
      </Flex>
    </Card>
  );
};

export default AuthenticatingPage;
