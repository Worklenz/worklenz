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
] as const;
export type OverviewWidgetKey = (typeof OVERVIEW_WIDGET_KEYS)[number];

export interface OverviewWidgetInstance {
  key: OverviewWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
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

/**
 * A saved layout is only ever a bounded list of known widgets with in-grid geometry. Anything else
 * throws `InvalidOverviewLayoutError`, so a malformed or tampered body never reaches the database.
 */
export function validateLayout(input: unknown): OverviewLayout {
  const raw = input as Partial<OverviewLayout> | null;
  if (!raw || typeof raw !== "object") throw new InvalidOverviewLayoutError("layout must be an object");
  if (raw.version !== OVERVIEW_LAYOUT_VERSION) throw new InvalidOverviewLayoutError("layout version is not supported");
  if (!Array.isArray(raw.widgets)) throw new InvalidOverviewLayoutError("layout.widgets must be a list");
  if (raw.widgets.length > MAX_WIDGETS) throw new InvalidOverviewLayoutError("layout has too many widgets");

  const seen = new Set<OverviewWidgetKey>();
  const widgets = raw.widgets.map((entry: unknown): OverviewWidgetInstance => {
    const item = entry as Partial<OverviewWidgetInstance> | null;
    if (!item || typeof item !== "object" || !isKnownKey(item.key)) {
      throw new InvalidOverviewLayoutError("layout has an unknown widget");
    }
    if (seen.has(item.key)) throw new InvalidOverviewLayoutError("layout lists a widget twice");
    seen.add(item.key);

    if (!isIntegerInRange(item.w, 1, GRID_COLS) || !isIntegerInRange(item.x, 0, GRID_COLS - 1) || (item.x as number) + (item.w as number) > GRID_COLS) {
      throw new InvalidOverviewLayoutError("layout has a widget outside the grid");
    }
    if (!isIntegerInRange(item.y, 0, MAX_ROW) || !isIntegerInRange(item.h, 1, MAX_HEIGHT)) {
      throw new InvalidOverviewLayoutError("layout has an invalid widget size");
    }
    if (typeof item.hidden !== "boolean") throw new InvalidOverviewLayoutError("layout has an invalid visibility");

    return { key: item.key, x: item.x, y: item.y, w: item.w, h: item.h, hidden: item.hidden };
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
