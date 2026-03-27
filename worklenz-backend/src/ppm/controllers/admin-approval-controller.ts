import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { UUID_RE } from "../utils/ppm-db";

export default class AdminApprovalController {
  /**
   * GET /ppm/api/admin/approval-queue
   * List all tasks with status='incoming' across all clients.
   */
  public static async list(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?.id;
      const myClientsOnly = req.query.my_clients === "true";

      let query = `
        SELECT
          d.id,
          d.title,
          d.description,
          d.status,
          d.due_date,
          d.created_at AS submitted_at,
          d.worklenz_task_id,
          c.id AS client_id,
          c.name AS client_name,
          p.label AS priority,
          t.label AS type,
          cu.email AS submitted_by_email,
          cu.display_name AS submitted_by_name,
          (SELECT COUNT(*) FROM ppm_audit_log al
           WHERE al.entity_type = 'deliverable' AND al.entity_id = d.id AND al.action = 'returned') AS return_count
        FROM ppm_deliverables d
        JOIN ppm_clients c ON c.id = d.client_id
        LEFT JOIN ppm_dropdown_options p ON d.priority_id = p.id
        LEFT JOIN ppm_dropdown_options t ON d.type_id = t.id
        LEFT JOIN ppm_audit_log al_created ON al_created.entity_type = 'deliverable'
          AND al_created.entity_id = d.id AND al_created.action = 'created'
        LEFT JOIN ppm_client_users cu ON cu.id = al_created.actor_id
        WHERE d.status = 'incoming'
          AND c.deactivated_at IS NULL
      `;

      const params: string[] = [];
      if (myClientsOnly) {
        query += ` AND c.id IN (SELECT client_id FROM ppm_client_partners WHERE user_id = $1)`;
        params.push(userId);
      }

      query += ` ORDER BY d.created_at ASC`;

      const result = await db.pool.query(query, params);
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch approval queue"));
    }
  }

  /**
   * GET /ppm/api/admin/approval-queue/count
   * Count of pending approval tasks (for badge display).
   */
  public static async count(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?.id;
      const myClientsOnly = req.query.my_clients === "true";

      let query = `
        SELECT COUNT(*) AS count
        FROM ppm_deliverables d
        JOIN ppm_clients c ON c.id = d.client_id
        WHERE d.status = 'incoming' AND c.deactivated_at IS NULL
      `;

      const params: string[] = [];
      if (myClientsOnly) {
        query += ` AND c.id IN (SELECT client_id FROM ppm_client_partners WHERE user_id = $1)`;
        params.push(userId);
      }

      const result = await db.pool.query(query, params);
      return res.status(200).json(new ServerResponse(true, { count: parseInt(result.rows[0].count, 10) }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch approval count"));
    }
  }

  /**
   * POST /ppm/api/admin/approval-queue/:id/approve
   * Approve a task — moves from 'incoming' to 'queued', optionally assigns.
   */
  public static async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const { assignee_id } = req.body;
      const userId = (req.user as any)?.id;

      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");

        // Move from incoming to queued
        const result = await conn.query(
          `UPDATE ppm_deliverables SET status = 'queued', assignee_id = $2
           WHERE id = $1 AND status = 'incoming'
           RETURNING id, title, status, worklenz_task_id`,
          [id, assignee_id || null]
        );

        if (!result.rows[0]) {
          await conn.query("ROLLBACK");
          return res.status(409).json(new ServerResponse(false, null, "Task not found or already approved — refresh"));
        }

        // If there's a linked Worklenz task, update its status too
        if (result.rows[0].worklenz_task_id) {
          // Look up the 'Queued' status ID for this project
          const taskResult = await conn.query(
            `SELECT t.project_id FROM tasks t WHERE t.id = $1`,
            [result.rows[0].worklenz_task_id]
          );

          if (taskResult.rows[0]) {
            const queuedStatus = await conn.query(
              `SELECT task_status_id FROM ppm_status_mapping
               WHERE project_id = $1 AND ppm_status = 'queued' LIMIT 1`,
              [taskResult.rows[0].project_id]
            );

            if (queuedStatus.rows[0]) {
              await conn.query(
                `UPDATE tasks SET status_id = $1 WHERE id = $2`,
                [queuedStatus.rows[0].task_status_id, result.rows[0].worklenz_task_id]
              );
            }
          }
        }

        // Log the approval
        await conn.query(
          `INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, details)
           VALUES ('deliverable', $1, 'approved_by_partner', $2, 'internal_user', $3)`,
          [id, userId, JSON.stringify({ assignee_id: assignee_id || null })]
        );

        await conn.query("COMMIT");
        return res.status(200).json(new ServerResponse(true, result.rows[0]));
      } catch (error) {
        await conn.query("ROLLBACK");
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to approve task"));
    }
  }

  /**
   * POST /ppm/api/admin/approval-queue/:id/return
   * Return a task to the client with structured feedback.
   */
  public static async returnToClient(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const { reason_id, comment } = req.body;
      if (!reason_id || !UUID_RE.test(reason_id)) {
        return res.status(400).json(new ServerResponse(false, null, "Valid feedback reason is required"));
      }

      const userId = (req.user as any)?.id;

      // Verify the task is in 'incoming' status
      const check = await db.pool.query(
        `SELECT id, title, client_id FROM ppm_deliverables WHERE id = $1 AND status = 'incoming'`,
        [id]
      );

      if (!check.rows[0]) {
        return res.status(409).json(new ServerResponse(false, null, "Task not found or not in Incoming status — refresh"));
      }

      // Log the return feedback (status stays 'incoming' — the feedback record distinguishes
      // returned tasks from new submissions)
      await db.pool.query(
        `INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, details)
         VALUES ('deliverable', $1, 'returned', $2, 'internal_user', $3)`,
        [id, userId, JSON.stringify({ reason_id, comment: comment || null })]
      );

      return res.status(200).json(new ServerResponse(true, check.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to return task"));
    }
  }

  /**
   * GET /ppm/api/admin/feedback-reasons
   * List available feedback reasons for the return-to-client modal.
   */
  public static async getFeedbackReasons(_req: Request, res: Response) {
    try {
      const result = await db.pool.query(
        `SELECT id, label, color, sort_order
         FROM ppm_dropdown_options
         WHERE category = 'feedback_reason' AND is_active = true
         ORDER BY sort_order ASC`
      );
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch feedback reasons"));
    }
  }
}
