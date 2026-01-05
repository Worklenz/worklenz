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
    // Additional security: Validate Origin/Referer header for state-changing operations
    // This provides defense-in-depth even though custom headers are CSRF-resistant
    const stateChangingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    const isStateChanging = stateChangingMethods.includes(req.method);
    
    if (isStateChanging) {
      const origin = req.headers.origin || req.headers.referer;
      const allowedOrigins = [
        process.env.CLIENT_PORTAL_URL,
        process.env.FRONTEND_URL,
        'http://localhost:5173',
        'http://localhost:5174',
        'http://localhost:3000',
        'https://clients.worklenz.com',
        'https://wl-client.ceydigital.dev',
      ].filter((url): url is string => Boolean(url));
      
      // Only validate if we have origin/referer and allowed origins configured
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
            console.error(`[Client Auth] 403 - Invalid origin: ${origin} for ${req.method} ${req.path}`);
            return res.status(403).json(
              new ServerResponse(false, null, "Request origin not allowed")
            );
          }
        } catch (error) {
          // Invalid origin format - log but don't block (defense-in-depth, not primary security)
          console.warn(`[Client Auth] Invalid origin format: ${origin}`);
        }
      }
    }

    // Get client token from headers or query params
    const clientToken = req.headers["x-client-token"] || req.query.clientToken;

    if (!clientToken) {
      console.error(`[Client Auth] 401 - No token provided for ${req.method} ${req.path}`);
      return res.status(401).json(
        new ServerResponse(false, null, "Client token is required")
      );
    }

    // Verify client token using TokenService
    const tokenPayload = TokenService.verifyClientToken(clientToken as string);
    
    if (!tokenPayload) {
      console.error(`[Client Auth] 401 - Invalid/expired token for ${req.method} ${req.path}`);
      return res.status(401).json(
        new ServerResponse(false, null, "Invalid or expired client token")
      );
    }

    console.log(`[Client Auth] Token verified for clientId=${tokenPayload.clientId}, organizationId=${tokenPayload.organizationId}`);

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
      console.error(`[Client Auth] 403 - Client ${tokenPayload.clientId} is inactive`);
      return res.status(403).json(
        new ServerResponse(false, null, "Client account is deactivated. Please contact your administrator.")
      );
    }

    // Block access if portal access is explicitly disabled
    if (clientData.portal_access_active === false) {
      console.error(`[Client Auth] 403 - Portal access disabled for client ${tokenPayload.clientId}`);
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
        console.error(`[Client Auth] 403 - Organization access denied: clientUserId=${tokenPayload.clientUserId}, organizationId=${tokenPayload.organizationId}`);
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
    console.error("[Client Auth] Authentication error:", error);
    console.error("[Client Auth] Error details:", {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      path: req.path,
      method: req.method
    });
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