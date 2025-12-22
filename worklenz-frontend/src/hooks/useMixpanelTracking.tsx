import { useCallback } from 'react';

const noopIdentity = (_user?: unknown) => {};
const noopReset = () => {};
const noopTrack = (_event: string, _properties?: Record<string, unknown>) => {};

export const useMixpanelTracking = () => {
  const setIdentity = useCallback(noopIdentity, []);
  const reset = useCallback(noopReset, []);
  const trackMixpanelEvent = useCallback(noopTrack, []);

  return {
    setIdentity,
    reset,
    trackMixpanelEvent,
  };
};
