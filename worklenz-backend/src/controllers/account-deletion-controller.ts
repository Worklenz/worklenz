import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import axios from "axios";
import { log_error } from "../shared/utils";
import db from "../config/db";

export default class AccountDeletionController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async requestDeletion(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const { user } = req;
      if (!user) {
        return res.status(401).send(new ServerResponse(false, "Unauthorized"));
      }

      const { userId, userEmail, userName } = req.body;
      
      // Verify the user is requesting their own deletion
      if (userId !== user.id) {
        return res.status(403).send(new ServerResponse(false, "Forbidden: You can only delete your own account"));
      }

      // Get organization and team information
      let organizationName = "Unknown";
      let teamName = "Unknown";
      try {
        const orgQuery = `
          SELECT t.name as team_name, o.organization_name 
          FROM users u
          LEFT JOIN teams t ON t.id = u.active_team 
          LEFT JOIN organizations o ON o.user_id = t.user_id
          WHERE u.id = $1
        `;
        const orgResult = await db.query(orgQuery, [user.id]);
        if (orgResult.rows.length > 0) {
          organizationName = orgResult.rows[0].organization_name || "Unknown";
          teamName = orgResult.rows[0].team_name || "Unknown";
        }
      } catch (error) {
        log_error("Error fetching organization info:", error);
      }

      // Update user record with deletion flags
      const deletionDate = new Date();
      const updateQuery = `
        UPDATE users 
        SET is_deleted = true, 
            deleted_at = $2
        WHERE id = $1
        RETURNING id, email, name
      `;
      
      const result = await db.query(updateQuery, [userId, deletionDate]);
      
      if (result.rows.length === 0) {
        return res.status(404).send(new ServerResponse(false, "User not found"));
      }

      // Send Teams webhook notification
      const teamsWebhookUrl = process.env.TEAMS_SUPPORT_WEBHOOK;
      
      if (!teamsWebhookUrl) {
        log_error("Teams webhook URL not configured");
        // Continue with deletion even if webhook fails
      } else {
        const teamsMessage = {
          "type": "message",
          "attachments": [
            {
              "contentType": "application/vnd.microsoft.card.adaptive",
              "content": {
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "type": "AdaptiveCard",
                "version": "1.4",
                "body": [
                  {
                    "type": "TextBlock",
                    "text": "⚠️ Account Deletion Request",
                    "weight": "Bolder",
                    "size": "Large",
                    "color": "Warning"
                  },
                  {
                    "type": "TextBlock",
                    "text": "A user has requested to delete their account.",
                    "wrap": true,
                    "spacing": "Medium",
                    "color": "Default"
                  },
                  {
                    "type": "FactSet",
                    "facts": [
                      {
                        "title": "User Name:",
                        "value": userName || "Unknown"
                      },
                      {
                        "title": "Email:",
                        "value": userEmail || "Unknown"
                      },
                      {
                        "title": "Organization:",
                        "value": organizationName
                      },
                      {
                        "title": "Team:",
                        "value": teamName
                      },
                      {
                        "title": "User ID:",
                        "value": userId
                      },
                      {
                        "title": "Deletion Date:",
                        "value": deletionDate.toISOString()
                      },
                      {
                        "title": "Data Removal:",
                        "value": "Within 30 days"
                      }
                    ],
                    "spacing": "Medium"
                  },
                  {
                    "type": "TextBlock",
                    "text": "⏰ Action Required",
                    "weight": "Bolder",
                    "size": "Medium",
                    "color": "Accent",
                    "spacing": "Large"
                  },
                  {
                    "type": "TextBlock",
                    "text": "Please ensure all user data is properly archived and deleted within 30 days as per data retention policy.",
                    "wrap": true,
                    "color": "Default"
                  }
                ]
              }
            }
          ]
        };

        try {
          await axios.post(teamsWebhookUrl, teamsMessage, {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 10000 // 10 seconds timeout
          });
        } catch (webhookError: any) {
          log_error("Teams webhook error:", webhookError?.response?.data || webhookError.message);
          // Continue with deletion even if webhook fails
        }
      }

      // Log the deletion request
      const logQuery = `
        INSERT INTO user_deletion_logs (user_id, email, name, requested_at, scheduled_deletion_date)
        VALUES ($1, $2, $3, $4, $5)
      `;
      
      const scheduledDeletionDate = new Date(deletionDate);
      scheduledDeletionDate.setDate(scheduledDeletionDate.getDate() + 30);
      
      try {
        await db.query(logQuery, [
          userId,
          userEmail,
          userName,
          deletionDate,
          scheduledDeletionDate
        ]);
      } catch (logError) {
        log_error("Error logging deletion request:", logError);
        // Continue even if logging fails
      }

      return res.status(200).send(new ServerResponse(true, "Account deletion request submitted successfully"));

    } catch (error) {
      log_error("Account deletion controller error:", error);
      return res.status(500).send(new ServerResponse(false, "Internal server error"));
    }
  }

  @HandleExceptions()
  public static async cancelDeletion(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const { user } = req;
      if (!user) {
        return res.status(401).send(new ServerResponse(false, "Unauthorized"));
      }

      // Cancel deletion by updating flags
      const updateQuery = `
        UPDATE users 
        SET is_deleted = false, 
            deleted_at = NULL
        WHERE id = $1 AND is_deleted = true
        RETURNING id, email, name
      `;
      
      const result = await db.query(updateQuery, [user.id]);
      
      if (result.rows.length === 0) {
        return res.status(404).send(new ServerResponse(false, "No deletion request found"));
      }

      return res.status(200).send(new ServerResponse(true, "Account deletion cancelled successfully"));

    } catch (error) {
      log_error("Cancel deletion controller error:", error);
      return res.status(500).send(new ServerResponse(false, "Internal server error"));
    }
  }
}