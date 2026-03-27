import { NextFunction, Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";

/**
 * Middleware that verifies the authenticated user is a PPM partner.
 * Checks ppm_internal_users.ppm_role = 'partner' for req.user.id.
 * Caches result in req.session.ppmPartner after first lookup.
 *
 * Must be used AFTER isLoggedIn middleware.
 */
export default async function requirePPMPartner(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req.user as any)?.id;
    if (!userId) {
      return res.status(401).json(new ServerResponse(false, null, "Authentication required"));
    }

    // Check session cache first
    if ((req.session as any).ppmPartner === true) {
      return next();
    }

    const result = await db.pool.query(
      `SELECT ppm_role FROM ppm_internal_users WHERE user_id = $1`,
      [userId]
    );

    if (!result.rows[0] || result.rows[0].ppm_role !== "partner") {
      return res.status(403).json(new ServerResponse(false, null, "PPM partner access required"));
    }

    // Cache in session so we don't hit DB on every request
    (req.session as any).ppmPartner = true;
    return next();
  } catch (error) {
    return res.status(500).json(new ServerResponse(false, null, "Authorization check failed"));
  }
}
