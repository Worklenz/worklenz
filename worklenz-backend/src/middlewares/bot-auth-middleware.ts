import { NextFunction, Request, Response } from "express";
import jwt, { Secret } from "jsonwebtoken";
import { ServerResponse } from "../models/server-response";

const jwtSecret: Secret = process.env.JWT_SECRET ?? "";

export interface IBotTokenPayload {
  service: string;
  team_id: string;
  user_id: string;
}

/**
 * Middleware that authenticates bot/service account requests using a Bearer JWT.
 * The JWT must contain: { service, team_id, user_id }
 * - service: identifier for the calling service (e.g. "ppmbot")
 * - team_id: the team context for task creation
 * - user_id: the user to attribute actions to (the service account user)
 */
export default function botAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json(new ServerResponse(false, null, "Missing or invalid Authorization header"));
  }

  const token = authHeader.slice(7);

  try {
    const decoded = jwt.verify(token, jwtSecret) as IBotTokenPayload;

    if (!decoded.service || !decoded.team_id || !decoded.user_id) {
      return res.status(401).json(new ServerResponse(false, null, "Invalid token payload"));
    }

    // Attach bot identity to the request for downstream use
    (req as any).bot = decoded;
    // Also set req.user so existing task creation logic works
    (req as any).user = {
      id: decoded.user_id,
      team_id: decoded.team_id,
    };

    return next();
  } catch {
    return res.status(401).json(new ServerResponse(false, null, "Invalid or expired token"));
  }
}
