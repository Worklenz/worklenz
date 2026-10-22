import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import { TeamsNotificationService } from "../services/teams-notification.service";
import { NOTIFICATION_EVENT_TYPES } from "../shared/notification-events";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function normalizeNotificationTypes(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  if (!value.every(v => NOTIFICATION_EVENT_TYPES.includes(v))) return null;
  return [...new Set(value as string[])];
}

function normalizeName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name.length >= 1 && name.length <= 100 ? name : null;
}

async function projectBelongsToTeam(projectId: string, teamId: string): Promise<boolean> {
  const result = await db.query(`SELECT 1 FROM projects WHERE id = $1 AND team_id = $2;`, [projectId, teamId]);
  return result.rows.length > 0;
}

export default class TeamsWebhookController {
  @HandleExceptions()
  public static async getByProject(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId } = req.params;
    const teamId = req.user?.team_id;

    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    if (!UUID_REGEX.test(projectId)) return res.status(400).send(new ServerResponse(false, null, "Invalid project ID format"));
    if (!(await projectBelongsToTeam(projectId, teamId))) {
      return res.status(403).send(new ServerResponse(false, null, "Access denied: Project not found or you don't have access"));
    }

    const webhooks = await TeamsNotificationService.getWebhooksByProject(projectId);
    return res.status(200).send(new ServerResponse(true, webhooks));
  }

  @HandleExceptions()
  public static async create(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, name, webhookUrl, notificationTypes } = req.body;
    const teamId = req.user?.team_id;

    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    if (typeof projectId !== "string" || !UUID_REGEX.test(projectId)) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid project ID format"));
    }

    const cleanName = normalizeName(name);
    if (!cleanName) return res.status(400).send(new ServerResponse(false, null, "Name must be 1-100 characters"));

    const urlError = TeamsNotificationService.validateWebhookUrl(webhookUrl);
    if (urlError) return res.status(400).send(new ServerResponse(false, null, urlError));

    const types = normalizeNotificationTypes(notificationTypes);
    if (!types) return res.status(400).send(new ServerResponse(false, null, "Select at least one valid notification type"));

    if (!(await projectBelongsToTeam(projectId, teamId))) {
      return res.status(403).send(new ServerResponse(false, null, "Access denied: Project not found or you don't have access"));
    }

    const webhook = await TeamsNotificationService.createWebhook(projectId, cleanName, webhookUrl.trim(), types, req.user?.id);
    return res.status(200).send(new ServerResponse(true, webhook, "Teams webhook added successfully"));
  }

  @HandleExceptions()
  public static async update(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { name, notificationTypes, isActive } = req.body;
    const teamId = req.user?.team_id;

    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    if (!UUID_REGEX.test(id)) return res.status(400).send(new ServerResponse(false, null, "Invalid webhook ID format"));

    const changes: { name?: string; notificationTypes?: string[]; isActive?: boolean } = {};
    if (name !== undefined) {
      const cleanName = normalizeName(name);
      if (!cleanName) return res.status(400).send(new ServerResponse(false, null, "Name must be 1-100 characters"));
      changes.name = cleanName;
    }
    if (notificationTypes !== undefined) {
      const types = normalizeNotificationTypes(notificationTypes);
      if (!types) return res.status(400).send(new ServerResponse(false, null, "Select at least one valid notification type"));
      changes.notificationTypes = types;
    }
    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") return res.status(400).send(new ServerResponse(false, null, "isActive must be a boolean"));
      changes.isActive = isActive;
    }

    const webhook = await TeamsNotificationService.updateWebhook(id, teamId, changes);
    if (!webhook) return res.status(404).send(new ServerResponse(false, null, "Teams webhook not found"));

    return res.status(200).send(new ServerResponse(true, webhook));
  }

  @HandleExceptions()
  public static async remove(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;

    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    if (!UUID_REGEX.test(id)) return res.status(400).send(new ServerResponse(false, null, "Invalid webhook ID format"));

    const deleted = await TeamsNotificationService.deleteWebhook(id, teamId);
    if (!deleted) return res.status(404).send(new ServerResponse(false, null, "Teams webhook not found"));

    return res.status(200).send(new ServerResponse(true, null, "Teams webhook removed"));
  }

  @HandleExceptions()
  public static async sendTest(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const teamId = req.user?.team_id;

    if (!teamId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    if (!UUID_REGEX.test(id)) return res.status(400).send(new ServerResponse(false, null, "Invalid webhook ID format"));

    const webhookUrl = await TeamsNotificationService.getWebhookUrlForTeam(id, teamId);
    if (!webhookUrl) return res.status(404).send(new ServerResponse(false, null, "Teams webhook not found"));

    const testMessage = {
      type: "message",
      attachments: [
        {
          contentType: "application/vnd.microsoft.card.adaptive",
          content: {
            $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
            type: "AdaptiveCard",
            version: "1.2",
            body: [
              { type: "TextBlock", text: "✅ Worklenz test notification", weight: "Bolder", size: "Medium", color: "Accent" },
              { type: "TextBlock", text: "Your Microsoft Teams integration is working correctly.", wrap: true }
            ]
          }
        }
      ]
    };

    try {
      await TeamsNotificationService.sendTeamsNotification(webhookUrl, testMessage, id);
      await TeamsNotificationService.recordDelivery(id);
      return res.status(200).send(new ServerResponse(true, null, "Test notification sent successfully"));
    } catch (error: any) {
      await TeamsNotificationService.recordDelivery(id, String(error?.message ?? error).slice(0, 500));
      return res.status(502).send(new ServerResponse(false, null, "Failed to send test notification. Check that the Teams webhook URL is still valid."));
    }
  }
}
