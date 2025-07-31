import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {isValidateEmail} from "../shared/utils";
import {ServerResponse} from "../models/server-response";
import {sendNewSubscriberNotification} from "../shared/email-templates";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import ClientPortalController from "./client-portal-controller";

export default class ClientsController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `INSERT INTO clients (name, team_id, status) VALUES ($1, $2, 'pending') RETURNING id, name;`;
    const result = await db.query(q, [req.body.name, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name");

    const q = `
      SELECT ROW_TO_JSON(rec) AS clients
      FROM (SELECT COUNT(*) AS total,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT id,
                            name,
                            (SELECT COUNT(*) FROM projects WHERE client_id = clients.id) AS projects_count
                    FROM clients
                    WHERE team_id = $1 ${searchQuery}
                    ORDER BY ${sortField} ${sortOrder}
                    LIMIT $2 OFFSET $3) t) AS data
      FROM clients
      WHERE team_id = $1 ${searchQuery}) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, size, offset]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.clients || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `SELECT id, name FROM clients WHERE id = $1 AND team_id = $2`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `UPDATE clients SET name = $3 WHERE id = $1 AND team_id = $2; `;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null, req.body.name]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `DELETE FROM clients WHERE id = $1 AND team_id = $2;`;
    const result = await db.query(q, [req.params.id, req.user?.team_id || null]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async addSubscriber(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {email} = req.body;
    if (!this.isValidHost(req.hostname))
      return res.status(200).send(new ServerResponse(false, null, "Invalid hostname"));

    if (!isValidateEmail(email))
      return res.status(200).send(new ServerResponse(false, null, "Invalid email address"));

    sendNewSubscriberNotification(email);

    return res.status(200).send(new ServerResponse(true, null, "Thank you for subscribing. We'll update you once WorkLenz is live!"));
  }

  // Organization-side Client Portal Request Management

  @HandleExceptions()
  public static async getClientRequests(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "created_at");
    const {status, client_id, service_id, assigned_to} = req.query;

    // Build filter conditions
    const conditions = [];
    const values = [teamId, size, offset];
    let paramIndex = 4;

    if (status) {
      conditions.push(`r.status = $${paramIndex}`);
      values.push((status as string).trim());
      paramIndex++;
    }

    if (client_id) {
      conditions.push(`r.client_id = $${paramIndex}`);
      values.push((client_id as string).trim());
      paramIndex++;
    }

    if (service_id) {
      conditions.push(`r.service_id = $${paramIndex}`);
      values.push((service_id as string).trim());
      paramIndex++;
    }

    if (assigned_to) {
      conditions.push(`r.assigned_to = $${paramIndex}`);
      values.push((assigned_to as string).trim());
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `AND ${conditions.join(" AND ")}` : "";

    const q = `
      SELECT ROW_TO_JSON(rec) AS requests
      FROM (SELECT COUNT(*) AS total,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT r.id,
                            r.req_no,
                            r.service_id,
                            r.client_id,
                            r.status,
                            r.request_data,
                            r.notes,
                            r.created_at,
                            r.updated_at,
                            r.completed_at,
                            r.assigned_to,
                            s.name as service_name,
                            s.description as service_description,
                            c.name as client_name,
                            c.email as client_email,
                            u.name as assigned_to_name
                    FROM client_portal_requests r
                    JOIN client_portal_services s ON r.service_id = s.id
                    JOIN clients c ON r.client_id = c.id
                    LEFT JOIN users u ON r.assigned_to = u.id
                    WHERE r.organization_team_id = $1 ${searchQuery} ${whereClause}
                    ORDER BY ${sortField} ${sortOrder}
                    LIMIT $2 OFFSET $3) t) AS data
      FROM client_portal_requests r
      JOIN client_portal_services s ON r.service_id = s.id
      JOIN clients c ON r.client_id = c.id
      WHERE r.organization_team_id = $1 ${searchQuery} ${whereClause}) rec;
    `;
    
    const result = await db.query(q, values);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.requests || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getClientRequestById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const requestId = req.params.id;

    const q = `
      SELECT r.id,
             r.req_no,
             r.service_id,
             r.client_id,
             r.status,
             r.request_data,
             r.notes,
             r.created_at,
             r.updated_at,
             r.completed_at,
             r.assigned_to,
             s.name as service_name,
             s.description as service_description,
             s.service_data as service_config,
             c.name as client_name,
             c.email as client_email,
             c.phone as client_phone,
             c.company_name as client_company,
             u.name as assigned_to_name,
             u.email as assigned_to_email
      FROM client_portal_requests r
      JOIN client_portal_services s ON r.service_id = s.id
      JOIN clients c ON r.client_id = c.id
      LEFT JOIN users u ON r.assigned_to = u.id
      WHERE r.id = $1 AND r.organization_team_id = $2
    `;

    const result = await db.query(q, [requestId, teamId]);
    const [data] = result.rows;

    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async updateClientRequestStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const requestId = req.params.id;
    const {status, notes, assigned_to} = req.body;

    // Validate status
    const validStatuses = ["pending", "accepted", "in_progress", "completed", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid status"));
    }

    // Build update query
    const updateFields = ["status = $3", "updated_at = NOW()"];
    const updateValues = [requestId, teamId, status];
    let paramIndex = 4;

    if (notes) {
      updateFields.push(`notes = $${paramIndex}`);
      updateValues.push(notes);
      paramIndex++;
    }

    if (assigned_to) {
      updateFields.push(`assigned_to = $${paramIndex}`);
      updateValues.push(assigned_to);
      paramIndex++;
    }

    if (status === "completed") {
      updateFields.push("completed_at = NOW()");
    }

    const q = `
      UPDATE client_portal_requests 
      SET ${updateFields.join(", ")}
      WHERE id = $1 AND organization_team_id = $2
      RETURNING id, req_no, status, updated_at, completed_at, assigned_to
    `;

    const result = await db.query(q, updateValues);
    const [data] = result.rows;

    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    return res.status(200).send(new ServerResponse(true, data, "Request updated successfully"));
  }

  @HandleExceptions()
  public static async assignClientRequest(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const requestId = req.params.id;
    const {assigned_to} = req.body;

    // Verify the user exists and belongs to the team
    if (assigned_to) {
      const userCheck = await db.query(
        "SELECT id, name FROM users WHERE id = $1 AND team_id = $2",
        [assigned_to, teamId]
      );

      if (userCheck.rows.length === 0) {
        return res.status(400).send(new ServerResponse(false, null, "User not found in team"));
      }
    }

    const q = `
      UPDATE client_portal_requests 
      SET assigned_to = $3, updated_at = NOW()
      WHERE id = $1 AND organization_team_id = $2
      RETURNING id, req_no, assigned_to
    `;

    const result = await db.query(q, [requestId, teamId, assigned_to]);
    const [data] = result.rows;

    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    return res.status(200).send(new ServerResponse(true, data, "Request assigned successfully"));
  }

  @HandleExceptions()
  public static async getClientRequestsStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;

    const q = `
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted_requests,
        COUNT(CASE WHEN status = 'in_progress' THEN 1 END) as in_progress_requests,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_requests,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_requests,
        COUNT(CASE WHEN assigned_to IS NOT NULL THEN 1 END) as assigned_requests,
        COUNT(CASE WHEN assigned_to IS NULL THEN 1 END) as unassigned_requests
      FROM client_portal_requests 
      WHERE organization_team_id = $1
    `;

    const result = await db.query(q, [teamId]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async getClientServices(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name");

    const q = `
      SELECT ROW_TO_JSON(rec) AS services
      FROM (SELECT COUNT(*) AS total,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT s.id,
                            s.name,
                            s.description,
                            s.status,
                            s.is_public,
                            s.service_data,
                            s.created_at,
                            s.updated_at,
                            s.created_by,
                            u.name as created_by_name,
                            (SELECT COUNT(*) FROM client_portal_requests WHERE service_id = s.id) as requests_count,
                            (SELECT COUNT(*) FROM client_portal_requests WHERE service_id = s.id AND status = 'pending') as pending_requests
                    FROM client_portal_services s
                    LEFT JOIN users u ON s.created_by = u.id
                    WHERE s.organization_team_id = $1 ${searchQuery}
                    ORDER BY ${sortField} ${sortOrder}
                    LIMIT $2 OFFSET $3) t) AS data
      FROM client_portal_services s
      WHERE s.organization_team_id = $1 ${searchQuery}) rec;
    `;

    const result = await db.query(q, [teamId, size, offset]);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data.services || this.paginatedDatasetDefaultStruct));
  }

  @HandleExceptions()
  public static async getClientServiceById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const serviceId = req.params.id;

    if (!serviceId) {
      return res.status(400).send(new ServerResponse(false, null, "Service ID is required"));
    }

    const q = `
      SELECT s.id,
             s.name,
             s.description,
             s.status,
             s.is_public,
             s.service_data,
             s.created_at,
             s.updated_at,
             s.created_by,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM client_portal_requests WHERE service_id = s.id) as requests_count,
             (SELECT COUNT(*) FROM client_portal_requests WHERE service_id = s.id AND status = 'pending') as pending_requests
      FROM client_portal_services s
      LEFT JOIN users u ON s.created_by = u.id
      WHERE s.id = $1 AND s.organization_team_id = $2
    `;

    const result = await db.query(q, [serviceId, teamId]);
    
    if (result.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Service not found"));
    }

    const service = result.rows[0];
    return res.status(200).send(new ServerResponse(true, service));
  }

  @HandleExceptions()
  public static async createClientService(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const {name, description, service_data, is_public, allowed_client_ids} = req.body;

    if (!name) {
      return res.status(400).send(new ServerResponse(false, null, "Service name is required"));
    }

    const q = `
      INSERT INTO client_portal_services (
        name, description, service_data, is_public, allowed_client_ids, 
        team_id, organization_team_id, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'active')
      RETURNING id, name, description, status, is_public, created_at
    `;

    const values = [
      name,
      description || null,
      service_data ? JSON.stringify(service_data) : null,
      is_public || false,
      allowed_client_ids || null,
      teamId,
      teamId,
      userId
    ];

    const result = await db.query(q, values);
    const [data] = result.rows;

    return res.status(200).send(new ServerResponse(true, data, "Service created successfully"));
  }

  @HandleExceptions()
  public static async updateClientService(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const serviceId = req.params.id;
    const {name, description, service_data, is_public, allowed_client_ids, status} = req.body;

    const updateFields = ["updated_at = NOW()"];
    const updateValues = [serviceId, teamId];
    let paramIndex = 3;

    if (name) {
      updateFields.push(`name = $${paramIndex}`);
      updateValues.push(name);
      paramIndex++;
    }

    if (description !== undefined) {
      updateFields.push(`description = $${paramIndex}`);
      updateValues.push(description);
      paramIndex++;
    }

    if (service_data) {
      updateFields.push(`service_data = $${paramIndex}`);
      updateValues.push(JSON.stringify(service_data));
      paramIndex++;
    }

    if (is_public !== undefined) {
      updateFields.push(`is_public = $${paramIndex}`);
      updateValues.push(is_public);
      paramIndex++;
    }

    if (allowed_client_ids !== undefined) {
      updateFields.push(`allowed_client_ids = $${paramIndex}`);
      updateValues.push(allowed_client_ids);
      paramIndex++;
    }

    if (status && ["active", "inactive", "draft"].includes(status)) {
      updateFields.push(`status = $${paramIndex}`);
      updateValues.push(status);
      paramIndex++;
    }

    if (updateFields.length === 1) {
      return res.status(400).send(new ServerResponse(false, null, "No valid fields to update"));
    }

    const q = `
      UPDATE client_portal_services 
      SET ${updateFields.join(", ")}
      WHERE id = $1 AND organization_team_id = $2
      RETURNING id, name, description, status, is_public, updated_at
    `;

    const result = await db.query(q, updateValues);
    const [data] = result.rows;

    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Service not found"));
    }

    return res.status(200).send(new ServerResponse(true, data, "Service updated successfully"));
  }

  @HandleExceptions()
  public static async deleteClientService(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const serviceId = req.params.id;

    // Check if service has any requests
    const requestsCheck = await db.query(
      "SELECT COUNT(*) as count FROM client_portal_requests WHERE service_id = $1",
      [serviceId]
    );

    const requestCount = parseInt(requestsCheck.rows[0]?.count || "0");
    if (requestCount > 0) {
      return res.status(400).send(new ServerResponse(false, null, "Cannot delete service with existing requests"));
    }

    const q = `
      DELETE FROM client_portal_services 
      WHERE id = $1 AND organization_team_id = $2
    `;

    const result = await db.query(q, [serviceId, teamId]);

    if (result.rowCount === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Service not found"));
    }

    return res.status(200).send(new ServerResponse(true, null, "Service deleted successfully"));
  }

  // Organization-side Client Portal Management (wrapper methods for team authentication)
  
  @HandleExceptions()
  public static async getPortalClients(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Convert IWorkLenzRequest to Request by copying user properties
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClients(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async createPortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.createClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClientById(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientDetails(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClientDetails(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async updatePortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.updateClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async deletePortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.deleteClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClientProjects(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async assignProjectToPortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.assignProjectToClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async removeProjectFromPortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.removeProjectFromClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClientTeam(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async invitePortalTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.inviteTeamMember(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async updatePortalTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.updateTeamMember(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async removePortalTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.removeTeamMember(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async resendPortalTeamInvitation(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.resendTeamInvitation(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClientStats(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientActivity(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getClientActivity(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async exportPortalClientData(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.exportClientData(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async bulkUpdatePortalClients(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.bulkUpdateClients(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async bulkDeletePortalClients(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.bulkDeleteClients(modifiedReq, res as any);
  }

  // Organization-side Client Portal Projects Management (wrapper methods)
  
  @HandleExceptions()
  public static async getPortalProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getProjects(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalProjectById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getProjectDetails(modifiedReq, res as any);
  }

  // Organization-side Client Portal Invoices Management (wrapper methods)
  
  @HandleExceptions()
  public static async getPortalInvoices(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getInvoices(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalInvoiceById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getInvoiceDetails(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async payPortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.payInvoice(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async downloadPortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.downloadInvoice(modifiedReq, res as any);
  }

  // Organization-side Client Portal Chats Management (wrapper methods)
  
  @HandleExceptions()
  public static async getPortalChats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getChats(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalChatById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getChatDetails(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async sendPortalMessage(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.sendMessage(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalMessages(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getMessages(modifiedReq, res as any);
  }

  // Organization-side Client Portal Dashboard (wrapper method)
  
  @HandleExceptions()
  public static async getPortalDashboard(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalController.getDashboard(modifiedReq, res as any);
  }

  // Organization-side Client Portal Invitation Management

  @HandleExceptions()
  public static async generateClientInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalController.generateClientInvitationLink(req, res);
  }

}
