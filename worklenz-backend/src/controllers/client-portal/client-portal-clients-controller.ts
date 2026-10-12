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
import { ensureContactIdForClient } from "../../services/client-contacts-service";
import FileConstants from "../../shared/file-constants";
import { IEmailTemplateType } from "../../interfaces/email-template-type";
import crypto from "crypto";

type PortalStatusKey = "active" | "invited" | "not_invited" | "expired";

const PORTAL_STATUS_LABELS: Record<PortalStatusKey, { label: string; color: string }> = {
  active: { label: "Active", color: "green" },
  invited: { label: "Invited", color: "orange" },
  not_invited: { label: "Not Invited", color: "default" },
  expired: { label: "Expired", color: "red" },
};

// Portal status is derived from whether the client has an active portal user and the state of
// its latest invitation. The list, its status filter and the stats endpoint all build on these
// fragments so a client can never be counted under a different status than the one it is shown
// with. They expect the client table to be aliased as `c`.
const PORTAL_STATE_COLUMNS_SQL = `
  -- Portal access: any active client_user for this client, unless an admin disabled that person
  -- (Disable lives on the company user, see client_contacts.disabled_at)
  CASE WHEN EXISTS (
    SELECT 1 FROM client_users cu
    WHERE cu.client_id = c.id AND cu.status = 'active'
      AND NOT EXISTS (
        SELECT 1 FROM client_contacts cc
        WHERE cc.client_user_id = cu.id AND cc.client_id = c.id AND cc.disabled_at IS NOT NULL
      )
  ) THEN true ELSE false END as has_portal_access,
  -- Get the latest invitation info
  (
    SELECT ci.created_at
    FROM client_invitations ci
    WHERE ci.client_id = c.id
    ORDER BY ci.created_at DESC
    LIMIT 1
  ) as invitation_sent_at,
  (
    SELECT ci.expires_at
    FROM client_invitations ci
    WHERE ci.client_id = c.id
    ORDER BY ci.created_at DESC
    LIMIT 1
  ) as invitation_expires_at,
  -- Check if invitation was accepted
  (
    SELECT ci.status = 'accepted'
    FROM client_invitations ci
    WHERE ci.client_id = c.id
    ORDER BY ci.created_at DESC
    LIMIT 1
  ) as invitation_accepted
`;

// Reads the columns produced by PORTAL_STATE_COLUMNS_SQL. An invitation is valid until its own
// expires_at (7 days from the latest send), so resending restarts the window.
const PORTAL_STATUS_SQL = `
  CASE
    WHEN has_portal_access = true THEN 'active'
    WHEN invitation_sent_at IS NOT NULL AND COALESCE(invitation_accepted, false) = false THEN
      CASE WHEN invitation_expires_at > NOW() THEN 'invited' ELSE 'expired' END
    ELSE 'not_invited'
  END
`;

const PORTAL_STATUS_KEYS = Object.keys(PORTAL_STATUS_LABELS) as PortalStatusKey[];

export default class ClientPortalClientsController extends ClientPortalControllerBase {

  /**
   * One row per client for the global Chats inbox: every client that has at least one project
   * (a lead with no project has nothing to message about yet), whether or not it has messages.
   * The whole conversation is one thread per client, so the row id is the client id.
   * `unreadCount` is client-sent messages the team has not opened yet.
   */
  static async getChatConversations(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const teamId = (req.user as any)?.team_id;
      if (!teamId) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Organization ID is required"));
      }

      const query = `
        SELECT base.*, (${PORTAL_STATUS_SQL}) AS portal_status_key
        FROM (
          SELECT
            c.id,
            COALESCE(NULLIF(TRIM(c.company_name), ''), c.name) AS display_name,
            (SELECT COUNT(*)::int FROM projects p WHERE p.client_id = c.id) AS projects_count,
            (
              SELECT COUNT(*)::int
              FROM client_portal_chat_messages um
              WHERE um.client_id = c.id
                AND um.organization_team_id = $1
                AND um.sender_type = 'client'
                AND um.read_at IS NULL
            ) AS unread_count,
            lm.message AS last_message,
            lm.created_at AS last_message_at,
            lm.sender_type AS last_sender_type,
            lm.sender_name AS last_sender_name,
            ${PORTAL_STATE_COLUMNS_SQL}
          FROM clients c
          LEFT JOIN LATERAL (
            SELECT
              m.message,
              m.created_at,
              m.sender_type,
              CASE WHEN m.sender_type = 'team_member' THEN u.name ELSE cu.name END AS sender_name
            FROM client_portal_chat_messages m
            LEFT JOIN users u ON m.sender_type = 'team_member' AND m.sender_id = u.id
            LEFT JOIN client_users cu ON m.sender_type = 'client' AND m.sender_id = cu.id
            WHERE m.client_id = c.id AND m.organization_team_id = $1
            ORDER BY m.created_at DESC
            LIMIT 1
          ) lm ON true
          WHERE c.team_id = $1
            AND EXISTS (SELECT 1 FROM projects p WHERE p.client_id = c.id)
        ) AS base
        ORDER BY base.last_message_at DESC NULLS LAST, base.display_name ASC, base.id ASC
      `;

      const result = await db.query(query, [teamId]);

      const conversations = result.rows.map((row: any) => {
        const portalStatusKey = row.portal_status_key as PortalStatusKey;
        return {
          id: row.id,
          clientId: row.id,
          name: row.display_name,
          projectsCount: row.projects_count ?? 0,
          portalStatus: { status: portalStatusKey, ...PORTAL_STATUS_LABELS[portalStatusKey] },
          unreadCount: row.unread_count ?? 0,
          lastMessage: row.last_message ?? null,
          lastMessageAt: row.last_message_at ?? null,
          lastSenderType: row.last_sender_type ?? null,
          lastSenderName: row.last_sender_name ?? null,
        };
      });

      return res.json(new ServerResponse(true, { conversations }, null));
    } catch (error) {
      console.error("Error fetching chat conversations:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve chat conversations"));
    }
  }

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
      let baseQuery = `
        SELECT
          c.id,
          c.name,
          c.email,
          c.company_name,
          c.phone,
          c.phone_country_code,
          c.address,
          c.address_line_1,
          c.city,
          c.state,
          c.zip_code,
          c.country,
          c.contact_person,
          c.status,
          c.team_id,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT p.id) as assigned_projects_count,
          -- Most recent portal sign-in across this client's users
          (
            SELECT MAX(cu.last_login)
            FROM client_users cu
            WHERE cu.client_id = c.id
          ) as last_login_at,
          -- Every POC of the company (a company can have zero, one or several)
          COALESCE((
            SELECT array_agg(cc.name::text ORDER BY cc.created_at, cc.id)
            FROM client_contacts cc
            WHERE cc.client_id = c.id AND cc.role = 'poc'
          ), ARRAY[]::text[]) as poc_names,
          (
            SELECT COUNT(*)::int FROM client_contacts cc WHERE cc.client_id = c.id
          ) as company_users_count,
          ${PORTAL_STATE_COLUMNS_SQL}
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
          } OR c.company_name ILIKE $${queryParams.length + 1} OR c.contact_person ILIKE $${
            queryParams.length + 1
          })`
        );
        queryParams.push(`%${search}%`);
      }

      // Add status filter
      // `status` carries either a client status (inactive / pending) or a portal status
      // (active / invited / not_invited / expired). "active" is a portal status: a client with an
      // active portal user is always an active client (deactivating a client also deactivates its
      // users), so it is filtered below together with the other portal statuses.
      if (status) {
        // Normalize status to lowercase and validate
        const normalizedStatus = String(status).toLowerCase().trim();
        // Only apply filter if status is one of the valid values
        if (["inactive", "pending"].includes(normalizedStatus)) {
          // Use COALESCE to treat NULL status as 'active' (the default)
          whereConditions.push(`LOWER(COALESCE(c.status, 'active')) = $${queryParams.length + 1}`);
          queryParams.push(normalizedStatus);
        }
      }

      if (whereConditions.length > 0) {
        baseQuery += ` WHERE ${whereConditions.join(" AND ")}`;
      }

      baseQuery += ` GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.phone_country_code, c.address, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at`;

      // Portal status is a computed value derived from has_portal_access and invitation
      // data. It cannot be used in the WHERE clause above (those columns don't exist yet).
      // Wrap the base query as a subquery so the computed columns are available, then
      // apply the portal status filter and pagination on the outer query. This ensures
      // filtering happens before LIMIT/OFFSET so all matching clients across every page
      // are included and the total count is accurate.
      const normalizedPortalStatus = status ? String(status).toLowerCase().trim() : null;
      const isPortalStatusFilter =
        !!normalizedPortalStatus &&
        (PORTAL_STATUS_KEYS as string[]).includes(normalizedPortalStatus);

      const outerWhere = isPortalStatusFilter
        ? `WHERE (${PORTAL_STATUS_SQL}) = $${queryParams.length + 1}`
        : "";

      if (isPortalStatusFilter) {
        queryParams.push(normalizedPortalStatus);
      }

      // Validate sort field to prevent SQL injection.
      const sortField = String(sortBy || "name");
      const sortDirection = sortOrder === "desc" ? "DESC" : "ASC";
      const validSortFields = [
        "id",
        "name",
        "company_name",
        "created_at",
        "updated_at",
        "assigned_projects_count",
        "portal_status_key",
        "last_login_at",
        "poc_names",
      ];
      const safeSortField = validSortFields.includes(sortField) ? sortField : "name";

      // Sort by the exact field the column displays. "assigned_projects_count" is a computed
      // alias (COUNT(DISTINCT p.id)) rather than a raw column, so it needs to be referenced as-is;
      // every other field maps 1:1 to what its column shows (e.g. "name" sorts by the client's own
      // name, matching the Client column — company-name sorting belongs to the separate Company
      // column, which already sorts by "company_name").
      const sortColumn =
        safeSortField === "assigned_projects_count" ? "assigned_projects_count" : safeSortField;
      // Clients who never signed in have a null last_login_at, which should always sort to the
      // end (as the least-recent activity) regardless of direction, not lead a DESC sort.
      const sortNulls = safeSortField === "last_login_at" ? "NULLS LAST" : "";

      // Count against the filtered subquery for an accurate total.
      const countQuery = `
        SELECT COUNT(*) as total
        FROM (${baseQuery}) AS base
        ${outerWhere}
      `;

      const countResult = await db.query(countQuery, queryParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Paginated data query — ORDER BY and LIMIT/OFFSET applied after the portal filter.
      const offset = (Number(page) - 1) * Number(limit);
      // `id` breaks ties so rows never repeat or go missing between pages.
      const dataQuery = `
        SELECT base.*, (${PORTAL_STATUS_SQL}) AS portal_status_key
        FROM (${baseQuery}) AS base
        ${outerWhere}
        ORDER BY ${sortColumn} ${sortDirection} ${sortNulls}, id ASC
        LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
      `;
      queryParams.push(Number(limit), offset);

      const result = await db.query(dataQuery, queryParams);

      const clients = result.rows.map((row: any) => {
        const portalStatusKey = row.portal_status_key as PortalStatusKey;
        const portalStatus = { status: portalStatusKey, ...PORTAL_STATUS_LABELS[portalStatusKey] };

        return {
          id: row.id,
          name: row.name,
          email: row.email,
          company_name: row.company_name,
          phone: row.phone,
          phone_country_code: row.phone_country_code,
          address: row.address,
          contact_person: row.contact_person,
          poc_names: row.poc_names ?? [],
          company_users_count: row.company_users_count ?? 0,
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
          last_login_at: row.last_login_at,
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

  /**
   * Counts for the Clients page header: clients by portal status, and the client messages that
   * are still waiting for a team reply. Computed in SQL over the whole team so the numbers do not
   * depend on which page of the list is loaded.
   */
  static async getClientsStats(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const teamId = (req.user as any)?.team_id;
      if (!teamId) {
        return res
          .status(401)
          .json(new ServerResponse(false, null, "Authentication required"));
      }

      const clientsQuery = `
        WITH client_state AS (
          SELECT
            c.id,
            ${PORTAL_STATE_COLUMNS_SQL}
          FROM clients c
          WHERE c.team_id = $1
        ),
        classified AS (
          SELECT id, (${PORTAL_STATUS_SQL}) AS portal_status
          FROM client_state
        )
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE portal_status = 'active')::int AS active,
          COUNT(*) FILTER (WHERE portal_status = 'invited')::int AS invited,
          COUNT(*) FILTER (WHERE portal_status = 'expired')::int AS expired,
          COUNT(*) FILTER (WHERE portal_status = 'not_invited')::int AS not_invited
        FROM classified
      `;

      // A client message is "unanswered" while no team member has replied after it.
      const messagesQuery = `
        WITH last_team_reply AS (
          SELECT client_id, MAX(created_at) AS replied_at
          FROM client_portal_chat_messages
          WHERE organization_team_id = $1 AND sender_type = 'team_member'
          GROUP BY client_id
        )
        SELECT COUNT(*)::int AS unanswered_messages
        FROM client_portal_chat_messages m
        JOIN clients c ON c.id = m.client_id AND COALESCE(c.status, 'active') <> 'inactive'
        LEFT JOIN last_team_reply r ON r.client_id = m.client_id
        WHERE m.organization_team_id = $1
          AND m.sender_type = 'client'
          AND (r.replied_at IS NULL OR m.created_at > r.replied_at)
      `;

      const [clientsResult, messagesResult] = await Promise.all([
        db.query(clientsQuery, [teamId]),
        db.query(messagesQuery, [teamId]),
      ]);

      const counts = clientsResult.rows[0] || {};

      return res.json(
        new ServerResponse(
          true,
          {
            total: counts.total || 0,
            active: counts.active || 0,
            invited: counts.invited || 0,
            expired: counts.expired || 0,
            not_invited: counts.not_invited || 0,
            unanswered_messages: messagesResult.rows[0]?.unanswered_messages || 0,
          },
          null
        )
      );
    } catch (error) {
      console.error("Error fetching clients stats:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve clients stats"));
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
      if (!clientData.name?.trim()) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Client name is required"));
      }

      if (!clientData.company_name?.trim()) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Company name is required"));
      }

      if (!clientData.contact_person?.trim()) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Primary contact is required"));
      }
      // Trim all string fields
      clientData.name = clientData.name.trim();
      if (clientData.email) clientData.email = clientData.email.trim();
      if (clientData.company_name) clientData.company_name = clientData.company_name.trim();
      if (clientData.phone) clientData.phone = clientData.phone.trim();
      if (clientData.phone_country_code) clientData.phone_country_code = clientData.phone_country_code.trim().toUpperCase();
      if (clientData.address) clientData.address = clientData.address.trim();
      if (clientData.address_line_1) clientData.address_line_1 = clientData.address_line_1.trim();
      if (clientData.city) clientData.city = clientData.city.trim();
      if (clientData.state) clientData.state = clientData.state.trim();
      if (clientData.zip_code) clientData.zip_code = clientData.zip_code.trim();
      if (clientData.country) clientData.country = clientData.country.trim();
      if (clientData.contact_person) clientData.contact_person = clientData.contact_person.trim();

      // Check if client with same email already exists in this team
      if (clientData.email) {
        const existingClientQuery = `
          SELECT id, name, email, company_name, phone, phone_country_code, address, contact_person, status, created_at, updated_at
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
                phone_country_code: existingClient.phone_country_code,
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
          phone_country_code,
          address,
          address_line_1,
          city,
          state,
          zip_code,
          country,
          contact_person,
          status,
          team_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING id, name, email, company_name, phone, phone_country_code, address, address_line_1, city, state, zip_code, country, contact_person, status, created_at, updated_at
      `;

      const values = [
        clientData.name,
        clientData.email || null,
        clientData.company_name || null,
        clientData.phone || null,
        clientData.phone_country_code || null,
        clientData.address || null,
        clientData.address_line_1 || null,
        clientData.city || null,
        clientData.state || null,
        clientData.zip_code || null,
        clientData.country || null,
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
            phone_country_code: newClient.phone_country_code,
            address: newClient.address,
            address_line_1: newClient.address_line_1,
            city: newClient.city,
            state: newClient.state,
            zip_code: newClient.zip_code,
            country: newClient.country,
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

      // Create invitation record in database, tied to the company's contact for this email so the
      // contact's portal status can be read from it
      await TokenService.createInvitation({
        clientId: client.id,
        email: client.email,
        name: client.name,
        role: "member",
        invitedBy,
        token: inviteToken,
        clientContactId: await ensureContactIdForClient(db, teamId, client),
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
        SELECT id, name, email, company_name, phone, contact_person
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
          c.phone_country_code,
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
        GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.phone_country_code, c.address, c.address_line_1, c.city, c.state, c.zip_code, c.country, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at
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
        phone_country_code: client.phone_country_code,
        address: client.address,
        address_line_1: client.address_line_1,
        city: client.city,
        state: client.state,
        zip_code: client.zip_code,
        country: client.country,
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
          c.phone_country_code,
          c.address,
          c.address_line_1,
          c.city,
          c.state,
          c.zip_code,
          c.country,
          c.contact_person,
          c.status,
          c.team_id,
          c.created_at,
          c.updated_at,
          COUNT(DISTINCT p.id) as assigned_projects_count
        FROM clients c
        LEFT JOIN projects p ON c.id = p.client_id
        WHERE c.id = $1 AND c.team_id = $2
        GROUP BY c.id, c.name, c.email, c.company_name, c.phone, c.phone_country_code, c.address, c.address_line_1, c.city, c.state, c.zip_code, c.country, c.contact_person, c.status, c.team_id, c.created_at, c.updated_at
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
        phone_country_code: client.phone_country_code,
        address: client.address,
        address_line_1: client.address_line_1,
        city: client.city,
        state: client.state,
        zip_code: client.zip_code,
        country: client.country,
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
      if (updateData.name?.trim()) {
        updateFields.push(`name = $${paramIndex}`);
        updateValues.push(updateData.name.trim());
        paramIndex++;
      }

      if (updateData.email?.trim()) {
        updateFields.push(`email = $${paramIndex}`);
        updateValues.push(updateData.email.trim());
        paramIndex++;
      }

      if (updateData.company_name !== undefined) {
        updateFields.push(`company_name = $${paramIndex}`);
        updateValues.push(updateData.company_name?.trim() ? updateData.company_name.trim() : null);
        paramIndex++;
      }

      if (updateData.phone !== undefined) {
        updateFields.push(`phone = $${paramIndex}`);
        updateValues.push(updateData.phone?.trim() ? updateData.phone.trim() : null);
        paramIndex++;
      }

      if (updateData.phone_country_code !== undefined) {
        updateFields.push(`phone_country_code = $${paramIndex}`);
        updateValues.push(updateData.phone_country_code?.trim() ? updateData.phone_country_code.trim().toUpperCase() : null);
        paramIndex++;
      }

      if (updateData.address !== undefined) {
        updateFields.push(`address = $${paramIndex}`);
        updateValues.push(updateData.address || null);
        paramIndex++;
      }

      if (updateData.address_line_1 !== undefined) {
        updateFields.push(`address_line_1 = $${paramIndex}`);
        updateValues.push(updateData.address_line_1 || null);
        paramIndex++;
      }

      if (updateData.city !== undefined) {
        updateFields.push(`city = $${paramIndex}`);
        updateValues.push(updateData.city || null);
        paramIndex++;
      }

      if (updateData.state !== undefined) {
        updateFields.push(`state = $${paramIndex}`);
        updateValues.push(updateData.state || null);
        paramIndex++;
      }

      if (updateData.zip_code !== undefined) {
        updateFields.push(`zip_code = $${paramIndex}`);
        updateValues.push(updateData.zip_code || null);
        paramIndex++;
      }

      if (updateData.country !== undefined) {
        updateFields.push(`country = $${paramIndex}`);
        updateValues.push(updateData.country || null);
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
        RETURNING id, name, email, company_name, phone, phone_country_code, address, address_line_1, city, state, zip_code, country, contact_person, status, created_at, updated_at
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
        phone_country_code: updatedClient.phone_country_code,
        address: updatedClient.address,
        address_line_1: updatedClient.address_line_1,
        city: updatedClient.city,
        state: updatedClient.state,
        zip_code: updatedClient.zip_code,
        country: updatedClient.country,
        contact_person: updatedClient.contact_person,
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
    const dbClient = await db.pool.connect();
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await dbClient.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      await dbClient.query("BEGIN");

      // Deactivate the client instead of deleting (soft delete)
      const deactivateResult = await dbClient.query(
        "UPDATE clients SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (deactivateResult.rowCount === 0) {
        await dbClient.query("ROLLBACK");
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      // Also deactivate all client users for this client
      await dbClient.query(
        "UPDATE client_users SET status = 'inactive' WHERE client_id = $1",
        [id]
      );

      // Deactivate client portal access
      await dbClient.query(
        "UPDATE client_portal_access SET is_active = FALSE, updated_at = NOW() WHERE client_id = $1",
        [id]
      );

      await dbClient.query("COMMIT");

      return res.json(new ServerResponse(true, null, "Client deactivated successfully"));
    } catch (error) {
      await dbClient.query("ROLLBACK").catch(() => void 0);
      console.error("Error deactivating client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to deactivate client"));
    } finally {
      dbClient.release();
    }
  }

  static async activateClient(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    const dbClient = await db.pool.connect();
    try {
      const { id } = req.params;
      const teamId = (req.user as any)?.team_id;

      // Verify client exists and belongs to team
      const clientCheck = await dbClient.query(
        "SELECT id FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      await dbClient.query("BEGIN");

      // Reactivate the client
      await dbClient.query(
        "UPDATE clients SET status = 'active', updated_at = NOW() WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      // Reactivate all client users for this client
      await dbClient.query(
        "UPDATE client_users SET status = 'active' WHERE client_id = $1",
        [id]
      );

      // Reactivate client portal access
      await dbClient.query(
        "UPDATE client_portal_access SET is_active = TRUE, updated_at = NOW() WHERE client_id = $1",
        [id]
      );

      await dbClient.query("COMMIT");

      return res.json(new ServerResponse(true, null, "Client activated successfully"));
    } catch (error) {
      await dbClient.query("ROLLBACK").catch(() => void 0);
      console.error("Error activating client:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to activate client"));
    } finally {
      dbClient.release();
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
          p.end_date,
          sph.name as health_name,
          sph.color_code as health_color,
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
        LEFT JOIN sys_project_healths sph ON p.health_id = sph.id
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

      query += ` GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.end_date, sph.name, sph.color_code, p.created_at, p.updated_at`;

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
        end_date: row.end_date,
        health_name: row.health_name,
        health_color: row.health_color,
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

      // The project is no longer the company's, so drop every company user's access to it
      await db.query(
        "DELETE FROM client_contact_project_access WHERE project_id = $1",
        [projectId]
      );

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

      // Everything below reads real data. The workspace's Overview and rail show these numbers, so
      // a placeholder zero here would read as "nothing open" rather than "not counted".
      const [
        contactStats,
        requestStats,
        invoiceStats,
        outstanding,
        taskStats,
        messageStats,
        loginStats,
        portalState,
      ] = await Promise.all([
        db.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE disabled_at IS NULL)::int AS enabled
           FROM client_contacts
           WHERE client_id = $1 AND team_id = $2`,
          [id, teamId]
        ),
        db.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status NOT IN ('completed', 'cancelled', 'rejected'))::int AS pending
           FROM client_portal_requests
           WHERE client_id = $1`,
          [id]
        ),
        // An invoice is due once it has been sent and is not fully paid. Drafts are not due yet.
        db.query(
          `SELECT COUNT(*)::int AS total,
                  COUNT(*) FILTER (WHERE status IN ('sent', 'pending', 'overdue') AND payment_status <> 'paid')::int AS due
           FROM client_portal_invoices
           WHERE client_id = $1 AND organization_team_id = $2`,
          [id, teamId]
        ),
        db.query(
          `SELECT currency, SUM(amount - paid_amount)::float AS amount
           FROM client_portal_invoices
           WHERE client_id = $1 AND organization_team_id = $2
             AND status IN ('sent', 'pending', 'overdue') AND payment_status <> 'paid'
           GROUP BY currency
           ORDER BY SUM(amount - paid_amount) DESC`,
          [id, teamId]
        ),
        db.query(
          `SELECT COUNT(t.id)::int AS open_tasks
           FROM tasks t
           JOIN projects p ON p.id = t.project_id
           LEFT JOIN task_statuses ts ON ts.id = t.status_id
           LEFT JOIN sys_task_status_categories tsc ON tsc.id = ts.category_id
           WHERE p.client_id = $1 AND p.team_id = $2
             AND t.archived IS FALSE
             AND COALESCE(tsc.is_done, FALSE) = FALSE`,
          [id, teamId]
        ),
        // The same "unanswered" rule as the Clients page: client messages sent after the team's
        // last reply.
        db.query(
          `SELECT COUNT(*)::int AS unanswered
           FROM client_portal_chat_messages m
           WHERE m.client_id = $1 AND m.organization_team_id = $2 AND m.sender_type = 'client'
             AND m.created_at > COALESCE((
               SELECT MAX(r.created_at) FROM client_portal_chat_messages r
               WHERE r.client_id = $1 AND r.organization_team_id = $2 AND r.sender_type = 'team_member'
             ), 'epoch'::timestamptz)`,
          [id, teamId]
        ),
        db.query(
          `SELECT MAX(last_login) AS last_login_at, COUNT(*) FILTER (WHERE last_login IS NOT NULL)::int AS signed_in
           FROM client_users WHERE client_id = $1`,
          [id]
        ),
        db.query(
          `SELECT (${PORTAL_STATUS_SQL}) AS portal_status_key, invitation_sent_at
           FROM (
             SELECT c.id, ${PORTAL_STATE_COLUMNS_SQL}
             FROM clients c
             WHERE c.id = $1 AND c.team_id = $2
           ) AS base`,
          [id, teamId]
        ),
      ]);

      const portalStatusKey = (portalState.rows[0]?.portal_status_key ?? "not_invited") as PortalStatusKey;

      const stats = {
        totalProjects: parseInt(projectStats.rows[0]?.total_projects || "0"),
        activeProjects: parseInt(projectStats.rows[0]?.active_projects || "0"),
        completedProjects: parseInt(
          projectStats.rows[0]?.completed_projects || "0"
        ),
        // Kept for existing consumers: company users are the "team members" of a client.
        totalTeamMembers: contactStats.rows[0]?.total ?? 0,
        activeTeamMembers: contactStats.rows[0]?.enabled ?? 0,
        totalRequests: requestStats.rows[0]?.total ?? 0,
        pendingRequests: requestStats.rows[0]?.pending ?? 0,
        totalInvoices: invoiceStats.rows[0]?.total ?? 0,
        unpaidInvoices: invoiceStats.rows[0]?.due ?? 0,
        // What the client workspace shows
        tasksOpen: taskStats.rows[0]?.open_tasks ?? 0,
        invoicesDue: invoiceStats.rows[0]?.due ?? 0,
        unansweredMessages: messageStats.rows[0]?.unanswered ?? 0,
        // Money owed, per currency, largest first. Currencies are never added together.
        outstanding: outstanding.rows.map((row: any) => ({
          currency: row.currency,
          amount: Number(row.amount),
        })),
        lastLoginAt: loginStats.rows[0]?.last_login_at ?? null,
        // When the latest invitation was sent, for a client that has not signed in yet
        invitedAt: portalState.rows[0]?.invitation_sent_at ?? null,
        hasSignedIn: (loginStats.rows[0]?.signed_in ?? 0) > 0,
        portalStatus: { status: portalStatusKey, ...PORTAL_STATUS_LABELS[portalStatusKey] },
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
              WHEN i.payment_status = 'paid' THEN 'Invoice ' || i.invoice_no || ' paid'
              WHEN i.status = 'sent' THEN 'Invoice ' || i.invoice_no || ' sent'
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
            -- Seen from the team's side: the client wrote it, or a team member did.
            CASE
              WHEN m.sender_type = 'client' THEN 'Client sent a message'
              ELSE COALESCE(u.name, 'Team member') || ' sent a message'
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
          phoneCountryCode: client.phone_country_code,
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
            i.id, i.invoice_no, i.amount, i.currency, i.status, i.payment_status, i.paid_amount,
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
