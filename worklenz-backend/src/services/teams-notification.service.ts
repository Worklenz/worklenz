import axios from "axios";
import db from "../config/db";
import { log_error } from "../shared/utils";
import { EncryptionService } from "./encryption.service";

export interface TeamsWebhook {
  id: string;
  project_id: string;
  name: string;
  notification_types: string[];
  is_active: boolean;
  last_sent_at: string | null;
  last_error: string | null;
  created_at: string;
}

interface TeamsWebhookWithUrl extends TeamsWebhook {
  webhook_url: string;
}

// Hosts Microsoft issues incoming-webhook / Workflows URLs on. The URL is user supplied and
// requested server-side, so anything else is rejected (SSRF guard).
const ALLOWED_HOST_SUFFIXES = [
  "logic.azure.com",
  "logic.azure.us",
  "powerplatform.com",
  "powerplatform.us",
  "webhook.office.com",
  "webhook.office365.com",
  "outlook.office.com"
];

// Teams throttles a webhook above 4 requests/second, so sends to one webhook are spaced out and
// 429/5xx/network failures are retried with backoff.
const MIN_SEND_INTERVAL_MS = 250;
const MAX_QUEUE_WAIT_MS = 30000;
const MAX_ATTEMPTS = 3;
const BASE_RETRY_DELAY_MS = 500;
const MAX_RETRY_DELAY_MS = 10000;

const PUBLIC_COLUMNS = `id, project_id, name, notification_types, is_active, last_sent_at, last_error, created_at`;

/**
 * Teams Notification Service
 * Stores per-project Microsoft Teams incoming webhooks and posts adaptive cards to them
 */
export class TeamsNotificationService {

  /**
   * Returns an error message when the URL is not an acceptable Teams webhook URL, otherwise null
   */
  public static validateWebhookUrl(rawUrl: unknown): string | null {
    if (typeof rawUrl !== "string" || !rawUrl.trim()) return "Webhook URL is required";

    let url: URL;
    try {
      url = new URL(rawUrl.trim());
    } catch {
      return "Webhook URL is not a valid URL";
    }

    if (url.protocol !== "https:") return "Webhook URL must use https";

    const host = url.hostname.toLowerCase();
    const allowed = ALLOWED_HOST_SUFFIXES.some(suffix => host === suffix || host.endsWith(`.${suffix}`));
    if (!allowed) return "Webhook URL must be a Microsoft Teams (Workflows) webhook URL";

    return null;
  }

  /** Next time (ms epoch) a send to each webhook may start */
  private static nextSlot = new Map<string, number>();

  public static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /** Reserve the next send slot for a webhook and wait for it */
  private static async waitForSlot(paceKey: string): Promise<void> {
    const now = Date.now();
    for (const [key, time] of this.nextSlot) {
      if (time < now) this.nextSlot.delete(key);
    }

    const slot = Math.max(now, this.nextSlot.get(paceKey) ?? 0);
    if (slot - now > MAX_QUEUE_WAIT_MS) {
      throw new Error("Teams webhook is rate limited; too many pending notifications");
    }

    this.nextSlot.set(paceKey, slot + MIN_SEND_INTERVAL_MS);
    if (slot > now) await this.sleep(slot - now);
  }

  private static isRetryable(error: any): boolean {
    const status = error?.response?.status;
    return status === undefined || status === 429 || status >= 500;
  }

  private static retryDelay(error: any, attempt: number): number {
    const retryAfter = Number(error?.response?.headers?.["retry-after"]);
    const delay = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : BASE_RETRY_DELAY_MS * 2 ** (attempt - 1);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
  }

  /**
   * Post a message to a Teams webhook URL
   * @param webhookUrl - The Teams incoming webhook URL
   * @param message - The message object (adaptive card format)
   * @param paceKey - Identifies the webhook for rate limiting (defaults to the URL)
   */
  public static async sendTeamsNotification(
    webhookUrl: string,
    message: any,
    paceKey: string = webhookUrl
  ): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      await this.waitForSlot(paceKey);

      try {
        await axios.post(webhookUrl, message, {
          headers: {
            "Content-Type": "application/json"
          },
          timeout: 10000, // 10 seconds timeout
          maxRedirects: 0
        });
        return;
      } catch (error: any) {
        if (attempt >= MAX_ATTEMPTS || !this.isRetryable(error)) {
          log_error("Teams webhook error:", error?.response?.data || error.message);
          throw error;
        }
        await this.sleep(this.retryDelay(error, attempt));
      }
    }
  }

  public static async getWebhooksByProject(projectId: string): Promise<TeamsWebhook[]> {
    const result = await db.query(
      `SELECT ${PUBLIC_COLUMNS} FROM teams_webhooks WHERE project_id = $1 ORDER BY is_active DESC, created_at DESC;`,
      [projectId]
    );
    return result.rows;
  }

  /** Active webhooks with their decrypted URL, for dispatching notifications */
  public static async getActiveWebhooksForDispatch(projectId: string): Promise<TeamsWebhookWithUrl[]> {
    const result = await db.query(
      `SELECT ${PUBLIC_COLUMNS}, webhook_url_encrypted
       FROM teams_webhooks WHERE project_id = $1 AND is_active = TRUE;`,
      [projectId]
    );

    const webhooks: TeamsWebhookWithUrl[] = [];
    for (const { webhook_url_encrypted, ...row } of result.rows) {
      try {
        webhooks.push({ ...row, webhook_url: EncryptionService.decrypt(webhook_url_encrypted) });
      } catch (error) {
        // One unreadable URL (e.g. after an encryption key change) must not block the others
        log_error(`Could not decrypt Teams webhook ${row.id}:`, error);
        await this.recordDelivery(row.id, "Stored webhook URL could not be decrypted. Remove and re-add this webhook.");
      }
    }
    return webhooks;
  }

  public static async createWebhook(
    projectId: string,
    name: string,
    webhookUrl: string,
    notificationTypes: string[],
    createdBy?: string
  ): Promise<TeamsWebhook> {
    const result = await db.query(
      `INSERT INTO teams_webhooks (project_id, name, webhook_url_encrypted, notification_types, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${PUBLIC_COLUMNS};`,
      [projectId, name, EncryptionService.encrypt(webhookUrl), notificationTypes, createdBy ?? null]
    );
    return result.rows[0];
  }

  /** Updates name / notification types / active flag. Returns null when the webhook is not in the project's team. */
  public static async updateWebhook(
    id: string,
    teamId: string,
    changes: { name?: string; notificationTypes?: string[]; isActive?: boolean }
  ): Promise<TeamsWebhook | null> {
    const result = await db.query(
      `UPDATE teams_webhooks tw
       SET name = COALESCE($3, tw.name),
           notification_types = COALESCE($4, tw.notification_types),
           is_active = COALESCE($5, tw.is_active),
           updated_at = CURRENT_TIMESTAMP
       FROM projects p
       WHERE tw.id = $1 AND p.id = tw.project_id AND p.team_id = $2
       RETURNING tw.id, tw.project_id, tw.name, tw.notification_types, tw.is_active,
                 tw.last_sent_at, tw.last_error, tw.created_at;`,
      [id, teamId, changes.name ?? null, changes.notificationTypes ?? null, changes.isActive ?? null]
    );
    return result.rows[0] ?? null;
  }

  public static async deleteWebhook(id: string, teamId: string): Promise<boolean> {
    const result = await db.query(
      `DELETE FROM teams_webhooks tw USING projects p
       WHERE tw.id = $1 AND p.id = tw.project_id AND p.team_id = $2;`,
      [id, teamId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  /** Decrypted URL of a webhook the team owns, or null */
  public static async getWebhookUrlForTeam(id: string, teamId: string): Promise<string | null> {
    const result = await db.query(
      `SELECT tw.webhook_url_encrypted FROM teams_webhooks tw
       JOIN projects p ON p.id = tw.project_id
       WHERE tw.id = $1 AND p.team_id = $2;`,
      [id, teamId]
    );
    const encrypted = result.rows[0]?.webhook_url_encrypted;
    return encrypted ? EncryptionService.decrypt(encrypted) : null;
  }

  /** Record the outcome of a delivery so users can see why a webhook stopped working */
  public static async recordDelivery(id: string, error?: string): Promise<void> {
    try {
      await db.query(
        `UPDATE teams_webhooks
         SET last_sent_at = CASE WHEN $2::text IS NULL THEN CURRENT_TIMESTAMP ELSE last_sent_at END,
             last_error = $2
         WHERE id = $1;`,
        [id, error ?? null]
      );
    } catch (err) {
      log_error("Error recording Teams delivery:", err);
    }
  }
}
