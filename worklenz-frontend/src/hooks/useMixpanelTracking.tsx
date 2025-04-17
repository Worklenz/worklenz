import mixpanel, { Dict } from 'mixpanel-browser';
import { useCallback, useEffect, useMemo } from 'react';
import { useAuthService } from './useAuth';
import { initMixpanel } from '@/utils/mixpanelInit';
import logger from '@/utils/errorLogger';

export const useMixpanelTracking = () => {
  const auth = useAuthService();

  const token = useMemo(() => {
    const host = window.location.host;
    if (host === 'uat.worklenz.com' || host === 'dev.worklenz.com' || host === 'api.worklenz.com') {
      return import.meta.env.VITE_MIXPANEL_TOKEN;
    }
    if (host === 'app.worklenz.com' || host === 'v2.worklenz.com') {
      return import.meta.env.VITE_MIXPANEL_TOKEN;
    }
    return import.meta.env.VITE_MIXPANEL_TOKEN;
  }, []);

  useEffect(() => {
    initMixpanel(token);
  }, [token]);

  const setIdentity = useCallback((user: any) => {
    if (user?.id) {
      mixpanel.identify(user.id);
      mixpanel.people.set({
        $user_id: user.id,
        $name: user.name,
        $email: user.email,
        $avatar: user.avatar_url,
      });
    }
  }, []);

  const reset = useCallback(() => {
    mixpanel.reset();
  }, []);

  const trackMixpanelEvent = useCallback(
    (event: string, properties?: Dict) => {
      try {
        const currentUser = auth.getCurrentSession();
        const props = {
          ...(properties || {}),
          ...(currentUser?.user_no ? { id: currentUser.user_no } : {}),
        };

        mixpanel.track(event, props);
      } catch (e) {
        logger.error('Error tracking mixpanel event', e);
      }
    },
    [auth.getCurrentSession]
  );

  return {
    setIdentity,
    reset,
    trackMixpanelEvent,
  };
};
