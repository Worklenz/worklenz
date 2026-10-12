import { useSyncExternalStore } from 'react';

/** Matches antd's `lg` breakpoint: the width from which the draggable 12-column grid is usable. */
export const DESKTOP_QUERY = '(min-width: 992px)';

const subscribe = (onChange: () => void): (() => void) => {
  const query = window.matchMedia?.(DESKTOP_QUERY);
  query?.addEventListener?.('change', onChange);
  return () => query?.removeEventListener?.('change', onChange);
};

const getSnapshot = (): boolean => window.matchMedia?.(DESKTOP_QUERY).matches ?? true;

/**
 * True on desktop-width screens. Read synchronously (no first-render flash of the wrong layout)
 * rather than via a media-query hook that starts empty.
 */
export const useIsDesktop = (): boolean => useSyncExternalStore(subscribe, getSnapshot, () => true);
