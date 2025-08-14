import { MixpanelConfig } from '@/types/mixpanel.types';
import mixpanel from 'mixpanel-browser';

export const initMixpanel = (token: string | null, config: MixpanelConfig = {}): void => {
  if (!token || token === 'mixpanel-token' || token.trim() === '') {
    console.warn('Mixpanel initialization skipped: Invalid or missing token');
    return;
  }

  mixpanel.init(token, {
    debug: import.meta.env.VITE_APP_ENV !== 'production',
    track_pageview: true,
    persistence: 'localStorage',
    ...config,
  });
};
