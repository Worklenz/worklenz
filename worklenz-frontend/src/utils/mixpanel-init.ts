import { MixpanelConfig } from '@/types/mixpanel.types';
import mixpanel from 'mixpanel-browser';

export const initMixpanel = (token: string, config: MixpanelConfig = {}): void => {
  mixpanel.init(token, {
    debug: import.meta.env.VITE_APP_ENV !== 'production',
    track_pageview: true,
    persistence: 'localStorage',
    ...config,
  });
};
