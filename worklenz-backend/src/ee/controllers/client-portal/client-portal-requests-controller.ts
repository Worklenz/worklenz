import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { IO } from "../../../shared/io";
import { getBaseUrl } from "../../../cron_jobs/helpers";
import { sendClientPortalNewRequestNotification } from "../../../shared/email-notifications";
import crypto from "crypto";
import moment from "moment-timezone";

export default class ClientPortalRequestsController extends ClientPortalControllerBase {
  private static async getUserTimezone(userId: string) {
    try {
      const timezoneQuery = await db.query(
        `SELECT tz.name as timezone
         FROM users u
         JOIN timezones tz ON u.timezone_id = tz.id
         WHERE u.id = $1`,
        [userId]
      );

      return timezoneQuery.rows[0]?.timezone || "UTC";
    } catch (error) {
      console.error("Error fetching user timezone:", error);
      return "UTC";
    }
  }

  static async getRequests(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 10, status, search } = req.query;

      // Build query with pagination and filtering
      let query = `
        SELECT
          r.id,
          r.req_no,
          r.service_id,
          r.status,
          r.request_data,
          r.notes,
          r.created_at,
          r.updated_at,
          r.completed_at,
          s.name as service_name,
          s.description as service_description,
          c.name as client_name
        FROM client_portal_requests r
        JOIN client_portal_services s ON r.service_id = s.id
        JOIN clients c ON r.client_id = c.id
        WHERE r.client_id = $1 AND r.organization_team_id = $2
      `;

      const queryParams = [clientId, organizationId];
      let paramIndex = 3;

      // Add status filter if provided
      if (status) {
        query += ` AND r.status = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (r.req_no ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR r.notes ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_requests r
        JOIN client_portal_services s ON r.service_id = s.id
        WHERE r.client_id = $1 AND r.organization_team_id = $2
        ${status ? `AND r.status = $${status ? 3 : 3}` : ""}
        ${
          search
            ? `AND (r.req_no ILIKE $${status ? 4 : 3} OR s.name ILIKE $${
                status ? 4 : 3
              } OR r.notes ILIKE $${status ? 4 : 3})`
            : ""
        }
      `;
      const countParams =
        status && search
          ? [clientId, organizationId, status, `%${search}%`]
          : status
          ? [clientId, organizationId, status]
          : search
          ? [clientId, organizationId, `%${search}%`]
          : [clientId, organizationId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const requests = result.rows.map((row: any) => ({
        id: row.id,
        req_no: row.req_no,
        service_id: row.service_id,
        service_name: row.service_name,
        service_description: row.service_description,
        status: row.status,
        request_data: row.request_data,
        notes: row.notes,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at,
        client_name: row.client_name,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            requests,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Requests retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching requests:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve requests"));
    }
  }

  static async createRequest(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { clientEmail } = req;
      const { serviceId, requestData, notes } = req.body;

      // Validate required fields
      if (!serviceId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Service ID is required"));
      }

      // Verify service exists and client has access, and get service_key
      const serviceCheck = await db.query(
        `SELECT id, name, service_key FROM client_portal_services
         WHERE id = $1 AND organization_team_id = $2
         AND (is_public = true OR $3 = ANY(allowed_client_ids))`,
        [serviceId, organizationId, clientId]
      );

      if (serviceCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Service not found or not accessible"
            )
          );
      }

      const service = serviceCheck.rows[0];
      const serviceKey = service.service_key || 'SVC'; // Default fallback if key is missing

      // Generate request number at application level with transaction and row-level lock
      // Request numbers are unique per service (format: REQ-{SERVICE_KEY}-0001, REQ-{SERVICE_KEY}-0002, etc.)
      let reqNo: string;
      let newRequest: any;
      const maxRetries = 5;
      
      for (let attempt = 0; attempt < maxRetries; attempt++) {
        const client = await db.pool.connect();
        try {
          await client.query('BEGIN');
          
          // Use PostgreSQL advisory lock to prevent concurrent access to sequence
          // Lock ID is derived from service ID hash to ensure per-service locking
          const lockId = parseInt(crypto.createHash('md5').update(serviceId).digest('hex').substring(0, 8), 16) % 2147483647;
          await client.query('SELECT pg_advisory_xact_lock($1)', [lockId]);
          
          // Use a single atomic operation to insert or update and get the next number
          // This CTE ensures the operation is atomic and prevents race conditions
          const seqResult = await client.query(
            `WITH inserted AS (
               INSERT INTO client_portal_request_sequences (service_id, last_request_number)
               VALUES ($1, 1)
               ON CONFLICT (service_id) DO UPDATE SET
                 last_request_number = client_portal_request_sequences.last_request_number + 1,
                 updated_at = NOW()
               RETURNING last_request_number
             )
             SELECT last_request_number FROM inserted`,
            [serviceId]
          );
          
          if (!seqResult.rows || seqResult.rows.length === 0) {
            throw new Error('Failed to generate request sequence number');
          }
          
          const nextNumber = seqResult.rows[0].last_request_number;
          // Format: REQ-{SERVICE_KEY}-0001, REQ-{SERVICE_KEY}-0002, etc. (unique per service)
          reqNo = `REQ-${serviceKey}-${String(nextNumber).padStart(4, '0')}`;

          // Create request with generated req_no in same transaction
          const insertQuery = `
            INSERT INTO client_portal_requests (
              req_no, service_id, client_id, organization_team_id,
              status, request_data, notes, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
            RETURNING id, req_no, service_id, status, request_data, notes, created_at, updated_at
          `;

          const insertValues = [
            reqNo,
            serviceId,
            clientId,
            organizationId,
            "pending",
            requestData ? JSON.stringify(requestData) : null,
            notes || null,
          ];

          const result = await client.query(insertQuery, insertValues);
          newRequest = result.rows[0];
          
          await client.query('COMMIT');
          client.release();
          break; // Success, exit retry loop
          
        } catch (error: any) {
          await client.query('ROLLBACK');
          client.release();
          
          // If duplicate key error and not last attempt, retry
          if (error.code === '23505' && attempt < maxRetries - 1) {
            await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1))); // Exponential backoff
            continue;
          }
          throw error; // Re-throw if not duplicate or last attempt
        }
      }

      // Service already retrieved above, reuse it

      // Send email notification to team admins
      try {
        // Get client name
        const clientQuery = await db.query(
          "SELECT name FROM clients WHERE id = $1",
          [clientId]
        );
        const clientName = clientQuery.rows[0]?.name || "Client";

        // Get team name and admin emails
        const teamQuery = await db.query(
          `SELECT t.name as team_name, u.id as user_id, u.email, u.name as user_name
           FROM teams t
           JOIN team_members tm ON tm.team_id = t.id
           JOIN users u ON u.id = tm.user_id
           WHERE t.id = $1 AND (tm.role_id IN (SELECT id FROM roles WHERE admin_role = true) OR t.user_id = u.id)`,
          [organizationId]
        );

        if (teamQuery.rows.length > 0) {
          const teamName = teamQuery.rows[0].team_name;
          const adminRecipients = teamQuery.rows.filter((row: any) => row.email);

          if (adminRecipients.length > 0) {
            const baseUrl = getBaseUrl();
            const requestUrl = `${baseUrl}/worklenz/client-portal/requests/${newRequest.id}`;

            // Get request title from requestData if available
            let requestTitle = "";
            if (requestData) {
              const parsedData = typeof requestData === 'string' ? JSON.parse(requestData) : requestData;
              requestTitle = parsedData.title || parsedData.name || "";
            }

            for (const recipient of adminRecipients) {
              const userTimezone = recipient.user_id
                ? await ClientPortalRequestsController.getUserTimezone(recipient.user_id)
                : "UTC";

              await sendClientPortalNewRequestNotification([recipient.email], {
                greeting: "Hello",
                requestNumber: newRequest.req_no,
                serviceName: service.name,
                clientName: clientName,
                submittedAt: moment
                  .tz(newRequest.created_at, userTimezone)
                  .format("M/D/YYYY, h:mm:ss A z"),
                requestTitle: requestTitle,
                requestUrl: requestUrl,
                teamName: teamName
              });
            }
          }
        }
      } catch (emailError) {
        console.error("Error sending new request notification email:", emailError);
      }

      return res.json(new ServerResponse(true, {
        id: newRequest.id,
        requestNumber: newRequest.req_no,
        serviceId: newRequest.service_id,
        serviceName: service.name,
        status: newRequest.status,
        requestData: newRequest.request_data,
        notes: newRequest.notes,
        createdAt: newRequest.created_at,
        updatedAt: newRequest.updated_at
      }, "Request created successfully"));
    } catch (error) {
      console.error("Error creating request:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create request"));
    }
  }

  static async getRequestDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Get request details with service information
      const query = `
        SELECT
          r.id,
          r.req_no,
          r.service_id,
          r.status,
          r.request_data,
          r.notes,
          r.created_at,
          r.updated_at,
          r.completed_at,
          s.name as service_name,
          s.description as service_description,
          s.service_data as service_config,
          c.name as client_name
        FROM client_portal_requests r
        JOIN client_portal_services s ON r.service_id = s.id
        JOIN clients c ON r.client_id = c.id
        WHERE r.id = $1 AND r.client_id = $2 AND r.organization_team_id = $3
      `;

      const result = await db.query(query, [id, clientId, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const request = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: request.id,
            req_no: request.req_no,
            service_id: request.service_id,
            service_name: request.service_name,
            service_description: request.service_description,
            service_config: request.service_config,
            status: request.status,
            request_data: request.request_data,
            notes: request.notes,
            created_at: request.created_at,
            updated_at: request.updated_at,
            completed_at: request.completed_at,
            client_name: request.client_name,
          },
          "Request details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching request details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve request details")
        );
    }
  }

  static async updateRequest(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;
      const { requestData, notes } = req.body;

      // Verify request exists and belongs to client
      const requestCheck = await db.query(
        "SELECT id, status FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const currentRequest = requestCheck.rows[0];

      // Only allow updates if request is in pending status
      if (currentRequest.status !== "pending") {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Cannot update request after it has been accepted"
            )
          );
      }

      // Update request data
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      if (requestData) {
        updateFields.push(`request_data = $${paramIndex}`);
        updateValues.push(JSON.stringify(requestData));
        paramIndex++;
      }

      if (notes !== undefined) {
        updateFields.push(`notes = $${paramIndex}`);
        updateValues.push(notes);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id, clientId, organizationId);

      const query = `
        UPDATE client_portal_requests
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex} AND client_id = $${
        paramIndex + 1
      } AND organization_team_id = $${paramIndex + 2}
        RETURNING id, req_no, service_id, status, request_data, notes, created_at, updated_at
      `;

      const result = await db.query(query, updateValues);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const updatedRequest = result.rows[0];

      // Emit socket event for request update
      try {
        const io = IO.getInstance();
        if (io) {
          io.emit(`client_portal:request_status_updated`, {
            requestId: updatedRequest.id,
            requestNumber: updatedRequest.req_no,
            status: updatedRequest.status,
            clientId,
            organizationId,
            notes: updatedRequest.notes,
            updatedAt: updatedRequest.updated_at,
          });
        }
      } catch (socketError) {
        console.error(
          "Error emitting request update socket event:",
          socketError
        );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedRequest.id,
            requestNumber: updatedRequest.req_no,
            serviceId: updatedRequest.service_id,
            status: updatedRequest.status,
            requestData: updatedRequest.request_data,
            notes: updatedRequest.notes,
            createdAt: updatedRequest.created_at,
            updatedAt: updatedRequest.updated_at,
          },
          "Request updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating request:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update request"));
    }
  }

  static async deleteRequest(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Verify request exists and belongs to client
      const requestCheck = await db.query(
        "SELECT id, status FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const currentRequest = requestCheck.rows[0];

      // Only allow deletion if request is in pending status
      if (currentRequest.status !== "pending") {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Cannot delete request after it has been accepted"
            )
          );
      }

      // Delete the request
      const deleteResult = await db.query(
        "DELETE FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (deleteResult.rowCount === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      return res.json(
        new ServerResponse(true, null, "Request deleted successfully")
      );
    } catch (error) {
      console.error("Error deleting request:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to delete request"));
    }
  }

  static async getRequestStatusOptions(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const statusOptions = [
        {
          value: "pending",
          label: "Pending",
          description: "Request is waiting for review",
          color: "#faad14",
        },
        {
          value: "accepted",
          label: "Accepted",
          description: "Request has been accepted and will be processed",
          color: "#52c41a",
        },
        {
          value: "in_progress",
          label: "In Progress",
          description: "Request is currently being worked on",
          color: "#1890ff",
        },
        {
          value: "completed",
          label: "Completed",
          description: "Request has been completed successfully",
          color: "#52c41a",
        },
        {
          value: "rejected",
          label: "Rejected",
          description: "Request has been rejected",
          color: "#f5222d",
        },
      ];

      return res.json(
        new ServerResponse(
          true,
          statusOptions,
          "Request status options retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching request status options:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve request status options"
          )
        );
    }
  }

  static async getRequestStatusHistory(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      const requestCheck = await db.query(
        "SELECT id FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const query = `
        SELECT
          h.id,
          h.previous_status,
          h.new_status,
          h.notes,
          h.changed_at,
          u.name as changed_by_name,
          cu.name as changed_by_client_name
        FROM client_portal_request_status_history h
        LEFT JOIN users u ON h.changed_by = u.id
        LEFT JOIN client_users cu ON h.changed_by_client = cu.id
        WHERE h.request_id = $1
        ORDER BY h.changed_at ASC
      `;

      const result = await db.query(query, [id]);

      return res.json(
        new ServerResponse(
          true,
          result.rows,
          "Request status history retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching request status history:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve request status history"
          )
        );
    }
  }

}
