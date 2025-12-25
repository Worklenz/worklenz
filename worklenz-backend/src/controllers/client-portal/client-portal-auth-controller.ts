import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import TokenService from "../../services/token-service";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail, sendEmailEnhanced, EmailRequest } from "../../shared/email";
import FileConstants from "../../shared/file-constants";
import { IEmailTemplateType } from "../../interfaces/email-template-type";
import { getBaseUrl, getClientPortalBaseUrl } from "../../cron_jobs/helpers";
import { generateInvitationEmailHTML, generateWelcomeEmailHTML } from "./helpers";

export default class ClientPortalAuthController extends ClientPortalControllerBase {

  static async validateInvitationBySlug(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    try {
      const { slug } = req.params;

      if (!slug) {
        return res.status(400).json(new ServerResponse(false, null, "Invitation slug is required"));
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
        return res.status(404).json(new ServerResponse(false, null, "Invalid invitation link"));
      }

      const client = clientResult.rows[0];

      // Return client details for the frontend (similar to token-based invitation)
      return res.json(new ServerResponse(true, {
        valid: true,
        email: client.email,
        clientId: client.id,
        clientName: client.name,
        companyName: client.company_name,
        teamName: client.team_name,
        inviteSlug: client.invite_slug,
        type: 'vanity_url'
      }, "Invitation is valid"));
    } catch (error) {
      console.error("Error validating invitation by slug:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to validate invitation"));
    }
  }

  static async validateInvitation(req: IWorkLenzRequest, res: IWorkLenzResponse) {
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
      const invitation = await TokenService.getInvitationByToken(token as string);

      if (!invitation) {
        return res
          .status(404)
          .json(
            new ServerResponse(false, null, "Invalid or expired invitation")
          );
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
        status: invitation.status,
        type: 'token'
      }, "Invitation is valid"));
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
        const orgInvitePayload = TokenService.verifyOrganizationInviteToken(token);

        if (orgInvitePayload && orgInvitePayload.type === "organization_invite") {
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
          const existingWorklenzUserResult = await db.query(existingWorklenzUserQuery, [email]);

          let worklenzUserId = null;
          if (existingWorklenzUserResult.rows.length > 0) {
            // User already exists in Worklenz - verify their Worklenz password before linking
            const worklenzUser = existingWorklenzUserResult.rows[0];
            const passwordMatch = bcrypt.compareSync(password, worklenzUser.password);

            if (!passwordMatch) {
              return res.status(401).json({
                done: false,
                body: { isWorklenzUser: true },
                titleKey: "errors.worklenz_account_found_title",
                messageKey: "errors.worklenz_account_found_message"
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
                [clientId, name, crypto.createHash("sha256").update(password).digest("hex"), existingClientUserId]
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
        const passwordMatch = bcrypt.compareSync(password, worklenzUser.password);

        if (!passwordMatch) {
          return res.status(401).json({
            done: false,
            body: { isWorklenzUser: true },
            titleKey: "errors.worklenz_account_found_title",
            messageKey: "errors.worklenz_account_found_message"
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

      // Fetch organization branding from client_portal_settings
      let organizationBranding = {
        logoUrl: null,
        primaryColor: "#52c41a",
        companyName: invitation.team_name || invitation.company_name,
      };

      if (invitation.team_id) {
        const brandingQuery = `
          SELECT logo_url, primary_color, company_name
          FROM client_portal_settings
          WHERE organization_team_id = $1
        `;
        const brandingResult = await db.query(brandingQuery, [invitation.team_id]);
        if (brandingResult.rows.length > 0) {
          const settings = brandingResult.rows[0];
          organizationBranding = {
            logoUrl: settings.logo_url,
            primaryColor: settings.primary_color || "#52c41a",
            companyName: settings.company_name || invitation.team_name || invitation.company_name,
          };
        }
      }

      // Use company/team name for the welcome message, not client name
      const organizationName = organizationBranding.companyName || invitation.team_name || invitation.company_name || "Worklenz";

      const emailHtml = generateWelcomeEmailHTML({
        userName: newUser.name,
        clientName: invitation.client_name,
        companyName: invitation.company_name,
        organizationName: organizationName,
        portalLink,
        logoUrl: organizationBranding.logoUrl,
        primaryColor: organizationBranding.primaryColor,
      });

      const emailRequest = new EmailRequest(
        [newUser.email],
        `Welcome to ${organizationName} on Worklenz`,
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
              [userId, clientId, user.name, invitation.team_id, emailExistsCheck.rows[0].id]
            );
          } else {
            const linkUserQuery = `
              INSERT INTO client_users (user_id, client_id, email, name, role, team_id, status, created_at, updated_at)
              VALUES ($1, $2, $3, $4, 'member', $5, 'active', NOW(), NOW())
            `;
            await db.query(linkUserQuery, [userId, clientId, user.email, user.name, invitation.team_id]);
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
        return ClientPortalAuthController.generateOrganizationInvitationLink(
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
      if (!client.email || client.email.trim() === '') {
        return res.status(400).json(new ServerResponse(false, {
          errorCode: 'EMAIL_REQUIRED',
          clientId: client.id,
          clientName: client.name
        }, "Email address is required to invite the client to the portal"));
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
              [existingUser.id, client.id, client.name, teamId, existingClientUser.id]
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
              teamId
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
        return res.json(new ServerResponse(true, {
          isExistingUser: true,
          message: "This client is already a Worklenz user!",
          clientName: client.name,
          clientEmail: client.email,
          portalUrl: `${getClientPortalBaseUrl()}/login`
        }, "Client is existing Worklenz user - access granted"));
      }

      // Generate secure short random token for invitation (64 characters, same as team/project invitations)
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
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

      return res.json(new ServerResponse(true, {
        invitationLink: tokenLink,
        vanityLink: vanityLink,
        token: inviteToken,
        expiresAt: new Date(expiresAt).toISOString(),
        clientName: client.name,
        clientEmail: client.email,
        inviteSlug: client.invite_slug
      }, "Invitation link generated successfully"));
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
      const expiresAt = Date.now() + (7 * 24 * 60 * 60 * 1000); // 7 days from now
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
      const template = FileConstants.getEmailTemplate(IEmailTemplateType.ClientInvitation) as string;
      if (!template) {
        return res.status(500).json(new ServerResponse(false, null, "Email template not found"));
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
        console.error("Failed to send client invitation email:", emailResult.error);
        const errorMessage = emailResult.error?.message || "Failed to send invitation email";
        return res.status(500).json(new ServerResponse(false, null, errorMessage));
      }

      return res.json(new ServerResponse(true, {
        invitationLink: inviteLink,
        clientName: client.name,
        clientEmail: client.email,
        expiresAt: new Date(expiresAt).toISOString(),
        emailSent: true
      }, "Invitation email sent successfully"));
    } catch (error) {
      console.error("Error resending client invitation:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to resend invitation"));
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

      console.log(`Client invitation email sent to ${client.email}`);
    } catch (error) {
      console.error("Error sending client invitation email:", error);
      throw error;
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

}
