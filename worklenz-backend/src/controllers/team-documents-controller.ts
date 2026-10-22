import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IPassportSession } from "../interfaces/passport-session";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { isTeamLeadFromSession } from "../shared/team-permissions";
import WorklenzControllerBase from "./worklenz-controller-base";

/**
 * Documents the caller can open on a project Docs tab:
 * owner, admin, and team lead see every project in the active team;
 * members see projects they belong to; guests see none.
 */
const PERMITTED_DOCUMENTS = `
  p.team_id = $1
  AND d.deleted_at IS NULL
  AND ($2::boolean OR is_member_of_project(p.id, $3::uuid, $1::uuid))
`;

interface ScopeQuery {
  teamId: string;
  userId: string;
  seesAll: boolean;
}

interface SummaryRow {
  id: string;
  project_id: string;
  parent_id: string | null;
  title: string;
  position: number;
  updated_at: Date | string;
  updated_by_name?: string | null;
  project_name: string;
  project_color?: string | null;
}

const toIso = (value: Date | string): string =>
  value instanceof Date ? value.toISOString() : new Date(value).toISOString();

const escapeLike = (value: string): string => value.replace(/[\\%_]/g, char => `\\${char}`);

const snippetFor = (title: string, text: string, query: string): string => {
  const haystack = text || "";
  const index = haystack.toLowerCase().indexOf(query.toLowerCase());
  if (index < 0) return title;
  const start = Math.max(0, index - 40);
  const slice = haystack.slice(start, start + 120).replace(/\s+/g, " ").trim();
  return `${start > 0 ? "…" : ""}${slice}`;
};

const scopeFor = (user: IPassportSession | undefined): ScopeQuery | "unauthorized" | "none" => {
  if (!user?.id || !user.team_id) return "unauthorized";
  // Owners and admins keep docs access. Every other guest is denied, including team leads.
  if (user.is_guest && !user.owner && !user.is_admin) return "none";
  return {
    teamId: user.team_id,
    userId: user.id,
    seesAll: !!user.owner || !!user.is_admin || isTeamLeadFromSession(user),
  };
};

const presentSummary = (row: SummaryRow) => ({
  id: row.id,
  project_id: row.project_id,
  parent_id: row.parent_id,
  title: row.title,
  position: row.position,
  updated_at: toIso(row.updated_at),
  updated_by_name: row.updated_by_name || null,
  project_name: row.project_name,
  project_color: row.project_color || null,
});

export default class TeamDocumentsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async list(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const scope = scopeFor(req.user);
    if (scope === "unauthorized") {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }
    if (scope === "none") {
      return res.status(200).send(new ServerResponse(true, []));
    }

    const result = await db.query(
      `SELECT d.id, d.project_id, d.parent_id, d.title, d.position, d.updated_at,
              u.name AS updated_by_name, p.name AS project_name, p.color_code AS project_color
       FROM project_documents d
       INNER JOIN projects p ON p.id = d.project_id
       LEFT JOIN users u ON u.id = d.updated_by
       WHERE ${PERMITTED_DOCUMENTS}
       ORDER BY p.name ASC, d.position ASC, d.created_at ASC`,
      [scope.teamId, scope.seesAll, scope.userId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows.map((row: SummaryRow) => presentSummary(row))));
  }

  @HandleExceptions()
  public static async search(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const scope = scopeFor(req.user);
    if (scope === "unauthorized") {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }
    const query = String(req.query.q || "").trim();
    if (query.length < 2) {
      return res.status(400).send(new ServerResponse(false, null, "Search must be at least 2 characters"));
    }
    if (scope === "none") {
      return res.status(200).send(new ServerResponse(true, []));
    }

    const result = await db.query(
      `SELECT d.id, d.parent_id, d.title, d.content_text, d.updated_at, d.project_id, p.name AS project_name
       FROM project_documents d
       INNER JOIN projects p ON p.id = d.project_id
       WHERE ${PERMITTED_DOCUMENTS}
         AND (d.title ILIKE $4 ESCAPE '\\' OR d.content_text ILIKE $4 ESCAPE '\\')
       ORDER BY d.updated_at DESC
       LIMIT 20`,
      [scope.teamId, scope.seesAll, scope.userId, `%${escapeLike(query)}%`]
    );

    const body = result.rows.map((row: {
      id: string;
      parent_id: string | null;
      title: string;
      content_text: string;
      updated_at: Date | string;
      project_id: string;
      project_name: string;
    }) => ({
      id: row.id,
      parent_id: row.parent_id,
      title: row.title,
      snippet: snippetFor(row.title, row.content_text || "", query),
      updated_at: toIso(row.updated_at),
      project_id: row.project_id,
      project_name: row.project_name,
    }));

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async favorites(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const scope = scopeFor(req.user);
    if (scope === "unauthorized") {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }
    if (scope === "none") {
      return res.status(200).send(new ServerResponse(true, []));
    }

    const result = await db.query(
      `SELECT f.document_id
       FROM project_document_favorites f
       INNER JOIN project_documents d ON d.id = f.document_id
       INNER JOIN projects p ON p.id = d.project_id
       WHERE f.user_id = $3
         AND ${PERMITTED_DOCUMENTS}`,
      [scope.teamId, scope.seesAll, scope.userId]
    );

    return res.status(200).send(new ServerResponse(true, result.rows.map((row: { document_id: string }) => row.document_id)));
  }
}
