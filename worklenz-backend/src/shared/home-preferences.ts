// Validation for the per-user Home page preferences document (#2372). Pure and free of any `db`
// import so it can be unit tested without Postgres. The document is client-supplied JSON that is
// stored and later handed back to every device, so it is checked field by field: unknown keys,
// wrong types, ids outside the allowlists and oversized payloads are all rejected.
//
// The widget and tab lists below mirror the client's registry
// (worklenz-frontend/src/pages/home/home-layout/homeLayout.ts and homeTabs.ts). Keep them in step.

export const HOME_PREFERENCES_VERSION = 1;
/** Upper bound on the serialized document. A real document is well under 1 KB. */
export const HOME_PREFERENCES_MAX_BYTES = 4096;

type Column = "main" | "side";

interface WidgetRule {
  allowedColumns: readonly Column[];
  canHide: boolean;
}

const WIDGETS: Record<string, WidgetRule> = {
  "stat-cards": { allowedColumns: ["main"], canHide: true },
  priorities: { allowedColumns: ["main"], canHide: true },
  "progress-donut": { allowedColumns: ["main", "side"], canHide: true },
  todo: { allowedColumns: ["main", "side"], canHide: true },
  // Optional widgets: a document without them is valid (they are only present once the user adds
  // them from "Add widget"), so none of them appear in DEFAULT_HOME_PREFERENCES below.
  continue: { allowedColumns: ["main", "side"], canHide: true },
  "team-members": { allowedColumns: ["main", "side"], canHide: true },
  "assigned-by-me": { allowedColumns: ["main", "side"], canHide: true },
  mentions: { allowedColumns: ["main", "side"], canHide: true },
};
/** Not a widget: shown or hidden, never moved. Only valid in `layout.hidden`. */
const GREETING_ID = "greeting";

const TAB_IDS = ["All", "Today", "Overdue", "Upcoming", "NoDueDate", "Pinned"] as const;
/** The toggle items of the "Continue where you left off" widget (home-continue-card). */
const CONTINUE_TAB_IDS = ["projects", "tasks", "activity", "time"] as const;
const PERIODS = ["today", "week"] as const;
const SORT_FIELDS = ["name", "project_name", "end_date", "priority", "status"] as const;
const SORT_ORDERS = ["asc", "desc"] as const;

export interface HomePreferencesDocument {
  version: number;
  layout: { columns: Record<Column, string[]>; hidden: string[] };
  tabs: { order: string[]; hidden: string[] };
  /** Which of the Continue widget's toggle items are hidden. Absent in documents saved before it existed. */
  continueTabs: { hidden: string[] };
  selections: {
    period: (typeof PERIODS)[number];
    assignedGroup: 0 | 1;
    pinnedAssignedGroup: 0 | 1 | null;
    priorityTab: (typeof TAB_IDS)[number];
    sort: { field: (typeof SORT_FIELDS)[number]; order: (typeof SORT_ORDERS)[number] } | null;
  };
}

export const DEFAULT_HOME_PREFERENCES: HomePreferencesDocument = {
  version: HOME_PREFERENCES_VERSION,
  layout: {
    columns: { main: ["stat-cards", "priorities"], side: ["progress-donut", "todo"] },
    hidden: [],
  },
  tabs: { order: [...TAB_IDS], hidden: [] },
  continueTabs: { hidden: [] },
  selections: {
    period: "week",
    assignedGroup: 0,
    pinnedAssignedGroup: null,
    priorityTab: "All",
    sort: null,
  },
};

export type HomePreferencesResult =
  | { ok: true; value: HomePreferencesDocument }
  | { ok: false; error: string };

const fail = (error: string): HomePreferencesResult => ({ ok: false, error });

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOnlyKeys = (value: Record<string, unknown>, allowed: readonly string[]): boolean =>
  Object.keys(value).every(key => allowed.includes(key));

const isOneOf = <T extends string>(values: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (values as readonly string[]).includes(value);

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string");

const hasDuplicates = (values: string[]): boolean => new Set(values).size !== values.length;

function validateLayout(raw: unknown): { error: string } | { value: HomePreferencesDocument["layout"] } {
  if (!isPlainObject(raw) || !hasOnlyKeys(raw, ["columns", "hidden"])) return { error: "layout is invalid" };
  const { columns, hidden } = raw;
  if (!isPlainObject(columns) || !hasOnlyKeys(columns, ["main", "side"])) return { error: "layout.columns is invalid" };
  if (!isStringArray(columns.main) || !isStringArray(columns.side)) return { error: "layout.columns is invalid" };
  if (!isStringArray(hidden)) return { error: "layout.hidden is invalid" };

  const placed: string[] = [];
  for (const column of ["main", "side"] as const) {
    for (const id of columns[column] as string[]) {
      const rule = WIDGETS[id];
      if (!rule) return { error: `Unknown widget: ${id}` };
      if (!rule.allowedColumns.includes(column)) return { error: `${id} cannot be placed in the ${column} column` };
      placed.push(id);
    }
  }
  if (hasDuplicates(placed)) return { error: "A widget appears more than once" };

  if (hasDuplicates(hidden)) return { error: "layout.hidden contains duplicates" };
  for (const id of hidden) {
    if (id === GREETING_ID) continue;
    const rule = WIDGETS[id];
    if (!rule) return { error: `Unknown widget: ${id}` };
    if (!rule.canHide) return { error: `${id} cannot be hidden` };
  }

  return {
    value: {
      columns: { main: columns.main as string[], side: columns.side as string[] },
      hidden,
    },
  };
}

function validateTabs(raw: unknown): { error: string } | { value: HomePreferencesDocument["tabs"] } {
  if (!isPlainObject(raw) || !hasOnlyKeys(raw, ["order", "hidden"])) return { error: "tabs is invalid" };
  const { order, hidden } = raw;
  if (!isStringArray(order) || !isStringArray(hidden)) return { error: "tabs is invalid" };

  // Every tab exactly once, so a saved order can never silently drop a tab.
  if (order.length !== TAB_IDS.length || hasDuplicates(order) || !order.every(id => isOneOf(TAB_IDS, id))) {
    return { error: "tabs.order must list every tab exactly once" };
  }
  if (hasDuplicates(hidden) || !hidden.every(id => isOneOf(TAB_IDS, id))) return { error: "tabs.hidden is invalid" };
  if (hidden.length >= order.length) return { error: "At least one tab must stay visible" };

  return { value: { order, hidden } };
}

function validateContinueTabs(raw: unknown): { error: string } | { value: HomePreferencesDocument["continueTabs"] } {
  if (!isPlainObject(raw) || !hasOnlyKeys(raw, ["hidden"])) return { error: "continueTabs is invalid" };
  const { hidden } = raw;
  if (!isStringArray(hidden) || hasDuplicates(hidden) || !hidden.every(id => isOneOf(CONTINUE_TAB_IDS, id))) {
    return { error: "continueTabs.hidden is invalid" };
  }
  if (hidden.length >= CONTINUE_TAB_IDS.length) return { error: "At least one Continue tab must stay visible" };
  return { value: { hidden } };
}

function validateSelections(raw: unknown): { error: string } | { value: HomePreferencesDocument["selections"] } {
  if (!isPlainObject(raw)) return { error: "selections is invalid" };
  if (!hasOnlyKeys(raw, ["period", "assignedGroup", "pinnedAssignedGroup", "priorityTab", "sort"])) {
    return { error: "selections is invalid" };
  }

  if (!isOneOf(PERIODS, raw.period)) return { error: "selections.period is invalid" };
  if (raw.assignedGroup !== 0 && raw.assignedGroup !== 1) return { error: "selections.assignedGroup is invalid" };
  // Added after the first version of the document; absent means no pinned default.
  const pinnedAssignedGroup = raw.pinnedAssignedGroup ?? null;
  if (pinnedAssignedGroup !== null && pinnedAssignedGroup !== 0 && pinnedAssignedGroup !== 1) {
    return { error: "selections.pinnedAssignedGroup is invalid" };
  }
  if (!isOneOf(TAB_IDS, raw.priorityTab)) return { error: "selections.priorityTab is invalid" };

  let sort: HomePreferencesDocument["selections"]["sort"] = null;
  if (raw.sort !== null && raw.sort !== undefined) {
    if (!isPlainObject(raw.sort) || !hasOnlyKeys(raw.sort, ["field", "order"])) return { error: "selections.sort is invalid" };
    if (!isOneOf(SORT_FIELDS, raw.sort.field) || !isOneOf(SORT_ORDERS, raw.sort.order)) {
      return { error: "selections.sort is invalid" };
    }
    sort = { field: raw.sort.field, order: raw.sort.order };
  }

  return {
    value: {
      period: raw.period,
      assignedGroup: raw.assignedGroup,
      pinnedAssignedGroup,
      priorityTab: raw.priorityTab,
      sort,
    },
  };
}

/** Checks an untrusted preferences document and returns a clean copy containing only known fields. */
export function validateHomePreferences(raw: unknown): HomePreferencesResult {
  if (!isPlainObject(raw)) return fail("Preferences must be an object");
  if (Buffer.byteLength(JSON.stringify(raw), "utf8") > HOME_PREFERENCES_MAX_BYTES) {
    return fail("Preferences are too large");
  }
  if (!hasOnlyKeys(raw, ["version", "layout", "tabs", "continueTabs", "selections"])) {
    return fail("Preferences contain unknown fields");
  }
  if (!Number.isInteger(raw.version) || raw.version !== HOME_PREFERENCES_VERSION) {
    return fail("Unsupported preferences version");
  }

  const layout = validateLayout(raw.layout);
  if ("error" in layout) return fail(layout.error);
  const tabs = validateTabs(raw.tabs);
  if ("error" in tabs) return fail(tabs.error);
  // Added after the first version of the document; absent means nothing is hidden.
  const continueTabs =
    raw.continueTabs === undefined ? { value: { hidden: [] as string[] } } : validateContinueTabs(raw.continueTabs);
  if ("error" in continueTabs) return fail(continueTabs.error);
  const selections = validateSelections(raw.selections);
  if ("error" in selections) return fail(selections.error);

  return {
    ok: true,
    value: {
      version: HOME_PREFERENCES_VERSION,
      layout: layout.value,
      tabs: tabs.value,
      continueTabs: continueTabs.value,
      selections: selections.value,
    },
  };
}
