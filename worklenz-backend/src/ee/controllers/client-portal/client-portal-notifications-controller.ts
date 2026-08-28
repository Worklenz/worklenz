import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";

export default class ClientPortalNotificationsController extends ClientPortalControllerBase {

  static async getNotifications(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 20, unread_only = false } = req.query;

      const pageNum = Number(page);
      const limitNum = Number(limit);
      const offset = (pageNum - 1) * limitNum;

      // Build query based on unread_only filter
      let whereClause = "WHERE client_id = $1 AND organization_team_id = $2";
      if (String(unread_only) === "true") {
        whereClause += " AND is_read = false";
      }

      // Get notifications from the centralized table
      const notificationsQuery = `
        SELECT
          id,
          type,
          reference_id,
          reference_number,
          title,
          message,
          metadata,
          is_read,
          read_at,
          created_at
        FROM client_portal_notifications
        ${whereClause}
        ORDER BY created_at DESC
        LIMIT $3 OFFSET $4
      `;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_notifications
        ${whereClause}
      `;
      const countResult = await db.query(countQuery, [clientId, organizationId]);
      const total = parseInt(countResult.rows[0]?.total || "0", 10);

      const notificationsResult = await db.query(notificationsQuery, [
        clientId,
        organizationId,
        limitNum,
        offset
      ]);

      // Get unread count
      const unreadCountQuery = `
        SELECT COUNT(*) as unread_count
        FROM client_portal_notifications
        WHERE client_id = $1 AND organization_team_id = $2 AND is_read = false
      `;
      const unreadCountResult = await db.query(unreadCountQuery, [clientId, organizationId]);
      const unreadCount = parseInt(unreadCountResult.rows[0]?.unread_count || "0", 10);

      // Map notifications to response format
      const notifications = notificationsResult.rows.map((row: any) => ({
        id: row.id,
        type: row.type,
        referenceId: row.reference_id,
        referenceNumber: row.reference_number,
        title: row.title,
        message: row.message,
        metadata: row.metadata || {},
        isRead: row.is_read,
        readAt: row.read_at,
        createdAt: row.created_at
      }));

      return res.json(new ServerResponse(true, {
        notifications,
        total,
        unreadCount,
        page: pageNum,
        limit: limitNum
      }, "Notifications retrieved successfully"));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve notifications")
        );
    }
  }

  static async markNotificationRead(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Update the notification in the centralized table
      const updateQuery = `
        UPDATE client_portal_notifications
        SET is_read = true, read_at = NOW(), updated_at = NOW()
        WHERE id = $1 AND client_id = $2 AND organization_team_id = $3
        RETURNING id, type, reference_id
      `;

      const updateResult = await db.query(updateQuery, [id, clientId, organizationId]);

      if (updateResult.rowCount === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Notification not found"));
      }

      const notification = updateResult.rows[0];

      return res.json(new ServerResponse(true, {
        id: notification.id,
        type: notification.type,
        referenceId: notification.reference_id,
        markedAt: new Date()
      }, "Notification marked as read"));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to mark notification as read")
        );
    }
  }

  static async markAllNotificationsRead(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;

      // Mark all unread notifications as read
      const updateQuery = `
        UPDATE client_portal_notifications
        SET is_read = true, read_at = NOW(), updated_at = NOW()
        WHERE client_id = $1 AND organization_team_id = $2 AND is_read = false
      `;

      const updateResult = await db.query(updateQuery, [clientId, organizationId]);
      const markedCount = updateResult.rowCount || 0;

      return res.json(new ServerResponse(true, {
        markedCount,
        markedAt: new Date()
      }, "All notifications marked as read"));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to mark notifications as read"
          )
        );
    }
  }

}
