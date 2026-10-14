import { useLayoutEffect, useState, type RefObject } from 'react';

const getScrollParent = (element: HTMLElement): HTMLElement | null => {
  for (let parent = element.parentElement; parent; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
  }
  return null;
};

/**
 * The room left on the page for the board: from the top of `ref` down to the bottom of its scroll
 * container, less that container's bottom padding. The columns use it as their minimum height, so
 * a column with little in it still reaches the bottom of the page, while a column with a lot in it
 * simply grows and the page scrolls (with its bottom padding intact).
 *
 * Returns undefined until measured, or when `isEnabled` is false.
 */
export const useBoardFillHeight = (ref: RefObject<HTMLElement | null>, isEnabled: boolean): number | undefined => {
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const board = ref.current;
    const scroller = board && isEnabled ? getScrollParent(board) : null;
    if (!board || !scroller) {
      setHeight(undefined);
      return;
    }

    const measure = () => {
      // Where the board starts inside the scroll container's content, whatever it is scrolled to.
      const top = board.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
      const paddingBottom = parseFloat(getComputedStyle(scroller).paddingBottom) || 0;
      setHeight(Math.max(0, Math.floor(scroller.clientHeight - top - paddingBottom)));
    };
    measure();

    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    // Anything above the board that changes height (the greeting, the toolbar) moves it down.
    for (let sibling = board.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      observer.observe(sibling);
    }
    return () => observer.disconnect();
  }, [ref, isEnabled]);

  return height;
};
