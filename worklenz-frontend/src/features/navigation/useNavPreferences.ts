import { useCallback, useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useResponsive } from '@/hooks/useResponsive';
import { selectCurrentProject } from '@/app/selectors';
import { NAV_REGISTRY } from './nav-registry';
import { resolveNavState } from './resolveNavState';
import {
  clearPinnedDefault,
  setCollapsed,
  setGroupOrder,
  setPinnedDefault,
} from './navPreferences.slice';
import type { SurfaceKey } from './nav-registry.types';

// One hook, reused identically by every page that mounts a NavRail — wraps
// the registry + saved preferences + the debounce-free localStorage writes
// behind the actions NavRail actually calls (spec §10's useNavPreferences).
export function useNavPreferences(surfaceKey: SurfaceKey) {
  const dispatch = useAppDispatch();
  const prefs = useAppSelector(state => state.navPreferencesReducer);
  const { isDesktop } = useResponsive();
  const surface = NAV_REGISTRY[surfaceKey];

  // Guest status is a per-project access level (project_members.access_level = GUEST),
  // provided by the project response — mirrors navbar.tsx's isGuest derivation.
  const currentProject = useAppSelector(selectCurrentProject);
  const isGuestUser = Boolean(currentProject?.project?.is_guest);

  const resolved = useMemo(
    () => resolveNavState(surface, prefs, isGuestUser),
    [surface, prefs, isGuestUser]
  );

  const toggleCollapsed = useCallback(() => dispatch(toggleCollapsedAction()), [dispatch]);

  const pin = useCallback(
    (itemKey: string) => dispatch(setPinnedDefault({ surfaceKey, itemKey })),
    [dispatch, surfaceKey]
  );

  const unpin = useCallback(() => dispatch(clearPinnedDefault(surfaceKey)), [dispatch, surfaceKey]);

  const reorder = useCallback(
    (groupKey: string, order: string[]) => dispatch(setGroupOrder({ surfaceKey, groupKey, order })),
    [dispatch, surfaceKey]
  );

  const isPinned = useCallback(
    (itemKey: string) => prefs.pinnedDefaults[surfaceKey] === itemKey,
    [prefs, surfaceKey]
  );

  return { surface, resolved, toggleCollapsed, pin, unpin, isPinned, reorder };
}
