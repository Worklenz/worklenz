import crypto from "crypto";
import db from "../config/db";
import { IPassportSession } from "../interfaces/passport-session";
import { getEffectiveTeamRole } from "../shared/team-permissions";
import {
  DashboardFilters,
  DashboardMeta,
  DashboardVisibility,
  GadgetInput,
  InvalidDashboardError,
  validateDashboardMeta,
  validateGadgets,
} from "./dashboard-validation";

/**
 * Reporting & Analytics > Custom Dashboards (spec: Worklenz/worklenz-business#2558).
 *
 * Persistence and access rules for `dashboards` and `dashboard_gadgets`. Only the owner can
 * change a dashboard; everyone else who can see it gets it read-only. Visibility never widens
 * what a viewer can see inside a gadget: gadget data queries are scoped server-side to the
 * projects the requesting user can access, so a shared dashboard cannot leak data.
 */

export interface DashboardGadget extends GadgetInput {
  id: string;
}

export interface DashboardRow {
  id: string;
  team_id: string;
  owner_id: string;
  name: string;
  description: string | null;
  visibility: DashboardVisibility;
  visible_roles: string[];
  share_token: string | null;
  filters: DashboardFilters;
  created_at: string;
  updated_at: string;
}

export interface DashboardViewer {
  userId: string;
  /** The viewer's effective role in the current team, as returned by `getEffectiveTeamRole`. */
  role: string;
}

export interface DashboardView extends Omit<DashboardRow, "team_id" | "share_token"> {
  /** Only the owner sees the share token (it is the link they hand out). */
  share_token: string | null;
  can_edit: boolean;
  gadgets: DashboardGadget[];
}

/** Thrown when a dashboard does not exist or the viewer may not see it (deliberately the same). */
export class DashboardNotFoundError extends Error {}

export const viewerFromRequestUser = (user: IPassportSession | undefined): DashboardViewer => ({
  userId: user?.id as string,
  role: getEffectiveTeamRole(user),
});

/**
 * Whether `viewer` may open `dashboard` (already known to belong to the viewer's team).
 * `link` dashboards are not listable, so they are openable only when reached by their token.
 */
export function canViewDashboard(
  dashboard: Pick<DashboardRow, "owner_id" | "visibility" | "visible_roles">,
  viewer: DashboardViewer,
  { viaShareToken = false }: { viaShareToken?: boolean } = {}
): boolean {
  if (dashboard.owner_id === viewer.userId) return true;
  switch (dashboard.visibility) {
    case "workspace":
      return true;
    case "role":
      return dashboard.visible_roles.includes(viewer.role);
    case "link":
      return viaShareToken;
    default:
      return false;
  }
}

const newShareToken = (): string => crypto.randomBytes(24).toString("base64url");

const toView = (row: DashboardRow, gadgets: DashboardGadget[], viewer: DashboardViewer): DashboardView => {
  const { team_id: _teamId, ...rest } = row;
  const isOwner = row.owner_id === viewer.userId;
  return { ...rest, share_token: isOwner ? row.share_token : null, can_edit: isOwner, gadgets };
};

async function loadGadgets(dashboardId: string): Promise<DashboardGadget[]> {
  const result = await db.query(
    `SELECT id, type, x, y, w, h, config
       FROM dashboard_gadgets
      WHERE dashboard_id = $1
      ORDER BY y, x, created_at`,
    [dashboardId]
  );
  return result.rows as DashboardGadget[];
}

async function loadDashboardRow(teamId: string, dashboardId: string): Promise<DashboardRow | undefined> {
  const result = await db.query(`SELECT * FROM dashboards WHERE id = $1 AND team_id = $2`, [dashboardId, teamId]);
  return result.rows[0] as DashboardRow | undefined;
}

/** Loads a dashboard the viewer may see, or throws `DashboardNotFoundError`. */
async function loadVisibleDashboard(teamId: string, dashboardId: string, viewer: DashboardViewer): Promise<DashboardRow> {
  const row = await loadDashboardRow(teamId, dashboardId);
  if (!row || !canViewDashboard(row, viewer)) throw new DashboardNotFoundError("Dashboard not found");
  return row;
}

/** Loads a dashboard only its owner may change. Others get the same not-found as strangers. */
async function loadOwnedDashboard(teamId: string, dashboardId: string, userId: string): Promise<DashboardRow> {
  const row = await loadDashboardRow(teamId, dashboardId);
  if (!row || row.owner_id !== userId) throw new DashboardNotFoundError("Dashboard not found");
  return row;
}

async function withTransaction<T>(work: (query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>) => Promise<T>): Promise<T> {
  const client = await db.connect();
  try {
    await client.query("BEGIN");
    const result = await work((text, params) => client.query(text, params));
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function replaceGadgets(
  query: (text: string, params?: unknown[]) => Promise<{ rows: any[] }>,
  dashboardId: string,
  gadgets: GadgetInput[]
): Promise<void> {
  await query(`DELETE FROM dashboard_gadgets WHERE dashboard_id = $1`, [dashboardId]);
  for (const gadget of gadgets) {
    await query(
      `INSERT INTO dashboard_gadgets (dashboard_id, type, x, y, w, h, config)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
      [dashboardId, gadget.type, gadget.x, gadget.y, gadget.w, gadget.h, JSON.stringify(gadget.config)]
    );
  }
}

export type DashboardSummary = Pick<
  DashboardRow,
  "id" | "owner_id" | "name" | "description" | "visibility" | "created_at" | "updated_at"
> & { can_edit: boolean; gadget_count: number };

/** The viewer's own dashboards plus the ones shared with them. `link` dashboards are not listed. */
export async function listDashboards(teamId: string, viewer: DashboardViewer): Promise<DashboardSummary[]> {
  const result = await db.query(
    `SELECT d.id, d.owner_id, d.name, d.description, d.visibility, d.created_at, d.updated_at,
            (SELECT COUNT(*)::int FROM dashboard_gadgets g WHERE g.dashboard_id = d.id) AS gadget_count
       FROM dashboards d
      WHERE d.team_id = $1
        AND (d.owner_id = $2
             OR d.visibility = 'workspace'
             OR (d.visibility = 'role' AND $3 = ANY (d.visible_roles)))
      ORDER BY (d.owner_id = $2) DESC, d.updated_at DESC`,
    [teamId, viewer.userId, viewer.role]
  );
  return result.rows.map(row => ({ ...row, can_edit: row.owner_id === viewer.userId }));
}

export async function getDashboard(teamId: string, dashboardId: string, viewer: DashboardViewer): Promise<DashboardView> {
  const row = await loadVisibleDashboard(teamId, dashboardId, viewer);
  return toView(row, await loadGadgets(row.id), viewer);
}

/** Opens a `link` dashboard. The token only locates it: the viewer must still be in the team. */
export async function getDashboardByShareToken(teamId: string, token: string, viewer: DashboardViewer): Promise<DashboardView> {
  const result = await db.query(`SELECT * FROM dashboards WHERE share_token = $1 AND team_id = $2`, [token, teamId]);
  const row = result.rows[0] as DashboardRow | undefined;
  if (!row || !canViewDashboard(row, viewer, { viaShareToken: true })) throw new DashboardNotFoundError("Dashboard not found");
  return toView(row, await loadGadgets(row.id), viewer);
}

/** Body: dashboard metadata fields plus an optional `gadgets` list. */
export async function createDashboard(teamId: string, viewer: DashboardViewer, input: unknown): Promise<DashboardView> {
  const meta = validateDashboardMeta(input);
  const gadgets = validateGadgets((input as { gadgets?: unknown }).gadgets ?? []);
  const shareToken = meta.visibility === "link" ? newShareToken() : null;

  const dashboardId = await withTransaction(async query => {
    const inserted = await query(
      `INSERT INTO dashboards (team_id, owner_id, name, description, visibility, visible_roles, share_token, filters)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
       RETURNING id`,
      [teamId, viewer.userId, meta.name, meta.description, meta.visibility, meta.visible_roles, shareToken, JSON.stringify(meta.filters)]
    );
    const id = inserted.rows[0].id as string;
    await replaceGadgets(query, id, gadgets);
    return id;
  });

  return getDashboard(teamId, dashboardId, viewer);
}

/** Partial update of metadata and/or filters. Gadgets are saved separately via `saveDashboardGadgets`. */
export async function updateDashboard(teamId: string, dashboardId: string, viewer: DashboardViewer, input: unknown): Promise<DashboardView> {
  const patch = validateDashboardMeta(input, true);
  const current = await loadOwnedDashboard(teamId, dashboardId, viewer.userId);

  const next: DashboardMeta = {
    name: patch.name ?? current.name,
    description: patch.description !== undefined ? patch.description : current.description,
    visibility: patch.visibility ?? current.visibility,
    visible_roles: patch.visible_roles ?? current.visible_roles,
    filters: patch.filters ?? current.filters,
  };
  // Re-check the combined result, e.g. switching to `role` without ever having chosen roles.
  if (next.visibility === "role" && next.visible_roles.length === 0) {
    throw new InvalidDashboardError("choose at least one role to share this dashboard with");
  }
  // The token exists exactly while the dashboard is link-shared; keep it stable across edits.
  const shareToken = next.visibility === "link" ? current.share_token ?? newShareToken() : null;

  await db.query(
    `UPDATE dashboards
        SET name = $3, description = $4, visibility = $5, visible_roles = $6, share_token = $7,
            filters = $8::jsonb, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND team_id = $2`,
    [dashboardId, teamId, next.name, next.description, next.visibility, next.visible_roles, shareToken, JSON.stringify(next.filters)]
  );
  return getDashboard(teamId, dashboardId, viewer);
}

/** Replaces the dashboard's whole gadget set (which is also its layout) in one transaction. */
export async function saveDashboardGadgets(teamId: string, dashboardId: string, viewer: DashboardViewer, input: unknown): Promise<DashboardView> {
  const gadgets = validateGadgets(input);
  await loadOwnedDashboard(teamId, dashboardId, viewer.userId);

  await withTransaction(async query => {
    await replaceGadgets(query, dashboardId, gadgets);
    await query(`UPDATE dashboards SET updated_at = CURRENT_TIMESTAMP WHERE id = $1`, [dashboardId]);
  });
  return getDashboard(teamId, dashboardId, viewer);
}

/** Invalidates the old link and issues a new one. Only meaningful while the dashboard is link-shared. */
export async function rotateShareToken(teamId: string, dashboardId: string, viewer: DashboardViewer): Promise<DashboardView> {
  const current = await loadOwnedDashboard(teamId, dashboardId, viewer.userId);
  if (current.visibility !== "link") throw new InvalidDashboardError("this dashboard is not shared by link");

  await db.query(`UPDATE dashboards SET share_token = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND team_id = $2`, [
    dashboardId,
    teamId,
    newShareToken(),
  ]);
  return getDashboard(teamId, dashboardId, viewer);
}

export async function deleteDashboard(teamId: string, dashboardId: string, userId: string): Promise<void> {
  await loadOwnedDashboard(teamId, dashboardId, userId);
  // dashboard_gadgets rows go with it (ON DELETE CASCADE).
  await db.query(`DELETE FROM dashboards WHERE id = $1 AND team_id = $2`, [dashboardId, teamId]);
}
