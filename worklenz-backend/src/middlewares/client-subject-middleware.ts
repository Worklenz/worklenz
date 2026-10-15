import { NextFunction, Response } from "express";
import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import { ClientCapability, clientRoleCan } from "../shared/client-portal-permissions";
import { ClientSubject, loadClientSubject } from "../services/client-portal-v2/subject";
import { AuthenticatedClientRequest } from "./client-auth-middleware";

/**
 * Client Portal v2 authorization, layered on top of `authenticateClient` (which verifies the token
 * and the organization).
 *
 * The token carries identity only. This resolves WHO the request acts as from the database on every
 * request: the user must be Active (not deactivated, email verified and activated) and their role is
 * read fresh. Deactivating a user, changing their role or removing an assignment therefore takes
 * effect on their very next request, with no token revocation.
 */
export interface ClientSubjectRequest extends AuthenticatedClientRequest {
  clientSubject?: ClientSubject;
}

export const requireClientSubject = async (req: ClientSubjectRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.clientUserId || !req.clientId || !req.organizationId) {
      return res.status(403).json(new ServerResponse(false, null, "This sign-in cannot use the project portal"));
    }

    const subject = await loadClientSubject(db, {
      clientUserId: req.clientUserId,
      clientId: req.clientId,
      teamId: req.organizationId,
    });

    if (!subject) {
      // Deactivated, removed, not yet activated or the organization is inactive. The client signs out.
      return res
        .status(403)
        .json(new ServerResponse(false, { code: "ACCESS_REVOKED" }, "Your access has been removed. Please contact your administrator."));
    }

    req.clientSubject = subject;
    next();
  } catch (error) {
    console.error("[Client subject] Could not resolve the client user:", error);
    return res.status(500).json(new ServerResponse(false, null, "Could not verify your access"));
  }
};

/** Requires the subject's role to hold a capability. Must run after `requireClientSubject`. */
export const requireClientCapability =
  (capability: ClientCapability) => (req: ClientSubjectRequest, res: Response, next: NextFunction) => {
    if (!req.clientSubject || !clientRoleCan(req.clientSubject.role, capability)) {
      return res
        .status(403)
        .json(new ServerResponse(false, { code: "ROLE_FORBIDDEN" }, "Your role cannot do this"));
    }
    next();
  };
