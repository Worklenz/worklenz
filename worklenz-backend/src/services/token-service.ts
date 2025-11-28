import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import db from "../config/db";

interface ClientOrganization {
  id: string;
  name: string;
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
  private readonly SECRET_KEY = process.env.JWT_SECRET || "your-secret-key-here";
  private readonly INVITE_SECRET = process.env.INVITE_SECRET || "invite-secret-key";

  // Generate client access token
  generateClientToken(payload: ClientTokenPayload): string {
    return jwt.sign(payload, this.SECRET_KEY, {
      expiresIn: "24h",
      issuer: "worklenz-client-portal",
      audience: "client"
    });
  }

  // Generate invitation token
  generateInviteToken(payload: InviteTokenPayload): string {
    return jwt.sign(payload, this.INVITE_SECRET, {
      expiresIn: "7d", // Invitations expire in 7 days
      issuer: "worklenz-client-portal",
      audience: "invite"
    });
  }

  // Generate organization invitation token
  generateOrganizationInviteToken(payload: OrganizationInviteTokenPayload): string {
    return jwt.sign(payload, this.INVITE_SECRET, {
      expiresIn: "7d", // Organization invitations expire in 7 days
      issuer: "worklenz-client-portal",
      audience: "organization_invite"
    });
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

  // Verify invitation token
  verifyInviteToken(token: string): InviteTokenPayload | null {
    try {
      const decoded = jwt.verify(token, this.INVITE_SECRET, {
        issuer: "worklenz-client-portal",
        audience: "invite"
      }) as InviteTokenPayload;
      
      // Check if token is expired
      if (Date.now() > decoded.expiresAt) {
        return null;
      }
      
      return decoded;
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
  }): Promise<string> {
    const query = `
      INSERT INTO client_invitations (
        id, client_id, email, name, role, invited_by, token, status, created_at, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW() + INTERVAL '7 days')
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
      "pending"
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
    `;
    
    const result = await db.query(query, [token]);
    return result.rows[0] || null;
  }

  // Accept invitation
  async acceptInvitation(token: string, userData: {
    password: string;
    name: string;
    userId?: string | null; // Optional Worklenz user ID for linking
  }): Promise<any> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      let createUserQuery: string;
      let queryParams: any[];
      const clientUserId = crypto.randomUUID();

      if (userData.userId) {
        // Linking existing Worklenz user - no password_hash needed
        createUserQuery = `
          INSERT INTO client_users (
            id, user_id, client_id, email, name, role, team_id, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
          RETURNING id, email, name, role, client_id
        `;
        queryParams = [
          clientUserId,
          userData.userId,
          invitation.client_id,
          invitation.email,
          userData.name,
          invitation.role,
          invitation.team_id
        ];
      } else {
        // Standalone client portal user - create with password_hash
        const passwordHash = crypto.createHash("sha256").update(userData.password).digest("hex");
        createUserQuery = `
          INSERT INTO client_users (
            id, client_id, email, name, password_hash, role, team_id, status, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'active', NOW(), NOW())
          RETURNING id, email, name, role, client_id
        `;
        queryParams = [
          clientUserId,
          invitation.client_id,
          invitation.email,
          userData.name,
          passwordHash,
          invitation.role,
          invitation.team_id
        ];
      }

      const userResult = await client.query(createUserQuery, queryParams);

      // Create organization access record for multi-org support
      const orgAccessQuery = `
        INSERT INTO client_user_organizations (client_user_id, team_id, client_id, is_default, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW(), NOW())
        ON CONFLICT (client_user_id, team_id) DO NOTHING
      `;
      await client.query(orgAccessQuery, [clientUserId, invitation.team_id, invitation.client_id]);

      // Update invitation status
      await client.query(
        "UPDATE client_invitations SET status = $1, accepted_at = NOW() WHERE token = $2",
        ["accepted", token]
      );

      // Update client status to active when invitation is accepted
      await client.query(
        "UPDATE clients SET status = $1, updated_at = NOW() WHERE id = $2",
        ["active", invitation.client_id]
      );

      // Create client portal access record with full permissions
      const portalAccessQuery = `
        INSERT INTO client_portal_access (client_id, is_active, created_at, updated_at)
        VALUES ($1, TRUE, NOW(), NOW())
        ON CONFLICT (client_id) DO UPDATE SET is_active = TRUE, updated_at = NOW()
      `;
      await client.query(portalAccessQuery, [invitation.client_id]);

      await client.query("COMMIT");

      // Return complete user data with client information
      const createdUser = userResult.rows[0];
      return {
        id: createdUser.id,
        email: createdUser.email,
        name: createdUser.name,
        role: createdUser.role,
        client_id: createdUser.client_id,
        team_id: invitation.team_id,
        client_name: invitation.client_name,
        company_name: invitation.company_name
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  // Authenticate client user
  async authenticateClient(email: string, password: string): Promise<any> {
    const passwordHash = crypto.createHash("sha256").update(password).digest("hex");

    // First, try to find the client user by email
    const clientUserQuery = `
      SELECT cu.*, c.name as client_name, c.company_name, c.team_id
      FROM client_users cu
      JOIN clients c ON cu.client_id = c.id
      WHERE LOWER(cu.email) = LOWER($1) AND cu.status = 'active'
    `;

    const clientUserResult = await db.query(clientUserQuery, [email]);

    if (clientUserResult.rows.length === 0) {
      return null; // No client user found with this email
    }

    const clientUser = clientUserResult.rows[0];

    // Check if this is a linked Worklenz user (has user_id)
    if (clientUser.user_id) {
      // Authenticate against Worklenz users table
      const worklenzAuthQuery = `
        SELECT u.id, u.email, u.name, u.password
        FROM users u
        WHERE u.id = $1
      `;
      const worklenzUserResult = await db.query(worklenzAuthQuery, [clientUser.user_id]);

      if (worklenzUserResult.rows.length === 0) {
        return null; // Linked Worklenz user not found
      }

      const worklenzUser = worklenzUserResult.rows[0];

      // Verify password against Worklenz user password (bcrypt)
      const passwordMatch = bcrypt.compareSync(password, worklenzUser.password);
      if (passwordMatch) {
        return clientUser; // Password matches, return client user info
      }

      return null; // Password doesn't match
    } else {
      // Standalone client portal user - authenticate against password_hash (SHA256)
      if (clientUser.password_hash === passwordHash) {
        return clientUser; // Password matches
      }

      return null; // Password doesn't match
    }
  }

  // Get client permissions
  async getClientPermissions(clientId: string): Promise<string[]> {
    try {
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

  // Get all organizations accessible by a client user
  async getClientUserOrganizations(clientUserId: string): Promise<ClientOrganization[]> {
    try {
      const query = `
        SELECT
          cuo.id,
          t.name,
          cuo.team_id as "teamId",
          cuo.client_id as "clientId",
          cuo.is_default as "isDefault"
        FROM client_user_organizations cuo
        JOIN teams t ON cuo.team_id = t.id
        WHERE cuo.client_user_id = $1
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