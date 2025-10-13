import db from "../config/db";
import { log_error } from "../shared/utils";
import { EncryptionService } from "./encryption.service";
import { PoolClient } from "pg";
import { ActivityLoggingService } from "./activity-logging.service";
import { WebClient } from "@slack/web-api";

interface SlackWorkspace {
  id: string;
  organization_id: string;
  team_id: string;
  team_name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface SlackChannel {
  id: string;
  slack_workspace_id: string;
  channel_id: string;
  channel_name: string;
  is_private: boolean;
  is_archived: boolean;
}

interface SlackChannelConfig {
  id: string;
  project_id: string;
  slack_channel_id: string;
  notification_types: string[];
  is_active: boolean;
  created_by?: string;
}

interface SlackChannelConfigWithDetails extends SlackChannelConfig {
  channel_name: string;
  slack_channel_identifier: string;
  workspace_name: string;
  project_name?: string;
  created_at: string;
  updated_at: string;
}

interface SlackOAuthResponse {
  team_id: string;
  team_name: string;
  access_token: string;
  bot_user_id?: string;
  bot?: {
    bot_access_token: string;
  };
  scope?: string;
  authed_user?: {
    id: string;
  };
}

export class SlackService {

  /**
   * Create or update Slack workspace connection
   * Tokens are encrypted before storage
   */
  public static async connectWorkspace(
    organizationId: string,
    slackData: SlackOAuthResponse,
    userId?: string
  ): Promise<SlackWorkspace> {
    try {
      // Encrypt sensitive tokens
      const encryptedAccessToken = EncryptionService.encrypt(slackData.access_token);
      const encryptedBotToken = slackData.bot?.bot_access_token
        ? EncryptionService.encrypt(slackData.bot.bot_access_token)
        : null;

      const q = `
        INSERT INTO slack_workspaces (
          organization_id, team_id, team_name, access_token_encrypted,
          bot_user_id, bot_access_token_encrypted, scope, authed_user_id, created_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT (organization_id, team_id)
        DO UPDATE SET
          team_name = EXCLUDED.team_name,
          access_token_encrypted = EXCLUDED.access_token_encrypted,
          bot_user_id = EXCLUDED.bot_user_id,
          bot_access_token_encrypted = EXCLUDED.bot_access_token_encrypted,
          scope = EXCLUDED.scope,
          authed_user_id = EXCLUDED.authed_user_id,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING id, organization_id, team_id, team_name, is_active, created_at, updated_at;
      `;

      const result = await db.query(q, [
        organizationId,
        slackData.team_id,
        slackData.team_name,
        encryptedAccessToken,
        slackData.bot_user_id,
        encryptedBotToken,
        slackData.scope,
        slackData.authed_user?.id,
        userId
      ]);

      const workspace = result.rows[0];

      // Audit log the connection
      await this.logAuditEvent(
        "SLACK_WORKSPACE_CONNECTED",
        userId || null,
        organizationId,
        {
          workspace_id: workspace.id,
          team_id: slackData.team_id,
          team_name: slackData.team_name
        }
      );

      return workspace;
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Get workspace by organization ID (without decrypted tokens)
   */
  public static async getWorkspaceByOrganization(
    organizationId: string
  ): Promise<SlackWorkspace | null> {
    try {
      const q = `
        SELECT id, organization_id, team_id, team_name, is_active, created_at, updated_at
        FROM slack_workspaces
        WHERE organization_id = $1 AND is_active = true
        LIMIT 1;
      `;
      const result = await db.query(q, [organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Get decrypted bot token for sending messages
   * ONLY use this internally for API calls
   */
  private static async getDecryptedBotToken(workspaceId: string): Promise<string | null> {
    try {
      const q = `
        SELECT bot_access_token_encrypted
        FROM slack_workspaces
        WHERE id = $1 AND is_active = true;
      `;
      const result = await db.query(q, [workspaceId]);

      if (result.rows.length === 0 || !result.rows[0].bot_access_token_encrypted) {
        return null;
      }

      return EncryptionService.decrypt(result.rows[0].bot_access_token_encrypted);
    } catch (error) {
      log_error(error);
      throw new Error("Failed to retrieve bot token");
    }
  }

  /**
   * Verify workspace belongs to organization (for authorization checks)
   */
  public static async verifyWorkspaceOwnership(
    workspaceId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const q = `
        SELECT COUNT(*) as count
        FROM slack_workspaces
        WHERE id = $1 AND organization_id = $2;
      `;
      const result = await db.query(q, [workspaceId, organizationId]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      log_error(error);
      return false;
    }
  }

  /**
   * Disconnect Slack workspace
   */
  public static async disconnectWorkspace(
    workspaceId: string,
    userId?: string,
    organizationId?: string
  ): Promise<void> {
    try {
      const q = `
        UPDATE slack_workspaces
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1
        RETURNING team_name;
      `;
      const result = await db.query(q, [workspaceId]);

      // Audit log the disconnection
      if (result.rows.length > 0) {
        await this.logAuditEvent(
          "SLACK_WORKSPACE_DISCONNECTED",
          userId || null,
          organizationId || null,
          {
            workspace_id: workspaceId,
            team_name: result.rows[0].team_name
          }
        );
      }
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Sync Slack channels for a workspace using proper transaction
   */
  public static async syncChannels(
    workspaceId: string,
    channels: { id: string; name: string; is_private?: boolean; is_archived?: boolean }[]
  ): Promise<void> {
    const client: PoolClient = await db.pool.connect();

    try {
      await client.query("BEGIN");

      // Delete existing channels
      await client.query(
        "DELETE FROM slack_channels WHERE slack_workspace_id = $1",
        [workspaceId]
      );

      // Insert new channels one by one (safer than dynamic SQL)
      for (const channel of channels) {
        await client.query(
          `INSERT INTO slack_channels (slack_workspace_id, channel_id, channel_name, is_private, is_archived)
           VALUES ($1, $2, $3, $4, $5)`,
          [
            workspaceId,
            channel.id,
            channel.name,
            channel.is_private || false,
            channel.is_archived || false
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      log_error(error);
      throw new Error("Failed to sync channels");
    } finally {
      client.release();
    }
  }

  /**
   * Fetch channels from Slack API and sync to database
   */
  public static async fetchAndSyncChannels(workspaceId: string): Promise<void> {
    try {
      const botToken = await this.getDecryptedBotToken(workspaceId);
      if (!botToken) {
        throw new Error("No bot token found for workspace");
      }

      // Fetch channels from Slack API (including private channels)
      const url = new URL("https://slack.com/api/conversations.list");
      url.searchParams.append("types", "public_channel,private_channel");
      url.searchParams.append("exclude_archived", "false");
      url.searchParams.append("limit", "1000");

      const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${botToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!data.ok) {
        log_error(data);
        throw new Error(`Slack API error: ${data.error}`);
      }

      // Map and sync channels
      const channels = data.channels?.map((ch: any) => ({
        id: ch.id,
        name: ch.name,
        is_private: ch.is_private || false,
        is_archived: ch.is_archived || false,
      })) || [];

      await this.syncChannels(workspaceId, channels);
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Get all channels for a workspace with pagination
   * Fetches from Slack API if not in database
   */
  public static async getChannelsByWorkspace(
    workspaceId: string,
    page = 1,
    limit = 100
  ): Promise<{ channels: SlackChannel[]; total: number }> {
    try {
      // Check if channels exist in database
      const countResult = await db.query(
        `SELECT COUNT(*) as total FROM slack_channels
         WHERE slack_workspace_id = $1`,
        [workspaceId]
      );

      // If no channels in DB, fetch from Slack API
      if (parseInt(countResult.rows[0].total) === 0) {
        await this.fetchAndSyncChannels(workspaceId);
      }

      const offset = (page - 1) * limit;

      const [channelsResult, totalCountResult] = await Promise.all([
        db.query(
          `SELECT * FROM slack_channels
           WHERE slack_workspace_id = $1 AND is_archived = false
           ORDER BY channel_name
           LIMIT $2 OFFSET $3`,
          [workspaceId, limit, offset]
        ),
        db.query(
          `SELECT COUNT(*) as total FROM slack_channels
           WHERE slack_workspace_id = $1 AND is_archived = false`,
          [workspaceId]
        )
      ]);

      return {
        channels: channelsResult.rows,
        total: parseInt(totalCountResult.rows[0].total)
      };
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Create channel configuration for a project
   */
  public static async createChannelConfig(
    projectId: string,
    slackChannelId: string,
    notificationTypes: string[],
    createdBy?: string
  ): Promise<SlackChannelConfig> {
    try {
      const q = `
        INSERT INTO slack_channel_configs (project_id, slack_channel_id, notification_types, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (project_id, slack_channel_id)
        DO UPDATE SET
          notification_types = EXCLUDED.notification_types,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const result = await db.query(q, [projectId, slackChannelId, notificationTypes, createdBy]);
      return result.rows[0];
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Verify channel config belongs to organization
   */
  public static async verifyChannelConfigOwnership(
    configId: string,
    organizationId: string
  ): Promise<boolean> {
    try {
      const q = `
        SELECT COUNT(*) as count
        FROM slack_channel_configs scc
        JOIN slack_channels sc ON scc.slack_channel_id = sc.id
        JOIN slack_workspaces sw ON sc.slack_workspace_id = sw.id
        WHERE scc.id = $1 AND sw.organization_id = $2;
      `;
      const result = await db.query(q, [configId, organizationId]);
      return parseInt(result.rows[0].count) > 0;
    } catch (error) {
      log_error(error);
      return false;
    }
  }

  /**
   * Get channel configs for a project
   */
  public static async getChannelConfigsByProject(
    projectId: string
  ): Promise<SlackChannelConfigWithDetails[]> {
    console.log(`[SLACK_DEBUG] getChannelConfigsByProject called for projectId: ${projectId}`);

    try {
      const q = `
        SELECT
          scc.*,
          sc.channel_name,
          sc.channel_id as slack_channel_identifier,
          sw.team_name as workspace_name
        FROM slack_channel_configs scc
        JOIN slack_channels sc ON scc.slack_channel_id = sc.id
        JOIN slack_workspaces sw ON sc.slack_workspace_id = sw.id
        WHERE scc.project_id = $1 AND scc.is_active = true
        ORDER BY scc.created_at DESC;
      `;

      console.log(`[SLACK_DEBUG] Executing query to fetch channel configs...`);
      const result = await db.query(q, [projectId]);

      console.log(`[SLACK_DEBUG] Query result: Found ${result.rows.length} channel config(s)`);

      if (result.rows.length > 0) {
        result.rows.forEach((row, index) => {
          console.log(`[SLACK_DEBUG] Config ${index + 1}:`, {
            id: row.id,
            project_id: row.project_id,
            slack_channel_id: row.slack_channel_id,
            channel_name: row.channel_name,
            workspace_name: row.workspace_name,
            notification_types: row.notification_types,
            is_active: row.is_active
          });
        });
      } else {
        console.warn(`[SLACK_DEBUG] No active channel configs found for project ${projectId}`);
        console.log(`[SLACK_DEBUG] Possible reasons:`);
        console.log(`[SLACK_DEBUG] 1. No channel configs created for this project`);
        console.log(`[SLACK_DEBUG] 2. All channel configs are inactive (is_active = false)`);
        console.log(`[SLACK_DEBUG] 3. Channel configs exist but the joins are failing (check slack_channels and slack_workspaces)`);
      }

      return result.rows;
    } catch (error) {
      console.error(`[SLACK_DEBUG] Error in getChannelConfigsByProject:`, error);
      log_error(error);
      throw error;
    }
  }

  /**
   * Get channel configs by organization
   */
  public static async getChannelConfigsByOrganization(
    organizationId: string
  ): Promise<SlackChannelConfigWithDetails[]> {
    try {
      const q = `
        SELECT
          scc.*,
          sc.channel_name,
          sc.channel_id as slack_channel_identifier,
          sw.team_name as workspace_name,
          p.name as project_name
        FROM slack_channel_configs scc
        JOIN slack_channels sc ON scc.slack_channel_id = sc.id
        JOIN slack_workspaces sw ON sc.slack_workspace_id = sw.id
        JOIN projects p ON scc.project_id = p.id
        WHERE sw.organization_id = $1 AND scc.is_active = true
        ORDER BY scc.created_at DESC;
      `;
      const result = await db.query(q, [organizationId]);
      return result.rows;
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Delete channel config
   */
  public static async deleteChannelConfig(configId: string): Promise<void> {
    try {
      const q = `
        UPDATE slack_channel_configs
        SET is_active = false, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1;
      `;
      await db.query(q, [configId]);
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Send notification to Slack
   * NOTE: This is a placeholder - implement actual Slack Web API integration
   */
  public static async sendNotification(
    channelConfigId: string,
    notificationType: string,
    entityType: string,
    entityId: string,
    message: Record<string, unknown>
  ): Promise<void> {
    console.log(`[SLACK_DEBUG] SlackService.sendNotification called:`, {
      channelConfigId,
      notificationType,
      entityType,
      entityId,
      messageKeys: Object.keys(message)
    });

    try {
      // Get the channel config with workspace info
      const configQuery = `
        SELECT
          scc.*,
          sc.channel_id,
          sc.channel_name,
          sw.id as workspace_id,
          sw.team_name
        FROM slack_channel_configs scc
        JOIN slack_channels sc ON scc.slack_channel_id = sc.id
        JOIN slack_workspaces sw ON sc.slack_workspace_id = sw.id
        WHERE scc.id = $1 AND scc.is_active = true;
      `;

      console.log(`[SLACK_DEBUG] Fetching channel config for ID: ${channelConfigId}`);

      const configResult = await db.query(configQuery, [channelConfigId]);

      if (configResult.rows.length === 0) {
        console.error(`[SLACK_DEBUG] Channel config not found or inactive for ID: ${channelConfigId}`);
        throw new Error("Channel config not found or inactive");
      }

      const config = configResult.rows[0];

      console.log(`[SLACK_DEBUG] Channel config found:`, {
        config_id: config.id,
        channel_id: config.channel_id,
        channel_name: config.channel_name,
        workspace_id: config.workspace_id,
        team_name: config.team_name,
        is_active: config.is_active
      });

      // Get decrypted bot token
      console.log(`[SLACK_DEBUG] Fetching bot token for workspace: ${config.workspace_id}`);
      const botToken = await this.getDecryptedBotToken(config.workspace_id);

      if (!botToken) {
        console.error(`[SLACK_DEBUG] Bot token not found for workspace: ${config.workspace_id}`);
        throw new Error("Bot token not found");
      }

      console.log(`[SLACK_DEBUG] Bot token retrieved successfully (length: ${botToken.length})`);

      // Send message to Slack using Web API
      console.log(`[SLACK_DEBUG] Initializing Slack WebClient...`);
      const slack = new WebClient(botToken);

      const messagePayload = {
        channel: config.channel_id,
        text: message.text as string || "Worklenz Notification",
        blocks: message.blocks as any[] || undefined,
        ...message
      };

      console.log(`[SLACK_DEBUG] Sending message to Slack channel: ${config.channel_name} (${config.channel_id})`);
      console.log(`[SLACK_DEBUG] Message payload:`, JSON.stringify(messagePayload, null, 2));

      const result = await slack.chat.postMessage(messagePayload);

      console.log(`[SLACK_DEBUG] Slack API response:`, {
        ok: result.ok,
        ts: result.ts,
        channel: result.channel,
        message: result.message ? "present" : "missing"
      });

      if (!result.ok) {
        console.error(`[SLACK_DEBUG] Slack API returned ok: false`);
        throw new Error("Slack API returned error");
      }

      // Log the notification as sent with Slack message timestamp
      console.log(`[SLACK_DEBUG] Logging notification as sent...`);
      await this.logNotification(
        channelConfigId,
        notificationType,
        entityType,
        entityId,
        message,
        "sent",
        null,
        result.ts as string || null
      );

      console.log(`[SLACK_DEBUG] Notification sent successfully to channel ${config.channel_name}`);
    } catch (error) {
      console.error(`[SLACK_DEBUG] Error in sendNotification:`, error);
      console.error(`[SLACK_DEBUG] Error details:`, {
        name: error instanceof Error ? error.name : "unknown",
        message: error instanceof Error ? error.message : "unknown",
        stack: error instanceof Error ? error.stack : "unknown"
      });

      log_error(error);

      // Log failed notification
      console.log(`[SLACK_DEBUG] Logging notification as failed...`);
      await this.logNotification(
        channelConfigId,
        notificationType,
        entityType,
        entityId,
        message,
        "failed",
        error instanceof Error ? error.message : "Unknown error",
        null
      );

      throw error;
    }
  }

  /**
   * Log notification attempt
   */
  private static async logNotification(
    channelConfigId: string,
    notificationType: string,
    entityType: string,
    entityId: string,
    message: Record<string, unknown>,
    status: "sent" | "failed" | "pending",
    errorMessage: string | null,
    slackMessageTs: string | null
  ): Promise<void> {
    try {
      const sentAt = status === "sent" ? new Date().toISOString() : null;
      
      const q = `
        INSERT INTO slack_notifications (
          slack_channel_config_id,
          notification_type,
          worklenz_entity_type,
          worklenz_entity_id,
          message_payload,
          status,
          error_message,
          slack_message_ts,
          sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
      `;

      await db.query(q, [
        channelConfigId,
        notificationType,
        entityType,
        entityId,
        JSON.stringify(message),
        status,
        errorMessage,
        slackMessageTs,
        sentAt
      ]);
    } catch (error) {
      log_error(error);
      // Don't throw - logging failure shouldn't break the main flow
    }
  }

  /**
   * Log audit events for Slack operations
   * This creates an audit trail for security and compliance
   */
  private static async logAuditEvent(
    action: string,
    userId: string | null,
    organizationId: string | null,
    details: Record<string, any>
  ): Promise<void> {
    try {
      const q = `
        INSERT INTO slack_audit_log (
          action,
          user_id,
          organization_id,
          details,
          ip_address,
          user_agent,
          created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);
      `;

      await db.query(q, [
        action,
        userId,
        organizationId,
        JSON.stringify(details),
        null, // IP address would need to be passed from controller
        null  // User agent would need to be passed from controller
      ]);
    } catch (error) {
      // Log but don't throw - audit logging failure shouldn't break operations
      log_error(error);
    }
  }
}
