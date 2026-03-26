import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";

export default class PortalAuthController {
  /**
   * POST /ppm/api/portal/auth/magic-link
   *
   * Generates a magic link token for the given email.
   * Always returns success to prevent email enumeration.
   */
  public static async requestMagicLink(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json(new ServerResponse(false, null, "Valid email is required"));
      }

      const result = await db.query(
        `SELECT ppm_generate_magic_link($1) AS token`,
        [email.trim().toLowerCase()]
      );

      const token = result.rows[0]?.token;

      // In production, this token would be emailed to the user.
      // For now, return it directly so we can test the flow.
      return res.status(200).json(new ServerResponse(true, { token }, "Magic link generated. Check your email."));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to generate magic link"));
    }
  }

  /**
   * POST /ppm/api/portal/auth/validate
   *
   * Validates a magic link token, creates a session, and returns client user info.
   */
  public static async validateMagicLink(req: Request, res: Response) {
    try {
      const { token } = req.body;

      if (!token || typeof token !== "string") {
        return res.status(400).json(new ServerResponse(false, null, "Token is required"));
      }

      const result = await db.query(
        `SELECT * FROM ppm_validate_magic_link($1)`,
        [token]
      );

      if (result.rows.length === 0 || !result.rows[0].user_id) {
        return res.status(401).json(new ServerResponse(false, null, "Invalid or expired magic link"));
      }

      const row = result.rows[0];

      // Store client identity in the session
      (req.session as any).ppmClient = {
        userId: row.user_id,
        email: row.email,
        clientId: row.client_id,
        role: row.role,
      };

      return res.status(200).json(new ServerResponse(true, {
        user_id: row.user_id,
        email: row.email,
        client_id: row.client_id,
        role: row.role,
      }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to validate magic link"));
    }
  }

  /**
   * GET /ppm/api/portal/auth/me
   *
   * Returns the current client portal session info.
   * Requires requireClientAuth middleware.
   */
  public static async me(req: Request, res: Response) {
    try {
      const client = (req as any).ppmClient;
      return res.status(200).json(new ServerResponse(true, client));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to get session info"));
    }
  }

  /**
   * POST /ppm/api/portal/auth/logout
   *
   * Destroys the client portal session.
   */
  public static async logout(req: Request, res: Response) {
    try {
      delete (req.session as any).ppmClient;
      return res.status(200).json(new ServerResponse(true, null, "Logged out"));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to logout"));
    }
  }
}
