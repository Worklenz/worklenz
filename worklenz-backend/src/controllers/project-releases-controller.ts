import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";

interface IReleaseInput {
  name: string;
  description: string | null;
  target_date: string | null;
}

type ReleaseInputResult = { input: IReleaseInput; error?: never } | { input?: never; error: string };

const UNIQUE_VIOLATION = "23505";
const CRITICAL_PRIORITY_VALUE = 3;

export default class ProjectReleasesController extends WorklenzControllerBase {
  private static readonly NAME_MAX_LENGTH = 50;
  private static readonly DESCRIPTION_MAX_LENGTH = 1000;
  private static readonly MAX_BULK_ITEMS = 500;
  private static readonly DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

  private static readonly RELEASE_SELECT = `
    SELECT pr.id,
           pr.project_id,
           pr.name,
           pr.description,
           TO_CHAR(pr.target_date, 'YYYY-MM-DD') AS target_date,
           pr.status,
           pr.released_at,
           pr.created_at,
           COALESCE(stats.issue_count, 0)::INT AS issue_count,
           COALESCE(stats.done_issue_count, 0)::INT AS done_issue_count,
           COALESCE(stats.open_critical_bug_count, 0)::INT AS open_critical_bug_count,
           COALESCE(stats.blocked_count, 0)::INT AS blocked_count,
           COALESCE(stats.total_points, 0)::FLOAT AS total_points,
           COALESCE(stats.done_points, 0)::FLOAT AS done_points
    FROM project_releases pr
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS issue_count,
             COUNT(*) FILTER (WHERE stsc.is_done IS TRUE) AS done_issue_count,
             COUNT(*) FILTER (
               WHERE t.issue_type = 'bug'
                 AND tp.value >= ${CRITICAL_PRIORITY_VALUE}
                 AND stsc.is_done IS NOT TRUE
             ) AS open_critical_bug_count,
             COUNT(*) FILTER (WHERE t.is_blocked IS TRUE AND stsc.is_done IS NOT TRUE) AS blocked_count,
             SUM(t.story_points) AS total_points,
             SUM(t.story_points) FILTER (WHERE stsc.is_done IS TRUE) AS done_points
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.status_id
      LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
      LEFT JOIN task_priorities tp ON tp.id = t.priority_id
      WHERE t.release_id = pr.id
        AND t.archived IS FALSE
    ) stats ON TRUE`;

  private static readonly ITEM_SELECT = `
    SELECT t.id,
           CONCAT(p.key, '-', t.task_no) AS task_key,
           t.name,
           COALESCE(t.issue_type, 'task') AS issue_type,
           t.parent_task_id,
           t.story_points,
           t.is_blocked,
           t.release_id,
           ts.name AS status_name,
           stsc.color_code AS status_color,
           stsc.color_code_dark AS status_color_dark,
           COALESCE(stsc.is_done, FALSE) AS is_done,
           tp.value AS priority_value,
           pe.id AS epic_id,
           pe.name AS epic_name,
           pe.color_code AS epic_color,
           sprint.id AS sprint_id,
           sprint.name AS sprint_name,
           assignee.name AS assignee_name,
           assignee.avatar_url AS assignee_avatar_url
    FROM tasks t
    INNER JOIN projects p ON p.id = t.project_id
    LEFT JOIN task_statuses ts ON ts.id = t.status_id
    LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
    LEFT JOIN task_priorities tp ON tp.id = t.priority_id
    LEFT JOIN project_epics pe ON pe.id = t.epic_id
    LEFT JOIN LATERAL (
      SELECT pp.id, pp.name
      FROM task_phase tph
      INNER JOIN project_phases pp ON pp.id = tph.phase_id
      WHERE tph.task_id = t.id
      LIMIT 1
    ) sprint ON TRUE
    LEFT JOIN LATERAL (
      SELECT tmiv.name, tmiv.avatar_url
      FROM tasks_assignees ta
      INNER JOIN team_member_info_view tmiv ON tmiv.team_member_id = ta.team_member_id
      WHERE ta.task_id = t.id
      ORDER BY ta.created_at
      LIMIT 1
    ) assignee ON TRUE`;

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const q = `${this.RELEASE_SELECT}
      WHERE pr.project_id = $1
      ORDER BY (pr.status = 'released'),
               CASE WHEN pr.status = 'released' THEN NULL ELSE pr.target_date END NULLS LAST,
               pr.released_at DESC NULLS LAST,
               pr.created_at DESC;`;
    const result = await db.query(q, [projectId]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getItems(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const releaseId = req.params.id;
    const projectId = req.query.project_id as string;
    if (!isValidUuid(releaseId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const q = `${this.ITEM_SELECT}
      WHERE t.release_id = $1
        AND t.project_id = $2
        AND t.archived IS FALSE
      ORDER BY COALESCE(stsc.is_done, FALSE), t.task_no;`;
    const result = await db.query(q, [releaseId, projectId]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getAvailableItems(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const q = `${this.ITEM_SELECT}
      WHERE t.project_id = $1
        AND t.release_id IS NULL
        AND t.parent_task_id IS NULL
        AND t.archived IS FALSE
      ORDER BY t.task_no DESC;`;
    const result = await db.query(q, [projectId]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const {input, error} = this.parseReleaseInput(req.body);
    if (error || !input) {
      return res.status(400).send(new ServerResponse(false, null, error));
    }

    const q = `
      INSERT INTO project_releases (project_id, name, description, target_date, created_by)
      SELECT $1, $2, $3, $4::DATE, $5
      WHERE EXISTS (SELECT 1 FROM projects WHERE id = $1 AND team_id = $6)
      RETURNING id;`;
    try {
      const result = await db.query(q, [
        projectId,
        input.name,
        input.description,
        input.target_date,
        req.user?.id,
        req.user?.team_id,
      ]);
      const [created] = result.rows;
      if (!created) {
        return res.status(404).send(new ServerResponse(false, null, "Project not found"));
      }
      return res.status(200).send(new ServerResponse(true, await this.getReleaseById(created.id)));
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        return res.status(409).send(new ServerResponse(false, null, "A release with this name already exists"));
      }
      throw err;
    }
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const releaseId = req.params.id;
    const projectId = req.body?.project_id;
    if (!isValidUuid(releaseId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const {input, error} = this.parseReleaseInput(req.body);
    if (error || !input) {
      return res.status(400).send(new ServerResponse(false, null, error));
    }

    const q = `
      UPDATE project_releases
      SET name        = $3,
          description = $4,
          target_date = $5::DATE,
          updated_at  = CURRENT_TIMESTAMP
      WHERE id = $1
        AND project_id = $2
      RETURNING id;`;
    try {
      const result = await db.query(q, [releaseId, projectId, input.name, input.description, input.target_date]);
      if (!result.rows.length) {
        return res.status(404).send(new ServerResponse(false, null, "Release not found"));
      }
      return res.status(200).send(new ServerResponse(true, await this.getReleaseById(releaseId)));
    } catch (err) {
      if (this.isUniqueViolation(err)) {
        return res.status(409).send(new ServerResponse(false, null, "A release with this name already exists"));
      }
      throw err;
    }
  }

  @HandleExceptions()
  public static async markReleased(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const releaseId = req.params.id;
    const projectId = req.body?.project_id;
    if (!isValidUuid(releaseId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const q = `
      UPDATE project_releases
      SET status      = 'released',
          released_at = CURRENT_TIMESTAMP,
          updated_at  = CURRENT_TIMESTAMP
      WHERE id = $1
        AND project_id = $2
        AND status = 'unreleased'
      RETURNING id;`;
    const result = await db.query(q, [releaseId, projectId]);
    if (!result.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Release not found or already released"));
    }
    return res.status(200).send(new ServerResponse(true, await this.getReleaseById(releaseId)));
  }

  @HandleExceptions()
  public static async addItems(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const releaseId = req.params.id;
    const projectId = req.body?.project_id;
    const taskIds: unknown = req.body?.task_ids;
    if (!isValidUuid(releaseId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }
    if (!Array.isArray(taskIds) || !taskIds.length || taskIds.length > this.MAX_BULK_ITEMS) {
      return res.status(400).send(new ServerResponse(false, null, "Select at least one work item"));
    }
    if (!taskIds.every(id => typeof id === "string" && isValidUuid(id))) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid work item"));
    }

    const lockError = await this.getUnreleasedReleaseError(releaseId, projectId);
    if (lockError) {
      return res.status(lockError.status).send(new ServerResponse(false, null, lockError.message));
    }

    const q = `
      UPDATE tasks
      SET release_id = $1
      WHERE id = ANY($3::UUID[])
        AND project_id = $2
        AND release_id IS NULL
        AND archived IS FALSE
      RETURNING id;`;
    const result = await db.query(q, [releaseId, projectId, taskIds]);
    return res.status(200).send(new ServerResponse(true, {
      added_count: result.rowCount ?? 0,
      release: await this.getReleaseById(releaseId),
    }));
  }

  @HandleExceptions()
  public static async removeItem(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const releaseId = req.params.id;
    const taskId = req.params.taskId;
    const projectId = req.query.project_id as string;
    if (!isValidUuid(releaseId) || !isValidUuid(taskId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const lockError = await this.getUnreleasedReleaseError(releaseId, projectId);
    if (lockError) {
      return res.status(lockError.status).send(new ServerResponse(false, null, lockError.message));
    }

    const result = await db.query(
      `UPDATE tasks SET release_id = NULL
       WHERE id = $1 AND project_id = $2 AND release_id = $3
       RETURNING id;`,
      [taskId, projectId, releaseId]
    );
    if (!result.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Work item not found in this release"));
    }
    return res.status(200).send(new ServerResponse(true, await this.getReleaseById(releaseId)));
  }

  /** Sets or clears a task's release from the task drawer. Items in a released version are read-only. */
  @HandleExceptions()
  public static async assignTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.taskId;
    const projectId = req.body?.project_id;
    const releaseId: string | null = req.body?.release_id ?? null;

    if (!isValidUuid(taskId) || !isValidUuid(projectId) || (releaseId !== null && !isValidUuid(releaseId))) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const q = `
      UPDATE tasks t
      SET release_id = $3::UUID
      WHERE t.id = $1
        AND t.project_id = $2
        AND NOT EXISTS (
          SELECT 1 FROM project_releases cur
          WHERE cur.id = t.release_id AND cur.status = 'released'
        )
        AND (
          $3::UUID IS NULL
          OR EXISTS (
            SELECT 1 FROM project_releases pr
            WHERE pr.id = $3::UUID AND pr.project_id = $2 AND pr.status = 'unreleased'
          )
        )
      RETURNING t.id, t.release_id;`;
    const result = await db.query(q, [taskId, projectId, releaseId]);
    const [data] = result.rows;
    if (!data) {
      return res.status(409).send(
        new ServerResponse(false, null, "Release not found, or the work item belongs to a released version")
      );
    }
    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getReleaseById(releaseId: string) {
    const result = await db.query(`${this.RELEASE_SELECT} WHERE pr.id = $1;`, [releaseId]);
    return result.rows[0] ?? null;
  }

  private static async getUnreleasedReleaseError(releaseId: string, projectId: string) {
    const result = await db.query(
      "SELECT status FROM project_releases WHERE id = $1 AND project_id = $2;",
      [releaseId, projectId]
    );
    const [release] = result.rows;
    if (!release) return {status: 404, message: "Release not found"};
    if (release.status === "released") return {status: 409, message: "Released versions are read-only"};
    return null;
  }

  private static isUniqueViolation(err: unknown): boolean {
    return typeof err === "object" && err !== null && (err as { code?: string }).code === UNIQUE_VIOLATION;
  }

  private static parseReleaseInput(body: Record<string, unknown> | undefined): ReleaseInputResult {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return {error: "Release name is required"};
    if (name.length > this.NAME_MAX_LENGTH) return {error: "Release name is too long"};

    const rawDescription = typeof body?.description === "string" ? body.description.trim() : "";
    if (rawDescription.length > this.DESCRIPTION_MAX_LENGTH) {
      return {error: "Release description is too long"};
    }

    const rawTarget = typeof body?.target_date === "string" && body.target_date ? body.target_date : null;
    if (rawTarget && (!this.DATE_PATTERN.test(rawTarget) || Number.isNaN(Date.parse(rawTarget)))) {
      return {error: "Invalid target date"};
    }

    return {
      input: {
        name,
        description: rawDescription || null,
        target_date: rawTarget,
      },
    };
  }
}
