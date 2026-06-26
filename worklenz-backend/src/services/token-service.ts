import jwt from "jsonwebtoken";
import crypto from "crypto";
import bcrypt from "bcrypt";
import db from "../config/db";
import { generatePrefixedToken, isValidBase62 } from "../utils/base62";

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

      // Always hash password with bcrypt and attach to invitation object for use in subsequent queries
      const passwordHash = this.hashClientPassword(userData.password);
      (invitation as any).password_hash = passwordHash;

      let userResult: any;
      let actualClientUserId: string;

      // Check if email already exists in client_users to avoid duplicate key error
      const emailExistsCheck = await client.query(
        `SELECT id FROM client_users WHERE LOWER(email) = LOWER($1)`,
        [invitation.email]
      );

      if (emailExistsCheck.rows.length > 0) {
        // Email already exists - update the existing record
        actualClientUserId = emailExistsCheck.rows[0].id;
        
        if (userData.userId) {
          // Linking existing Worklenz user
          await client.query(
            `UPDATE client_users 
             SET user_id = $1, client_id = $2, name = $3, role = $4, team_id = $5, status = 'active', updated_at = NOW()
             WHERE id = $6`,
            [userData.userId, invitation.client_id, userData.name, invitation.role, invitation.team_id, actualClientUserId]
          );
        } else {
          // Standalone client portal user - update with password_hash (bcrypt)
          await client.query(
            `UPDATE client_users 
             SET client_id = $1, name = $2, password_hash = $3, role = $4, team_id = $5, status = 'active', updated_at = NOW()
             WHERE id = $6`,
            [invitation.client_id, userData.name, passwordHash, invitation.role, invitation.team_id, actualClientUserId]
          );
        }
        
        userResult = await client.query(
          `SELECT id, email, name, role, client_id FROM client_users WHERE id = $1`,
          [actualClientUserId]
        );
      } else {
        // Email doesn't exist - create new record (let DB generate UUID)
        let createUserQuery: string;
        let queryParams: any[];

        if (userData.userId) {
          // Linking existing Worklenz user - no password_hash needed for client_users table
          createUserQuery = `
            INSERT INTO client_users (
              user_id, client_id, email, name, role, team_id, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
            RETURNING id, email, name, role, client_id
          `;
          queryParams = [
            userData.userId,
            invitation.client_id,
            invitation.email,
            userData.name,
            invitation.role,
            invitation.team_id
          ];
        } else {
          // Standalone client portal user - create with password_hash (bcrypt)
          createUserQuery = `
            INSERT INTO client_users (
              client_id, email, name, password_hash, role, team_id, status, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW(), NOW())
            RETURNING id, email, name, role, client_id
          `;
          queryParams = [
            invitation.client_id,
            invitation.email,
            userData.name,
            passwordHash, // Bcrypt hash created earlier
            invitation.role,
            invitation.team_id
          ];
        }

        userResult = await client.query(createUserQuery, queryParams);
        actualClientUserId = userResult.rows[0].id;
      }

      // Create organization access record for multi-org support
      const orgAccessQuery = `
        INSERT INTO client_user_organizations (client_user_id, team_id, client_id, is_default, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW(), NOW())
        ON CONFLICT (client_user_id, team_id) DO NOTHING
      `;
      await client.query(orgAccessQuery, [actualClientUserId, invitation.team_id, invitation.client_id]);

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
      // Create client portal access record with full permissions
      const portalAccessQuery = `
        INSERT INTO client_portal_access (client_id, email, password_hash, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, TRUE, NOW(), NOW())
        ON CONFLICT (client_id) DO UPDATE SET is_active = TRUE, email = $2, password_hash = $3, updated_at = NOW()
      `;
      await client.query(portalAccessQuery, [invitation.client_id, invitation.email, (invitation as any).password_hash]);

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

  // Verify client password - supports both bcrypt and SHA256 with lazy migration
  async verifyClientPassword(password: string, storedHash: string): Promise<{ isValid: boolean; needsMigration: boolean }> {
    try {
      // Try bcrypt first (modern hashing)
      try {
        const bcryptMatch = bcrypt.compareSync(password, storedHash);
        if (bcryptMatch) {
          return { isValid: true, needsMigration: false };
        }
      } catch (bcryptError) {
        // Not a valid bcrypt hash, continue to SHA256 check
      }

      // Try SHA256 (legacy hashing)
      const sha256Hash = crypto.createHash("sha256").update(password).digest("hex");
      if (storedHash === sha256Hash) {
        return { isValid: true, needsMigration: true }; // Valid but needs migration to bcrypt
      }

      return { isValid: false, needsMigration: false };
    } catch (error) {
      console.error("Error verifying client password:", error);
      return { isValid: false, needsMigration: false };
    }
  }

  // Hash client password using bcrypt (modern standard)
  hashClientPassword(password: string): string {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  }

  // Migrate password hash from SHA256 to bcrypt
  async migratePasswordHash(clientUserId: string, newPassword: string): Promise<void> {
    try {
      const newHash = this.hashClientPassword(newPassword);
      await db.query(
        "UPDATE client_users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
        [newHash, clientUserId]
      );
    } catch (error) {
      console.error("Error migrating password hash:", error);
    }
  }

  // Authenticate client user
  async authenticateClient(email: string, password: string): Promise<any> {
    try {
      const normalizedEmail = email.toLowerCase().trim();

      // First, check if user exists
      const userExistsQuery = `
        SELECT cu.*, c.name as client_name, c.company_name, c.team_id, c.status as client_status
        FROM client_users cu
        LEFT JOIN clients c ON cu.client_id = c.id
        WHERE LOWER(cu.email) = LOWER($1)
      `;

      const userExistsResult = await db.query(userExistsQuery, [normalizedEmail]);

      if (userExistsResult.rows.length === 0) {
        return null; // No client user found with this email
      }

      const clientUser = userExistsResult.rows[0];

      // Check user status
      if (clientUser.status !== 'active') {
        return null; // User is not active
      }

      // Check if client exists (required for authentication)
      if (!clientUser.client_id) {
        return null; // User has no associated client
      }

      // Check if client exists in clients table
      if (!clientUser.client_name) {
        return null; // Client doesn't exist
      }

      // Check if this is a linked Worklenz user (has user_id)
      if (clientUser.user_id) {
        // Authenticate against Worklenz users table
        const worklenzAuthQuery = `
          SELECT u.id, u.email, u.name, u.password
          FROM users u
          WHERE u.id = $1 AND u.is_deleted = FALSE
        `;
        const worklenzUserResult = await db.query(worklenzAuthQuery, [clientUser.user_id]);

        if (worklenzUserResult.rows.length === 0) {
          return null; // Linked Worklenz user not found
        }

        const worklenzUser = worklenzUserResult.rows[0];

        if (!worklenzUser.password) {
          return null; // No password set for linked user
        }

        // Verify password against Worklenz user password (bcrypt)
        const passwordMatch = bcrypt.compareSync(password, worklenzUser.password);
        if (passwordMatch) {
          return clientUser; // Password matches, return client user info
        }

        return null; // Password doesn't match
      } else {
        // Standalone client portal user - authenticate against password_hash (supports both bcrypt and SHA256)
        if (!clientUser.password_hash) {
          return null; // No password hash set
        }

        // Verify password using centralized method (supports both bcrypt and SHA256)
        const verificationResult = await this.verifyClientPassword(password, clientUser.password_hash);
        
        if (verificationResult.isValid) {
          // Lazy migration: if password is SHA256, migrate to bcrypt
          if (verificationResult.needsMigration) {
            await this.migratePasswordHash(clientUser.id, password);
          }
          
          return clientUser; // Password matches
        }

        return null; // Password doesn't match
      }
    } catch (error) {
      console.error(`[Client Auth] Error during authentication for email: ${email}`, error);
      return null;
    }
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