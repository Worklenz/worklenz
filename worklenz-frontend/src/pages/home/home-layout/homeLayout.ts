// Pure layout model for the Home overview page. No React, no storage — the registry of widgets a
// user can arrange, plus the functions that validate a saved layout against it and move widgets
// around inside it.

export type HomeWidgetId =
  | 'stat-cards'
  | 'priorities'
  | 'progress-donut'
  | 'continue'
  | 'team-members'
  | 'assigned-by-me'
  | 'mentions'
  | 'todo';
export type HomeColumn = 'main' | 'side';

/** The greeting banner is not a widget: it can be shown or hidden but never moved. */
export const HOME_GREETING_ID = 'greeting';
export type HomeSectionId = HomeWidgetId | typeof HOME_GREETING_ID;

export interface HomeLayout {
  /**
   * Every core widget appears in exactly one column (hidden ones keep their position). An optional
   * widget appears in one only once the user has added it.
   */
  columns: Record<HomeColumn, HomeWidgetId[]>;
  hidden: HomeSectionId[];
}

export interface HomeWidgetDefinition {
  id: HomeWidgetId;
  titleKey: string;
  titleDefault: string;
  /** One line shown in the "Add widget" panel. */
  descriptionKey: string;
  descriptionDefault: string;
  defaultColumn: HomeColumn;
  /** Columns the widget can sit in. The side column is a fixed 320px, too narrow for a table or a stat-card row. */
  allowedColumns: readonly HomeColumn[];
  canHide: boolean;
  /** Stretches to fill the height left in its column (desktop only). */
  fillsHeight: boolean;
  /**
   * Not on the page until the user adds it from "Add widget", and taken off it again (rather than
   * just hidden) when removed. Core widgets are always on the page and can only be hidden.
   */
  isOptional: boolean;
}

export const HOME_COLUMNS: readonly HomeColumn[] = ['main', 'side'];

export const HOME_WIDGETS: readonly HomeWidgetDefinition[] = [
  {
    id: 'stat-cards',
    titleKey: 'customize.widgets.statCards',
    titleDefault: 'Summary cards',
    descriptionKey: 'widgets.descriptions.statCards',
    descriptionDefault: "Today's tasks, what is overdue, what you completed and your focus time.",
    defaultColumn: 'main',
    allowedColumns: ['main'],
    canHide: true,
    fillsHeight: false,
    isOptional: false,
  },
  {
    id: 'priorities',
    titleKey: 'customize.widgets.priorities',
    titleDefault: 'Task priorities',
    descriptionKey: 'widgets.descriptions.priorities',
    descriptionDefault: 'Your tasks for today or this week, ready to work through.',
    defaultColumn: 'main',
    allowedColumns: ['main'],
    canHide: true,
    fillsHeight: false,
    isOptional: false,
  },
  {
    id: 'progress-donut',
    titleKey: 'customize.widgets.progressDonut',
    titleDefault: 'My progress',
    descriptionKey: 'widgets.descriptions.progressDonut',
    descriptionDefault: 'How much of your assigned work is done, in progress or still to do.',
    defaultColumn: 'side',
    allowedColumns: ['main', 'side'],
    canHide: true,
    fillsHeight: false,
    isOptional: false,
  },
  {
    id: 'todo',
    titleKey: 'customize.widgets.todo',
    titleDefault: 'My todo list',
    descriptionKey: 'widgets.descriptions.todo',
    descriptionDefault: 'Jot down personal to-dos and tick them off as you go.',
    defaultColumn: 'side',
    allowedColumns: ['main', 'side'],
    canHide: true,
    fillsHeight: false,
    isOptional: false,
  },
  {
    id: 'team-members',
    titleKey: 'customize.widgets.teamMembers',
    titleDefault: 'Team members',
    descriptionKey: 'widgets.descriptions.teamMembers',
    descriptionDefault: 'See who is on your team and open the full team page.',
    defaultColumn: 'side',
    allowedColumns: ['main', 'side'],
    canHide: true,
    fillsHeight: false,
    isOptional: true,
  },
  {
    id: 'assigned-by-me',
    titleKey: 'customize.widgets.assignedByMe',
    titleDefault: 'Tasks assigned by me',
    descriptionKey: 'widgets.descriptions.assignedByMe',
    descriptionDefault: "Tasks you've handed to teammates, so you can follow up on them.",
    defaultColumn: 'side',
    allowedColumns: ['main', 'side'],
    canHide: true,
    fillsHeight: false,
    isOptional: true,
  },
  {
    id: 'mentions',
    titleKey: 'customize.widgets.mentions',
    titleDefault: 'Comments mentioning me',
    descriptionKey: 'widgets.descriptions.mentions',
    descriptionDefault: 'Recent task comments where a teammate @mentioned you.',
    defaultColumn: 'side',
    allowedColumns: ['main', 'side'],
    canHide: true,
    fillsHeight: false,
    isOptional: true,
  },
  {
    id: 'continue',
    titleKey: 'customize.widgets.continue',
    titleDefault: 'Continue where you left off',
    descriptionKey: 'widgets.descriptions.continue',
    descriptionDefault: 'Jump back into recent projects, tasks, activity and logged time.',
    defaultColumn: 'side',
    allowedColumns: ['main', 'side'],
    canHide: true,
    fillsHeight: true,
    isOptional: true,
  },
];

const WIDGETS_BY_ID = new Map<HomeWidgetId, HomeWidgetDefinition>(HOME_WIDGETS.map(w => [w.id, w]));

export const getHomeWidget = (id: HomeWidgetId): HomeWidgetDefinition => {
  const widget = WIDGETS_BY_ID.get(id);
  if (!widget) throw new Error(`Unknown home widget: ${id}`);
  return widget;
};

export const isHomeWidgetId = (value: unknown): value is HomeWidgetId =>
  typeof value === 'string' && WIDGETS_BY_ID.has(value as HomeWidgetId);

const isHomeSectionId = (value: unknown): value is HomeSectionId =>
  value === HOME_GREETING_ID || isHomeWidgetId(value);

const canHideSection = (id: HomeSectionId): boolean =>
  id === HOME_GREETING_ID || getHomeWidget(id).canHide;

const CORE_WIDGETS = HOME_WIDGETS.filter(w => !w.isOptional);

export const DEFAULT_HOME_LAYOUT: HomeLayout = {
  columns: {
    main: CORE_WIDGETS.filter(w => w.defaultColumn === 'main').map(w => w.id),
    side: CORE_WIDGETS.filter(w => w.defaultColumn === 'side').map(w => w.id),
  },
  hidden: [],
};

const cloneLayout = (layout: HomeLayout): HomeLayout => ({
  columns: { main: [...layout.columns.main], side: [...layout.columns.side] },
  hidden: [...layout.hidden],
});

/**
 * Merges a saved layout (untrusted: parsed from storage) with the registry.
 * - unknown ids and duplicates are dropped
 * - a widget in a column it isn't allowed in goes back to its default column
 * - a core widget added to the registry since the layout was saved is appended to its default
 *   column; an optional widget is left off the page, because only the user can add it
 * - widgets that can't be hidden are forced visible
 */
export const resolveHomeLayout = (saved: unknown): HomeLayout => {
  const raw = (saved && typeof saved === 'object' ? saved : {}) as {
    columns?: Partial<Record<HomeColumn, unknown>>;
    hidden?: unknown;
  };
  const resolved: HomeLayout = { columns: { main: [], side: [] }, hidden: [] };
  const placed = new Set<HomeWidgetId>();

  for (const column of HOME_COLUMNS) {
    const ids = Array.isArray(raw.columns?.[column]) ? (raw.columns?.[column] as unknown[]) : [];
    for (const id of ids) {
      if (!isHomeWidgetId(id) || placed.has(id)) continue;
      if (!getHomeWidget(id).allowedColumns.includes(column)) continue;
      resolved.columns[column].push(id);
      placed.add(id);
    }
  }

  for (const widget of CORE_WIDGETS) {
    if (!placed.has(widget.id)) resolved.columns[widget.defaultColumn].push(widget.id);
  }

  const hidden = Array.isArray(raw.hidden) ? (raw.hidden as unknown[]) : [];
  resolved.hidden = Array.from(new Set(hidden.filter(isHomeSectionId)))
    .filter(canHideSection)
    // A hidden optional widget that is no longer on the page is just a stale entry.
    .filter(id => id === HOME_GREETING_ID || placed.has(id) || !getHomeWidget(id).isOptional);

  return resolved;
};

export const getVisibleWidgetIds = (layout: HomeLayout, column: HomeColumn): HomeWidgetId[] =>
  layout.columns[column].filter(id => !layout.hidden.includes(id));

export const findWidgetColumn = (layout: HomeLayout, id: HomeWidgetId): HomeColumn =>
  layout.columns.main.includes(id) ? 'main' : 'side';

export const isGreetingVisible = (layout: HomeLayout): boolean =>
  !layout.hidden.includes(HOME_GREETING_ID);

export const setSectionHidden = (layout: HomeLayout, id: HomeSectionId, hidden: boolean): HomeLayout => {
  if (!canHideSection(id)) return layout;
  const rest = layout.hidden.filter(h => h !== id);
  return { ...cloneLayout(layout), hidden: hidden ? [...rest, id] : rest };
};

/** Moves a widget to `index` of `column`. Returns the layout unchanged if the column isn't allowed. */
export const moveWidgetToIndex = (
  layout: HomeLayout,
  id: HomeWidgetId,
  column: HomeColumn,
  index: number
): HomeLayout => {
  if (!getHomeWidget(id).allowedColumns.includes(column)) return layout;
  const next = cloneLayout(layout);
  for (const col of HOME_COLUMNS) next.columns[col] = next.columns[col].filter(w => w !== id);
  const target = next.columns[column];
  target.splice(Math.max(0, Math.min(index, target.length)), 0, id);
  return next;
};

/** Shifts a widget one step up (-1) or down (+1) within its column. */
export const shiftWidget = (layout: HomeLayout, id: HomeWidgetId, delta: -1 | 1): HomeLayout => {
  const column = findWidgetColumn(layout, id);
  const index = layout.columns[column].indexOf(id);
  const target = index + delta;
  if (target < 0 || target >= layout.columns[column].length) return layout;
  return moveWidgetToIndex(layout, id, column, target);
};

/**
 * Moves a widget next to `targetId` in `column`, or to the end of the column when `targetId` is
 * null. Hidden widgets keep their slots, so only the moved widget changes place. Returns the layout
 * unchanged when the move is not allowed or would leave everything where it is.
 */
export const moveWidgetRelativeTo = (
  layout: HomeLayout,
  id: HomeWidgetId,
  column: HomeColumn,
  targetId: HomeWidgetId | null,
  position: 'before' | 'after'
): HomeLayout => {
  if (!getHomeWidget(id).allowedColumns.includes(column) || id === targetId) return layout;
  const next = cloneLayout(layout);
  for (const col of HOME_COLUMNS) next.columns[col] = next.columns[col].filter(w => w !== id);
  const target = next.columns[column];

  let insertAt = target.length;
  if (targetId !== null) {
    const targetIndex = target.indexOf(targetId);
    if (targetIndex === -1) return layout;
    insertAt = position === 'before' ? targetIndex : targetIndex + 1;
  }
  target.splice(insertAt, 0, id);

  return JSON.stringify(next) === JSON.stringify(layout) ? layout : next;
};

/** Whether a widget is on the page right now: placed in a column and not hidden. */
export const isWidgetOnPage = (layout: HomeLayout, id: HomeWidgetId): boolean =>
  !layout.hidden.includes(id) && (layout.columns.main.includes(id) || layout.columns.side.includes(id));

/** What the "Add widget" panel offers: every widget that is not on the page right now. */
export const getAddableWidgets = (layout: HomeLayout): HomeWidgetDefinition[] =>
  HOME_WIDGETS.filter(widget => !isWidgetOnPage(layout, widget.id));

/**
 * Puts a widget on the page. A hidden widget simply comes back where it was; one that was never
 * placed (or was removed) goes into its default column just above the first widget that stretches
 * to fill the column's height, so it shows up without squeezing that widget out of the way.
 */
export const addWidget = (layout: HomeLayout, id: HomeWidgetId): HomeLayout => {
  if (isWidgetOnPage(layout, id)) return layout;
  if (layout.hidden.includes(id)) return setSectionHidden(layout, id, false);

  const next = cloneLayout(layout);
  const ids = next.columns[getHomeWidget(id).defaultColumn];
  const firstFiller = ids.findIndex(other => getHomeWidget(other).fillsHeight);
  ids.splice(firstFiller === -1 ? ids.length : firstFiller, 0, id);
  return next;
};

/**
 * Takes a widget off the page. A core widget is only hidden, so it keeps its place for when it is
 * added back; an optional widget is dropped from the layout altogether. Widgets that can't be
 * hidden stay.
 */
export const removeWidget = (layout: HomeLayout, id: HomeWidgetId): HomeLayout => {
  const widget = getHomeWidget(id);
  if (!widget.canHide) return layout;
  if (!widget.isOptional) return setSectionHidden(layout, id, true);

  const next = cloneLayout(layout);
  for (const col of HOME_COLUMNS) next.columns[col] = next.columns[col].filter(w => w !== id);
  next.hidden = next.hidden.filter(h => h !== id);
  return next;
};

/**
 * `addWidget` for anything the "Add widget" menu offers: a widget, or the greeting banner, which is
 * only ever shown or hidden.
 */
export const addSection = (layout: HomeLayout, id: HomeSectionId): HomeLayout =>
  id === HOME_GREETING_ID ? setSectionHidden(layout, id, false) : addWidget(layout, id);

/** `removeWidget` for a widget or the greeting banner. */
export const removeSection = (layout: HomeLayout, id: HomeSectionId): HomeLayout =>
  id === HOME_GREETING_ID ? setSectionHidden(layout, id, true) : removeWidget(layout, id);

/** The column a widget can be sent to with the "move" button, or null if it can only live in one. */
export const getOtherAllowedColumn = (layout: HomeLayout, id: HomeWidgetId): HomeColumn | null => {
  const current = findWidgetColumn(layout, id);
  const other: HomeColumn = current === 'main' ? 'side' : 'main';
  return getHomeWidget(id).allowedColumns.includes(other) ? other : null;
};

export const isDefaultHomeLayout = (layout: HomeLayout): boolean =>
  JSON.stringify(layout) === JSON.stringify(DEFAULT_HOME_LAYOUT);
