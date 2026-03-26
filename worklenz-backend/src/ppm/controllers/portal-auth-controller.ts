import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { sendEmail } from "../../shared/email";

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

      // Only send email when token is non-null (real user).
      // ppm_generate_magic_link returns NULL for unknown emails.
      // Anti-enumeration: HTTP response is the same either way.
      if (token) {
        const baseUrl = (process.env.PPM_PORTAL_URL || `${req.protocol}://${req.get("host")}`).replace(/\/$/, "");
        const magicLink = `${baseUrl}/portal/login?token=${token}`;

        await sendEmail({
          to: [email.trim().toLowerCase()],
          subject: "Your TaskFlow Portal Sign-In Link",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
              <h2 style="color: #0061FF; margin-bottom: 24px;">Sign in to your portal</h2>
              <p style="color: #333; line-height: 1.6;">Click the button below to securely sign in to your project portal. This link expires in 15 minutes.</p>
              <a href="${magicLink}" style="display: inline-block; background: #0061FF; color: #fff; padding: 12px 32px; border-radius: 6px; text-decoration: none; font-weight: 600; margin: 24px 0;">Sign In to Portal</a>
              <p style="color: #999; font-size: 13px; margin-top: 24px;">If you didn't request this, you can safely ignore this email.</p>
              <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
              <p style="color: #bbb; font-size: 12px;">Prestige Pro Media &mdash; TaskFlow</p>
            </div>
          `,
        });
      }

      // Same response regardless of whether email exists — prevents enumeration
      return res.status(200).json(new ServerResponse(true, null, "If an account exists for this email, a magic link has been sent."));
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
