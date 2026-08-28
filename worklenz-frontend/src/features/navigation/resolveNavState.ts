import type { NavGroup, NavSurface, ResolvedNavState } from './nav-registry.types';
import type { NavPreferencesState } from './navPreferences.slice';

// Merges a static registry entry with a user's saved preferences. Per build
// spec §8/§11: saved order/pins are overrides only — a stale key (removed
// from the registry since it was saved) is silently dropped, and a registry
// item with no saved order entry is appended at the end of its group.
export function resolveNavState(
  surface: NavSurface, 
  prefs: NavPreferencesState,
  isGuestUser?: boolean
): ResolvedNavState {
  const savedOrderForSurface = prefs.order[surface.key] || {};

  const groups: NavGroup[] = surface.groups.map(group => {
    // Filter out guest-excluded items if user is a guest
    const filteredItems = isGuestUser 
      ? group.items.filter(item => !item.guestExcluded)
      : group.items;

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

  const pinned = prefs.pinnedDefaults[surface.key];
  const pinnedStillExists = !!pinned && groups.some(group => group.items.some(item => item.key === pinned));

  return {
    groups,
    activeDefaultKey: pinnedStillExists ? (pinned as string) : surface.defaultItemKey,
    collapsed: prefs.collapsed,
  };
}
