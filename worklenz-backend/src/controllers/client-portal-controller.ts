import { ServerResponse } from "../models/server-response";
import db from "../config/db";
import TokenService from "../services/token-service";
import { sendEmail, EmailRequest } from "../shared/email";
import { AuthenticatedClientRequest } from "../middlewares/client-auth-middleware";
import FileConstants from "../shared/file-constants";
import { IEmailTemplateType } from "../interfaces/email-template-type";
import { getBaseUrl, getClientPortalBaseUrl } from "../cron_jobs/helpers";
import { uploadBase64, getClientPortalLogoKey } from "../shared/storage";
import { log_error } from "../shared/utils";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import crypto from "crypto";

class ClientPortalController {

  // Dashboard
  static async getDashboard(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;

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

      const requestStatsResult = await db.query(requestStatsQuery, [clientId, organizationId]);
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

      const invoiceStatsResult = await db.query(invoiceStatsQuery, [clientId, organizationId]);
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
        unpaidAmount: parseFloat(invoiceStats.unpaid_amount || "0")
      };

      return res.json(new ServerResponse(true, dashboardData, "Dashboard data retrieved successfully"));
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve dashboard data"));
    }
  }

  // Services
  static async getServices(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
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
          s.updated_at
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
        updatedAt: row.updated_at
      }));

      return res.json(new ServerResponse(true, services, "Services retrieved successfully"));
    } catch (error) {
      console.error("Error fetching services:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve services"));
    }
  }

  static async getServiceDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;

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
          s.updated_at
        FROM client_portal_services s
        WHERE s.id = $1 
        AND s.organization_team_id = $2
        AND s.status = 'active'
        AND (s.is_public = true OR $3 = ANY(s.allowed_client_ids))
      `;

      const result = await db.query(query, [id, organizationId, clientId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Service not found or not accessible"));
      }

      const service = result.rows[0];

      return res.json(new ServerResponse(true, {
        id: service.id,
        name: service.name,
        description: service.description,
        status: service.status,
        serviceData: service.service_data,
        isPublic: service.is_public,
        createdAt: service.created_at,
        updatedAt: service.updated_at
      }, "Service details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching service details:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve service details"));
    }
  }

  // Requests
  static async getRequests(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
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
        ${search ? `AND (r.req_no ILIKE $${status ? 4 : 3} OR s.name ILIKE $${status ? 4 : 3} OR r.notes ILIKE $${status ? 4 : 3})` : ""}
      `;
      const countParams = status && search ? [clientId, organizationId, status, `%${search}%`] : 
                         status ? [clientId, organizationId, status] : 
                         search ? [clientId, organizationId, `%${search}%`] : [clientId, organizationId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY r.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const requests = result.rows.map((row: any) => ({
        id: row.id,
        requestNumber: row.req_no,
        serviceId: row.service_id,
        serviceName: row.service_name,
        serviceDescription: row.service_description,
        status: row.status,
        requestData: row.request_data,
        notes: row.notes,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        clientName: row.client_name
      }));

      return res.json(new ServerResponse(true, { 
        requests, 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      }, "Requests retrieved successfully"));
    } catch (error) {
      console.error("Error fetching requests:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve requests"));
    }
  }

  static async createRequest(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
      const {clientEmail} = req;
      const { serviceId, requestData, notes } = req.body;

      // Validate required fields
      if (!serviceId) {
        return res.status(400).json(new ServerResponse(false, null, "Service ID is required"));
      }

      // Verify service exists and client has access
      const serviceCheck = await db.query(
        `SELECT id, name FROM client_portal_services 
         WHERE id = $1 AND organization_team_id = $2 
         AND (is_public = true OR $3 = ANY(allowed_client_ids))`,
        [serviceId, organizationId, clientId]
      );

      if (serviceCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Service not found or not accessible"));
      }

      // Generate request number
      const requestNumber = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

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
        notes || null
      ];

      const result = await db.query(query, values);
      const newRequest = result.rows[0];

      // Get service name for response
      const service = serviceCheck.rows[0];

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
      return res.status(500).json(new ServerResponse(false, null, "Failed to create request"));
    }
  }

  static async getRequestDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;

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
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      const request = result.rows[0];

      return res.json(new ServerResponse(true, {
        id: request.id,
        requestNumber: request.req_no,
        serviceId: request.service_id,
        serviceName: request.service_name,
        serviceDescription: request.service_description,
        serviceConfig: request.service_config,
        status: request.status,
        requestData: request.request_data,
        notes: request.notes,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        completedAt: request.completed_at,
        clientName: request.client_name
      }, "Request details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching request details:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve request details"));
    }
  }

  static async updateRequest(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;
      const { requestData, notes } = req.body;

      // Verify request exists and belongs to client
      const requestCheck = await db.query(
        "SELECT id, status FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      const currentRequest = requestCheck.rows[0];

      // Only allow updates if request is in pending status
      if (currentRequest.status !== "pending") {
        return res.status(400).json(new ServerResponse(false, null, "Cannot update request after it has been accepted"));
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
        return res.status(400).json(new ServerResponse(false, null, "No valid fields to update"));
      }

      updateFields.push(`updated_at = NOW()`);
      updateValues.push(id, clientId, organizationId);

      const query = `
        UPDATE client_portal_requests 
        SET ${updateFields.join(", ")}
        WHERE id = $${paramIndex} AND client_id = $${paramIndex + 1} AND organization_team_id = $${paramIndex + 2}
        RETURNING id, req_no, service_id, status, request_data, notes, created_at, updated_at
      `;

      const result = await db.query(query, updateValues);
      
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      const updatedRequest = result.rows[0];

      return res.json(new ServerResponse(true, {
        id: updatedRequest.id,
        requestNumber: updatedRequest.req_no,
        serviceId: updatedRequest.service_id,
        status: updatedRequest.status,
        requestData: updatedRequest.request_data,
        notes: updatedRequest.notes,
        createdAt: updatedRequest.created_at,
        updatedAt: updatedRequest.updated_at
      }, "Request updated successfully"));
    } catch (error) {
      console.error("Error updating request:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update request"));
    }
  }

  static async deleteRequest(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;

      // Verify request exists and belongs to client
      const requestCheck = await db.query(
        "SELECT id, status FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (requestCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      const currentRequest = requestCheck.rows[0];

      // Only allow deletion if request is in pending status
      if (currentRequest.status !== "pending") {
        return res.status(400).json(new ServerResponse(false, null, "Cannot delete request after it has been accepted"));
      }

      // Delete the request
      const deleteResult = await db.query(
        "DELETE FROM client_portal_requests WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (deleteResult.rowCount === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Request not found"));
      }

      return res.json(new ServerResponse(true, null, "Request deleted successfully"));
    } catch (error) {
      console.error("Error deleting request:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to delete request"));
    }
  }

  // Request Status Options
  static async getRequestStatusOptions(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const statusOptions = [
        { value: "pending", label: "Pending", description: "Request is waiting for review", color: "#faad14" },
        { value: "accepted", label: "Accepted", description: "Request has been accepted and will be processed", color: "#52c41a" },
        { value: "in_progress", label: "In Progress", description: "Request is currently being worked on", color: "#1890ff" },
        { value: "completed", label: "Completed", description: "Request has been completed successfully", color: "#52c41a" },
        { value: "rejected", label: "Rejected", description: "Request has been rejected", color: "#f5222d" }
      ];

      return res.json(new ServerResponse(true, statusOptions, "Request status options retrieved successfully"));
    } catch (error) {
      console.error("Error fetching request status options:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve request status options"));
    }
  }

  // Projects
  static async getProjects(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const teamId = (req.user as any)?.team_id;
      const { page = 1, limit = 10, status, search } = req.query;

      // Build query with pagination and filtering
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
        WHERE p.team_id = $1
      `;

      const queryParams = [teamId];
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
        WHERE p.team_id = $1
        ${status ? "AND sps.name = $2" : ""}
        ${search ? `AND (p.name ILIKE $${status ? 3 : 2} OR p.notes ILIKE $${status ? 3 : 2})` : ""}
      `;
      const countParams = status && search ? [teamId, status, `%${search}%`] : 
                         status ? [teamId, status] : 
                         search ? [teamId, `%${search}%`] : [teamId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
        completed_tasks: parseInt(row.completed_tasks || "0")
      }));

      return res.json(new ServerResponse(true, { 
        projects, 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      }, "Projects retrieved successfully"));
    } catch (error) {
      console.error("Error fetching projects:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve projects"));
    }
  }

  static async getProjectDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;

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
        return res.status(404).json(new ServerResponse(false, null, "Project not found or not accessible"));
      }

      const project = result.rows[0];

      // Get project team members
      const teamQuery = `
        SELECT 
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.avatar_url,
          pmu.role_id,
          r.name as role_name
        FROM project_members_users pmu
        JOIN users u ON pmu.user_id = u.id
        LEFT JOIN roles r ON pmu.role_id = r.id
        WHERE pmu.project_id = $1
        ORDER BY u.first_name, u.last_name
      `;

      const teamResult = await db.query(teamQuery, [id]);
      const teamMembers = teamResult.rows.map((row: any) => ({
        id: row.id,
        firstName: row.first_name,
        lastName: row.last_name,
        fullName: `${row.first_name} ${row.last_name}`,
        email: row.email,
        avatarUrl: row.avatar_url,
        roleId: row.role_id,
        roleName: row.role_name
      }));

      // Get recent project tasks (limited view for client)
      const tasksQuery = `
        SELECT 
          t.id,
          t.name,
          t.description,
          ts.name as status,
          ts.color_code as status_color,
          t.start_date,
          t.end_date,
          t.created_at,
          t.updated_at,
          COUNT(tc.id) as comment_count
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        LEFT JOIN task_comments tc ON t.id = tc.task_id
        WHERE t.project_id = $1
        GROUP BY t.id, t.name, t.description, ts.name, ts.color_code, t.start_date, t.end_date, t.created_at, t.updated_at
        ORDER BY t.created_at DESC
        LIMIT 20
      `;

      const tasksResult = await db.query(tasksQuery, [id]);
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
        commentCount: parseInt(row.comment_count || "0")
      }));

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
        client: {
          name: project.client_name,
          companyName: project.company_name
        },
        statistics: {
          totalTasks: parseInt(project.total_tasks || "0"),
          completedTasks: parseInt(project.completed_tasks || "0"),
          progressPercentage: project.total_tasks > 0 ? Math.round((project.completed_tasks / project.total_tasks) * 100) : 0
        },
        teamMembers,
        recentTasks: tasks
      };

      return res.json(new ServerResponse(true, projectDetails, "Project details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching project details:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve project details"));
    }
  }

  // Invoices
  static async getInvoices(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
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
        ${search ? `AND (i.invoice_no ILIKE $${status ? 4 : 3} OR s.name ILIKE $${status ? 4 : 3})` : ""}
      `;
      const countParams = status && search ? [clientId, organizationId, status, `%${search}%`] : 
                         status ? [clientId, organizationId, status] : 
                         search ? [clientId, organizationId, `%${search}%`] : [clientId, organizationId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
        isOverdue: row.due_date && new Date(row.due_date) < new Date() && row.status !== 'paid'
      }));

      return res.json(new ServerResponse(true, { 
        invoices, 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      }, "Invoices retrieved successfully"));
    } catch (error) {
      console.error("Error fetching invoices:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve invoices"));
    }
  }

  static async getInvoiceDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;

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
          u.first_name as created_by_first_name,
          u.last_name as created_by_last_name
        FROM client_portal_invoices i
        LEFT JOIN client_portal_requests r ON i.request_id = r.id
        LEFT JOIN client_portal_services s ON r.service_id = s.id
        LEFT JOIN clients c ON i.client_id = c.id
        LEFT JOIN users u ON i.created_by_user_id = u.id
        WHERE i.id = $1 AND i.client_id = $2 AND i.organization_team_id = $3
      `;

      const result = await db.query(query, [id, clientId, organizationId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Invoice not found"));
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
        isOverdue: invoice.due_date && new Date(invoice.due_date) < new Date() && invoice.status !== 'paid',
        request: invoice.request_id ? {
          id: invoice.request_id,
          requestNumber: invoice.request_number,
          requestData: invoice.request_data,
          notes: invoice.request_notes,
          service: {
            id: invoice.service_id,
            name: invoice.service_name,
            description: invoice.service_description
          }
        } : null,
        client: {
          name: invoice.client_name,
          companyName: invoice.company_name,
          email: invoice.client_email
        },
        createdBy: invoice.created_by_first_name ? {
          name: `${invoice.created_by_first_name} ${invoice.created_by_last_name}`
        } : null
      };

      return res.json(new ServerResponse(true, invoiceDetails, "Invoice details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve invoice details"));
    }
  }

  static async payInvoice(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;
      const { paymentMethod, transactionId, notes } = req.body;

      // Verify invoice exists and belongs to client
      const invoiceCheck = await db.query(
        "SELECT id, status, amount FROM client_portal_invoices WHERE id = $1 AND client_id = $2 AND organization_team_id = $3",
        [id, clientId, organizationId]
      );

      if (invoiceCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Invoice not found"));
      }

      const invoice = invoiceCheck.rows[0];

      // Check if invoice is already paid
      if (invoice.status === 'paid') {
        return res.status(400).json(new ServerResponse(false, null, "Invoice is already paid"));
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
        paidAt: updatedInvoice.paid_at
      });

      return res.json(new ServerResponse(true, {
        id: updatedInvoice.id,
        invoiceNumber: updatedInvoice.invoice_no,
        amount: parseFloat(updatedInvoice.amount || "0"),
        currency: updatedInvoice.currency,
        status: updatedInvoice.status,
        paidAt: updatedInvoice.paid_at,
        updatedAt: updatedInvoice.updated_at
      }, "Invoice paid successfully"));
    } catch (error) {
      console.error("Error paying invoice:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to pay invoice"));
    }
  }

  static async downloadInvoice(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;
      const { format = 'pdf' } = req.query;

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

      const result = await db.query(invoiceQuery, [id, clientId, organizationId]);
      
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Invoice not found"));
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
          address: invoice.client_address
        },
        service: {
          name: invoice.service_name,
          description: invoice.service_description
        },
        requestNumber: invoice.request_number
      };

      // TODO: Generate actual PDF/document using a library like puppeteer or jsPDF
      // For now, return the data that would be used for PDF generation
      return res.json(new ServerResponse(true, {
        downloadUrl: `/api/client-portal/invoices/${id}/download?format=${format}`,
        format,
        invoiceData,
        message: "Invoice download link generated"
      }, "Invoice download initiated"));
    } catch (error) {
      console.error("Error downloading invoice:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to download invoice"));
    }
  }

  // Chat
  static async getChats(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
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
      const result = await db.query(query, [clientId, organizationId, Number(limit), offset]);

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT DATE(created_at)) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2
      `;
      const countResult = await db.query(countQuery, [clientId, organizationId]);
      const total = parseInt(countResult.rows[0]?.total || "0");

      const chats = result.rows.map((row: any) => ({
        date: row.chat_date,
        messageCount: parseInt(row.message_count || "0"),
        lastMessageAt: row.last_message_at,
        lastTeamMessageAt: row.last_team_message_at,
        unreadCount: parseInt(row.unread_count || "0"),
        hasNewMessages: row.unread_count > 0
      }));

      return res.json(new ServerResponse(true, {
        chats,
        total,
        page: Number(page),
        limit: Number(limit)
      }, "Chats retrieved successfully"));
    } catch (error) {
      console.error("Error fetching chats:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve chats"));
    }
  }

  static async getChatDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params; // This would be the date in format YYYY-MM-DD
      const {clientId} = req;
      const {organizationId} = req;
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
            WHEN m.sender_type = 'team_member' THEN u.first_name || ' ' || u.last_name
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
      const result = await db.query(query, [clientId, organizationId, id, Number(limit), offset]);

      // Get total count for the date
      const countQuery = `
        SELECT COUNT(*) as total
        FROM client_portal_chat_messages
        WHERE client_id = $1 AND organization_team_id = $2 AND DATE(created_at) = $3
      `;
      const countResult = await db.query(countQuery, [clientId, organizationId, id]);
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
        isFromClient: row.sender_type === 'client'
      }));

      // Mark messages as read (for client user)
      await db.query(
        "UPDATE client_portal_chat_messages SET read_at = NOW() WHERE client_id = $1 AND organization_team_id = $2 AND DATE(created_at) = $3 AND sender_type = 'team_member' AND read_at IS NULL",
        [clientId, organizationId, id]
      );

      return res.json(new ServerResponse(true, {
        date: id,
        messages,
        total,
        page: Number(page),
        limit: Number(limit)
      }, "Chat details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching chat details:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve chat details"));
    }
  }

  static async sendMessage(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
      const {clientEmail} = req;
      const { message, messageType = 'text', fileUrl } = req.body;

      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "Message content is required"));
      }

      // Get client user ID
      const clientUserQuery = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (clientUserQuery.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client user not found"));
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
        'client',
        clientUserId,
        message.trim(),
        messageType,
        fileUrl || null
      ]);

      const newMessage = result.rows[0];

      return res.json(new ServerResponse(true, {
        id: newMessage.id,
        senderType: newMessage.sender_type,
        senderId: newMessage.sender_id,
        message: newMessage.message,
        messageType: newMessage.message_type,
        fileUrl: newMessage.file_url,
        createdAt: newMessage.created_at,
        isFromClient: true
      }, "Message sent successfully"));
    } catch (error) {
      console.error("Error sending message:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to send message"));
    }
  }

  static async getMessages(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
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
            WHEN m.sender_type = 'team_member' THEN u.first_name || ' ' || u.last_name
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

      query += ` ORDER BY m.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
        isFromClient: row.sender_type === 'client'
      }));

      return res.json(new ServerResponse(true, {
        messages: messages.reverse(), // Reverse to show oldest first
        total,
        page: Number(page),
        limit: Number(limit)
      }, "Messages retrieved successfully"));
    } catch (error) {
      console.error("Error fetching messages:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve messages"));
    }
  }

  // Settings
  static async getSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const organizationTeamId = req.user?.organization_team_id || req.user?.team_id;
      if (!organizationTeamId) {
        return res.status(400).json(new ServerResponse(false, null, "Organization team ID not found"));
      }

      const q = `
        SELECT id, team_id, organization_team_id, logo_url, primary_color, 
               welcome_message, contact_email, contact_phone, terms_of_service, 
               privacy_policy, created_at, updated_at
        FROM client_portal_settings 
        WHERE organization_team_id = $1
      `;
      
      const result = await db.query(q, [organizationTeamId]);
      const settings = result.rows[0] || {
        organization_team_id: organizationTeamId,
        logo_url: null,
        primary_color: '#3b7ad4',
        welcome_message: null,
        contact_email: null,
        contact_phone: null,
        terms_of_service: null,
        privacy_policy: null
      };

      return res.json(new ServerResponse(true, settings, null));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve settings"));
    }
  }

  static async updateSettings(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const organizationTeamId = req.user?.organization_team_id || req.user?.team_id;
      const teamId = req.user?.team_id;
      
      if (!organizationTeamId || !teamId) {
        return res.status(400).json(new ServerResponse(false, null, "Team ID not found"));
      }

      const {
        logo_url,
        primary_color,
        welcome_message,
        contact_email,
        contact_phone,
        terms_of_service,
        privacy_policy
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
              privacy_policy = $7, updated_at = CURRENT_TIMESTAMP
          WHERE organization_team_id = $8
          RETURNING *
        `;
        result = await db.query(updateQ, [
          logo_url, primary_color, welcome_message, contact_email,
          contact_phone, terms_of_service, privacy_policy, organizationTeamId
        ]);
      } else {
        // Create new settings
        const insertQ = `
          INSERT INTO client_portal_settings 
          (team_id, organization_team_id, logo_url, primary_color, welcome_message, 
           contact_email, contact_phone, terms_of_service, privacy_policy)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
          RETURNING *
        `;
        result = await db.query(insertQ, [
          teamId, organizationTeamId, logo_url, primary_color, welcome_message,
          contact_email, contact_phone, terms_of_service, privacy_policy
        ]);
      }

      return res.json(new ServerResponse(true, result.rows[0], "Settings updated successfully"));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update settings"));
    }
  }

  static async uploadLogo(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const organizationTeamId = req.user?.organization_team_id || req.user?.team_id;
      if (!organizationTeamId) {
        return res.status(400).json(new ServerResponse(false, null, "Organization team ID not found"));
      }

      const { logoData } = req.body;
      if (!logoData) {
        return res.status(400).json(new ServerResponse(false, null, "Logo data is required"));
      }

      // Extract file type from base64 data
      const mimeMatch = logoData.match(/^data:(image\/[a-z]+);base64,/);
      if (!mimeMatch) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid image format"));
      }

      const mimeType = mimeMatch[1];
      const fileExtension = mimeType.split('/')[1];
      
      // Generate storage key
      const storageKey = getClientPortalLogoKey(organizationTeamId, fileExtension);
      
      // Upload to storage
      const logoUrl = await uploadBase64(logoData, storageKey);
      if (!logoUrl) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to upload logo"));
      }

      // Update database with logo URL
      const teamId = req.user?.team_id;
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

      return res.json(new ServerResponse(true, { logo_url: logoUrl }, "Logo uploaded successfully"));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to upload logo"));
    }
  }

  // Profile
  static async getProfile(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {clientEmail} = req;

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
        return res.status(404).json(new ServerResponse(false, null, "Profile not found"));
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
          createdAt: profileData.client_created_at
        },
        user: profileData.user_id ? {
          id: profileData.user_id,
          name: profileData.user_name,
          email: profileData.user_email,
          role: profileData.user_role,
          status: profileData.user_status,
          createdAt: profileData.user_created_at,
          lastLogin: profileData.last_login
        } : null,
        statistics: {
          projectCount: parseInt(stats.project_count || "0"),
          requestCount: parseInt(stats.request_count || "0"),
          invoiceCount: parseInt(stats.invoice_count || "0"),
          unpaidInvoiceCount: parseInt(stats.unpaid_invoice_count || "0")
        }
      };

      return res.json(new ServerResponse(true, profile, "Profile retrieved successfully"));
    } catch (error) {
      console.error("Error fetching profile:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve profile"));
    }
  }

  static async updateProfile(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {clientEmail} = req;
      const { 
        clientName, 
        clientPhone, 
        clientAddress, 
        contactPerson,
        userName, 
        currentPassword, 
        newPassword 
      } = req.body;

      // Validate at least one field is provided
      if (!clientName && !clientPhone && !clientAddress && !contactPerson && !userName && !newPassword) {
        return res.status(400).json(new ServerResponse(false, null, "No valid fields to update"));
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

          const clientResult = await db.query(clientUpdateQuery, clientUpdateValues);
          if (clientResult.rows.length > 0) {
            updates.push('client');
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
          return res.status(404).json(new ServerResponse(false, null, "Client user not found"));
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
            return res.status(400).json(new ServerResponse(false, null, "Current password is required to set new password"));
          }

          // Verify current password
          const crypto = require("crypto");
          const currentPasswordHash = crypto.createHash("sha256").update(currentPassword).digest("hex");
          
          if (currentPasswordHash !== currentUser.password_hash) {
            return res.status(400).json(new ServerResponse(false, null, "Current password is incorrect"));
          }

          // Hash new password
          const newPasswordHash = crypto.createHash("sha256").update(newPassword).digest("hex");
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
            updates.push('user');
            userUpdates.push(userResult.rows[0]);
          }
        }
      }

      if (updates.length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "No updates were made"));
      }

      return res.json(new ServerResponse(true, {
        updatedSections: updates,
        client: clientUpdates.length > 0 ? clientUpdates[0] : null,
        user: userUpdates.length > 0 ? {
          id: userUpdates[0].id,
          name: userUpdates[0].name,
          email: userUpdates[0].email,
          role: userUpdates[0].role,
          updatedAt: userUpdates[0].updated_at
        } : null
      }, "Profile updated successfully"));
    } catch (error) {
      console.error("Error updating profile:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update profile"));
    }
  }

  // Notifications
  static async getNotifications(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
      const { page = 1, limit = 20, unread_only = false } = req.query;

      // Since there's no dedicated notifications table, we'll aggregate activities that would be notifications
      const notifications = [];

      // Get request status updates
      const requestNotificationsQuery = `
        SELECT 
          'request_update' as type,
          r.id as reference_id,
          r.req_no as reference_number,
          r.status,
          r.updated_at as created_at,
          s.name as service_name,
          'Request ' || r.req_no || ' status changed to ' || r.status as message,
          false as is_read
        FROM client_portal_requests r
        JOIN client_portal_services s ON r.service_id = s.id
        WHERE r.client_id = $1 AND r.organization_team_id = $2
        AND r.updated_at >= NOW() - INTERVAL '30 days'
        ORDER BY r.updated_at DESC
        LIMIT $3
      `;

      const requestResult = await db.query(requestNotificationsQuery, [
        clientId, 
        organizationId, 
        Number(limit)
      ]);

      notifications.push(...requestResult.rows.map((row: any) => ({
        id: `request_${row.reference_id}`,
        type: row.type,
        referenceId: row.reference_id,
        referenceNumber: row.reference_number,
        title: `Request Update`,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
        metadata: {
          serviceName: row.service_name,
          status: row.status
        }
      })));

      // Get new invoice notifications
      const invoiceNotificationsQuery = `
        SELECT 
          'new_invoice' as type,
          i.id as reference_id,
          i.invoice_no as reference_number,
          i.amount,
          i.currency,
          i.due_date,
          i.created_at,
          'New invoice ' || i.invoice_no || ' for ' || i.currency || ' ' || i.amount as message,
          false as is_read
        FROM client_portal_invoices i
        WHERE i.client_id = $1 AND i.organization_team_id = $2
        AND i.created_at >= NOW() - INTERVAL '30 days'
        ORDER BY i.created_at DESC
        LIMIT $3
      `;

      const invoiceResult = await db.query(invoiceNotificationsQuery, [
        clientId, 
        organizationId, 
        Number(limit)
      ]);

      notifications.push(...invoiceResult.rows.map((row: any) => ({
        id: `invoice_${row.reference_id}`,
        type: row.type,
        referenceId: row.reference_id,
        referenceNumber: row.reference_number,
        title: `New Invoice`,
        message: row.message,
        isRead: row.is_read,
        createdAt: row.created_at,
        metadata: {
          amount: parseFloat(row.amount || "0"),
          currency: row.currency,
          dueDate: row.due_date
        }
      })));

      // Get new chat messages as notifications
      const chatNotificationsQuery = `
        SELECT 
          'new_message' as type,
          m.id as reference_id,
          DATE(m.created_at)::text as reference_number,
          m.message,
          m.created_at,
          u.first_name || ' ' || u.last_name as sender_name,
          'New message from ' || u.first_name || ' ' || u.last_name as notification_message,
          CASE WHEN m.read_at IS NULL THEN false ELSE true END as is_read
        FROM client_portal_chat_messages m
        LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
        WHERE m.client_id = $1 AND m.organization_team_id = $2
        AND m.sender_type = 'team_member'
        AND m.created_at >= NOW() - INTERVAL '7 days'
        ORDER BY m.created_at DESC
        LIMIT $3
      `;

      const chatResult = await db.query(chatNotificationsQuery, [
        clientId, 
        organizationId, 
        Math.floor(Number(limit) / 2) // Limit chat notifications
      ]);

      notifications.push(...chatResult.rows.map((row: any) => ({
        id: `message_${row.reference_id}`,
        type: row.type,
        referenceId: row.reference_id,
        referenceNumber: row.reference_number,
        title: `New Message`,
        message: row.notification_message,
        isRead: row.is_read,
        createdAt: row.created_at,
        metadata: {
          senderName: row.sender_name,
          messagePreview: row.message.substring(0, 100)
        }
      })));

      // Sort all notifications by creation date
      notifications.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      // Filter unread only if requested
      const filteredNotifications = String(unread_only) === 'true'
        ? notifications.filter(n => !n.isRead) 
        : notifications;

      // Paginate
      const offset = (Number(page) - 1) * Number(limit);
      const paginatedNotifications = filteredNotifications.slice(offset, offset + Number(limit));

      return res.json(new ServerResponse(true, {
        notifications: paginatedNotifications,
        total: filteredNotifications.length,
        unreadCount: notifications.filter(n => !n.isRead).length,
        page: Number(page),
        limit: Number(limit)
      }, "Notifications retrieved successfully"));
    } catch (error) {
      console.error("Error fetching notifications:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve notifications"));
    }
  }

  static async markNotificationRead(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const {clientId} = req;
      const {organizationId} = req;

      // Parse notification ID to determine type and reference
      const [type, referenceId] = id.split('_');

      if (!type || !referenceId) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid notification ID"));
      }

      let updateResult;

      switch (type) {
        case 'message':
          // Mark chat message as read
          updateResult = await db.query(
            "UPDATE client_portal_chat_messages SET read_at = NOW() WHERE id = $1 AND client_id = $2 AND organization_team_id = $3 AND sender_type = 'team_member'",
            [referenceId, clientId, organizationId]
          );
          break;

        case 'request':
        case 'invoice':
          // For request and invoice notifications, we'll simulate marking as read
          // In a full implementation, you'd have a separate notifications table
          updateResult = { rowCount: 1 }; // Simulate successful update
          break;

        default:
          return res.status(400).json(new ServerResponse(false, null, "Unknown notification type"));
      }

      if (updateResult.rowCount === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Notification not found or already read"));
      }

      return res.json(new ServerResponse(true, {
        id,
        type,
        referenceId,
        markedAt: new Date()
      }, "Notification marked as read"));
    } catch (error) {
      console.error("Error marking notification as read:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to mark notification as read"));
    }
  }

  static async markAllNotificationsRead(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;

      // Mark all unread chat messages as read
      const chatUpdateResult = await db.query(
        "UPDATE client_portal_chat_messages SET read_at = NOW() WHERE client_id = $1 AND organization_team_id = $2 AND sender_type = 'team_member' AND read_at IS NULL",
        [clientId, organizationId]
      );

      // In a full implementation with a notifications table, you would also update:
      // - Request notifications
      // - Invoice notifications
      // - Other notification types
      
      const markedCount = chatUpdateResult.rowCount || 0;

      return res.json(new ServerResponse(true, {
        markedCount,
        markedAt: new Date(),
        types: ['chat_messages']
      }, "All notifications marked as read"));
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to mark notifications as read"));
    }
  }

  // File upload
  static async uploadFile(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {organizationId} = req;
      const { fileData, fileName, fileType, purpose = 'general' } = req.body;

      // Validate required fields
      if (!fileData || !fileName) {
        return res.status(400).json(new ServerResponse(false, null, "File data and filename are required"));
      }

      // Validate file size (assuming base64 data)
      const fileSizeBytes = Math.floor((fileData.length * 3) / 4);
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit
      
      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).json(new ServerResponse(false, null, "File size exceeds 10MB limit"));
      }

      // Validate file type
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain', 'text/csv'
      ];

      if (fileType && !allowedTypes.includes(fileType)) {
        return res.status(400).json(new ServerResponse(false, null, "File type not allowed"));
      }

      // Extract file extension
      const fileExtension = fileName.substring(fileName.lastIndexOf('.'));
      
      // Generate unique filename
      const uniqueFileName = `client_${clientId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
      
      // Generate storage key based on purpose
      let storageKey;
      switch (purpose) {
        case 'avatar':
          storageKey = `client-portal/avatars/${organizationId}/${uniqueFileName}`;
          break;
        case 'document':
          storageKey = `client-portal/documents/${organizationId}/${clientId}/${uniqueFileName}`;
          break;
        case 'chat':
          storageKey = `client-portal/chat-files/${organizationId}/${clientId}/${uniqueFileName}`;
          break;
        default:
          storageKey = `client-portal/files/${organizationId}/${clientId}/${uniqueFileName}`;
      }

      try {
        // Upload to storage using existing uploadBase64 function
        const fileUrl = await uploadBase64(fileData, storageKey);
        
        if (!fileUrl) {
          return res.status(500).json(new ServerResponse(false, null, "Failed to upload file to storage"));
        }

        // Log file upload for audit purposes
        console.log(`File uploaded by client ${clientId}:`, {
          fileName,
          fileType,
          purpose,
          storageKey,
          fileSizeBytes
        });

        return res.json(new ServerResponse(true, {
          url: fileUrl,
          filename: uniqueFileName,
          originalName: fileName,
          fileType,
          purpose,
          size: fileSizeBytes,
          uploadedAt: new Date()
        }, "File uploaded successfully"));
      } catch (uploadError) {
        console.error("Error uploading file to storage:", uploadError);
        return res.status(500).json(new ServerResponse(false, null, "Failed to upload file to storage"));
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to upload file"));
    }
  }

  // Client Management Methods
  static async getClients(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { page = 1, limit = 10, search, status, sortBy, sortOrder } = req.query;
      
      // Build query with pagination and filtering
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
          COUNT(DISTINCT p.id) as assigned_projects_count
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
        whereConditions.push(`(c.name ILIKE $${queryParams.length + 1} OR c.email ILIKE $${queryParams.length + 1} OR c.company_name ILIKE $${queryParams.length + 1})`);
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
      const safeSortField = validSortFields.includes(sortField) ? sortField : "name";
      query += ` ORDER BY c.${safeSortField} ${sortDirection}`;

      // Get total count
      const countQuery = `
        SELECT COUNT(DISTINCT c.id) as total
        FROM clients c
        ${whereConditions.length > 0 ? `WHERE ${whereConditions.join(" AND ")}` : ""}
      `;

      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}`;
      queryParams.push(Number(limit), offset);

      const result = await db.query(query, queryParams);
      const clients = result.rows.map((row: any) => ({
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
        team_members: []
      }));



      return res.json(new ServerResponse(true, { 
        clients, 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      }, null));
    } catch (error) {
      console.error("Error fetching clients:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve clients"));
    }
  }

  static async createClient(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const clientData = req.body;
      const teamId = (req.user as any)?.team_id;

      // Validate required fields
      if (!clientData.name) {
        return res.status(400).json(new ServerResponse(false, null, "Client name is required"));
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
        teamId
      ];

      const result = await db.query(query, values);
      const newClient = result.rows[0];

      // Send invitation email if email is provided
      if (newClient.email) {
        try {
          const userId = (req.user as any)?.id;
          await ClientPortalController.sendClientInvitationEmail(newClient, teamId, userId);
        } catch (emailError) {
          console.error("Error sending client invitation email:", emailError);
          // Continue with client creation even if email fails
        }
      }

      return res.json(new ServerResponse(true, {
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
        team_members: []
      }, "Client created successfully"));
    } catch (error) {
      console.error("Error creating client:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create client"));
    }
  }

  static async generateClientInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { clientId } = req.body;
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      if (!userId || !teamId) {
        return res.status(401).json(new ServerResponse(false, null, "Authentication required"));
      }

      if (!clientId) {
        return res.status(400).json(new ServerResponse(false, null, "Client ID is required"));
      }

      // Handle organization-level invite
      if (clientId === 'organization') {
        return ClientPortalController.generateOrganizationInvitationLink(req, res);
      }

      // Get client information
      const clientQuery = `
        SELECT c.id, c.name, c.email, c.company_name, c.phone
        FROM clients c
        WHERE c.id = $1 AND c.team_id = $2
      `;
      const clientResult = await db.query(clientQuery, [clientId, teamId]);

      if (!clientResult.rows.length) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientResult.rows[0];

      // Check if this email already exists as a Worklenz user
      const existingUserQuery = `
        SELECT u.id, u.email, u.name 
        FROM users u 
        WHERE LOWER(u.email) = LOWER($1)
      `;
      const existingUserResult = await db.query(existingUserQuery, [client.email]);

      if (existingUserResult.rows.length > 0) {
        // User already exists in Worklenz - they should use existing login
        const existingUser = existingUserResult.rows[0];
        
        // Check if we need to link this user to the client portal
        const linkCheckQuery = `
          SELECT id FROM client_users 
          WHERE user_id = $1 AND client_id = $2
        `;
        const linkResult = await db.query(linkCheckQuery, [existingUser.id, client.id]);
        
        if (linkResult.rows.length === 0) {
          // Create the link between existing user and client portal
          const linkUserQuery = `
            INSERT INTO client_users (user_id, client_id, email, name, role, created_at)
            VALUES ($1, $2, $3, $4, 'member', NOW())
            ON CONFLICT (user_id, client_id) DO NOTHING
          `;
          await db.query(linkUserQuery, [existingUser.id, client.id, client.email, client.name]);
          
          // Update client status to active since user already exists
          const updateClientQuery = `
            UPDATE clients SET status = 'active', updated_at = NOW()
            WHERE id = $1 AND team_id = $2
          `;
          await db.query(updateClientQuery, [client.id, teamId]);
        }
        
        // Instead of generating invite token, return a different response
        return res.json(new ServerResponse(true, {
          isExistingUser: true,
          message: "This client is already a Worklenz user. They can access the client portal using their existing login credentials. Access has been automatically granted.",
          clientName: client.name,
          clientEmail: client.email,
          existingUser: existingUser,
          portalUrl: `${getClientPortalBaseUrl()}/login`
        }, "Client is existing Worklenz user - access granted"));
      }

      // Generate secure token for invitation for new users
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
      const inviteToken = TokenService.generateInviteToken({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy: userId,
        expiresAt,
        type: "invite"
      });

      // Create invitation record in database
      await TokenService.createInvitation({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy: userId,
        token: inviteToken
      });

      // Generate client portal link with secure token
      const portalLink = `${getClientPortalBaseUrl()}/invite?token=${inviteToken}`;

      return res.json(new ServerResponse(true, {
        invitationLink: portalLink,
        token: inviteToken,
        expiresAt: new Date(expiresAt).toISOString(),
        clientName: client.name,
        clientEmail: client.email
      }, "Invitation link generated successfully"));
    } catch (error) {
      console.error("Error generating client invitation link:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to generate invitation link"));
    }
  }

  static async generateOrganizationInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const userId = req.user?.id;
      const teamId = req.user?.team_id;

      if (!userId || !teamId) {
        return res.status(401).json(new ServerResponse(false, null, "Authentication required"));
      }

      // Get team information
      const teamQuery = `SELECT name FROM teams WHERE id = $1`;
      const teamResult = await db.query(teamQuery, [teamId]);
      const teamName = teamResult.rows[0]?.name || "Worklenz Team";

      // Generate secure token for organization invitation
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
      const inviteToken = TokenService.generateOrganizationInviteToken({
        teamId: teamId,
        type: "organization_invite",
        invitedBy: userId,
        expiresAt,
        organizationName: teamName
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
      
      await db.query(upsertQuery, [teamId, inviteToken, userId, new Date(expiresAt)]);

      // Generate organization portal link with secure token
      const portalLink = `${process.env.CLIENT_PORTAL_HOSTNAME ? `http://${process.env.CLIENT_PORTAL_HOSTNAME}` : "http://localhost:5174"}/organization-invite?token=${inviteToken}`;

      return res.json(new ServerResponse(true, {
        invitationLink: portalLink,
        token: inviteToken,
        expiresAt: new Date(expiresAt).toISOString(),
        organizationName: teamName
      }, "Organization invitation link generated successfully"));
    } catch (error) {
      console.error("Error generating organization invitation link:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to generate organization invitation link"));
    }
  }

  static async handleOrganizationInvite(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid invitation token"));
      }

      // Verify the organization invitation token
      const decoded = TokenService.verifyOrganizationInviteToken(token);
      
      if (!decoded) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid or expired invitation token"));
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
        return res.status(400).json(new ServerResponse(false, null, "Invalid or expired invitation"));
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
        const clientResult = await db.query(clientCheckQuery, [userId, invitation.team_id]);

        if (clientResult.rows.length > 0) {
          // User is already linked to this organization's client portal
          return res.json(new ServerResponse(true, {
            redirectTo: 'client-portal',
            message: 'You already have access to this organization\'s client portal'
          }));
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
          await db.query(createClientQuery, [clientId, invitation.team_id, user.name, user.email]);

          // Link user to client portal
          const linkUserQuery = `
            INSERT INTO client_users (user_id, client_id, email, name, role, created_at)
            VALUES ($1, $2, $3, $4, 'member', NOW())
          `;
          await db.query(linkUserQuery, [userId, clientId, user.email, user.name]);

          return res.json(new ServerResponse(true, {
            redirectTo: 'client-portal',
            message: 'Successfully linked to organization\'s client portal'
          }));
        }
      }

      // User is not authenticated - they need to login/register first
      return res.json(new ServerResponse(true, {
        redirectTo: 'login',
        message: 'Please login or create an account to accept the invitation',
        organizationName: invitation.organization_name
      }));

    } catch (error) {
      console.error("Error handling organization invitation:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to process organization invitation"));
    }
  }

  static async sendClientInvitationEmail(client: any, teamId: string, invitedBy: string) {
    try {
      // Get team information
      const teamQuery = `SELECT name FROM teams WHERE id = $1`;
      const teamResult = await db.query(teamQuery, [teamId]);
      const teamName = teamResult.rows[0]?.name || "Worklenz Team";

      // Generate secure token for invitation
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
      const inviteToken = TokenService.generateInviteToken({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy,
        expiresAt,
        type: "invite"
      });

      // Create invitation record in database
      await TokenService.createInvitation({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy,
        token: inviteToken
      });

      // Get the email template
      const template = FileConstants.getEmailTemplate(IEmailTemplateType.ClientInvitation) as string;
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
        html: emailContent
      });

      console.log(`Client invitation email sent to ${client.email}`);
    } catch (error) {
      console.error("Error sending client invitation email:", error);
      throw error;
    }
  }

  static async getClientById(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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
        assigned_projects_count: parseInt(client.assigned_projects_count || "0"),
        team_members: []
      };

      return res.json(new ServerResponse(true, clientData, "Client details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching client by ID:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client details"));
    }
  }

  static async getClientDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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
        completedTasks: parseInt(row.completed_tasks || "0")
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
        assigned_projects_count: parseInt(client.assigned_projects_count || "0"),
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
          unpaidInvoices: 0 // Placeholder
        },
        // Projects
        projects,
        // Team members (placeholder)
        team_members: []
      };

      return res.json(new ServerResponse(true, clientDetails, "Client details retrieved successfully"));
    } catch (error) {
      console.error("Error fetching comprehensive client details:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client details"));
    }
  }

  static async updateClient(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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
        return res.status(400).json(new ServerResponse(false, null, "No valid fields to update"));
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      const updatedClient = result.rows[0];

      return res.json(new ServerResponse(true, {
        id: updatedClient.id,
        name: updatedClient.name,
        email: updatedClient.email,
        company_name: updatedClient.company_name,
        phone: updatedClient.phone,
        address: updatedClient.address,
        status: updatedClient.status || "active",
        created_at: updatedClient.created_at,
        updated_at: updatedClient.updated_at
      }, "Client updated successfully"));
    } catch (error) {
      console.error("Error updating client:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update client"));
    }
  }

  static async deleteClient(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      // Check if client has any projects
      const projectCheck = await db.query(
        "SELECT COUNT(*) as project_count FROM projects WHERE client_id = $1",
        [id]
      );

      const projectCount = parseInt(projectCheck.rows[0]?.project_count || "0");
      if (projectCount > 0) {
        return res.status(400).json(new ServerResponse(false, null, "Cannot delete client with assigned projects"));
      }

      // Delete the client
      const deleteResult = await db.query(
        "DELETE FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (deleteResult.rowCount === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      return res.json(new ServerResponse(true, null, "Client deleted successfully"));
    } catch (error) {
      console.error("Error deleting client:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to delete client"));
    }
  }

  // Client Projects
  static async getClientProjects(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      // Build query with pagination and filtering
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
          COUNT(CASE WHEN ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done = true) THEN 1 END) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        LEFT JOIN tasks t ON p.id = t.project_id
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
      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
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
        completed_tasks: parseInt(row.completed_tasks || "0")
      }));

      return res.json(new ServerResponse(true, { 
        projects, 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      }, "Client projects retrieved successfully"));
    } catch (error) {
      console.error("Error fetching client projects:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client projects"));
    }
  }

  static async assignProjectToClient(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params; // client ID
      const { project_id } = req.body;
      const teamId = (req.user as any)?.team_id;

      // Validate required fields
      if (!project_id) {
        return res.status(400).json(new ServerResponse(false, null, "Project ID is required"));
      }

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      // Verify project exists and belongs to team
      const projectCheck = await db.query(
        "SELECT id, name, client_id FROM projects WHERE id = $1 AND team_id = $2",
        [project_id, teamId]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Project not found"));
      }

      const project = projectCheck.rows[0];
      const client = clientCheck.rows[0];

      // Check if project is already assigned to another client
      if (project.client_id && project.client_id !== id) {
        return res.status(400).json(new ServerResponse(false, null, "Project is already assigned to another client"));
      }

      // Check if project is already assigned to this client
      if (project.client_id === id) {
        return res.status(400).json(new ServerResponse(false, null, "Project is already assigned to this client"));
      }

      // Assign project to client
      const updateResult = await db.query(
        "UPDATE projects SET client_id = $1, updated_at = NOW() WHERE id = $2 RETURNING id, name, client_id, updated_at",
        [id, project_id]
      );

      if (updateResult.rowCount === 0) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to assign project to client"));
      }

      const updatedProject = updateResult.rows[0];

      return res.json(new ServerResponse(true, {
        projectId: updatedProject.id,
        projectName: updatedProject.name,
        clientId: updatedProject.client_id,
        clientName: client.name,
        assignedAt: updatedProject.updated_at
      }, "Project assigned to client successfully"));
    } catch (error) {
      console.error("Error assigning project to client:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to assign project to client"));
    }
  }

  static async removeProjectFromClient(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id, projectId } = req.params; // id = client ID, projectId = project ID
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      // Verify project exists, belongs to team, and is assigned to this client
      const projectCheck = await db.query(
        "SELECT id, name, client_id FROM projects WHERE id = $1 AND team_id = $2 AND client_id = $3",
        [projectId, teamId, id]
      );

      if (projectCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Project not found or not assigned to this client"));
      }

      const project = projectCheck.rows[0];
      const client = clientCheck.rows[0];

      // Remove project assignment (set client_id to null)
      const updateResult = await db.query(
        "UPDATE projects SET client_id = NULL, updated_at = NOW() WHERE id = $1 RETURNING id, name, updated_at",
        [projectId]
      );

      if (updateResult.rowCount === 0) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to remove project from client"));
      }

      const updatedProject = updateResult.rows[0];

      return res.json(new ServerResponse(true, {
        projectId: updatedProject.id,
        projectName: updatedProject.name,
        clientId: id,
        clientName: client.name,
        removedAt: updatedProject.updated_at
      }, "Project removed from client successfully"));
    } catch (error) {
      console.error("Error removing project from client:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to remove project from client"));
    }
  }

  // Client Team Management
  static async getClientTeam(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      // For now, return empty team since client team members are not implemented in the database
      // This would typically query a client_team_members table or similar
      const teamMembers: any[] = [];
      const total = 0;

      return res.json(new ServerResponse(true, { 
        team_members: teamMembers, 
        total, 
        page: Number(page), 
        limit: Number(limit) 
      }, "Client team retrieved successfully"));
    } catch (error) {
      console.error("Error fetching client team:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client team"));
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

  static async inviteTeamMember(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const { email, name, role = "member" } = req.body;
      const teamId = (req.user as any)?.team_id;
      const inviterId = (req.user as any)?.id;
      const inviterName = (req.user as any)?.name;

      // Validate required fields
      if (!email || !name) {
        return res.status(400).json(new ServerResponse(false, null, "Email and name are required"));
      }

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // Check if user is already invited or exists
      const existingInvitation = await db.query(
        "SELECT id FROM client_invitations WHERE client_id = $1 AND email = $2 AND status = 'pending'",
        [id, email]
      );

      if (existingInvitation.rows.length > 0) {
        return res.status(400).json(new ServerResponse(false, null, "User already has a pending invitation"));
      }

      const existingUser = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [id, email]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json(new ServerResponse(false, null, "User already exists for this client"));
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
        token: inviteToken
      });

      // Generate invitation link
      const inviteLink = `${process.env.CLIENT_PORTAL_HOSTNAME ? `http://${process.env.CLIENT_PORTAL_HOSTNAME}` : "http://localhost:5174"}/invitation?token=${inviteToken}`;

      // Generate email HTML
      const emailHtml = ClientPortalController.generateInvitationEmailHTML({
        inviteeName: name,
        inviterName,
        clientName: client.name,
        companyName: client.company_name,
        inviteLink,
        expiresAt,
        role
      });

      // Send invitation email using shared email function
      const emailRequest = new EmailRequest(
        [email],
        `You're invited to join ${client.name} on Worklenz`,
        emailHtml
      );

      const messageId = await sendEmail(emailRequest);

      if (!messageId) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to send invitation email"));
      }

      return res.json(new ServerResponse(true, {
        invitationId: inviteToken,
        email,
        name,
        role,
        status: "pending",
        expiresAt
      }, "Team member invited successfully"));
    } catch (error) {
      console.error("Error inviting team member:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to invite team member"));
    }
  }

  static async updateTeamMember(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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
          return res.status(400).json(new ServerResponse(false, null, "No valid fields to update"));
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

        return res.json(new ServerResponse(true, {
          id: updatedUser.id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          status: updatedUser.status,
          type: 'client_user',
          updatedAt: updatedUser.updated_at
        }, "Team member updated successfully"));
      } else {
        // Try to find pending invitation
        const invitationCheck = await db.query(
          "SELECT id, email, name, role, status FROM client_invitations WHERE id = $1 AND client_id = $2 AND status = 'pending'",
          [memberId, id]
        );

        if (invitationCheck.rows.length === 0) {
          return res.status(404).json(new ServerResponse(false, null, "Team member or invitation not found"));
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
          return res.status(400).json(new ServerResponse(false, null, "No valid fields to update"));
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

        return res.json(new ServerResponse(true, {
          id: updatedInvitation.id,
          email: updatedInvitation.email,
          name: updatedInvitation.name,
          role: updatedInvitation.role,
          status: updatedInvitation.status,
          type: 'invitation'
        }, "Team invitation updated successfully"));
      }
    } catch (error) {
      console.error("Error updating team member:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update team member"));
    }
  }

  static async removeTeamMember(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id, memberId } = req.params; // id = client ID, memberId = client user ID or invitation ID
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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
          return res.status(404).json(new ServerResponse(false, null, "Team member not found"));
        }

        const removedUser = clientUserCheck.rows[0];

        return res.json(new ServerResponse(true, {
          id: removedUser.id,
          name: removedUser.name,
          email: removedUser.email,
          role: removedUser.role,
          type: 'client_user',
          removedAt: new Date()
        }, "Team member removed successfully"));
      } else {
        // Try to find and remove pending invitation
        const invitationCheck = await db.query(
          "SELECT id, email, name, role, status FROM client_invitations WHERE id = $1 AND client_id = $2",
          [memberId, id]
        );

        if (invitationCheck.rows.length === 0) {
          return res.status(404).json(new ServerResponse(false, null, "Team member or invitation not found"));
        }

        const invitation = invitationCheck.rows[0];

        // Delete the invitation
        const deleteResult = await db.query(
          "DELETE FROM client_invitations WHERE id = $1 AND client_id = $2",
          [memberId, id]
        );

        if (deleteResult.rowCount === 0) {
          return res.status(404).json(new ServerResponse(false, null, "Invitation not found"));
        }

        return res.json(new ServerResponse(true, {
          id: invitation.id,
          email: invitation.email,
          name: invitation.name,
          role: invitation.role,
          status: invitation.status,
          type: 'invitation',
          removedAt: new Date()
        }, "Team invitation removed successfully"));
      }
    } catch (error) {
      console.error("Error removing team member:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to remove team member"));
    }
  }

  static async resendTeamInvitation(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // Get invitation details
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, token, status FROM client_invitations WHERE id = $1 AND client_id = $2 AND status = 'pending'",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Pending invitation not found"));
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

      // Generate new invitation link
      const inviteLink = `${process.env.CLIENT_PORTAL_HOSTNAME ? `http://${process.env.CLIENT_PORTAL_HOSTNAME}` : "http://localhost:5174"}/invitation?token=${newToken}`;

      // Generate email HTML
      const emailHtml = ClientPortalController.generateInvitationEmailHTML({
        inviteeName: invitation.name,
        inviterName,
        clientName: client.name,
        companyName: client.company_name,
        inviteLink,
        expiresAt: newExpiresAt,
        role: invitation.role
      });

      // Send invitation email using shared email function
      const emailRequest = new EmailRequest(
        [invitation.email],
        `You're invited to join ${client.name} on Worklenz`,
        emailHtml
      );

      const messageId = await sendEmail(emailRequest);

      if (!messageId) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to send invitation email"));
      }

      return res.json(new ServerResponse(true, {
        id: invitation.id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        status: invitation.status,
        resent_at: new Date()
      }, "Team invitation resent successfully"));
    } catch (error) {
      console.error("Error resending team invitation:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to resend team invitation"));
    }
  }

  // Client Analytics
  static async getClientStats(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      // Get project statistics
      const projectStats = await db.query(`
        SELECT 
          COUNT(*) as total_projects,
          COUNT(CASE WHEN sps.name = 'Active' THEN 1 END) as active_projects,
          COUNT(CASE WHEN sps.name = 'Completed' THEN 1 END) as completed_projects
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
      `, [id]);

      // Get team member statistics (placeholder - team members not implemented yet)
      const teamMemberStats = {
        total_team_members: 0,
        active_team_members: 0
      };

      // Get request statistics (placeholder - requests not implemented yet)
      const requestStats = {
        total_requests: 0,
        pending_requests: 0
      };

      // Get invoice statistics (placeholder - invoices not implemented yet)
      const invoiceStats = {
        total_invoices: 0,
        unpaid_invoices: 0
      };

      const stats = {
        totalProjects: parseInt(projectStats.rows[0]?.total_projects || "0"),
        activeProjects: parseInt(projectStats.rows[0]?.active_projects || "0"),
        completedProjects: parseInt(projectStats.rows[0]?.completed_projects || "0"),
        totalTeamMembers: teamMemberStats.total_team_members,
        activeTeamMembers: teamMemberStats.active_team_members,
        totalRequests: requestStats.total_requests,
        pendingRequests: requestStats.pending_requests,
        totalInvoices: invoiceStats.total_invoices,
        unpaidInvoices: invoiceStats.unpaid_invoices
      };

      return res.json(new ServerResponse(true, stats, "Client statistics retrieved successfully"));
    } catch (error) {
      console.error("Error fetching client stats:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client statistics"));
    }
  }

  static async getClientActivity(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      const activities = [];
      const dayFilter = `NOW() - INTERVAL '${Number(days)} days'`;

      // Get project activities
      if (!type || type === 'project') {
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
      if (!type || type === 'request') {
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
      if (!type || type === 'invoice') {
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
      if (!type || type === 'chat') {
        const chatActivitiesQuery = `
          SELECT 
            'chat_message' as activity_type,
            m.id as reference_id,
            DATE(m.created_at)::text as reference_name,
            m.created_at as activity_date,
            CASE 
              WHEN m.sender_type = 'client' THEN 'You sent a message'
              ELSE u.first_name || ' ' || u.last_name || ' sent a message'
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
      activities.sort((a, b) => new Date(b.activity_date).getTime() - new Date(a.activity_date).getTime());

      // Paginate
      const total = activities.length;
      const offset = (Number(page) - 1) * Number(limit);
      const paginatedActivities = activities.slice(offset, offset + Number(limit));

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
        relativeTime: this.getRelativeTime(new Date(activity.activity_date))
      }));

      return res.json(new ServerResponse(true, { 
        activities: formattedActivities, 
        total, 
        page: Number(page), 
        limit: Number(limit),
        days: Number(days),
        filter: type || 'all'
      }, "Client activity retrieved successfully"));
    } catch (error) {
      console.error("Error fetching client activity:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client activity"));
    }
  }

  private static getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return date.toLocaleDateString();
  }

  static async exportClientData(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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
          updatedAt: client.updated_at
        }
      };

      // Include projects if requested
      if (include === 'all' || (typeof include === 'string' && include.includes('projects'))) {
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
      if (include === 'all' || (typeof include === 'string' && include.includes('requests'))) {
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
      if (include === 'all' || (typeof include === 'string' && include.includes('invoices'))) {
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
      if (include === 'all' || (typeof include === 'string' && include.includes('messages'))) {
        const messagesQuery = `
          SELECT 
            m.id, m.sender_type, m.message, m.message_type,
            m.created_at, m.read_at,
            CASE 
              WHEN m.sender_type = 'team_member' THEN u.first_name || ' ' || u.last_name
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
        exportedBy: (req.user as any)?.email || 'system',
        format,
        includedSections: include === 'all' ? ['client', 'projects', 'requests', 'invoices', 'messages'] : (typeof include === 'string' ? include.split(',') : []),
        clientId: id,
        clientName: client.name
      };

      // For CSV format, flatten the data
      if (format === 'csv') {
        // In a real implementation, you would convert this to CSV format
        // For now, return instructions for CSV generation
        return res.json(new ServerResponse(true, {
          downloadUrl: `/api/client-portal/clients/${id}/export/download?format=csv&include=${include}`,
          format: 'csv',
          recordCount: {
            projects: exportData.projects?.length || 0,
            requests: exportData.requests?.length || 0,
            invoices: exportData.invoices?.length || 0,
            messages: exportData.messages?.length || 0
          },
          generatedAt: new Date()
        }, "CSV export prepared"));
      }

      // For JSON format, return the data directly
      return res.json(new ServerResponse(true, {
        exportData,
        downloadUrl: `/api/client-portal/clients/${id}/export/download?format=json&include=${include}`,
        format: 'json'
      }, "Client data export completed"));
    } catch (error) {
      console.error("Error exporting client data:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to export client data"));
    }
  }

  // Bulk Operations
  static async bulkUpdateClients(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { client_ids, status } = req.body;
      const teamId = (req.user as any)?.team_id;

      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client IDs provided"));
      }

      if (!status || !["active", "inactive", "pending"].includes(status)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid status provided"));
      }

      // Verify all clients belong to the team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      if (clientCheck.rows.length !== client_ids.length) {
        return res.status(400).json(new ServerResponse(false, null, "Some clients not found or not accessible"));
      }

      // Update all clients
      const updateResult = await db.query(
        "UPDATE clients SET updated_at = NOW() WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      return res.json(new ServerResponse(true, { updated_count: updateResult.rowCount }, "Clients updated successfully"));
    } catch (error) {
      console.error("Error bulk updating clients:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update clients"));
    }
  }

  static async bulkDeleteClients(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { client_ids } = req.body;
      const teamId = (req.user as any)?.team_id;

      if (!client_ids || !Array.isArray(client_ids) || client_ids.length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client IDs provided"));
      }

      // Verify all clients belong to the team
      const clientCheck = await db.query(
        "SELECT id FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      if (clientCheck.rows.length !== client_ids.length) {
        return res.status(400).json(new ServerResponse(false, null, "Some clients not found or not accessible"));
      }

      // Check if any clients have projects
      const projectCheck = await db.query(
        "SELECT client_id FROM projects WHERE client_id = ANY($1)",
        [client_ids]
      );

      if (projectCheck.rows.length > 0) {
        return res.status(400).json(new ServerResponse(false, null, "Cannot delete clients with assigned projects"));
      }

      // Delete all clients
      const deleteResult = await db.query(
        "DELETE FROM clients WHERE id = ANY($1) AND team_id = $2",
        [client_ids, teamId]
      );

      return res.json(new ServerResponse(true, { deleted_count: deleteResult.rowCount }, "Clients deleted successfully"));
    } catch (error) {
      console.error("Error bulk deleting clients:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to delete clients"));
    }
  }

  // Client Portal Authentication Endpoints
  static async validateInvitation(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { token } = req.query;

      if (!token) {
        return res.status(400).json(new ServerResponse(false, null, "Invitation token is required"));
      }

      // Get invitation details
      const invitation = await TokenService.getInvitationByToken(token as string);

      if (!invitation) {
        return res.status(404).json(new ServerResponse(false, null, "Invalid or expired invitation"));
      }

      // Return invitation details for the frontend
      return res.json(new ServerResponse(true, {
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
        status: invitation.status
      }, "Invitation is valid"));
    } catch (error) {
      console.error("Error validating invitation:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to validate invitation"));
    }
  }

  static async acceptInvitation(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { token, password, name } = req.body;

      if (!token || !password || !name) {
        return res.status(400).json(new ServerResponse(false, null, "Token, password, and name are required"));
      }

      // Accept the invitation
      const newUser = await TokenService.acceptInvitation(token, {
        password,
        name
      });

      // Send welcome email
      const invitation = await TokenService.getInvitationByToken(token);
      if (invitation) {
        const portalLink = `${process.env.CLIENT_PORTAL_HOSTNAME ? `http://${process.env.CLIENT_PORTAL_HOSTNAME}` : "http://localhost:5174"}/login`;
        
        // Generate welcome email HTML
        const emailHtml = ClientPortalController.generateWelcomeEmailHTML({
          userName: newUser.name,
          clientName: invitation.client_name,
          companyName: invitation.company_name,
          portalLink
        });

        // Send welcome email using shared email function
        const emailRequest = new EmailRequest(
          [newUser.email],
          `Welcome to ${invitation.client_name} on Worklenz`,
          emailHtml
        );

        await sendEmail(emailRequest);
      }

      // Generate client access token for automatic login
      const tokenPayload = {
        clientId: newUser.client_id,
        organizationId: newUser.team_id,
        email: newUser.email,
        permissions: await TokenService.getClientPermissions(newUser.client_id),
        type: "client" as const
      };

      const accessToken = TokenService.generateClientToken(tokenPayload);

      // Update last login
      await db.query(
        "UPDATE client_users SET last_login = NOW() WHERE id = $1",
        [newUser.id]
      );

      return res.json(new ServerResponse(true, {
        token: accessToken,
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          clientId: newUser.client_id,
          clientName: newUser.client_name,
          companyName: newUser.company_name
        },
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours from now
      }, "Invitation accepted successfully"));
    } catch (error) {
      console.error("Error accepting invitation:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to accept invitation"));
    }
  }

  static async clientLogin(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        return res.status(400).json(new ServerResponse(false, null, "Email and password are required"));
      }

      // Authenticate client user
      const clientUser = await TokenService.authenticateClient(email, password);

      if (!clientUser) {
        return res.status(401).json(new ServerResponse(false, null, "Invalid email or password"));
      }

      // Generate client access token
      const tokenPayload = {
        clientId: clientUser.client_id,
        organizationId: clientUser.team_id,
        email: clientUser.email,
        permissions: await TokenService.getClientPermissions(clientUser.client_id),
        type: "client" as const
      };

      const accessToken = TokenService.generateClientToken(tokenPayload);

      // Update last login
      await db.query(
        "UPDATE client_users SET last_login = NOW() WHERE id = $1",
        [clientUser.id]
      );

      return res.json(new ServerResponse(true, {
        token: accessToken,
        user: {
          id: clientUser.id,
          email: clientUser.email,
          name: clientUser.name,
          role: clientUser.role,
          clientId: clientUser.client_id,
          clientName: clientUser.client_name,
          companyName: clientUser.company_name
        }
      }, "Login successful"));
    } catch (error) {
      console.error("Error during client login:", error);
      return res.status(500).json(new ServerResponse(false, null, "Login failed"));
    }
  }

  static async refreshClientToken(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { token } = req.body;

      if (!token) {
        return res.status(400).json(new ServerResponse(false, null, "Token is required"));
      }

      // Verify the current token
      const decoded = TokenService.verifyClientToken(token);
      if (!decoded) {
        return res.status(401).json(new ServerResponse(false, null, "Invalid or expired token"));
      }

      // Generate new token with updated expiry
      const newToken = TokenService.generateClientToken({
        clientId: decoded.clientId,
        organizationId: decoded.organizationId,
        email: decoded.email,
        permissions: decoded.permissions || [],
        type: "client" as const
      });

      return res.json(new ServerResponse(true, {
        token: newToken,
        expiresAt: new Date(Date.now() + (24 * 60 * 60 * 1000)).toISOString() // 24 hours from now
      }, "Token refreshed successfully"));
    } catch (error) {
      console.error("Error refreshing client token:", error);
      return res.status(401).json(new ServerResponse(false, null, "Token refresh failed"));
    }
  }

  static async clientLogout(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      // In a more complete implementation, you would invalidate the token
      // For now, we'll just return a success response
      return res.json(new ServerResponse(true, null, "Logout successful"));
    } catch (error) {
      console.error("Error during client logout:", error);
      return res.status(500).json(new ServerResponse(false, null, "Logout failed"));
    }
  }

  static async getClientProfile(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {clientEmail} = req;

      // Get client user details
      const query = `
        SELECT cu.*, c.name as client_name, c.company_name
        FROM client_users cu
        JOIN clients c ON cu.client_id = c.id
        WHERE cu.client_id = $1 AND cu.email = $2
      `;

      const result = await db.query(query, [clientId, clientEmail]);
      
      if (result.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client profile not found"));
      }

      const clientUser = result.rows[0];

      return res.json(new ServerResponse(true, {
        id: clientUser.id,
        email: clientUser.email,
        name: clientUser.name,
        role: clientUser.role,
        clientId: clientUser.client_id,
        clientName: clientUser.client_name,
        companyName: clientUser.company_name,
        createdAt: clientUser.created_at,
        lastLogin: clientUser.last_login
      }, "Client profile retrieved successfully"));
    } catch (error) {
      console.error("Error fetching client profile:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve client profile"));
    }
  }

  static async updateClientProfile(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const {clientId} = req;
      const {clientEmail} = req;
      const { name, currentPassword, newPassword } = req.body;

      if (!name) {
        return res.status(400).json(new ServerResponse(false, null, "Name is required"));
      }

      // Get current client user
      const currentUser = await db.query(
        "SELECT * FROM client_users WHERE client_id = $1 AND email = $2",
        [clientId, clientEmail]
      );

      if (currentUser.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client user not found"));
      }

      const user = currentUser.rows[0];
      const updateFields = ["name = $1", "updated_at = NOW()"];
      const updateValues = [name];
      let paramIndex = 2;

      // Handle password update if provided
      if (newPassword) {
        if (!currentPassword) {
          return res.status(400).json(new ServerResponse(false, null, "Current password is required to set new password"));
        }

        // Verify current password
        const crypto = require("crypto");
        const currentPasswordHash = crypto.createHash("sha256").update(currentPassword).digest("hex");
        
        if (currentPasswordHash !== user.password_hash) {
          return res.status(400).json(new ServerResponse(false, null, "Current password is incorrect"));
        }

        // Hash new password
        const newPasswordHash = crypto.createHash("sha256").update(newPassword).digest("hex");
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

      return res.json(new ServerResponse(true, {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        updatedAt: updatedUser.updated_at
      }, "Profile updated successfully"));
    } catch (error) {
      console.error("Error updating client profile:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update profile"));
    }
  }
}

export default ClientPortalController; 