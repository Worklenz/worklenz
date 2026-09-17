import crypto from "crypto";
import db from "../config/db";
import { EncryptionService } from "./encryption.service";
import { log_error } from "../shared/utils";

export const DISCORD_NOTIFICATION_TYPES = [
  "task_assigned",
  "status_changed",
  "task_completed",
  "comment_added",
] as const;

export type DiscordNotificationType = typeof DISCORD_NOTIFICATION_TYPES[number];

interface DiscordConfig {
  id: string;
  organization_id: string;
  project_id: string | null;
  guild_id: string | null;
  webhook_url_encrypted: string;
  notification_types: string[];
  is_active: boolean;
}

interface DiscordTaskData {
  task_id: string;
  task_name: string;
  project_id: string;
  project_name: string;
  status_name?: string;
  assignee_names: string[];
  task_url: string;
}

export class DiscordService {
  public static validateWebhookUrl(webhookUrl: string): void {
    const parsed = new URL(webhookUrl);
    if (parsed.protocol !== "https:" || !/^discord(?:app)?\.com$/.test(parsed.hostname) ||
      !parsed.pathname.startsWith("/api/webhooks/")) {
      throw new Error("A valid Discord webhook URL is required");
    }
  }

  public static async getConfig(organizationId: string): Promise<{
    id: string;
    project_id: string | null;
    guild_id: string | null;
    notification_types: string[];
    is_active: boolean;
    webhook_configured: boolean;
  } | null> {
    const result = await db.query(
      `SELECT id, project_id, guild_id, notification_types, is_active,
              TRUE AS webhook_configured
         FROM discord_webhook_configs
        WHERE organization_id = $1
        ORDER BY project_id NULLS FIRST
        LIMIT 1`,
      [organizationId]
    );
    return result.rows[0] || null;
  }

  public static async saveConfig(
    organizationId: string,
    userId: string,
    data: { webhookUrl?: string; projectId?: string | null; guildId?: string; notificationTypes?: string[] }
  ): Promise<void> {
    if (data.webhookUrl) this.validateWebhookUrl(data.webhookUrl);
    const existing = await db.query(
      `SELECT id FROM discord_webhook_configs
        WHERE organization_id = $1
          AND COALESCE(project_id, '00000000-0000-0000-0000-000000000000'::UUID)
              = COALESCE($2::UUID, '00000000-0000-0000-0000-000000000000'::UUID)
        LIMIT 1`,
      [organizationId, data.projectId || null]
    );
    const notificationTypes: string[] = (data.notificationTypes || [...DISCORD_NOTIFICATION_TYPES])
      .filter((type: string): type is DiscordNotificationType =>
        (DISCORD_NOTIFICATION_TYPES as readonly string[]).includes(type)
      );
    if (existing.rows[0]) {
      const values: unknown[] = [existing.rows[0].id, notificationTypes];
      let query = `UPDATE discord_webhook_configs
                      SET notification_types = $2, guild_id = COALESCE($3, guild_id),
                          updated_at = CURRENT_TIMESTAMP`;
      values.push(data.guildId || null);
      if (data.webhookUrl) {
        values.push(EncryptionService.encrypt(data.webhookUrl));
        query += `, webhook_url_encrypted = $4`;
      }
      query += ` WHERE id = $1`;
      await db.query(query, values);
      return;
    }
    if (!data.webhookUrl) throw new Error("Webhook URL is required");
    await db.query(
      `INSERT INTO discord_webhook_configs
        (organization_id, project_id, guild_id, webhook_url_encrypted, notification_types, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        organizationId,
        data.projectId || null,
        data.guildId || null,
        EncryptionService.encrypt(data.webhookUrl),
        notificationTypes,
        userId,
      ]
    );
  }

  public static async deleteConfig(organizationId: string): Promise<void> {
    await db.query("DELETE FROM discord_webhook_configs WHERE organization_id = $1", [organizationId]);
  }

  public static async getConfigsForProject(projectId: string): Promise<DiscordConfig[]> {
    const result = await db.query(
      `SELECT c.*
         FROM discord_webhook_configs c
         JOIN projects p ON p.id = $1 AND p.team_id IN (
           SELECT id FROM teams WHERE organization_id = c.organization_id
         )
        WHERE c.is_active = TRUE AND (c.project_id = $1 OR c.project_id IS NULL)`,
      [projectId]
    );
    return result.rows;
  }

  public static async sendWebhook(config: DiscordConfig, payload: Record<string, unknown>): Promise<void> {
    const response = await fetch(EncryptionService.decrypt(config.webhook_url_encrypted), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!response.ok) throw new Error(`Discord webhook returned HTTP ${response.status}`);
  }

  public static async getTaskData(taskId: string): Promise<DiscordTaskData | null> {
    const result = await db.query(
      `SELECT t.id AS task_id, t.name AS task_name, t.project_id, p.name AS project_name,
              ts.name AS status_name,
              COALESCE(ARRAY_AGG(u.name) FILTER (WHERE u.name IS NOT NULL), ARRAY[]::TEXT[]) AS assignee_names
         FROM tasks t
         JOIN projects p ON p.id = t.project_id
         LEFT JOIN task_statuses ts ON ts.id = t.status_id
         LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
         LEFT JOIN team_members tm ON tm.id = ta.team_member_id
         LEFT JOIN users u ON u.id = tm.user_id
        WHERE t.id = $1
        GROUP BY t.id, p.name, ts.name`,
      [taskId]
    );
    const row = result.rows[0];
    if (!row) return null;
    const baseUrl = (process.env.FRONTEND_URL || "http://localhost:5173").replace(/\/+$/, "");
    return { ...row, task_url: `${baseUrl}/worklenz/projects/${row.project_id}?task=${row.task_id}` };
  }

  public static async sendTaskNotification(
    projectId: string,
    taskId: string,
    type: DiscordNotificationType,
    userName: string,
    statusChange?: { oldStatusName?: string; newStatusName?: string }
  ): Promise<void> {
    const task = await this.getTaskData(taskId);
    if (!task) return;
    const title = {
      task_assigned: "Task assigned",
      status_changed: "Task status changed",
      task_completed: "Task completed",
      comment_added: "New task comment",
    }[type];
    const description = type === "status_changed" || type === "task_completed"
      ? `${statusChange?.oldStatusName || "Previous status"} → ${statusChange?.newStatusName || task.status_name || "New status"}`
      : type === "task_assigned"
        ? `Assigned to: ${task.assignee_names.join(", ") || "No assignees"}`
        : `Comment added by ${userName}`;
    const payload = {
      username: "Worklenz",
      embeds: [{
        title,
        description,
        color: type === "task_completed" ? 0x2eb886 : 0x5865f2,
        fields: [
          { name: "Task", value: `[${task.task_name}](${task.task_url})`, inline: false },
          { name: "Project", value: task.project_name, inline: true },
          { name: "Updated by", value: userName, inline: true },
        ],
      }],
      components: [{
        type: 1,
        components: [{ type: 2, style: 5, label: "View task", url: task.task_url }],
      }],
    };
    const configs = await this.getConfigsForProject(projectId);
    await Promise.all(configs
      .filter(config => config.notification_types?.includes(type))
      .map(config => this.sendWebhook(config, payload).catch(error => {
        log_error(`Discord notification failed for config ${config.id}:`, error);
      })));
  }

  public static verifyInteraction(rawBody: string, timestamp: string, signature: string): boolean {
    const publicKey = process.env.DISCORD_PUBLIC_KEY;
    if (!publicKey || !rawBody || !timestamp || !signature) return false;
    const key = crypto.createPublicKey({
      key: Buffer.from(`302a300506032b6570032100${publicKey}`, "hex"),
      format: "der",
      type: "spki",
    });
    return crypto.verify(null, Buffer.from(timestamp + rawBody), key, Buffer.from(signature, "hex"));
  }

  public static async createDiscordComment(
    guildId: string,
    discordUserId: string,
    taskId: string,
    content: string
  ): Promise<void> {
    const mapping = await db.query(
      `SELECT m.user_id, m.team_member_id, tm.team_id
         FROM discord_user_mappings m
         JOIN team_members tm ON tm.id = m.team_member_id
        WHERE m.organization_id = (
          SELECT c.organization_id FROM discord_webhook_configs c WHERE c.guild_id = $1 LIMIT 1
        ) AND m.discord_user_id = $2`,
      [guildId, discordUserId]
    );
    const mappedUser = mapping.rows[0];
    if (!mappedUser) throw new Error("This Discord user is not linked to a Worklenz member");
    const task = await db.query(
      `SELECT t.project_id FROM tasks t
         JOIN projects p ON p.id = t.project_id
         JOIN teams tm ON tm.id = p.team_id
         JOIN discord_webhook_configs c ON c.organization_id = tm.organization_id
        WHERE t.id = $1 AND c.guild_id = $2`,
      [taskId, guildId]
    );
    if (!task.rows[0]) throw new Error("Task was not found in this Discord workspace");
    await db.query("SELECT create_task_comment($1) AS comment", [JSON.stringify({
      task_id: taskId,
      content,
      mentions: [],
      attachments: [],
      user_id: mappedUser.user_id,
      team_id: mappedUser.team_id,
    })]);
  }
}
