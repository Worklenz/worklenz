import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {ServerResponse} from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import {getColor} from "../shared/utils";

export default class NotificationController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT un.id,
             un.message,
             un.created_at,
             un.read,
             (SELECT name FROM teams WHERE id = un.team_id) AS team,
             (SELECT name FROM projects WHERE id = t.project_id) AS project,
             (SELECT color_code FROM projects WHERE id = t.project_id) AS color,
             t.project_id,
             t.id AS task_id,
             un.team_id
      FROM user_notifications un
             LEFT JOIN tasks t ON un.task_id = t.id
      WHERE user_id = $1
        AND read = $2
      ORDER BY created_at DESC
      LIMIT 100;
    `;

    const result = await db.query(q, [req.user?.id, req.query.filter === "Read"]);

    for (const item of result.rows) {
      item.team_color = getColor(item.team_name);
      item.url = item.project_id ? `/worklenz/projects/${item.project_id}` : null;
      item.params = {task: item.task_id, tab: "tasks-list"};
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getSettings(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT email_notifications_enabled, popup_notifications_enabled, show_unread_items_count, daily_digest_enabled
      FROM notification_settings
      WHERE user_id = $1
        AND team_id = $2;
    `;
    const result = await db.query(q, [req.user?.id, req.user?.team_id]);
    const [data] = result.rows;

    const settings = {
      email_notifications_enabled: !!data?.email_notifications_enabled,
      popup_notifications_enabled: !!data?.popup_notifications_enabled,
      show_unread_items_count: !!data?.show_unread_items_count,
      daily_digest_enabled: !!data?.daily_digest_enabled
    };

    return res.status(200).send(new ServerResponse(true, settings));
  }

  @HandleExceptions()
  public static async getUnreadCount(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      SELECT COALESCE(COUNT(*)::INTEGER, 0) AS notifications_count,
            (SELECT COALESCE(COUNT(*)::INTEGER, 0) FROM email_invitations WHERE email = (SELECT email FROM users WHERE id = $1)) AS invitations_count
      FROM user_notifications
      WHERE user_id = $1
      AND read = false
    `;

    const result = await db.query(q, [req.user?.id]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data.notifications_count + data.invitations_count));
  }

  @HandleExceptions()
  public static async updateSettings(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE notification_settings
      SET email_notifications_enabled = $3,
          popup_notifications_enabled = $4,
          show_unread_items_count     = $5,
          daily_digest_enabled        = $6
      WHERE user_id = $1
        AND team_id = $2
      RETURNING email_notifications_enabled,
        popup_notifications_enabled,
        show_unread_items_count,
        daily_digest_enabled;
    `;

    const result = await db.query(q, [
      req.user?.id,
      req.user?.team_id,
      !!req.body.email_notifications_enabled,
      !!req.body.popup_notifications_enabled,
      !!req.body.show_unread_items_count,
      !!req.body.daily_digest_enabled
    ]);
    const [data] = result.rows;

    const settings = {
      email_notifications_enabled: !!data?.email_notifications_enabled,
      popup_notifications_enabled: !!data?.popup_notifications_enabled,
      show_unread_items_count: !!data?.show_unread_items_count,
      daily_digest_enabled: !!data?.daily_digest_enabled
    };

    return res.status(200).send(new ServerResponse(true, settings));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE user_notifications
      SET read = TRUE
      WHERE id = $1
        AND user_id = $2;
    `;
    const result = await db.query(q, [req.params.id, req.user?.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async delete(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        DELETE
        FROM user_notifications
        WHERE id = $1
          AND user_id = $2
    `;
    const result = await db.query(q, [req.params.id, req.user?.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async readAll(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
        UPDATE user_notifications
        SET read = TRUE
        WHERE user_id = $1
          AND read IS FALSE;
    `;
    const result = await db.query(q, [req.user?.id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
