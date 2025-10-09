import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { SlackService } from "../services/slack.service";
import { log_error } from "../shared/utils";
import db from "../config/db";

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
    const scopes = "channels:read,groups:read,chat:write,commands";

    const installUrl = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${organizationId}`;

    return res.status(200).send({ url: installUrl });
  }

  /**
   * OAuth callback - Handle Slack authorization response
   */
  @HandleExceptions()
  public static async oauthCallback(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { code, state, error } = req.query;
    const frontendUrl = process.env.FRONTEND_URL || process.env.APP_URL;

    // Handle user cancellation or authorization error
    if (error) {
      res.redirect(`${frontendUrl}/settings/integrations?slack=cancelled`);
      return res as IWorkLenzResponse;
    }

    if (!code || !state) {
      res.redirect(`${frontendUrl}/settings/integrations?slack=error`);
      return res as IWorkLenzResponse;
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
        res.redirect(`${frontendUrl}/settings/integrations?slack=error`);
        return res as IWorkLenzResponse;
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
      res.redirect(`${frontendUrl}/settings/integrations?slack=success`);
      return res as IWorkLenzResponse;
    } catch (error) {
      log_error(error);
      res.redirect(`${frontendUrl}/settings/integrations?slack=error`);
      return res as IWorkLenzResponse;
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

    if (!configId) {
      return res.status(400).send(new ServerResponse(false, null, "Config ID is required"));
    }

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
   * Create channel configuration for project
   */
  @HandleExceptions()
  public static async createChannelConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, slackChannelId, notificationTypes } = req.body;
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
      createdBy
    );

    return res.status(200).send(new ServerResponse(true, config, "Channel configuration created successfully"));
  }

  /**
   * Get channel configs for project
   */
  @HandleExceptions()
  public static async getProjectChannelConfigs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;

    if (!projectId) {
      return res.status(400).send(new ServerResponse(false, null, "Project ID is required"));
    }

    // Note: Project access verification should be added via ProjectService.verifyUserAccess(projectId, userId)

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

    if (!configId) {
      return res.status(400).send(new ServerResponse(false, null, "Config ID is required"));
    }

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
   * Send test notification to Slack
   */
  @HandleExceptions()
  public static async sendTestNotification(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { configId } = req.params;
    const { message } = req.body;
    const organizationId = req.user?.organization_id;

    if (!configId) {
      return res.status(400).send(new ServerResponse(false, null, "Config ID is required"));
    }

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
}
