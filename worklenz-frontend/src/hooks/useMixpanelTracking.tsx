import mixpanel, { Dict } from 'mixpanel-browser';
import { useCallback, useEffect, useMemo } from 'react';
import { useAuthService } from './useAuth';
import { initMixpanel } from '@/utils/mixpanelInit';
import logger from '@/utils/errorLogger';

export const useMixpanelTracking = () => {
  const auth = useAuthService();

  const { token, isProductionEnvironment } = useMemo(() => {
    const host = window.location.host;
    const isProduction = host === 'app.worklenz.com';

    return {
      token: isProduction ? import.meta.env.VITE_MIXPANEL_TOKEN : null,
      isProductionEnvironment: isProduction,
    };
  }, []);

  useEffect(() => {
    if (isProductionEnvironment && token) {
      try {
        initMixpanel(token);
        logger.info('Mixpanel initialized successfully for production');

        // Set identity if user is already authenticated on page load/reload
        const currentUser = auth.getCurrentSession();
        if (currentUser?.id) {
          mixpanel.identify(currentUser.id);
          mixpanel.people.set({
            $user_id: currentUser.id,
            $name: currentUser.name,
            $email: currentUser.email,
            $avatar: currentUser.avatar_url,
          });
          logger.debug('Mixpanel identity set on initialization', currentUser.id);
        }
      } catch (error) {
        logger.error('Failed to initialize Mixpanel:', error);
      }
    } else {
      logger.info('Mixpanel not initialized - not in production environment or missing token');
    }
  }, [token, isProductionEnvironment, auth]);

  const setIdentity = useCallback(
    (user: any) => {
      if (!isProductionEnvironment) {
        logger.debug('Mixpanel setIdentity skipped - not in production environment');
        return;
      }

      if (user?.id) {
        try {
          mixpanel.identify(user.id);
          mixpanel.people.set({
            $user_id: user.id,
            $name: user.name,
            $email: user.email,
            $avatar: user.avatar_url,
          });
        } catch (error) {
          logger.error('Error setting Mixpanel identity:', error);
        }
      }
    },
    [isProductionEnvironment]
  );

  const reset = useCallback(() => {
    if (!isProductionEnvironment) {
      logger.debug('Mixpanel reset skipped - not in production environment');
      return;
    }

    try {
      mixpanel.reset();
    } catch (error) {
      logger.error('Error resetting Mixpanel:', error);
    }
  }, [isProductionEnvironment]);

  const trackMixpanelEvent = useCallback(
    (event: string, properties?: Dict) => {
      if (!isProductionEnvironment) {
        logger.debug(
          `Mixpanel tracking skipped - not in production environment. Event: ${event}`,
          properties
        );
        return;
      }

      try {
        const currentUser = auth.getCurrentSession();
        const props = {
          ...(properties || {}),
          ...(currentUser?.user_no ? { id: currentUser.user_no } : {}),
        };

        mixpanel.track(event, props);
        logger.debug(`Mixpanel event tracked: ${event}`, props);
      } catch (e) {
        logger.error('Error tracking mixpanel event', e);
      }
    },
    [auth.getCurrentSession, isProductionEnvironment]
  );

  return {
    setIdentity,
    reset,
    trackMixpanelEvent,
  };
};
