/**
 * Generic widget-grid layout model shared by every dashboard-style page (Reports > Overview,
 * Reporting & Analytics > Custom Dashboards, and any future one). Ported from worklenz-business's
 * client-portal-v2 overview grid (branch 2520-spec-user-client-portal-v2-overview), generalised so
 * it is not tied to one fixed widget catalogue or to "one instance per widget type".
 *
 * Two usage modes, both using the same functions:
 *  - Singleton (Reports > Overview): one instance per widget type, `id === type`. Widgets a user
 *    is not showing are kept in the layout as `hidden: true` rather than removed, so "Add widget"
 *    is just un-hiding one.
 *  - Multi-instance (Custom Dashboards): `id` is a generated id, several instances of the same
 *    `type` can coexist, and removing one deletes it rather than hiding it.
 */

export const GRID_COLS = 12;

/** A widget type's catalogue entry: its default/minimum size and i18n title. */
export interface WidgetDefinition<TType extends string = string> {
  type: TType;
  titleKey: string;
  defaultTitle: string;
  /** One-line "what is this" shown next to the title in the "Add widget" list. */
  descriptionKey?: string;
  defaultDescription?: string;
  /** Default size on the 12-column grid when first added. */
  size: { w: number; h: number };
  min: { w: number; h: number };
  /** Singleton-mode widgets kept out of the default layout until the user adds them. */
  hiddenByDefault?: boolean;
  /**
   * Lets this one widget type have several instances even on an otherwise-singleton page (e.g.
   * Reports > Overview's chart widgets, so the same chart can appear twice with different
   * filters/views). Ignored when the page is already in full `multiInstance` mode. A repeatable
   * type has no default instance: the user adds each one explicitly, so it's never part of the
   * default layout and is never auto-filled in as a hidden placeholder.
   */
  repeatable?: boolean;
}

/** One widget placed on the grid. */
export interface GridWidgetInstance<TType extends string = string, TConfig = unknown> {
  /** Stable identity: equal to `type` in singleton mode, a generated id in multi-instance mode. */
  id: string;
  type: TType;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  config?: TConfig;
}

export interface GridLayout<TType extends string = string, TConfig = unknown> {
  version: 1;
  widgets: GridWidgetInstance<TType, TConfig>[];
}

/** Widths a user can pick for a widget from the settings popover (columns of the 12-column grid). */
export const WIDTH_OPTIONS = [3, 4, 6, 8, 9, 12];

const clamp = (value: unknown, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(Number(value) || 0)));

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;

/** Packs instances left to right in the given order, wrapping to a new row when the next one does not fit. */
export const pack = <T extends { w: number; h: number; hidden: boolean }>(items: T[]): (T & { x: number; y: number })[] => {
  let x = 0;
  let y = 0;
  let rowHeight = 0;
  return items.map(item => {
    if (item.hidden) return { ...item, x: 0, y: 0 };
    if (x + item.w > GRID_COLS) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    const placed = { ...item, x, y };
    x += item.w;
    rowHeight = Math.max(rowHeight, item.h);
    return placed;
  });
};

/** The first free y at which a widget of width `w` can be placed starting at x=0, scanning top to bottom. */
const firstFreeSlot = (widgets: GridWidgetInstance[], w: number, h: number): { x: number; y: number } => {
  const visible = widgets.filter(item => !item.hidden);
  const bottom = visible.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  // Simple, predictable placement: always append after the lowest occupied row. Good enough for
  // "Add widget" / "Add gadget" — the user can drag it anywhere afterwards.
  void w;
  void h;
  return { x: 0, y: bottom };
};

export interface ReconcileOptions<TType extends string, TConfig = unknown> {
  widgets: WidgetDefinition<TType>[];
  /** True when a widget type is eligible to appear at all (e.g. a feature flag). Default: always true. */
  isEligible?: (type: TType) => boolean;
  /** Validates/normalises a widget's saved config; return undefined to drop an invalid config. */
  normalizeConfig?: (type: TType, config: unknown) => TConfig | undefined;
  /** Multi-instance mode: ids are opaque and several instances of one type may coexist. Default: singleton (id === type). */
  multiInstance?: boolean;
  /** Multi-instance mode only: maximum number of instances accepted from a saved layout. */
  maxInstances?: number;
}

const isWidgetType = <TType extends string>(defs: WidgetDefinition<TType>[], value: unknown): value is TType =>
  defs.some(def => def.type === value);

/**
 * Turns whatever was saved into a layout that is safe to render: unknown and ineligible widgets are
 * dropped, geometry is clamped to the grid, duplicates are ignored (singleton mode), and widgets
 * added to the product since the layout was saved appear hidden, so a release never rearranges a
 * dashboard. With nothing saved, builds the default layout from the widget catalogue.
 */
export function reconcileLayout<TType extends string, TConfig = unknown>(
  saved: GridLayout<TType, TConfig> | null | undefined,
  options: ReconcileOptions<TType, TConfig>
): GridLayout<TType, TConfig> {
  const { widgets: defs, isEligible = () => true, normalizeConfig, multiInstance = false, maxInstances = 100 } = options;

  const byType = new Map(defs.map(def => [def.type, def]));
  // Full multi-instance mode treats every type as repeatable; otherwise only types the catalogue
  // marks `repeatable` get multiple instances (e.g. Overview's chart widgets), everything else
  // stays singleton (`id === type`).
  const isRepeatable = (type: TType): boolean => multiInstance || Boolean(byType.get(type)?.repeatable);

  const defaultLayout = (): GridLayout<TType, TConfig> => ({
    version: 1,
    widgets: pack(
      defs
        .filter(def => isEligible(def.type) && !isRepeatable(def.type))
        .map(def => ({
          id: def.type,
          type: def.type,
          w: def.size.w,
          h: def.size.h,
          hidden: Boolean(def.hiddenByDefault),
        }))
    ) as GridWidgetInstance<TType, TConfig>[],
  });

  // Multi-instance mode has no catalogue-derived default: a dashboard with nothing saved is simply
  // empty (a brand new dashboard), not pre-populated with one of everything.
  if (!saved || saved.version !== 1 || !Array.isArray(saved.widgets)) {
    return multiInstance ? { version: 1, widgets: [] } : defaultLayout();
  }

  const seenTypes = new Set<TType>();
  const seenIds = new Set<string>();
  const instanceCountByType = new Map<TType, number>();
  const widgets: GridWidgetInstance<TType, TConfig>[] = [];

  for (const item of saved.widgets) {
    if (!item || typeof item !== 'object') continue;
    if (!isWidgetType(defs, item.type) || !isEligible(item.type)) continue;
    const repeatable = isRepeatable(item.type);
    if (!repeatable && seenTypes.has(item.type)) continue;
    const id = repeatable && typeof item.id === 'string' && item.id ? item.id : item.type;
    if (seenIds.has(id)) continue;
    if (repeatable && (instanceCountByType.get(item.type) ?? 0) >= maxInstances) continue;

    seenTypes.add(item.type);
    seenIds.add(id);
    if (repeatable) instanceCountByType.set(item.type, (instanceCountByType.get(item.type) ?? 0) + 1);
    const meta = byType.get(item.type)!;
    const w = clamp(item.w, meta.min.w, GRID_COLS);
    const config = normalizeConfig ? normalizeConfig(item.type, item.config) : (item.config as TConfig | undefined);
    widgets.push({
      id,
      type: item.type,
      x: clamp(item.x, 0, GRID_COLS - w),
      y: clamp(item.y, 0, 10_000),
      w,
      h: clamp(item.h, meta.min.h, 60),
      hidden: Boolean(item.hidden),
      ...(config !== undefined ? { config } : {}),
    });
  }

  if (!multiInstance) {
    // Singleton (non-repeatable) types only: a widget released since this layout was saved is
    // appended hidden so it never rearranges what the user already has, but still becomes
    // available from "Add widget". Repeatable types have no such placeholder: the user adds them.
    const lastY = widgets.reduce((max, item) => Math.max(max, item.y + item.h), 0);
    for (const def of defs) {
      if (isRepeatable(def.type) || seenTypes.has(def.type) || !isEligible(def.type)) continue;
      widgets.push({ id: def.type, type: def.type, x: 0, y: lastY, w: def.size.w, h: def.size.h, hidden: true });
    }
  }

  return { version: 1, widgets };
}

export const visibleWidgets = <TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[]
): GridWidgetInstance<TType, TConfig>[] => widgets.filter(item => !item.hidden);

/** Moves a widget one place earlier or later in reading order by swapping grid positions with its neighbour. */
export function moveWidget<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  id: string,
  direction: -1 | 1
): GridWidgetInstance<TType, TConfig>[] {
  const visible = widgets.filter(item => !item.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
  const index = visible.findIndex(item => item.id === id);
  const other = visible[index + direction];
  if (index < 0 || !other) return widgets;
  const self = visible[index];
  return widgets.map(item => {
    if (item.id === self.id) return { ...item, x: other.x, y: other.y };
    if (item.id === other.id) return { ...item, x: self.x, y: self.y };
    return item;
  });
}

/** Applies the geometry react-grid-layout reports (keyed by widget id) to the draft. */
export function applyGeometry<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  items: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>
): GridWidgetInstance<TType, TConfig>[] {
  const byId = new Map(items.map(item => [item.i, item]));
  let changed = false;
  const next = widgets.map(widget => {
    const item = byId.get(widget.id);
    if (!item || widget.hidden) return widget;
    if (item.x === widget.x && item.y === widget.y && item.w === widget.w && item.h === widget.h) return widget;
    changed = true;
    return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
  });
  // Same array back when nothing moved, so the grid reporting its own layout never re-renders in a loop.
  return changed ? next : widgets;
}

/** Singleton mode: un-hides a widget and places it after the lowest occupied row. */
export function showWidget<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  type: TType,
  def: WidgetDefinition<TType>
): GridWidgetInstance<TType, TConfig>[] {
  const slot = firstFreeSlot(widgets, def.size.w, def.size.h);
  return widgets.map(item =>
    item.type === type ? { ...item, hidden: false, x: slot.x, y: slot.y, w: def.size.w, h: def.size.h } : item
  );
}

export function hideWidget<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  id: string
): GridWidgetInstance<TType, TConfig>[] {
  return widgets.map(item => (item.id === id ? { ...item, hidden: true } : item));
}

/** Multi-instance mode: adds a new instance of `type` after the lowest occupied row. */
export function addInstance<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  type: TType,
  def: WidgetDefinition<TType>,
  config?: TConfig
): { widgets: GridWidgetInstance<TType, TConfig>[]; id: string } {
  const id = `${type}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
  const slot = firstFreeSlot(widgets, def.size.w, def.size.h);
  const instance: GridWidgetInstance<TType, TConfig> = {
    id,
    type,
    x: slot.x,
    y: slot.y,
    w: def.size.w,
    h: def.size.h,
    hidden: false,
    ...(config !== undefined ? { config } : {}),
  };
  return { widgets: [...widgets, instance], id };
}

/** Multi-instance mode: permanently removes an instance. */
export function removeInstance<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  id: string
): GridWidgetInstance<TType, TConfig>[] {
  return widgets.filter(item => item.id !== id);
}

export function resizeWidget<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  id: string,
  size: Partial<{ w: number; h: number }>,
  min: { w: number; h: number }
): GridWidgetInstance<TType, TConfig>[] {
  return widgets.map(item => {
    if (item.id !== id) return item;
    const w = Math.max(min.w, Math.min(GRID_COLS, size.w ?? item.w));
    return { ...item, w, x: Math.min(item.x, GRID_COLS - w), h: Math.max(min.h, size.h ?? item.h) };
  });
}

export function updateConfig<TType extends string, TConfig>(
  widgets: GridWidgetInstance<TType, TConfig>[],
  id: string,
  patch: (config: TConfig | undefined) => TConfig
): GridWidgetInstance<TType, TConfig>[] {
  return widgets.map(item => (item.id === id ? { ...item, config: patch(item.config) } : item));
}

/** A rectangular region of free grid cells, offered to the user as an "Add widget" tile. */
export interface EmptyGridSlot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Finds the empty rectangular gaps left in an otherwise-packed grid (e.g. a row where a widget
 * didn't fill the full width), plus one placeholder appended right after the lowest occupied row,
 * so there is always a visible, click-to-add tile even when the existing rows have no gaps.
 * Gaps smaller than 2x2 cells are skipped as too small to usefully hold a widget.
 */
export function computeEmptySlots(
  occupied: ReadonlyArray<{ x: number; y: number; w: number; h: number }>,
  cols = GRID_COLS,
  bottomSlot: { w: number; h: number } = { w: 4, h: 6 }
): EmptyGridSlot[] {
  const maxY = occupied.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  const slots: EmptyGridSlot[] = [];

  if (maxY > 0) {
    const grid: boolean[][] = Array.from({ length: maxY }, () => new Array(cols).fill(false));
    for (const item of occupied) {
      for (let y = item.y; y < item.y + item.h && y < maxY; y++) {
        for (let x = item.x; x < item.x + item.w && x < cols; x++) {
          grid[y][x] = true;
        }
      }
    }

    for (let y = 0; y < maxY; y++) {
      for (let x = 0; x < cols; x++) {
        if (grid[y][x]) continue;

        let w = 1;
        while (x + w < cols && !grid[y][x + w]) w++;

        let h = 1;
        rowScan: while (y + h < maxY) {
          for (let xi = x; xi < x + w; xi++) {
            if (grid[y + h][xi]) break rowScan;
          }
          h++;
        }

        for (let yi = y; yi < y + h; yi++) {
          for (let xi = x; xi < x + w; xi++) {
            grid[yi][xi] = true;
          }
        }

        if (w >= 2 && h >= 2) {
          slots.push({ id: `empty-slot-${y}-${x}`, x, y, w, h });
        }
      }
    }
  }

  slots.push({ id: 'add-widget-slot', x: 0, y: maxY, w: Math.min(bottomSlot.w, cols), h: bottomSlot.h });
  return slots;
}

/** Server-side-shaped validation of a geometry triple, shared with backend validators' expectations (see docs). */
export const isValidGeometry = (x: unknown, y: unknown, w: unknown, h: unknown, cols = GRID_COLS, maxRow = 10_000, maxH = 60): boolean =>
  isIntegerInRange(w, 1, cols) && isIntegerInRange(x, 0, cols - 1) && (x as number) + (w as number) <= cols && isIntegerInRange(y, 0, maxRow) && isIntegerInRange(h, 1, maxH);
