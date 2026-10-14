// Pure model for the Home page's left sidebar as edited in the Customize dialog: the order of its
// items, which ones are shown, and which one (if any) is pinned as the page Home opens on. The
// sidebar itself and its saved preferences live in features/navigation; this only edits a draft.

export interface HomeSidebarDraft {
  /** Every item key, shown or hidden, in display order. */
  order: string[];
  /** Keys of the items hidden from the sidebar. */
  hidden: string[];
  /** The item Home opens on, or null for the sidebar's default page. */
  pinned: string | null;
}

export const moveSidebarItem = (
  draft: HomeSidebarDraft,
  key: string,
  index: number
): HomeSidebarDraft => {
  if (!draft.order.includes(key)) return draft;
  const order = draft.order.filter(k => k !== key);
  order.splice(Math.max(0, Math.min(index, order.length)), 0, key);
  return { ...draft, order };
};

/** Shifts an item one step up (-1) or down (+1), stopping at the ends. */
export const shiftSidebarItem = (
  draft: HomeSidebarDraft,
  key: string,
  delta: -1 | 1
): HomeSidebarDraft => {
  const target = draft.order.indexOf(key) + delta;
  if (target < 0 || target >= draft.order.length) return draft;
  return moveSidebarItem(draft, key, target);
};

/** The page Home opens on: the pinned item, else the sidebar's default page. */
export const getLandingKey = (draft: HomeSidebarDraft, defaultKey: string): string =>
  draft.pinned ?? defaultKey;

/**
 * An item can be hidden unless it is the page Home opens on (pin another page first) or it is the
 * last one still shown.
 */
export const canHideSidebarItem = (
  draft: HomeSidebarDraft,
  key: string,
  defaultKey: string
): boolean =>
  key !== getLandingKey(draft, defaultKey) &&
  draft.order.some(k => k !== key && !draft.hidden.includes(k));

export const setSidebarItemHidden = (
  draft: HomeSidebarDraft,
  key: string,
  hidden: boolean,
  defaultKey: string
): HomeSidebarDraft => {
  if (!draft.order.includes(key) || draft.hidden.includes(key) === hidden) return draft;
  if (hidden && !canHideSidebarItem(draft, key, defaultKey)) return draft;
  return {
    ...draft,
    hidden: hidden ? [...draft.hidden, key] : draft.hidden.filter(k => k !== key),
  };
};

/**
 * Pins an item, replacing any other pin; pinning the pinned item unpins it. A hidden item becomes
 * shown when pinned, because the page Home opens on has to be in the sidebar.
 */
export const togglePinnedSidebarItem = (draft: HomeSidebarDraft, key: string): HomeSidebarDraft => {
  if (!draft.order.includes(key)) return draft;
  if (draft.pinned === key) return { ...draft, pinned: null };
  return { ...draft, pinned: key, hidden: draft.hidden.filter(k => k !== key) };
};

export const isSameSidebarDraft = (a: HomeSidebarDraft, b: HomeSidebarDraft): boolean =>
  a.pinned === b.pinned &&
  a.order.length === b.order.length &&
  a.order.every((k, i) => k === b.order[i]) &&
  a.hidden.length === b.hidden.length &&
  [...a.hidden].sort().every((k, i) => k === [...b.hidden].sort()[i]);
