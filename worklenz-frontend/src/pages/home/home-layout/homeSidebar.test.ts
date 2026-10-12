import { describe, expect, it } from 'vitest';
import {
  canHideSidebarItem,
  isSameSidebarDraft,
  moveSidebarItem,
  setSidebarItemHidden,
  shiftSidebarItem,
  togglePinnedSidebarItem,
  type HomeSidebarDraft,
} from './homeSidebar';

const draft: HomeSidebarDraft = { order: ['a', 'b', 'c'], hidden: [], pinned: null };
const DEFAULT_KEY = 'a';

describe('home sidebar draft', () => {
  it('moves an item to an index and clamps it', () => {
    expect(moveSidebarItem(draft, 'c', 0).order).toEqual(['c', 'a', 'b']);
    expect(moveSidebarItem(draft, 'a', 99).order).toEqual(['b', 'c', 'a']);
    expect(moveSidebarItem(draft, 'zzz', 0)).toBe(draft);
  });

  it('shifts one step and stops at the ends', () => {
    expect(shiftSidebarItem(draft, 'b', -1).order).toEqual(['b', 'a', 'c']);
    expect(shiftSidebarItem(draft, 'a', -1)).toBe(draft);
    expect(shiftSidebarItem(draft, 'c', 1)).toBe(draft);
  });

  it('pins one item at a time and unpins on a second toggle', () => {
    const pinnedB = togglePinnedSidebarItem(draft, 'b');
    expect(pinnedB.pinned).toBe('b');
    expect(togglePinnedSidebarItem(pinnedB, 'c').pinned).toBe('c');
    expect(togglePinnedSidebarItem(pinnedB, 'b').pinned).toBeNull();
    expect(togglePinnedSidebarItem(draft, 'zzz')).toBe(draft);
  });

  it('compares drafts by order, hidden items and pin', () => {
    expect(isSameSidebarDraft(draft, { ...draft })).toBe(true);
    expect(isSameSidebarDraft(draft, { ...draft, order: ['b', 'a', 'c'] })).toBe(false);
    expect(isSameSidebarDraft(draft, { ...draft, pinned: 'a' })).toBe(false);
    expect(isSameSidebarDraft(draft, { ...draft, hidden: ['b'] })).toBe(false);
    expect(
      isSameSidebarDraft({ ...draft, hidden: ['b', 'c'] }, { ...draft, hidden: ['c', 'b'] })
    ).toBe(true);
  });
});

describe('hiding sidebar items', () => {
  it('hides and shows an item without losing its place', () => {
    const hidden = setSidebarItemHidden(draft, 'b', true, DEFAULT_KEY);
    expect(hidden.hidden).toEqual(['b']);
    expect(hidden.order).toEqual(['a', 'b', 'c']);
    expect(setSidebarItemHidden(hidden, 'b', false, DEFAULT_KEY)).toEqual(draft);
  });

  it('will not hide the page Home opens on: the default page, or the pinned one', () => {
    expect(canHideSidebarItem(draft, 'a', DEFAULT_KEY)).toBe(false);
    expect(setSidebarItemHidden(draft, 'a', true, DEFAULT_KEY)).toBe(draft);

    const pinnedC = { ...draft, pinned: 'c' };
    expect(canHideSidebarItem(pinnedC, 'c', DEFAULT_KEY)).toBe(false);
    // With another page pinned, the default page may be hidden.
    expect(canHideSidebarItem(pinnedC, 'a', DEFAULT_KEY)).toBe(true);
  });

  it('will not hide the last item still shown', () => {
    const onlyAAndB = { ...draft, hidden: ['c'], pinned: 'b' };
    expect(canHideSidebarItem(onlyAAndB, 'a', DEFAULT_KEY)).toBe(true);
    const onlyB = { ...draft, hidden: ['a', 'c'], pinned: 'b' };
    expect(canHideSidebarItem(onlyB, 'b', DEFAULT_KEY)).toBe(false);
  });

  it('shows a hidden item again when it is pinned', () => {
    const hidden = { ...draft, hidden: ['c'] };
    const pinned = togglePinnedSidebarItem(hidden, 'c');
    expect(pinned.pinned).toBe('c');
    expect(pinned.hidden).toEqual([]);
  });
});
