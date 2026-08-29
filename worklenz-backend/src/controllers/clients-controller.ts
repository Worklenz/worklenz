import {IWorkLenzRequest} from "../interfaces/worklenz-request";
import {IWorkLenzResponse} from "../interfaces/worklenz-response";

import db from "../config/db";
import {isValidateEmail} from "../shared/utils";
import {ServerResponse} from "../models/server-response";
import {sendNewSubscriberNotification} from "../shared/email-templates";
import WorklenzControllerBase from "./worklenz-controller-base";
import { sanitizeCommentContent } from "../shared/utils";
import HandleExceptions from "../decorators/handle-exceptions";
import ClientPortalControllerBase from "../ee/controllers/client-portal/client-portal-base";
import ClientPortalClientsController from "../ee/controllers/client-portal/client-portal-clients-controller";
import ClientPortalTeamController from "../ee/controllers/client-portal/client-portal-team-controller";
import ClientPortalProjectsController from "../ee/controllers/client-portal/client-portal-projects-controller";
import ClientPortalInvoicesController from "../ee/controllers/client-portal/client-portal-invoices-controller";
import ClientPortalChatController from "../ee/controllers/client-portal/client-portal-chat-controller";
import ClientPortalDashboardController from "../ee/controllers/client-portal/client-portal-dashboard-controller";
import ClientPortalAuthController from "../ee/controllers/client-portal/client-portal-auth-controller";
import ClientPortalBulkController from "../ee/controllers/client-portal/client-portal-bulk-controller";
import {uploadBase64, deleteObject, getClientPortalStorageKey} from "../shared/storage";
import {sendClientPortalRequestCommentNotification} from "../shared/email-notifications";
import {getClientPortalBaseUrl} from "../cron_jobs/helpers";
import { IO } from "../shared/io";
import moment from "moment-timezone";

export default class ClientsController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `INSERT INTO clients (name, team_id, status) VALUES ($1, $2, 'pending') RETURNING id, name;`;
    const result = await db.query(q, [req.body.name, req.user?.team_id || null]);
    const [data] = result.rows;
    return res.status(200).send(new ServerResponse(true, data));
  }

  /**
   * Lightweight lookup endpoint for filter dropdowns.
   * Returns id + name for every client belonging to the current team.
   * Supports an optional ?search= param for server-side filtering so the
   * caller is never limited to an arbitrary page cap.
   */
  @HandleExceptions()
  public static async getLookup(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    if (!req.user?.team_id)
      return res.status(400).send(new ServerResponse(false, null, "Team not found"));

    const search = ((req.query.search as string) || "").trim();
    const searchCondition = search ? `AND name ILIKE $2` : "";
    const params: (string | undefined)[] = [req.user.team_id];
    if (search) params.push(`%${search}%`);

    const q = `
      SELECT id, name
      FROM clients
      WHERE team_id = $1 ${searchCondition}
      ORDER BY name ASC
    `;
    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const {searchQuery, searchParams = [], sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, "name", false, 2);
    const limitParam = searchParams.length + 2;
    const offsetParam = searchParams.length + 3;

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
                    LIMIT $${limitParam} OFFSET $${offsetParam}) t) AS data
      FROM clients
      WHERE team_id = $1 ${searchQuery}) rec;
    `;
    const result = await db.query(q, [req.user?.team_id || null, ...searchParams, size, offset]);
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
    const {searchQuery, sortField, sortOrder, size, offset} = this.toPaginationOptions(req.query, ["r.req_no", "s.name", "c.name", "r.notes"]);
    const {status, client_id, service_id, assigned_to} = req.query;

    // Ensure sortField is a valid column, default to created_at if it's an array
    const safeSortField = Array.isArray(sortField) ? "r.created_at" : sortField;

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
                    ORDER BY ${safeSortField} ${sortOrder}
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
    const userId = req.user?.id;
    const requestId = req.params.id;
    const {status, notes, assigned_to} = req.body;

    // Validate status
    const validStatuses = ["pending", "accepted", "in_progress", "completed", "rejected"];
    if (!validStatuses.includes(status)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid status"));
    }

    // Get current status and request details before update
    const currentRequestResult = await db.query(
      `SELECT r.status, r.client_id, r.req_no, s.name as service_name
       FROM client_portal_requests r
       LEFT JOIN client_portal_services s ON r.service_id = s.id
       WHERE r.id = $1 AND r.organization_team_id = $2`,
      [requestId, teamId]
    );
    
    if (currentRequestResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }
    
    const currentRequest = currentRequestResult.rows[0];
    const previousStatus = currentRequest.status;

    // Build update query
    const updateFields = ["status = $3", "updated_at = NOW()"];
    const updateValues: (string | null)[] = [requestId, teamId, status];
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

    // Set specific timestamp based on status
    if (status === "accepted") {
      updateFields.push("accepted_at = NOW()");
    } else if (status === "in_progress") {
      updateFields.push("in_progress_at = NOW()");
    } else if (status === "completed") {
      updateFields.push("completed_at = NOW()");
    } else if (status === "rejected") {
      updateFields.push("rejected_at = NOW()");
    }

    const q = `
      UPDATE client_portal_requests 
      SET ${updateFields.join(", ")}
      WHERE id = $1 AND organization_team_id = $2
      RETURNING id, req_no, status, updated_at, completed_at, accepted_at, in_progress_at, rejected_at, assigned_to
    `;

    const result = await db.query(q, updateValues);
    const [data] = result.rows;

    if (!data) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    // Log the status change to history (with user who made the change)
    if (previousStatus !== status) {
      await db.query(
        `INSERT INTO client_portal_request_status_history 
         (request_id, previous_status, new_status, changed_by, notes, changed_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [requestId, previousStatus, status, userId, notes || null]
      );

      // Create notification for the client
      if (currentRequest.client_id && teamId) {
        await ClientPortalControllerBase.createNotification(
          currentRequest.client_id,
          teamId,
          "request_update",
          "Request Update",
          `Request ${currentRequest.req_no} status changed to ${status}`,
          requestId,
          currentRequest.req_no,
          {
            serviceName: currentRequest.service_name,
            status,
            previousStatus
          }
        );
      }
    }

    return res.status(200).send(new ServerResponse(true, data, "Request updated successfully"));
  }

  @HandleExceptions()
  public static async getClientRequestStatusHistory(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const requestId = req.params.id;

    // Verify request belongs to this team
    const requestCheck = await db.query(
      "SELECT id FROM client_portal_requests WHERE id = $1 AND organization_team_id = $2",
      [requestId, teamId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    const q = `
      SELECT 
        h.id,
        h.previous_status,
        h.new_status,
        h.notes,
        h.changed_at,
        u.name as changed_by_name,
        cpu.name as changed_by_client_name
      FROM client_portal_request_status_history h
      LEFT JOIN users u ON h.changed_by = u.id
      LEFT JOIN client_users cpu ON h.changed_by_client = cpu.id
      WHERE h.request_id = $1
      ORDER BY h.changed_at ASC
    `;

    const result = await db.query(q, [requestId]);

    return res.status(200).send(new ServerResponse(true, result.rows));
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
             s.price,
             s.currency,
             s.category,
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
    const {
      name, 
      description, 
      service_data, 
      is_public, 
      allowed_client_ids,
      price,
      currency,
      category,
      service_key,
      // Image upload fields
      imageData,
      imageName,
      imageType
    } = req.body;


    if (!name) {
      return res.status(400).send(new ServerResponse(false, null, "Service name is required"));
    }

    // Validate and process service_key
    let finalServiceKey: string | null = null;
    if (service_key) {
      // Validate format: 2-6 uppercase alphanumeric characters
      const keyRegex = /^[A-Z0-9]{2,6}$/;
      if (!keyRegex.test(service_key)) {
        return res.status(400).send(new ServerResponse(false, null, "Service key must be 2-6 uppercase alphanumeric characters (A-Z, 0-9)"));
      }
      finalServiceKey = service_key.toUpperCase();
      
      // Check if service_key already exists for this organization
      const keyCheck = await db.query(
        `SELECT id FROM client_portal_services WHERE organization_team_id = $1 AND service_key = $2`,
        [teamId, finalServiceKey]
      );
      if (keyCheck.rows.length > 0) {
        return res.status(400).send(new ServerResponse(false, null, `Service key "${finalServiceKey}" is already in use. Please choose a different key.`));
      }
    } else {
      // Auto-generate service_key from name if not provided
      const cleanName = name.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (cleanName.length >= 2) {
        const baseKey = cleanName.substring(0, Math.min(6, cleanName.length));
        // Ensure uniqueness by appending number if needed
        let counter = 1;
        let uniqueKey = baseKey;
        while (true) {
          const keyCheck = await db.query(
            `SELECT id FROM client_portal_services WHERE organization_team_id = $1 AND service_key = $2`,
            [teamId, uniqueKey]
          );
          if (keyCheck.rows.length === 0) {
            finalServiceKey = uniqueKey;
            break;
          }
          // If key exists, try appending a number (max 6 chars total)
          const baseKeyLength = Math.max(0, 6 - String(counter).length);
          const baseKeyPart = baseKey.substring(0, baseKeyLength);
          uniqueKey = baseKeyPart + counter;
          counter++;
          if (counter > 999) break; // Safety limit
        }
      }
    }

    let finalServiceData = { ...service_data };

    // Handle image upload if provided
    if (imageData && imageName && imageType) {
      
      // Validate image
      const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedImageTypes.includes(imageType)) {
        return res.status(400).send(new ServerResponse(false, null, "Only JPEG, PNG, GIF, and WebP images are allowed"));
      }

      // Validate file size (assuming base64 data) - 5MB limit
      const fileSizeBytes = Math.floor((imageData.length * 3) / 4);
      const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
      
      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).send(new ServerResponse(false, null, "Image size exceeds 5MB limit"));
      }

      // Generate unique filename and storage key
      const fileExtension = imageName.substring(imageName.lastIndexOf("."));
      const uniqueFileName = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
      // Use getClientPortalStorageKey to ensure files are stored under organizations/{teamId}/client-portal/
      if (!teamId) {
        return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
      }
      const storageKey = getClientPortalStorageKey("service-images", teamId, uniqueFileName);

      try {
        // Upload to S3
        const imageUrl = await uploadBase64(imageData, storageKey);
        
        if (!imageUrl) {
          return res.status(500).send(new ServerResponse(false, null, "Failed to upload service image"));
        }

        // Add image URL to service data
        finalServiceData = {
          ...finalServiceData,
          images: [imageUrl]
        };

      } catch (uploadError) {
        return res.status(500).send(new ServerResponse(false, null, "Failed to upload service image"));
      }
    }

    const q = `
      INSERT INTO client_portal_services (
        name, description, service_data, is_public, allowed_client_ids, 
        price, currency, category, service_key,
        team_id, organization_team_id, created_by, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active')
      RETURNING id, name, description, status, is_public, created_at, service_data, price, currency, category, service_key
    `;

    const values = [
      name,
      description || null,
      finalServiceData ? JSON.stringify(finalServiceData) : null,
      is_public || false,
      allowed_client_ids || null,
      price || null,
      currency || null,
      category || null,
      finalServiceKey,
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
      service_key,
      // Image upload fields
      imageData,
      imageName,
      imageType
    } = req.body;


    // First check if service exists and belongs to team
    const checkQuery = `SELECT id, service_data, service_key FROM client_portal_services WHERE id = $1 AND organization_team_id = $2`;
    const checkResult = await db.query(checkQuery, [serviceId, teamId]);
    
    if (checkResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Service not found"));
    }

    // Validate and process service_key if provided
    if (service_key !== undefined) {
      if (service_key === null || service_key === '') {
        // Allow clearing the service_key
        // No validation needed
      } else {
        // Validate format: 2-6 uppercase alphanumeric characters
        const keyRegex = /^[A-Z0-9]{2,6}$/;
        const upperKey = service_key.toUpperCase();
        if (!keyRegex.test(upperKey)) {
          return res.status(400).send(new ServerResponse(false, null, "Service key must be 2-6 uppercase alphanumeric characters (A-Z, 0-9)"));
        }
        
        // Check if service_key already exists for this organization (excluding current service)
        const keyCheck = await db.query(
          `SELECT id FROM client_portal_services WHERE organization_team_id = $1 AND service_key = $2 AND id != $3`,
          [teamId, upperKey, serviceId]
        );
        if (keyCheck.rows.length > 0) {
          return res.status(400).send(new ServerResponse(false, null, `Service key "${upperKey}" is already in use. Please choose a different key.`));
        }
      }
    }

    let finalServiceData = service_data ? { ...service_data } : undefined;

    // Handle image upload if provided
    if (imageData && imageName && imageType) {
      
      // Validate image
      const allowedImageTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (!allowedImageTypes.includes(imageType)) {
        return res.status(400).send(new ServerResponse(false, null, "Only JPEG, PNG, GIF, and WebP images are allowed"));
      }

      // Validate file size (assuming base64 data) - 5MB limit
      const fileSizeBytes = Math.floor((imageData.length * 3) / 4);
      const maxSizeBytes = 5 * 1024 * 1024; // 5MB limit
      
      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).send(new ServerResponse(false, null, "Image size exceeds 5MB limit"));
      }

      // Get current service data to check for existing images to clean up
      const currentServiceData = checkResult.rows[0]?.service_data || {};
      const oldImageUrls = currentServiceData?.images || [];

      // Clean up old images from S3 (async, don't wait for completion)
      if (oldImageUrls.length > 0) {
        oldImageUrls.forEach(async (oldImageUrl: string) => {
          try {
            const urlParts = oldImageUrl.split("/");
            const storageKey = urlParts.slice(-4).join("/");
            
            await deleteObject(storageKey);
          } catch (deleteError) {
            // Don't fail the update if image cleanup fails
          }
        });
      }

      // Generate unique filename and storage key
      const fileExtension = imageName.substring(imageName.lastIndexOf("."));
      const uniqueFileName = `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}${fileExtension}`;
      // Use getClientPortalStorageKey to ensure files are stored under organizations/{teamId}/client-portal/
      if (!teamId) {
        return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
      }
      const storageKey = getClientPortalStorageKey("service-images", teamId, uniqueFileName);

      try {
        // Upload to S3
        const imageUrl = await uploadBase64(imageData, storageKey);
        
        if (!imageUrl) {
          return res.status(500).send(new ServerResponse(false, null, "Failed to upload service image"));
        }

        // Use current service data as base if finalServiceData wasn't provided
        if (!finalServiceData) {
          finalServiceData = currentServiceData;
        }

        // Add new image URL to service data
        finalServiceData = {
          ...finalServiceData,
          images: [imageUrl]
        };

      } catch (uploadError) {
        return res.status(500).send(new ServerResponse(false, null, "Failed to upload service image"));
      }
    }


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

    if (finalServiceData !== undefined) {
      updateFields.push(`service_data = $${paramIndex}`);
      updateValues.push(JSON.stringify(finalServiceData));
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

    if (price !== undefined) {
      updateFields.push(`price = $${paramIndex}`);
      updateValues.push(price);
      paramIndex++;
    }

    if (currency !== undefined) {
      updateFields.push(`currency = $${paramIndex}`);
      updateValues.push(currency);
      paramIndex++;
    }

    if (category !== undefined) {
      updateFields.push(`category = $${paramIndex}`);
      updateValues.push(category);
      paramIndex++;
    }

    if (service_key !== undefined) {
      updateFields.push(`service_key = $${paramIndex}`);
      updateValues.push(service_key ? service_key.toUpperCase() : null);
      paramIndex++;
    }

    if (updateFields.length === 1) {
      return res.status(400).send(new ServerResponse(false, null, "No valid fields to update"));
    }

    const q = `
      UPDATE client_portal_services 
      SET ${updateFields.join(", ")}
      WHERE id = $1 AND organization_team_id = $2
      RETURNING id, name, description, status, is_public, updated_at, service_data, price, currency, category, service_key
    `;

    const result = await db.query(q, updateValues);
    const [data] = result.rows;

    if (!data) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to update service"));
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

    // Get service data before deletion to extract image URLs for cleanup
    const serviceQuery = `
      SELECT service_data 
      FROM client_portal_services 
      WHERE id = $1 AND organization_team_id = $2
    `;
    const serviceResult = await db.query(serviceQuery, [serviceId, teamId]);
    
    if (serviceResult.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Service not found"));
    }

    const serviceData = serviceResult.rows[0].service_data;
    const imageUrls = serviceData?.images || [];


    // Delete the service from database first
    const deleteQuery = `
      DELETE FROM client_portal_services 
      WHERE id = $1 AND organization_team_id = $2
    `;

    const result = await db.query(deleteQuery, [serviceId, teamId]);

    if (result.rowCount === 0) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to delete service from database"));
    }

    // Clean up images from S3 storage (async, don't wait for completion)
    if (imageUrls.length > 0) {
      
      imageUrls.forEach(async (imageUrl: string) => {
        try {
          // Extract storage key from URL
          // URL format: https://s3-bucket/{env}/organizations/{teamId}/client-portal/service-images/filename
          // or: https://s3-bucket/client-portal/service-images/teamId/filename (legacy)
          const urlParts = imageUrl.split("/");
          // Check if it's the new format (contains "organizations")
          const orgIndex = urlParts.findIndex(part => part === "organizations");
          let storageKey;
          if (orgIndex !== -1) {
            // New format: extract from organizations onwards
            storageKey = urlParts.slice(orgIndex).join("/");
          } else {
            // Legacy format: extract last 4 parts
            storageKey = urlParts.slice(-4).join("/");
          }
          
            await deleteObject(storageKey);
        } catch (deleteError) {
          // Don't fail the service deletion if image cleanup fails
        }
      });
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
    return ClientPortalClientsController.getClients(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async createPortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.createClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.getClientById(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientDetails(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.getClientDetails(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async updatePortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.updateClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async deletePortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.deleteClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async activatePortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.activateClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async setClientInviteSlug(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.setClientInviteSlug(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async suggestClientInviteSlug(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.suggestClientInviteSlug(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.getClientProjects(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async assignProjectToPortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.assignProjectToClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async removeProjectFromPortalClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.removeProjectFromClient(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalTeamController.getClientTeam(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async invitePortalTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalTeamController.inviteTeamMember(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async updatePortalTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalTeamController.updateTeamMember(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async removePortalTeamMember(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalTeamController.removeTeamMember(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async resendPortalTeamInvitation(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalTeamController.resendTeamInvitation(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.getClientStats(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalClientActivity(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.getClientActivity(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async exportPortalClientData(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.exportClientData(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async bulkUpdatePortalClients(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalBulkController.bulkUpdateClients(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async bulkDeletePortalClients(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalBulkController.bulkDeleteClients(modifiedReq, res as any);
  }

  // Organization-side Client Portal Projects Management (wrapper methods)
  
  @HandleExceptions()
  public static async getPortalProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalProjectsController.getProjects(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async getPortalProjectById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalProjectsController.getProjectDetails(modifiedReq, res as any);
  }

  // Organization-side Client Portal Invoices Management (wrapper methods)
  
  @HandleExceptions()
  public static async getPortalInvoices(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.getOrganizationInvoices(req, res);
  }

  @HandleExceptions()
  public static async createPortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.createInvoice(req, res as any);
  }

  @HandleExceptions()
  public static async getPortalInvoiceById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.getOrganizationInvoiceDetails(req, res);
  }

  @HandleExceptions()
  public static async payPortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalInvoicesController.payInvoice(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async downloadPortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalInvoicesController.downloadInvoice(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async updatePortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.updateInvoice(req, res);
  }

  @HandleExceptions()
  public static async deletePortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.deleteInvoice(req, res);
  }

  @HandleExceptions()
  public static async sendPortalInvoice(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.sendInvoice(req, res);
  }

  @HandleExceptions()
  public static async markPortalInvoiceAsPaid(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalInvoicesController.markInvoiceAsPaid(req, res);
  }

  // Organization-side Client Portal Chats Management (wrapper methods)
  
  @HandleExceptions()
  public static async getPortalChats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Extract clientId from query params (optional) and organizationId from user's team
    const clientId = req.query?.clientId as string | undefined;
    const organizationId = req.user?.team_id;
    
    if (!organizationId) {
      return res.status(400).json(new ServerResponse(false, null, "Organization ID is required"));
    }
    
    // If clientId is provided, use the client-specific endpoint
    // Otherwise, get all chats for the organization
    if (clientId) {
      const modifiedReq = {
        ...req,
        user: req.user,
        clientId,
        organizationId
      } as any;
      return ClientPortalChatController.getChats(modifiedReq, res as any);
    } else {
      // Get all chats for the organization (across all clients)
      try {
        const { page = 1, limit = 20 } = req.query;
        const offset = (Number(page) - 1) * Number(limit);
        
        const query = `
          WITH chat_summary AS (
            SELECT
              c.id as client_id,
              c.name as client_name,
              c.email as client_email,
              DATE(m.created_at) as chat_date,
              COUNT(*) as message_count,
              MAX(m.created_at) as last_message_at,
              MAX(CASE WHEN m.sender_type = 'team_member' THEN m.created_at END) as last_team_message_at,
              COUNT(CASE WHEN m.read_at IS NULL AND m.sender_type = 'team_member' THEN 1 END) as unread_count
            FROM client_portal_chat_messages m
            JOIN clients c ON m.client_id = c.id
            WHERE m.organization_team_id = $1
            GROUP BY c.id, c.name, c.email, DATE(m.created_at)
          ),
          last_messages AS (
            SELECT DISTINCT ON (m.client_id, DATE(m.created_at))
              m.client_id,
              DATE(m.created_at) as chat_date,
              m.message as last_message_text
            FROM client_portal_chat_messages m
            WHERE m.organization_team_id = $1
            ORDER BY m.client_id, DATE(m.created_at), m.created_at DESC
          )
          SELECT
            cs.client_id,
            cs.client_name,
            cs.client_email,
            cs.chat_date,
            cs.message_count,
            cs.last_message_at,
            cs.last_team_message_at,
            cs.unread_count,
            lm.last_message_text
          FROM chat_summary cs
          LEFT JOIN last_messages lm ON cs.client_id = lm.client_id AND cs.chat_date = lm.chat_date
          ORDER BY cs.last_message_at DESC
          LIMIT $2 OFFSET $3
        `;
        
        const result = await db.query(query, [organizationId, Number(limit), offset]);
        
        const countQuery = `
          SELECT COUNT(DISTINCT (client_id, DATE(created_at))) as total
          FROM client_portal_chat_messages
          WHERE organization_team_id = $1
        `;
        const countResult = await db.query(countQuery, [organizationId]);
        const total = parseInt(countResult.rows[0]?.total || "0");
        
        const chats = result.rows.map((row: any) => ({
          id: `${row.client_id}-${row.chat_date}`,
          clientId: row.client_id,
          clientName: row.client_name,
          clientEmail: row.client_email,
          date: row.chat_date,
          messageCount: parseInt(row.message_count || "0"),
          lastMessageAt: row.last_message_at,
          lastTeamMessageAt: row.last_team_message_at,
          unreadCount: parseInt(row.unread_count || "0"),
          hasNewMessages: row.unread_count > 0,
          lastMessage: row.last_message_text || null,
        }));
        
        return res.json(new ServerResponse(true, {
          chats,
          total,
          page: Number(page),
          limit: Number(limit)
        }, "Chats retrieved successfully"));
      } catch (error) {
        console.error("Error fetching organization chats:", error);
        return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve chats"));
      }
    }
  }

  @HandleExceptions()
  public static async createPortalChat(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      // For organization-side, we need to extract clientId from request body or query
      // and organizationId from user's team
      const clientId = req.body?.clientId || req.query?.clientId;
      const organizationId = req.user?.team_id;
      const userId = req.user?.id;
      const { subject, message } = req.body;
      
      if (!clientId) {
        return res.status(400).json(new ServerResponse(false, null, "Client ID is required"));
      }
      
      if (!organizationId) {
        return res.status(400).json(new ServerResponse(false, null, "Organization ID is required"));
      }
      
      if (!userId) {
        return res.status(400).json(new ServerResponse(false, null, "User ID is required"));
      }
      
      // Validate required fields
      if (!message || message.trim().length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "Message content is required"));
      }
      
      if (!subject || subject.trim().length === 0) {
        return res.status(400).json(new ServerResponse(false, null, "Subject is required"));
      }
      
      // Verify client exists and belongs to organization
      const clientQuery = await db.query(
        "SELECT id, name, email FROM clients WHERE id = $1 AND team_id = $2",
        [clientId, organizationId]
      );
      
      if (clientQuery.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }
      
      const client = clientQuery.rows[0];
      
      // Get user name for sender
      const userQuery = await db.query(
        "SELECT name FROM users WHERE id = $1",
        [userId]
      );
      const userName = userQuery.rows[0]?.name || "Team Member";
      
      // Create the first message with subject in the format "Subject: {subject}\n\n{message}"
      const fullMessage = `Subject: ${subject.trim()}\n\n${message.trim()}`;
      
      // Insert message with team_member as sender_type (organization-side)
      // Extract date in database timezone for chatId generation
      const insertQuery = `
        INSERT INTO client_portal_chat_messages (
          client_id, organization_team_id, sender_type, sender_id,
          message, message_type, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
        RETURNING id, sender_type, sender_id, message, message_type, created_at,
          DATE(created_at AT TIME ZONE 'UTC') as chat_date
      `;
      
      const result = await db.query(insertQuery, [
        clientId,
        organizationId,
        "team_member", // Organization-side: sender is team_member
        userId, // Use team member's user ID
        fullMessage,
        "text",
      ]);
      
      const newMessage = result.rows[0];
      
      // Get user's timezone for timezone-aware date extraction
      let userTimezone = "UTC";
      try {
        const timezoneQuery = await db.query(
          `SELECT tz.name as timezone 
           FROM users u 
           JOIN timezones tz ON u.timezone_id = tz.id 
           WHERE u.id = $1`,
          [userId]
        );
        userTimezone = timezoneQuery.rows[0]?.timezone || "UTC";
      } catch (err) {
        console.error("Error fetching user timezone:", err);
      }
      
      // Generate proper chatId format: clientId-date using timezone-aware date extraction
      // Convert timestamp to user's timezone and extract date to avoid UTC date shift issues
      const chatDate = moment.tz(newMessage.created_at, userTimezone).format('YYYY-MM-DD');
      const chatId = `${clientId}-${chatDate}`;
      
      // Emit socket events for real-time updates
      try {
        const io = IO.getInstance();
        if (io) {
          // Emit to organization team members
          io.emit(`client_portal:new_message`, {
            id: newMessage.id,
            clientId,
            organizationId,
            senderName: userName,
            senderType: "team_member",
            message: newMessage.message,
            messageType: newMessage.message_type,
            createdAt: newMessage.created_at,
          });
          
          // Emit chat message event
          io.emit("chat:message_received", {
            id: newMessage.id,
            chatId: chatId,
            clientId,
            organizationId,
            senderId: userId,
            senderName: userName,
            senderType: "team_member",
            message: newMessage.message,
            messageType: newMessage.message_type,
            createdAt: newMessage.created_at,
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
            chatId: chatId,
            message: "Chat created successfully",
          },
          "Conversation started successfully!"
        )
      );
    } catch (error) {
      console.error("Error creating portal chat:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create chat"));
    }
  }

  @HandleExceptions()
  public static async getPortalChatById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Parse chatId to extract clientId and date
    // chatId format: clientId-date (e.g., "uuid-2025-01-30")
    const chatId = req.params.id;
    const clientId = req.query?.clientId as string | undefined;
    
    if (!chatId) {
      return res.status(400).json(new ServerResponse(false, null, "Chat ID is required"));
    }
    
    // Try to extract clientId and date from chatId if not provided in query
    let extractedClientId = clientId;
    let dateStr = chatId;
    
    if (!extractedClientId && chatId.includes('-')) {
      // Parse format: clientId-date
      const parts = chatId.split('-');
      if (parts.length >= 4) {
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        // Date format: YYYY-MM-DD
        // So we need to find where the date starts (last 3 parts should be date)
        const dateParts = parts.slice(-3);
        const dateStrTest = dateParts.join('-');
        // Validate date format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrTest)) {
          extractedClientId = parts.slice(0, -3).join('-');
          dateStr = dateStrTest;
        }
      }
    }
    
    if (!extractedClientId) {
      return res.status(400).json(new ServerResponse(false, null, "Client ID is required"));
    }
    
    const organizationId = req.user?.team_id;
    if (!organizationId) {
      return res.status(400).json(new ServerResponse(false, null, "Organization ID is required"));
    }
    
    const modifiedReq = {
      ...req,
      user: req.user,
      params: { ...req.params, id: dateStr },
      clientId: extractedClientId,
      organizationId
    } as any;
    return ClientPortalChatController.getChatDetails(modifiedReq, res as any);
  }

  @HandleExceptions()
  public static async sendPortalMessage(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Parse chatId to extract clientId
    // chatId format: clientId-date (e.g., "uuid-2025-01-30")
    const chatId = req.params.chatId;
    const clientId = req.body?.clientId || req.query?.clientId as string | undefined;
    const { content, message, attachments } = req.body?.messageData || req.body || {};
    const messageText = content || message;
    
    if (!chatId) {
      return res.status(400).json(new ServerResponse(false, null, "Chat ID is required"));
    }
    
    if (!messageText || messageText.trim().length === 0) {
      return res.status(400).json(new ServerResponse(false, null, "Message content is required"));
    }
    
    // Try to extract clientId from chatId if not provided
    let extractedClientId = clientId;
    
    if (!extractedClientId && chatId.includes('-')) {
      // Parse format: clientId-date
      const parts = chatId.split('-');
      if (parts.length >= 4) {
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
        // Date format: YYYY-MM-DD
        // So we need to find where the date starts (last 3 parts should be date)
        const dateParts = parts.slice(-3);
        const dateStrTest = dateParts.join('-');
        // Validate date format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrTest)) {
          extractedClientId = parts.slice(0, -3).join('-');
        }
      }
    }
    
    if (!extractedClientId) {
      return res.status(400).json(new ServerResponse(false, null, "Client ID is required"));
    }
    
    const organizationId = req.user?.team_id;
    if (!organizationId) {
      return res.status(400).json(new ServerResponse(false, null, "Organization ID is required"));
    }
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(400).json(new ServerResponse(false, null, "User ID is required"));
    }
    
    // Get user name for sender
    const userQuery = await db.query(
      "SELECT name FROM users WHERE id = $1",
      [userId]
    );
    const userName = userQuery.rows[0]?.name || 'Team Member';
    
    try {
      // Insert message as team_member
      const insertQuery = `
        INSERT INTO client_portal_chat_messages (
          client_id, organization_team_id, sender_type, sender_id, 
          message, message_type, file_url, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, sender_type, sender_id, message, message_type, file_url, created_at
      `;

      const result = await db.query(insertQuery, [
        extractedClientId,
        organizationId,
        "team_member",
        userId,
        messageText.trim(),
        "text",
        null, // file_url can be added later for attachments
      ]);

      const newMessage = result.rows[0];

      // Emit socket events for real-time updates
      try {
        const io = IO.getInstance();
        if (io) {
          // Emit to organization team members and client
          io.emit(`client_portal:new_message`, {
            id: newMessage.id,
            clientId: extractedClientId,
            organizationId,
            senderName: userName,
            senderType: "team_member",
            message: newMessage.message,
            messageType: newMessage.message_type,
            fileUrl: newMessage.file_url,
            createdAt: newMessage.created_at,
          });

          // Emit chat message event
          io.emit("chat:message_received", {
            id: newMessage.id,
            chatId: chatId,
            senderId: userId,
            senderName: userName,
            senderType: "team_member",
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
            isFromClient: false,
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

  @HandleExceptions()
  public static async getPortalMessages(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // Parse chatId to extract clientId and date
    // chatId format: clientId-date (e.g., "uuid-2025-01-30")
    const chatId = req.params.chatId;
    const clientId = req.query?.clientId as string | undefined;
    
    if (!chatId) {
      return res.status(400).json(new ServerResponse(false, null, "Chat ID is required"));
    }
    
    // Always try to extract clientId and date from chatId
    let extractedClientId = clientId;
    let dateStr = chatId;
    
    if (chatId.includes('-')) {
      // Parse format: clientId-date
      const parts = chatId.split('-');
      if (parts.length >= 8) {
        // UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx (5 parts)
        // Date format: YYYY-MM-DD (3 parts)
        // Total: 8 parts minimum
        // So we need to find where the date starts (last 3 parts should be date)
        const dateParts = parts.slice(-3);
        const dateStrTest = dateParts.join('-');
        // Validate date format (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}$/.test(dateStrTest)) {
          // Extract clientId from the remaining parts if not provided in query
          if (!extractedClientId) {
            extractedClientId = parts.slice(0, -3).join('-');
          }
          dateStr = dateStrTest;
        }
      }
    }
    
    if (!extractedClientId) {
      return res.status(400).json(new ServerResponse(false, null, "Client ID is required"));
    }
    
    const organizationId = req.user?.team_id;
    if (!organizationId) {
      return res.status(400).json(new ServerResponse(false, null, "Organization ID is required"));
    }
    
    // Use getChatDetails which filters by date (more appropriate for organization-side)
    const modifiedReq = {
      ...req,
      user: req.user,
      params: { ...req.params, id: dateStr },
      clientId: extractedClientId,
      organizationId
    } as any;
    return ClientPortalChatController.getChatDetails(modifiedReq, res as any);
  }

  // Organization-side Client Portal Dashboard (wrapper method)
  
  @HandleExceptions()
  public static async getPortalDashboard(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalDashboardController.getDashboard(modifiedReq, res as any);
  }

  // Organization-side Client Portal Invitation Management

  @HandleExceptions()
  public static async generateClientInvitationLink(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalAuthController.generateClientInvitationLink(req, res);
  }

  @HandleExceptions()
  public static async resendClientInvitation(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    return ClientPortalAuthController.resendClientInvitation(req, res);
  }

  @HandleExceptions()
  public static async sendInvitationToExistingClient(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const modifiedReq = {
      ...req,
      user: req.user
    } as any;
    return ClientPortalClientsController.sendInvitationToExistingClient(modifiedReq, res as any);
  }

  // Organization-side Client Portal Request Comments

  @HandleExceptions()
  public static async getClientRequestComments(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const requestId = req.params.id;

    // Verify request belongs to this team
    const requestCheck = await db.query(
      "SELECT id, admin_comments_viewed_at FROM client_portal_requests WHERE id = $1 AND organization_team_id = $2",
      [requestId, teamId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    // Update admin_comments_viewed_at timestamp when admin views comments
    await db.query(
      "UPDATE client_portal_requests SET admin_comments_viewed_at = NOW() WHERE id = $1 AND organization_team_id = $2",
      [requestId, teamId]
    );

    const adminViewedAt = requestCheck.rows[0].admin_comments_viewed_at;

    // Get all comments
    const q = `
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

    const result = await db.query(q, [requestId, teamId]);

    // Count new comments from CLIENTS only (not team member messages)
    let newCommentsCount = 0;
    if (adminViewedAt) {
      newCommentsCount = result.rows.filter(
        (comment: any) => new Date(comment.created_at) > new Date(adminViewedAt) && comment.sender_type === 'client'
      ).length;
    } else {
      // If never viewed, count only client comments as new
      newCommentsCount = result.rows.filter(
        (comment: any) => comment.sender_type === 'client'
      ).length;
    }

    return res.status(200).send(new ServerResponse(true, {
      comments: result.rows,
      totalCount: result.rows.length,
      newCommentsCount: newCommentsCount
    }));
  }

  @HandleExceptions()
  public static async addClientRequestComment(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const userName = req.user?.name;
    const requestId = req.params.id;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).send(new ServerResponse(false, null, "Comment is required"));
    }

    // Validate comment length (max 5000 characters)
    const MAX_COMMENT_LENGTH = 5000;
    if (comment.trim().length > MAX_COMMENT_LENGTH) {
      return res.status(400).send(new ServerResponse(false, null, `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`));
    }

    // Sanitize comment to prevent XSS attacks
    const sanitizedComment = sanitizeCommentContent(comment.trim());

    // Verify request belongs to this team and get client_id
    const requestCheck = await db.query(
      "SELECT id, client_id FROM client_portal_requests WHERE id = $1 AND organization_team_id = $2",
      [requestId, teamId]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).send(new ServerResponse(false, null, "Request not found"));
    }

    const clientId = requestCheck.rows[0].client_id;

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
      requestId,
      teamId,
      clientId,
      sanitizedComment,
      'team_member',
      userId,
      userName
    ]);

    const newComment = result.rows[0];

    // Send email notification to client
    try {
      // Get request details and client email
      const requestDetails = await db.query(
        `SELECT r.req_no, s.name as service_name, c.name as client_name, 
                u.email as client_email, t.name as team_name, cps.slug as portal_slug
         FROM client_portal_requests r
         JOIN client_portal_services s ON r.service_id = s.id
         JOIN clients c ON r.client_id = c.id
         LEFT JOIN client_relationships cr ON cr.client_id = c.id AND cr.organization_team_id = r.organization_team_id
         LEFT JOIN users u ON cr.user_id = u.id
         JOIN teams t ON t.id = r.organization_team_id
         LEFT JOIN client_portal_settings cps ON cps.organization_team_id = r.organization_team_id
         WHERE r.id = $1`,
        [requestId]
      );

      if (requestDetails.rows.length > 0 && requestDetails.rows[0].client_email) {
        const { req_no, service_name, client_name, client_email, team_name, portal_slug } = requestDetails.rows[0];
        
        // Build client portal URL
        const clientPortalBaseUrl = getClientPortalBaseUrl();
        const requestUrl = portal_slug 
          ? `${clientPortalBaseUrl}/${portal_slug}/requests/${requestId}`
          : `${clientPortalBaseUrl}/requests/${requestId}`;

        await sendClientPortalRequestCommentNotification(client_email, {
          greeting: `Hello ${client_name}`,
          summary: `New reply on your request ${req_no}`,
          senderName: userName || "Team Member",
          senderType: 'team_member',
          comment: comment.trim().substring(0, 500) + (comment.trim().length > 500 ? '...' : ''),
          requestNumber: req_no,
          serviceName: service_name,
          requestUrl: requestUrl,
          teamName: team_name
        });
      }
    } catch (emailError) {
      console.error("Error sending comment notification email to client:", emailError);
    }

    return res.status(200).send(new ServerResponse(true, newComment, "Comment added successfully"));
  }

  @HandleExceptions()
  public static async uploadPortalChatFile(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const organizationId = req.user?.team_id;
      const { fileData, fileName, fileType, clientId } = req.body;

      if (!fileData || !fileName) {
        return res.status(400).json(new ServerResponse(false, null, "File data and filename are required"));
      }

      const fileSizeBytes = Math.floor((fileData.length * 3) / 4);
      const maxSizeBytes = 10 * 1024 * 1024; // 10MB limit
      if (fileSizeBytes > maxSizeBytes) {
        return res.status(400).json(new ServerResponse(false, null, "File size exceeds 10MB limit"));
      }

      const allowedTypes = [
        "image/jpeg", "image/png", "image/gif", "image/webp",
        "application/pdf", "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain", "text/csv"
      ];
      if (fileType && !allowedTypes.includes(fileType)) {
        return res.status(400).json(new ServerResponse(false, null, "File type not allowed"));
      }

      const ext = fileName.includes('.') ? fileName.split('.').pop() : 'bin';
      const uniqueFileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const storageKey = getClientPortalStorageKey(
        "chat-files",
        organizationId as string,
        clientId || "admin",
        uniqueFileName
      );

      const fileUrl = await uploadBase64(fileData, storageKey);
      if (!fileUrl) {
        return res.status(500).json(new ServerResponse(false, null, "Failed to upload file"));
      }

      return res.json(new ServerResponse(true, { url: fileUrl, fileName }, "File uploaded successfully"));
    } catch (error) {
      console.error("Error uploading chat file:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to upload file"));
    }
  }

}
