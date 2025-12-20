import { NextFunction, Response } from "express";

import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { ServerResponse } from "../models/server-response";
import TokenService from "../services/auth/token.service";
import UserSessionService from "../services/auth/user-session.service";

export default async function jwtAuthMiddleware(req: IWorkLenzRequest, res: Response, next: NextFunction) {
  if (req.user?.id) {
    return next();
  }

  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : null;

  if (!token) {
    return res.status(401).send(new ServerResponse(false, null, "Authentication required"));
  }

  try {
    const payload = await TokenService.verifyAccessToken(token);
    const user = await UserSessionService.loadByUserId(payload.sub);
    if (!user) {
      return res.status(401).send(new ServerResponse(false, null, "Invalid or expired token"));
    }
    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).send(new ServerResponse(false, null, "Invalid or expired token"));
  }
}
