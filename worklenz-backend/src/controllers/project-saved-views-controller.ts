import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";
import {
  SAVED_VIEWS_PER_PROJECT_LIMIT,
  validateSavedViewBaseView,
  validateSavedViewConfig,
  validateSavedViewName,
} from "../shared/project-saved-views";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SELECT_COLUMNS = `
  sv.id,
  sv.project_id,
  sv.name,
  sv.base_view,
  sv.config,
  sv.sort_order,
  sv.created_by,
  (SELECT name FROM users WHERE id = sv.created_by) AS created_by_name,
  sv.created_at,
  sv.updated_at
`;

export default class ProjectSavedViewsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async list(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;

    const q = `
      SELECT ${SELECT_COLUMNS}
      FROM project_saved_views sv
      WHERE sv.project_id = $1
      ORDER BY sv.sort_order, sv.created_at
    `;
    const result = await db.query(q, [projectId]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;

    const name = validateSavedViewName(req.body?.name);
    if (!name.ok) return res.status(400).send(new ServerResponse(false, null, name.error));

    const baseView = validateSavedViewBaseView(req.body?.base_view);
    if (!baseView.ok) return res.status(400).send(new ServerResponse(false, null, baseView.error));

    const config = validateSavedViewConfig(req.body?.config);
    if (!config.ok) return res.status(400).send(new ServerResponse(false, null, config.error));

    // The limit check and insert run as one statement so concurrent creates cannot overshoot it.
    const q = `
      WITH existing AS (
        SELECT COUNT(*) AS total, COALESCE(MAX(sort_order), -1) AS max_order
        FROM project_saved_views
        WHERE project_id = $1
      ),
      inserted AS (
        INSERT INTO project_saved_views (project_id, created_by, name, base_view, config, sort_order)
        SELECT $1, $2, $3, $4, $5::JSONB, existing.max_order + 1
        FROM existing
        WHERE existing.total < $6
        RETURNING *
      )
      SELECT ${SELECT_COLUMNS}
      FROM inserted sv
    `;
    const result = await db.query(q, [
      projectId,
      req.user?.id,
      name.value,
      baseView.value,
      JSON.stringify(config.value),
      SAVED_VIEWS_PER_PROJECT_LIMIT,
    ]);

    if (!result.rowCount) {
      return res
        .status(400)
        .send(
          new ServerResponse(
            false,
            null,
            `A project can have up to ${SAVED_VIEWS_PER_PROJECT_LIMIT} saved views`
          )
        );
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId, viewId } = req.params;
    if (!UUID_PATTERN.test(viewId)) {
      return res.status(404).send(new ServerResponse(false, null, "Saved view not found"));
    }

    const updates: string[] = [];
    const params: unknown[] = [];

    if (req.body?.name !== undefined) {
      const name = validateSavedViewName(req.body.name);
      if (!name.ok) return res.status(400).send(new ServerResponse(false, null, name.error));
      params.push(name.value);
      updates.push(`name = $${params.length}`);
    }

    if (req.body?.config !== undefined) {
      const config = validateSavedViewConfig(req.body.config);
      if (!config.ok) return res.status(400).send(new ServerResponse(false, null, config.error));
      params.push(JSON.stringify(config.value));
      updates.push(`config = $${params.length}::JSONB`);
    }

    if (!updates.length) {
      return res.status(400).send(new ServerResponse(false, null, "Nothing to update"));
    }

    params.push(viewId, projectId);
    const q = `
      WITH updated AS (
        UPDATE project_saved_views
        SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
        WHERE id = $${params.length - 1} AND project_id = $${params.length}
        RETURNING *
      )
      SELECT ${SELECT_COLUMNS}
      FROM updated sv
    `;
    const result = await db.query(q, params);
    if (!result.rowCount) {
      return res.status(404).send(new ServerResponse(false, null, "Saved view not found"));
    }

    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  @HandleExceptions()
  public static async remove(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId, viewId } = req.params;
    if (!UUID_PATTERN.test(viewId)) {
      return res.status(404).send(new ServerResponse(false, null, "Saved view not found"));
    }

    const q = `
      DELETE FROM project_saved_views
      WHERE id = $1 AND project_id = $2
      RETURNING id
    `;
    const result = await db.query(q, [viewId, projectId]);
    if (!result.rowCount) {
      return res.status(404).send(new ServerResponse(false, null, "Saved view not found"));
    }

    return res.status(200).send(new ServerResponse(true, null));
  }
}
