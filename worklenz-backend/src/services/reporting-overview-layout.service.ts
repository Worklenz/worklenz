import db from "../config/db";

/**
 * Reports > Overview: each user's customised widget layout (position, size, visibility), stored
 * per (team, user) in `reporting_overview_layouts`. No row means the user never customised: the
 * frontend renders its own default layout.
 *
 * This mirrors the validation pattern used by worklenz-business's client-portal-v2 overview grid
 * (branch 2520-spec-user-client-portal-v2-overview): the saved layout is a small, strictly
 * validated JSON document, never trusted as-is from the client.
 */

export const OVERVIEW_LAYOUT_VERSION = 1;

const GRID_COLS = 12;
const MAX_WIDGETS = 40;
const MAX_ROW = 10_000;
const MAX_HEIGHT = 60;
const MAX_CONFIG_BYTES = 4096;

/**
 * Known widget keys for the Reports > Overview grid. Kept here (not imported from the frontend)
 * so the backend validates against its own list regardless of what the frontend currently ships;
 * add a key here and to the frontend's widget registry together.
 */
export const OVERVIEW_WIDGET_KEYS = [
  "kpi_teams",
  "kpi_projects",
  "kpi_members",
  "teams_table",
  "kpi_active_projects",
  "kpi_overdue_projects",
  "kpi_unassigned_members",
  "kpi_members_with_overdue_tasks",
  "project_stats_by_status",
  "tasks_by_status",
  "time_logged_vs_estimated",
  "capacity_vs_logged",
  "team_utilization",
  "billable_tasks",
  "billable_time_logs",
  "client_stats",
  "project_health_stats",
  "incomplete_tasks_by_project",
  "upcoming_tasks",
  "overdue_tasks",
  "burndown_chart",
  "burnup_chart",
  "velocity_chart",
  "cumulative_flow",
  "time_in_status",
] as const;
export type OverviewWidgetKey = (typeof OVERVIEW_WIDGET_KEYS)[number];

/**
 * Widget types the user may add more than once, each with its own filters/chart type (e.g. two
 * "Tasks by Status" widgets scoped to different teams). Everything else stays singleton: at most
 * one instance, identified by its key alone. Kept in sync with the frontend's `repeatable: true`
 * catalogue entries (overview-widgets.tsx).
 */
export const REPEATABLE_OVERVIEW_WIDGET_KEYS = new Set<OverviewWidgetKey>([
  "project_stats_by_status",
  "tasks_by_status",
  "time_logged_vs_estimated",
  "capacity_vs_logged",
  "team_utilization",
  "billable_tasks",
  "billable_time_logs",
  "client_stats",
  "project_health_stats",
  "incomplete_tasks_by_project",
  "upcoming_tasks",
  "overdue_tasks",
  "burndown_chart",
  "burnup_chart",
  "velocity_chart",
  "cumulative_flow",
  "time_in_status",
]);

const CHART_TYPES = ["bar", "stacked", "line", "donut", "number"] as const;
const GROUP_BY_VALUES = ["assignee", "project"] as const;
const PROGRESS_SCOPE_VALUES = ["team", "project"] as const;
const PROGRESS_SOURCE_VALUES = ["range", "sprint"] as const;
const PROGRESS_METRIC_VALUES = ["story_points", "issue_count", "estimated_hours"] as const;

/** Per-widget filter selection for the stats widgets below. All fields optional: an unset field
 *  falls back to the page-level default (see reporting-project-widgets-stats.service.ts). */
export interface OverviewWidgetConfig {
  teams?: string[];
  billable?: "all" | "billable" | "nonBillable";
  includeArchived?: boolean;
  /** Which chart the widget renders as; ignored by table widgets (e.g. Client Stats). */
  chartType?: (typeof CHART_TYPES)[number];
  /** Grouping dimension for Upcoming Tasks / Overdue Tasks; ignored by every other widget. */
  groupBy?: (typeof GROUP_BY_VALUES)[number];
  /** Hides the chart's data labels (legend). Only meaningful for the chart-based stats widgets. */
  hideDataLabels?: boolean;
  /** Per-series bar/line color overrides (hex strings), in series order. */
  colors?: string[];
  /** Burnup / Burndown widgets only: "team" = the active team's projects, "project" = one project. */
  progressScope?: (typeof PROGRESS_SCOPE_VALUES)[number];
  /** Burnup / Burndown, project scope: the project, and optionally one of its sprints. */
  projectId?: string;
  progressSource?: (typeof PROGRESS_SOURCE_VALUES)[number];
  sprintId?: string;
  /** Burnup / Burndown: what is counted. */
  progressMetric?: (typeof PROGRESS_METRIC_VALUES)[number];
  /** Burnup / Burndown: count sub-tasks too (off by default, as in Jira). */
  includeSubtasks?: boolean;
  showIdealLine?: boolean;
  showForecast?: boolean;
  /** Velocity widget: how many recent sprints to plot (3-12). */
  sprintCount?: number;
}

export interface OverviewWidgetInstance {
  /** Distinguishes instances of a repeatable widget type; equal to `key` for singleton widgets. */
  id: string;
  key: OverviewWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
  config?: OverviewWidgetConfig;
}

export interface OverviewLayout {
  version: 1;
  widgets: OverviewWidgetInstance[];
}

export interface OverviewLayoutView {
  /** null when the user has never customised: the frontend renders its default layout. */
  layout: OverviewLayout | null;
}

/** Thrown by `validateLayout`; callers turn it into a 400 with `.message`. */
export class InvalidOverviewLayoutError extends Error {}

const isKnownKey = (value: unknown): value is OverviewWidgetKey =>
  typeof value === "string" && (OVERVIEW_WIDGET_KEYS as readonly string[]).includes(value);

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(item => typeof item === "string" && item.length > 0) && value.length <= 200;

const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;
const MAX_SERIES_COLORS = 8;
const isHexColorArray = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= MAX_SERIES_COLORS &&
  value.every(item => typeof item === "string" && HEX_COLOR_PATTERN.test(item));

const BILLABLE_VALUES = ["all", "billable", "nonBillable"];
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** chartType values retired when the chart-type picker was unified to bar/stacked/line/donut/number.
 *  A layout saved under the old scheme is migrated here rather than rejected, so re-saving an
 *  untouched widget doesn't 400 forever just because its last-saved config predates the change. */
const LEGACY_CHART_TYPES: Record<string, (typeof CHART_TYPES)[number]> = { pie: "donut", doughnut: "donut" };

/**
 * A widget's `config` is never trusted shape-wise: unknown keys are dropped, arrays are bounded,
 * and the whole object must serialise under MAX_CONFIG_BYTES. Returns undefined for "no config".
 */
function sanitizeConfig(raw: unknown): OverviewWidgetConfig | undefined {
  if (raw === undefined || raw === null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) throw new InvalidOverviewLayoutError("widget config must be an object");

  const input = raw as Record<string, unknown>;
  const config: OverviewWidgetConfig = {};

  if (input.teams !== undefined) {
    if (!isStringArray(input.teams)) throw new InvalidOverviewLayoutError("widget config.teams must be a list of ids");
    config.teams = input.teams as string[];
  }

  if (input.billable !== undefined) {
    if (!BILLABLE_VALUES.includes(input.billable as string)) throw new InvalidOverviewLayoutError("widget config.billable is invalid");
    config.billable = input.billable as OverviewWidgetConfig["billable"];
  }

  if (input.includeArchived !== undefined) {
    if (typeof input.includeArchived !== "boolean") throw new InvalidOverviewLayoutError("widget config.includeArchived must be a boolean");
    config.includeArchived = input.includeArchived;
  }

  if (input.chartType !== undefined) {
    const chartType = LEGACY_CHART_TYPES[input.chartType as string] ?? input.chartType;
    if (!CHART_TYPES.includes(chartType as any)) throw new InvalidOverviewLayoutError("widget config.chartType is invalid");
    config.chartType = chartType as OverviewWidgetConfig["chartType"];
  }

  if (input.groupBy !== undefined) {
    if (!GROUP_BY_VALUES.includes(input.groupBy as any)) throw new InvalidOverviewLayoutError("widget config.groupBy is invalid");
    config.groupBy = input.groupBy as OverviewWidgetConfig["groupBy"];
  }

  if (input.hideDataLabels !== undefined) {
    if (typeof input.hideDataLabels !== "boolean") throw new InvalidOverviewLayoutError("widget config.hideDataLabels must be a boolean");
    config.hideDataLabels = input.hideDataLabels;
  }

  if (input.colors !== undefined) {
    if (!isHexColorArray(input.colors)) throw new InvalidOverviewLayoutError("widget config.colors must be a list of hex colors");
    config.colors = input.colors as string[];
  }

  if (input.progressScope !== undefined) {
    if (!PROGRESS_SCOPE_VALUES.includes(input.progressScope as any)) throw new InvalidOverviewLayoutError("widget config.progressScope is invalid");
    config.progressScope = input.progressScope as OverviewWidgetConfig["progressScope"];
  }

  if (input.progressSource !== undefined) {
    if (!PROGRESS_SOURCE_VALUES.includes(input.progressSource as any)) throw new InvalidOverviewLayoutError("widget config.progressSource is invalid");
    config.progressSource = input.progressSource as OverviewWidgetConfig["progressSource"];
  }

  if (input.progressMetric !== undefined) {
    if (!PROGRESS_METRIC_VALUES.includes(input.progressMetric as any)) throw new InvalidOverviewLayoutError("widget config.progressMetric is invalid");
    config.progressMetric = input.progressMetric as OverviewWidgetConfig["progressMetric"];
  }

  if (input.sprintCount !== undefined) {
    if (!isIntegerInRange(input.sprintCount, 3, 12)) throw new InvalidOverviewLayoutError("widget config.sprintCount must be between 3 and 12");
    config.sprintCount = input.sprintCount;
  }

  for (const key of ["projectId", "sprintId"] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "string" || !UUID_PATTERN.test(input[key] as string)) throw new InvalidOverviewLayoutError(`widget config.${key} must be an id`);
      config[key] = input[key] as string;
    }
  }

  for (const key of ["includeSubtasks", "showIdealLine", "showForecast"] as const) {
    if (input[key] !== undefined) {
      if (typeof input[key] !== "boolean") throw new InvalidOverviewLayoutError(`widget config.${key} must be a boolean`);
      config[key] = input[key] as boolean;
    }
  }

  if (Buffer.byteLength(JSON.stringify(config), "utf8") > MAX_CONFIG_BYTES) {
    throw new InvalidOverviewLayoutError("widget config is too large");
  }

  return config;
}

/**
 * A saved layout is only ever a bounded list of known widgets with in-grid geometry and a
 * sanitised config. Anything else throws `InvalidOverviewLayoutError`, so a malformed or tampered
 * body never reaches the database.
 */
export function validateLayout(input: unknown): OverviewLayout {
  const raw = input as Partial<OverviewLayout> | null;
  if (!raw || typeof raw !== "object") throw new InvalidOverviewLayoutError("layout must be an object");
  if (raw.version !== OVERVIEW_LAYOUT_VERSION) throw new InvalidOverviewLayoutError("layout version is not supported");
  if (!Array.isArray(raw.widgets)) throw new InvalidOverviewLayoutError("layout.widgets must be a list");
  if (raw.widgets.length > MAX_WIDGETS) throw new InvalidOverviewLayoutError("layout has too many widgets");

  const seenKeys = new Set<OverviewWidgetKey>();
  const seenIds = new Set<string>();
  const widgets = raw.widgets.map((entry: unknown): OverviewWidgetInstance => {
    const item = entry as Partial<OverviewWidgetInstance> | null;
    if (!item || typeof item !== "object" || !isKnownKey(item.key)) {
      throw new InvalidOverviewLayoutError("layout has an unknown widget");
    }

    const repeatable = REPEATABLE_OVERVIEW_WIDGET_KEYS.has(item.key);
    let id: string;
    if (repeatable) {
      if (typeof item.id !== "string" || !ID_PATTERN.test(item.id)) {
        throw new InvalidOverviewLayoutError("layout has a repeatable widget with an invalid id");
      }
      id = item.id;
    } else {
      if (seenKeys.has(item.key)) throw new InvalidOverviewLayoutError("layout lists a widget twice");
      seenKeys.add(item.key);
      id = item.key;
    }
    if (seenIds.has(id)) throw new InvalidOverviewLayoutError("layout lists a widget twice");
    seenIds.add(id);

    if (!isIntegerInRange(item.w, 1, GRID_COLS) || !isIntegerInRange(item.x, 0, GRID_COLS - 1) || (item.x as number) + (item.w as number) > GRID_COLS) {
      throw new InvalidOverviewLayoutError("layout has a widget outside the grid");
    }
    if (!isIntegerInRange(item.y, 0, MAX_ROW) || !isIntegerInRange(item.h, 1, MAX_HEIGHT)) {
      throw new InvalidOverviewLayoutError("layout has an invalid widget size");
    }
    if (typeof item.hidden !== "boolean") throw new InvalidOverviewLayoutError("layout has an invalid visibility");

    const config = sanitizeConfig(item.config);

    return {
      id,
      key: item.key,
      x: item.x,
      y: item.y,
      w: item.w,
      h: item.h,
      hidden: item.hidden,
      ...(config !== undefined ? { config } : {}),
    };
  });

  return { version: OVERVIEW_LAYOUT_VERSION, widgets };
}

export async function getOverviewLayout(teamId: string, userId: string): Promise<OverviewLayoutView> {
  const result = await db.query(
    `SELECT layout, version FROM reporting_overview_layouts WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  const row = result.rows[0];
  // A layout written by a future version is ignored rather than guessed at.
  return { layout: row && row.version === OVERVIEW_LAYOUT_VERSION ? (row.layout as OverviewLayout) : null };
}

export async function saveOverviewLayout(teamId: string, userId: string, input: unknown): Promise<OverviewLayoutView> {
  const layout = validateLayout(input);
  await db.query(
    `INSERT INTO reporting_overview_layouts (team_id, user_id, layout, version)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (team_id, user_id) DO UPDATE
       SET layout = EXCLUDED.layout, version = EXCLUDED.version, updated_at = CURRENT_TIMESTAMP`,
    [teamId, userId, JSON.stringify(layout), OVERVIEW_LAYOUT_VERSION]
  );
  return { layout };
}

/** Back to the default layout (deletes the saved row; the frontend renders its own default). */
export async function resetOverviewLayout(teamId: string, userId: string): Promise<OverviewLayoutView> {
  await db.query(`DELETE FROM reporting_overview_layouts WHERE team_id = $1 AND user_id = $2`, [teamId, userId]);
  return { layout: null };
}
