import type { ReactNode } from 'react';
import type { RootState } from '@/app/store';

// Every left rail this feature covers today. Add a new surface by adding a key
// here and a matching entry in nav-registry.tsx — nothing else needs to change.
export type SurfaceKey =
  | 'home'
  | 'planner'
  | 'reporting'
  | 'client-portal'
  | 'projects'
  | 'team-lead-reports'
  | 'finance';

// Home/Planner use plain strings; Reporting/Client Portal resolve labels via
// useTranslation(ns) — the union lets one registry serve both without forcing
// i18n onto surfaces that don't have it.
export type NavItemLabel = string | { i18nNs: string; i18nKey: string; defaultValue: string };

export interface NavItem {
  key: string;
  label: NavItemLabel;
  icon: ReactNode;
  // Resolved by the mounting page against its own store slice — keeps the
  // registry free of a second selector-lookup table for the two items
  // (home.my-tasks, client-portal.chats) that have a live count today.
  badgeSelector?: (state: RootState) => number;
  soon?: boolean;
  // Opt-out of the default "soon items are non-clickable" behavior — the
  // item keeps its dimmed styling and "Soon" tag, but still navigates to
  // its (already Coming Soon-backed) route. Only meaningful alongside
  // `soon: true`; every other `soon` item stays fully inert as before.
  soonClickable?: boolean;
  // Excluded from drag-to-reorder entirely; none set today, left available
  // for a future "always first" rule.
  lockedOrder?: boolean;
  // Hide from guest-only users
  guestExcluded?: boolean;
}

export interface NavGroup {
  key: string;
  label?: NavItemLabel;
  items: NavItem[];
}

export interface NavSurface {
  key: SurfaceKey;
  defaultItemKey: string;
  groups: NavGroup[];
}

export interface ResolvedNavState {
  groups: NavGroup[];
  activeDefaultKey: string;
  collapsed: boolean;
}
