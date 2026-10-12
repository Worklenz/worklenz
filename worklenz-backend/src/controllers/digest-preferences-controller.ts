import crypto from "crypto";
import { Request, Response } from "express";
import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { ServerResponse } from "../models/server-response";
import { unsubscribeByToken } from "../services/digest-unsubscribe";
import {
  buildManagePreferencesUrl as managePreferencesUrl,
  buildUnsubscribeUrl as unsubscribeUrl,
  buildViewAllTasksUrl as viewAllTasksUrl,
} from "../services/digest-urls";

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
    const result = await unsubscribeByToken(token);

    if (result === "missing") {
      res.status(400).type("html").send(DigestPreferencesController.unsubscribePage(
        "Missing unsubscribe token.",
        false
      ));
      return;
    }

    if (result === "invalid") {
      res.status(404).type("html").send(DigestPreferencesController.unsubscribePage(
        "This unsubscribe link is invalid or has expired.",
        false
      ));
      return;
    }

    res.status(200).type("html").send(DigestPreferencesController.unsubscribePage(
      "You have been unsubscribed from all Worklenz task digest emails.",
      true
    ));
  }

  public static async ensureUnsubscribeToken(userId: string): Promise<string> {
    const existing = await db.query(
      `SELECT token FROM digest_unsubscribe_tokens WHERE user_id = $1`,
      [userId]
    );
    if (existing.rows.length) return existing.rows[0].token;

    const token = crypto.randomBytes(32).toString("hex");
    const inserted = await db.query(
      `INSERT INTO digest_unsubscribe_tokens (user_id, token) VALUES ($1, $2)
       ON CONFLICT (user_id) DO NOTHING
       RETURNING token`,
      [userId, token]
    );
    if (inserted.rows.length) return inserted.rows[0].token;

    const retry = await db.query(
      `SELECT token FROM digest_unsubscribe_tokens WHERE user_id = $1`,
      [userId]
    );
    return retry.rows[0]?.token ?? token;
  }

  public static buildUnsubscribeUrl(token: string): string {
    return unsubscribeUrl(token);
  }

  public static buildManagePreferencesUrl(): string {
    return managePreferencesUrl();
  }

  public static buildViewAllTasksUrl(): string {
    return viewAllTasksUrl();
  }

  private static unsubscribePage(message: string, success: boolean): string {
    const manageUrl = DigestPreferencesController.buildManagePreferencesUrl();
    const heading = success ? "Unsubscribed" : "Unsubscribe";
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${heading} — Worklenz</title>
</head>
<body style="margin:0;padding:40px 20px;font-family:'Helvetica Neue',helvetica,arial,sans-serif;background:#f5f5f5;color:#2b2b2b;">
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:8px;padding:32px 28px;box-shadow:0 1px 4px rgba(0,0,0,0.08);">
    <h1 style="font-size:20px;margin:0 0 12px;">${heading}</h1>
    <p style="font-size:15px;line-height:1.5;margin:0 0 20px;">${message}</p>
    <p style="font-size:14px;margin:0;">
      <a href="${manageUrl}" style="color:#1890ff;">Manage notification preferences</a>
    </p>
  </div>
</body>
</html>`;
  }
}
