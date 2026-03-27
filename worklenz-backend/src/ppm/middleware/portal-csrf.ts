import crypto from "crypto";
import { NextFunction, Request, Response } from "express";

import { ServerResponse } from "../../models/server-response";

const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a CSRF token and store it in the portal session.
 * Called by GET /ppm/api/portal/auth/me to return the token with session data.
 */
export function generateCSRFToken(req: Request): string {
  // Reuse existing token if present — prevents invalidating other tabs
  const existing = (req.session as any).ppmCsrfToken;
  if (existing && typeof existing === "string" && existing.length === CSRF_TOKEN_LENGTH * 2) {
    return existing;
  }
  const token = crypto.randomBytes(CSRF_TOKEN_LENGTH).toString("hex");
  (req.session as any).ppmCsrfToken = token;
  return token;
}

/**
 * Middleware that validates CSRF token on portal write routes (POST/PUT/DELETE).
 * Token is expected in the X-CSRF-Token header.
 * Must be used AFTER requireClientAuth middleware.
 */
export default function validatePortalCSRF(req: Request, res: Response, next: NextFunction) {
  // Only validate on state-changing methods
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    return next();
  }

  const headerToken = req.headers["x-csrf-token"] as string | undefined;
  const sessionToken = (req.session as any)?.ppmCsrfToken as string | undefined;

  if (!headerToken || !sessionToken) {
    return res.status(403).json(new ServerResponse(false, null, "CSRF token missing"));
  }

  // Constant-time comparison to prevent timing attacks
  const headerBuf = Buffer.from(headerToken);
  const sessionBuf = Buffer.from(sessionToken);
  if (headerBuf.length !== sessionBuf.length || !crypto.timingSafeEqual(headerBuf, sessionBuf)) {
    return res.status(403).json(new ServerResponse(false, null, "Invalid CSRF token"));
  }

  return next();
}
