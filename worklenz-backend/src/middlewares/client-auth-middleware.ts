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
    // NOTE: Made lenient - only blocks if explicitly configured and origin doesn't match
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
        'https://dev.worklenz.com', // Add dev environment
        'http://dev.worklenz.com',  // Add dev environment (http)
      ].filter((url): url is string => Boolean(url));
      
      // Only validate if we have origin/referer AND explicitly configured allowed origins
      // If no origin header is present, allow (some clients don't send it)
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