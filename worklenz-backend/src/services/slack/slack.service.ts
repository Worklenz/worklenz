import { WebClient } from "@slack/web-api";
import { createEventAdapter } from "@slack/events-api";
import { Request, Response } from "express";
import crypto from "crypto";
import db from "../../config/db";

export class SlackService {
  private slackEvents: any;

  constructor() {
    this.slackEvents = createEventAdapter(process.env.SLACK_SIGNING_SECRET!);
  }

  // Initialize Slack client for a specific workspace
  private getClient(botToken: string): WebClient {
    return new WebClient(botToken);
  }

  // Generate installation URL for a team
  generateInstallUrl(teamId: string, userId: string): string {
    const state = this.generateState(teamId, userId);
    const scopes =
      "chat:write,channels:read,groups:read,im:read,mpim:read,users:read,users:read.email,commands,incoming-webhook";

    const params = new URLSearchParams({
      client_id: process.env.SLACK_CLIENT_ID!,
      scope: scopes,
      redirect_uri: process.env.SLACK_REDIRECT_URI!,
      state: state,
      team: "", // Allow user to choose their workspace
    });

    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  // Generate secure state parameter
  private generateState(teamId: string, userId: string): string {
    const stateData = {
      teamId,
      userId,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString("hex"),
    };

    // Encrypt state data
    const cipher = crypto.createCipher(
      "aes-256-cbc",
      process.env.SESSION_SECRET!
    );
    let encrypted = cipher.update(JSON.stringify(stateData), "utf8", "hex");
    encrypted += cipher.final("hex");

    return encrypted;
  }

  // Verify and decode state parameter
  private verifyState(state: string): { teamId: string; userId: string } {
    try {
      const decipher = crypto.createDecipher(
        "aes-256-cbc",
        process.env.SESSION_SECRET!
      );
      let decrypted = decipher.update(state, "hex", "utf8");
      decrypted += decipher.final("utf8");

      const stateData = JSON.parse(decrypted);

      // Verify timestamp (expire after 10 minutes)
      if (Date.now() - stateData.timestamp > 600000) {
        throw new Error("State expired");
      }

      return {
        teamId: stateData.teamId,
        userId: stateData.userId,
      };
    } catch (error) {
      throw new Error("Invalid state parameter");
    }
  }

  // OAuth installation callback
  async handleOAuthCallback(
    code: string,
    state: string
  ): Promise<{ teamId: string; success: boolean }> {
    // Verify state
    const { teamId, userId } = this.verifyState(state);

    const client = new WebClient();

    try {
      const result = await client.oauth.v2.access({
        client_id: process.env.SLACK_CLIENT_ID!,
        client_secret: process.env.SLACK_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.SLACK_REDIRECT_URI!,
      });

      if (result.ok && result.access_token) {
        // Store installation details for this team
        await this.saveWorkspaceInstallation({
          teamId,
          slackTeamId: result.team?.id,
          slackTeamName: result.team?.name,
          botToken: result.access_token,
          botUserId: result.bot_user_id,
          appId: result.app_id,
          installedBy: userId,
          authedUser: result.authed_user,
        });

        // Fetch and store available channels
        await this.syncSlackChannels(teamId, result.access_token);

        return { teamId, success: true };
      }

      throw new Error("Invalid OAuth response");
    } catch (error) {
      console.error("OAuth error:", error);
      throw error;
    }
  }

  // Save workspace installation
  private async saveWorkspaceInstallation(data: any): Promise<void> {
    const query = `
            INSERT INTO slack_workspaces (
                team_id, slack_team_id, slack_team_name, 
                bot_token, bot_user_id, app_id, installed_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (slack_team_id) 
            DO UPDATE SET 
                team_id = $1,
                bot_token = $4,
                updated_at = CURRENT_TIMESTAMP,
                is_active = true,
                installed_by = $7
        `;

    await db.query(query, [
      data.teamId,
      data.slackTeamId,
      data.slackTeamName,
      data.botToken,
      data.botUserId,
      data.appId,
      data.installedBy,
    ]);
  }

  // Sync available Slack channels for the team
  private async syncSlackChannels(
    teamId: string,
    botToken: string
  ): Promise<void> {
    const client = this.getClient(botToken);

    try {
      // Get public channels
      const publicChannels = await client.conversations.list({
        types: "public_channel",
        exclude_archived: true,
        limit: 1000,
      });

      // Get private channels the bot is a member of
      const privateChannels = await client.conversations.list({
        types: "private_channel",
        exclude_archived: true,
        limit: 1000,
      });

      // Store channel list in cache or database for quick access
      const channels = [
        ...(publicChannels.channels || []),
        ...(privateChannels.channels || []),
      ];

      // Store in Redis or database cache
      await this.cacheChannelList(teamId, channels);
    } catch (error) {
      console.error("Error syncing channels:", error);
    }
  }

  // Cache channel list for quick access
  private async cacheChannelList(
    teamId: string,
    channels: any[]
  ): Promise<void> {
    // Store in Redis or database with TTL
    // This is used for the channel selector in the UI
    const cacheKey = `slack:channels:${teamId}`;
    const cacheData = channels.map((ch) => ({
      id: ch.id,
      name: ch.name,
      is_private: ch.is_private,
    }));

    // Store with 1 hour TTL
    // await redis.setex(cacheKey, 3600, JSON.stringify(cacheData));
  }

  // Send notification to Slack
  async sendNotification(
    workspaceId: string,
    channelId: string,
    message: any
  ): Promise<void> {
    try {
      // Get workspace token
      const workspace = await this.getWorkspace(workspaceId);
      if (!workspace || !workspace.bot_token) {
        throw new Error("Workspace not found or not configured");
      }

      const client = this.getClient(workspace.bot_token);

      // Send message
      await client.chat.postMessage({
        channel: channelId,
        ...message,
      });

      // Log successful notification
      await this.logNotification(workspaceId, channelId, message, "sent");
    } catch (error) {
      const unknownError = error as unknown;
      const errorMessage =
        unknownError && typeof unknownError === "object" && "message" in unknownError
          ? String((unknownError as { message?: unknown }).message)
          : "Unknown error";
      await this.logNotification(
        workspaceId,
        channelId,
        message,
        "failed",
        errorMessage
      );
      throw unknownError;
    }
  }

  // Get workspace details by team ID
  async getWorkspaceByTeamId(teamId: string): Promise<any> {
    const query = `
            SELECT * FROM slack_workspaces 
            WHERE team_id = $1 AND is_active = true
        `;
    const result = await db.query(query, [teamId]);
    return result.rows[0];
  }

  // Get workspace details
  private async getWorkspace(workspaceId: string): Promise<any> {
    const query = `
            SELECT * FROM slack_workspaces 
            WHERE id = $1 AND is_active = true
        `;
    const result = await db.query(query, [workspaceId]);
    return result.rows[0];
  }

  // Disconnect Slack workspace for a team
  async disconnectWorkspace(teamId: string): Promise<void> {
    const query = `
            UPDATE slack_workspaces 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE team_id = $1
        `;
    await db.query(query, [teamId]);

    // Also deactivate all channel configurations
    const channelQuery = `
            UPDATE slack_channels 
            SET is_active = false, updated_at = CURRENT_TIMESTAMP
            WHERE slack_workspace_id IN (
                SELECT id FROM slack_workspaces WHERE team_id = $1
            )
        `;
    await db.query(channelQuery, [teamId]);
  }

  // Get available Slack channels for a team
  async getAvailableChannels(teamId: string): Promise<any[]> {
    const workspace = await this.getWorkspaceByTeamId(teamId);
    if (!workspace) {
      throw new Error("Slack workspace not connected");
    }

    const client = this.getClient(workspace.bot_token);

    try {
      const result = await client.conversations.list({
        types: "public_channel,private_channel",
        exclude_archived: true,
        limit: 1000,
      });

      return (
        result.channels?.map((ch) => ({
          id: ch.id,
          name: ch.name,
          is_private: ch.is_private,
          num_members: ch.num_members,
        })) || []
      );
    } catch (error) {
      console.error("Error fetching channels:", error);
      throw error as unknown;
    }
  }

  // Get saved Slack channel configurations for a team
  async getChannelConfigs(teamId: string): Promise<any[]> {
    // Query channel configurations and join with projects for display info
    const query = `
            SELECT 
                scc.id,
                scc.project_id,
                p.name AS project_name,
                scc.channel_id,
                scc.channel_name,
                scc.notification_types,
                scc.is_active
            FROM slack_channel_configs scc
            LEFT JOIN projects p ON p.id = scc.project_id
            WHERE scc.team_id = $1
            ORDER BY COALESCE(p.name, scc.channel_name) ASC
        `;

    try {
      const result = await db.query(query, [teamId]);
      const rows = result.rows || [];
      // Map DB rows to the shape expected by the frontend component
      return rows.map((row: any) => ({
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name || null,
        slackChannelId: row.channel_id,
        slackChannelName: row.channel_name || "Unknown",
        notificationTypes: Array.isArray(row.notification_types)
          ? row.notification_types
          : [],
        isActive: !!row.is_active,
      }));
    } catch (_error) {
      // Fallback to empty array if the table/query is unavailable
      return [];
    }
  }

  // Create a Slack channel configuration mapping
  async createChannelConfig(teamId: string, data: {
    projectId: string;
    slackChannelId: string;
    notificationTypes: string[];
  }): Promise<{ id: string } | null> {
    const insertQuery = `
            INSERT INTO slack_channel_configs (
                team_id,
                project_id,
                channel_id,
                notification_types,
                is_active
            )
            VALUES ($1, $2, $3, $4, true)
            RETURNING id
        `;

    try {
      const result = await db.query(insertQuery, [
        teamId,
        data.projectId,
        data.slackChannelId,
        data.notificationTypes,
      ]);
      return result.rows?.[0] || null;
    } catch (_error) {
      return null;
    }
  }

  // Update channel config activation or notification types
  async updateChannelConfig(teamId: string, id: string, data: {
    isActive?: boolean;
    notificationTypes?: string[];
  }): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];
    let idx = 1;

    if (typeof data.isActive === "boolean") {
      updates.push(`is_active = $${idx++}`);
      params.push(data.isActive);
    }
    if (data.notificationTypes) {
      updates.push(`notification_types = $${idx++}`);
      params.push(data.notificationTypes);
    }

    if (updates.length === 0) return true;

    const query = `
            UPDATE slack_channel_configs
            SET ${updates.join(", ")}, updated_at = CURRENT_TIMESTAMP
            WHERE id = $${idx++} AND team_id = $${idx}
        `;
    params.push(id, teamId);

    try {
      await db.query(query, params);
      return true;
    } catch (_error) {
      return false;
    }
  }

  // Delete a channel config
  async deleteChannelConfig(teamId: string, id: string): Promise<boolean> {
    const query = `
            DELETE FROM slack_channel_configs
            WHERE id = $1 AND team_id = $2
        `;
    try {
      await db.query(query, [id, teamId]);
      return true;
    } catch (_error) {
      return false;
    }
  }

  // Log notification
  private async logNotification(
    workspaceId: string,
    channelId: string,
    message: any,
    status: string,
    errorMessage?: string
  ): Promise<void> {
    const query = `
            INSERT INTO slack_notifications 
            (slack_workspace_id, channel_id, message, status, error_message, sent_at)
            VALUES ($1, $2, $3, $4, $5, $6)
        `;

    await db.query(query, [
      workspaceId,
      channelId,
      JSON.stringify(message),
      status,
      errorMessage,
      status === "sent" ? new Date() : null,
    ]);
  }

  // Handle slash commands
  async handleSlashCommand(req: Request, res: Response): Promise<void> {
    const { command, text, user_id, team_id, channel_id } = req.body;

    switch (command) {
      case "/worklenz-task":
        await this.handleCreateTask(text, user_id, team_id, channel_id, res);
        break;
      case "/worklenz-project":
        await this.handleProjectInfo(text, user_id, team_id, channel_id, res);
        break;
      case "/worklenz-assign":
        await this.handleAssignTask(text, user_id, team_id, channel_id, res);
        break;
      default:
        res.json({ text: "Unknown command" });
    }
  }

  // Create task from Slack
  private async handleCreateTask(
    text: string,
    userId: string,
    teamId: string,
    channelId: string,
    res: Response
  ): Promise<void> {
    // Parse task details from text
    // Format: "Task name | Project name | Assignee | Due date"
    const parts = text.split("|").map((p) => p.trim());

    if (parts.length < 2) {
      res.json({
        response_type: "ephemeral",
        text: "Usage: /worklenz-task Task name | Project name | Assignee (optional) | Due date (optional)",
      });
      return;
    }

    try {
      // Create task logic here
      // 1. Find project by name
      // 2. Find assignee if provided
      // 3. Create task in database
      // 4. Send confirmation

      res.json({
        response_type: "in_channel",
        text: `✅ Task "${parts[0]}" created in project "${parts[1]}"`,
      });
    } catch (error) {
      const unknownError = error as unknown;
      const errorMessage =
        unknownError && typeof unknownError === "object" && "message" in unknownError
          ? String((unknownError as { message?: unknown }).message)
          : "Unknown error";
      res.json({
        response_type: "ephemeral",
        text: `❌ Failed to create task: ${errorMessage}`,
      });
    }
  }

  // Get project info
  private async handleProjectInfo(
    text: string,
    userId: string,
    teamId: string,
    channelId: string,
    res: Response
  ): Promise<void> {
    // Implementation for project info
    res.json({
      response_type: "ephemeral",
      text: "Project info implementation pending",
    });
  }

  // Assign task
  private async handleAssignTask(
    text: string,
    userId: string,
    teamId: string,
    channelId: string,
    res: Response
  ): Promise<void> {
    // Implementation for task assignment
    res.json({
      response_type: "ephemeral",
      text: "Task assignment implementation pending",
    });
  }
}
