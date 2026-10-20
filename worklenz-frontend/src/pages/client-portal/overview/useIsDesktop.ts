import { useSyncExternalStore } from 'react';

/** Matches antd's `lg` breakpoint: the width from which the draggable 12-column grid is usable. */
export const DESKTOP_QUERY = '(min-width: 992px)';

const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia?.(DESKTOP_QUERY);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
};

const getSnapshot = (): boolean => window.matchMedia?.(DESKTOP_QUERY).matches ?? true;

/** True on desktop-width screens, read synchronously so the first render uses the right layout. */
export const useIsDesktop = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => true);
