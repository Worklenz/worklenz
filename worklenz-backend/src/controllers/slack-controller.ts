import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import HandleExceptions from "../decorators/handle-exceptions";
import { SlackService } from "../services/slack.service";

export default class SlackController extends WorklenzControllerBase {

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

    // TODO: Verify user has access to this project
    // This should be added as a separate service method

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

    // TODO: Verify user has access to this project

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
