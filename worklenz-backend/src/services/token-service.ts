import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../config/db";
import { getJwtSecret } from "../shared/jwt-secret";
import { generatePrefixedToken, isValidBase62 } from "../utils/base62";

interface ClientOrganization {
  id: string;
  name: string;
  clientName?: string;
  /** The team's Portal Title (Portal Settings > Branding); what the client sees as the portal's name. */
  portalTitle?: string | null;
  teamId: string;
  clientId: string;
  isDefault: boolean;
}

interface ClientTokenPayload {
  clientId: string;
  organizationId: string;
  clientUserId?: string;
  email: string;
  permissions: string[];
  availableOrganizations?: ClientOrganization[];
  type: "client" | "invite";
}

interface InviteTokenPayload {
  clientId: string;
  email: string;
  name: string;
  role: string;
  invitedBy: string;
  expiresAt: number;
  type: "invite";
}

interface OrganizationInviteTokenPayload {
  teamId: string;
  type: "organization_invite";
  invitedBy: string;
  expiresAt: number;
  organizationName: string;
}

class TokenService {
  private readonly SECRET_KEY = getJwtSecret();
  private readonly INVITE_SECRET = process.env.INVITE_SECRET || "invite-secret-key";

  // Generate client access token
  generateClientToken(payload: ClientTokenPayload): string {
    return jwt.sign(payload, this.SECRET_KEY, {
      expiresIn: "24h",
      issuer: "worklenz-client-portal",
      audience: "client"
    });
  }

  // Generate invitation token (short Base62 token with prefix)
  generateInviteToken(payload?: InviteTokenPayload): string {
    // Generate a secure Base62 token with "wli" prefix (Worklenz Invite)
    // 10 bytes = ~14 base62 characters + prefix = ~18 total characters
    // This is much shorter than the previous 64-character hex token
    // Example: wli_aB3xK9pL2mN4qR
    return generatePrefixedToken('wli', 10);
  }

  // Generate organization invitation token
  generateOrganizationInviteToken(payload: OrganizationInviteTokenPayload): string {
    return jwt.sign(payload, this.INVITE_SECRET, {
      expiresIn: "7d", // Organization invitations expire in 7 days
      issuer: "worklenz-client-portal",
      audience: "organization_invite"
    });
  }

  // Check if a token is an organization invite token (JWT format)
  isOrganizationInviteToken(token: string): boolean {
    // Organization invite tokens are JWTs (3 parts separated by dots)
    // Regular invite tokens start with a prefix like `wli_`
    return token.split('.').length === 3;
  }

  // Verify client token
  verifyClientToken(token: string): ClientTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.SECRET_KEY, {
        issuer: "worklenz-client-portal",
        audience: "client"
      }) as ClientTokenPayload;
      return decoded;
    } catch (error) {
      console.error("Token verification failed:", error);
      return null;
    }
  }

  // Verify invitation token (now uses database lookup instead of JWT verification)
  async verifyInviteToken(token: string): Promise<InviteTokenPayload | null> {
    try {
      // Look up invitation from database
      const invitation = await this.getInvitationByToken(token);
      
      if (!invitation) {
        return null;
      }
      
      // Return token payload structure for backward compatibility
      return {
        clientId: invitation.client_id,
        email: invitation.email,
        name: invitation.name,
        role: invitation.role,
        invitedBy: invitation.invited_by,
        expiresAt: new Date(invitation.expires_at).getTime(),
        type: "invite"
      };
    } catch (error) {
      console.error("Invite token verification failed:", error);
      return null;
    }
  }

  // Verify organization invitation token
  verifyOrganizationInviteToken(token: string): OrganizationInviteTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.INVITE_SECRET, {
        issuer: "worklenz-client-portal",
        audience: "organization_invite"
      }) as OrganizationInviteTokenPayload;
      
      // Check if token is expired
      if (Date.now() > decoded.expiresAt) {
        return null;
      }
      
      return decoded;
    } catch (error) {
      console.error("Organization invite token verification failed:", error);
      return null;
    }
  }

  // Create invitation record in database
  async createInvitation(inviteData: {
    clientId: string;
    email: string;
    name: string;
    role: string;
    invitedBy: string;
    token: string;
    // The company user this invitation is for, so its portal status can be read per user.
    clientContactId?: string | null;
  }): Promise<string> {
    const query = `
      INSERT INTO client_invitations (
        id, client_id, email, name, role, invited_by, token, status, created_at, expires_at, client_contact_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '7 days', $9)
      RETURNING id
    `;

    const invitationId = crypto.randomUUID();
    const values = [
      invitationId,
      inviteData.clientId,
      inviteData.email,
      inviteData.name,
      inviteData.role,
      inviteData.invitedBy,
      inviteData.token,
      "pending",
      inviteData.clientContactId ?? null
    ];

    const result = await db.query(query, values);
    return result.rows[0].id;
  }

  // Get invitation by token
  async getInvitationByToken(token: string): Promise<any> {
    const query = `
      SELECT ci.*, c.name as client_name, c.company_name, c.team_id, t.name as team_name
      FROM client_invitations ci
      JOIN clients c ON ci.client_id = c.id
      LEFT JOIN teams t ON c.team_id = t.id
      WHERE ci.token = $1 AND ci.status = 'pending' AND ci.expires_at > NOW()
        -- A disabled company user can't accept, even with a link that was sent before
        AND NOT EXISTS (
          SELECT 1 FROM client_contacts cc
          WHERE cc.id = ci.client_contact_id AND cc.disabled_at IS NOT NULL
        )
    `;

    const result = await db.query(query, [token]);
    return result.rows[0] || null;
  }

  // Get client permissions
  async getClientPermissions(clientId: string): Promise<string[]> {
    try {
      // Check client status first - inactive clients get read-only access
      const clientStatusQuery = `
        SELECT status
        FROM clients
        WHERE id = $1
        LIMIT 1
      `;
      const clientStatusResult = await db.query(clientStatusQuery, [clientId]);

      if (clientStatusResult.rows.length > 0 && clientStatusResult.rows[0].status === 'inactive') {
        // Inactive clients get read-only permissions (can view history but not create new content)
        return [
          "read:services",
          "read:requests",    // Can view past requests
          "read:projects",
          "read:invoices",
          "read:chats",       // Can view chat history
          "read:profile"
        ];
      }

      // Check if client has active portal access
      const accessQuery = `
        SELECT is_active
        FROM client_portal_access
        WHERE client_id = $1
        LIMIT 1
      `;
      const accessResult = await db.query(accessQuery, [clientId]);

      // If no record exists, grant full default permissions (new clients)
      // If record exists but is_active is false, return minimal permissions (disabled clients)
      if (!accessResult.rows.length) {
        // No record = new client, grant full access
        return [
          "read:services",
          "create:requests",
          "read:requests",
          "read:projects",
          "read:invoices",
          "read:chats",
          "write:chats",
          "read:profile",
          "write:profile"
        ];
      }
      
      if (!accessResult.rows[0].is_active) {
        // Record exists but disabled = restricted access
        return [
          "read:services",
          "read:profile"
        ];
      }

      // Get specific permissions from database
      const permissionsQuery = `
        SELECT DISTINCT cpp.permission_key, cpp.is_granted
        FROM client_portal_permissions cpp
        INNER JOIN client_relationships cr ON cpp.client_relationship_id = cr.id
        WHERE cr.client_id = $1 AND cpp.is_granted = TRUE
      `;
      const permissionsResult = await db.query(permissionsQuery, [clientId]);

      // If no specific permissions found, return default active client permissions
      if (!permissionsResult.rows.length) {
        return [
          "read:services",
          "create:requests",
          "read:projects",
          "read:invoices",
          "read:chats",
          "write:chats",
          "read:profile",
          "write:profile"
        ];
      }

      // Return permissions from database
      return permissionsResult.rows.map((row: any) => row.permission_key);
    } catch (error) {
      console.error("Error fetching client permissions:", error);
      // Return minimal permissions on error
      return [
        "read:services",
        "read:profile"
      ];
    }
  }

  // Generate secure random token
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  // The token only needs ids; display names are read live by GET /organizations.
  toTokenOrganizations(organizations: ClientOrganization[]): ClientOrganization[] {
    return organizations.map(({ clientName: _clientName, portalTitle: _portalTitle, ...org }) => org);
  }

  // Get all organizations a client user can currently sign in to: the contact is not disabled and
  // activated, the login is active, and the client is neither deleted, inactive nor portal-disabled.
  // Read live (not from the token) so a revoked team drops out of the switcher straight away.
  async getClientUserOrganizations(clientUserId: string): Promise<ClientOrganization[]> {
    try {
      const query = `
        SELECT
          cuo.id,
          t.name,
          c.name AS "clientName",
          (
            SELECT NULLIF(BTRIM(cps.portal_title), '')
            FROM client_portal_settings cps
            WHERE cps.organization_team_id = cuo.team_id
            LIMIT 1
          ) AS "portalTitle",
          cuo.team_id as "teamId",
          cuo.client_id as "clientId",
          cuo.is_default as "isDefault"
        FROM client_user_organizations cuo
        JOIN teams t ON cuo.team_id = t.id
        JOIN clients c ON c.id = cuo.client_id
        JOIN client_users cu ON cu.id = cuo.client_user_id
        JOIN client_contacts cc
          ON cc.client_user_id = cuo.client_user_id
         AND cc.client_id = cuo.client_id
         AND cc.team_id = cuo.team_id
        WHERE cuo.client_user_id = $1
          AND cu.status = 'active'
          AND cu.deleted_at IS NULL
          AND cc.disabled_at IS NULL
          AND cc.activated_at IS NOT NULL
          AND c.deleted_at IS NULL
          AND c.status <> 'inactive'
          AND COALESCE((SELECT cpa.is_active FROM client_portal_access cpa WHERE cpa.client_id = c.id LIMIT 1), TRUE)
        ORDER BY cuo.is_default DESC, t.name ASC
      `;

      const result = await db.query(query, [clientUserId]);
      return result.rows;
    } catch (error) {
      console.error("Error fetching client user organizations:", error);
      return [];
    }
  }

  // Check if a client user has access to a specific organization
  async hasOrganizationAccess(clientUserId: string, teamId: string): Promise<boolean> {
    try {
      const query = `
        SELECT 1
        FROM client_user_organizations
        WHERE client_user_id = $1 AND team_id = $2
        LIMIT 1
      `;

      const result = await db.query(query, [clientUserId, teamId]);
      return result.rows.length > 0;
    } catch (error) {
      console.error("Error checking organization access:", error);
      return false;
    }
  }

  // Update last accessed timestamp for an organization
  async updateOrganizationAccess(clientUserId: string, teamId: string): Promise<void> {
    try {
      const query = `
        UPDATE client_user_organizations
        SET last_accessed_at = NOW()
        WHERE client_user_id = $1 AND team_id = $2
      `;

      await db.query(query, [clientUserId, teamId]);
    } catch (error) {
      console.error("Error updating organization access:", error);
    }
  }

  // Get client_id for a specific organization
  async getClientIdForOrganization(clientUserId: string, teamId: string): Promise<string | null> {
    try {
      const query = `
        SELECT client_id
        FROM client_user_organizations
        WHERE client_user_id = $1 AND team_id = $2
        LIMIT 1
      `;

      const result = await db.query(query, [clientUserId, teamId]);
      return result.rows[0]?.client_id || null;
    } catch (error) {
      console.error("Error fetching client_id for organization:", error);
      return null;
    }
  }
}

export default new TokenService();