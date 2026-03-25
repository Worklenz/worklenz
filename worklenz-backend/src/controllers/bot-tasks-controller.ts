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
  public static async create(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.id as string;
      const teamId = (req as any).user?.team_id as string;

      const tasks = Array.isArray(req.body.tasks) ? req.body.tasks : [req.body];
      const created = [];

      for (const task of tasks) {
        if (!task.name?.trim()) {
          continue; // skip tasks without a name
        }

        if (!task.project_id) {
          continue; // skip tasks without a project
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
