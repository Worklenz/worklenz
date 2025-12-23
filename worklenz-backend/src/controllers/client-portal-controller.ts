import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import TokenService from "../services/token-service";
import { sendEmail, sendEmailEnhanced, EmailRequest } from "../shared/email";
import { AuthenticatedClientRequest } from "../middlewares/client-auth-middleware";
import FileConstants from "../shared/file-constants";
import { IEmailTemplateType } from "../interfaces/email-template-type";
import { getBaseUrl, getClientPortalBaseUrl } from "../cron_jobs/helpers";
import {
  uploadBase64,
  getClientPortalLogoKey,
  deleteObject,
} from "../shared/storage";
import { log_error } from "../shared/utils";
import { IO } from "../shared/io";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { generateUniqueSlug, suggestSlug, isValidSlug } from "../utils/slug";
import {
  sendClientPortalNewRequestNotification,
  sendClientPortalRequestCommentNotification,
} from "../shared/email-notifications";

class ClientPortalController {
  // Dashboard
  static async getDashboard(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;

      // Get request statistics
      const requestStatsQuery = `
        SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_requests,
          COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests
        FROM client_portal_requests
        WHERE client_id = $1 AND organization_team_id = $2
      `;

      const requestStatsResult = await db.query(requestStatsQuery, [
        clientId,
        organizationId,
      ]);
      const requestStats = requestStatsResult.rows[0];

      // Get project statistics (assuming client has access to projects)
      const projectStatsQuery = `
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN sps.name = 'Active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN sps.name = 'Completed' THEN 1 END) as completed_projects
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
      `;

      const projectStatsResult = await db.query(projectStatsQuery, [clientId]);
      const projectStats = projectStatsResult.rows[0];

      // Get invoice statistics
      const invoiceStatsQuery = `
        SELECT 
          COUNT(*) as total_invoices,
          COUNT(CASE WHEN status != 'paid' THEN 1 END) as unpaid_invoices,
          COALESCE(SUM(CASE WHEN status != 'paid' THEN amount END), 0) as unpaid_amount
        FROM client_portal_invoices
        WHERE client_id = $1 AND organization_team_id = $2
      `;

      const invoiceStatsResult = await db.query(invoiceStatsQuery, [
        clientId,
        organizationId,
      ]);
      const invoiceStats = invoiceStatsResult.rows[0];

      const dashboardData = {
        totalProjects: parseInt(projectStats.total_projects || "0"),
        activeProjects: parseInt(projectStats.active_projects || "0"),
        completedProjects: parseInt(projectStats.completed_projects || "0"),
        totalRequests: parseInt(requestStats.total_requests || "0"),
        pendingRequests: parseInt(requestStats.pending_requests || "0"),
        acceptedRequests: parseInt(requestStats.accepted_requests || "0"),
        inProgressRequests: parseInt(requestStats.in_progress_requests || "0"),
        completedRequests: parseInt(requestStats.completed_requests || "0"),
        rejectedRequests: parseInt(requestStats.rejected_requests || "0"),
        totalInvoices: parseInt(invoiceStats.total_invoices || "0"),
        unpaidInvoices: parseInt(invoiceStats.unpaid_invoices || "0"),
        unpaidAmount: parseFloat(invoiceStats.unpaid_amount || "0"),
      };

      return res.json(
        new ServerResponse(
          true,
          dashboardData,
          "Dashboard data retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve dashboard data")
        );
    }
  }

  // Services
  static async getServices(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 10, status = "active" } = req.query;

      // Get services that are either public or specifically allowed for this client
      const query = `
        SELECT 
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.created_at,
          s.updated_at,
          s.price,
          s.currency
        FROM client_portal_services s
        WHERE s.organization_team_id = $1 
        AND s.status = $2
        AND (s.is_public = true OR $3 = ANY(s.allowed_client_ids))
        ORDER BY s.name ASC
      `;

      const result = await db.query(query, [organizationId, status, clientId]);
      const services = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        serviceData: row.service_data,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        price: row.price || 0,
        currency: row.currency || "USD",
      }));

      return res.json(
        new ServerResponse(true, services, "Services retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching services:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve services"));
    }
  }

  static async getServiceDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Get service details if client has access
      const query = `
        SELECT 
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.created_at,
          s.updated_at,
          s.price,
          s.currency
        FROM client_portal_services s
        WHERE s.id = $1 
        AND s.organization_team_id = $2
        AND s.status = 'active'
        AND (s.is_public = true OR $3 = ANY(s.allowed_client_ids))
      `;

      const result = await db.query(query, [id, organizationId, clientId]);

      if (result.rows.length === 0) {
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

      const service = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
            price: service.price || 0,
            currency: service.currency || "USD",
          },
          "Service details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching service details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve service details")
        );
    }
  }

  // Requests
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

      // Verify service exists and client has access
      const serviceCheck = await db.query(
        `SELECT id, name FROM client_portal_services 
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

      // Generate request number (sequential per organization)
      const countResult = await db.query(
        "SELECT COUNT(*) + 1 as next_num FROM client_portal_requests WHERE organization_team_id = $1",
        [organizationId]
      );
      const nextNum = countResult.rows[0]?.next_num || 1;
      const requestNumber = `REQ-${String(nextNum).padStart(4, "0")}`;

      // Create request
      const query = `
        INSERT INTO client_portal_requests (
          req_no, service_id, client_id, organization_team_id, 
          status, request_data, notes, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
        RETURNING id, req_no, service_id, status, request_data, notes, created_at, updated_at
      `;

      const values = [
        requestNumber,
        serviceId,
        clientId,
        organizationId,
        "pending",
        requestData ? JSON.stringify(requestData) : null,
        notes || null,
      ];

      const result = await db.query(query, values);
      const newRequest = result.rows[0];

      // Get service name for response
      const service = serviceCheck.rows[0];

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
          `SELECT t.name as team_name, u.email, u.name as user_name
           FROM teams t
           JOIN team_members tm ON tm.team_id = t.id
           JOIN users u ON u.id = tm.user_id
           WHERE t.id = $1 AND (tm.role_id IN (SELECT id FROM roles WHERE admin_role = true) OR t.user_id = u.id)`,
          [organizationId]
        );

        if (teamQuery.rows.length > 0) {
          const teamName = teamQuery.rows[0].team_name;
          const adminEmails = teamQuery.rows
            .map((row: any) => row.email)
            .filter(Boolean);

          if (adminEmails.length > 0) {
            const baseUrl = getBaseUrl();
            const requestUrl = `${baseUrl}/worklenz/client-portal/requests/${newRequest.id}`;

            // Get request title from requestData if available
            let requestTitle = "";
            if (requestData) {
              const parsedData =
                typeof requestData === "string"
                  ? JSON.parse(requestData)
                  : requestData;
              requestTitle = parsedData.title || parsedData.name || "";
            }

            await sendClientPortalNewRequestNotification(adminEmails, {
              greeting: "Hello",
              requestNumber: newRequest.req_no,
              serviceName: service.name,
              clientName: clientName,
              submittedAt: new Date(newRequest.created_at).toLocaleString(),
              requestTitle: requestTitle,
              requestUrl: requestUrl,
              teamName: teamName,
            });
          }
        }
      } catch (emailError) {
        console.error(
          "Error sending new request notification email:",
          emailError
        );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: newRequest.id,
            requestNumber: newRequest.req_no,
            serviceId: newRequest.service_id,
            serviceName: service.name,
            status: newRequest.status,
            requestData: newRequest.request_data,
            notes: newRequest.notes,
            createdAt: newRequest.created_at,
            updatedAt: newRequest.updated_at,
          },
          "Request created successfully"
        )
      );
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

  // Request Status Options
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

  // Request Comments
  static async getRequestComments(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
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
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
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

      return res.json(
        new ServerResponse(true, result.rows, "Comments retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching request comments:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve comments"));
    }
  }

  static async addRequestComment(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId, organizationId, clientRelationshipId } = req;
      const { comment } = req.body;

      if (!comment || !comment.trim()) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Comment is required"));
      }

      // Validate comment length (max 5000 characters)
      const MAX_COMMENT_LENGTH = 5000;
      if (comment.trim().length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`
            )
          );
      }

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
        "client",
        relationshipId,
        senderName,
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
            organizationId,
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
            const adminEmails = teamQuery.rows
              .map((row: any) => row.email)
              .filter(Boolean);
            const baseUrl = getBaseUrl();
            const requestUrl = `${baseUrl}/worklenz/client-portal/requests/${id}`;

            // Send to each admin
            for (const adminEmail of adminEmails) {
              await sendClientPortalRequestCommentNotification(adminEmail, {
                greeting: "Hello",
                summary: `New comment on request ${req_no} from ${senderName}`,
                senderName: senderName,
                senderType: "client",
                comment:
                  comment.trim().substring(0, 500) +
                  (comment.trim().length > 500 ? "..." : ""),
                requestNumber: req_no,
                serviceName: service_name,
                requestUrl: requestUrl,
                teamName: teamName,
              });
            }
          }
        }
      } catch (emailError) {
        console.error("Error sending comment notification email:", emailError);
      }

      return res.json(
        new ServerResponse(true, newComment, "Comment added successfully")
      );
    } catch (error) {
      console.error("Error adding comment:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to add comment"));
    }
  }

  // Organization Services Management (for organization users)
  static async getOrganizationServices(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { organizationId } = req;
      const {
        page = 1,
        limit = 10,
        search,
        sortBy = "name",
        sortOrder = "asc",
      } = req.query;

      let whereClause = "WHERE s.organization_team_id = $1";
      const queryParams = [organizationId];
      let paramCount = 1;

      // Add search filter
      if (search) {
        paramCount++;
        whereClause += ` AND (LOWER(s.name) LIKE LOWER($${paramCount}) OR LOWER(s.description) LIKE LOWER($${paramCount}))`;
        queryParams.push(`%${search}%`);
      }

      // Build main query
      const query = `
        SELECT 
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.created_at,
          s.updated_at,
          u.name as created_by_name,
          COUNT(r.id) as requests_count
        FROM client_portal_services s
        LEFT JOIN users u ON s.created_by = u.id
        LEFT JOIN client_portal_requests r ON s.id = r.service_id
        ${whereClause}
        GROUP BY s.id, u.name
        ORDER BY ${sortBy} ${String(sortOrder).toUpperCase()}
        LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}
      `;

      queryParams.push(
        String(limit),
        String((Number(page) - 1) * Number(limit))
      );

      const result = await db.query(query, queryParams);

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_services s
        ${whereClause}
      `;
      const countResult = await db.query(
        countQuery,
        queryParams.slice(0, paramCount)
      );
      const total = parseInt(countResult.rows[0].total);

      const services = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        serviceData: row.service_data,
        isPublic: row.is_public,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        createdByName: row.created_by_name,
        requestsCount: parseInt(row.requests_count || 0),
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            services,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Organization services retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching organization services:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve organization services"
          )
        );
    }
  }

  static async getOrganizationServiceById(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      const query = `
        SELECT 
          s.id,
          s.name,
          s.description,
          s.status,
          s.service_data,
          s.is_public,
          s.allowed_client_ids,
          s.price,
          s.currency,
          s.category,
          s.created_at,
          s.updated_at,
          u.name as created_by_name
        FROM client_portal_services s
        LEFT JOIN users u ON s.created_by = u.id
        WHERE s.id = $1 AND s.organization_team_id = $2
      `;

      const result = await db.query(query, [id, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Service not found"));
      }

      const service = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            allowedClientIds: service.allowed_client_ids,
            price: service.price,
            currency: service.currency,
            category: service.category,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
            createdByName: service.created_by_name,
          },
          "Service retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve service"));
    }
  }

  static async createOrganizationService(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const {
        name,
        description,
        service_data,
        is_public = false,
        allowed_client_ids = [],
        price,
        currency,
        category,
        // Image upload fields
        imageData,
        imageName,
        imageType,
      } = req.body;
      const { organizationId, clientUserId } = req;

      console.log("Service creation request received:", {
        name,
        price,
        currency,
        category,
        hasImageData: !!imageData,
        imageName,
        imageType,
        imageDataLength: imageData?.length,
        organizationId,
      });

      if (!name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Service name is required"));
      }

      let finalServiceData = { ...service_data };

      // Handle image upload if provided
      if (imageData && imageName && imageType) {
        console.log("Processing image upload...");

        // Validate image
        const allowedImageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedImageTypes.includes(imageType)) {
          return res
            .status(400)
            .json(
              new ServerResponse(
                false,
                null,
                "Only JPEG, PNG, GIF, and WebP images are allowed"
              )
            );
        }

        // Validate file size (assuming base64 data) - 5MB limit
        const fileSizeBytes = Math.floor((imageData.length * 3) / 4);
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit

        if (fileSizeBytes > maxSizeBytes) {
          return res
            .status(400)
            .json(
              new ServerResponse(false, null, "Image size exceeds 5MB limit")
            );
        }

        // Generate unique filename and storage key
        const fileExtension = imageName.substring(imageName.lastIndexOf("."));
        const uniqueFileName = `service_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}${fileExtension}`;
        const storageKey = `client-portal/service-images/${organizationId}/${uniqueFileName}`;

        try {
          // Upload to S3
          const imageUrl = await uploadBase64(imageData, storageKey);

          if (!imageUrl) {
            return res
              .status(500)
              .json(
                new ServerResponse(
                  false,
                  null,
                  "Failed to upload service image"
                )
              );
          }

          // Add image URL to service data
          finalServiceData = {
            ...finalServiceData,
            images: [imageUrl],
          };

          console.log(
            `Service image uploaded for organization ${organizationId}:`,
            {
              imageName,
              imageType,
              storageKey,
              fileSizeBytes,
              imageUrl,
            }
          );
        } catch (uploadError) {
          console.error("Error uploading service image:", uploadError);
          return res
            .status(500)
            .json(
              new ServerResponse(false, null, "Failed to upload service image")
            );
        }
      } else {
        console.log("No image data provided in request");
      }

      console.log("Final service data being stored:", finalServiceData);

      const query = `
        INSERT INTO client_portal_services (
          name, description, service_data, is_public, allowed_client_ids,
          price, currency, category,
          team_id, organization_team_id, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const result = await db.query(query, [
        name,
        description,
        JSON.stringify(finalServiceData), // Ensure proper JSON stringification
        is_public,
        allowed_client_ids,
        price,
        currency,
        category,
        organizationId, // team_id
        organizationId, // organization_team_id
        clientUserId,
      ]);

      const service = result.rows[0];

      console.log("Service created in database:", {
        id: service.id,
        name: service.name,
        serviceData: service.service_data,
      });

      return res.status(201).json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            allowedClientIds: service.allowed_client_ids,
            price: service.price,
            currency: service.currency,
            category: service.category,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
          },
          "Service created successfully"
        )
      );
    } catch (error) {
      console.error("Error creating service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create service"));
    }
  }

  static async updateOrganizationService(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const {
        name,
        description,
        service_data,
        is_public,
        allowed_client_ids,
        status,
        price,
        currency,
        category,
        // Image upload fields
        imageData,
        imageName,
        imageType,
      } = req.body;
      const { organizationId } = req;

      console.log("Service update request received:", {
        id,
        name,
        price,
        currency,
        category,
        hasImageData: !!imageData,
        imageName,
        imageType,
        imageDataLength: imageData?.length,
        organizationId,
      });

      // First check if service exists and belongs to organization
      const checkQuery = `SELECT id FROM client_portal_services WHERE id = $1 AND organization_team_id = $2`;
      const checkResult = await db.query(checkQuery, [id, organizationId]);

      if (checkResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Service not found"));
      }

      let finalServiceData = service_data ? { ...service_data } : undefined;

      // Handle image upload if provided
      if (imageData && imageName && imageType) {
        console.log("Processing image upload for service update...");

        // Validate image
        const allowedImageTypes = [
          "image/jpeg",
          "image/png",
          "image/gif",
          "image/webp",
        ];
        if (!allowedImageTypes.includes(imageType)) {
          return res
            .status(400)
            .json(
              new ServerResponse(
                false,
                null,
                "Only JPEG, PNG, GIF, and WebP images are allowed"
              )
            );
        }

        // Validate file size (assuming base64 data) - 5MB limit
        const fileSizeBytes = Math.floor((imageData.length * 3) / 4);
        const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit

        if (fileSizeBytes > maxSizeBytes) {
          return res
            .status(400)
            .json(
              new ServerResponse(false, null, "Image size exceeds 5MB limit")
            );
        }

        // Generate unique filename and storage key
        const fileExtension = imageName.substring(imageName.lastIndexOf("."));
        const uniqueFileName = `service_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}${fileExtension}`;
        const storageKey = `client-portal/service-images/${organizationId}/${uniqueFileName}`;

        try {
          // Upload to S3
          const imageUrl = await uploadBase64(imageData, storageKey);

          if (!imageUrl) {
            return res
              .status(500)
              .json(
                new ServerResponse(
                  false,
                  null,
                  "Failed to upload service image"
                )
              );
          }

          // Get current service data to check for existing images to clean up
          const currentServiceQuery = `SELECT service_data FROM client_portal_services WHERE id = $1`;
          const currentServiceResult = await db.query(currentServiceQuery, [
            id,
          ]);
          const currentServiceData =
            currentServiceResult.rows[0]?.service_data || {};
          const oldImageUrls = currentServiceData?.images || [];

          // Clean up old images from S3 (async, don't wait for completion)
          if (oldImageUrls.length > 0) {
            oldImageUrls.forEach(async (oldImageUrl: string) => {
              try {
                const urlParts = oldImageUrl.split("/");
                const storageKey = urlParts.slice(-4).join("/");

                console.log("Cleaning up old service image:", {
                  serviceId: id,
                  oldImageUrl,
                  storageKey,
                });

                await deleteObject(storageKey);
                console.log(
                  "Successfully deleted old service image:",
                  storageKey
                );
              } catch (deleteError) {
                console.error("Error deleting old service image:", {
                  oldImageUrl,
                  error: deleteError,
                });
              }
            });
          }

          // Use current service data as base if finalServiceData wasn't provided
          if (!finalServiceData) {
            finalServiceData = currentServiceData;
          }

          // Add new image URL to service data
          finalServiceData = {
            ...finalServiceData,
            images: [imageUrl],
          };

          console.log(
            `Service image uploaded for organization ${organizationId}:`,
            {
              serviceId: id,
              imageName,
              imageType,
              storageKey,
              fileSizeBytes,
              imageUrl,
            }
          );
        } catch (uploadError) {
          console.error("Error uploading service image:", uploadError);
          return res
            .status(500)
            .json(
              new ServerResponse(false, null, "Failed to upload service image")
            );
        }
      }

      console.log("Final service data for update:", finalServiceData);

      const updateFields = [];
      const queryParams = [];
      let paramCount = 0;

      if (name !== undefined) {
        paramCount++;
        updateFields.push(`name = $${paramCount}`);
        queryParams.push(name);
      }
      if (description !== undefined) {
        paramCount++;
        updateFields.push(`description = $${paramCount}`);
        queryParams.push(description);
      }
      if (finalServiceData !== undefined) {
        paramCount++;
        updateFields.push(`service_data = $${paramCount}`);
        queryParams.push(JSON.stringify(finalServiceData)); // Ensure proper JSON stringification
      }
      if (is_public !== undefined) {
        paramCount++;
        updateFields.push(`is_public = $${paramCount}`);
        queryParams.push(is_public);
      }
      if (allowed_client_ids !== undefined) {
        paramCount++;
        updateFields.push(`allowed_client_ids = $${paramCount}`);
        queryParams.push(allowed_client_ids);
      }
      if (status !== undefined) {
        paramCount++;
        updateFields.push(`status = $${paramCount}`);
        queryParams.push(status);
      }
      if (price !== undefined) {
        paramCount++;
        updateFields.push(`price = $${paramCount}`);
        queryParams.push(price);
      }
      if (currency !== undefined) {
        paramCount++;
        updateFields.push(`currency = $${paramCount}`);
        queryParams.push(currency);
      }
      if (category !== undefined) {
        paramCount++;
        updateFields.push(`category = $${paramCount}`);
        queryParams.push(category);
      }

      if (updateFields.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No fields to update"));
      }

      // Add updated_at
      paramCount++;
      updateFields.push(`updated_at = $${paramCount}`);
      queryParams.push(new Date());

      // Add WHERE conditions
      paramCount++;
      queryParams.push(id);
      paramCount++;
      queryParams.push(organizationId);

      const updateQuery = `
        UPDATE client_portal_services 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramCount - 1} AND organization_team_id = $${paramCount}
        RETURNING *
      `;

      console.log("Update query:", updateQuery);
      console.log("Query params:", queryParams);

      const result = await db.query(updateQuery, queryParams);

      console.log("Update result:", {
        rowCount: result.rowCount,
        updatedService: result.rows[0],
      });
      const service = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: service.id,
            name: service.name,
            description: service.description,
            status: service.status,
            serviceData: service.service_data,
            isPublic: service.is_public,
            allowedClientIds: service.allowed_client_ids,
            price: service.price,
            currency: service.currency,
            category: service.category,
            createdAt: service.created_at,
            updatedAt: service.updated_at,
          },
          "Service updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update service"));
    }
  }

  static async deleteOrganizationService(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { organizationId } = req;

      console.log("Service deletion request received:", {
        serviceId: id,
        organizationId,
      });

      // Check if service has any requests
      const requestsQuery = `SELECT COUNT(*) as count FROM client_portal_requests WHERE service_id = $1`;
      const requestsResult = await db.query(requestsQuery, [id]);
      const requestsCount = parseInt(requestsResult.rows[0].count);

      if (requestsCount > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              `Cannot delete service with ${requestsCount} existing requests`
            )
          );
      }

      // Get service data before deletion to extract image URLs for cleanup
      const serviceQuery = `
        SELECT service_data 
        FROM client_portal_services 
        WHERE id = $1 AND organization_team_id = $2
      `;
      const serviceResult = await db.query(serviceQuery, [id, organizationId]);

      if (serviceResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Service not found"));
      }

      const serviceData = serviceResult.rows[0].service_data;
      const imageUrls = serviceData?.images || [];

      console.log("Found images to delete:", imageUrls);

      // Delete the service from database first
      const deleteQuery = `
        DELETE FROM client_portal_services 
        WHERE id = $1 AND organization_team_id = $2
        RETURNING id
      `;

      const result = await db.query(deleteQuery, [id, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(500)
          .json(
            new ServerResponse(
              false,
              null,
              "Failed to delete service from database"
            )
          );
      }

      // Clean up images from S3 storage (async, don't wait for completion)
      if (imageUrls.length > 0) {
        imageUrls.forEach(async (imageUrl: string) => {
          try {
            // Extract storage key from URL
            // URL format: https://s3-bucket/client-portal/service-images/orgId/filename
            const urlParts = imageUrl.split("/");
            const storageKey = urlParts.slice(-4).join("/"); // client-portal/service-images/orgId/filename

            console.log("Deleting image from S3:", {
              imageUrl,
              storageKey,
            });

            await deleteObject(storageKey);
            console.log("Successfully deleted image from S3:", storageKey);
          } catch (deleteError) {
            console.error("Error deleting image from S3:", {
              imageUrl,
              error: deleteError,
            });
            // Don't fail the service deletion if image cleanup fails
          }
        });
      }

      console.log("Service deleted successfully:", id);
      return res.json(
        new ServerResponse(true, null, "Service deleted successfully")
      );
    } catch (error) {
      console.error("Error deleting service:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to delete service"));
    }
  }

  // Projects
  static async getProjects(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { page = 1, limit = 10, status, search } = req.query;

      // Build query with pagination and filtering - only show projects assigned to this client
      let query = `
        SELECT 
          p.id,
          p.name,
          p.notes,
          p.status_id,
          sps.name as status_name,
          sps.color_code as status_color,
          p.created_at,
          p.updated_at,
          p.client_id,
          c.name as client_name,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done = true) THEN 1 END) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE p.client_id = $1
      `;

      const queryParams: (string | number)[] = [clientId as string];
      let paramIndex = 2;

      // Add status filter if provided
      if (status) {
        query += ` AND sps.name = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (p.name ILIKE $${paramIndex} OR p.notes ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      query += ` GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at, p.client_id, c.name`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
        ${status ? "AND sps.name = $2" : ""}
        ${
          search
            ? `AND (p.name ILIKE $${status ? 3 : 2} OR p.notes ILIKE $${
                status ? 3 : 2
              })`
            : ""
        }
      `;
      const countParams =
        status && search
          ? [clientId, status, `%${search}%`]
          : status
          ? [clientId, status]
          : search
          ? [clientId, `%${search}%`]
          : [clientId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const projects = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.notes,
        status: row.status_name,
        status_color: row.status_color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        client_id: row.client_id,
        client_name: row.client_name,
        total_tasks: parseInt(row.total_tasks || "0"),
        completed_tasks: parseInt(row.completed_tasks || "0"),
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            projects,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Projects retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching projects:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve projects"));
    }
  }

  static async getProjectDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Get project details with client access validation
      const query = `
        SELECT 
          p.id,
          p.name,
          p.notes as description,
          p.status_id,
          sps.name as status_name,
          sps.color_code as status_color,
          p.created_at,
          p.updated_at,
          p.start_date,
          p.end_date,
          c.name as client_name,
          c.company_name,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done = true) THEN 1 END) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE p.id = $1 AND p.client_id = $2
        GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at, p.start_date, p.end_date, c.name, c.company_name
      `;

      const result = await db.query(query, [id, clientId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Project not found or not accessible"
            )
          );
      }

      const project = result.rows[0];

      const projectDetails = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status_name,
        statusColor: project.status_color,
        startDate: project.start_date,
        endDate: project.end_date,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        statistics: {
          totalTasks: parseInt(project.total_tasks || "0"),
          completedTasks: parseInt(project.completed_tasks || "0"),
          progressPercentage:
            project.total_tasks > 0
              ? Math.round(
                  (project.completed_tasks / project.total_tasks) * 100
                )
              : 0,
        },
      };

      return res.json(
        new ServerResponse(
          true,
          projectDetails,
          "Project details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching project details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve project details")
        );
    }
  }

  static async getProjectTasks(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { page = 1, limit = 10, search } = req.query;

      // Verify client has access to this project
      const accessCheck = await db.query(
        `SELECT id FROM projects WHERE id = $1 AND client_id = $2`,
        [id, clientId]
      );

      if (accessCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Project not found or not accessible"
            )
          );
      }

      // Build tasks query with pagination
      let tasksQuery = `
        SELECT 
          t.id,
          t.name,
          t.description,
          ts.name as status,
          stsc.color_code as status_color,
          t.start_date,
          t.end_date,
          t.created_at,
          t.updated_at
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        LEFT JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        WHERE t.project_id = $1
      `;

      const queryParams: (string | number)[] = [id as string];
      let paramIndex = 2;

      // Add search filter if provided
      if (search) {
        tasksQuery += ` AND (t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM tasks t
        WHERE t.project_id = $1
        ${search ? `AND (t.name ILIKE $2 OR t.description ILIKE $2)` : ""}
      `;
      const countParams = search ? [id, `%${search}%`] : [id];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add ordering and pagination - last updated first
      const offset = (Number(page) - 1) * Number(limit);
      tasksQuery += ` ORDER BY t.updated_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const tasksResult = await db.query(tasksQuery, queryParams);
      const tasks = tasksResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        statusColor: row.status_color,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            tasks,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Project tasks retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve project tasks")
        );
    }
  }

  // Invoices
  static async getInvoices(
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
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.req_no as request_number,
          s.name as service_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE i.client_id = $1 AND i.organization_team_id = $2
      `;

      const queryParams = [clientId, organizationId];
      let paramIndex = 3;

      // Add status filter if provided
      if (status) {
        query += ` AND i.status = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (i.invoice_no ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE i.client_id = $1 AND i.organization_team_id = $2
        ${status ? `AND i.status = $${status ? 3 : 3}` : ""}
        ${
          search
            ? `AND (i.invoice_no ILIKE $${status ? 4 : 3} OR s.name ILIKE $${
                status ? 4 : 3
              })`
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
      query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const invoices = result.rows.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_no,
        amount: parseFloat(row.amount || "0"),
        currency: row.currency,
        status: row.status,
        dueDate: row.due_date,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        isOverdue:
          row.due_date &&
          new Date(row.due_date) < new Date() &&
          row.status !== "paid",
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            invoices,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Invoices retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve invoices"));
    }
  }

  // Organization-side invoice listing (for admin/team members)
  static async getOrganizationInvoices(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const organizationId = req.user?.team_id;
      const { page = 1, limit = 10, status, search, clientId } = req.query;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      // Build query with pagination and filtering
      let query = `
        SELECT 
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.req_no as request_number,
          s.name as service_name,
          c.name as client_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.organization_team_id = $1
      `;

      const queryParams: (string | number)[] = [organizationId];
      let paramIndex = 2;

      // Add client filter if provided
      if (clientId) {
        query += ` AND i.client_id = $${paramIndex}`;
        queryParams.push(String(clientId));
        paramIndex++;
      }

      // Add status filter if provided
      if (status) {
        query += ` AND i.status = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (i.invoice_no ILIKE $${paramIndex} OR s.name ILIKE $${paramIndex} OR c.name ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        WHERE i.organization_team_id = $1
      `;
      const countParams: (string | number)[] = [organizationId];
      let countParamIndex = 2;

      if (clientId) {
        countQuery += ` AND i.client_id = $${countParamIndex}`;
        countParams.push(String(clientId));
        countParamIndex++;
      }
      if (status) {
        countQuery += ` AND i.status = $${countParamIndex}`;
        countParams.push(String(status));
        countParamIndex++;
      }
      if (search) {
        countQuery += ` AND (i.invoice_no ILIKE $${countParamIndex} OR s.name ILIKE $${countParamIndex} OR c.name ILIKE $${countParamIndex})`;
        countParams.push(`%${search}%`);
        countParamIndex++;
      }

      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(Number(limit), offset);

      const result = await db.query(query, queryParams);
      const invoices = result.rows.map((row: any) => ({
        id: row.id,
        invoiceNumber: row.invoice_no,
        amount: parseFloat(row.amount || "0"),
        currency: row.currency,
        status: row.status,
        dueDate: row.due_date,
        sentAt: row.sent_at,
        paidAt: row.paid_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        requestNumber: row.request_number,
        serviceName: row.service_name,
        clientName: row.client_name,
        isOverdue:
          row.due_date &&
          new Date(row.due_date) < new Date() &&
          row.status !== "paid",
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            invoices,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Invoices retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching organization invoices:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve invoices"));
    }
  }

  static async createInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { requestId, amount, currency = "USD", dueDate, notes } = req.body;
      const organizationId = req.user?.team_id;
      const createdBy = req.user?.id;

      if (!requestId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Request ID is required"));
      }

      if (!amount || amount <= 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Valid amount is required"));
      }

      // Verify request exists and get client info
      const requestQuery = `
        SELECT r.id, r.client_id, r.service_id, r.status, c.name as client_name, s.name as service_name
        FROM client_portal_requests r
        LEFT JOIN clients c ON r.client_id = c.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE r.id = $1 AND r.organization_team_id = $2
      `;
      const requestResult = await db.query(requestQuery, [
        requestId,
        organizationId,
      ]);

      if (requestResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Request not found"));
      }

      const request = requestResult.rows[0];

      // Generate invoice number
      const invoiceNo = `INV-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)
        .toUpperCase()}`;

      // Create invoice
      const insertQuery = `
        INSERT INTO client_portal_invoices (
          invoice_no, request_id, client_id, organization_team_id, 
          amount, currency, status, due_date, notes, created_by_user_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, 'draft', $7, $8, $9, NOW(), NOW())
        RETURNING id, invoice_no, amount, currency, status, due_date, created_at
      `;

      const result = await db.query(insertQuery, [
        invoiceNo,
        requestId,
        request.client_id,
        organizationId,
        amount,
        currency,
        dueDate || null,
        notes || null,
        createdBy,
      ]);

      const newInvoice = result.rows[0];

      // Create notification for the client about new invoice
      if (request.client_id && organizationId) {
        await this.createNotification(
          request.client_id,
          organizationId,
          "invoice_created",
          "New Invoice",
          `New invoice ${newInvoice.invoice_no} for ${currency} ${amount}`,
          newInvoice.id,
          newInvoice.invoice_no,
          {
            amount: parseFloat(newInvoice.amount),
            currency: newInvoice.currency,
            dueDate: newInvoice.due_date,
            serviceName: request.service_name,
          }
        );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: newInvoice.id,
            invoiceNumber: newInvoice.invoice_no,
            amount: parseFloat(newInvoice.amount),
            currency: newInvoice.currency,
            status: newInvoice.status,
            dueDate: newInvoice.due_date,
            createdAt: newInvoice.created_at,
            clientName: request.client_name,
            serviceName: request.service_name,
          },
          "Invoice created successfully"
        )
      );
    } catch (error) {
      console.error("Error creating invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create invoice"));
    }
  }

  static async getInvoiceDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Get invoice details with related information
      const query = `
        SELECT 
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          r.id as request_id,
          r.req_no as request_number,
          r.request_data,
          r.notes as request_notes,
          s.id as service_id,
          s.name as service_name,
          s.description as service_description,
          c.name as client_name,
          c.company_name,
          c.email as client_email,
          u.name as created_by_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        WHERE i.id = $1 AND i.client_id = $2 AND i.organization_team_id = $3
      `;

      const result = await db.query(query, [id, clientId, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = result.rows[0];

      const invoiceDetails = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_no,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        isOverdue:
          invoice.due_date &&
          new Date(invoice.due_date) < new Date() &&
          invoice.status !== "paid",
        request: invoice.request_id
          ? {
              id: invoice.request_id,
              requestNumber: invoice.request_number,
              requestData: invoice.request_data,
              notes: invoice.request_notes,
              service: {
                id: invoice.service_id,
                name: invoice.service_name,
                description: invoice.service_description,
              },
            }
          : null,
        client: {
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email,
        },
        createdBy: invoice.created_by_name
          ? {
              name: invoice.created_by_name,
            }
          : null,
      };

      return res.json(
        new ServerResponse(
          true,
          invoiceDetails,
          "Invoice details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve invoice details")
        );
    }
  }

  // Organization-side invoice details (for admin/team members)
  static async getOrganizationInvoiceDetails(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const organizationId = req.user?.team_id;

      if (!organizationId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Unauthorized"));
      }

      // Get invoice details with related information (without client_id filter)
      const query = `
        SELECT 
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.sent_at,
          i.paid_at,
          i.created_at,
          i.updated_at,
          i.notes,
          r.id as request_id,
          r.req_no as request_number,
          r.request_data,
          r.notes as request_notes,
          s.id as service_id,
          s.name as service_name,
          s.description as service_description,
          c.id as client_id,
          c.name as client_name,
          c.company_name,
          c.email as client_email,
          c.phone as client_phone,
          c.address as client_address,
          c.contact_person as client_contact_person,
          u.name as created_by_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        WHERE i.id = $1 AND i.organization_team_id = $2
      `;

      const result = await db.query(query, [id, organizationId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = result.rows[0];

      // Get organization settings and team name for company details
      const orgQuery = `
        SELECT 
          t.name as organization_name,
          cps.logo_url,
          cps.primary_color,
          cps.contact_email,
          cps.contact_phone,
          cps.company_name,
          cps.address_line_1,
          cps.address_line_2,
          cps.invoice_footer_message
        FROM teams t
        LEFT JOIN client_portal_settings cps ON cps.organization_team_id = t.id
        WHERE t.id = $1
      `;
      const orgResult = await db.query(orgQuery, [organizationId]);
      const orgSettings = orgResult.rows[0] || {};

      const invoiceDetails = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_no,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        sentAt: invoice.sent_at,
        paidAt: invoice.paid_at,
        createdAt: invoice.created_at,
        updatedAt: invoice.updated_at,
        notes: invoice.notes,
        isOverdue:
          invoice.due_date &&
          new Date(invoice.due_date) < new Date() &&
          invoice.status !== "paid",
        request: invoice.request_id
          ? {
              id: invoice.request_id,
              requestNumber: invoice.request_number,
              requestData: invoice.request_data,
              notes: invoice.request_notes,
              service: {
                id: invoice.service_id,
                name: invoice.service_name,
                description: invoice.service_description,
              },
            }
          : null,
        client: {
          id: invoice.client_id,
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email,
          phone: invoice.client_phone,
          address: invoice.client_address,
          contactPerson: invoice.client_contact_person,
        },
        createdBy: invoice.created_by_name
          ? {
              name: invoice.created_by_name,
            }
          : null,
        organization: {
          name:
            orgSettings.company_name || orgSettings.organization_name || null,
          logoUrl: orgSettings.logo_url || null,
          primaryColor: orgSettings.primary_color || null,
          email: orgSettings.contact_email || null,
          phone: orgSettings.contact_phone || null,
          addressLine1: orgSettings.address_line_1 || null,
          addressLine2: orgSettings.address_line_2 || null,
          invoiceFooterMessage: orgSettings.invoice_footer_message || null,
        },
      };

      return res.json(
        new ServerResponse(
          true,
          invoiceDetails,
          "Invoice details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching organization invoice details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve invoice details")
        );
    }
  }

  static async payInvoice(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;
      const { paymentMethod, transactionId, notes } = req.body;

      // Verify invoice exists and belongs to client
      const invoiceCheck = await db.query(
        "SELECT id, status, amount FROM client_portal_invoices WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (invoiceCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = invoiceCheck.rows[0];

      // Check if invoice is already paid
      if (invoice.status === "paid") {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invoice is already paid"));
      }

      // Update invoice status to paid
      const updateQuery = `
        UPDATE client_portal_invoices 
        SET status = 'paid', paid_at = NOW(), updated_at = NOW()
        WHERE id = $1
        RETURNING id, invoice_no, amount, currency, status, paid_at, updated_at
      `;

      const result = await db.query(updateQuery, [id]);
      const updatedInvoice = result.rows[0];

      // Here you would typically integrate with a payment processor
      // For now, we'll just mark it as paid and log the payment details
      console.log(`Invoice ${updatedInvoice.invoice_no} marked as paid:`, {
        paymentMethod,
        transactionId,
        notes,
        amount: invoice.amount,
        paidAt: updatedInvoice.paid_at,
      });

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedInvoice.id,
            invoiceNumber: updatedInvoice.invoice_no,
            amount: parseFloat(updatedInvoice.amount || "0"),
            currency: updatedInvoice.currency,
            status: updatedInvoice.status,
            paidAt: updatedInvoice.paid_at,
            updatedAt: updatedInvoice.updated_at,
          },
          "Invoice paid successfully"
        )
      );
    } catch (error) {
      console.error("Error paying invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to pay invoice"));
    }
  }

  static async downloadInvoice(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;
      const { format = "pdf" } = req.query;

      // Verify invoice exists and belongs to client
      const invoiceQuery = `
        SELECT 
          i.id,
          i.invoice_no,
          i.amount,
          i.currency,
          i.status,
          i.due_date,
          i.created_at,
          c.name as client_name,
          c.company_name,
          c.email as client_email,
          c.address as client_address,
          r.req_no as request_number,
          s.name as service_name,
          s.description as service_description
        FROM client_portal_invoices i
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        WHERE i.id = $1 AND i.client_id = $2 AND i.organization_team_id = $3
      `;

      const result = await db.query(invoiceQuery, [
        id,
        clientId,
        organizationId,
      ]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = result.rows[0];

      // For now, return invoice data that could be used to generate a PDF
      // In a full implementation, you would use a PDF generation library
      const invoiceData = {
        id: invoice.id,
        invoiceNumber: invoice.invoice_no,
        amount: parseFloat(invoice.amount || "0"),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.due_date,
        createdAt: invoice.created_at,
        client: {
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email,
          address: invoice.client_address,
        },
        service: {
          name: invoice.service_name,
          description: invoice.service_description,
        },
        requestNumber: invoice.request_number,
      };

      // TODO: Generate actual PDF/document using a library like puppeteer or jsPDF
      // For now, return the data that would be used for PDF generation
      return res.json(
        new ServerResponse(
          true,
          {
            downloadUrl: `/api/client-portal/invoices/${id}/download?format=${format}`,
            format,
            invoiceData,
            message: "Invoice download link generated",
          },
          "Invoice download initiated"
        )
      );
    } catch (error) {
      console.error("Error downloading invoice:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to download invoice"));
    }
  }

  // Chat
  static async getChats(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 20 } = req.query;

      // Get chat conversations grouped by date
      const query = `
        WITH chat_summary AS (
          SELECT 
            DATE(created_at) as chat_date,
            COUNT(*) as message_count,
            MAX(created_at) as last_message_at,
            MAX(CASE WHEN sender_type = 'team_member' THEN created_at END) as last_team_message_at,
            COUNT(CASE WHEN read_at IS NULL AND sender_type = 'team_member' THEN 1 END) as unread_count
          FROM client_portal_chat_messages
          WHERE client_id = $1 AND organization_team_id = $2
          GROUP BY DATE(created_at)
        )
        SELECT 
          chat_date,
          message_count,
          last_message_at,
          last_team_message_at,
          unread_count
        FROM chat_summary
        ORDER BY chat_date DESC
        LIMIT $3 OFFSET $4
      `;

      const offset = (Number(page) - 1) * Number(limit);
      const result = await db.query(query, [
        clientId,
        organizationId,
        Number(limit),
        offset,
      ]);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT DATE(created_at)) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2
      `;
      const countResult = await db.query(countQuery, [
        clientId,
        organizationId,
      ]);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const chats = result.rows.map((row: any) => ({
        date: row.chat_date,
        messageCount: parseInt(row.message_count || "0"),
        lastMessageAt: row.last_message_at,
        lastTeamMessageAt: row.last_team_message_at,
        unreadCount: parseInt(row.unread_count || "0"),
        hasNewMessages: row.unread_count > 0,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            chats,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Chats retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching chats:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve chats"));
    }
  }

  static async createChat(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { clientEmail } = req;
      const { recipientType, recipientId, subject, message } = req.body;

      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Message content is required"));
      }

      if (!subject || subject.trim().length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Subject is required"));
      }

      // Get client user ID
      const clientUserQuery = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (clientUserQuery.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client user not found"));
      }

      const clientUserId = clientUserQuery.rows[0].id;

      // Create the first message with subject in the format "Subject: {subject}\n\n{message}"
      const fullMessage = `Subject: ${subject.trim()}\n\n${message.trim()}`;

      // Insert message
      const insertQuery = `
        INSERT INTO client_portal_chat_messages (
          client_id, organization_team_id, sender_type, sender_id,
          message, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, sender_type, sender_id, message, message_type, created_at
      `;

      const result = await db.query(insertQuery, [
        clientId,
        organizationId,
        "client",
        clientUserId,
        fullMessage,
        "text",
      ]);

      const newMessage = result.rows[0];

      // Emit socket events for real-time updates
      try {
        const io = IO.getInstance();
        if (io) {
          // Emit to organization team members
          io.emit(`client_portal:new_message`, {
            id: newMessage.id,
            clientId,
            organizationId,
            senderName: clientEmail || "Client",
            senderType: "client",
            message: newMessage.message,
            messageType: newMessage.message_type,
            createdAt: newMessage.created_at,
          });

          // Emit chat message event
          io.emit("chat:message_received", {
            clientId,
            organizationId,
            message: newMessage,
          });
        }
      } catch (socketError) {
        console.error("Error emitting socket events:", socketError);
        // Continue execution even if socket fails
      }

      return res.json(
        new ServerResponse(
          true,
          {
            chatId: newMessage.id,
            message: "Chat created successfully",
          },
          "Chat created successfully"
        )
      );
    } catch (error) {
      console.error("Error creating chat:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create chat"));
    }
  }

  static async getChatDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params; // This would be the date in format YYYY-MM-DD
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 50 } = req.query;

      // Get messages for a specific date
      const query = `
        SELECT
          m.id,
          m.sender_type,
          m.sender_id,
          m.message,
          m.message_type,
          m.file_url,
          m.read_at,
          m.created_at,
          CASE
            WHEN m.sender_type = 'team_member' THEN u.name
            WHEN m.sender_type = 'client' THEN cu.name
          END as sender_name,
          CASE
            WHEN m.sender_type = 'team_member' THEN u.avatar_url
            ELSE NULL
          END as sender_avatar
        FROM client_portal_chat_messages m
        LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
        LEFT JOIN client_users cu ON m.sender_type = 'client' AND m.sender_id = cu.id
        WHERE m.client_id = $1
        AND m.organization_team_id = $2
        AND DATE(m.created_at) = $3
        ORDER BY m.created_at ASC
        LIMIT $4 OFFSET $5
      `;

      const offset = (Number(page) - 1) * Number(limit);
      const result = await db.query(query, [
        clientId,
        organizationId,
        id,
        Number(limit),
        offset,
      ]);

      // Get total count for the date
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2 AND DATE(created_at) = $3
      `;
      const countResult = await db.query(countQuery, [
        clientId,
        organizationId,
        id,
      ]);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const messages = result.rows.map((row: any) => ({
        id: row.id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderAvatar: row.sender_avatar,
        message: row.message,
        messageType: row.message_type,
        fileUrl: row.file_url,
        readAt: row.read_at,
        createdAt: row.created_at,
        isFromClient: row.sender_type === "client",
      }));

      // Mark messages as read (for client user)
      await db.query(
        "UPDATE client_portal_chat_messages SET read_at = NOW() WHERE client_id = $1 AND organization_team_id = $2 AND DATE(created_at) = $3 AND sender_type = 'team_member' AND read_at IS NULL",
        [clientId, organizationId, id]
      );

      return res.json(
        new ServerResponse(
          true,
          {
            date: id,
            messages,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Chat details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching chat details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve chat details")
        );
    }
  }

  static async sendMessage(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { clientEmail } = req;
      const { message, messageType = "text", fileUrl } = req.body;

      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Message content is required"));
      }

      // Get client user ID
      const clientUserQuery = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (clientUserQuery.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client user not found"));
      }

      const clientUserId = clientUserQuery.rows[0].id;

      // Insert message
      const insertQuery = `
        INSERT INTO client_portal_chat_messages (
          client_id, organization_team_id, sender_type, sender_id, 
          message, message_type, file_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, sender_type, sender_id, message, message_type, file_url, created_at
      `;

      const result = await db.query(insertQuery, [
        clientId,
        organizationId,
        "client",
        clientUserId,
        message.trim(),
        messageType,
        fileUrl || null,
      ]);

      const newMessage = result.rows[0];

      // Emit socket events for real-time updates
      try {
        const io = IO.getInstance();
        if (io) {
          // Emit to organization team members
          io.emit(`client_portal:new_message`, {
            id: newMessage.id,
            clientId,
            organizationId,
            senderName: clientEmail || "Client",
            senderType: "client",
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
          });

          // Emit chat message event
          io.emit("chat:message_received", {
            id: newMessage.id,
            chatId: `client_${clientId}`,
            senderId: clientUserId,
            senderName: clientEmail || "Client",
            senderType: "client",
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
            isMe: false,
          });
        }
      } catch (socketError) {
        console.error("Error emitting socket events:", socketError);
        // Don't fail the request if socket fails
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: newMessage.id,
            senderType: newMessage.sender_type,
            senderId: newMessage.sender_id,
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
            isFromClient: true,
          },
          "Message sent successfully"
        )
      );
    } catch (error) {
      console.error("Error sending message:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to send message"));
    }
  }

  static async getMessages(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { page = 1, limit = 50, since } = req.query;

      // Get recent messages
      let query = `
        SELECT 
          m.id,
          m.sender_type,
          m.sender_id,
          m.message,
          m.message_type,
          m.file_url,
          m.read_at,
          m.created_at,
          CASE
            WHEN m.sender_type = 'team_member' THEN u.name
            WHEN m.sender_type = 'client' THEN cu.name
          END as sender_name,
          CASE 
            WHEN m.sender_type = 'team_member' THEN u.avatar_url
            ELSE NULL
          END as sender_avatar
        FROM client_portal_chat_messages m
        LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
        LEFT JOIN client_users cu ON m.sender_type = 'client' AND m.sender_id = cu.id
        WHERE m.client_id = $1 AND m.organization_team_id = $2
      `;

      const queryParams = [clientId, organizationId];
      let paramIndex = 3;

      // Add since filter if provided (for real-time updates)
      if (since) {
        query += ` AND m.created_at > $${paramIndex}`;
        queryParams.push(String(since));
        paramIndex++;
      }

      query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      const offset = (Number(page) - 1) * Number(limit);
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);

      // Get total count
      let countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2
      `;
      const countParams = [clientId, organizationId];
      if (since) {
        countQuery += ` AND created_at > $3`;
        countParams.push(String(since));
      }
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const messages = result.rows.map((row: any) => ({
        id: row.id,
        senderType: row.sender_type,
        senderId: row.sender_id,
        senderName: row.sender_name,
        senderAvatar: row.sender_avatar,
        message: row.message,
        messageType: row.message_type,
        fileUrl: row.file_url,
        readAt: row.read_at,
        createdAt: row.created_at,
        isFromClient: row.sender_type === "client",
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            messages: messages.reverse(), // Reverse to show oldest first
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Messages retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve messages"));
    }
  }

  // Settings
  static async getSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Team ID not found"));
      }

      // For client portal settings, we use the team_id as organization_team_id
      const organizationTeamId = teamId;

      const q = `
        SELECT id, team_id, organization_team_id, logo_url, primary_color, 
               welcome_message, contact_email, contact_phone, terms_of_service, 
               privacy_policy, company_name, address_line_1, address_line_2, 
               invoice_footer_message, created_at, updated_at
        FROM client_portal_settings 
        WHERE organization_team_id = $1
      `;

      const result = await db.query(q, [organizationTeamId]);
      const settings = result.rows[0] || {
        organization_team_id: organizationTeamId,
        logo_url: null,
        primary_color: "#3b7ad4",
        welcome_message: null,
        contact_email: null,
        contact_phone: null,
        terms_of_service: null,
        privacy_policy: null,
        company_name: null,
        address_line_1: null,
        address_line_2: null,
        invoice_footer_message: null,
      };

      return res.json(new ServerResponse(true, settings, null));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve settings"));
    }
  }

  static async updateSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;

      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Team ID not found"));
      }

      // For client portal settings, we use the team_id as both team_id and organization_team_id
      const organizationTeamId = teamId;

      const {
        logo_url,
        primary_color,
        welcome_message,
        contact_email,
        contact_phone,
        terms_of_service,
        privacy_policy,
        company_name,
        address_line_1,
        address_line_2,
        invoice_footer_message,
      } = req.body;

      // Check if settings exist
      const checkQ = `SELECT id FROM client_portal_settings WHERE organization_team_id = $1`;
      const existingResult = await db.query(checkQ, [organizationTeamId]);

      let result;
      if (existingResult.rows.length > 0) {
        // Update existing settings
        const updateQ = `
          UPDATE client_portal_settings 
          SET logo_url = $1, primary_color = $2, welcome_message = $3, 
              contact_email = $4, contact_phone = $5, terms_of_service = $6, 
              privacy_policy = $7, company_name = $8, address_line_1 = $9, address_line_2 = $10,
              invoice_footer_message = $11, updated_at = CURRENT_TIMESTAMP
          WHERE organization_team_id = $12
          RETURNING *
        `;
        result = await db.query(updateQ, [
          logo_url,
          primary_color,
          welcome_message,
          contact_email,
          contact_phone,
          terms_of_service,
          privacy_policy,
          company_name,
          address_line_1,
          address_line_2,
          invoice_footer_message,
          organizationTeamId,
        ]);
      } else {
        // Create new settings
        const insertQ = `
          INSERT INTO client_portal_settings 
          (team_id, organization_team_id, logo_url, primary_color, welcome_message, 
           contact_email, contact_phone, terms_of_service, privacy_policy, company_name, 
           address_line_1, address_line_2, invoice_footer_message)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING *
        `;
        result = await db.query(insertQ, [
          teamId,
          organizationTeamId,
          logo_url,
          primary_color,
          welcome_message,
          contact_email,
          contact_phone,
          terms_of_service,
          privacy_policy,
          company_name,
          address_line_1,
          address_line_2,
          invoice_footer_message,
        ]);
      }

      return res.json(
        new ServerResponse(
          true,
          result.rows[0],
          "Settings updated successfully"
        )
      );
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update settings"));
    }
  }

  static async uploadLogo(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const teamId = req.user?.team_id;
      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Team ID not found"));
      }

      // For client portal settings, we use the team_id as both team_id and organization_team_id
      // since client portal settings are organization-wide
      const organizationTeamId = teamId;

      const { logoData } = req.body;
      if (!logoData) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Logo data is required"));
      }

      // Extract file type from base64 data
      const mimeMatch = logoData.match(/^data:(image\/[a-z]+);base64,/);
      if (!mimeMatch) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid image format"));
      }

      const mimeType = mimeMatch[1];
      const fileExtension = mimeType.split("/")[1];

      // Generate storage key
      const storageKey = getClientPortalLogoKey(
        organizationTeamId,
        fileExtension
      );

      // Upload to storage
      const logoUrl = await uploadBase64(logoData, storageKey);
      if (!logoUrl) {
        return res
          .status(500)
          .json(new ServerResponse(false, null, "Failed to upload logo"));
      }

      // Update database with logo URL
      const checkQ = `SELECT id FROM client_portal_settings WHERE organization_team_id = $1`;
      const existingResult = await db.query(checkQ, [organizationTeamId]);

      if (existingResult.rows.length > 0) {
        // Update existing settings
        const updateQ = `
          UPDATE client_portal_settings 
          SET logo_url = $1, updated_at = CURRENT_TIMESTAMP
          WHERE organization_team_id = $2
          RETURNING *
        `;
        await db.query(updateQ, [logoUrl, organizationTeamId]);
      } else {
        // Create new settings
        const insertQ = `
          INSERT INTO client_portal_settings 
          (team_id, organization_team_id, logo_url)
          VALUES ($1, $2, $3)
          RETURNING *
        `;
        await db.query(insertQ, [teamId, organizationTeamId, logoUrl]);
      }

      return res.json(
        new ServerResponse(
          true,
          { logo_url: logoUrl },
          "Logo uploaded successfully"
        )
      );
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to upload logo"));
    }
  }

  // Get organization settings for client users
  static async getOrganizationSettings(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { organizationId } = req;

      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID not found"));
      }

      const q = `
        SELECT id, team_id, organization_team_id, logo_url, primary_color, 
               welcome_message, contact_email, contact_phone, terms_of_service, 
               privacy_policy, company_name, address_line_1, address_line_2, 
               invoice_footer_message, created_at, updated_at
        FROM client_portal_settings 
        WHERE organization_team_id = $1
      `;

      const result = await db.query(q, [organizationId]);
      const settings = result.rows[0] || {
        organization_team_id: organizationId,
        logo_url: null,
        primary_color: "#3b7ad4",
        welcome_message: null,
        contact_email: null,
        contact_phone: null,
        terms_of_service: null,
        privacy_policy: null,
        company_name: null,
        address_line_1: null,
        address_line_2: null,
        invoice_footer_message: null,
      };

      return res.json(new ServerResponse(true, settings, null));
    } catch (error) {
      log_error(error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve organization settings"
          )
        );
    }
  }

  // Profile
  static async getProfile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { clientEmail } = req;

      // Get client and client user details
      const query = `
        SELECT 
          c.id as client_id,
          c.name as client_name,
          c.email as client_email,
          c.company_name,
          c.phone as client_phone,
          c.address as client_address,
          c.contact_person,
          c.status as client_status,
          c.created_at as client_created_at,
          cu.id as user_id,
          cu.name as user_name,
          cu.email as user_email,
          cu.role as user_role,
          cu.status as user_status,
          cu.created_at as user_created_at,
          cu.last_login
        FROM clients c
        LEFT JOIN client_users cu ON c.id = cu.client_id AND cu.email = $2
        WHERE c.id = $1
      `;

      const result = await db.query(query, [clientId, clientEmail]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Profile not found"));
      }

      const profileData = result.rows[0];

      // Get client statistics
      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM projects WHERE client_id = $1) as project_count,
          (SELECT COUNT(*) FROM client_portal_requests WHERE client_id = $1) as request_count,
          (SELECT COUNT(*) FROM client_portal_invoices WHERE client_id = $1) as invoice_count,
          (SELECT COUNT(*) FROM client_portal_invoices WHERE client_id = $1 AND status != 'paid') as unpaid_invoice_count
      `;

      const statsResult = await db.query(statsQuery, [clientId]);
      const stats = statsResult.rows[0];

      const profile = {
        client: {
          id: profileData.client_id,
          name: profileData.client_name,
          email: profileData.client_email,
          companyName: profileData.company_name,
          phone: profileData.client_phone,
          address: profileData.client_address,
          contactPerson: profileData.contact_person,
          status: profileData.client_status,
          createdAt: profileData.client_created_at,
        },
        user: profileData.user_id
          ? {
              id: profileData.user_id,
              name: profileData.user_name,
              email: profileData.user_email,
              role: profileData.user_role,
              status: profileData.user_status,
              createdAt: profileData.user_created_at,
              lastLogin: profileData.last_login,
            }
          : null,
        statistics: {
          projectCount: parseInt(stats.project_count || "0"),
          requestCount: parseInt(stats.request_count || "0"),
          invoiceCount: parseInt(stats.invoice_count || "0"),
          unpaidInvoiceCount: parseInt(stats.unpaid_invoice_count || "0"),
        },
      };

      return res.json(
        new ServerResponse(true, profile, "Profile retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching profile:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve profile"));
    }
  }

  static async updateProfile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { clientEmail } = req;
      const {
        clientName,
        clientPhone,
        clientAddress,
        contactPerson,
        userName,
        currentPassword,
        newPassword,
      } = req.body;

      // Validate at least one field is provided
      if (
        !clientName &&
        !clientPhone &&
        !clientAddress &&
        !contactPerson &&
        !userName &&
        !newPassword
      ) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
      }

      const updates = [];
      const clientUpdates = [];
      const userUpdates = [];

      // Update client information
      if (clientName || clientPhone || clientAddress || contactPerson) {
        const clientUpdateFields = [];
        const clientUpdateValues = [];
        let clientParamIndex = 1;

        if (clientName) {
          clientUpdateFields.push(`name = $${clientParamIndex}`);
          clientUpdateValues.push(clientName);
          clientParamIndex++;
        }

        if (clientPhone) {
          clientUpdateFields.push(`phone = $${clientParamIndex}`);
          clientUpdateValues.push(clientPhone);
          clientParamIndex++;
        }

        if (clientAddress) {
          clientUpdateFields.push(`address = $${clientParamIndex}`);
          clientUpdateValues.push(clientAddress);
          clientParamIndex++;
        }

        if (contactPerson) {
          clientUpdateFields.push(`contact_person = $${clientParamIndex}`);
          clientUpdateValues.push(contactPerson);
          clientParamIndex++;
        }

        if (clientUpdateFields.length > 0) {
          clientUpdateFields.push(`updated_at = NOW()`);
          clientUpdateValues.push(clientId);

          const clientUpdateQuery = `
            UPDATE clients 
            SET ${clientUpdateFields.join(", ")}
            WHERE id = $${clientParamIndex}
            RETURNING name, phone, address, contact_person, updated_at
          `;

          const clientResult = await db.query(
            clientUpdateQuery,
            clientUpdateValues
          );
          if (clientResult.rows.length > 0) {
            updates.push("client");
            clientUpdates.push(clientResult.rows[0]);
          }
        }
      }

      // Update client user information
      if (userName || newPassword) {
        // Get current client user
        const currentUserQuery = await db.query(
          "SELECT * FROM client_users WHERE client_id = $1 AND email = $2",
          [clientId, clientEmail]
        );

        if (currentUserQuery.rows.length === 0) {
          return res
            .status(404)
            .json(new ServerResponse(false, null, "Client user not found"));
        }

        const currentUser = currentUserQuery.rows[0];
        const userUpdateFields = [];
        const userUpdateValues = [];
        let userParamIndex = 1;

        if (userName) {
          userUpdateFields.push(`name = $${userParamIndex}`);
          userUpdateValues.push(userName);
          userParamIndex++;
        }

        // Handle password update
        if (newPassword) {
          if (!currentPassword) {
            return res
              .status(400)
              .json(
                new ServerResponse(
                  false,
                  null,
                  "Current password is required to set new password"
                )
              );
          }

          // Verify current password
          const crypto = require("crypto");
          const currentPasswordHash = crypto
            .createHash("sha256")
            .update(currentPassword)
            .digest("hex");

          if (currentPasswordHash !== currentUser.password_hash) {
            return res
              .status(400)
              .json(
                new ServerResponse(false, null, "Current password is incorrect")
              );
          }

          // Hash new password
          const newPasswordHash = crypto
            .createHash("sha256")
            .update(newPassword)
            .digest("hex");
          userUpdateFields.push(`password_hash = $${userParamIndex}`);
          userUpdateValues.push(newPasswordHash);
          userParamIndex++;
        }

        if (userUpdateFields.length > 0) {
          userUpdateFields.push(`updated_at = NOW()`);
          userUpdateValues.push(currentUser.id);

          const userUpdateQuery = `
            UPDATE client_users 
            SET ${userUpdateFields.join(", ")}
            WHERE id = $${userParamIndex}
            RETURNING id, name, email, role, updated_at
          `;

          const userResult = await db.query(userUpdateQuery, userUpdateValues);
          if (userResult.rows.length > 0) {
            updates.push("user");
            userUpdates.push(userResult.rows[0]);
          }
        }
      }

      if (updates.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No updates were made"));
      }

      return res.json(
        new ServerResponse(
          true,
          {
            updatedSections: updates,
            client: clientUpdates.length > 0 ? clientUpdates[0] : null,
            user:
              userUpdates.length > 0
                ? {
                    id: userUpdates[0].id,
                    name: userUpdates[0].name,
                    email: userUpdates[0].email,
                    role: userUpdates[0].role,
                    updatedAt: userUpdates[0].updated_at,
                  }
                : null,
          },
          "Profile updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating profile:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update profile"));
    }
  }

  // Notifications

  /**
   * Helper method to create a notification in the client_portal_notifications table
   */
  static async createNotification(
    clientId: string,
    organizationId: string,
    type: string,
    title: string,
    message: string,
    referenceId?: string,
    referenceNumber?: string,
    metadata?: Record<string, any>
  ) {
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
        JSON.stringify(metadata || {}),
      ]);
      return result.rows[0]?.id;
    } catch (error) {
      console.error("Error creating notification:", error);
      return null;
    }
  }

  static async getNotifications(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
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
      const countResult = await db.query(countQuery, [
        clientId,
        organizationId,
      ]);
      const total = parseInt(countResult.rows[0]?.total || "0", 10);

      const notificationsResult = await db.query(notificationsQuery, [
        clientId,
        organizationId,
        limitNum,
        offset,
      ]);

      // Get unread count
      const unreadCountQuery = `
        SELECT COUNT(*) as unread_count
        FROM client_portal_notifications
        WHERE client_id = $1 AND organization_team_id = $2 AND is_read = false
      `;
      const unreadCountResult = await db.query(unreadCountQuery, [
        clientId,
        organizationId,
      ]);
      const unreadCount = parseInt(
        unreadCountResult.rows[0]?.unread_count || "0",
        10
      );

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
        createdAt: row.created_at,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            notifications,
            total,
            unreadCount,
            page: pageNum,
            limit: limitNum,
          },
          "Notifications retrieved successfully"
        )
      );
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

      const updateResult = await db.query(updateQuery, [
        id,
        clientId,
        organizationId,
      ]);

      if (updateResult.rowCount === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Notification not found"));
      }

      const notification = updateResult.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: notification.id,
            type: notification.type,
            referenceId: notification.reference_id,
            markedAt: new Date(),
          },
          "Notification marked as read"
        )
      );
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

      const updateResult = await db.query(updateQuery, [
        clientId,
        organizationId,
      ]);
      const markedCount = updateResult.rowCount || 0;

      return res.json(
        new ServerResponse(
          true,
          {
            markedCount,
            markedAt: new Date(),
          },
          "All notifications marked as read"
        )
      );
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

  // File upload
  static async uploadFile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { organizationId } = req;
      const { fileData, fileName, fileType, purpose = "general" } = req.body;

      // Validate required fields
      if (!fileData || !fileName) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "File data and filename are required"
            )
          );
      }

      // Validate file size (assuming base64 data)
      const fileSizeBytes = Math.floor((fileData.length * 3) / 4);
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit

      if (fileSizeBytes > maxSizeBytes) {
        return res
          .status(400)
          .json(
            new ServerResponse(false, null, "File size exceeds 10MB limit")
          );
      }

      // Validate file type
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/gif",
        "image/webp",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "text/csv",
      ];

      if (fileType && !allowedTypes.includes(fileType)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "File type not allowed"));
      }

      // Extract file extension
      const fileExtension = fileName.substring(fileName.lastIndexOf("."));

      // Generate unique filename
      const uniqueFileName = `client_${clientId}_${Date.now()}_${Math.random()
        .toString(36)
        .substr(2, 9)}${fileExtension}`;

      // Generate storage key based on purpose
      let storageKey;
      switch (purpose) {
        case "avatar":
          storageKey = `client-portal/avatars/${organizationId}/${uniqueFileName}`;
          break;
        case "document":
          storageKey = `client-portal/documents/${organizationId}/${clientId}/${uniqueFileName}`;
          break;
        case "chat":
          storageKey = `client-portal/chat-files/${organizationId}/${clientId}/${uniqueFileName}`;
          break;
        default:
          storageKey = `client-portal/files/${organizationId}/${clientId}/${uniqueFileName}`;
      }

      try {
        // Upload to storage using existing uploadBase64 function
        const fileUrl = await uploadBase64(fileData, storageKey);

        if (!fileUrl) {
          return res
            .status(500)
            .json(
              new ServerResponse(
                false,
                null,
                "Failed to upload file to storage"
              )
            );
        }

        // Log file upload for audit purposes
        console.log(`File uploaded by client ${clientId}:`, {
          fileName,
          fileType,
          purpose,
          storageKey,
          fileSizeBytes,
        });

        return res.json(
          new ServerResponse(
            true,
            {
              url: fileUrl,
              filename: uniqueFileName,
              originalName: fileName,
              fileType,
              purpose,
              size: fileSizeBytes,
              uploadedAt: new Date(),
            },
            "File uploaded successfully"
          )
        );
      } catch (uploadError) {
        console.error("Error uploading file to storage:", uploadError);
        return res
          .status(500)
          .json(
            new ServerResponse(false, null, "Failed to upload file to storage")
          );
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to upload file"));
    }
  }

  // Client Management Methods
  static async getClients(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        status,
        sortBy,
        sortOrder,
      } = req.query;

      // Build query with pagination and filtering
      // Include portal status by checking client_users (active users) and client_invitations (pending invites)
      let query = `
        SELECT 
          c.id,
          c.name,
          c.email,
          c.company_name,
          c.phone,
          c.address,
          c.contact_person,
          c.status,
          c.team_id,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT p.id) as assigned_projects_count,
          -- Portal access: check if any active client_user exists for this client
          CASE WHEN EXISTS (
            SELECT 1 FROM client_users cu 
            WHERE cu.client_id = c.id AND cu.status = 'active'
          ) THEN true ELSE false END as has_portal_access,
          -- Get the latest invitation info
          (
            SELECT ci.created_at 
            FROM client_invitations ci 
            WHERE ci.client_id = c.id 
            ORDER BY ci.created_at DESC 
            LIMIT 1
          ) as invitation_sent_at,
          -- Check if invitation was accepted
          (
            SELECT ci.status = 'accepted'
            FROM client_invitations ci 
            WHERE ci.client_id = c.id 
            ORDER BY ci.created_at DESC 
            LIMIT 1
          ) as invitation_accepted
        FROM clients c
        LEFT JOIN projects p ON c.id = p.client_id
      `;

      const whereConditions = [];
      const queryParams = [];

      // Add team filter (clients belong to a specific team)
      const teamId = (req.user as any)?.team_id;
      if (teamId) {
        whereConditions.push(`c.team_id = $${queryParams.length + 1}`);
        queryParams.push(teamId);
      }

      // Add search filter
      if (search) {
        whereConditions.push(
          `(c.name ILIKE $${queryParams.length + 1} OR c.email ILIKE $${
            queryParams.length + 1
          } OR c.company_name ILIKE $${queryParams.length + 1})`
        );
        queryParams.push(`%${search}%`);
      }

      // Add status filter
      if (status) {
        whereConditions.push(`c.status = $${queryParams.length + 1}`);
        queryParams.push(String(status));
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      query += ` GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.address, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at`;

      // Add sorting
      const sortField = String(sortBy || "name");
      const sortDirection = sortOrder === "desc" ? "DESC" : "ASC";
      // Validate sort field to prevent SQL injection and ensure it's a valid column
      const validSortFields = ["id", "name", "created_at", "updated_at"];
      const safeSortField = validSortFields.includes(sortField)
        ? sortField
        : "name";
      query += ` ORDER BY c.${safeSortField} ${sortDirection}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM clients c
        ${
          whereConditions.length > 0
            ? `WHERE ${whereConditions.join(" AND ")}`
            : ""
        }
      `;

      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` LIMIT $${queryParams.length + 1} OFFSET $${
        queryParams.length + 2
      }`;
      queryParams.push(Number(limit), offset);

      const result = await db.query(query, queryParams);
      const clients = result.rows.map((row: any) => {
        // Determine portal status based on the data
        let portalStatus: { status: string; label: string; color: string };

        if (row.has_portal_access) {
          portalStatus = { status: "active", label: "Active", color: "green" };
        } else if (row.invitation_sent_at && !row.invitation_accepted) {
          const invitationDate = new Date(row.invitation_sent_at);
          const expiryDate = new Date(
            invitationDate.getTime() + 7 * 24 * 60 * 60 * 1000
          );
          const isExpired = expiryDate < new Date();

          if (isExpired) {
            portalStatus = {
              status: "expired",
              label: "Expired",
              color: "red",
            };
          } else {
            portalStatus = {
              status: "invited",
              label: "Invited",
              color: "orange",
            };
          }
        } else {
          portalStatus = {
            status: "not_invited",
            label: "Not Invited",
            color: "default",
          };
        }

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          company_name: row.company_name,
          phone: row.phone,
          address: row.address,
          contact_person: row.contact_person,
          status: row.status || "active",
          created_at: row.created_at,
          updated_at: row.updated_at,
          assigned_projects_count: parseInt(row.assigned_projects_count || "0"),
          projects: [],
          team_members: [],
          // Portal status fields for frontend
          has_portal_access: row.has_portal_access || false,
          invitation_sent_at: row.invitation_sent_at,
          invitation_accepted: row.invitation_accepted || false,
          portal_status: portalStatus,
        };
      });

      return res.json(
        new ServerResponse(
          true,
          {
            clients,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          null
        )
      );
    } catch (error) {
      console.error("Error fetching clients:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve clients"));
    }
  }

  static async createClient(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const clientData = req.body;
      const teamId = (req.user as any)?.team_id;

      // Validate required fields
      if (!clientData.name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client name is required"));
      }

      // Insert new client
      const query = `
        INSERT INTO clients (
          name, 
          email, 
          company_name, 
          phone, 
          address, 
          contact_person, 
          status, 
          team_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, email, company_name, phone, address, contact_person, status, created_at, updated_at
      `;

      const values = [
        clientData.name,
        clientData.email || null,
        clientData.company_name || null,
        clientData.phone || null,
        clientData.address || null,
        clientData.contact_person || null,
        clientData.status || "pending",
        teamId,
      ];

      const result = await db.query(query, values);
      const newClient = result.rows[0];

      // Send invitation email if email is provided
      if (newClient.email) {
        try {
          const userId = (req.user as any)?.id;
          await ClientPortalController.sendClientInvitationEmail(
            newClient,
            teamId,
            userId
          );
        } catch (emailError) {
          console.error("Error sending client invitation email:", emailError);
          // Continue with client creation even if email fails
        }
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: newClient.id,
            name: newClient.name,
            email: newClient.email,
            company_name: newClient.company_name,
            phone: newClient.phone,
            address: newClient.address,
            contact_person: newClient.contact_person,
            status: newClient.status,
            created_at: newClient.created_at,
            updated_at: newClient.updated_at,
            assigned_projects_count: 0,
            team_members: [],
          },
          "Client created successfully"
        )
      );
    } catch (error) {
      console.error("Error creating client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to create client"));
    }
  }

  static async generateClientInvitationLink(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req.body;
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      if (!userId || !teamId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Authentication required"));
      }

      if (!clientId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client ID is required"));
      }

      // Handle organization-level invite
      if (clientId === "organization") {
        return ClientPortalController.generateOrganizationInvitationLink(
          req,
          res
        );
      }

      // Get client information
      const clientQuery = `
        SELECT c.id, c.name, c.email, c.company_name, c.phone, c.invite_slug
        FROM clients c
        WHERE c.id = $1 AND c.team_id = $2
      `;
      const clientResult = await db.query(clientQuery, [clientId, teamId]);

      if (!clientResult.rows.length) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientResult.rows[0];

      // Validate that client has an email address
      if (!client.email || client.email.trim() === "") {
        return res.status(400).json(
          new ServerResponse(
            false,
            {
              errorCode: "EMAIL_REQUIRED",
              clientId: client.id,
              clientName: client.name,
            },
            "Email address is required to invite the client to the portal"
          )
        );
      }

      // Check if this email already exists as a Worklenz user
      const existingUserQuery = `
        SELECT u.id, u.email, u.name 
        FROM users u 
        WHERE LOWER(u.email) = LOWER($1)
      `;
      const existingUserResult = await db.query(existingUserQuery, [
        client.email,
      ]);

      if (existingUserResult.rows.length > 0) {
        // User already exists in Worklenz - link them to client portal
        const existingUser = existingUserResult.rows[0];

        // Check if this Worklenz user is already linked to the client portal
        const linkCheckQuery = `
          SELECT id FROM client_users
          WHERE user_id = $1 AND client_id = $2
        `;
        const linkResult = await db.query(linkCheckQuery, [
          existingUser.id,
          client.id,
        ]);

        if (linkResult.rows.length === 0) {
          // Check if email already exists in client_users (for any client)
          const emailExistsCheck = await db.query(
            `SELECT id, client_id FROM client_users WHERE LOWER(email) = LOWER($1)`,
            [client.email]
          );

          let newClientUserId: string;

          if (emailExistsCheck.rows.length > 0) {
            // Email already exists - update the existing record to link to this client
            const existingClientUser = emailExistsCheck.rows[0];
            newClientUserId = existingClientUser.id;

            // Update the existing client_users record to link to this client and user
            await db.query(
              `UPDATE client_users 
               SET user_id = $1, client_id = $2, name = $3, team_id = $4, status = 'active', updated_at = NOW()
               WHERE id = $5`,
              [
                existingUser.id,
                client.id,
                client.name,
                teamId,
                existingClientUser.id,
              ]
            );
          } else {
            // Create client_users record linking Worklenz user to client portal
            // Note: password_hash is NULL since they'll authenticate via users table (let DB generate UUID)
            const linkUserQuery = `
              INSERT INTO client_users (user_id, client_id, email, name, role, team_id, status, created_at, updated_at)
              VALUES ($1, $2, $3, $4, 'member', $5, 'active', NOW(), NOW())
              RETURNING id
            `;
            const insertResult = await db.query(linkUserQuery, [
              existingUser.id,
              client.id,
              client.email,
              client.name,
              teamId,
            ]);
            newClientUserId = insertResult.rows[0].id;
          }

          // Create organization access record for multi-org support
          const orgAccessQuery = `
            INSERT INTO client_user_organizations (client_user_id, team_id, client_id, is_default, created_at, updated_at)
            VALUES ($1, $2, $3, TRUE, NOW(), NOW())
            ON CONFLICT (client_user_id, team_id) DO NOTHING
          `;
          await db.query(orgAccessQuery, [newClientUserId, teamId, client.id]);

          // Update client status to active since user already exists
          const updateClientQuery = `
            UPDATE clients SET status = 'active', updated_at = NOW()
            WHERE id = $1 AND team_id = $2
          `;
          await db.query(updateClientQuery, [client.id, teamId]);

          // Create client portal access record with full permissions
          // For linked Worklenz users, we use a placeholder password_hash since they authenticate via users table
          await db.query(
            `INSERT INTO client_portal_access (client_id, email, password_hash, is_active, created_at, updated_at)
             VALUES ($1, $2, 'LINKED_USER', TRUE, NOW(), NOW())
             ON CONFLICT (client_id) DO UPDATE SET is_active = TRUE, email = $2, updated_at = NOW()`,
            [client.id, client.email]
          );
        }

        // Return response indicating user can use existing Worklenz credentials
        return res.json(
          new ServerResponse(
            true,
            {
              isExistingUser: true,
              message: "This client is already a Worklenz user!",
              clientName: client.name,
              clientEmail: client.email,
              portalUrl: `${getClientPortalBaseUrl()}/login`,
            },
            "Client is existing Worklenz user - access granted"
          )
        );
      }

      // Generate secure short random token for invitation (64 characters, same as team/project invitations)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now
      const inviteToken = TokenService.generateInviteToken();

      // Create invitation record in database
      await TokenService.createInvitation({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy: userId,
        token: inviteToken,
      });

      // Generate client portal link with secure token
      const baseUrl = getClientPortalBaseUrl();
      const tokenLink = `${baseUrl}/invite?token=${inviteToken}`;

      // Also provide vanity URL option if client has invite_slug
      let vanityLink = null;
      if (client.invite_slug) {
        vanityLink = `${baseUrl}/i/${client.invite_slug}`;
      }

      return res.json(
        new ServerResponse(
          true,
          {
            invitationLink: tokenLink,
            vanityLink: vanityLink,
            token: inviteToken,
            expiresAt: new Date(expiresAt).toISOString(),
            clientName: client.name,
            clientEmail: client.email,
            inviteSlug: client.invite_slug,
          },
          "Invitation link generated successfully"
        )
      );
    } catch (error) {
      console.error("Error generating client invitation link:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to generate invitation link")
        );
    }
  }

  static async resendClientInvitation(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id: clientId } = req.params;
      const userId = req.user?.id;
      const teamId = req.user?.team_id;
      const inviterName = req.user?.name || "Your team";

      if (!userId || !teamId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Authentication required"));
      }

      if (!clientId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client ID is required"));
      }

      // Get client information
      const clientQuery = `
        SELECT c.id, c.name, c.email, c.company_name, c.phone
        FROM clients c
        WHERE c.id = $1 AND c.team_id = $2
      `;
      const clientResult = await db.query(clientQuery, [clientId, teamId]);

      if (!clientResult.rows.length) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientResult.rows[0];

      // Check if client already has an active portal user (already joined)
      const activeUserCheck = await db.query(
        `SELECT id FROM client_users WHERE client_id = $1 AND status = 'active'`,
        [clientId]
      );

      if (activeUserCheck.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Client has already joined the portal"
            )
          );
      }

      // Check if there's a pending invitation
      const pendingInviteCheck = await db.query(
        `SELECT id, email, name, token FROM client_invitations 
         WHERE client_id = $1 AND status = 'pending' 
         ORDER BY created_at DESC LIMIT 1`,
        [clientId]
      );

      // Generate new invitation token (short random token)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now
      let inviteToken: string;

      if (pendingInviteCheck.rows.length > 0) {
        const existingInvitation = pendingInviteCheck.rows[0];
        inviteToken = TokenService.generateInviteToken();

        // Update only this specific invitation by ID with new token and expiry
        await db.query(
          `UPDATE client_invitations 
           SET token = $1, expires_at = $2, updated_at = NOW() 
           WHERE id = $3`,
          [inviteToken, new Date(expiresAt), existingInvitation.id]
        );
      } else {
        inviteToken = TokenService.generateInviteToken();
        // Create new invitation record
        await TokenService.createInvitation({
          clientId: client.id,
          email: client.email,
          name: client.name,
          role: "member",
          invitedBy: userId,
          token: inviteToken,
        });
      }

      // Generate invitation link
      const inviteLink = `${getClientPortalBaseUrl()}/invite?token=${inviteToken}`;

      // Get team name for email
      const teamQuery = `SELECT name FROM teams WHERE id = $1`;
      const teamResult = await db.query(teamQuery, [teamId]);
      const teamName = teamResult.rows[0]?.name || "Worklenz Team";

      // Get the email template (same as initial invitation)
      const template = FileConstants.getEmailTemplate(
        IEmailTemplateType.ClientInvitation
      ) as string;
      if (!template) {
        return res
          .status(500)
          .json(new ServerResponse(false, null, "Email template not found"));
      }

      // Replace template variables
      const emailContent = template
        .replace(/\[VAR_CLIENT_NAME\]/g, client.name || "Client")
        .replace(/\[VAR_CLIENT_EMAIL\]/g, client.email || "")
        .replace(/\[VAR_COMPANY_NAME\]/g, client.company_name || "N/A")
        .replace(/\[VAR_CLIENT_PHONE\]/g, client.phone || "N/A")
        .replace(/\[VAR_TEAM_NAME\]/g, teamName)
        .replace(/\[VAR_PORTAL_LINK\]/g, inviteLink);

      // Send invitation email
      const emailRequest = new EmailRequest(
        [client.email],
        `Welcome to your Client Portal - ${teamName}`,
        emailContent
      );

      const emailResult = await sendEmailEnhanced(emailRequest);

      if (!emailResult.success) {
        console.error(
          "Failed to send client invitation email:",
          emailResult.error
        );
        const errorMessage =
          emailResult.error?.message || "Failed to send invitation email";
        return res
          .status(500)
          .json(new ServerResponse(false, null, errorMessage));
      }

      return res.json(
        new ServerResponse(
          true,
          {
            invitationLink: inviteLink,
            clientName: client.name,
            clientEmail: client.email,
            expiresAt: new Date(expiresAt).toISOString(),
            emailSent: true,
          },
          "Invitation email sent successfully"
        )
      );
    } catch (error) {
      console.error("Error resending client invitation:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to resend invitation"));
    }
  }

  static async generateOrganizationInvitationLink(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      if (!userId || !teamId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Authentication required"));
      }

      // Get team information
      const teamQuery = `SELECT name FROM teams WHERE id = $1`;
      const teamResult = await db.query(teamQuery, [teamId]);
      const teamName = teamResult.rows[0]?.name || "Worklenz Team";

      // Generate secure token for organization invitation
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now
      const inviteToken = TokenService.generateOrganizationInviteToken({
        teamId,
        type: "organization_invite",
        invitedBy: userId,
        expiresAt,
        organizationName: teamName,
      });

      // Create or update organization invitation record in database
      const upsertQuery = `
        INSERT INTO organization_invitations (team_id, token, invited_by, expires_at, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        ON CONFLICT (team_id) 
        DO UPDATE SET 
          token = EXCLUDED.token,
          invited_by = EXCLUDED.invited_by,
          expires_at = EXCLUDED.expires_at,
          updated_at = NOW()
        RETURNING id
      `;

      await db.query(upsertQuery, [
        teamId,
        inviteToken,
        userId,
        new Date(expiresAt),
      ]);

      // Generate organization portal link with secure token (URL-encode to handle + characters in JWT)
      const portalLink = `${
        process.env.CLIENT_PORTAL_HOSTNAME
          ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`
          : "http://localhost:5174"
      }/organization-invite?token=${encodeURIComponent(inviteToken)}`;

      return res.json(
        new ServerResponse(
          true,
          {
            invitationLink: portalLink,
            token: inviteToken,
            expiresAt: new Date(expiresAt).toISOString(),
            organizationName: teamName,
          },
          "Organization invitation link generated successfully"
        )
      );
    } catch (error) {
      console.error("Error generating organization invitation link:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to generate organization invitation link"
          )
        );
    }
  }

  static async handleOrganizationInvite(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { token } = req.body;

      if (!token) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid invitation token"));
      }

      // Verify the organization invitation token
      const decoded = TokenService.verifyOrganizationInviteToken(token);

      if (!decoded) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Invalid or expired invitation token"
            )
          );
      }

      // Check if token exists in database and is still valid
      const inviteQuery = `
        SELECT oi.*, t.name as organization_name
        FROM organization_invitations oi
        JOIN teams t ON oi.team_id = t.id
        WHERE oi.token = $1 AND oi.expires_at > NOW()
      `;
      const inviteResult = await db.query(inviteQuery, [token]);

      if (!inviteResult.rows.length) {
        return res
          .status(400)
          .json(
            new ServerResponse(false, null, "Invalid or expired invitation")
          );
      }

      const invitation = inviteResult.rows[0];

      // Check if user is already authenticated
      const userId = req.user?.id;

      if (userId) {
        // User is already authenticated - check if they are linked to this organization's client portal
        const clientCheckQuery = `
          SELECT cu.* 
          FROM client_users cu
          JOIN clients c ON cu.client_id = c.id
          WHERE cu.user_id = $1 AND c.team_id = $2
        `;
        const clientResult = await db.query(clientCheckQuery, [
          userId,
          invitation.team_id,
        ]);

        if (clientResult.rows.length > 0) {
          // User is already linked to this organization's client portal
          return res.json(
            new ServerResponse(true, {
              redirectTo: "client-portal",
              message:
                "You already have access to this organization's client portal",
            })
          );
        }

        // User is authenticated but not linked to client portal
        // Create a client record and link the user
        const userQuery = `SELECT email, name FROM users WHERE id = $1`;
        const userResult = await db.query(userQuery, [userId]);
        const user = userResult.rows[0];

        if (user) {
          // Create client record
          const createClientQuery = `
            INSERT INTO clients (id, team_id, name, email, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, 'active', NOW(), NOW())
            RETURNING id
          `;
          const clientId = crypto.randomUUID();
          await db.query(createClientQuery, [
            clientId,
            invitation.team_id,
            user.name,
            user.email,
          ]);

          // Link user to client portal with active status
          // Check if email already exists in client_users to avoid duplicate key error
          const emailExistsCheck = await db.query(
            `SELECT id FROM client_users WHERE LOWER(email) = LOWER($1)`,
            [user.email]
          );

          if (emailExistsCheck.rows.length > 0) {
            // Update existing record
            await db.query(
              `UPDATE client_users 
               SET user_id = $1, client_id = $2, name = $3, team_id = $4, status = 'active', updated_at = NOW()
               WHERE id = $5`,
              [
                userId,
                clientId,
                user.name,
                invitation.team_id,
                emailExistsCheck.rows[0].id,
              ]
            );
          } else {
            const linkUserQuery = `
              INSERT INTO client_users (user_id, client_id, email, name, role, team_id, status, created_at, updated_at)
              VALUES ($1, $2, $3, $4, 'member', $5, 'active', NOW(), NOW())
            `;
            await db.query(linkUserQuery, [
              userId,
              clientId,
              user.email,
              user.name,
              invitation.team_id,
            ]);
          }

          return res.json(
            new ServerResponse(true, {
              redirectTo: "client-portal",
              message: "Successfully linked to organization's client portal",
            })
          );
        }
      }

      // User is not authenticated - they need to login/register first
      return res.json(
        new ServerResponse(true, {
          redirectTo: "login",
          message: "Please login or create an account to accept the invitation",
          organizationName: invitation.organization_name,
        })
      );
    } catch (error) {
      console.error("Error handling organization invitation:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to process organization invitation"
          )
        );
    }
  }

  static async sendClientInvitationEmail(
    client: any,
    teamId: string,
    invitedBy: string
  ) {
    try {
      // Get team information
      const teamQuery = `SELECT name FROM teams WHERE id = $1`;
      const teamResult = await db.query(teamQuery, [teamId]);
      const teamName = teamResult.rows[0]?.name || "Worklenz Team";

      // Generate secure token for invitation (short random token)
      const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days from now
      const inviteToken = TokenService.generateInviteToken();

      // Create invitation record in database
      await TokenService.createInvitation({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy,
        token: inviteToken,
      });

      // Get the email template
      const template = FileConstants.getEmailTemplate(
        IEmailTemplateType.ClientInvitation
      ) as string;
      if (!template) {
        throw new Error("Client invitation email template not found");
      }

      // Generate client portal link with secure token
      const portalLink = `${getClientPortalBaseUrl()}/invite?token=${inviteToken}`;

      // Replace template variables
      const emailContent = template
        .replace(/\[VAR_CLIENT_NAME\]/g, client.name || "Client")
        .replace(/\[VAR_CLIENT_EMAIL\]/g, client.email || "")
        .replace(/\[VAR_COMPANY_NAME\]/g, client.company_name || "N/A")
        .replace(/\[VAR_CLIENT_PHONE\]/g, client.phone || "N/A")
        .replace(/\[VAR_TEAM_NAME\]/g, teamName)
        .replace(/\[VAR_PORTAL_LINK\]/g, portalLink);

      // Send the email
      await sendEmail({
        to: [client.email],
        subject: `Welcome to your Client Portal - ${teamName}`,
        html: emailContent,
      });

      console.log(`Client invitation email sent to ${client.email}`);
    } catch (error) {
      console.error("Error sending client invitation email:", error);
      throw error;
    }
  }

  static async getClientById(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Get client details with team validation
      const query = `
        SELECT 
          c.id,
          c.name,
          c.email,
          c.company_name,
          c.phone,
          c.address,
          c.contact_person,
          c.status,
          c.team_id,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT p.id) as assigned_projects_count
        FROM clients c
        LEFT JOIN projects p ON c.id = p.client_id
        WHERE c.id = $1 AND c.team_id = $2
        GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.address, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at
      `;

      const result = await db.query(query, [id, teamId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = result.rows[0];
      const clientData = {
        id: client.id,
        name: client.name,
        email: client.email,
        company_name: client.company_name,
        phone: client.phone,
        address: client.address,
        contact_person: client.contact_person,
        status: client.status || "active",
        created_at: client.created_at,
        updated_at: client.updated_at,
        assigned_projects_count: parseInt(
          client.assigned_projects_count || "0"
        ),
        team_members: [],
      };

      return res.json(
        new ServerResponse(
          true,
          clientData,
          "Client details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client by ID:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client details")
        );
    }
  }

  static async getClientDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Get comprehensive client details
      const clientQuery = `
        SELECT 
          c.id,
          c.name,
          c.email,
          c.company_name,
          c.phone,
          c.address,
          c.contact_person,
          c.status,
          c.team_id,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT p.id) as assigned_projects_count
        FROM clients c
        LEFT JOIN projects p ON c.id = p.client_id
        WHERE c.id = $1 AND c.team_id = $2
        GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.address, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at
      `;

      const clientResult = await db.query(clientQuery, [id, teamId]);
      const client = clientResult.rows[0];

      // Get client statistics
      const projectStatsQuery = `
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN sps.name = 'Active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN sps.name = 'Completed' THEN 1 END) as completed_projects
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
      `;

      const projectStatsResult = await db.query(projectStatsQuery, [id]);
      const projectStats = projectStatsResult.rows[0];

      // Get client projects with basic info
      const projectsQuery = `
        SELECT 
          p.id,
          p.name,
          p.notes as description,
          p.status_id,
          sps.name as status,
          sps.color_code as status_color,
          p.created_at,
          p.updated_at,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done = true) THEN 1 END) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE p.client_id = $1
        GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at
        ORDER BY p.created_at DESC
        LIMIT 10
      `;

      const projectsResult = await db.query(projectsQuery, [id]);
      const projects = projectsResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        status_color: row.status_color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        totalTasks: parseInt(row.total_tasks || "0"),
        completedTasks: parseInt(row.completed_tasks || "0"),
      }));

      // Prepare comprehensive client details response
      const clientDetails = {
        id: client.id,
        name: client.name,
        email: client.email,
        company_name: client.company_name,
        phone: client.phone,
        address: client.address,
        contact_person: client.contact_person,
        status: client.status || "active",
        created_at: client.created_at,
        updated_at: client.updated_at,
        assigned_projects_count: parseInt(
          client.assigned_projects_count || "0"
        ),
        // Statistics
        stats: {
          totalProjects: parseInt(projectStats.total_projects || "0"),
          activeProjects: parseInt(projectStats.active_projects || "0"),
          completedProjects: parseInt(projectStats.completed_projects || "0"),
          totalTeamMembers: 0, // Placeholder - team members not implemented yet
          activeTeamMembers: 0, // Placeholder
          totalRequests: 0, // Placeholder - requests not implemented yet
          pendingRequests: 0, // Placeholder
          totalInvoices: 0, // Placeholder - invoices not implemented yet
          unpaidInvoices: 0, // Placeholder
        },
        // Projects
        projects,
        // Team members (placeholder)
        team_members: [],
      };

      return res.json(
        new ServerResponse(
          true,
          clientDetails,
          "Client details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching comprehensive client details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client details")
        );
    }
  }

  static async updateClient(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Update client data
      const updateFields: string[] = [];
      const updateValues: any[] = [];
      let paramIndex = 1;

      // Allow updating all available fields
      if (updateData.name) {
        updateFields.push(`name = $${paramIndex}`);
        updateValues.push(updateData.name);
        paramIndex++;
      }

      if (updateData.email) {
        updateFields.push(`email = $${paramIndex}`);
        updateValues.push(updateData.email);
        paramIndex++;
      }

      if (updateData.company_name) {
        updateFields.push(`company_name = $${paramIndex}`);
        updateValues.push(updateData.company_name);
        paramIndex++;
      }

      if (updateData.phone) {
        updateFields.push(`phone = $${paramIndex}`);
        updateValues.push(updateData.phone);
        paramIndex++;
      }

      if (updateData.address) {
        updateFields.push(`address = $${paramIndex}`);
        updateValues.push(updateData.address);
        paramIndex++;
      }

      if (updateData.status) {
        updateFields.push(`status = $${paramIndex}`);
        updateValues.push(updateData.status);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id, teamId);

      const query = `
        UPDATE clients 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex} AND team_id = $${paramIndex + 1}
        RETURNING id, name, email, company_name, phone, address, status, created_at, updated_at
      `;

      const result = await db.query(query, updateValues);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const updatedClient = result.rows[0];

      // If status was updated, also update related tables
      if (updateData.status) {
        // Update client_users status
        await db.query(
          "UPDATE client_users SET status = $1 WHERE client_id = $2",
          [updateData.status, id]
        );

        // Update client_portal_access is_active based on status
        const isActive = updateData.status === "active";
        await db.query(
          "UPDATE client_portal_access SET is_active = $1, updated_at = NOW() WHERE client_id = $2",
          [isActive, id]
        );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedClient.id,
            name: updatedClient.name,
            email: updatedClient.email,
            company_name: updatedClient.company_name,
            phone: updatedClient.phone,
            address: updatedClient.address,
            status: updatedClient.status || "active",
            created_at: updatedClient.created_at,
            updated_at: updatedClient.updated_at,
          },
          "Client updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update client"));
    }
  }

  // Set or update client invite slug (vanity URL)
  static async setClientInviteSlug(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { invite_slug } = req.body;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // If invite_slug is null or empty, remove it
      if (!invite_slug || invite_slug.trim() === "") {
        await db.query(
          "UPDATE clients SET invite_slug = NULL, updated_at = NOW() WHERE id = $1",
          [id]
        );

        return res.json(
          new ServerResponse(
            true,
            {
              id,
              invite_slug: null,
            },
            "Invite slug removed successfully"
          )
        );
      }

      // Validate slug format
      if (!isValidSlug(invite_slug)) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Invalid slug format. Use lowercase letters, numbers, and hyphens only (3-50 characters)"
            )
          );
      }

      // Check if slug is already taken
      const slugCheck = await db.query(
        "SELECT id FROM clients WHERE LOWER(invite_slug) = LOWER($1) AND id != $2",
        [invite_slug, id]
      );

      if (slugCheck.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "This invite slug is already taken. Please choose another."
            )
          );
      }

      // Update client with new slug
      const result = await db.query(
        "UPDATE clients SET invite_slug = LOWER($1), updated_at = NOW() WHERE id = $2 RETURNING invite_slug",
        [invite_slug, id]
      );

      return res.json(
        new ServerResponse(
          true,
          {
            id,
            invite_slug: result.rows[0].invite_slug,
            vanity_url: `${getClientPortalBaseUrl()}/i/${
              result.rows[0].invite_slug
            }`,
          },
          "Invite slug updated successfully"
        )
      );
    } catch (error) {
      console.error("Error setting client invite slug:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update invite slug"));
    }
  }

  // Generate suggested slug from client name
  static async suggestClientInviteSlug(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Get client information
      const client = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (client.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const clientData = client.rows[0];
      const baseName = clientData.company_name || clientData.name;

      // Generate unique slug
      const checkSlugExists = async (slug: string): Promise<boolean> => {
        const result = await db.query(
          "SELECT id FROM clients WHERE LOWER(invite_slug) = LOWER($1)",
          [slug]
        );
        return result.rows.length > 0;
      };

      const suggestedSlug = await generateUniqueSlug(baseName, checkSlugExists);

      return res.json(
        new ServerResponse(
          true,
          {
            suggested_slug: suggestedSlug,
            vanity_url: `${getClientPortalBaseUrl()}/i/${suggestedSlug}`,
          },
          "Slug suggestion generated successfully"
        )
      );
    } catch (error) {
      console.error("Error suggesting client invite slug:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to generate slug suggestion")
        );
    }
  }

  static async deleteClient(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Deactivate the client instead of deleting (soft delete)
      const deactivateResult = await db.query(
        "UPDATE clients SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (deactivateResult.rowCount === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Also deactivate all client users for this client
      await db.query(
        "UPDATE client_users SET status = 'inactive' WHERE client_id = $1",
        [id]
      );

      // Deactivate client portal access
      await db.query(
        "UPDATE client_portal_access SET is_active = FALSE, updated_at = NOW() WHERE client_id = $1",
        [id]
      );

      return res.json(
        new ServerResponse(true, null, "Client deactivated successfully")
      );
    } catch (error) {
      console.error("Error deactivating client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to deactivate client"));
    }
  }

  // Client Projects Management
  static async getClientProjects(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10, status } = req.query;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Build query with pagination and filtering
      // NOTE: Archived tasks should NOT be included in project progress stats
      let query = `
        SELECT 
          p.id,
          p.name,
          p.notes,
          p.status_id,
          sps.name as status_name,
          sps.color_code as status_color,
          p.created_at,
          p.updated_at,
          COUNT(t.id) as total_tasks,
          COUNT(
            CASE 
              WHEN ts.category_id IN (
                SELECT id 
                FROM sys_task_status_categories 
                WHERE is_done = true
              ) 
              THEN 1 
            END
          ) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        -- Only consider non-archived tasks when calculating progress
        LEFT JOIN tasks t ON p.id = t.project_id AND t.archived IS FALSE
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE p.client_id = $1
      `;

      const queryParams = [id];
      let paramIndex = 2;

      // Add status filter if provided
      if (status) {
        query += ` AND sps.name = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      query += ` GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
        ${status ? "AND sps.name = $2" : ""}
      `;
      const countParams = status ? [id, status] : [id];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const projects = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.notes,
        status: row.status_name,
        status_color: row.status_color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        total_tasks: parseInt(row.total_tasks || "0"),
        completed_tasks: parseInt(row.completed_tasks || "0"),
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            projects,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Client projects retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client projects:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client projects")
        );
    }
  }

  static async assignProjectToClient(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params; // client ID
      const { project_id } = req.body;
      const teamId = (req.user as any)?.team_id;

      // Validate required fields
      if (!project_id) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Project ID is required"));
      }

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Verify project exists and belongs to team
      const projectCheck = await db.query(
        "SELECT id, name, client_id FROM projects WHERE id = $1 AND team_id = $2",
        [project_id, teamId]
      );

      if (projectCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Project not found"));
      }

      const project = projectCheck.rows[0];
      const client = clientCheck.rows[0];

      // Check if project is already assigned to another client
      if (project.client_id && project.client_id !== id) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Project is already assigned to another client"
            )
          );
      }

      // Check if project is already assigned to this client
      if (project.client_id === id) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Project is already assigned to this client"
            )
          );
      }

      // Assign project to client
      const updateResult = await db.query(
        "UPDATE projects SET client_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, client_id, updated_at",
        [id, project_id]
      );

      if (updateResult.rowCount === 0) {
        return res
          .status(500)
          .json(
            new ServerResponse(
              false,
              null,
              "Failed to assign project to client"
            )
          );
      }

      const updatedProject = updateResult.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            projectId: updatedProject.id,
            projectName: updatedProject.name,
            clientId: updatedProject.client_id,
            clientName: client.name,
            assignedAt: updatedProject.updated_at,
          },
          "Project assigned to client successfully"
        )
      );
    } catch (error) {
      console.error("Error assigning project to client:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to assign project to client")
        );
    }
  }

  static async removeProjectFromClient(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id, projectId } = req.params; // id = client ID, projectId = project ID
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Verify project exists, belongs to team, and is assigned to this client
      const projectCheck = await db.query(
        "SELECT id, name, client_id FROM projects WHERE id = $1 AND team_id = $2 AND client_id = $3",
        [projectId, teamId, id]
      );

      if (projectCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Project not found or not assigned to this client"
            )
          );
      }

      const project = projectCheck.rows[0];
      const client = clientCheck.rows[0];

      // Remove project assignment (set client_id to null)
      const updateResult = await db.query(
        "UPDATE projects SET client_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING id, name, updated_at",
        [projectId]
      );

      if (updateResult.rowCount === 0) {
        return res
          .status(500)
          .json(
            new ServerResponse(
              false,
              null,
              "Failed to remove project from client"
            )
          );
      }

      const updatedProject = updateResult.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            projectId: updatedProject.id,
            projectName: updatedProject.name,
            clientId: id,
            clientName: client.name,
            removedAt: updatedProject.updated_at,
          },
          "Project removed from client successfully"
        )
      );
    } catch (error) {
      console.error("Error removing project from client:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to remove project from client"
          )
        );
    }
  }

  // Client Team Management
  static async getClientTeam(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 10, status } = req.query;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // For now, return empty team since client team members are not implemented in the database
      // This would typically query a client_team_members table or similar
      const teamMembers: any[] = [];
      const total = 0;

      return res.json(
        new ServerResponse(
          true,
          {
            team_members: teamMembers,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Client team retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client team:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client team")
        );
    }
  }

  private static generateInvitationEmailHTML(data: {
    inviteeName: string;
    inviterName: string;
    clientName: string;
    companyName?: string;
    inviteLink: string;
    expiresAt: Date;
    role: string;
  }): string {
    const expiryDate = data.expiresAt.toLocaleDateString();

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>You're Invited to Join ${data.clientName} on Worklenz</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1890ff; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>You're Invited to Join ${data.clientName}</h1>
          </div>
          <div class="content">
            <p>Hello ${data.inviteeName},</p>
            <p>${data.inviterName} has invited you to join <strong>${data.clientName}</strong> on Worklenz as a <strong>${data.role}</strong>.</p>
            <p>Worklenz is a comprehensive project management platform that will help you collaborate effectively with your team and stay updated on project progress.</p>
            <p>Click the button below to accept the invitation and set up your account:</p>
            <a href="${data.inviteLink}" class="button">Accept Invitation</a>
            <p>This invitation will expire on ${expiryDate}.</p>
            <p>If you have any questions, please contact ${data.inviterName} or reply to this email.</p>
          </div>
          <div class="footer">
            <p>© 2024 Worklenz. All rights reserved.</p>
            <p>If you didn't expect this invitation, you can safely ignore this email.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private static generateWelcomeEmailHTML(data: {
    userName: string;
    clientName: string;
    companyName?: string;
    portalLink: string;
  }): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to ${data.clientName} on Worklenz</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #52c41a; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background: #f9f9f9; }
          .button { display: inline-block; background: #1890ff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
          .footer { padding: 20px; text-align: center; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to ${data.clientName}!</h1>
          </div>
          <div class="content">
            <p>Hello ${data.userName},</p>
            <p>Welcome to <strong>${data.clientName}</strong> on Worklenz!</p>
            <p>Your account has been successfully created. You can now access your client portal to:</p>
            <ul>
              <li>View project progress and updates</li>
              <li>Submit requests and track their status</li>
              <li>Access invoices and billing information</li>
              <li>Communicate with your team</li>
              <li>Manage your profile and settings</li>
            </ul>
            <p>Click the button below to access your portal:</p>
            <a href="${data.portalLink}" class="button">Access Portal</a>
            <p>If you have any questions or need assistance, please don't hesitate to reach out to your team.</p>
          </div>
          <div class="footer">
            <p>© 2024 Worklenz. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  static async inviteTeamMember(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { email, name, role = "member" } = req.body;
      const teamId = (req.user as any)?.team_id;
      const inviterId = (req.user as any)?.id;
      const inviterName = (req.user as any)?.name;

      // Validate required fields
      if (!email || !name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Email and name are required"));
      }

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // Check if user is already invited or exists
      const existingInvitation = await db.query(
        "SELECT id FROM client_invitations WHERE client_id = $1 AND email = $2 AND status = 'pending'",
        [id, email]
      );

      if (existingInvitation.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "User already has a pending invitation"
            )
          );
      }

      const existingUser = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [id, email]
      );

      if (existingUser.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "User already exists for this client"
            )
          );
      }

      // Generate invitation token
      const inviteToken = TokenService.generateSecureToken();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Create invitation record
      await TokenService.createInvitation({
        clientId: id,
        email,
        name,
        role,
        invitedBy: inviterId,
        token: inviteToken,
      });

      // Generate invitation link
      const inviteLink = `${
        process.env.CLIENT_PORTAL_HOSTNAME
          ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`
          : "http://localhost:5174"
      }/invitation?token=${inviteToken}`;

      // Generate email HTML
      const emailHtml = ClientPortalController.generateInvitationEmailHTML({
        inviteeName: name,
        inviterName,
        clientName: client.name,
        companyName: client.company_name,
        inviteLink,
        expiresAt,
        role,
      });

      // Send invitation email using shared email function
      const emailRequest = new EmailRequest(
        [email],
        `You're invited to join ${client.name} on Worklenz`,
        emailHtml
      );

      const messageId = await sendEmail(emailRequest);

      if (!messageId) {
        return res
          .status(500)
          .json(
            new ServerResponse(false, null, "Failed to send invitation email")
          );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            invitationId: inviteToken,
            email,
            name,
            role,
            status: "pending",
            expiresAt,
          },
          "Team member invited successfully"
        )
      );
    } catch (error) {
      console.error("Error inviting team member:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to invite team member"));
    }
  }

  static async updateTeamMember(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id, memberId } = req.params; // id = client ID, memberId = client user ID or invitation ID
      const { name, role, status } = req.body;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Try to find existing client user first
      const clientUserCheck = await db.query(
        "SELECT id, name, email, role, status FROM client_users WHERE id = $1 AND client_id = $2",
        [memberId, id]
      );

      if (clientUserCheck.rows.length > 0) {
        // Update existing client user
        const updateFields = [];
        const updateValues = [];
        let paramIndex = 1;

        if (name) {
          updateFields.push(`name = $${paramIndex}`);
          updateValues.push(name);
          paramIndex++;
        }

        if (role) {
          updateFields.push(`role = $${paramIndex}`);
          updateValues.push(role);
          paramIndex++;
        }

        if (status) {
          updateFields.push(`status = $${paramIndex}`);
          updateValues.push(status);
          paramIndex++;
        }

        if (updateFields.length === 0) {
          return res
            .status(400)
            .json(new ServerResponse(false, null, "No valid fields to update"));
        }

        updateFields.push(`updated_at = NOW()`);
        updateValues.push(memberId);

        const updateQuery = `
          UPDATE client_users 
          SET ${updateFields.join(", ")}
          WHERE id = $${paramIndex}
          RETURNING id, name, email, role, status, updated_at
        `;

        const result = await db.query(updateQuery, updateValues);
        const updatedUser = result.rows[0];

        return res.json(
          new ServerResponse(
            true,
            {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              role: updatedUser.role,
              status: updatedUser.status,
              type: "client_user",
              updatedAt: updatedUser.updated_at,
            },
            "Team member updated successfully"
          )
        );
      }
      // Try to find pending invitation
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, status FROM client_invitations WHERE id = $1 AND client_id = $2 AND status = 'pending'",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Team member or invitation not found"
            )
          );
      }

      // Update pending invitation
      const updateFields = [];
      const updateValues = [];
      let paramIndex = 1;

      if (name) {
        updateFields.push(`name = $${paramIndex}`);
        updateValues.push(name);
        paramIndex++;
      }

      if (role) {
        updateFields.push(`role = $${paramIndex}`);
        updateValues.push(role);
        paramIndex++;
      }

      if (updateFields.length === 0) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
      }

      updateValues.push(memberId);

      const updateQuery = `
          UPDATE client_invitations 
          SET ${updateFields.join(", ")}
          WHERE id = $${paramIndex}
          RETURNING id, email, name, role, status
        `;

      const result = await db.query(updateQuery, updateValues);
      const updatedInvitation = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedInvitation.id,
            email: updatedInvitation.email,
            name: updatedInvitation.name,
            role: updatedInvitation.role,
            status: updatedInvitation.status,
            type: "invitation",
          },
          "Team invitation updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating team member:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update team member"));
    }
  }

  static async removeTeamMember(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id, memberId } = req.params; // id = client ID, memberId = client user ID or invitation ID
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Try to find existing client user first
      const clientUserCheck = await db.query(
        "SELECT id, name, email, role FROM client_users WHERE id = $1 AND client_id = $2",
        [memberId, id]
      );

      if (clientUserCheck.rows.length > 0) {
        // Remove client user
        const deleteResult = await db.query(
          "DELETE FROM client_users WHERE id = $1 AND client_id = $2",
          [memberId, id]
        );

        if (deleteResult.rowCount === 0) {
          return res
            .status(404)
            .json(new ServerResponse(false, null, "Team member not found"));
        }

        const removedUser = clientUserCheck.rows[0];

        return res.json(
          new ServerResponse(
            true,
            {
              id: removedUser.id,
              name: removedUser.name,
              email: removedUser.email,
              role: removedUser.role,
              type: "client_user",
              removedAt: new Date(),
            },
            "Team member removed successfully"
          )
        );
      }
      // Try to find and remove pending invitation
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, status FROM client_invitations WHERE id = $1 AND client_id = $2",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Team member or invitation not found"
            )
          );
      }

      const invitation = invitationCheck.rows[0];

      // Delete the invitation
      const deleteResult = await db.query(
        "DELETE FROM client_invitations WHERE id = $1 AND client_id = $2",
        [memberId, id]
      );

      if (deleteResult.rowCount === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invitation not found"));
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: invitation.id,
            email: invitation.email,
            name: invitation.name,
            role: invitation.role,
            status: invitation.status,
            type: "invitation",
            removedAt: new Date(),
          },
          "Team invitation removed successfully"
        )
      );
    } catch (error) {
      console.error("Error removing team member:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to remove team member"));
    }
  }

  static async resendTeamInvitation(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id, memberId } = req.params;
      const teamId = (req.user as any)?.team_id;
      const inviterName = (req.user as any)?.name;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // Get invitation details
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, token, status FROM client_invitations WHERE id = $1 AND client_id = $2 AND status = 'pending'",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(false, null, "Pending invitation not found")
          );
      }

      const invitation = invitationCheck.rows[0];

      // Generate new token and extend expiry
      const newToken = TokenService.generateSecureToken();
      const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Update invitation with new token and expiry
      await db.query(
        "UPDATE client_invitations SET token = $1, expires_at = $2 WHERE id = $3",
        [newToken, newExpiresAt, memberId]
      );

      // Generate new invitation link (URL-encode to handle + characters in token)
      const inviteLink = `${
        process.env.CLIENT_PORTAL_HOSTNAME
          ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`
          : "http://localhost:5174"
      }/invitation?token=${encodeURIComponent(newToken)}`;

      // Generate email HTML
      const emailHtml = ClientPortalController.generateInvitationEmailHTML({
        inviteeName: invitation.name,
        inviterName,
        clientName: client.name,
        companyName: client.company_name,
        inviteLink,
        expiresAt: newExpiresAt,
        role: invitation.role,
      });

      // Send invitation email using shared email function
      const emailRequest = new EmailRequest(
        [invitation.email],
        `You're invited to join ${client.name} on Worklenz`,
        emailHtml
      );

      const messageId = await sendEmail(emailRequest);

      if (!messageId) {
        return res
          .status(500)
          .json(
            new ServerResponse(false, null, "Failed to send invitation email")
          );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: invitation.id,
            email: invitation.email,
            name: invitation.name,
            role: invitation.role,
            status: invitation.status,
            resent_at: new Date(),
          },
          "Team invitation resent successfully"
        )
      );
    } catch (error) {
      console.error("Error resending team invitation:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to resend team invitation")
        );
    }
  }

  // Client Analytics
  static async getClientStats(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Get project statistics
      const projectStats = await db.query(
        `
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN sps.name = 'Active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN sps.name = 'Completed' THEN 1 END) as completed_projects
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
      `,
        [id]
      );

      // Get team member statistics (placeholder - team members not implemented yet)
      const teamMemberStats = {
        total_team_members: 0,
        active_team_members: 0,
      };

      // Get request statistics (placeholder - requests not implemented yet)
      const requestStats = {
        total_requests: 0,
        pending_requests: 0,
      };

      // Get invoice statistics (placeholder - invoices not implemented yet)
      const invoiceStats = {
        total_invoices: 0,
        unpaid_invoices: 0,
      };

      const stats = {
        totalProjects: parseInt(projectStats.rows[0]?.total_projects || "0"),
        activeProjects: parseInt(projectStats.rows[0]?.active_projects || "0"),
        completedProjects: parseInt(
          projectStats.rows[0]?.completed_projects || "0"
        ),
        totalTeamMembers: teamMemberStats.total_team_members,
        activeTeamMembers: teamMemberStats.active_team_members,
        totalRequests: requestStats.total_requests,
        pendingRequests: requestStats.pending_requests,
        totalInvoices: invoiceStats.total_invoices,
        unpaidInvoices: invoiceStats.unpaid_invoices,
      };

      return res.json(
        new ServerResponse(
          true,
          stats,
          "Client statistics retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client stats:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(
            false,
            null,
            "Failed to retrieve client statistics"
          )
        );
    }
  }

  static async getClientActivity(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20, type, days = 30 } = req.query;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const activities = [];
      const dayFilter = `NOW() - INTERVAL '${Number(days)} days'`;

      // Get project activities
      if (!type || type === "project") {
        const projectActivitiesQuery = `
          SELECT 
            'project_update' as activity_type,
            p.id as reference_id,
            p.name as reference_name,
            p.updated_at as activity_date,
            'Project updated: ' || p.name as description,
            sps.name as status,
            'project' as category
          FROM projects p
          LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
          WHERE p.client_id = $1 AND p.updated_at >= ${dayFilter}
          ORDER BY p.updated_at DESC
        `;

        const projectResult = await db.query(projectActivitiesQuery, [id]);
        activities.push(...projectResult.rows);
      }

      // Get request activities
      if (!type || type === "request") {
        const requestActivitiesQuery = `
          SELECT 
            'request_' || r.status as activity_type,
            r.id as reference_id,
            r.req_no as reference_name,
            r.updated_at as activity_date,
            'Request ' || r.req_no || ' status changed to ' || r.status as description,
            r.status,
            'request' as category
          FROM client_portal_requests r
          WHERE r.client_id = $1 AND r.updated_at >= ${dayFilter}
          ORDER BY r.updated_at DESC
        `;

        const requestResult = await db.query(requestActivitiesQuery, [id]);
        activities.push(...requestResult.rows);
      }

      // Get invoice activities
      if (!type || type === "invoice") {
        const invoiceActivitiesQuery = `
          SELECT 
            'invoice_' || i.status as activity_type,
            i.id as reference_id,
            i.invoice_no as reference_name,
            COALESCE(i.sent_at, i.created_at) as activity_date,
            CASE 
              WHEN i.status = 'sent' THEN 'Invoice ' || i.invoice_no || ' sent'
              WHEN i.status = 'paid' THEN 'Invoice ' || i.invoice_no || ' paid'
              ELSE 'Invoice ' || i.invoice_no || ' ' || i.status
            END as description,
            i.status,
            'invoice' as category
          FROM client_portal_invoices i
          WHERE i.client_id = $1 AND i.created_at >= ${dayFilter}
          ORDER BY COALESCE(i.sent_at, i.created_at) DESC
        `;

        const invoiceResult = await db.query(invoiceActivitiesQuery, [id]);
        activities.push(...invoiceResult.rows);
      }

      // Get chat activities
      if (!type || type === "chat") {
        const chatActivitiesQuery = `
          SELECT 
            'chat_message' as activity_type,
            m.id as reference_id,
            DATE(m.created_at)::text as reference_name,
            m.created_at as activity_date,
            CASE
              WHEN m.sender_type = 'client' THEN 'You sent a message'
              ELSE u.name || ' sent a message'
            END as description,
            'active' as status,
            'chat' as category
          FROM client_portal_chat_messages m
          LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
          WHERE m.client_id = $1 AND m.created_at >= ${dayFilter}
          ORDER BY m.created_at DESC
          LIMIT 50
        `;

        const chatResult = await db.query(chatActivitiesQuery, [id]);
        activities.push(...chatResult.rows);
      }

      // Sort all activities by date
      activities.sort(
        (a, b) =>
          new Date(b.activity_date).getTime() -
          new Date(a.activity_date).getTime()
      );

      // Paginate
      const total = activities.length;
      const offset = (Number(page) - 1) * Number(limit);
      const paginatedActivities = activities.slice(
        offset,
        offset + Number(limit)
      );

      // Format activities
      const formattedActivities = paginatedActivities.map((activity: any) => ({
        id: `${activity.activity_type}_${activity.reference_id}`,
        type: activity.activity_type,
        category: activity.category,
        referenceId: activity.reference_id,
        referenceName: activity.reference_name,
        description: activity.description,
        status: activity.status,
        activityDate: activity.activity_date,
        relativeTime: this.getRelativeTime(new Date(activity.activity_date)),
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            activities: formattedActivities,
            total,
            page: Number(page),
            limit: Number(limit),
            days: Number(days),
            filter: type || "all",
          },
          "Client activity retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client activity:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client activity")
        );
    }
  }

  private static getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60)
      return `${diffMins} minute${diffMins > 1 ? "s" : ""} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
    return date.toLocaleDateString();
  }

  static async exportClientData(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { format = "csv", include = "all" } = req.query;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT * FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];
      const exportData: any = {
        client: {
          id: client.id,
          name: client.name,
          email: client.email,
          companyName: client.company_name,
          phone: client.phone,
          address: client.address,
          contactPerson: client.contact_person,
          status: client.status,
          createdAt: client.created_at,
          updatedAt: client.updated_at,
        },
      };

      // Include projects if requested
      if (
        include === "all" ||
        (typeof include === "string" && include.includes("projects"))
      ) {
        const projectsQuery = `
          SELECT 
            p.id, p.name, p.notes as description, 
            sps.name as status, p.created_at, p.updated_at,
            COUNT(t.id) as task_count
          FROM projects p
          LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
          LEFT JOIN tasks t ON p.id = t.project_id
          WHERE p.client_id = $1
          GROUP BY p.id, p.name, p.notes, sps.name, p.created_at, p.updated_at
          ORDER BY p.created_at DESC
        `;
        const projectsResult = await db.query(projectsQuery, [id]);
        exportData.projects = projectsResult.rows;
      }

      // Include requests if requested
      if (
        include === "all" ||
        (typeof include === "string" && include.includes("requests"))
      ) {
        const requestsQuery = `
          SELECT 
            r.id, r.req_no, r.status, r.request_data, r.notes,
            r.created_at, r.updated_at, r.completed_at,
            s.name as service_name
          FROM client_portal_requests r
          LEFT JOIN client_portal_services s ON r.service_id = s.id
          WHERE r.client_id = $1
          ORDER BY r.created_at DESC
        `;
        const requestsResult = await db.query(requestsQuery, [id]);
        exportData.requests = requestsResult.rows;
      }

      // Include invoices if requested
      if (
        include === "all" ||
        (typeof include === "string" && include.includes("invoices"))
      ) {
        const invoicesQuery = `
          SELECT 
            i.id, i.invoice_no, i.amount, i.currency, i.status,
            i.due_date, i.sent_at, i.paid_at, i.created_at, i.updated_at
          FROM client_portal_invoices i
          WHERE i.client_id = $1
          ORDER BY i.created_at DESC
        `;
        const invoicesResult = await db.query(invoicesQuery, [id]);
        exportData.invoices = invoicesResult.rows;
      }

      // Include chat messages if requested
      if (
        include === "all" ||
        (typeof include === "string" && include.includes("messages"))
      ) {
        const messagesQuery = `
          SELECT 
            m.id, m.sender_type, m.message, m.message_type,
            m.created_at, m.read_at,
            CASE
              WHEN m.sender_type = 'team_member' THEN u.name
              WHEN m.sender_type = 'client' THEN cu.name
            END as sender_name
          FROM client_portal_chat_messages m
          LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
          LEFT JOIN client_users cu ON m.sender_type = 'client' AND m.sender_id = cu.id
          WHERE m.client_id = $1
          ORDER BY m.created_at DESC
          LIMIT 1000
        `;
        const messagesResult = await db.query(messagesQuery, [id]);
        exportData.messages = messagesResult.rows;
      }

      // Add export metadata
      exportData.exportMetadata = {
        exportedAt: new Date(),
        exportedBy: (req.user as any)?.email || "system",
        format,
        includedSections:
          include === "all"
            ? ["client", "projects", "requests", "invoices", "messages"]
            : typeof include === "string"
            ? include.split(",")
            : [],
        clientId: id,
        clientName: client.name,
      };

      // For CSV format, flatten the data
      if (format === "csv") {
        // In a real implementation, you would convert this to CSV format
        // For now, return instructions for CSV generation
        return res.json(
          new ServerResponse(
            true,
            {
              downloadUrl: `/api/client-portal/clients/${id}/export/download?format=csv&include=${include}`,
              format: "csv",
              recordCount: {
                projects: exportData.projects?.length || 0,
                requests: exportData.requests?.length || 0,
                invoices: exportData.invoices?.length || 0,
                messages: exportData.messages?.length || 0,
              },
              generatedAt: new Date(),
            },
            "CSV export prepared"
          )
        );
      }

      // For JSON format, return the data directly
      return res.json(
        new ServerResponse(
          true,
          {
            exportData,
            downloadUrl: `/api/client-portal/clients/${id}/export/download?format=json&include=${include}`,
            format: "json",
          },
          "Client data export completed"
        )
      );
    } catch (error) {
      console.error("Error exporting client data:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to export client data"));
    }
  }

  // Bulk Operations
  static async bulkUpdateClients(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { client_ids, status } = req.body;
      const teamId = (req.user as any)?.team_id;

      if (
        !client_ids ||
        !Array.isArray(client_ids) ||
        client_ids.length === 0
      ) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid client IDs provided"));
      }

      if (!status || !["active", "inactive", "pending"].includes(status)) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid status provided"));
      }

      // Verify all clients belong to the team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      if (clientCheck.rows.length !== client_ids.length) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Some clients not found or not accessible"
            )
          );
      }

      // Update all clients status
      const updateResult = await db.query(
        "UPDATE clients SET status = $1, updated_at = NOW() WHERE id = ANY($2) AND team_id = $3",
        [status, client_ids, teamId]
      );

      // Update client_users status accordingly
      await db.query(
        "UPDATE client_users SET status = $1 WHERE client_id = ANY($2)",
        [status, client_ids]
      );

      // Update client_portal_access based on status
      const isActive = status === "active";
      await db.query(
        "UPDATE client_portal_access SET is_active = $1, updated_at = NOW() WHERE client_id = ANY($2)",
        [isActive, client_ids]
      );

      return res.json(
        new ServerResponse(
          true,
          { updated_count: updateResult.rowCount },
          "Clients updated successfully"
        )
      );
    } catch (error) {
      console.error("Error bulk updating clients:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update clients"));
    }
  }

  static async bulkDeleteClients(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { client_ids } = req.body;
      const teamId = (req.user as any)?.team_id;

      if (
        !client_ids ||
        !Array.isArray(client_ids) ||
        client_ids.length === 0
      ) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invalid client IDs provided"));
      }

      // Verify all clients belong to the team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      if (clientCheck.rows.length !== client_ids.length) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Some clients not found or not accessible"
            )
          );
      }

      // Deactivate all clients instead of deleting (soft delete)
      const deactivateResult = await db.query(
        "UPDATE clients SET status = 'inactive', updated_at = NOW() WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      // Also deactivate all client users for these clients
      await db.query(
        "UPDATE client_users SET status = 'inactive' WHERE client_id = ANY($1)",
        [client_ids]
      );

      // Deactivate client portal access for all clients
      await db.query(
        "UPDATE client_portal_access SET is_active = FALSE, updated_at = NOW() WHERE client_id = ANY($1)",
        [client_ids]
      );

      return res.json(
        new ServerResponse(
          true,
          { deactivated_count: deactivateResult.rowCount },
          "Clients deactivated successfully"
        )
      );
    } catch (error) {
      console.error("Error bulk deactivating clients:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to deactivate clients"));
    }
  }

  // Client Portal Authentication Endpoints
  // Validate invitation via vanity slug
  static async validateInvitationBySlug(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Invitation slug is required"));
      }

      // Get client by invite_slug
      const clientQuery = `
        SELECT c.id, c.name, c.email, c.company_name, c.status, c.invite_slug, t.name as team_name
        FROM clients c
        JOIN teams t ON c.team_id = t.id
        WHERE LOWER(c.invite_slug) = LOWER($1) AND c.status = 'pending'
      `;
      const clientResult = await db.query(clientQuery, [slug]);

      if (clientResult.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invalid invitation link"));
      }

      const client = clientResult.rows[0];

      // Return client details for the frontend (similar to token-based invitation)
      return res.json(
        new ServerResponse(
          true,
          {
            valid: true,
            email: client.email,
            clientId: client.id,
            clientName: client.name,
            companyName: client.company_name,
            teamName: client.team_name,
            inviteSlug: client.invite_slug,
            type: "vanity_url",
          },
          "Invitation is valid"
        )
      );
    } catch (error) {
      console.error("Error validating invitation by slug:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to validate invitation"));
    }
  }

  // Validate invitation via token (existing method - supports both old hex tokens and new base62 tokens)
  static async validateInvitation(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { token } = req.query;

      if (!token) {
        return res
          .status(400)
          .json(
            new ServerResponse(false, null, "Invitation token is required")
          );
      }

      // Get invitation details (TokenService handles both old hex and new base62 tokens)
      const invitation = await TokenService.getInvitationByToken(
        token as string
      );

      if (!invitation) {
        return res
          .status(404)
          .json(
            new ServerResponse(false, null, "Invalid or expired invitation")
          );
      }

      // Return invitation details for the frontend
      return res.json(
        new ServerResponse(
          true,
          {
            valid: true,
            email: invitation.email,
            organizationName: invitation.team_name,
            id: invitation.id,
            name: invitation.name,
            role: invitation.role,
            clientName: invitation.client_name,
            companyName: invitation.company_name,
            teamName: invitation.team_name,
            expiresAt: invitation.expires_at,
            status: invitation.status,
            type: "token",
          },
          "Invitation is valid"
        )
      );
    } catch (error) {
      console.error("Error validating invitation:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to validate invitation"));
    }
  }

  static async acceptInvitation(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { token, password, name, email } = req.body;

      if (!token || !password || !name) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Token, password, and name are required"
            )
          );
      }

      // Check if this is an organization invite token
      if (TokenService.isOrganizationInviteToken(token)) {
        const orgInvitePayload =
          TokenService.verifyOrganizationInviteToken(token);

        if (
          orgInvitePayload &&
          orgInvitePayload.type === "organization_invite"
        ) {
          // For organization invites, email is required
          if (!email) {
            return res
              .status(400)
              .json(
                new ServerResponse(
                  false,
                  null,
                  "Email is required for organization invites"
                )
              );
          }

          // For organization invites, create a new client user account
          // First, check if user already exists
          const existingUserCheck = await db.query(
            "SELECT id FROM client_users WHERE LOWER(email) = LOWER($1)",
            [email]
          );

          if (existingUserCheck.rows.length > 0) {
            return res.status(400).json({
              done: false,
              body: null,
              title: "Email Already Registered",
              message:
                "A user with this email already exists. Please login instead.",
              messageKey: "errors.email_already_registered_message", // For frontend i18n
            });
          }

          // Check if email exists in Worklenz users table for linking
          const existingWorklenzUserQuery = `
            SELECT id, email, name, password FROM users
            WHERE LOWER(email) = LOWER($1)
          `;
          const existingWorklenzUserResult = await db.query(
            existingWorklenzUserQuery,
            [email]
          );

          let worklenzUserId = null;
          if (existingWorklenzUserResult.rows.length > 0) {
            // User already exists in Worklenz - verify their Worklenz password before linking
            const worklenzUser = existingWorklenzUserResult.rows[0];
            const passwordMatch = bcrypt.compareSync(
              password,
              worklenzUser.password
            );

            if (!passwordMatch) {
              return res.status(401).json({
                done: false,
                body: { isWorklenzUser: true },
                titleKey: "errors.worklenz_account_found_title",
                messageKey: "errors.worklenz_account_found_message",
              });
            }

            worklenzUserId = worklenzUser.id;
          }

          // Create a client record for this organization
          const clientResult = await db.query(
            `INSERT INTO clients (name, email, team_id, status, client_portal_enabled, created_at, updated_at)
           VALUES ($1, $2, $3, 'active', TRUE, NOW(), NOW())
           RETURNING id`,
            [name, email, orgInvitePayload.teamId]
          );

          const clientId = clientResult.rows[0].id;

          // Create the client user - link to Worklenz user if exists, otherwise use password_hash
          // Check if email already exists in client_users to avoid duplicate key error
          const emailExistsCheck = await db.query(
            `SELECT id FROM client_users WHERE LOWER(email) = LOWER($1)`,
            [email]
          );

          let userResult;
          if (emailExistsCheck.rows.length > 0) {
            // Email already exists - update the existing record
            const existingClientUserId = emailExistsCheck.rows[0].id;
            if (worklenzUserId) {
              await db.query(
                `UPDATE client_users 
                 SET user_id = $1, client_id = $2, name = $3, status = 'active', updated_at = NOW()
                 WHERE id = $4`,
                [worklenzUserId, clientId, name, existingClientUserId]
              );
            } else {
              await db.query(
                `UPDATE client_users 
                 SET client_id = $1, name = $2, password_hash = $3, status = 'active', updated_at = NOW()
                 WHERE id = $4`,
                [
                  clientId,
                  name,
                  crypto.createHash("sha256").update(password).digest("hex"),
                  existingClientUserId,
                ]
              );
            }
            userResult = await db.query(
              `SELECT id, email, name, role, client_id FROM client_users WHERE id = $1`,
              [existingClientUserId]
            );
          } else if (worklenzUserId) {
            // Link to existing Worklenz user - they will authenticate with their Worklenz password
            userResult = await db.query(
              `INSERT INTO client_users (id, client_id, user_id, email, name, role, status, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'member', 'active', NOW())
             RETURNING id, email, name, role, client_id`,
              [clientId, worklenzUserId, email, name]
            );
          } else {
            // Standalone client portal user - create with password_hash
            userResult = await db.query(
              `INSERT INTO client_users (id, client_id, email, name, password_hash, role, status, created_at)
             VALUES (gen_random_uuid(), $1, $2, $3, $4, 'member', 'active', NOW())
             RETURNING id, email, name, role, client_id`,
              [
                clientId,
                email,
                name,
                crypto.createHash("sha256").update(password).digest("hex"),
              ]
            );
          }

          const newUser = userResult.rows[0];

          // Generate client access token
          const permissions = await TokenService.getClientPermissions(clientId);
          const tokenPayload = {
            clientId,
            organizationId: orgInvitePayload.teamId,
            email: newUser.email,
            permissions,
            type: "client" as const,
          };

          const accessToken = TokenService.generateClientToken(tokenPayload);

          return res.json(
            new ServerResponse(
              true,
              {
                token: accessToken,
                user: {
                  id: newUser.id,
                  email: newUser.email,
                  name: newUser.name,
                  role: newUser.role,
                  clientId,
                  clientName: name,
                  companyName: orgInvitePayload.organizationName,
                },
                expiresAt: new Date(
                  Date.now() + 24 * 60 * 60 * 1000
                ).toISOString(),
              },
              "Account created successfully"
            )
          );
        }
      }

      // Regular invitation flow
      const invitation = await TokenService.getInvitationByToken(token);

      if (!invitation) {
        return res
          .status(400)
          .json(
            new ServerResponse(false, null, "Invalid or expired invitation")
          );
      }

      // Check if user email exists in Worklenz users table
      const existingWorklenzUserQuery = `
        SELECT id, email, name, password FROM users
        WHERE LOWER(email) = LOWER($1)
      `;
      const existingWorklenzUserResult = await db.query(
        existingWorklenzUserQuery,
        [invitation.email]
      );

      let userId = null;
      if (existingWorklenzUserResult.rows.length > 0) {
        // User already exists in Worklenz - verify their Worklenz password before linking
        const worklenzUser = existingWorklenzUserResult.rows[0];
        const passwordMatch = bcrypt.compareSync(
          password,
          worklenzUser.password
        );

        if (!passwordMatch) {
          return res.status(401).json({
            done: false,
            body: { isWorklenzUser: true },
            titleKey: "errors.worklenz_account_found_title",
            messageKey: "errors.worklenz_account_found_message",
          });
        }

        userId = worklenzUser.id;
      }

      // Accept the invitation (will link if userId is provided, otherwise create password)
      const newUser = await TokenService.acceptInvitation(token, {
        password,
        name,
        userId,
      });

      // Send welcome email
      const portalLink = `${
        process.env.CLIENT_PORTAL_HOSTNAME
          ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`
          : "http://localhost:5174"
      }/login`;

      const emailHtml = ClientPortalController.generateWelcomeEmailHTML({
        userName: newUser.name,
        clientName: invitation.client_name,
        companyName: invitation.company_name,
        portalLink,
      });

      const emailRequest = new EmailRequest(
        [newUser.email],
        `Welcome to ${invitation.client_name} on Worklenz`,
        emailHtml
      );

      await sendEmail(emailRequest);

      // Generate client access token for automatic login
      const permissions = await TokenService.getClientPermissions(
        newUser.client_id
      );

      const tokenPayload = {
        clientId: newUser.client_id,
        organizationId: newUser.team_id,
        email: newUser.email,
        permissions,
        type: "client" as const,
      };

      const accessToken = TokenService.generateClientToken(tokenPayload);

      // Update last login
      await db.query(
        "UPDATE client_users SET last_login = NOW() WHERE id = $1",
        [newUser.id]
      );

      return res.json(
        new ServerResponse(
          true,
          {
            token: accessToken,
            user: {
              id: newUser.id,
              email: newUser.email,
              name: newUser.name,
              role: newUser.role,
              clientId: newUser.client_id,
              clientName: newUser.client_name,
              companyName: newUser.company_name,
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          },
          "Invitation accepted successfully"
        )
      );
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to accept invitation"));
    }
  }

  static async clientLogin(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res
          .status(400)
          .json(
            new ServerResponse(false, null, "Email and password are required")
          );
      }

      // Authenticate client user
      const clientUser = await TokenService.authenticateClient(email, password);

      if (!clientUser) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Invalid email or password"));
      }

      // Get all organizations accessible by this user
      const organizations = await TokenService.getClientUserOrganizations(
        clientUser.id
      );

      // Use default organization or first available
      const defaultOrg =
        organizations.find((org) => org.isDefault) || organizations[0];
      const organizationId = defaultOrg?.teamId || clientUser.team_id;
      const clientId = defaultOrg?.clientId || clientUser.client_id;

      // Generate client access token with organization information
      const tokenPayload = {
        clientId,
        organizationId,
        clientUserId: clientUser.id,
        email: clientUser.email,
        permissions: await TokenService.getClientPermissions(clientId),
        availableOrganizations: organizations,
        type: "client" as const,
      };

      const accessToken = TokenService.generateClientToken(tokenPayload);

      // Update last login and organization access
      await db.query(
        "UPDATE client_users SET last_login = NOW() WHERE id = $1",
        [clientUser.id]
      );

      if (defaultOrg) {
        await TokenService.updateOrganizationAccess(
          clientUser.id,
          organizationId
        );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            token: accessToken,
            user: {
              id: clientUser.id,
              email: clientUser.email,
              name: clientUser.name,
              role: clientUser.role,
              clientId,
              organizationId,
              clientName: clientUser.client_name,
              companyName: clientUser.company_name,
              organizations,
            },
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          "Login successful"
        )
      );
    } catch (error) {
      console.error("Error during client login:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Login failed"));
    }
  }

  static async refreshClientToken(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { token } = req.body;

      if (!token) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Token is required"));
      }

      // Verify the current token
      const decoded = TokenService.verifyClientToken(token);
      if (!decoded) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Invalid or expired token"));
      }

      // Generate new token with updated expiry
      const newToken = TokenService.generateClientToken({
        clientId: decoded.clientId,
        organizationId: decoded.organizationId,
        email: decoded.email,
        permissions: decoded.permissions || [],
        type: "client" as const,
      });

      return res.json(
        new ServerResponse(
          true,
          {
            token: newToken,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
          },
          "Token refreshed successfully"
        )
      );
    } catch (error) {
      console.error("Error refreshing client token:", error);
      return res
        .status(401)
        .json(new ServerResponse(false, null, "Token refresh failed"));
    }
  }

  static async clientLogout(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      // In a more complete implementation, you would invalidate the token
      // For now, we'll just return a success response
      return res.json(new ServerResponse(true, null, "Logout successful"));
    } catch (error) {
      console.error("Error during client logout:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Logout failed"));
    }
  }

  static async getClientOrganizations(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientUserId } = req as any;

      if (!clientUserId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client user ID not found"));
      }

      // Get all organizations accessible by this user
      const organizations = await TokenService.getClientUserOrganizations(
        clientUserId
      );

      return res.json(
        new ServerResponse(
          true,
          { organizations },
          "Organizations retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client organizations:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve organizations")
        );
    }
  }

  static async switchOrganization(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientUserId } = req as any;
      const { organizationId } = req.body;

      if (!clientUserId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client user ID not found"));
      }

      if (!organizationId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }

      // Verify user has access to this organization
      const hasAccess = await TokenService.hasOrganizationAccess(
        clientUserId,
        organizationId
      );

      if (!hasAccess) {
        return res
          .status(403)
          .json(
            new ServerResponse(
              false,
              null,
              "Access denied to this organization"
            )
          );
      }

      // Get client_id for this organization
      const clientId = await TokenService.getClientIdForOrganization(
        clientUserId,
        organizationId
      );

      if (!clientId) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Client not found for this organization"
            )
          );
      }

      // Get all organizations for token payload
      const organizations = await TokenService.getClientUserOrganizations(
        clientUserId
      );

      // Generate new token with updated organization
      const tokenPayload = {
        clientId,
        organizationId,
        clientUserId,
        email: (req as any).clientEmail || "",
        permissions: await TokenService.getClientPermissions(clientId),
        availableOrganizations: organizations,
        type: "client" as const,
      };

      const newToken = TokenService.generateClientToken(tokenPayload);

      // Update last accessed timestamp
      await TokenService.updateOrganizationAccess(clientUserId, organizationId);

      return res.json(
        new ServerResponse(
          true,
          {
            token: newToken,
            organizationId,
            clientId,
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          },
          "Organization switched successfully"
        )
      );
    } catch (error) {
      console.error("Error switching organization:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to switch organization"));
    }
  }

  static async getClientProfile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { clientEmail } = req;

      // Get client user details
      const query = `
        SELECT cu.*, c.name as client_name, c.company_name
        FROM client_users cu
        JOIN clients c ON cu.client_id = c.id
        WHERE cu.client_id = $1 AND cu.email = $2
      `;

      const result = await db.query(query, [clientId, clientEmail]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client profile not found"));
      }

      const clientUser = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: clientUser.id,
            email: clientUser.email,
            name: clientUser.name,
            role: clientUser.role,
            clientId: clientUser.client_id,
            clientName: clientUser.client_name,
            companyName: clientUser.company_name,
            createdAt: clientUser.created_at,
            lastLogin: clientUser.last_login,
          },
          "Client profile retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client profile:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client profile")
        );
    }
  }

  static async updateClientProfile(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { clientEmail } = req;
      const { name, currentPassword, newPassword } = req.body;

      if (!name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Name is required"));
      }

      // Get current client user
      const currentUser = await db.query(
        "SELECT * FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (currentUser.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client user not found"));
      }

      const user = currentUser.rows[0];
      const updateFields = ["name = $1", "updated_at = NOW()"];
      const updateValues = [name];
      let paramIndex = 2;

      // Handle password update if provided
      if (newPassword) {
        if (!currentPassword) {
          return res
            .status(400)
            .json(
              new ServerResponse(
                false,
                null,
                "Current password is required to set new password"
              )
            );
        }

        // Verify current password
        const crypto = require("crypto");
        const currentPasswordHash = crypto
          .createHash("sha256")
          .update(currentPassword)
          .digest("hex");

        if (currentPasswordHash !== user.password_hash) {
          return res
            .status(400)
            .json(
              new ServerResponse(false, null, "Current password is incorrect")
            );
        }

        // Hash new password
        const newPasswordHash = crypto
          .createHash("sha256")
          .update(newPassword)
          .digest("hex");
        updateFields.push(`password_hash = $${paramIndex}`);
        updateValues.push(newPasswordHash);
        paramIndex++;
      }

      // Update the user
      updateValues.push(user.id);
      const updateQuery = `
        UPDATE client_users 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING id, email, name, role, updated_at
      `;

      const result = await db.query(updateQuery, updateValues);
      const updatedUser = result.rows[0];

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedUser.id,
            email: updatedUser.email,
            name: updatedUser.name,
            role: updatedUser.role,
            updatedAt: updatedUser.updated_at,
          },
          "Profile updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating client profile:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update profile"));
    }
  }
}

export default ClientPortalController;
