import type { AddonSlotItem, AddonSlots } from './addon-types';
import { addonSlots } from 'virtual:addons-registry';

/**
 * Returns all registered addon slot items for a given extension point,
 * sorted by their `order` property (ascending).
 */
export function getAddonSlotItems<K extends keyof AddonSlots>(
  slotName: K
): AddonSlotItem[] {
  const items = (addonSlots as AddonSlots)[slotName] || [];
  return [...items].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
}
