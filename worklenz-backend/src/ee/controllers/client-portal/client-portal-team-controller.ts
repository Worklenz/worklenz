import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import { sendEmail, EmailRequest } from "../../../shared/email";
import { generateInvitationEmailHTML } from "./helpers";
import TokenService from "../../../services/token-service";

export default class ClientPortalTeamController extends ClientPortalControllerBase {

  static async getClientTeam(
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

      // For now, return empty team since client team members are not implemented in the database
      // This would typically query a client_team_members table or similar
      const teamMembers: any[] = [];
      const total = 0;

      return res.json(
        new ServerResponse(
          true,
          {
            team_members: teamMembers,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Client team retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching client team:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve client team")
        );
    }
  }

  static async inviteTeamMember(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { email, name, role = "member" } = req.body;
      const teamId = (req.user as any)?.team_id;
      const inviterId = (req.user as any)?.id;
      const inviterName = (req.user as any)?.name;

      // Validate required fields
      if (!email || !name) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Email and name are required"));
      }

      // Verify client exists and belongs to team
      const clientCheck = await db.query(
        "SELECT id, name, company_name FROM clients WHERE id = $1 AND team_id = $2",
        [id, teamId]
      );

      if (clientCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // Check if user is already invited or exists
      const existingInvitation = await db.query(
        "SELECT id FROM client_invitations WHERE client_id = $1 AND email = $2 AND status = 'pending'",
        [id, email]
      );

      if (existingInvitation.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "User already has a pending invitation"
            )
          );
      }

      const existingUser = await db.query(
        "SELECT id FROM client_users WHERE client_id = $1 AND email = $2",
        [id, email]
      );

      if (existingUser.rows.length > 0) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              "User already exists for this client"
            )
          );
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
        token: inviteToken,
      });

      // Generate invitation link
      const inviteLink = `${process.env.CLIENT_PORTAL_HOSTNAME ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}` : "http://localhost:5174"}/invitation?token=${inviteToken}`;

      // Generate email HTML
      const emailHtml = generateInvitationEmailHTML({
        inviteeName: name,
        inviterName,
        clientName: client.name,
        companyName: client.company_name,
        inviteLink,
        expiresAt,
        role,
      });

      // Send invitation email using shared email function
      const emailRequest = new EmailRequest(
        [email],
        `You're invited to join ${client.name} on Worklenz`,
        emailHtml
      );

      const messageId = await sendEmail(emailRequest);

      if (!messageId) {
        return res
          .status(500)
          .json(
            new ServerResponse(false, null, "Failed to send invitation email")
          );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            invitationId: inviteToken,
            email,
            name,
            role,
            status: "pending",
            expiresAt,
          },
          "Team member invited successfully"
        )
      );
    } catch (error) {
      console.error("Error inviting team member:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to invite team member"));
    }
  }

  static async updateTeamMember(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
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
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
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
          return res
            .status(400)
            .json(new ServerResponse(false, null, "No valid fields to update"));
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

        return res.json(
          new ServerResponse(
            true,
            {
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              role: updatedUser.role,
              status: updatedUser.status,
              type: "client_user",
              updatedAt: updatedUser.updated_at,
            },
            "Team member updated successfully"
          )
        );
      }
      // Try to find pending invitation
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, status FROM client_invitations WHERE id = $1 AND client_id = $2 AND status = 'pending'",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Team member or invitation not found"
            )
          );
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
        return res
          .status(400)
          .json(new ServerResponse(false, null, "No valid fields to update"));
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

      return res.json(
        new ServerResponse(
          true,
          {
            id: updatedInvitation.id,
            email: updatedInvitation.email,
            name: updatedInvitation.name,
            role: updatedInvitation.role,
            status: updatedInvitation.status,
            type: "invitation",
          },
          "Team invitation updated successfully"
        )
      );
    } catch (error) {
      console.error("Error updating team member:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to update team member"));
    }
  }

  static async removeTeamMember(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id, memberId } = req.params; // id = client ID, memberId = client user ID or invitation ID
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
          return res
            .status(404)
            .json(new ServerResponse(false, null, "Team member not found"));
        }

        const removedUser = clientUserCheck.rows[0];

        return res.json(
          new ServerResponse(
            true,
            {
              id: removedUser.id,
              name: removedUser.name,
              email: removedUser.email,
              role: removedUser.role,
              type: "client_user",
              removedAt: new Date(),
            },
            "Team member removed successfully"
          )
        );
      }
      // Try to find and remove pending invitation
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, status FROM client_invitations WHERE id = $1 AND client_id = $2",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Team member or invitation not found"
            )
          );
      }

      const invitation = invitationCheck.rows[0];

      // Delete the invitation
      const deleteResult = await db.query(
        "DELETE FROM client_invitations WHERE id = $1 AND client_id = $2",
        [memberId, id]
      );

      if (deleteResult.rowCount === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Invitation not found"));
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: invitation.id,
            email: invitation.email,
            name: invitation.name,
            role: invitation.role,
            status: invitation.status,
            type: "invitation",
            removedAt: new Date(),
          },
          "Team invitation removed successfully"
        )
      );
    } catch (error) {
      console.error("Error removing team member:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to remove team member"));
    }
  }

  static async resendTeamInvitation(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
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
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Client not found"));
      }

      const client = clientCheck.rows[0];

      // Get invitation details
      const invitationCheck = await db.query(
        "SELECT id, email, name, role, token, status FROM client_invitations WHERE id = $1 AND client_id = $2 AND status = 'pending'",
        [memberId, id]
      );

      if (invitationCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(false, null, "Pending invitation not found")
          );
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

      // Generate new invitation link (URL-encode to handle + characters in token)
      const inviteLink = `${
        process.env.CLIENT_PORTAL_HOSTNAME
          ? `https://${process.env.CLIENT_PORTAL_HOSTNAME}`
          : "http://localhost:5174"
      }/invitation?token=${encodeURIComponent(newToken)}`;

      // Generate email HTML
      const emailHtml = generateInvitationEmailHTML({
        inviteeName: invitation.name,
        inviterName,
        clientName: client.name,
        companyName: client.company_name,
        inviteLink,
        expiresAt: newExpiresAt,
        role: invitation.role,
      });

      // Send invitation email using shared email function
      const emailRequest = new EmailRequest(
        [invitation.email],
        `You're invited to join ${client.name} on Worklenz`,
        emailHtml
      );

      const messageId = await sendEmail(emailRequest);

      if (!messageId) {
        return res
          .status(500)
          .json(
            new ServerResponse(false, null, "Failed to send invitation email")
          );
      }

      return res.json(
        new ServerResponse(
          true,
          {
            id: invitation.id,
            email: invitation.email,
            name: invitation.name,
            role: invitation.role,
            status: invitation.status,
            resent_at: new Date(),
          },
          "Team invitation resent successfully"
        )
      );
    } catch (error) {
      console.error("Error resending team invitation:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to resend team invitation")
        );
    }
  }

}
