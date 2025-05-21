import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";

export default class ProjectRateCardController extends WorklenzControllerBase {
  // Insert multiple roles for a project
  @HandleExceptions()
  public static async insertMany(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, roles } = req.body;
    if (!Array.isArray(roles) || !project_id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid input"));
    }
    const values = roles.map((role: any) => [
      project_id,
      role.job_title_id,
      role.rate
    ]);
    const q = `
      INSERT INTO finance_project_rate_card_roles (project_id, job_title_id, rate)
      VALUES ${values.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",")}
      ON CONFLICT (project_id, job_title_id) DO UPDATE SET rate = EXCLUDED.rate
      RETURNING *;
    `;
    const flatValues = values.flat();
    const result = await db.query(q, flatValues);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  // Get all roles for a project
  @HandleExceptions()
  public static async getFromProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.params;
    const q = `
      SELECT fprr.*, jt.name as jobtitle
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
      WHERE fprr.project_id = $1
      ORDER BY jt.name;
    `;
    const result = await db.query(q, [project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  // Get a single role by id
  @HandleExceptions()
  public static async getFromId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `
      SELECT fprr.*, jt.name as jobtitle
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
      WHERE fprr.id = $1;
    `;
    const result = await db.query(q, [id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  // Update a single role by id
  @HandleExceptions()
  public static async updateFromId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { job_title_id, rate } = req.body;
    const q = `
      UPDATE finance_project_rate_card_roles
      SET job_title_id = $1, rate = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *;
    `;
    const result = await db.query(q, [job_title_id, rate, id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  // Update all roles for a project (delete then insert)
  @HandleExceptions()
  public static async updateFromProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, roles } = req.body;
    if (!Array.isArray(roles) || !project_id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid input"));
    }
    // Delete existing
    await db.query(`DELETE FROM finance_project_rate_card_roles WHERE project_id = $1`, [project_id]);
    // Insert new
    if (roles.length === 0) {
      return res.status(200).send(new ServerResponse(true, []));
    }
    const values = roles.map((role: any) => [
      project_id,
      role.job_title_id,
      role.rate
    ]);
    const q = `
      INSERT INTO finance_project_rate_card_roles (project_id, job_title_id, rate)
      VALUES ${values.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",")}
      RETURNING *;
    `;
    const flatValues = values.flat();
    const result = await db.query(q, flatValues);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  // Delete a single role by id
  @HandleExceptions()
  public static async deleteFromId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `DELETE FROM finance_project_rate_card_roles WHERE id = $1 RETURNING *;`;
    const result = await db.query(q, [id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  // Delete all roles for a project
  @HandleExceptions()
  public static async deleteFromProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.params;
    const q = `DELETE FROM finance_project_rate_card_roles WHERE project_id = $1 RETURNING *;`;
    const result = await db.query(q, [project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
