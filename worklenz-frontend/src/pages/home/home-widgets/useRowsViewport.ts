import { useLayoutEffect, useState, type RefObject } from 'react';

// How tall a scrolling list of rows may be on the Home overview: tall enough for VISIBLE_ROWS rows
// and no more, so a long list scrolls inside its card instead of stretching the card (and so adding
// another widget never changes it). Shared by the task tables and lists that follow that rule.

/** Rows shown without scrolling. */
export const VISIBLE_ROWS = 10;
/** Rows loaded in all: past these, "View all" goes to the full list. */
export const MAX_ROWS = 50;

interface RowsViewportOptions {
  /** Matches each row, inside the scrolling element. */
  rowSelector: string;
  /** Matches a header kept above the rows (a table head, a column heading), if there is one. */
  headerSelector?: string;
  /** Rows of room the area always keeps, however short the list. */
  minRows: number;
  fallbackRowHeight: number;
  fallbackHeaderHeight?: number;
}

export interface RowsViewportLimits {
  min: number;
  max: number;
}

/**
 * The `minHeight` / `maxHeight` for the scrolling element `ref` points at, measured from its own
 * rendered rows so they stay right whatever the row height is (it changes with the content and the
 * screen width). Undefined until measured. `rowCount` re-measures when the list changes.
 */
export const useRowsViewport = (
  ref: RefObject<HTMLElement | null>,
  rowCount: number,
  { rowSelector, headerSelector, minRows, fallbackRowHeight, fallbackHeaderHeight = 0 }: RowsViewportOptions
): RowsViewportLimits | undefined => {
  const [limits, setLimits] = useState<RowsViewportLimits>();

  useLayoutEffect(() => {
    const scroller = ref.current;
    if (!scroller) return;
    const measure = () => {
      const header = headerSelector
        ? scroller.querySelector(headerSelector)?.getBoundingClientRect().height || fallbackHeaderHeight
        : 0;
      const rows = Array.from(scroller.querySelectorAll(rowSelector)).slice(0, VISIBLE_ROWS);
      const rowHeight = rows.length
        ? rows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0) / rows.length
        : fallbackRowHeight;
      setLimits({
        min: Math.ceil(header + rowHeight * minRows),
        // A pixel more, so the last of the rows isn't cut by its own border.
        max: Math.ceil(header + rowHeight * VISIBLE_ROWS) + 1,
      });
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    const content = scroller.firstElementChild;
    if (content) observer.observe(content);
    return () => observer.disconnect();
  }, [ref, rowCount, rowSelector, headerSelector, minRows, fallbackRowHeight, fallbackHeaderHeight]);

  return limits;
};
