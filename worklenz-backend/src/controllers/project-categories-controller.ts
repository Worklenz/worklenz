import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import { WorklenzColorCodes } from "../shared/constants";

export default class ProjectCategoriesController extends WorklenzControllerBase {

  private static flatString(text: string) {
    return (text || "").split(",").map(s => `'${s}'`).join(",");
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO project_categories (name, team_id, created_by, color_code)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, color_code;
    `;
    const name = req.body.name.trim();
    const result = await db.query(q, [name, req.user?.team_id, req.user?.id, name ? getColor(name) : null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, name, color_code, (SELECT COUNT(*) FROM projects WHERE category_id = project_categories.id) AS usage
      FROM project_categories
      WHERE team_id = $1;
    `;
    const result = await db.query(q, [req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `  
    SELECT id, name, color_code, (SELECT COUNT(*) FROM projects WHERE category_id = project_categories.id) AS usage
    FROM project_categories
    WHERE team_id = $1;`;
    const result = await db.query(q, [req.params.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
  
  private static async getTeamsByOrg(teamId: string) {
    const q = `SELECT id FROM teams WHERE in_organization(id, $1)`;
    const result = await db.query(q, [teamId]);
    return result.rows;
  }

  @HandleExceptions()
  public static async getByMultipleTeams(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const teams = await this.getTeamsByOrg(req.user?.team_id as string);
    const teamIds = teams.map(team => team.id).join(",");

    const q = `SELECT id, name, color_code FROM project_categories WHERE team_id IN (${this.flatString(teamIds)});`;

    const result = await db.query(q);
    return res.status(200).send(new ServerResponse(true, result.rows));

  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE project_categories
      SET color_code = $2
      WHERE id = $1
        AND team_id = $3;
    `;

    if (!WorklenzColorCodes.includes(req.body.color))
      return res.status(400).send(new ServerResponse(false, null));

    const result = await db.query(q, [req.params.id, req.body.color, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      DELETE
      FROM project_categories
      WHERE id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
