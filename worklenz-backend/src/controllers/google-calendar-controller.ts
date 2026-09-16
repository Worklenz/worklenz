import { Request, Response } from "express";
import db from "../config/db";
import { EncryptionService } from "../services/encryption.service";
import { GoogleCalendarService } from "../services/google-calendar.service";
import { ServerResponse } from "../models/server-response";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";

export default class GoogleCalendarController {
  public static async connect(req: IWorkLenzRequest, res: Response) {
    const userId = req.user?.id;
    if (!userId) return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
    const session = req.session as unknown as Record<string, unknown>;
    const url = GoogleCalendarService.createAuthorizationUrl(userId, session);
    return res.status(200).send(new ServerResponse(true, { url }));
  }

  public static async callback(req: Request, res: Response) {
    const session = req.session as unknown as Record<string, unknown>;
    const expectedState = session.googleCalendarOAuthState;
    const userId = session.googleCalendarOAuthUserId;
    delete session.googleCalendarOAuthState;
    delete session.googleCalendarOAuthUserId;
    if (!expectedState || expectedState !== req.query.state || typeof userId !== "string") {
      return res.status(400).send("Invalid Google Calendar OAuth state");
    }
    if (typeof req.query.code !== "string") return res.status(400).send("Google Calendar authorization was not completed");
    let refreshToken: string;
    try {
      refreshToken = await GoogleCalendarService.connect(req.query.code);
    } catch (error: any) {
      console.error("[Google Calendar OAuth] token exchange failed:", error?.message || error);
      return res.status(502).send("Google Calendar authorization failed. Please try again.");
    }
    await db.query(
      `UPDATE users SET google_calendar_refresh_token = $1, google_calendar_connected_at = CURRENT_TIMESTAMP WHERE id = $2`,
      [EncryptionService.encrypt(refreshToken), userId],
    );
    return res.redirect(`${process.env.FRONTEND_URL || ""}/settings/profile?calendar=connected`);
  }

  public static async status(req: IWorkLenzRequest, res: Response) {
    const result = await db.query(
      "SELECT google_calendar_connected_at IS NOT NULL AS connected, google_calendar_connected_at FROM users WHERE id = $1",
      [req.user?.id],
    );
    const projects = await db.query(
      `SELECT DISTINCT p.id, p.name
       FROM projects p
       LEFT JOIN project_members pm ON pm.project_id = p.id
       LEFT JOIN team_members tm ON tm.id = pm.team_member_id
       WHERE p.team_id = $1 AND (p.owner_id = $2 OR tm.user_id = $2)
       ORDER BY p.name`,
      [req.user?.team_id, req.user?.id],
    );
    return res.status(200).send(new ServerResponse(true, {
      ...(result.rows[0] || { connected: false }),
      projects: projects.rows,
    }));
  }

  public static async sync(req: IWorkLenzRequest, res: Response) {
    const result = await GoogleCalendarService.sync(
      req.user?.id as string,
      req.user?.team_id as string,
      req.body?.project_id,
    );
    return res.status(200).send(new ServerResponse(true, result));
  }

  public static async disconnect(req: IWorkLenzRequest, res: Response) {
    await db.query(
      "UPDATE users SET google_calendar_refresh_token = NULL, google_calendar_connected_at = NULL WHERE id = $1",
      [req.user?.id],
    );
    return res.status(200).send(new ServerResponse(true, null));
  }
}
