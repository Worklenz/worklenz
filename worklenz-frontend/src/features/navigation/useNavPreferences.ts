import { useCallback, useMemo } from 'react';
import { useAppSelector } from '@/hooks/useAppSelector';
import { useAppDispatch } from '@/hooks/useAppDispatch';
import { useResponsive } from '@/hooks/useResponsive';
import { useAuthService } from '@/hooks/useAuth';
import { selectCurrentProject } from '@/app/selectors';
import { isSessionGuest } from '@/utils/guest-session';
import { NAV_REGISTRY } from './nav-registry';
import { resolveNavState } from './resolveNavState';
import {
  applyNavPreview,
  clearPinnedDefault,
  setCollapsed,
  toggleCollapsed,
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
  const authService = useAuthService();
  const session = authService.getCurrentSession();

  // Prefer team-scoped session.is_guest so Projects rail restrictions work
  // before any project is opened (e.g. after logout/login).
  const currentProject = useAppSelector(selectCurrentProject);
  const isGuestUser =
    isSessionGuest(session) || Boolean(currentProject?.project?.is_guest);
  const isOwnerOrAdmin = authService.isOwnerOrAdmin();

  // `prefs` may carry a live preview from a customize dialog; the rail renders it as if saved.
  // Every item this user may see, hidden ones included, in the previewed order: the customize
  // dialog needs them to offer "show" again.
  const allItems = useMemo(
    () =>
      resolveNavState(surface, applyNavPreview(prefs, surfaceKey), isGuestUser, isOwnerOrAdmin, true).groups.flatMap(
        group => group.items
      ),
    [surface, surfaceKey, prefs, isGuestUser, isOwnerOrAdmin]
  );
  const hiddenKeys = useMemo(
    () => applyNavPreview(prefs, surfaceKey).hidden?.[surfaceKey] ?? [],
    [prefs, surfaceKey]
  );

  const resolved = useMemo(() => {
    const effective = resolveNavState(surface, applyNavPreview(prefs, surfaceKey), isGuestUser, isOwnerOrAdmin);
    if (!prefs.preview) return effective;
    // A preview must not change where the surface opens by default: that would navigate away from
    // the page the dialog is open on. Only the saved pin decides that.
    const saved = resolveNavState(surface, prefs, isGuestUser, isOwnerOrAdmin);
    return { ...effective, activeDefaultKey: saved.activeDefaultKey };
  }, [surface, surfaceKey, prefs, isGuestUser, isOwnerOrAdmin]);

  const toggleCollapsedHandler = useCallback(() => dispatch(toggleCollapsed()), [dispatch]);

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
    (itemKey: string) => applyNavPreview(prefs, surfaceKey).pinnedDefaults[surfaceKey] === itemKey,
    [prefs, surfaceKey]
  );

  return { surface, resolved, allItems, hiddenKeys, toggleCollapsed: toggleCollapsedHandler, pin, unpin, isPinned, reorder };
}
