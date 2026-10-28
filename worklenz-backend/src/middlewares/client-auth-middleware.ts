import { Request, Response, NextFunction } from "express";
import { ServerResponse } from "../models/server-response";
import TokenService from "../services/token-service";
import { getLoginAccessState } from "../services/client-contacts-service";
import db from "../config/db";
import {
  ACCESS_LOSS_MESSAGES,
  AccessLossReason,
  explainAccessLoss,
  loadClientSubject,
} from "../services/client-portal-v2/subject";

export interface AuthenticatedClientRequest extends Request {
  clientId?: string;
  organizationId?: string;
  clientUserId?: string;
  clientRelationshipId?: string;
  clientAccess?: any;
  clientEmail?: string;
  availableOrganizations?: any[];
}

/** ACCESS_REVOKED with a coarse `reason`; the body never names a company, a team or another person. */
const revoked = (res: Response, status: number, reason: AccessLossReason, message: string) =>
  res.status(status).json(new ServerResponse(false, { code: "ACCESS_REVOKED", reason }, message));

export const authenticateClient = async (
  req: AuthenticatedClientRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    // Additional security: Validate Origin/Referer header for state-changing operations
    // This provides defense-in-depth even though custom headers are CSRF-resistant
    // NOTE: Made lenient - only blocks if explicitly configured and origin doesn't match
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const isStateChanging = stateChangingMethods.includes(req.method);
    
    if (isStateChanging) {
      const origin = req.headers.origin || req.headers.referer;
      // Environment hostnames come from configuration (CLIENT_PORTAL_ALLOWED_ORIGINS, comma separated),
      // never from code. Local dev servers are only allowed outside production.
      const configuredOrigins = (process.env.CLIENT_PORTAL_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(value => value.trim());
      const localOrigins =
        process.env.NODE_ENV === "production"
          ? []
          : ["http://localhost:5173", "http://localhost:5174", "http://localhost:3000"];
      const allowedOrigins = [
        process.env.CLIENT_PORTAL_URL,
        process.env.FRONTEND_URL,
        ...configuredOrigins,
        ...localOrigins,
      ].filter((url): url is string => Boolean(url));
      
      // Only validate if we have origin/referer AND explicitly configured allowed origins
      // If no origin header is present, allow (some clients don't send it); the client token is the
      // primary control here, this check is defense-in-depth only.
      // If origin is present but no allowed origins configured, allow (development mode)
      if (origin && typeof origin === 'string' && allowedOrigins.length > 0) {
        try {
          const originUrl = new URL(origin);
          const isAllowed = allowedOrigins.some(allowed => {
            try {
              const allowedUrl = new URL(allowed);
              return originUrl.origin === allowedUrl.origin;
            } catch {
              return origin.includes(allowed);
            }
          });
          
          if (!isAllowed) {
            return res.status(403).json(
              new ServerResponse(false, null, "Request origin not allowed")
            );
          }
        } catch (error) {
          // Invalid origin format - don't block (defense-in-depth, not primary security)
        }
      }
    }

    // Get client token from headers or query params
    const clientToken = req.headers["x-client-token"] || req.query.clientToken;

    if (!clientToken) {
      return res.status(401).json(
        new ServerResponse(false, null, "Client token is required")
      );
    }

    // Verify client token using TokenService
    const tokenPayload = TokenService.verifyClientToken(clientToken as string);
    
    if (!tokenPayload) {
      return res.status(401).json(
        new ServerResponse(false, null, "Invalid or expired client token")
      );
    }

    // Check if client is active and has portal access
    const clientCheckQuery = `
      SELECT
        c.status as client_status,
        c.deleted_at as client_deleted_at,
        COALESCE(cpa.is_active, true) as portal_access_active
      FROM clients c
      LEFT JOIN client_portal_access cpa ON c.id = cpa.client_id
      WHERE c.id = $1
      LIMIT 1
    `;
    
    const clientCheckResult = await db.query(clientCheckQuery, [tokenPayload.clientId]);
    
    // A client that no longer exists, was deleted, was deactivated or has portal access switched off all end
    // the session the same way. A missing row is ACCESS_REVOKED too (not a 404): the app treats a 404 as
    // "not found", which would leave a signed-in person on a broken page instead of telling them.
    if (clientCheckResult.rows.length === 0 || clientCheckResult.rows[0].client_deleted_at) {
      return revoked(res, 403, "organization_unavailable", ACCESS_LOSS_MESSAGES.organization_unavailable);
    }

    const clientData = clientCheckResult.rows[0];

    // Block access if client is inactive
    if (clientData.client_status === 'inactive') {
      return revoked(res, 403, "organization_unavailable", "Client account is deactivated. Please contact your project team.");
    }

    // Block access if portal access is explicitly disabled
    if (clientData.portal_access_active === false) {
      return revoked(res, 403, "organization_unavailable", "Portal access is disabled for this client. Please contact your project team.");
    }

    // Get client permissions
    const permissions = await TokenService.getClientPermissions(tokenPayload.clientId);

    // Convert permissions array to access object
    const clientAccess = {
      canViewServices: permissions.includes("read:services"),
      canCreateRequests: permissions.includes("create:requests"),
      canViewProjects: permissions.includes("read:projects"),
      canViewInvoices: permissions.includes("read:invoices"),
      canChat: permissions.includes("read:chats"),
      canWriteChat: permissions.includes("write:chats"),
      canUpdateProfile: permissions.includes("write:profile")
    };

    // Validate organization access if clientUserId is present (multi-org support)
    if (tokenPayload.clientUserId && tokenPayload.organizationId) {
      const hasAccess = await TokenService.hasOrganizationAccess(
        tokenPayload.clientUserId,
        tokenPayload.organizationId
      );

      if (!hasAccess) {
        return revoked(res, 403, "access_removed", "Access denied to this organization");
      }
    }

    // The token outlives changes made by an admin, so re-check this person on every request: the
    // login must still exist and be active, and their company user must not be disabled.
    if (tokenPayload.clientUserId) {
      const access = await getLoginAccessState(db, tokenPayload.clientUserId, tokenPayload.clientId);

      if (!access.exists) {
        return revoked(res, 401, "access_removed", ACCESS_LOSS_MESSAGES.access_removed);
      }

      if (access.loginStatus !== "active" || access.isDisabled) {
        return revoked(res, 403, "access_disabled", ACCESS_LOSS_MESSAGES.access_disabled);
      }
    }

    // The login can outlive the company user: removing a contact deletes the contact, not the login. So a
    // token only works while this person is still an Active company user of this client (the same check the
    // v2 routes make), which also stops a removed user from using or refreshing a still-valid token.
    if (tokenPayload.clientUserId && tokenPayload.organizationId) {
      const subject = await loadClientSubject(db, {
        clientUserId: tokenPayload.clientUserId,
        clientId: tokenPayload.clientId,
        teamId: tokenPayload.organizationId,
      });
      if (!subject) {
        const reason = await explainAccessLoss(db, {
          clientUserId: tokenPayload.clientUserId,
          clientId: tokenPayload.clientId,
          teamId: tokenPayload.organizationId,
        });
        return revoked(res, 403, reason, ACCESS_LOSS_MESSAGES[reason]);
      }
    }

    // Attach client data to request
    req.clientId = tokenPayload.clientId;
    req.organizationId = tokenPayload.organizationId;
    req.clientUserId = tokenPayload.clientUserId;
    req.clientEmail = tokenPayload.email;
    req.clientAccess = clientAccess;
    req.availableOrganizations = tokenPayload.availableOrganizations;

    next();
  } catch (error) {
    console.error("[Client Auth] Authentication error:", error);
    return res.status(401).json(
      new ServerResponse(false, null, "Authentication failed")
    );
  }
};

// Optional middleware to check specific permissions
export const requireClientPermission = (permission: string) => {
  return (req: AuthenticatedClientRequest, res: Response, next: NextFunction) => {
    if (!req.clientAccess || !req.clientAccess[permission]) {
      return res.status(403).json(
        new ServerResponse(false, null, "Insufficient permissions")
      );
    }
    next();
  };
}; 