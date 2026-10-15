import { useCallback, useState } from 'react';
import { clientPortalItems } from '@/lib/client-portal/client-portal-constants';
import { useClientAccess } from '@/hooks/useClientAccess';

// Same rail metrics as the admin app (worklenz-frontend nav-rail-constants).
export const RAIL_EXPANDED_WIDTH = 64;
export const RAIL_COLLAPSED_WIDTH = 56;

// The header and the rail share one panel colour so they read as a single surface; the content pane
// sits on top of it with a rounded top-left corner and a divider.
export const RAIL_BG_LIGHT = '#ffffff';
export const RAIL_BG_DARK = '#141414';
export const RAIL_DIVIDER_LIGHT = '#e8e8e8';
export const RAIL_DIVIDER_DARK = '#303030';
export const CONTENT_CORNER_RADIUS = 12;

const COLLAPSED_STORAGE_KEY = 'clientPortalRailCollapsed';

const readCollapsed = (): boolean => {
  try {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

/** Rail collapse state, remembered per browser. */
export const useRailCollapsed = () => {
  const [collapsed, setCollapsed] = useState<boolean>(readCollapsed);
  const toggle = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      } catch {
        // Not persisted (private window / blocked storage); the toggle still works for this session.
      }
      return next;
    });
  }, []);
  return { collapsed, toggle };
};

/** Visible nav items for this client: Invoices only when the operator turned them on. */
export const useNavItems = () => {
  const { invoicesVisible } = useClientAccess();
  return clientPortalItems.filter(item => !item.requiresInvoices || invoicesVisible);
};

/** The first URL segment decides the highlighted item. */
export const activeNavKey = (pathname: string): string => pathname.split('/').filter(Boolean)[0] || 'dashboard';

// The branding colour tints the top bar and the rail at a fixed strength per theme: enough to show the
// brand, low enough that the icons and text on top keep their contrast. Mixed over the solid base, so
// the result is opaque.
const RAIL_TINT_LIGHT = 12;
const RAIL_TINT_DARK = 22;

export const railBackground = (isDark: boolean, brandColor: string): string =>
  `color-mix(in srgb, ${brandColor} ${isDark ? RAIL_TINT_DARK : RAIL_TINT_LIGHT}%, ${isDark ? RAIL_BG_DARK : RAIL_BG_LIGHT})`;
