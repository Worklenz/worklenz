/**
 * Reporting & Analytics > Custom Dashboards: input validation (spec: Worklenz/worklenz-business#2558).
 *
 * Pure functions, no database access, so they can be tested directly. Everything a client sends
 * for a dashboard (metadata, dashboard-level filters, gadget placement and per-gadget config) is
 * validated here before it reaches the database. Mirrors the CHECK constraints in the
 * `dashboards` / `dashboard_gadgets` migrations; those are the last line of defence, this is the
 * one that produces useful 400 messages.
 */

import { TEAM_ROLE_NAMES } from "../shared/team-permissions";

export const DASHBOARD_VISIBILITIES = ["private", "workspace", "role", "link"] as const;
export type DashboardVisibility = (typeof DASHBOARD_VISIBILITIES)[number];

/** Roles a `role`-visibility dashboard can be shared with. */
export const SHAREABLE_ROLES: readonly string[] = Object.values(TEAM_ROLE_NAMES);

export const GRID_COLS = 12;
export const MAX_GADGETS = 40;
const MAX_ROW = 10_000;
const MAX_HEIGHT = 60;
const MAX_CONFIG_BYTES = 4_096;
const MAX_FILTER_PROJECTS = 100;

export const REFRESH_INTERVALS_SECONDS = [0, 30, 60, 300, 900] as const;
export const DATE_RANGE_PRESETS = ["last_7_days", "last_30_days", "last_90_days", "this_month", "custom"] as const;

/** Thrown by every validator here; controllers turn it into a 400 with `.message`. */
export class InvalidDashboardError extends Error {}

export interface DashboardDateRange {
  preset: (typeof DATE_RANGE_PRESETS)[number];
  start?: string;
  end?: string;
}

export interface DashboardFilters {
  project_ids?: string[];
  date_range?: DashboardDateRange;
  refresh_interval_seconds?: number;
}

export interface DashboardMeta {
  name: string;
  description: string | null;
  visibility: DashboardVisibility;
  visible_roles: string[];
  filters: DashboardFilters;
}

export interface GadgetInput {
  type: string;
  x: number;
  y: number;
  w: number;
  h: number;
  config: Record<string, unknown>;
}

type JsonObject = Record<string, unknown>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);

const isRealDate = (value: unknown): value is string =>
  typeof value === "string" && ISO_DATE_PATTERN.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

function rejectUnknownKeys(obj: JsonObject, allowed: readonly string[], label: string): void {
  const unknown = Object.keys(obj).find(key => !allowed.includes(key));
  if (unknown) throw new InvalidDashboardError(`${label} has an unknown field "${unknown}"`);
}

/** Shared by dashboard-level filters and any gadget that takes its own date range. */
export function validateDateRange(input: unknown, label = "date_range"): DashboardDateRange {
  if (!isObject(input)) throw new InvalidDashboardError(`${label} must be an object`);
  rejectUnknownKeys(input, ["preset", "start", "end"], label);

  const preset = input.preset;
  if (typeof preset !== "string" || !(DATE_RANGE_PRESETS as readonly string[]).includes(preset)) {
    throw new InvalidDashboardError(`${label}.preset is not supported`);
  }

  if (preset !== "custom") {
    if (input.start !== undefined || input.end !== undefined) {
      throw new InvalidDashboardError(`${label}.start and ${label}.end are only allowed with the custom preset`);
    }
    return { preset: preset as DashboardDateRange["preset"] };
  }

  if (!isRealDate(input.start) || !isRealDate(input.end)) {
    throw new InvalidDashboardError(`${label} needs a start and end date in YYYY-MM-DD format`);
  }
  if (input.start > input.end) throw new InvalidDashboardError(`${label}.start must not be after ${label}.end`);
  return { preset: "custom", start: input.start, end: input.end };
}

export function validateDashboardFilters(input: unknown): DashboardFilters {
  if (input === undefined || input === null) return {};
  if (!isObject(input)) throw new InvalidDashboardError("filters must be an object");
  rejectUnknownKeys(input, ["project_ids", "date_range", "refresh_interval_seconds"], "filters");

  const filters: DashboardFilters = {};

  if (input.project_ids !== undefined) {
    if (!Array.isArray(input.project_ids) || input.project_ids.length > MAX_FILTER_PROJECTS) {
      throw new InvalidDashboardError("filters.project_ids must be a short list of project ids");
    }
    if (!input.project_ids.every(isUuid)) throw new InvalidDashboardError("filters.project_ids has an invalid project id");
    filters.project_ids = Array.from(new Set(input.project_ids as string[]));
  }

  if (input.date_range !== undefined) filters.date_range = validateDateRange(input.date_range, "filters.date_range");

  if (input.refresh_interval_seconds !== undefined) {
    const interval = input.refresh_interval_seconds;
    if (typeof interval !== "number" || !(REFRESH_INTERVALS_SECONDS as readonly number[]).includes(interval)) {
      throw new InvalidDashboardError("filters.refresh_interval_seconds is not a supported interval");
    }
    filters.refresh_interval_seconds = interval;
  }

  return filters;
}

/**
 * Dashboard metadata for create (every field expected) and update (`partial`: only the fields
 * sent are returned, and visibility rules are only checked when visibility or roles are sent).
 */
export function validateDashboardMeta(input: unknown, partial: true): Partial<DashboardMeta>;
export function validateDashboardMeta(input: unknown, partial?: false): DashboardMeta;
export function validateDashboardMeta(input: unknown, partial = false): Partial<DashboardMeta> {
  if (!isObject(input)) throw new InvalidDashboardError("dashboard must be an object");
  const meta: Partial<DashboardMeta> = {};

  if (input.name !== undefined || !partial) {
    const name = typeof input.name === "string" ? input.name.trim() : "";
    if (name.length < 1 || name.length > 100) throw new InvalidDashboardError("name must be 1 to 100 characters");
    meta.name = name;
  }

  if (input.description !== undefined || !partial) {
    if (input.description !== undefined && input.description !== null && typeof input.description !== "string") {
      throw new InvalidDashboardError("description must be text");
    }
    const description = typeof input.description === "string" ? input.description.trim() : "";
    if (description.length > 500) throw new InvalidDashboardError("description must be 500 characters or fewer");
    meta.description = description || null;
  }

  if (input.visibility !== undefined || !partial) {
    const visibility = input.visibility ?? "private";
    if (typeof visibility !== "string" || !(DASHBOARD_VISIBILITIES as readonly string[]).includes(visibility)) {
      throw new InvalidDashboardError("visibility is not supported");
    }
    meta.visibility = visibility as DashboardVisibility;
  }

  if (input.visible_roles !== undefined || !partial) {
    const roles = input.visible_roles ?? [];
    if (!Array.isArray(roles) || roles.length > SHAREABLE_ROLES.length) {
      throw new InvalidDashboardError("visible_roles must be a list of roles");
    }
    if (!roles.every(role => typeof role === "string" && SHAREABLE_ROLES.includes(role))) {
      throw new InvalidDashboardError("visible_roles has an unknown role");
    }
    meta.visible_roles = Array.from(new Set(roles as string[]));
  }

  if (input.filters !== undefined || !partial) meta.filters = validateDashboardFilters(input.filters);

  if (meta.visibility === "role" && (meta.visible_roles ?? []).length === 0) {
    throw new InvalidDashboardError("choose at least one role to share this dashboard with");
  }

  return meta;
}

// ---------------------------------------------------------------------------------------------
// Gadget registry
// ---------------------------------------------------------------------------------------------

type ConfigFieldValidator = (value: unknown, label: string) => unknown;

const projectId: ConfigFieldValidator = (value, label) => {
  if (!isUuid(value)) throw new InvalidDashboardError(`${label} must be a project id`);
  return value;
};

const dateRange: ConfigFieldValidator = (value, label) => validateDateRange(value, label);

const sprintCount: ConfigFieldValidator = (value, label) => {
  if (!isIntegerInRange(value, 1, 24)) throw new InvalidDashboardError(`${label} must be a whole number from 1 to 24`);
  return value;
};

const plainText: ConfigFieldValidator = (value, label) => {
  if (typeof value !== "string" || value.length > 2_000) {
    throw new InvalidDashboardError(`${label} must be text of 2000 characters or fewer`);
  }
  return value;
};

const enumOf =
  (allowed: readonly string[]): ConfigFieldValidator =>
  (value, label) => {
    if (typeof value !== "string" || !allowed.includes(value)) throw new InvalidDashboardError(`${label} is not supported`);
    return value;
  };

const flag: ConfigFieldValidator = (value, label) => {
  if (typeof value !== "boolean") throw new InvalidDashboardError(`${label} must be true or false`);
  return value;
};

const progressChartFields = {
  project_id: projectId,
  sprint_id: projectId,
  metric: enumOf(["story_points", "issue_count", "estimated_hours"]),
  include_subtasks: flag,
  date_range: dateRange,
} as const;

/**
 * Known gadget types and the config fields each accepts. Kept on the backend (not imported from
 * the frontend) so validation does not depend on what the frontend currently ships; add a type
 * here and to the frontend's gadget registry together. Unknown config fields are rejected, so a
 * gadget's stored config can only ever hold settings the renderer understands. Config is display
 * and filter preferences only; it never grants access to data (every gadget query is scoped to
 * the viewer's projects server-side).
 */
export const GADGET_REGISTRY: Readonly<Record<string, Readonly<Record<string, ConfigFieldValidator>>>> = {
  velocity_chart: { project_id: projectId, sprint_count: sprintCount, metric: enumOf(["story_points", "issue_count"]), include_subtasks: flag },
  cumulative_flow: { project_id: projectId, date_range: dateRange, include_subtasks: flag },
  sla_tracking: { project_id: projectId, date_range: dateRange },
  time_in_status: { project_id: projectId, date_range: dateRange, include_subtasks: flag },
  burndown_chart: progressChartFields,
  burnup_chart: progressChartFields,
  project_summary: { project_id: projectId },
  text: { text: plainText },
};

export const GADGET_TYPES = Object.keys(GADGET_REGISTRY);

function validateGadgetConfig(type: string, input: unknown): Record<string, unknown> {
  if (input === undefined || input === null) return {};
  if (!isObject(input)) throw new InvalidDashboardError("gadget config must be an object");
  if (JSON.stringify(input).length > MAX_CONFIG_BYTES) throw new InvalidDashboardError("gadget config is too large");

  const fields = GADGET_REGISTRY[type];
  rejectUnknownKeys(input, Object.keys(fields), `${type} config`);

  const config: Record<string, unknown> = {};
  for (const [key, validate] of Object.entries(fields)) {
    if (input[key] !== undefined) config[key] = validate(input[key], `${type} config.${key}`);
  }
  return config;
}

/**
 * A dashboard's gadgets are saved as a whole: a bounded list of known gadget types with in-grid
 * geometry and valid config. The same type may appear more than once.
 */
export function validateGadgets(input: unknown): GadgetInput[] {
  if (!Array.isArray(input)) throw new InvalidDashboardError("gadgets must be a list");
  if (input.length > MAX_GADGETS) throw new InvalidDashboardError("dashboard has too many gadgets");

  return input.map((entry: unknown): GadgetInput => {
    if (!isObject(entry)) throw new InvalidDashboardError("gadget must be an object");
    const { type } = entry;
    if (typeof type !== "string" || !Object.prototype.hasOwnProperty.call(GADGET_REGISTRY, type)) {
      throw new InvalidDashboardError("dashboard has an unknown gadget type");
    }

    const { x, y, w, h } = entry;
    if (!isIntegerInRange(w, 1, GRID_COLS) || !isIntegerInRange(x, 0, GRID_COLS - 1) || x + w > GRID_COLS) {
      throw new InvalidDashboardError("dashboard has a gadget outside the grid");
    }
    if (!isIntegerInRange(y, 0, MAX_ROW) || !isIntegerInRange(h, 1, MAX_HEIGHT)) {
      throw new InvalidDashboardError("dashboard has an invalid gadget size");
    }

    return { type, x, y, w, h, config: validateGadgetConfig(type, entry.config) };
  });
}
