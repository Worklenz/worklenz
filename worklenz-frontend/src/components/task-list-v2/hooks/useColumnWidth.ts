import { useCallback, useSyncExternalStore } from 'react';

interface ColumnWidthEntry {
  width: number;
  cssWidth: string;
  needsMeasurement: boolean;
  listeners: Set<() => void>;
}

const DEFAULT_COLUMN_WIDTH = 160;
const columnWidths = new Map<string, ColumnWidthEntry>();
let observer: MutationObserver | null = null;
let frame: number | null = null;
let subscriberCount = 0;

/**
 * All visible label cells share one root-style observer and one width snapshot
 * per column. Reading inline pixel widths avoids forcing computed style/layout
 * once per row during mounting and resizing.
 */
export const useColumnWidth = (columnId: string, isEnabled = true): number => {
  const subscribe = useCallback(
    (listener: () => void) => {
      if (!isEnabled) return () => {};
      const entry = getEntry(columnId);
      entry.listeners.add(listener);
      subscriberCount++;
      if (!observer) {
        observer = new MutationObserver(scheduleWidthUpdate);
        observer.observe(document.documentElement, {
          attributes: true,
          attributeFilter: ['style'],
        });
      }
      // Catch width changes committed between rendering and subscribing.
      updateWidths();
      return () => {
        entry.listeners.delete(listener);
        subscriberCount--;
        if (entry.listeners.size === 0) columnWidths.delete(columnId);
        if (subscriberCount === 0) {
          observer?.disconnect();
          observer = null;
          if (frame !== null) cancelAnimationFrame(frame);
          frame = null;
          columnWidths.clear();
        }
      };
    },
    [columnId, isEnabled]
  );
  const getSnapshot = useCallback(
    () => (isEnabled ? getEntry(columnId).width : DEFAULT_COLUMN_WIDTH),
    [columnId, isEnabled]
  );
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_COLUMN_WIDTH);
};

function getEntry(columnId: string): ColumnWidthEntry {
  let entry = columnWidths.get(columnId);
  if (!entry) {
    const cssWidth = readCssWidth(columnId);
    const needsMeasurement = Boolean(cssWidth) && !isPixelWidth(cssWidth);
    entry = {
      width: needsMeasurement ? DEFAULT_COLUMN_WIDTH : parseCssWidth(cssWidth),
      cssWidth,
      needsMeasurement,
      listeners: new Set(),
    };
    columnWidths.set(columnId, entry);
  }
  return entry;
}

function scheduleWidthUpdate() {
  if (frame === null)
    frame = requestAnimationFrame(() => {
      frame = null;
      updateWidths();
    });
}

function updateWidths() {
  columnWidths.forEach((entry, columnId) => {
    const cssWidth = readCssWidth(columnId);
    if (entry.cssWidth === cssWidth && !entry.needsMeasurement) return;
    entry.cssWidth = cssWidth;
    entry.needsMeasurement = false;
    const width = parseCssWidth(cssWidth);
    if (entry.width === width) return;
    entry.width = width;
    entry.listeners.forEach(listener => listener());
  });
}

function readCssWidth(columnId: string): string {
  const property = `--col-width-${columnId}`;
  // The table and its resize handlers publish pixel widths inline on the root.
  return (
    document.documentElement.style.getPropertyValue(property).trim() ||
    getComputedStyle(document.documentElement).getPropertyValue(property).trim()
  );
}

function parseCssWidth(cssWidth: string): number {
  if (!cssWidth) return DEFAULT_COLUMN_WIDTH;
  if (isPixelWidth(cssWidth)) return parseFloat(cssWidth) || DEFAULT_COLUMN_WIDTH;

  // Retain support for widths supplied in other CSS units. This measurement is
  // shared by the column, so it is never repeated for every visible task row.
  const element = document.createElement('div');
  element.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  element.style.width = cssWidth;
  document.body.appendChild(element);
  const width = element.offsetWidth;
  element.remove();
  return width || DEFAULT_COLUMN_WIDTH;
}

function isPixelWidth(cssWidth: string): boolean {
  return /^\d+(\.\d+)?px$/.test(cssWidth);
}
