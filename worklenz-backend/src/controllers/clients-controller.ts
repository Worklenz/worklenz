import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {isValidateEmail} from "../shared/utils";
import {ServerResponse} from "../models/server-response";
import {sendNewSubscriberNotification} from "../shared/email-templates";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class ClientsController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `INSERT INTO clients (name, team_id) VALUES ($1, $2) RETURNING id, name;`;
    const result = await db.query(q, [req.body.name, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name");

    const q = `
      SELECT ROW_TO_JSON(rec) AS clients
      FROM (SELECT COUNT(*) AS total,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT id,
                            name,
                            (SELECT COUNT(*) FROM projects WHERE client_id = clients.id) AS projects_count
                    FROM clients
                    WHERE team_id = $1 ${searchQuery}
                    ORDER BY ${sortField} ${sortOrder}
                    LIMIT $2 OFFSET $3) t) AS data
      FROM clients
      WHERE team_id = $1 ${searchQuery}) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.clients || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name FROM clients WHERE id = $1 AND team_id = $2`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE clients SET name = $3 WHERE id = $1 AND team_id = $2; `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null, req.body.name]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE FROM clients WHERE id = $1 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async addSubscriber(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {email} = req.body;
    if (!this.isValidHost(req.hostname))
      return res.status(200).send(new ServerResponse(false, null, "Invalid hostname"));

    if (!isValidateEmail(email))
      return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));

    sendNewSubscriberNotification(email);

    return res.status(200).send(new ServerResponse(true, null, "Thank you for subscribing. We'll update you once WorkLenz is live!"));
  }

}
