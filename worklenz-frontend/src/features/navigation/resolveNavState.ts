import type { NavGroup, NavSurface, ResolvedNavState } from './nav-registry.types';
import type { NavPreferencesState } from './navPreferences.slice';

// Merges a static registry entry with a user's saved preferences. Per build
// spec §8/§11: saved order/pins are overrides only — a stale key (removed
// from the registry since it was saved) is silently dropped, and a registry
// item with no saved order entry is appended at the end of its group.
export function resolveNavState(
  surface: NavSurface,
  prefs: NavPreferencesState,
  isGuestUser?: boolean,
  isOwnerOrAdmin?: boolean,
  // The customize dialog lists hidden items too, so it can show them again.
  includeHidden = false
): ResolvedNavState {
  const savedOrderForSurface = prefs.order[surface.key] || {};

  const groups: NavGroup[] = surface.groups.map(group => {
    // Filter out role-restricted items before applying saved order/pins
    const filteredItems = group.items.filter(item => {
      if (isGuestUser && item.guestExcluded) return false;
      if (item.adminOnly && !isOwnerOrAdmin) return false;
      return true;
    });

    const savedOrder = savedOrderForSurface[group.key];
    if (!savedOrder || savedOrder.length === 0) return { ...group, items: filteredItems };

    const remaining = new Map(filteredItems.map(item => [item.key, item]));
    const ordered = [];
    for (const key of savedOrder) {
      const item = remaining.get(key);
      if (item) {
        ordered.push(item);
        remaining.delete(key);
      }
    }
    // Anything left in `remaining` is a registry item with no saved position
    // (newly added since the user last reordered) — append in registry order.
    for (const item of filteredItems) {
      if (remaining.has(item.key)) ordered.push(item);
    }

    return { ...group, items: ordered };
  });

  // Hidden items are dropped last, so they keep their place in the saved order. A saved list that
  // would hide everything is ignored rather than leaving an empty rail.
  const hiddenKeys = new Set(includeHidden ? [] : (prefs.hidden?.[surface.key] ?? []));
  const visibleGroups = groups.map(group => ({
    ...group,
    items: group.items.filter(item => !hiddenKeys.has(item.key)),
  }));
  const shownGroups = visibleGroups.some(group => group.items.length > 0) ? visibleGroups : groups;
  const shownKeys = shownGroups.flatMap(group => group.items.map(item => item.key));

  const pinned = prefs.pinnedDefaults[surface.key];
  const pinnedStillExists = !!pinned && shownKeys.includes(pinned);
  // The surface's own default page may itself be hidden; open the first item still shown instead.
  const fallbackKey = shownKeys.includes(surface.defaultItemKey)
    ? surface.defaultItemKey
    : (shownKeys[0] ?? surface.defaultItemKey);

  return {
    groups: shownGroups,
    activeDefaultKey: pinnedStillExists ? (pinned as string) : fallbackKey,
    collapsed: prefs.collapsed,
  };
}
