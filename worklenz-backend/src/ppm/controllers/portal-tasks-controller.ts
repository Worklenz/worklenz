import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPPMClientSession } from "../middleware/require-client-auth";
import { withClientScope, getClientPrimaryProject, getPPMSystemUser, UUID_RE } from "../utils/ppm-db";

export default class PortalTasksController {
  /**
   * GET /ppm/api/portal/tasks
   * List tasks from all client-linked projects (portal board view).
   * Visibility enforced at query level — hides 'queued' and 'internal_review'.
   */
  public static async list(req: Request, res: Response) {
    try {
      const ppmClient = (req as any).ppmClient as IPPMClientSession;
      const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      const limit = 50;
      const offset = (page - 1) * limit;

      const filter = req.query.filter as string;
      let statusFilter = "";
      if (filter === "awaiting_review") {
        statusFilter = `AND d.status = 'client_review'`;
      } else if (filter === "approved") {
        statusFilter = `AND d.status IN ('approved', 'done')`;
      }

      const rows = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          SELECT
            d.id,
            d.title,
            d.description,
            d.status,
            d.due_date,
            d.created_at,
            d.worklenz_task_id,
            p.label AS priority,
            t.label AS type,
            (SELECT COUNT(*) FROM ppm_comments pc WHERE pc.deliverable_id = d.id) AS comment_count
          FROM ppm_deliverables d
          LEFT JOIN ppm_dropdown_options p ON d.priority_id = p.id
          LEFT JOIN ppm_dropdown_options t ON d.type_id = t.id
          WHERE d.visibility = 'client_visible'
            AND d.status IN ('incoming', 'in_progress', 'client_review', 'revision', 'approved', 'done')
            ${statusFilter}
          ORDER BY d.created_at DESC
          LIMIT $1 OFFSET $2
        `, [limit, offset]);
        return result.rows;
      });

      return res.status(200).json(new ServerResponse(true, rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch tasks"));
    }
  }

  /**
   * POST /ppm/api/portal/tasks
   * Create a new task from the portal.
   * Flow: INSERT ppm_deliverables → create_quick_task() → link deliverable → NOTIFY
   */
  public static async create(req: Request, res: Response) {
    try {
      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const { title, description, priority_id, type_id, due_date, idempotency_key } = req.body;
      if (!title || typeof title !== "string" || !title.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Title is required"));
      }
      if (title.trim().length > 500) {
        return res.status(400).json(new ServerResponse(false, null, "Title exceeds 500 characters"));
      }

      // Idempotency check (prevent double-submit)
      if (idempotency_key) {
        const existing = await db.pool.query(
          `SELECT entity_id AS id FROM ppm_audit_log
           WHERE entity_type = 'deliverable' AND action = 'created'
             AND details->>'idempotency_key' = $1
           LIMIT 1`,
          [idempotency_key]
        );
        if (existing.rows[0]) {
          return res.status(200).json(new ServerResponse(true, { id: existing.rows[0].id }, "Already created"));
        }
      }

      // Get primary project + incoming status
      const primaryProject = await getClientPrimaryProject(ppmClient.clientId);
      if (!primaryProject) {
        return res.status(409).json(new ServerResponse(false, null, "No project configured — contact your account manager"));
      }
      if (!primaryProject.incoming_status_id) {
        return res.status(409).json(new ServerResponse(false, null, "Project not properly configured — contact your account manager"));
      }

      const systemUserId = await getPPMSystemUser();

      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");

        // 1. INSERT into ppm_deliverables (source of truth)
        const deliverableResult = await conn.query(
          `INSERT INTO ppm_deliverables (
            title, description, status, visibility, client_id,
            priority_id, type_id, due_date, submission_date
          ) VALUES ($1, $2, 'incoming', 'client_visible', $3, $4, $5, $6, CURRENT_DATE)
          RETURNING id`,
          [title.trim(), description || null, ppmClient.clientId,
           priority_id || null, type_id || null, due_date || null]
        );
        const deliverableId = deliverableResult.rows[0].id;

        // 2. Create Worklenz task via create_quick_task()
        const taskBody = JSON.stringify({
          project_id: primaryProject.project_id,
          reporter_id: systemUserId,
          name: title.trim(),
          status_id: primaryProject.incoming_status_id,
        });

        const taskResult = await conn.query(
          `SELECT create_quick_task($1) AS task_json`,
          [taskBody]
        );
        // create_quick_task() returns a full JSON task object — extract the id field
        const taskJson = taskResult.rows[0]?.task_json;
        const worklenzTaskId = typeof taskJson === "string" ? JSON.parse(taskJson)?.id : taskJson?.id;

        // 3. Link deliverable to Worklenz task
        if (worklenzTaskId) {
          await conn.query(
            `UPDATE ppm_deliverables SET worklenz_task_id = $1 WHERE id = $2`,
            [worklenzTaskId, deliverableId]
          );
        }

        // 4. Audit log
        await conn.query(
          `INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, details)
           VALUES ('deliverable', $1, 'created', $2, 'client_user', $3)`,
          [deliverableId, ppmClient.userId, JSON.stringify({
            title: title.trim(),
            worklenz_task_id: worklenzTaskId,
            idempotency_key: idempotency_key || null,
          })]
        );

        // NOTIFY handled by ppm_task_created_trigger (migration 017) — fires on UPDATE OF worklenz_task_id

        await conn.query("COMMIT");

        return res.status(201).json(new ServerResponse(true, {
          id: deliverableId,
          worklenz_task_id: worklenzTaskId,
          title: title.trim(),
          status: "incoming",
        }));
      } catch (error: any) {
        await conn.query("ROLLBACK");

        // Handle FK violations
        if (error.code === "23503") {
          return res.status(400).json(new ServerResponse(false, null, "Invalid status or project configuration"));
        }
        throw error;
      } finally {
        conn.release();
      }
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create task"));
    }
  }

  /**
   * GET /ppm/api/portal/tasks/:id
   * Get task detail with comments.
   */
  public static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid task ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const row = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          SELECT
            d.id,
            d.title,
            d.description,
            d.status,
            d.due_date,
            d.submission_date,
            d.created_at,
            d.worklenz_task_id,
            p.label AS priority,
            t.label AS type,
            ch.label AS channel
          FROM ppm_deliverables d
          LEFT JOIN ppm_dropdown_options p ON d.priority_id = p.id
          LEFT JOIN ppm_dropdown_options t ON d.type_id = t.id
          LEFT JOIN ppm_dropdown_options ch ON d.channel_id = ch.id
          WHERE d.id = $1 AND d.visibility = 'client_visible'
            AND d.status IN ('incoming', 'in_progress', 'client_review', 'revision', 'approved', 'done')
        `, [id]);
        return result.rows[0] || null;
      });

      if (!row) {
        return res.status(404).json(new ServerResponse(false, null, "Task not found"));
      }

      // Get comments (not scoped by RLS — ppm_comments doesn't have RLS)
      const comments = await db.pool.query(
        `SELECT id, author_id, author_type, author_name, body, created_at
         FROM ppm_comments
         WHERE deliverable_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      // Get feedback (returned reasons) from audit log
      const feedback = await db.pool.query(
        `SELECT al.details, al.created_at, u.name AS returned_by
         FROM ppm_audit_log al
         LEFT JOIN users u ON u.id = al.actor_id
         WHERE al.entity_type = 'deliverable' AND al.entity_id = $1 AND al.action = 'returned'
         ORDER BY al.created_at DESC`,
        [id]
      );

      return res.status(200).json(new ServerResponse(true, {
        ...row,
        comments: comments.rows,
        feedback: feedback.rows,
      }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch task"));
    }
  }

  /**
   * POST /ppm/api/portal/tasks/:id/comments
   * Add a comment to a task from the portal.
   */
  public static async addComment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid task ID"));
      }

      const { body } = req.body;
      if (!body || typeof body !== "string" || !body.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Comment body is required"));
      }
      if (body.length > 10000) {
        return res.status(400).json(new ServerResponse(false, null, "Comment exceeds maximum length"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      // Verify the deliverable belongs to this client and is visible
      const check = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(
          `SELECT id, worklenz_task_id FROM ppm_deliverables
           WHERE id = $1 AND visibility = 'client_visible'`,
          [id]
        );
        return result.rows[0] || null;
      });

      if (!check) {
        return res.status(404).json(new ServerResponse(false, null, "Task not found"));
      }

      if (!check.worklenz_task_id) {
        return res.status(400).json(new ServerResponse(false, null, "Task is not yet linked to a Worklenz task — please try again shortly"));
      }

      // Get the author name
      const userResult = await db.pool.query(
        `SELECT COALESCE(display_name, email) AS name FROM ppm_client_users WHERE id = $1`,
        [ppmClient.userId]
      );
      const authorName = userResult.rows[0]?.name || ppmClient.email;

      const result = await db.pool.query(
        `INSERT INTO ppm_comments (task_id, deliverable_id, author_id, author_type, author_name, body)
         VALUES ($1, $2, $3, 'client', $4, $5)
         RETURNING id, author_type, author_name, body, created_at`,
        [check.worklenz_task_id, id, ppmClient.userId, authorName, body.trim()]
      );

      return res.status(201).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to add comment"));
    }
  }

  /**
   * GET /ppm/api/portal/tasks/:id/comments
   * List comments for a task.
   */
  public static async getComments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid task ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      // Verify access
      const check = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(
          `SELECT id FROM ppm_deliverables WHERE id = $1 AND visibility = 'client_visible'`,
          [id]
        );
        return result.rows[0] || null;
      });

      if (!check) {
        return res.status(404).json(new ServerResponse(false, null, "Task not found"));
      }

      const result = await db.pool.query(
        `SELECT id, author_id, author_type, author_name, body, created_at
         FROM ppm_comments
         WHERE deliverable_id = $1
         ORDER BY created_at ASC`,
        [id]
      );

      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch comments"));
    }
  }
}
