import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import {IPassportSession} from "../interfaces/passport-session";

import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import {ServerResponse} from "../models/server-response";
import {NotificationsService} from "../services/notifications/notifications.service";
import {slugify} from "../shared/utils";
import {generateProjectKey} from "../utils/generate-project-key";
import WorklenzControllerBase from "./worklenz-controller-base";

export default class ProfileSettingsController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async setup(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT complete_account_setup($1, $2, $3) AS account;`;
    req.body.key = generateProjectKey(req.body.project_name, []) || null;
    const result = await db.query(q, [req.user?.id, req.user?.team_id, JSON.stringify(req.body)]);
    const [data] = result.rows;

    if (!data)
      return res.status(200).send(new ServerResponse(false, null, "Account setup failed! Please try again"));

    const newMembers = data.account.members || [];

    NotificationsService.sendTeamMembersInvitations(newMembers, req.user as IPassportSession);

    return res.status(200).send(new ServerResponse(true, data.account));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT name, email
               FROM users
               WHERE id = $1;`;
    const result = await db.query(q, [req.user?.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE users
               SET name       = $2,
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = $1
               RETURNING id, name, email;`;
    const result = await db.query(q, [req.user?.id, req.body.name]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update_team_name(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT update_team_name($1);`;
    const body = {
      id: req.params.id,
      name: req.body.name,
      key: slugify(req.body.name),
      user_id: req.user?.id
    };
    await db.query(q, [JSON.stringify(body)]);
    return res.status(200).send(new ServerResponse(true, body));
  }
}
