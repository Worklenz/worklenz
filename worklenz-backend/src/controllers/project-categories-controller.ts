import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { getColor } from "../shared/utils";
import { WorklenzColorShades } from "../shared/constants";
import { SqlHelper } from "../shared/sql-helpers";

export default class ProjectCategoriesController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async create(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Validate name
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : undefined;
    if (!name || name.length === 0) {
      return res
        .status(400)
        .send(new ServerResponse(false, "Category name is required."));
    }

    const q = `
      INSERT INTO project_categories (name, team_id, created_by, color_code)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, color_code;
    `;
    
    // Validate and use provided color_code, or fall back to generated color
    let colorCode: string | null = null;
    if (req.body.color_code) {
      // Validate color - accept both base colors and all shade variations
      const validColors = [
        ...Object.keys(WorklenzColorShades),
        ...Object.values(WorklenzColorShades).flat(),
      ].map((c) => c.toLowerCase());
      
      const providedColor = req.body.color_code.trim().toLowerCase();
      if (validColors.includes(providedColor)) {
        // Find the original case color from the valid colors
        const allColors = [
          ...Object.keys(WorklenzColorShades),
          ...Object.values(WorklenzColorShades).flat(),
        ];
        colorCode = allColors.find(c => c.toLowerCase() === providedColor) || providedColor;
      } else {
        // Invalid color provided, fall back to generated color
        colorCode = name ? getColor(name) : null;
      }
    } else {
      // No color provided, generate one
      colorCode = name ? getColor(name) : null;
    }
    
    const result = await db.query(q, [
      name,
      req.user?.team_id,
      req.user?.id,
      colorCode,
    ]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, name, color_code, (SELECT COUNT(*) FROM projects WHERE category_id = project_categories.id) AS usage
      FROM project_categories
      WHERE team_id = $1;
    `;
    const result = await db.query(q, [req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
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
  public static async getByMultipleTeams(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teams = await this.getTeamsByOrg(req.user?.team_id as string);
    const teamIds = teams.map((team) => team.id);

    // Handle empty teams array - return empty result
    if (teamIds.length === 0) {
      return res.status(200).send(new ServerResponse(true, []));
    }

    const { clause, params } = SqlHelper.buildInClause(teamIds, 1);

    const q = `SELECT id, name, color_code FROM project_categories WHERE team_id IN (${clause})`;

    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async update(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    // Validate color type first
    if (typeof req.body.color !== 'string' || !req.body.color) {
      return res.status(400).send(new ServerResponse(false, "Invalid color"));
    }

    // Validate color - accept both base colors and all shade variations
    const validColors = [
      ...Object.keys(WorklenzColorShades),
      ...Object.values(WorklenzColorShades).flat(),
    ].map((c) => c.toLowerCase());
    if (!validColors.includes(req.body.color.toLowerCase())) {
      return res.status(400).send(new ServerResponse(false, "Invalid color"));
    }

    // Validate name
    const name =
      typeof req.body.name === "string" ? req.body.name.trim() : undefined;
    if (!name || name.length === 0) {
      return res
        .status(400)
        .send(new ServerResponse(false, "Category name is required."));
    }

    const q = `
      UPDATE project_categories
      SET name = $2, color_code = $3
      WHERE id = $1
        AND team_id = $4;
    `;
    const result = await db.query(q, [
      req.params.id,
      name,
      req.body.color,
      req.user?.team_id,
    ]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
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
