import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../../controllers/worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import { SlackService } from "../services/slack.service";
import { log_error } from "../../shared/utils";
import db from "../../config/db";

export default class SlackController extends WorklenzControllerBase {

  /**
   * Get Slack connection status for organization
   */
  @HandleExceptions()
  public static async getStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(200).send({ connected: false });
    }

    const workspace = await SlackService.getWorkspaceByOrganization(organizationId);
    
    if (workspace) {
      return res.status(200).send({
        connected: true,
        workspace: {
          id: workspace.id,
          name: workspace.team_name,
          team_id: workspace.team_id,
          is_active: workspace.is_active
        }
      });
    }

    return res.status(200).send({ connected: false });
  }

  /**
   * Get Slack OAuth installation URL
   */
  @HandleExceptions()
  public static async getInstallUrl(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    // Generate Slack OAuth URL with redirect URI and organization state
    const clientId = process.env.SLACK_CLIENT_ID;
    const redirectUri = process.env.SLACK_REDIRECT_URI || `${process.env.APP_URL}/public/slack/oauth/callback`;
    // Added channels:join for auto-joining public channels and incoming-webhook for better channel selection UX
    const scopes = "channels:read,groups:read,chat:write,commands,channels:join,incoming-webhook";

    const installUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${organizationId}`;

    return res.status(200).send({ url: installUrl });
  }

  /**
   * OAuth callback - Handle Slack authorization response
   */
  @HandleExceptions()
  public static async oauthCallback(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { code, state, error } = req.query;
    // Ensure we get a clean frontend URL without any path components
    // Parse and normalize the frontend URL to ensure it's a valid URL with protocol
    const rawFrontendUrl = process.env.FRONTEND_URL || process.env.APP_URL || "http://localhost:3000";
    
    // Normalize the URL: ensure it has a protocol, remove paths, and extract just the origin
    let frontendUrl = rawFrontendUrl.trim();
    
    // If URL doesn't start with http:// or https://, try to add https://
    if (!/^https?:\/\//i.test(frontendUrl)) {
      // If it looks like a domain, add https://
      if (/^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(frontendUrl)) {
        frontendUrl = `https://${frontendUrl}`;
      } else {
        // Fallback to default
        frontendUrl = "https://app.worklenz.com";
      }
    }
    
    // Extract just the origin (protocol + host, no path)
    try {
      const urlObj = new URL(frontendUrl);
      frontendUrl = `${urlObj.protocol}//${urlObj.host}`;
    } catch (e) {
      // If URL parsing fails, try regex fallback
      const match = frontendUrl.match(/^(https?:\/\/[^/]+)/i);
      if (match) {
        frontendUrl = match[1];
      } else {
        // Ultimate fallback
        frontendUrl = "https://app.worklenz.com";
      }
    }
    
    const frontendOrigin = frontendUrl;

    const sendPopupResponse = (status: "success" | "error" | "cancelled") => {
      const messageType =
        status === "success"
          ? "SLACK_AUTH_SUCCESS"
          : status === "cancelled"
            ? "SLACK_AUTH_CANCELLED"
            : "SLACK_AUTH_ERROR";

      const title = status === "success"
        ? "Integration Complete!"
        : status === "cancelled"
          ? "Integration Cancelled"
          : "Integration Failed";

      const message = status === "success"
        ? "Your Slack workspace has been successfully connected to Worklenz."
        : status === "cancelled"
          ? "The Slack integration was cancelled."
          : "Failed to connect your Slack workspace. Please try again.";

      const iconColor = status === "success" ? "#10b981" : status === "cancelled" ? "#f59e0b" : "#ef4444";
      const icon = status === "success"
        ? "✓"
        : status === "cancelled"
          ? "ℹ"
          : "✕";

      const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Slack Authorization</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        margin: 0;
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f7fafc;
        color: #1a202c;
      }
      .container {
        text-align: center;
        padding: 40px;
        background: #fff;
        border-radius: 16px;
        box-shadow: 0 10px 30px rgba(15, 23, 42, 0.1);
        max-width: 400px;
      }
      .icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: ${iconColor};
        color: white;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 32px;
        margin: 0 auto 20px;
        font-weight: bold;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 24px;
        font-weight: 600;
      }
      p {
        margin: 0 0 24px;
        color: #64748b;
        font-size: 15px;
        line-height: 1.5;
      }
      .close-btn {
        background: #1890ff;
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;
      }
      .close-btn:hover {
        background: #0c7cd5;
      }
      .auto-close {
        margin-top: 16px;
        font-size: 13px;
        color: #94a3b8;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <div class="icon">${icon}</div>
      <h1>${title}</h1>
      <p>${message}</p>
      <button class="close-btn" onclick="window.close()">Close Window</button>
      <p class="auto-close" id="autoCloseMsg">This window will close automatically in <span id="countdown">3</span> seconds...</p>
    </div>
    <script>
      (function() {
        var payload = { type: ${JSON.stringify(messageType)}, status: ${JSON.stringify(status)} };
        var targetOrigin = ${JSON.stringify(frontendOrigin)};
        var closed = false;
        var countdown = 3;

        // Countdown timer
        var countdownInterval = setInterval(function() {
          countdown--;
          var countdownEl = document.getElementById('countdown');
          if (countdownEl) {
            countdownEl.textContent = countdown;
          }

          if (countdown <= 0) {
            clearInterval(countdownInterval);
          }
        }, 1000);

        // Try to notify parent window and close after countdown
        try {
          if (window.opener && !window.opener.closed) {
            window.opener.postMessage(payload, targetOrigin);

            // Close after 3 seconds
            setTimeout(function() {
              if (!closed) {
                window.close();
                closed = true;
              }
            }, 3000);

            // If auto-close doesn't work, hide the countdown message
            setTimeout(function() {
              if (!closed) {
                var autoCloseMsg = document.getElementById('autoCloseMsg');
                if (autoCloseMsg) {
                  autoCloseMsg.style.display = 'none';
                }
              }
            }, 3500);
          } else {
            // No opener, just close after countdown
            setTimeout(function() {
              window.close();
            }, 3000);
          }
        } catch (err) {
          console.error('Slack OAuth popup error', err);
          // Still try to close after countdown
          setTimeout(function() {
            window.close();
          }, 3000);
        }
      })();
    </script>
  </body>
</html>`;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.status(200).send(html);
      return res as IWorkLenzResponse;
    };

    // Handle user cancellation or authorization error
    if (error) {
      return sendPopupResponse("cancelled");
    }

    if (!code || !state) {
      return sendPopupResponse("error");
    }

    try {
      const organizationId = state as string;

      // Exchange code for access token
      const tokenResponse = await fetch("https://slack.com/api/oauth.v2.access", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: process.env.SLACK_CLIENT_ID || "",
          client_secret: process.env.SLACK_CLIENT_SECRET || "",
          code: code as string,
          redirect_uri: process.env.SLACK_REDIRECT_URI || `${process.env.APP_URL}/public/slack/oauth/callback`,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.ok) {
        log_error(tokenData);
        return sendPopupResponse("error");
      }

      // Store workspace connection
      const slackData = {
        team_id: tokenData.team?.id || tokenData.team_id,
        team_name: tokenData.team?.name || tokenData.team_name,
        access_token: tokenData.access_token,
        bot_user_id: tokenData.bot_user_id,
        bot: tokenData.bot_user_id ? { bot_access_token: tokenData.access_token } : undefined,
        scope: tokenData.scope,
        authed_user: tokenData.authed_user,
      };

      await SlackService.connectWorkspace(organizationId, slackData);

      // Redirect to frontend with success
      return sendPopupResponse("success");
    } catch (error) {
      log_error(error);
      return sendPopupResponse("error");
    }
  }

  /**
   * Disconnect Slack workspace for organization
   */
  @HandleExceptions()
  public static async disconnect(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const workspace = await SlackService.getWorkspaceByOrganization(organizationId);
    
    if (!workspace) {
      return res.status(404).send(new ServerResponse(false, null, "No Slack workspace connected"));
    }

    await SlackService.disconnectWorkspace(workspace.id, userId, organizationId);
    return res.status(200).send(new ServerResponse(true, null, "Slack workspace disconnected successfully"));
  }

  /**
   * Get available Slack channels for organization
   */
  @HandleExceptions()
  public static async getAvailableChannels(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const workspace = await SlackService.getWorkspaceByOrganization(organizationId);
    
    if (!workspace) {
      return res.status(404).send(new ServerResponse(false, null, "No Slack workspace connected"));
    }

    const result = await SlackService.getChannelsByWorkspace(workspace.id);
    return res.status(200).send(result.channels);
  }

  /**
   * Get all channel configs for organization (simplified endpoint)
   */
  @HandleExceptions()
  public static async getAllChannelConfigs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const configs = await SlackService.getChannelConfigsByOrganization(organizationId);
    
    // Transform to match frontend interface
    const transformedConfigs = configs.map(config => ({
      id: config.id,
      projectId: config.project_id,
      projectName: config.project_name,
      slackChannelId: config.slack_channel_id,
      slackChannelName: config.channel_name,
      notificationTypes: config.notification_types,
      isActive: config.is_active
    }));

    return res.status(200).send(transformedConfigs);
  }

  /**
   * Update channel config status
   */
  @HandleExceptions()
  public static async updateChannelConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { configId } = req.params;
    const { isActive } = req.body;
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this config
    const hasAccess = await SlackService.verifyChannelConfigOwnership(configId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this configuration"));
    }

    // Update channel config status
    await db.query(
      "UPDATE slack_channel_configs SET is_active = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2",
      [isActive, configId]
    );

    return res.status(200).send(new ServerResponse(true, null, "Channel configuration updated successfully"));
  }

  /**
   * OAuth callback - Connect Slack workspace
   */
  @HandleExceptions()
  public static async connectWorkspace(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    const userId = req.user?.id;
    const slackData = req.body;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const workspace = await SlackService.connectWorkspace(organizationId, slackData, userId);
    return res.status(200).send(new ServerResponse(true, workspace, "Slack workspace connected successfully"));
  }

  /**
   * Get connected workspace for organization
   */
  @HandleExceptions()
  public static async getWorkspace(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const workspace = await SlackService.getWorkspaceByOrganization(organizationId);
    return res.status(200).send(new ServerResponse(true, workspace));
  }

  /**
   * Disconnect Slack workspace
   */
  @HandleExceptions()
  public static async disconnectWorkspace(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { workspaceId } = req.params;
    const organizationId = req.user?.organization_id;

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this workspace
    const hasAccess = await SlackService.verifyWorkspaceOwnership(workspaceId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this workspace"));
    }

    await SlackService.disconnectWorkspace(workspaceId, req.user?.id, organizationId);
    return res.status(200).send(new ServerResponse(true, null, "Slack workspace disconnected successfully"));
  }

  /**
   * Sync Slack channels for workspace
   */
  @HandleExceptions()
  public static async syncChannels(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { workspaceId } = req.params;
    const { channels } = req.body;
    const organizationId = req.user?.organization_id;

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this workspace
    const hasAccess = await SlackService.verifyWorkspaceOwnership(workspaceId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this workspace"));
    }

    await SlackService.syncChannels(workspaceId, channels);
    return res.status(200).send(new ServerResponse(true, null, "Channels synced successfully"));
  }

  /**
   * Refresh channels from Slack API for organization
   */
  @HandleExceptions()
  public static async refreshChannels(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const workspace = await SlackService.getWorkspaceByOrganization(organizationId);
    
    if (!workspace) {
      return res.status(404).send(new ServerResponse(false, null, "No Slack workspace connected"));
    }

    await SlackService.fetchAndSyncChannels(workspace.id);
    const result = await SlackService.getChannelsByWorkspace(workspace.id);
    
    return res.status(200).send(new ServerResponse(true, result.channels));
  }

  /**
   * Get channels for workspace
   */
  @HandleExceptions()
  public static async getChannels(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { workspaceId } = req.params;
    const organizationId = req.user?.organization_id;
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 100, 500); // Max 500 per page

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this workspace
    const hasAccess = await SlackService.verifyWorkspaceOwnership(workspaceId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this workspace"));
    }

    const result = await SlackService.getChannelsByWorkspace(workspaceId, page, limit);
    return res.status(200).send(new ServerResponse(true, result));
  }

  /**
   * Create channel configuration for project with auto-join capability
   */
  @HandleExceptions()
  public static async createChannelConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, slackChannelId, notificationTypes, autoJoin = true } = req.body;
    const createdBy = req.user?.id;
    const organizationId = req.user?.organization_id;

    if (!projectId || !slackChannelId) {
      return res.status(400).send(new ServerResponse(false, null, "Project ID and Slack channel ID are required"));
    }

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Note: Project access verification should be added via ProjectService.verifyUserAccess(projectId, userId)

    const config = await SlackService.createChannelConfig(
      projectId,
      slackChannelId,
      notificationTypes || [],
      createdBy,
      autoJoin
    );

    // Provide feedback about auto-join result
    let message = "Channel configuration created successfully";
    if (config.joinResult) {
      if (config.joinResult.success) {
        message += ". Bot automatically joined the channel";
      } else {
        message += `. Note: ${config.joinResult.message}`;
      }
    }

    return res.status(200).send(new ServerResponse(true, config, message));
  }

  /**
   * Get channel configs for project
   */
  @HandleExceptions()
  public static async getProjectChannelConfigs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const teamId = req.user?.team_id;

    if (!projectId) {
      return res.status(400).send(new ServerResponse(false, null, "Project ID is required"));
    }

    if (!teamId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project ID format"));
    }

    // Verify project belongs to user's team
    const projectQuery = `
      SELECT id FROM projects
      WHERE id = $1 AND team_id = $2
    `;
    const projectResult = await db.query(projectQuery, [projectId, teamId]);

    if (projectResult.rows.length === 0) {
      return res.status(403).send(new ServerResponse(false, null, "Access denied: Project not found or you don't have access"));
    }

    const configs = await SlackService.getChannelConfigsByProject(projectId);
    return res.status(200).send(new ServerResponse(true, configs));
  }

  /**
   * Get all channel configs for organization
   */
  @HandleExceptions()
  public static async getOrganizationChannelConfigs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized: Organization ID is required"));
    }

    const configs = await SlackService.getChannelConfigsByOrganization(organizationId);
    return res.status(200).send(new ServerResponse(true, configs));
  }

  /**
   * Delete channel config
   */
  @HandleExceptions()
  public static async deleteChannelConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { configId } = req.params;
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this config
    const hasAccess = await SlackService.verifyChannelConfigOwnership(configId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this configuration"));
    }

    await SlackService.deleteChannelConfig(configId);
    return res.status(200).send(new ServerResponse(true, null, "Channel configuration deleted successfully"));
  }

  /**
   * Reactivate channel config
   */
  @HandleExceptions()
  public static async reactivateChannelConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { configId } = req.params;
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this config
    const hasAccess = await SlackService.verifyChannelConfigOwnership(configId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this configuration"));
    }

    await SlackService.reactivateChannelConfig(configId);
    return res.status(200).send(new ServerResponse(true, null, "Channel configuration reactivated successfully"));
  }

  /**
   * Send test notification to Slack
   */
  @HandleExceptions()
  public static async sendTestNotification(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { configId } = req.params;
    const { message } = req.body;
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this config
    const hasAccess = await SlackService.verifyChannelConfigOwnership(configId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this configuration"));
    }

    const testMessage = message || {
      text: "This is a test notification from Worklenz",
      blocks: [
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "*Test Notification from Worklenz*\n\nYour Slack integration is working correctly!"
          }
        }
      ]
    };

    try {
      await SlackService.sendNotification(
        configId,
        "test",
        "test",
        "test-notification",
        testMessage
      );

      return res.status(200).send(new ServerResponse(true, null, "Test notification sent successfully"));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Failed to send test notification. Please check your Slack configuration."));
    }
  }

  /**
   * Manually join a specific channel
   */
  @HandleExceptions()
  public static async joinChannel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { workspaceId, channelId } = req.body;
    const organizationId = req.user?.organization_id;

    if (!workspaceId || !channelId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID and Channel ID are required"));
    }

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this workspace
    const hasAccess = await SlackService.verifyWorkspaceOwnership(workspaceId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this workspace"));
    }

    const result = await SlackService.joinChannel(workspaceId, channelId);
    
    if (result.success) {
      return res.status(200).send(new ServerResponse(true, result, result.message));
    } else {
      return res.status(400).send(new ServerResponse(false, result, result.message));
    }
  }

  /**
   * Auto-join all public channels for a workspace
   */
  @HandleExceptions()
  public static async autoJoinPublicChannels(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { workspaceId } = req.params;
    const organizationId = req.user?.organization_id;

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    if (!organizationId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    // Verify user owns this workspace
    const hasAccess = await SlackService.verifyWorkspaceOwnership(workspaceId, organizationId);
    if (!hasAccess) {
      return res.status(403).send(new ServerResponse(false, null, "Forbidden: You do not have access to this workspace"));
    }

    const result = await SlackService.autoJoinPublicChannels(workspaceId);
    
    return res.status(200).send(new ServerResponse(
      true, 
      result, 
      `Auto-join complete. Successfully joined ${result.joinedCount} channels, ${result.failedCount} failed.`
    ));
  }
}
