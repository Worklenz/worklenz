import jwt from "jsonwebtoken";
import crypto from "crypto";
import db from "../config/db";

interface ClientTokenPayload {
  clientId: string;
  organizationId: string;
  email: string;
  permissions: string[];
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
      SELECT ci.*, c.name as client_name, c.company_name, t.name as team_name
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
  }): Promise<any> {
    const invitation = await this.getInvitationByToken(token);
    if (!invitation) {
      throw new Error("Invalid or expired invitation");
    }

    // Start transaction
    const client = await db.pool.connect();
    try {
      await client.query("BEGIN");

      // Create client user account
      const createUserQuery = `
        INSERT INTO client_users (
          id, client_id, email, name, password_hash, role, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
        RETURNING id, email, name, role
      `;

      const userId = crypto.randomUUID();
      const passwordHash = crypto.createHash("sha256").update(userData.password).digest("hex");
      
      const userResult = await client.query(createUserQuery, [
        userId,
        invitation.client_id,
        invitation.email,
        userData.name,
        passwordHash,
        invitation.role,
        "active"
      ]);

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

      await client.query("COMMIT");
      return userResult.rows[0];
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
    
    const query = `
      SELECT cu.*, c.name as client_name, c.company_name, c.team_id
      FROM client_users cu
      JOIN clients c ON cu.client_id = c.id
      WHERE cu.email = $1 AND cu.password_hash = $2 AND cu.status = 'active'
    `;
    
    const result = await db.query(query, [email, passwordHash]);
    return result.rows[0] || null;
  }

  // Get client permissions
  async getClientPermissions(clientId: string): Promise<string[]> {
    // Define default permissions for client users
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

  // Generate secure random token
  generateSecureToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}

export default new TokenService();