import { badRequest } from "./errors";
import { OverviewWidgetKey, isOverviewWidgetKey } from "./overview.service";
import { Queryable } from "./types";

export const OVERVIEW_WIDGET_SIZES = ["s", "m", "l"] as const;
export type OverviewWidgetSize = (typeof OVERVIEW_WIDGET_SIZES)[number];

/** Legacy stored shape: an ordered list with S/M/L sizes. Still accepted; the client converts it to the grid. */
export interface OverviewLayoutItem {
  key: OverviewWidgetKey;
  size: OverviewWidgetSize;
  visible: boolean;
}

export interface OverviewWidgetInstance {
  key: OverviewWidgetKey;
  x: number;
  y: number;
  w: number;
  h: number;
  hidden: boolean;
}

/** The 12-column grid layout. */
export interface OverviewGridLayout {
  version: 1;
  widgets: OverviewWidgetInstance[];
}

export type StoredOverviewLayout = OverviewGridLayout | OverviewLayoutItem[];

/** Bumped when the stored shape changes, so the client can discard layouts it cannot read. */
export const OVERVIEW_LAYOUT_VERSION = 1;

const MAX_ITEMS = 40;
const GRID_COLS = 12;
const MAX_ROW = 10_000;
const MAX_HEIGHT = 60;

const isIntegerInRange = (value: unknown, min: number, max: number): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= min && value <= max;

function validateLegacyLayout(input: unknown[]): OverviewLayoutItem[] {
  if (input.length > MAX_ITEMS) throw badRequest("layout has too many widgets", "INVALID_LAYOUT");

  const seen = new Set<string>();
  return input.map((raw: unknown): OverviewLayoutItem => {
    const item = raw as Partial<OverviewLayoutItem> | null;
    if (!item || typeof item !== "object" || !isOverviewWidgetKey(item.key)) {
      throw badRequest("layout has an unknown widget", "INVALID_LAYOUT");
    }
    if (seen.has(item.key)) throw badRequest("layout lists a widget twice", "INVALID_LAYOUT");
    seen.add(item.key);
    if (!(OVERVIEW_WIDGET_SIZES as readonly string[]).includes(item.size as string)) {
      throw badRequest("layout has an invalid widget size", "INVALID_LAYOUT");
    }
    if (typeof item.visible !== "boolean") throw badRequest("layout has an invalid visibility", "INVALID_LAYOUT");
    return { key: item.key, size: item.size as OverviewWidgetSize, visible: item.visible };
  });
}

function validateGridLayout(input: { version?: unknown; widgets?: unknown }): OverviewGridLayout {
  if (input.version !== 1 || !Array.isArray(input.widgets)) {
    throw badRequest("layout has an unsupported shape", "INVALID_LAYOUT");
  }
  if (input.widgets.length > MAX_ITEMS) throw badRequest("layout has too many widgets", "INVALID_LAYOUT");

  const seen = new Set<string>();
  const widgets = input.widgets.map((raw: unknown): OverviewWidgetInstance => {
    const item = raw as Partial<OverviewWidgetInstance> | null;
    if (!item || typeof item !== "object" || !isOverviewWidgetKey(item.key)) {
      throw badRequest("layout has an unknown widget", "INVALID_LAYOUT");
    }
    if (seen.has(item.key)) throw badRequest("layout lists a widget twice", "INVALID_LAYOUT");
    seen.add(item.key);
    if (
      !isIntegerInRange(item.w, 1, GRID_COLS) ||
      !isIntegerInRange(item.x, 0, GRID_COLS - item.w) ||
      !isIntegerInRange(item.y, 0, MAX_ROW) ||
      !isIntegerInRange(item.h, 1, MAX_HEIGHT)
    ) {
      throw badRequest("layout has invalid widget geometry", "INVALID_LAYOUT");
    }
    if (typeof item.hidden !== "boolean") throw badRequest("layout has an invalid visibility", "INVALID_LAYOUT");
    return { key: item.key, x: item.x, y: item.y, w: item.w, h: item.h, hidden: item.hidden };
  });
  return { version: 1, widgets };
}

/** A saved layout is the grid shape, or the legacy list; known keys, no duplicates, sane geometry. Anything else is a 400. */
export function validateLayout(input: unknown): StoredOverviewLayout {
  if (Array.isArray(input)) return validateLegacyLayout(input);
  if (input && typeof input === "object") return validateGridLayout(input as { version?: unknown; widgets?: unknown });
  throw badRequest("layout must be a list or a grid layout", "INVALID_LAYOUT");
}

export interface OverviewLayoutView {
  /** null when the user has never customised: the client renders its default layout. */
  layout: StoredOverviewLayout | null;
  version: number;
}

export async function getOverviewLayout(q: Queryable, teamId: string, userId: string): Promise<OverviewLayoutView> {
  const result = await q.query(
    `SELECT layout, version FROM client_portal_overview_layouts WHERE team_id = $1 AND user_id = $2`,
    [teamId, userId]
  );
  const row = result.rows[0];
  return row ? { layout: row.layout, version: row.version } : { layout: null, version: OVERVIEW_LAYOUT_VERSION };
}

export async function saveOverviewLayout(
  q: Queryable,
  teamId: string,
  userId: string,
  input: unknown
): Promise<OverviewLayoutView> {
  const layout = validateLayout(input);
  await q.query(
    `INSERT INTO client_portal_overview_layouts (team_id, user_id, layout, version)
     VALUES ($1, $2, $3::jsonb, $4)
     ON CONFLICT (team_id, user_id) DO UPDATE
       SET layout = EXCLUDED.layout, version = EXCLUDED.version, updated_at = CURRENT_TIMESTAMP`,
    [teamId, userId, JSON.stringify(layout), OVERVIEW_LAYOUT_VERSION]
  );
  return { layout, version: OVERVIEW_LAYOUT_VERSION };
}

/** Back to the default layout. */
export async function resetOverviewLayout(q: Queryable, teamId: string, userId: string): Promise<OverviewLayoutView> {
  await q.query(`DELETE FROM client_portal_overview_layouts WHERE team_id = $1 AND user_id = $2`, [teamId, userId]);
  return { layout: null, version: OVERVIEW_LAYOUT_VERSION };
}
