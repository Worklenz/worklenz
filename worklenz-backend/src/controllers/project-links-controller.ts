import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";

const MAX_PAGE_SIZE = 100;

// Only http(s) links may be stored — reject javascript:, data:, file: and
// other schemes that should never become a clickable project link.
function isValidHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export default class ProjectLinksController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async list(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const size = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(req.query.size as string) || 20));
    const offset = (page - 1) * size;

    const q = `
      SELECT
        pl.id,
        pl.title,
        pl.url,
        pl.description,
        pl.source_type,
        pl.source_task_id,
        t.name AS source_task_name,
        CONCAT((SELECT key FROM projects WHERE id = pl.project_id), '-', t.task_no) AS source_task_key,
        u.name AS added_by_name,
        pl.created_at,
        pl.updated_at,
        COUNT(*) OVER () AS total
      FROM project_links pl
      LEFT JOIN tasks t ON t.id = pl.source_task_id
      LEFT JOIN users u ON u.id = pl.added_by
      WHERE pl.project_id = $1
      ORDER BY pl.created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(q, [projectId, size, offset]);
    const total = result.rows[0]?.total ? parseInt(result.rows[0].total) : 0;
    const data = result.rows.map(({ total: _t, ...row }) => row);

    return res.status(200).send(new ServerResponse(true, { total, data }));
  }

  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const { title, url, description } = req.body;
    const userId = req.user?.id;
    const teamId = req.user?.team_id;

    if (!title?.trim() || !url?.trim()) {
      return res.status(400).send(new ServerResponse(false, null, "Title and URL are required"));
    }

    if (!isValidHttpUrl(url.trim())) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid URL"));
    }

    const q = `
      INSERT INTO project_links (project_id, team_id, title, url, description, source_type, added_by)
      VALUES ($1, $2, $3, $4, $5, 'manual', $6)
      RETURNING id, title, url, description, source_type, added_by,
        (SELECT name FROM users WHERE id = added_by) AS added_by_name,
        created_at, updated_at
    `;

    const result = await db.query(q, [projectId, teamId, title.trim(), url.trim(), description?.trim() || null, userId]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;
    const { title, url, description } = req.body;

    if (!title?.trim() || !url?.trim()) {
      return res.status(400).send(new ServerResponse(false, null, "Title and URL are required"));
    }

    if (!isValidHttpUrl(url.trim())) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid URL"));
    }

    const q = `
      UPDATE project_links
      SET title = $1, url = $2, description = $3, updated_at = NOW()
      WHERE id = $4 AND project_id = $5 AND source_type = 'manual'
      RETURNING id
    `;

    const result = await db.query(q, [title.trim(), url.trim(), description?.trim() || null, linkId, projectId]);
    if (!result.rowCount) {
      return res.status(404).send(new ServerResponse(false, null, "Link not found or cannot be edited"));
    }

    return res.status(200).send(new ServerResponse(true, null));
  }

  @HandleExceptions()
  public static async remove(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId, linkId } = req.params;

    const q = `
      DELETE FROM project_links
      WHERE id = $1 AND project_id = $2 AND source_type = 'manual'
      RETURNING id
    `;

    const result = await db.query(q, [linkId, projectId]);
    if (!result.rowCount) {
      return res.status(404).send(new ServerResponse(false, null, "Link not found or cannot be deleted"));
    }

    return res.status(200).send(new ServerResponse(true, null));
  }
}
