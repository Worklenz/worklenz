import { Request, Response } from "express";

import db from "../config/db";
import { ServerResponse } from "../models/server-response";
import { log_error } from "../shared/utils";
import { NotificationsService } from "../services/notifications/notifications.service";

export default class BotTasksController {
  /**
   * POST /ppm/api/bot/tasks
   *
   * Creates one or more tasks from bot-extracted action items.
   * Expects req.body to contain either a single task or an array of tasks under `tasks`.
   *
   * Single task body:
   *   { name, project_id, description?, assignees?, labels?, priority_id?, start?, end? }
   *
   * Batch body:
   *   { tasks: [{ name, project_id, ... }, ...] }
   */
  private static readonly UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  public static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as string;
      const teamId = (req as any).user?.team_id as string;

      if (!userId || !teamId || !BotTasksController.UUID_RE.test(userId) || !BotTasksController.UUID_RE.test(teamId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid user or team context"));
      }

      const tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [req.body];
      const created = [];

      for (const task of tasks) {
        if (!task.name?.trim()) {
          continue; // skip tasks without a name
        }

        if (!task.project_id || !BotTasksController.UUID_RE.test(task.project_id)) {
          continue; // skip tasks without a valid project UUID
        }

        // Verify project belongs to the bot's team
        const projectCheck = await db.query(
          `SELECT id FROM projects WHERE id = $1 AND team_id = $2`,
          [task.project_id, teamId]
        );
        if (projectCheck.rows.length === 0) {
          continue; // skip tasks for projects outside the bot's team
        }

        const payload = {
          name: task.name.slice(0, 100),
          project_id: task.project_id,
          description: task.description?.slice(0, 4000) || null,
          assignees: Array.isArray(task.assignees) ? task.assignees : [],
          labels: Array.isArray(task.labels) ? task.labels.map((l: string) => ({ name: l, color: "#a1a1a1" })) : [],
          reporter_id: userId,
          team_id: teamId,
          total_minutes: 0,
          inline: false,
          priority_id: task.priority_id || null,
          start_date: task.start || null,
          end_date: task.end || null,
          status_id: task.status_id || null,
        };

        const q = `SELECT create_task($1) AS task;`;
        const result = await db.query(q, [JSON.stringify(payload)]);
        const [data] = result.rows;

        if (data?.task) {
          // Send assignment notifications
          for (const member of data.task.assignees || []) {
            NotificationsService.createTaskUpdate(
              "ASSIGN",
              userId,
              data.task.id,
              member.user_id,
              member.team_id
            );
          }
          created.push(data.task);
        }
      }

      return res.status(200).json(new ServerResponse(true, { created, count: created.length }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create tasks"));
    }
  }
}
