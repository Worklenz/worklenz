import { Request, Response, NextFunction } from "express";
import { ServerResponse } from "../models/server-response";
import TokenService from "../services/token-service";

export interface AuthenticatedClientRequest extends Request {
  clientId?: string;
  organizationId?: string;
  clientUserId?: string;
  clientAccess?: any;
  clientEmail?: string;
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

    // Get client permissions
    const permissions = await TokenService.getClientPermissions(tokenPayload.clientId);

    // Convert permissions array to access object
    const clientAccess = {
      canViewServices: permissions.includes('read:services'),
      canCreateRequests: permissions.includes('create:requests'),
      canViewProjects: permissions.includes('read:projects'),
      canViewInvoices: permissions.includes('read:invoices'),
      canChat: permissions.includes('read:chats'),
      canWriteChat: permissions.includes('write:chats'),
      canUpdateProfile: permissions.includes('write:profile')
    };

    // Attach client data to request
    req.clientId = tokenPayload.clientId;
    req.organizationId = tokenPayload.organizationId;
    req.clientEmail = tokenPayload.email;
    req.clientAccess = clientAccess;

    next();
  } catch (error) {
    console.error('Client authentication error:', error);
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