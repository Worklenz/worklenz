import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";

interface IEpicInput {
  name: string;
  description: string | null;
  color_code: string;
  owner_id: string | null;
  is_archived: boolean;
}

type EpicInputResult = { input: IEpicInput; error?: never } | { input?: never; error: string };

export default class ProjectEpicsController extends WorklenzControllerBase {
  private static readonly NAME_MAX_LENGTH = 100;
  private static readonly DESCRIPTION_MAX_LENGTH = 1000;
  private static readonly DEFAULT_COLOR = "#722ed1";
  private static readonly COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

  private static readonly EPIC_SELECT = `
    SELECT pe.id,
           pe.project_id,
           pe.name,
           pe.description,
           pe.color_code,
           pe.owner_id,
           tmiv.name AS owner_name,
           tmiv.avatar_url AS owner_avatar_url,
           pe.is_archived,
           pe.sort_index,
           pe.created_at,
           COALESCE(stats.issue_count, 0)::INT AS issue_count,
           COALESCE(stats.done_issue_count, 0)::INT AS done_issue_count,
           COALESCE(stats.total_points, 0)::FLOAT AS total_points,
           COALESCE(stats.done_points, 0)::FLOAT AS done_points
    FROM project_epics pe
    LEFT JOIN team_member_info_view tmiv ON tmiv.team_member_id = pe.owner_id
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS issue_count,
             COUNT(*) FILTER (WHERE stsc.is_done IS TRUE) AS done_issue_count,
             SUM(t.story_points) AS total_points,
             SUM(t.story_points) FILTER (WHERE stsc.is_done IS TRUE) AS done_points
      FROM tasks t
      LEFT JOIN task_statuses ts ON ts.id = t.status_id
      LEFT JOIN sys_task_status_categories stsc ON stsc.id = ts.category_id
      WHERE t.epic_id = pe.id
        AND t.archived IS FALSE
    ) stats ON TRUE`;

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.query.project_id as string;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const q = `${this.EPIC_SELECT}
      WHERE pe.project_id = $1
      ORDER BY pe.is_archived, pe.sort_index, pe.created_at;`;
    const result = await db.query(q, [projectId]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const {input, error} = this.parseEpicInput(req.body);
    if (error || !input) {
      return res.status(400).send(new ServerResponse(false, null, error));
    }

    const ownerError = await this.validateOwner(input.owner_id, req.user?.team_id);
    if (ownerError) {
      return res.status(400).send(new ServerResponse(false, null, ownerError));
    }

    const q = `
      INSERT INTO project_epics (project_id, name, description, color_code, owner_id, sort_index, created_by)
      SELECT $1, $2, $3, $4, $5,
             COALESCE((SELECT MAX(sort_index) FROM project_epics WHERE project_id = $1), 0) + 1,
             $6
      WHERE EXISTS (SELECT 1 FROM projects WHERE id = $1 AND team_id = $7)
      RETURNING id;`;
    const result = await db.query(q, [
      projectId,
      input.name,
      input.description,
      input.color_code,
      input.owner_id,
      req.user?.id,
      req.user?.team_id,
    ]);
    const [created] = result.rows;
    if (!created) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }

    return res.status(200).send(new ServerResponse(true, await this.getEpicById(created.id)));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const epicId = req.params.id;
    const projectId = req.body?.project_id;
    if (!isValidUuid(epicId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const {input, error} = this.parseEpicInput(req.body);
    if (error || !input) {
      return res.status(400).send(new ServerResponse(false, null, error));
    }

    const ownerError = await this.validateOwner(input.owner_id, req.user?.team_id);
    if (ownerError) {
      return res.status(400).send(new ServerResponse(false, null, ownerError));
    }

    const q = `
      UPDATE project_epics
      SET name        = $3,
          description = $4,
          color_code  = $5,
          owner_id    = $6,
          is_archived = $7,
          updated_at  = CURRENT_TIMESTAMP
      WHERE id = $1
        AND project_id = $2
      RETURNING id;`;
    const result = await db.query(q, [
      epicId,
      projectId,
      input.name,
      input.description,
      input.color_code,
      input.owner_id,
      input.is_archived,
    ]);
    if (!result.rows.length) {
      return res.status(404).send(new ServerResponse(false, null, "Epic not found"));
    }

    return res.status(200).send(new ServerResponse(true, await this.getEpicById(epicId)));
  }

  @HandleExceptions()
  public static async assignTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.taskId;
    const projectId = req.body?.project_id;
    const epicId: string | null = req.body?.epic_id ?? null;

    if (!isValidUuid(taskId) || !isValidUuid(projectId) || (epicId !== null && !isValidUuid(epicId))) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }

    const q = `
      UPDATE tasks
      SET epic_id = $3::UUID
      WHERE id = $1
        AND project_id = $2
        AND (
          $3::UUID IS NULL
          OR EXISTS (
            SELECT 1 FROM project_epics
            WHERE id = $3::UUID AND project_id = $2 AND is_archived IS FALSE
          )
        )
      RETURNING id, epic_id;`;
    const result = await db.query(q, [taskId, projectId, epicId]);
    const [data] = result.rows;
    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Task or Epic not found"));
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getEpicById(epicId: string) {
    const result = await db.query(`${this.EPIC_SELECT} WHERE pe.id = $1;`, [epicId]);
    return result.rows[0] ?? null;
  }

  private static async validateOwner(ownerId: string | null, teamId?: string): Promise<string | null> {
    if (!ownerId) return null;
    const result = await db.query(
      "SELECT 1 FROM team_members WHERE id = $1 AND team_id = $2;",
      [ownerId, teamId]
    );
    return result.rows.length ? null : "Epic owner must be a member of this team";
  }

  private static parseEpicInput(body: Record<string, unknown> | undefined): EpicInputResult {
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    if (!name) return {error: "Epic name is required"};
    if (name.length > this.NAME_MAX_LENGTH) return {error: "Epic name is too long"};

    const rawDescription = typeof body?.description === "string" ? body.description.trim() : "";
    if (rawDescription.length > this.DESCRIPTION_MAX_LENGTH) {
      return {error: "Epic description is too long"};
    }

    const rawColor = typeof body?.color_code === "string" ? body.color_code : this.DEFAULT_COLOR;
    if (!this.COLOR_PATTERN.test(rawColor)) return {error: "Invalid Epic color"};

    const ownerId = typeof body?.owner_id === "string" && body.owner_id ? body.owner_id : null;
    if (ownerId && !isValidUuid(ownerId)) return {error: "Invalid Epic owner"};

    return {
      input: {
        name,
        description: rawDescription || null,
        color_code: rawColor,
        owner_id: ownerId,
        is_archived: body?.is_archived === true,
      },
    };
  }
}
