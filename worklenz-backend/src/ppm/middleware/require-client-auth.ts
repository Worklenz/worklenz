import { NextFunction, Request, Response } from "express";
import { ServerResponse } from "../../models/server-response";

/**
 * Middleware that verifies the request has an authenticated client portal session.
 * Expects req.session.ppmClient to be set by the magic-link validation flow.
 *
 * On success, attaches req.ppmClient for downstream handlers.
 */
export interface IPPMClientSession {
  userId: string;
  email: string;
  clientId: string;
  role: string;
}

export default function requireClientAuth(req: Request, res: Response, next: NextFunction) {
  const client = (req.session as any)?.ppmClient as IPPMClientSession | undefined;

  if (!client?.userId || !client?.clientId) {
    return res.status(401).json(new ServerResponse(false, null, "Client portal authentication required"));
  }

  (req as any).ppmClient = client;
  return next();
}
