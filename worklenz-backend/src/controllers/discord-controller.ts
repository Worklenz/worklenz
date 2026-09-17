import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import db from "../config/db";
import { DiscordService } from "../services/discord.service";

export default class DiscordController {
  @HandleExceptions()
  public static async getConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) return res.status(401).send(new ServerResponse(false, null, "Organization is required"));
    return res.status(200).send(new ServerResponse(true, await DiscordService.getConfig(organizationId)));
  }

  @HandleExceptions()
  public static async saveConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId || !req.user?.id) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    await DiscordService.saveConfig(organizationId, req.user.id, req.body);
    return res.status(200).send(new ServerResponse(true, null, "Discord integration saved"));
  }

  @HandleExceptions()
  public static async deleteConfig(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    await DiscordService.deleteConfig(organizationId);
    return res.status(200).send(new ServerResponse(true, null, "Discord integration disconnected"));
  }

  @HandleExceptions()
  public static async getMappings(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    const result = await db.query(
      `SELECT m.id, m.discord_user_id, m.user_id, m.team_member_id, u.name
         FROM discord_user_mappings m
         JOIN users u ON u.id = m.user_id
        WHERE m.organization_id = $1
        ORDER BY u.name`,
      [organizationId]
    );
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async saveMapping(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    const { discordUserId, userId, teamMemberId } = req.body;
    if (!organizationId || !discordUserId || !userId || !teamMemberId) {
      return res.status(400).send(new ServerResponse(false, null, "Discord user, Worklenz user, and team member are required"));
    }
    await db.query(
      `INSERT INTO discord_user_mappings (organization_id, discord_user_id, user_id, team_member_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (organization_id, discord_user_id)
       DO UPDATE SET user_id = EXCLUDED.user_id, team_member_id = EXCLUDED.team_member_id, updated_at = CURRENT_TIMESTAMP`,
      [organizationId, discordUserId, userId, teamMemberId]
    );
    return res.status(200).send(new ServerResponse(true, null, "Discord member linked"));
  }

  @HandleExceptions()
  public static async deleteMapping(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const organizationId = req.user?.organization_id;
    if (!organizationId) return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    await db.query("DELETE FROM discord_user_mappings WHERE id = $1 AND organization_id = $2", [req.params.id, organizationId]);
    return res.status(200).send(new ServerResponse(true, null, "Discord member unlinked"));
  }

  public static async interactions(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const rawBody = req.rawBody || JSON.stringify(req.body);
    if (!DiscordService.verifyInteraction(
      rawBody,
      req.header("X-Signature-Timestamp") || "",
      req.header("X-Signature-Ed25519") || ""
    )) {
      return res.status(401).send({ error: "Invalid Discord signature" });
    }
    if (req.body.type === 1) return res.status(200).send({ type: 1 });
    if (req.body.type !== 2) return res.status(200).send({ type: 4, data: { content: "Unsupported interaction", flags: 64 } });

    const options = Object.fromEntries((req.body.data?.options || []).map((option: { name: string; value: string }) => [option.name, option.value]));
    try {
      await DiscordService.createDiscordComment(
        req.body.guild_id,
        req.body.member?.user?.id || req.body.user?.id,
        options.task_id,
        options.comment
      );
      return res.status(200).send({ type: 4, data: { content: "Comment added to Worklenz.", flags: 64 } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to add comment";
      return res.status(200).send({ type: 4, data: { content: message, flags: 64 } });
    }
  }
}
