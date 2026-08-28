import WorklenzControllerBase from "../../../controllers/worklenz-controller-base";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";

export default abstract class ClientPortalControllerBase extends WorklenzControllerBase {

  /**
   * Common error response formatting
   * Logs the error to console and returns a standardized 500 error response
   */
  protected static handleError(
    res: IWorkLenzResponse,
    error: any,
    message: string = "An error occurred"
  ) {
    console.error(message, error);
    return res.status(500).json(
      new ServerResponse(false, null, message)
    );
  }

  /**
   * Extract client context from authenticated request
   * Returns commonly used client authentication fields
   */
  protected static getClientContext(req: AuthenticatedClientRequest) {
    return {
      clientId: req.clientId,
      organizationId: req.organizationId,
      clientUserId: req.clientUserId,
      clientEmail: req.clientEmail,
      clientRelationshipId: req.clientRelationshipId
    };
  }

  /**
   * Helper method to create a notification in the client_portal_notifications table
   */
  public static async createNotification(
    clientId: string,
    organizationId: string,
    type: string,
    title: string,
    message: string,
    referenceId?: string,
    referenceNumber?: string,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    try {
      const query = `
        INSERT INTO client_portal_notifications
          (client_id, organization_team_id, type, title, message, reference_id, reference_number, metadata)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id
      `;
      const result = await db.query(query, [
        clientId,
        organizationId,
        type,
        title,
        message,
        referenceId || null,
        referenceNumber || null,
        metadata ? JSON.stringify(metadata) : null
      ]);

      return result.rows[0]?.id || null;
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  }

  /**
   * Extract pagination parameters from query string
   */
  protected static getPaginationParams(query: any) {
    return {
      page: Number(query.page || 1),
      limit: Number(query.limit || 20),
      offset: (Number(query.page || 1) - 1) * Number(query.limit || 20)
    };
  }

  /**
   * Format paginated response with metadata
   */
  protected static formatPaginatedResponse(
    data: any[],
    total: number,
    page: number,
    limit: number
  ) {
    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasMore: page * limit < total
    };
  }

  /**
   * Validate that a client has access to a specific organization
   */
  protected static async validateClientAccess(
    clientId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const query = `
        SELECT 1 FROM clients
        WHERE id = $1 AND team_id = $2 AND status = 'active'
      `;
      const result = await db.query(query, [clientId, organizationId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error("Error validating client access:", error);
      return false;
    }
  }
}
