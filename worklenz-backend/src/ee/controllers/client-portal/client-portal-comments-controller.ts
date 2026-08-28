import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { IO } from "../../../shared/io";
import { getBaseUrl } from "../../../cron_jobs/helpers";
import { sendClientPortalRequestCommentNotification } from "../../../shared/email-notifications";

export default class ClientPortalCommentsController extends ClientPortalControllerBase {

  static async getRequestComments(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const { clientId, organizationId } = req;

      // Verify request exists and belongs to client or organization
      // First check if request exists with exact client match
      let requestCheck = await db.query(
        "SELECT id, client_id, organization_team_id FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      // If not found, check if request exists in the same organization (for multi-client scenarios)
      if (requestCheck.rows.length === 0) {
        requestCheck = await db.query(
          "SELECT id, client_id, organization_team_id FROM client_portal_requests WHERE id = $1 AND organization_team_id = $2",
          [id, organizationId]
        );
      }

      if (requestCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      // Get comments for the request
      const query = `
        SELECT
          c.id,
          c.comment,
          c.sender_type,
          c.sender_id,
          c.sender_name,
          c.created_at,
          c.updated_at
        FROM client_portal_request_comments c
        WHERE c.request_id = $1 AND c.organization_team_id = $2
        ORDER BY c.created_at ASC
      `;

      const result = await db.query(query, [id, organizationId]);

      return res.json(new ServerResponse(true, result.rows, "Comments retrieved successfully"));
    } catch (error) {
      console.error("Error fetching request comments:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve comments"));
    }
  }

  static async addRequestComment(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const { clientId, organizationId, clientRelationshipId } = req;
      const { comment } = req.body;

      if (!comment || !comment.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Comment is required"));
      }

      // Validate comment length (max 5000 characters)
      const MAX_COMMENT_LENGTH = 5000;
      if (comment.trim().length > MAX_COMMENT_LENGTH) {
        return res.status(400).json(new ServerResponse(false, null, `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`));
      }

      // Verify request exists and belongs to client
      const requestCheck = await db.query(
        "SELECT id, status FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      // Get client name for sender_name
      const clientQuery = await db.query(
        "SELECT name FROM clients WHERE id = $1",
        [clientId]
      );
      const senderName = clientQuery.rows[0]?.name || "Client";

      // Use clientRelationshipId from request if available, otherwise fallback to clientId
      const relationshipId = clientRelationshipId || clientId;

      // Insert comment
      const insertQuery = `
        INSERT INTO client_portal_request_comments (
          request_id,
          organization_team_id,
          client_id,
          comment,
          sender_type,
          sender_id,
          sender_name,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, comment, sender_type, sender_id, sender_name, created_at, updated_at
      `;

      const result = await db.query(insertQuery, [
        id,
        organizationId,
        clientId,
        comment.trim(),
        'client',
        relationshipId,
        senderName
      ]);

      const newComment = result.rows[0];

      // Emit socket event for new comment
      try {
        const io = IO.getInstance();
        if (io) {
          io.emit(`client_portal:request_comment_added`, {
            requestId: id,
            comment: newComment,
            clientId,
            organizationId
          });
        }
      } catch (socketError) {
        console.error("Error emitting comment socket event:", socketError);
      }

      // Send email notification to team admins
      try {
        // Get request details for notification
        const requestDetails = await db.query(
          `SELECT r.req_no, s.name as service_name
           FROM client_portal_requests r
           JOIN client_portal_services s ON r.service_id = s.id
           WHERE r.id = $1`,
          [id]
        );

        if (requestDetails.rows.length > 0) {
          const { req_no, service_name } = requestDetails.rows[0];

          // Get team name and admin emails
          const teamQuery = await db.query(
            `SELECT t.name as team_name, u.email
             FROM teams t
             JOIN team_members tm ON tm.team_id = t.id
             JOIN users u ON u.id = tm.user_id
             WHERE t.id = $1 AND (tm.role_id IN (SELECT id FROM roles WHERE admin_role = true) OR t.user_id = u.id)`,
            [organizationId]
          );

          if (teamQuery.rows.length > 0) {
            const teamName = teamQuery.rows[0].team_name;
            const adminEmails = teamQuery.rows.map((row: any) => row.email).filter(Boolean);
            const baseUrl = getBaseUrl();
            const requestUrl = `${baseUrl}/worklenz/client-portal/requests/${id}`;

            // Send to each admin
            for (const adminEmail of adminEmails) {
              await sendClientPortalRequestCommentNotification(adminEmail, {
                greeting: "Hello",
                summary: `New comment on request ${req_no} from ${senderName}`,
                senderName: senderName,
                senderType: 'client',
                comment: comment.trim().substring(0, 500) + (comment.trim().length > 500 ? '...' : ''),
                requestNumber: req_no,
                serviceName: service_name,
                requestUrl: requestUrl,
                teamName: teamName
              });
            }
          }
        }
      } catch (emailError) {
        console.error("Error sending comment notification email:", emailError);
      }

      return res.json(new ServerResponse(true, newComment, "Comment added successfully"));
    } catch (error) {
      console.error("Error adding comment:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to add comment"));
    }
  }

}
