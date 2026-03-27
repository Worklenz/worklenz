import { Request, Response } from "express";

import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { IPPMClientSession } from "../middleware/require-client-auth";
import { withClientScope, UUID_RE } from "../utils/ppm-db";

const DELIVERABLE_COLUMNS = `
  d.id,
  d.title,
  d.description,
  d.status,
  d.visibility,
  d.submission_date,
  d.revisions_deadline,
  d.send_date,
  d.due_date,
  d.asset_review_link,
  d.month_completed,
  d.created_at,
  d.updated_at,
  t.label AS type,
  c.label AS channel,
  p.label AS priority
`;

const DELIVERABLE_JOINS = `
  FROM ppm_deliverables d
  LEFT JOIN ppm_dropdown_options t ON d.type_id = t.id
  LEFT JOIN ppm_dropdown_options c ON d.channel_id = c.id
  LEFT JOIN ppm_dropdown_options p ON d.priority_id = p.id
`;

export default class PortalDeliverablesController {
  /**
   * GET /ppm/api/portal/deliverables
   */
  public static async list(req: Request, res: Response) {
    try {
      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const rows = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          SELECT ${DELIVERABLE_COLUMNS} ${DELIVERABLE_JOINS}
          WHERE d.visibility = 'client_visible'
          ORDER BY d.created_at DESC
        `);
        return result.rows;
      });

      return res.status(200).json(new ServerResponse(true, rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch deliverables"));
    }
  }

  /**
   * GET /ppm/api/portal/deliverables/:id
   */
  public static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const row = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          SELECT ${DELIVERABLE_COLUMNS} ${DELIVERABLE_JOINS}
          WHERE d.id = $1 AND d.visibility = 'client_visible'
        `, [id]);
        return result.rows[0] || null;
      });

      if (!row) {
        return res.status(404).json(new ServerResponse(false, null, "Deliverable not found"));
      }

      return res.status(200).json(new ServerResponse(true, row));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch deliverable"));
    }
  }

  /**
   * POST /ppm/api/portal/deliverables/:id/approve
   *
   * Client approves a deliverable. Only allowed when status is 'client_review'.
   */
  public static async approve(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;
      if (ppmClient.role === "viewer") {
        return res.status(403).json(new ServerResponse(false, null, "Viewers cannot approve deliverables"));
      }

      const row = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          UPDATE ppm_deliverables
          SET status = 'approved'
          WHERE id = $1
            AND status = 'client_review'
            AND visibility = 'client_visible'
          RETURNING id, title, status
        `, [id]);
        return result.rows[0] || null;
      });

      if (!row) {
        return res.status(400).json(new ServerResponse(false, null, "Deliverable not found or not awaiting review"));
      }

      return res.status(200).json(new ServerResponse(true, row, "$approved"));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to approve deliverable"));
    }
  }

  /**
   * POST /ppm/api/portal/deliverables/:id/reject
   *
   * Client requests revision. Only allowed when status is 'client_review'.
   * Expects { comment: string } in body.
   */
  public static async reject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const { comment } = req.body;
      if (!comment || typeof comment !== "string" || !comment.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Revision feedback is required"));
      }
      if (comment.length > 10000) {
        return res.status(400).json(new ServerResponse(false, null, "Comment exceeds maximum length (10,000 characters)"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;
      if (ppmClient.role === "viewer") {
        return res.status(403).json(new ServerResponse(false, null, "Viewers cannot request revisions"));
      }

      const row = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          UPDATE ppm_deliverables
          SET status = 'revision'
          WHERE id = $1
            AND status = 'client_review'
            AND visibility = 'client_visible'
          RETURNING id, title, status
        `, [id]);

        if (result.rows.length > 0) {
          // Log the revision feedback in audit log
          await conn.query(`
            INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, client_id, details)
            VALUES ('deliverable', $1, 'revision_requested', $2, 'client_user', $3, $4)
          `, [id, ppmClient.userId, ppmClient.clientId, JSON.stringify({ comment: comment.trim() })]);
        }

        return result.rows[0] || null;
      });

      if (!row) {
        return res.status(400).json(new ServerResponse(false, null, "Deliverable not found or not awaiting review"));
      }

      return res.status(200).json(new ServerResponse(true, row, "$revision_requested"));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to request revision"));
    }
  }

  /**
   * POST /ppm/api/portal/deliverables/:id/comment
   *
   * Client adds a comment to a deliverable.
   */
  public static async addComment(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const { comment } = req.body;
      if (!comment || typeof comment !== "string" || !comment.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Comment is required"));
      }
      if (comment.length > 10000) {
        return res.status(400).json(new ServerResponse(false, null, "Comment exceeds maximum length (10,000 characters)"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const row = await withClientScope(ppmClient.clientId, async (conn) => {
        // Verify deliverable exists and is visible to client
        const check = await conn.query(`
          SELECT id FROM ppm_deliverables
          WHERE id = $1 AND visibility = 'client_visible'
        `, [id]);

        if (check.rows.length === 0) return null;

        const result = await conn.query(`
          INSERT INTO ppm_audit_log (entity_type, entity_id, action, actor_id, actor_type, client_id, details)
          VALUES ('deliverable', $1, 'comment', $2, 'client_user', $3, $4)
          RETURNING id, action, details, created_at
        `, [id, ppmClient.userId, ppmClient.clientId, JSON.stringify({ comment: comment.trim(), author_email: ppmClient.email })]);

        return result.rows[0] || null;
      });

      if (!row) {
        return res.status(404).json(new ServerResponse(false, null, "Deliverable not found"));
      }

      return res.status(200).json(new ServerResponse(true, row, "$comment_added"));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to add comment"));
    }
  }

  /**
   * GET /ppm/api/portal/deliverables/:id/comments
   *
   * Returns comments for a deliverable from the audit log.
   */
  public static async getComments(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid deliverable ID"));
      }

      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const rows = await withClientScope(ppmClient.clientId, async (conn) => {
        // Verify deliverable is visible
        const check = await conn.query(`
          SELECT id FROM ppm_deliverables WHERE id = $1 AND visibility = 'client_visible'
        `, [id]);
        if (check.rows.length === 0) return null;

        const result = await conn.query(`
          SELECT id, action, actor_type, details, created_at
          FROM ppm_audit_log
          WHERE entity_type = 'deliverable'
            AND entity_id = $1
            AND client_id = $2
            AND action IN ('comment', 'revision_requested')
          ORDER BY created_at ASC
        `, [id, ppmClient.clientId]);
        return result.rows;
      });

      if (rows === null) {
        return res.status(404).json(new ServerResponse(false, null, "Deliverable not found"));
      }

      return res.status(200).json(new ServerResponse(true, rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch comments"));
    }
  }

  /**
   * GET /ppm/api/portal/branding
   *
   * Returns the client's branding config (logo, colors).
   */
  public static async getBranding(req: Request, res: Response) {
    try {
      const ppmClient = (req as any).ppmClient as IPPMClientSession;

      const row = await withClientScope(ppmClient.clientId, async (conn) => {
        const result = await conn.query(`
          SELECT name, branding_config
          FROM ppm_clients
          WHERE id = $1
        `, [ppmClient.clientId]);
        return result.rows[0] || null;
      });

      if (!row) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      return res.status(200).json(new ServerResponse(true, row));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch branding"));
    }
  }
}
