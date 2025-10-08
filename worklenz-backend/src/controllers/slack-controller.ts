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
    const slackData = req.body;

    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
    }

    const workspace = await SlackService.connectWorkspace(organizationId, slackData);
    return res.status(200).send(new ServerResponse(true, workspace, "Slack workspace connected successfully"));
  }

  /**
   * Get connected workspace for organization
   */
  @HandleExceptions()
  public static async getWorkspace(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;

    if (!organizationId) {
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
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

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    await SlackService.disconnectWorkspace(workspaceId);
    return res.status(200).send(new ServerResponse(true, null, "Slack workspace disconnected successfully"));
  }

  /**
   * Sync Slack channels for workspace
   */
  @HandleExceptions()
  public static async syncChannels(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { workspaceId } = req.params;
    const { channels } = req.body;

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    if (!Array.isArray(channels)) {
      return res.status(400).send(new ServerResponse(false, null, "Channels must be an array"));
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

    if (!workspaceId) {
      return res.status(400).send(new ServerResponse(false, null, "Workspace ID is required"));
    }

    const channels = await SlackService.getChannelsByWorkspace(workspaceId);
    return res.status(200).send(new ServerResponse(true, channels));
  }

  /**
   * Create channel configuration for project
   */
  @HandleExceptions()
  public static async createChannelConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, slackChannelId, notificationTypes } = req.body;
    const createdBy = req.user?.id;

    if (!projectId || !slackChannelId) {
      return res.status(400).send(new ServerResponse(false, null, "Project ID and Slack channel ID are required"));
    }

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
      return res.status(400).send(new ServerResponse(false, null, "Organization ID is required"));
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

    if (!configId) {
      return res.status(400).send(new ServerResponse(false, null, "Config ID is required"));
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

    if (!configId) {
      return res.status(400).send(new ServerResponse(false, null, "Config ID is required"));
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

    await SlackService.sendNotification(
      configId,
      "test",
      "test",
      "test-notification",
      testMessage
    );

    return res.status(200).send(new ServerResponse(true, null, "Test notification sent successfully"));
  }
}
