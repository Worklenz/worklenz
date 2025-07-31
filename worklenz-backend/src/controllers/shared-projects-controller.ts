import {createHmac} from "crypto";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class SharedprojectsController extends WorklenzControllerBase {
  private static getShareLink(hash: string) {
    return `https://${process.env.HOSTNAME}/share/${hash}`;
  }

  private static createShareInfo(name?: string, createdAt?: string, hash?: string) {
    if (!name || !createdAt || !hash) return null;
    return {
      url: this.getShareLink(hash),
      created_by: name?.split(" ")[0],
      created_at: createdAt
    };
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      INSERT INTO shared_projects (project_id, team_id, enabled_by, hash_value)
      VALUES ($1, $2, $3, $4)
      RETURNING id, created_at;
    `;

    const hash = createHmac("sha256", req.body.project_id).digest("hex");

    const result = await db.query(q, [req.body.project_id, req.user?.team_id, req.user?.id, hash]);
    const [data] = result.rows;
    if (!data?.id)
      return res.status(400).send(new ServerResponse(true, null));
    return res.status(200).send(new ServerResponse(true, this.createShareInfo(req.user?.name?.split(" ")[0], data.createdAt, hash)));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT hash_value, created_at, (SELECT name FROM users WHERE id = enabled_by)
      FROM shared_projects
      WHERE project_id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, this.createShareInfo(data?.name, data?.created_at, data?.hash_value)));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE FROM shared_projects WHERE project_id = $1 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
