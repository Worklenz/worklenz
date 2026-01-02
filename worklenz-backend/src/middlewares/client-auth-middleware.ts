import { Request, Response, NextFunction } from "express";
import { ServerResponse } from "../models/server-response";
import TokenService from "../services/token-service";
import db from "../config/db";

export interface AuthenticatedClientRequest extends Request {
  clientId?: string;
  organizationId?: string;
  clientUserId?: string;
  clientRelationshipId?: string;
  clientAccess?: any;
  clientEmail?: string;
  availableOrganizations?: any[];
}

export const authenticateClient = async (
  req: AuthenticatedClientRequest,
  res: Response,
  next: NextFunction
) => {
  try {
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
        COALESCE(cpa.is_active, true) as portal_access_active
      FROM clients c
      LEFT JOIN client_portal_access cpa ON c.id = cpa.client_id
      WHERE c.id = $1
      LIMIT 1
    `;
    
    const clientCheckResult = await db.query(clientCheckQuery, [tokenPayload.clientId]);
    
    if (clientCheckResult.rows.length === 0) {
      return res.status(404).json(
        new ServerResponse(false, null, "Client not found")
      );
    }

    const clientData = clientCheckResult.rows[0];
    
    // Block access if client is inactive
    if (clientData.client_status === 'inactive') {
      return res.status(403).json(
        new ServerResponse(false, null, "Client account is deactivated. Please contact your administrator.")
      );
    }

    // Block access if portal access is explicitly disabled
    if (clientData.portal_access_active === false) {
      return res.status(403).json(
        new ServerResponse(false, null, "Portal access is disabled for this client. Please contact your administrator.")
      );
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
        return res.status(403).json(
          new ServerResponse(false, null, "Access denied to this organization")
        );
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
    console.error("Client authentication error:", error);
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