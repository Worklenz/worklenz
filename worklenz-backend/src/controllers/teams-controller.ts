import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";

export default class TeamsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { name } = req.body;

    const checkAvailabilityq = `SELECT * from teams WHERE user_id = $2 AND name = $1`;
    const check = await db.query(checkAvailabilityq, [name, req.user?.id]);

    if (check.rows.length) return res.status(200).send(new ServerResponse(false, null, "Team name already exist. Try anothor!"));

    const q = `SELECT create_new_team($1, $2);`;
    const result = await db.query(q, [name, req.user?.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id,
             name,
             created_at,
             (id = $2) AS active,
             (user_id = $1) AS owner,
             EXISTS(SELECT 1
                    FROM email_invitations
                    WHERE team_id = teams.id
                      AND team_member_id = (SELECT id
                                            FROM team_members
                                            WHERE team_members.user_id = $1
                                              AND team_members.team_id = teams.id)) AS pending_invitation,
             (CASE
                WHEN user_id = $1 THEN 'You'
                ELSE (SELECT name FROM users WHERE id = teams.user_id) END
               ) AS owns_by
      FROM teams
      WHERE user_id = $1
         OR id IN (SELECT team_id FROM team_members WHERE team_members.user_id = $1
               AND team_members.active IS TRUE)
      ORDER BY name;
    `;

    const result = await db.query(q, [req.user?.id, req.user?.team_id ?? null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getTeamInvites(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT id,
             team_id,
             team_member_id,
             (SELECT name FROM teams WHERE id = team_id) AS team_name,
             (SELECT name FROM users WHERE id = (SELECT user_id FROM teams WHERE id = team_id)) AS team_owner
      FROM email_invitations
      WHERE email = (SELECT email FROM users WHERE id = $1);
    `;

    const result = await db.query(q, [req.user?.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT accept_invitation($1, $2, $3) AS invitation;`;
    const result = await db.query(q, [
      req.user?.email,
      req.body.team_member_id,
      req.user?.id,
    ]);
    const [data] = result.rows;

    if (req.body.show_alert) {
      return res.status(200).send(new ServerResponse(true, data.invitation, "Team invitation accepted"));
    }
    return res.status(200).send(new ServerResponse(true, data.invitation));
  }

  @HandleExceptions()
  public static async activate(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT activate_team($1, $2)`;
    await db.query(q, [req.body.id, req.user?.id ?? null]);
    return res.status(200).send(new ServerResponse(true, { subdomain: null }));
  }

  @HandleExceptions({
    raisedExceptions: {
      "TEAM_NAME_EXISTS_ERROR": "Team name already taken. Please enter a different name."
    }
  })
  public static async updateNameOnce(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT update_team_name_once($1, $2, $3);`;
    const result = await db.query(q, [req.user?.id, req.user?.team_id, req.body.name || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
