import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {slugify} from "../shared/utils";
import {IProjectFolder} from "../interfaces/project-folder";

export default class ProjectFoldersController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO project_folders (name, key, created_by, team_id, color_code)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, key, color_code;
    `;

    const name = req.body.name?.trim() || null;
    const key = slugify(name);
    const createdBy = req.user?.id ?? null;
    const teamId = req.user?.team_id ?? null;
    const colorCode = req.body.color_code?.trim() || "#70a6f3";

    const result = await db.query(q, [name, key, createdBy, teamId, colorCode]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse<IProjectFolder>(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const parentFolderId = (req.query.parent as string)?.trim() || null;

    const q = [
      `SELECT id,
              name,
              key,
              color_code,
              created_at,
              (SELECT name
               FROM team_member_info_view
               WHERE user_id = project_folders.created_by
                 AND team_member_info_view.team_id = project_folders.team_id) AS created_by
       FROM project_folders
       WHERE team_id = $1
      `,
      parentFolderId ? `AND parent_folder_id = $2` : "",
      `ORDER BY name;`
    ].join(" ");
    const params = parentFolderId ? [req.user?.team_id, parentFolderId] : [req.user?.team_id];

    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse<IProjectFolder[]>(true, result.rows));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id, key, name, color_code
      FROM project_folders
      WHERE key = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse<IProjectFolder>(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE project_folders
      SET name       = $2,
          key        = $3,
          color_code = COALESCE($5, color_code),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
        AND team_id = $4
      RETURNING id, name, key;
    `;

    const name = req.body.name?.trim() || null;
    const key = slugify(name);
    const colorCode = req.body.color_code?.trim() || null;

    const result = await db.query(q, [req.params.id, name, key, req.user?.team_id, colorCode]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse<IProjectFolder>(true, data));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      DELETE
      FROM project_folders
      WHERE id = $1
        AND team_id = $2;
    `;
    await db.query(q, [req.params.id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, null));
  }
}
