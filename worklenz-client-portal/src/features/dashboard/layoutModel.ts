import type { DashboardLayoutV2, DashboardWidgetInstance, DashboardWidgetType, ProjectCardField, ProjectsWidgetSettings } from '@/types/v2';

export const GRID_COLS = 12;
export const MAX_WIDGETS = 30;

export interface WidgetMeta {
  type: DashboardWidgetType;
  titleKey: string;
  defaultTitle: string;
  /** Default size on the 12-column grid. */
  size: { w: number; h: number };
  min: { w: number; h: number };
  /** Needs the operator's Invoices switch. */
  needsInvoices?: boolean;
}

export interface LayoutContext {
  /** Invoices turned on by the operator and an amount present in the dashboard payload. */
  invoicesVisible: boolean;
}

export const WIDGETS: WidgetMeta[] = [
  { type: 'tile-active-projects', titleKey: 'dashboard.activeProjectsTile', defaultTitle: 'Active projects', size: { w: 3, h: 3 }, min: { w: 2, h: 3 } },
  { type: 'tile-pending-actions', titleKey: 'dashboard.pendingActions', defaultTitle: 'Pending actions', size: { w: 3, h: 3 }, min: { w: 2, h: 3 } },
  { type: 'tile-upcoming-milestones', titleKey: 'dashboard.upcomingMilestonesTile', defaultTitle: 'Upcoming milestones (count)', size: { w: 3, h: 3 }, min: { w: 2, h: 3 } },
  { type: 'tile-unpaid', titleKey: 'dashboard.unpaidTile', defaultTitle: 'Unpaid amount', size: { w: 3, h: 3 }, min: { w: 2, h: 3 }, needsInvoices: true },
  { type: 'needs-action', titleKey: 'dashboard.needsAction', defaultTitle: 'Needs your action', size: { w: 6, h: 9 }, min: { w: 3, h: 4 } },
  { type: 'upcoming-milestones', titleKey: 'dashboard.upcomingMilestones', defaultTitle: 'Upcoming milestones', size: { w: 6, h: 9 }, min: { w: 3, h: 4 } },
  { type: 'projects', titleKey: 'dashboard.yourProjects', defaultTitle: 'Your projects', size: { w: 12, h: 11 }, min: { w: 3, h: 5 } },
  { type: 'recent-activity', titleKey: 'dashboard.recentActivity', defaultTitle: 'Recent activity', size: { w: 12, h: 8 }, min: { w: 3, h: 4 } },
  { type: 'chart-projects-by-status', titleKey: 'dashboard.widgets.projectsByStatus', defaultTitle: 'Projects by status', size: { w: 4, h: 8 }, min: { w: 3, h: 6 } },
  { type: 'chart-project-progress', titleKey: 'dashboard.widgets.projectProgress', defaultTitle: 'Project progress', size: { w: 4, h: 8 }, min: { w: 3, h: 6 } },
  { type: 'chart-open-items', titleKey: 'dashboard.widgets.openItems', defaultTitle: 'Open items by project', size: { w: 4, h: 8 }, min: { w: 3, h: 6 } },
];

export const WIDGET_META: Record<DashboardWidgetType, WidgetMeta> = Object.fromEntries(WIDGETS.map(meta => [meta.type, meta])) as Record<
  DashboardWidgetType,
  WidgetMeta
>;

export const ALL_CARD_FIELDS: ProjectCardField[] = ['status', 'progress', 'phase', 'nextMilestone', 'expectedCompletion', 'openItems', 'sharedCounts'];

export const DEFAULT_PROJECTS_SETTINGS: ProjectsWidgetSettings = {
  projectIds: 'all',
  cardFields: ['status', 'progress', 'phase', 'nextMilestone', 'expectedCompletion'],
  view: 'cards',
};

/** Widths a user can pick for a widget (columns of the 12-column grid). */
export const WIDTH_OPTIONS = [3, 4, 6, 8, 9, 12];

export const isEligible = (type: DashboardWidgetType, ctx: LayoutContext): boolean => !WIDGET_META[type].needsInvoices || ctx.invoicesVisible;

const place = (type: DashboardWidgetType, x: number, y: number, override: Partial<{ w: number; h: number }> = {}): DashboardWidgetInstance => ({
  type,
  x,
  y,
  w: override.w ?? WIDGET_META[type].size.w,
  h: override.h ?? WIDGET_META[type].size.h,
  hidden: false,
});

/** Today's dashboard: tiles, the two action cards, projects, then activity. Charts start hidden. */
export const defaultLayout = (ctx: LayoutContext): DashboardLayoutV2 => {
  const tiles: DashboardWidgetType[] = ['tile-active-projects', 'tile-pending-actions', 'tile-upcoming-milestones'];
  if (ctx.invoicesVisible) tiles.push('tile-unpaid');
  const tileW = GRID_COLS / tiles.length;
  const widgets: DashboardWidgetInstance[] = [
    ...tiles.map((type, index) => place(type, index * tileW, 0, { w: tileW })),
    place('needs-action', 0, 3),
    place('upcoming-milestones', 6, 3),
    { ...place('projects', 0, 12), settings: { ...DEFAULT_PROJECTS_SETTINGS } },
    place('recent-activity', 0, 23),
  ];
  const charts: DashboardWidgetType[] = ['chart-projects-by-status', 'chart-project-progress', 'chart-open-items'];
  charts.forEach((type, index) => widgets.push({ ...place(type, index * 4, 31), hidden: true }));
  return { version: 1, widgets };
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, Math.round(Number(value) || 0)));

export const normalizeProjectsSettings = (settings?: Partial<ProjectsWidgetSettings>): ProjectsWidgetSettings => ({
  projectIds: settings?.projectIds === 'all' || Array.isArray(settings?.projectIds) ? settings.projectIds : 'all',
  cardFields: Array.isArray(settings?.cardFields) ? settings.cardFields.filter(field => ALL_CARD_FIELDS.includes(field)) : DEFAULT_PROJECTS_SETTINGS.cardFields,
  view: settings?.view === 'compact' ? 'compact' : 'cards',
});

/**
 * Turns whatever was saved into a layout that is safe to render: unknown and ineligible widgets are
 * dropped, geometry is clamped to the grid, duplicates are ignored, and widgets added to the product
 * since the layout was saved appear hidden so a release never rearranges a dashboard.
 */
export const reconcileLayout = (saved: DashboardLayoutV2 | null | undefined, ctx: LayoutContext): DashboardLayoutV2 => {
  if (!saved || saved.version !== 1 || !Array.isArray(saved.widgets)) return defaultLayout(ctx);
  const seen = new Set<DashboardWidgetType>();
  const widgets: DashboardWidgetInstance[] = [];
  for (const item of saved.widgets) {
    const meta = item ? WIDGET_META[item.type] : undefined;
    if (!meta || seen.has(item.type) || !isEligible(item.type, ctx)) continue;
    seen.add(item.type);
    const w = clamp(item.w, meta.min.w, GRID_COLS);
    widgets.push({
      type: item.type,
      x: clamp(item.x, 0, GRID_COLS - w),
      y: clamp(item.y, 0, 10_000),
      w,
      h: clamp(item.h, meta.min.h, 60),
      hidden: Boolean(item.hidden),
      ...(item.type === 'projects' ? { settings: normalizeProjectsSettings(item.settings) } : {}),
    });
  }
  const lastY = widgets.reduce((max, item) => Math.max(max, item.y + item.h), 0);
  for (const meta of WIDGETS) {
    if (seen.has(meta.type) || !isEligible(meta.type, ctx)) continue;
    widgets.push({
      ...place(meta.type, 0, lastY),
      hidden: true,
      ...(meta.type === 'projects' ? { settings: { ...DEFAULT_PROJECTS_SETTINGS } } : {}),
    });
  }
  return { version: 1, widgets };
};

/** Moves a widget one place earlier or later in reading order by swapping grid positions with its neighbour. */
export const moveWidget = (widgets: DashboardWidgetInstance[], type: DashboardWidgetType, direction: -1 | 1): DashboardWidgetInstance[] => {
  const visible = widgets.filter(item => !item.hidden).sort((a, b) => a.y - b.y || a.x - b.x);
  const index = visible.findIndex(item => item.type === type);
  const other = visible[index + direction];
  if (index < 0 || !other) return widgets;
  const self = visible[index];
  return widgets.map(item => {
    if (item.type === self.type) return { ...item, x: other.x, y: other.y };
    if (item.type === other.type) return { ...item, x: self.x, y: self.y };
    return item;
  });
};

/** Applies the geometry react-grid-layout reports (keyed by widget type) to the draft. */
export const applyGeometry = (
  widgets: DashboardWidgetInstance[],
  items: ReadonlyArray<{ i: string; x: number; y: number; w: number; h: number }>,
): DashboardWidgetInstance[] => {
  const byType = new Map(items.map(item => [item.i, item]));
  let changed = false;
  const next = widgets.map(widget => {
    const item = byType.get(widget.type);
    if (!item || widget.hidden) return widget;
    if (item.x === widget.x && item.y === widget.y && item.w === widget.w && item.h === widget.h) return widget;
    changed = true;
    return { ...widget, x: item.x, y: item.y, w: item.w, h: item.h };
  });
  // Same array back when nothing moved, so the grid reporting its own layout never re-renders in a loop.
  return changed ? next : widgets;
};
