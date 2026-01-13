import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { generateUniqueSlug, suggestSlug, isValidSlug } from "../../utils/slug";
import { sendEmail, sendEmailEnhanced, EmailRequest } from "../../shared/email";
import TokenService from "../../services/token-service";
import { getClientPortalBaseUrl } from "../../cron_jobs/helpers";
import FileConstants from "../../shared/file-constants";
import { IEmailTemplateType } from "../../interfaces/email-template-type";
import crypto from "crypto";

export default class ClientPortalClientsController extends ClientPortalControllerBase {

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
        // Normalize status to lowercase and validate
        const normalizedStatus = String(status).toLowerCase().trim();
        // Only apply filter if status is one of the valid values
        if (["active", "inactive", "pending"].includes(normalizedStatus)) {
          // Use COALESCE to treat NULL status as 'active' (the default)
          whereConditions.push(`LOWER(COALESCE(c.status, 'active')) = $${queryParams.length + 1}`);
          queryParams.push(normalizedStatus);
        }
      }

      if (whereConditions.length > 0) {
        query += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      query += ` GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.address, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at`;

      // Add sorting
      const sortField = String(sortBy || "name");
      const sortDirection = sortOrder === "desc" ? "DESC" : "ASC";
      // Validate sort field and ensure it's a valid column
      const validSortFields = ["id", "name", "created_at", "updated_at", "assigned_projects_count"];
      const safeSortField = validSortFields.includes(sortField)
        ? sortField
        : "name";
      
      // Handle special case for assigned_projects_count (it's an aggregated column)
      const sortColumn = safeSortField === "assigned_projects_count" 
        ? "assigned_projects_count" 
        : `c.${safeSortField}`;
      
      query += ` ORDER BY ${sortColumn} ${sortDirection}`;

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

      // Check if client with same email already exists in this team
      if (clientData.email) {
        const existingClientQuery = `
          SELECT id, name, email, company_name, phone, address, contact_person, status, created_at, updated_at
          FROM clients 
          WHERE LOWER(email) = LOWER($1) AND team_id = $2
        `;
        const existingClientResult = await db.query(existingClientQuery, [clientData.email, teamId]);
        
        if (existingClientResult.rows.length > 0) {
          const existingClient = existingClientResult.rows[0];
          
          // Check if invitation has already been sent for this client
          const existingInvitationQuery = `
            SELECT id, created_at 
            FROM client_invitations 
            WHERE client_id = $1 AND status = 'pending' AND expires_at > NOW()
            ORDER BY created_at DESC 
            LIMIT 1
          `;
          const existingInvitationResult = await db.query(existingInvitationQuery, [existingClient.id]);
          
          const invitationStatus = existingInvitationResult.rows.length > 0 
            ? "Invitation already sent" 
            : "Client already exists";
          
          return res.json(
            new ServerResponse(
              true,
              {
                id: existingClient.id,
                name: existingClient.name,
                email: existingClient.email,
                company_name: existingClient.company_name,
                phone: existingClient.phone,
                address: existingClient.address,
                contact_person: existingClient.contact_person,
                status: existingClient.status,
                created_at: existingClient.created_at,
                updated_at: existingClient.updated_at,
                assigned_projects_count: 0,
                team_members: [],
                existing: true,
                invitationStatus,
                invitationAlreadySent: existingInvitationResult.rows.length > 0
              },
              invitationStatus
            )
          );
        }
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
          await ClientPortalClientsController.sendClientInvitationEmail(
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
            existing: false,
            invitationSent: !!newClient.email
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
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
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
    } catch (error) {
      console.error("Error sending client invitation email:", error);
      throw error;
    }
  }

  static async sendInvitationToExistingClient(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id: clientId } = req.params;
      const userId = (req.user as any)?.id;
      const teamId = (req.user as any)?.team_id;

      if (!clientId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client ID is required"));
      }

      // Get client information
      const clientQuery = `
        SELECT id, name, email, company_name, phone
        FROM clients 
        WHERE id = $1 AND team_id = $2
      `;
      const clientResult = await db.query(clientQuery, [clientId, teamId]);

      if (!clientResult.rows.length) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientResult.rows[0];

      if (!client.email) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client email is required for invitation"));
      }

      // Check if client already has an active portal user
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

      // Check if there's already a pending invitation
      const pendingInviteCheck = await db.query(
        `SELECT id, created_at FROM client_invitations
         WHERE client_id = $1 AND status = 'pending' AND expires_at > NOW()
         ORDER BY created_at DESC LIMIT 1`,
        [clientId]
      );

      if (pendingInviteCheck.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "Invitation already sent. Please use the resend option if needed."
            )
          );
      }

      // Send invitation email
      await ClientPortalClientsController.sendClientInvitationEmail(
        client,
        teamId,
        userId
      );

      return res.json(
        new ServerResponse(
          true,
          {
            clientId: client.id,
            email: client.email,
            invitationSent: true
          },
          "Invitation sent successfully"
        )
      );
    } catch (error) {
      console.error("Error sending invitation to existing client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to send invitation"));
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

      if (updateData.address !== undefined) {
        updateFields.push(`address = $${paramIndex}`);
        updateValues.push(updateData.address || null);
        paramIndex++;
      }

      if (updateData.contact_person !== undefined) {
        updateFields.push(`contact_person = $${paramIndex}`);
        updateValues.push(updateData.contact_person || null);
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
        RETURNING id, name, email, company_name, phone, address, contact_person, status, created_at, updated_at
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
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update client"));
    }
  }

  static async setClientInviteSlug(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // If invite_slug is null or empty, remove it
      if (!invite_slug || invite_slug.trim() === "") {
        await db.query(
          "UPDATE clients SET invite_slug = NULL, updated_at = NOW() WHERE id = $1",
          [id]
        );

        return res.json(new ServerResponse(true, {
          id,
          invite_slug: null
        }, "Invite slug removed successfully"));
      }

      // Validate slug format
      if (!isValidSlug(invite_slug)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid slug format. Use lowercase letters, numbers, and hyphens only (3-50 characters)"));
      }

      // Check if slug is already taken
      const slugCheck = await db.query(
        "SELECT id FROM clients WHERE LOWER(invite_slug) = LOWER($1) AND id != $2",
        [invite_slug, id]
      );

      if (slugCheck.rows.length > 0) {
        return res.status(400).json(new ServerResponse(false, null, "This invite slug is already taken. Please choose another."));
      }

      // Update client with new slug
      const result = await db.query(
        "UPDATE clients SET invite_slug = LOWER($1), updated_at = NOW() WHERE id = $2 RETURNING invite_slug",
        [invite_slug, id]
      );

      return res.json(new ServerResponse(true, {
        id,
        invite_slug: result.rows[0].invite_slug,
        vanity_url: `${getClientPortalBaseUrl()}/i/${result.rows[0].invite_slug}`
      }, "Invite slug updated successfully"));
    } catch (error) {
      console.error("Error setting client invite slug:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update invite slug"));
    }
  }

  static async suggestClientInviteSlug(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Get client information
      const client = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (client.rows.length === 0) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
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

      return res.json(new ServerResponse(true, {
        suggested_slug: suggestedSlug,
        vanity_url: `${getClientPortalBaseUrl()}/i/${suggestedSlug}`
      }, "Slug suggestion generated successfully"));
    } catch (error) {
      console.error("Error suggesting client invite slug:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to generate slug suggestion"));
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

      return res.json(new ServerResponse(true, null, "Client deactivated successfully"));
    } catch (error) {
      console.error("Error deactivating client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to deactivate client"));
    }
  }

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
      // Validate and use parameterized query for day filter
      const daysNum = Number(days);
      if (isNaN(daysNum) || daysNum < 0 || daysNum > 365) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid days parameter"));
      }
      // Calculate the date threshold in JavaScript
      const thresholdDate = new Date();
      thresholdDate.setDate(thresholdDate.getDate() - daysNum);

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
          WHERE p.client_id = $1 AND p.updated_at >= $2
          ORDER BY p.updated_at DESC
        `;

        const projectResult = await db.query(projectActivitiesQuery, [id, thresholdDate]);
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
          WHERE r.client_id = $1 AND r.updated_at >= $2
          ORDER BY r.updated_at DESC
        `;

        const requestResult = await db.query(requestActivitiesQuery, [id, thresholdDate]);
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
          WHERE i.client_id = $1 AND i.created_at >= $2
          ORDER BY COALESCE(i.sent_at, i.created_at) DESC
        `;

        const invoiceResult = await db.query(invoiceActivitiesQuery, [id, thresholdDate]);
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
          WHERE m.client_id = $1 AND m.created_at >= $2
          ORDER BY m.created_at DESC
          LIMIT 50
        `;

        const chatResult = await db.query(chatActivitiesQuery, [id, thresholdDate]);
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

  // Helper method for getting relative time
  private static getRelativeTime(date: Date): string {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) {
      return `${diffInSeconds} seconds ago`;
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} hour${hours > 1 ? "s" : ""} ago`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} day${days > 1 ? "s" : ""} ago`;
    } 
      const months = Math.floor(diffInSeconds / 2592000);
      return `${months} month${months > 1 ? "s" : ""} ago`;
    
  }
}
