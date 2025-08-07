import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import axios from "axios";
import { log_error } from "../shared/utils";
import db from "../config/db";

export default class SupportController extends WorklenzControllerBase {

  @HandleExceptions()
  public static async contactSupport(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const {user} = req;
      if (!user) {
        return res.status(401).send(new ServerResponse(false, "Unauthorized"));
      }

      const { reason } = req.body;
      
      // Get user's current session data
      const userEmail = user.email;
      const userName = user.name;
      const subscriptionType = req.body.subscription_type || "Unknown";
      
      // Get organization name from teams table
      let organizationName = "Unknown";
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
          organizationName = orgResult.rows[0].organization_name || orgResult.rows[0].team_name || "Unknown";
        }
      } catch (error) {
        log_error("Error fetching organization info:", error);
      }

      // Send Teams webhook notification
      const teamsWebhookUrl = process.env.TEAMS_SUPPORT_WEBHOOK;
      
      if (!teamsWebhookUrl) {
        log_error("Teams webhook URL not configured");
        return res.status(500).send(new ServerResponse(false, "Support notification not configured"));
      }

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
                  "text": "🔔 Custom Plan Support Request",
                  "weight": "Bolder",
                  "size": "Medium",
                  "color": "Accent"
                },
                {
                  "type": "TextBlock",
                  "text": "A user with a custom plan has requested support assistance.",
                  "wrap": true,
                  "spacing": "Medium"
                },
                {
                  "type": "FactSet",
                  "facts": [
                    {
                      "title": "Name:",
                      "value": userName
                    },
                    {
                      "title": "Email:",
                      "value": userEmail
                    },
                    {
                      "title": "Organization:",
                      "value": organizationName
                    },
                    {
                      "title": "Reason:",
                      "value": reason || "Custom plan renewal/support"
                    }
                  ],
                  "spacing": "Medium"
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

        return res.status(200).send(new ServerResponse(true, "Support request sent successfully"));
      } catch (webhookError: any) {
        log_error("Teams webhook error:", webhookError?.response?.data || webhookError.message);
        return res.status(500).send(new ServerResponse(false, "Failed to send support notification"));
      }

    } catch (error) {
      log_error("Support controller error:", error);
      return res.status(500).send(new ServerResponse(false, "Internal server error"));
    }
  }
}