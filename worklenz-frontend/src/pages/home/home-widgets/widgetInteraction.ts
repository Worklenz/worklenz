// Pure helpers behind dragging Home widgets around (no React, no dnd-kit): which parts of a widget
// start a drag, and where a dragged widget would land.
//
// A widget is draggable from its header and its whitespace, but not from the data it shows: the
// numbers, the task rows, the buttons. Pressing on those must keep working as a click, so they are
// excluded from the drag surface.

import { isHomeWidgetId, type HomeColumn, type HomeSectionId, type HomeWidgetId } from '../home-layout/homeLayout';

/** Put this attribute on any element that shows data or values; it never starts a drag. */
export const WIDGET_DATA_ATTRIBUTE = 'data-widget-data';
/** Set on a row of the "Add widget" menu that can be dragged onto the page. */
export const WIDGET_DRAG_SOURCE_ATTRIBUTE = 'data-home-widget-drag-source';
/** Set on a widget's outer element; its value is the widget id. */
export const WIDGET_ID_ATTRIBUTE = 'data-home-widget-id';
/** Set on a column's element; its value is the column name. */
export const WIDGET_COLUMN_ATTRIBUTE = 'data-home-column';

/** Everything that is data or can be interacted with. The attribute marks widget-specific data; the rest is a safety net. */
const DATA_SELECTOR = [
  `[${WIDGET_DATA_ATTRIBUTE}]`,
  'a[href]',
  'button',
  'input',
  'textarea',
  'select',
  'label',
  'summary',
  '[contenteditable]:not([contenteditable="false"])',
  '[role="button"]',
  '[role="link"]',
  '[role="tab"]',
  '[role="menuitem"]',
  '[role="option"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="switch"]',
  '[role="slider"]',
  '[role="combobox"]',
  '[role="row"]',
].join(',');

/** True when `target` is, or sits inside, data or an interactive control. */
export const isWidgetDataTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(DATA_SELECTOR) !== null;

/**
 * True when `target` is inside a widget and is part of its drag surface (header or whitespace).
 * Anything rendered outside the widget's own DOM, such as a dropdown or tooltip portalled to the
 * body, is not.
 */
export const isWidgetSurfaceTarget = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  target.closest(`[${WIDGET_ID_ATTRIBUTE}]`) !== null &&
  !isWidgetDataTarget(target);

/** True when `target` is, or sits inside, a row of the "Add widget" menu that can be dragged out. */
export const isWidgetDragSourceTarget = (target: EventTarget | null): boolean =>
  target instanceof Element && target.closest(`[${WIDGET_DRAG_SOURCE_ATTRIBUTE}]`) !== null;

/** Where a drag started: a widget already on the page, or a row of the "Add widget" menu. */
export type DragSource = 'board' | 'menu';

// A widget on the page is dragged by its own id; a menu row gets a prefixed one, so the two can
// never be confused even though a widget is only ever in one of those places at a time.
const MENU_DRAG_ID_PREFIX = 'add:';

export const toMenuDragId = (id: HomeSectionId): string => `${MENU_DRAG_ID_PREFIX}${id}`;

/** Reads a drag id back into the widget it stands for and where it came from; null if it is neither. */
export const parseDragId = (dragId: string | number): { widgetId: HomeWidgetId; source: DragSource } | null => {
  const raw = String(dragId);
  const source: DragSource = raw.startsWith(MENU_DRAG_ID_PREFIX) ? 'menu' : 'board';
  const widgetId = source === 'menu' ? raw.slice(MENU_DRAG_ID_PREFIX.length) : raw;
  return isHomeWidgetId(widgetId) ? { widgetId, source } : null;
};

export interface RectLike {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface MeasuredColumn {
  column: HomeColumn;
  rect: RectLike;
  /** The widgets currently shown in the column, top to bottom. */
  widgets: ReadonlyArray<{ id: HomeWidgetId; rect: RectLike }>;
}

export interface DropTarget {
  column: HomeColumn;
  /** The widget to land next to, or null to land at the end of the column. */
  targetId: HomeWidgetId | null;
  position: 'before' | 'after';
}

/** How far outside a column the pointer may be and still count as over it; covers the gap between columns. */
const COLUMN_SNAP_DISTANCE = 48;

const distanceToRange = (value: number, min: number, max: number): number =>
  value < min ? min - value : value > max ? value - max : 0;

/**
 * Works out where a dragged widget would land for a pointer position. The column is the one the
 * pointer is over (or nearest to); inside it the widget lands before or after the widget under the
 * pointer depending on which half of that widget the pointer is in. The dragged widget itself is
 * never a target. Returns null when the pointer is nowhere near a column the widget may sit in.
 */
export const resolveDropTarget = (
  pointer: { x: number; y: number },
  columns: readonly MeasuredColumn[],
  activeId: HomeWidgetId,
  allowedColumns: readonly HomeColumn[]
): DropTarget | null => {
  let nearest: MeasuredColumn | null = null;
  let nearestDistance = Infinity;
  for (const column of columns) {
    const distance = distanceToRange(pointer.x, column.rect.left, column.rect.right);
    if (distance < nearestDistance) {
      nearest = column;
      nearestDistance = distance;
    }
  }
  if (!nearest || nearestDistance > COLUMN_SNAP_DISTANCE) return null;
  if (!allowedColumns.includes(nearest.column)) return null;

  const candidates = nearest.widgets.filter(widget => widget.id !== activeId);
  if (candidates.length === 0) return { column: nearest.column, targetId: null, position: 'after' };

  let closest = candidates[0];
  let closestDistance = Infinity;
  for (const candidate of candidates) {
    const distance = distanceToRange(pointer.y, candidate.rect.top, candidate.rect.bottom);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  const middle = (closest.rect.top + closest.rect.bottom) / 2;
  return { column: nearest.column, targetId: closest.id, position: pointer.y < middle ? 'before' : 'after' };
};
