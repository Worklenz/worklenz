import {
  OVERVIEW_WIDGET_KEYS,
  type OverviewLayout,
  type OverviewLayoutItem,
  type OverviewWidgetInstance,
  type OverviewWidgetKey,
} from '@/types/client-portal/v2/overview';

export const GRID_COLS = 12;

export interface OverviewWidgetMeta {
  key: OverviewWidgetKey;
  /** Default English title, also the i18n defaultValue. */
  defaultTitle: string;
  /** Default size on the 12-column grid. */
  size: { w: number; h: number };
  min: { w: number; h: number };
  hiddenByDefault?: boolean;
}

const KPI = { size: { w: 3, h: 3 }, min: { w: 2, h: 3 } };
const LIST = { size: { w: 6, h: 9 }, min: { w: 3, h: 4 } };
const CHART = { size: { w: 6, h: 8 }, min: { w: 3, h: 6 } };

/** Stat cards first, then lists and charts. Also the order widgets appear in "Add widget". */
export const WIDGETS: OverviewWidgetMeta[] = [
  { key: 'kpi_awaiting_approvals', defaultTitle: 'Pending approvals', ...KPI },
  { key: 'kpi_open_change_requests', defaultTitle: 'Change requests to review', ...KPI },
  { key: 'kpi_delayed_milestones', defaultTitle: 'Delayed milestones', ...KPI },
  { key: 'kpi_unread_discussions', defaultTitle: 'Unread discussions', ...KPI },
  { key: 'pending_approvals', defaultTitle: 'Pending approvals', ...LIST },
  { key: 'change_requests', defaultTitle: 'Change requests to review', ...LIST },
  { key: 'upcoming_milestones', defaultTitle: 'Upcoming milestones', ...LIST },
  { key: 'needs_attention', defaultTitle: 'Needs attention', ...LIST },
  { key: 'latest_discussions', defaultTitle: 'Latest discussions', ...LIST },
  { key: 'mentions_me', defaultTitle: 'Mentions of me', ...LIST },
  { key: 'approvals_by_status', defaultTitle: 'Approvals by status', ...CHART },
  { key: 'cr_by_status', defaultTitle: 'Change request pipeline', ...CHART },
  { key: 'kpi_overdue_invoices', defaultTitle: 'Overdue invoices', ...KPI, hiddenByDefault: true },
];

export const WIDGET_META = Object.fromEntries(WIDGETS.map(meta => [meta.key, meta])) as Record<
  OverviewWidgetKey,
  OverviewWidgetMeta
>;

/** Widths a user can pick for a widget (columns of the 12-column grid). */
export const WIDTH_OPTIONS = [3, 4, 6, 8, 9, 12];

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, Math.round(Number(value) || 0)));

/** Packs widgets left to right in the given order, wrapping to a new row when the next one does not fit. */
const pack = (items: Array<{ key: OverviewWidgetKey; w: number; h: number; hidden: boolean }>): OverviewWidgetInstance[] => {
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

const defaultInstance = (meta: OverviewWidgetMeta) => ({
  key: meta.key,
  w: meta.size.w,
  h: meta.size.h,
  hidden: Boolean(meta.hiddenByDefault),
});

export const defaultLayout = (): OverviewLayout => ({
  version: 1,
  widgets: pack(WIDGETS.map(defaultInstance)),
});

const isKnownKey = (key: unknown): key is OverviewWidgetKey =>
  (OVERVIEW_WIDGET_KEYS as readonly string[]).includes(key as string);

const LEGACY_SPAN = { s: 3, m: 6, l: 12 } as const;

/** Old saved shape: ordered {key,size,visible}[]. Size maps to width, order to packed position. */
const fromLegacy = (items: OverviewLayoutItem[]): OverviewWidgetInstance[] => {
  const seen = new Set<OverviewWidgetKey>();
  const packed: Array<{ key: OverviewWidgetKey; w: number; h: number; hidden: boolean }> = [];
  for (const item of items) {
    if (!item || !isKnownKey(item.key) || seen.has(item.key)) continue;
    seen.add(item.key);
    const meta = WIDGET_META[item.key];
    packed.push({
      key: item.key,
      w: Math.max(meta.min.w, LEGACY_SPAN[item.size] ?? meta.size.w),
      h: meta.size.h,
      hidden: !item.visible,
    });
  }
  return pack(packed);
};

/**
 * The layout to render. Unknown keys and duplicates are dropped, geometry is clamped to the grid and
 * a widget the saved layout predates is appended hidden, so a release never rearranges a page.
 * Accepts the legacy list shape. With nothing saved, the default layout.
 */
export const reconcileLayout = (saved: OverviewLayout | OverviewLayoutItem[] | null | undefined): OverviewLayout => {
  if (!saved) return defaultLayout();
  let source: OverviewWidgetInstance[];
  if (Array.isArray(saved)) source = fromLegacy(saved);
  else if (saved.version === 1 && Array.isArray(saved.widgets)) source = saved.widgets;
  else return defaultLayout();

  const seen = new Set<OverviewWidgetKey>();
  const widgets: OverviewWidgetInstance[] = [];
  for (const item of source) {
    if (!item || !isKnownKey(item.key) || seen.has(item.key)) continue;
    seen.add(item.key);
    const meta = WIDGET_META[item.key];
    const w = clamp(item.w, meta.min.w, GRID_COLS);
    widgets.push({
      key: item.key,
      x: clamp(item.x, 0, GRID_COLS - w),
      y: clamp(item.y, 0, 10_000),
      w,
      h: clamp(item.h, meta.min.h, 60),
      hidden: Boolean(item.hidden),
    });
  }
  const lastY = widgets.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  for (const meta of WIDGETS) {
    if (seen.has(meta.key)) continue;
    widgets.push({ key: meta.key, x: 0, y: lastY, w: meta.size.w, h: meta.size.h, hidden: true });
  }
  return { version: 1, widgets };
};

export const visibleKeys = (widgets: OverviewWidgetInstance[]): OverviewWidgetKey[] =>
  widgets.filter(item => !item.hidden).map(item => item.key);

/** Moves a widget one place earlier or later in reading order by swapping grid positions with its neighbour. */
export const moveWidget = (
  widgets: OverviewWidgetInstance[],
  key: OverviewWidgetKey,
  direction: -1 | 1
): OverviewWidgetInstance[] => {
  const visible = widgets.filter(item => !item.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
  const index = visible.findIndex(item => item.key === key);
  const other = visible[index + direction];
  if (index < 0 || !other) return widgets;
  const self = visible[index];
  return widgets.map(item => {
    if (item.key === self.key) return { ...item, x: other.x, y: other.y };
    if (item.key === other.key) return { ...item, x: self.x, y: self.y };
    return item;
  });
};

/** Applies the geometry react-grid-layout reports (keyed by widget key) to the draft. */
export const applyGeometry = (
  widgets: OverviewWidgetInstance[],
  items: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>
): OverviewWidgetInstance[] => {
  const byKey = new Map(items.map(item => [item.i, item]));
  let changed = false;
  const next = widgets.map(widget => {
    const item = byKey.get(widget.key);
    if (!item || widget.hidden) return widget;
    if (item.x === widget.x && item.y === widget.y && item.w === widget.w && item.h === widget.h) return widget;
    changed = true;
    return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
  });
  // Same array back when nothing moved, so the grid reporting its own layout never re-renders in a loop.
  return changed ? next : widgets;
};
