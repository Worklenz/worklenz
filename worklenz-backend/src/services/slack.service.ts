import db from "../config/db";
import { log_error } from "../shared/utils";

interface SlackWorkspace {
  id: string;
  organization_id: string;
  team_id: string;
  team_name: string;
  access_token: string;
  bot_user_id?: string;
  bot_access_token?: string;
  scope?: string;
  authed_user_id?: string;
  is_active: boolean;
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
   */
  public static async connectWorkspace(
    organizationId: string,
    slackData: SlackOAuthResponse
  ): Promise<SlackWorkspace> {
    try {
      const q = `
        INSERT INTO slack_workspaces (
          organization_id, team_id, team_name, access_token,
          bot_user_id, bot_access_token, scope, authed_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (organization_id, team_id)
        DO UPDATE SET
          team_name = EXCLUDED.team_name,
          access_token = EXCLUDED.access_token,
          bot_user_id = EXCLUDED.bot_user_id,
          bot_access_token = EXCLUDED.bot_access_token,
          scope = EXCLUDED.scope,
          authed_user_id = EXCLUDED.authed_user_id,
          is_active = true,
          updated_at = CURRENT_TIMESTAMP
        RETURNING *;
      `;

      const result = await db.query(q, [
        organizationId,
        slackData.team_id,
        slackData.team_name,
        slackData.access_token,
        slackData.bot_user_id,
        slackData.bot?.bot_access_token,
        slackData.scope,
        slackData.authed_user?.id
      ]);

      return result.rows[0];
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Get workspace by organization ID
   */
  public static async getWorkspaceByOrganization(
    organizationId: string
  ): Promise<SlackWorkspace | null> {
    try {
      const q = `SELECT * FROM slack_workspaces WHERE organization_id = $1 AND is_active = true LIMIT 1;`;
      const result = await db.query(q, [organizationId]);
      return result.rows[0] || null;
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Disconnect Slack workspace
   */
  public static async disconnectWorkspace(workspaceId: string): Promise<void> {
    try {
      const q = `UPDATE slack_workspaces SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`;
      await db.query(q, [workspaceId]);
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Sync Slack channels for a workspace
   */
  public static async syncChannels(
    workspaceId: string,
    channels: Array<{ id: string; name: string; is_private?: boolean; is_archived?: boolean }>
  ): Promise<void> {
    try {
      // Delete existing channels for this workspace
      await db.query(`DELETE FROM slack_channels WHERE slack_workspace_id = $1;`, [workspaceId]);

      // Insert new channels
      if (channels.length > 0) {
        const values = channels.map((channel, index) => {
          const offset = index * 5;
          return `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5})`;
        }).join(', ');

        const params = channels.flatMap(channel => [
          workspaceId,
          channel.id,
          channel.name,
          channel.is_private || false,
          channel.is_archived || false
        ]);

        const q = `
          INSERT INTO slack_channels (slack_workspace_id, channel_id, channel_name, is_private, is_archived)
          VALUES ${values};
        `;

        await db.query(q, params);
      }
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Get all channels for a workspace
   */
  public static async getChannelsByWorkspace(
    workspaceId: string
  ): Promise<SlackChannel[]> {
    try {
      const q = `
        SELECT * FROM slack_channels
        WHERE slack_workspace_id = $1 AND is_archived = false
        ORDER BY channel_name;
      `;
      const result = await db.query(q, [workspaceId]);
      return result.rows;
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
   * Get channel configs for a project
   */
  public static async getChannelConfigsByProject(
    projectId: string
  ): Promise<any[]> {
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
      const result = await db.query(q, [projectId]);
      return result.rows;
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Get channel configs by organization
   */
  public static async getChannelConfigsByOrganization(
    organizationId: string
  ): Promise<any[]> {
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
      const q = `UPDATE slack_channel_configs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`;
      await db.query(q, [configId]);
    } catch (error) {
      log_error(error);
      throw error;
    }
  }

  /**
   * Send notification to Slack
   */
  public static async sendNotification(
    channelConfigId: string,
    notificationType: string,
    entityType: string,
    entityId: string,
    message: any
  ): Promise<void> {
    try {
      // Get the channel config with workspace info
      const configQuery = `
        SELECT
          scc.*,
          sc.channel_id,
          sw.bot_access_token
        FROM slack_channel_configs scc
        JOIN slack_channels sc ON scc.slack_channel_id = sc.id
        JOIN slack_workspaces sw ON sc.slack_workspace_id = sw.id
        WHERE scc.id = $1 AND scc.is_active = true;
      `;
      const configResult = await db.query(configQuery, [channelConfigId]);

      if (configResult.rows.length === 0) {
        throw new Error('Channel config not found or inactive');
      }

      const config = configResult.rows[0];

      // Here you would integrate with Slack Web API to send the message
      // This is a placeholder for the actual Slack API call
      // const slackResponse = await fetch('https://slack.com/api/chat.postMessage', {
      //   method: 'POST',
      //   headers: {
      //     'Authorization': `Bearer ${config.bot_access_token}`,
      //     'Content-Type': 'application/json'
      //   },
      //   body: JSON.stringify({
      //     channel: config.channel_id,
      //     ...message
      //   })
      // });

      // Log the notification
      const logQuery = `
        INSERT INTO slack_notifications (
          slack_channel_config_id,
          notification_type,
          worklenz_entity_type,
          worklenz_entity_id,
          message_payload,
          status,
          sent_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, CURRENT_TIMESTAMP);
      `;

      await db.query(logQuery, [
        channelConfigId,
        notificationType,
        entityType,
        entityId,
        JSON.stringify(message),
        'sent' // or 'failed' based on Slack API response
      ]);
    } catch (error) {
      log_error(error);
      // Log failed notification
      const failQuery = `
        INSERT INTO slack_notifications (
          slack_channel_config_id,
          notification_type,
          worklenz_entity_type,
          worklenz_entity_id,
          message_payload,
          status,
          error_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7);
      `;

      await db.query(failQuery, [
        channelConfigId,
        notificationType,
        entityType,
        entityId,
        JSON.stringify(message),
        'failed',
        error instanceof Error ? error.message : 'Unknown error'
      ]);

      throw error;
    }
  }
}
