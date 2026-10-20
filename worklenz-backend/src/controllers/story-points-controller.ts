import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {isValidUuid} from "../shared/validation-helpers";

export default class StoryPointsController extends WorklenzControllerBase {
  private static readonly MAX_POINT_VALUE = 1000;
  private static readonly MAX_SCALE_LENGTH = 30;

  @HandleExceptions()
  public static async updateScale(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body?.project_id;
    if (!isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project id"));
    }

    const scale = this.parseScale(req.body?.scale);
    if (!scale) {
      return res.status(400).send(new ServerResponse(false, null, "Use comma-separated, non-negative numbers only"));
    }

    const q = `
      UPDATE projects
      SET story_point_scale = $2::DOUBLE PRECISION[]
      WHERE id = $1
        AND team_id = $3
      RETURNING id, story_point_scale;`;
    const result = await db.query(q, [projectId, scale, req.user?.team_id]);
    const [data] = result.rows;
    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Project not found"));
    }
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async setTaskPoints(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const taskId = req.params.taskId;
    const projectId = req.body?.project_id;
    const rawPoints = req.body?.story_points;
    const storyPoints = rawPoints === null || rawPoints === undefined ? null : Number(rawPoints);

    if (!isValidUuid(taskId) || !isValidUuid(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid request"));
    }
    if (storyPoints !== null && !this.isValidPointValue(storyPoints)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid story points"));
    }

    const q = `
      UPDATE tasks
      SET story_points = $3::DOUBLE PRECISION
      WHERE id = $1
        AND project_id = $2
      RETURNING id, story_points;`;
    const result = await db.query(q, [taskId, projectId, storyPoints]);
    const [data] = result.rows;
    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Task not found"));
    }
    return res.status(200).send(new ServerResponse(true, data));
  }

  private static isValidPointValue(value: number): boolean {
    return Number.isFinite(value) && value >= 0 && value <= this.MAX_POINT_VALUE;
  }

  /** Returns the sorted, de-duplicated scale, or null when any value is invalid. */
  private static parseScale(value: unknown): number[] | null {
    if (!Array.isArray(value) || value.length === 0) return null;
    const numbers = value.map(Number);
    if (numbers.some(point => !this.isValidPointValue(point))) return null;
    const scale = [...new Set(numbers)].sort((a, b) => a - b);
    return scale.length <= this.MAX_SCALE_LENGTH ? scale : null;
  }
}
