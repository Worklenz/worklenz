import crypto from "crypto";
import { Request, Response } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { ServerResponse } from "../models/server-response";
import { getBaseUrl } from "../cron_jobs/helpers";

export default class DigestPreferencesController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async getPreferences(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;

    // Upsert default row on first access
    await db.query(
      `INSERT INTO user_digest_preferences (user_id)
       VALUES ($1)
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    );

    const result = await db.query(
      `SELECT
         daily_enabled,
         TO_CHAR(daily_send_time, 'HH24:MI') AS daily_send_time,
         weekly_start_enabled,
         TO_CHAR(weekly_start_send_time, 'HH24:MI') AS weekly_start_send_time,
         weekly_end_enabled,
         TO_CHAR(weekly_end_send_time, 'HH24:MI') AS weekly_end_send_time
       FROM user_digest_preferences
       WHERE user_id = $1`,
      [userId]
    );

    const [prefs] = result.rows;
    return res.status(200).send(new ServerResponse(true, prefs ?? {
      daily_enabled: false,
      daily_send_time: "09:00",
      weekly_start_enabled: false,
      weekly_start_send_time: "08:00",
      weekly_end_enabled: false,
      weekly_end_send_time: "16:00",
    }));
  }

  @HandleExceptions()
  public static async updatePreferences(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const userId = req.user?.id;
    const {
      daily_enabled,
      daily_send_time,
      weekly_start_enabled,
      weekly_start_send_time,
      weekly_end_enabled,
      weekly_end_send_time,
    } = req.body;

    const result = await db.query(
      `INSERT INTO user_digest_preferences (
         user_id,
         daily_enabled, daily_send_time,
         weekly_start_enabled, weekly_start_send_time,
         weekly_end_enabled, weekly_end_send_time,
         updated_at
       )
       VALUES ($1, $2, $3::TIME, $4, $5::TIME, $6, $7::TIME, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) DO UPDATE SET
         daily_enabled          = EXCLUDED.daily_enabled,
         daily_send_time        = EXCLUDED.daily_send_time,
         weekly_start_enabled   = EXCLUDED.weekly_start_enabled,
         weekly_start_send_time = EXCLUDED.weekly_start_send_time,
         weekly_end_enabled     = EXCLUDED.weekly_end_enabled,
         weekly_end_send_time   = EXCLUDED.weekly_end_send_time,
         updated_at             = CURRENT_TIMESTAMP
       RETURNING
         daily_enabled,
         TO_CHAR(daily_send_time, 'HH24:MI') AS daily_send_time,
         weekly_start_enabled,
         TO_CHAR(weekly_start_send_time, 'HH24:MI') AS weekly_start_send_time,
         weekly_end_enabled,
         TO_CHAR(weekly_end_send_time, 'HH24:MI') AS weekly_end_send_time`,
      [
        userId,
        !!daily_enabled,
        daily_send_time ?? "09:00",
        !!weekly_start_enabled,
        weekly_start_send_time ?? "08:00",
        !!weekly_end_enabled,
        weekly_end_send_time ?? "16:00",
      ]
    );

    // Ensure an unsubscribe token exists for this user
    await DigestPreferencesController.ensureUnsubscribeToken(userId as string);

    const [prefs] = result.rows;
    return res.status(200).send(new ServerResponse(true, prefs));
  }

  /** Public endpoint — no auth required. */
  public static async unsubscribe(req: Request, res: Response): Promise<void> {
    const { token } = req.query as { token?: string };
    if (!token) {
      res.status(400).send("Missing token.");
      return;
    }

    const tokenRow = await db.query(
      `SELECT user_id, used_at FROM digest_unsubscribe_tokens WHERE token = $1`,
      [token]
    );

    if (!tokenRow.rows.length) {
      res.status(404).send("Invalid or expired unsubscribe link.");
      return;
    }

    const { user_id } = tokenRow.rows[0];

    await db.query(
      `UPDATE user_digest_preferences
       SET daily_enabled = FALSE,
           weekly_start_enabled = FALSE,
           weekly_end_enabled = FALSE,
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1`,
      [user_id]
    );

    // Mark token used (idempotent — only set on first use)
    if (!tokenRow.rows[0].used_at) {
      await db.query(
        `UPDATE digest_unsubscribe_tokens SET used_at = CURRENT_TIMESTAMP WHERE token = $1`,
        [token]
      );
    }

    res.status(200).send("You have been unsubscribed from all Worklenz task digest emails.");
  }

  public static async ensureUnsubscribeToken(userId: string): Promise<string> {
    const existing = await db.query(
      `SELECT token FROM digest_unsubscribe_tokens WHERE user_id = $1`,
      [userId]
    );
    if (existing.rows.length) return existing.rows[0].token;

    const token = crypto.randomBytes(32).toString("hex");
    await db.query(
      `INSERT INTO digest_unsubscribe_tokens (user_id, token) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [userId, token]
    );
    return token;
  }

  public static buildUnsubscribeUrl(token: string): string {
    return `${getBaseUrl()}/api/v1/digest/unsubscribe?token=${token}`;
  }

  public static buildManagePreferencesUrl(): string {
    return `${getBaseUrl()}/worklenz/settings/notifications`;
  }
}
