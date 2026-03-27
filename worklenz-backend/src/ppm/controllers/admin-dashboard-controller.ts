import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";

export default class AdminDashboardController {
  /**
   * GET /ppm/api/admin/dashboard
   * Aggregated stats for the master dashboard.
   */
  public static async getStats(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?.id;
      const myClientsOnly = req.query.my_clients === "true";

      const clientFilter = myClientsOnly
        ? `AND c.id IN (SELECT client_id FROM ppm_client_partners WHERE user_id = $1)`
        : "";
      const params = myClientsOnly ? [userId] : [];

      const result = await db.pool.query(`
        SELECT
          (SELECT COUNT(*) FROM ppm_clients c WHERE c.deactivated_at IS NULL ${clientFilter}) AS total_clients,
          (SELECT COUNT(*) FROM ppm_deliverables d
           JOIN ppm_clients c ON c.id = d.client_id
           WHERE d.status NOT IN ('approved', 'done') AND c.deactivated_at IS NULL ${clientFilter}) AS active_deliverables,
          (SELECT COUNT(*) FROM ppm_deliverables d
           JOIN ppm_clients c ON c.id = d.client_id
           WHERE d.status = 'incoming' AND c.deactivated_at IS NULL ${clientFilter}) AS pending_approvals,
          (SELECT COUNT(*) FROM ppm_deliverables d
           JOIN ppm_clients c ON c.id = d.client_id
           WHERE d.due_date < NOW() AND d.status NOT IN ('approved', 'done') AND c.deactivated_at IS NULL ${clientFilter}) AS overdue_items
      `, params);

      return res.status(200).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch dashboard stats"));
    }
  }

  /**
   * GET /ppm/api/admin/dashboard/clients
   * Client health table for the master dashboard.
   */
  public static async getClientHealth(req: Request, res: Response) {
    try {
      const userId = (req.user as any)?.id;
      const myClientsOnly = req.query.my_clients === "true";

      let query = `
        SELECT
          c.id,
          c.name,
          c.status,
          c.contracted_hours_monthly,
          (SELECT u.name FROM ppm_client_partners cp JOIN users u ON u.id = cp.user_id
           WHERE cp.client_id = c.id AND cp.role = 'primary' LIMIT 1) AS primary_partner,
          (SELECT COUNT(*) FROM ppm_deliverables d
           WHERE d.client_id = c.id AND d.status NOT IN ('approved', 'done')) AS active_tasks,
          COALESCE(r.hours_used, 0) AS hours_used,
          COALESCE(r.hours_budgeted, 0) AS hours_budgeted,
          CASE
            WHEN COALESCE(r.hours_budgeted, 0) = 0 THEN 0
            ELSE ROUND((COALESCE(r.hours_used, 0) / r.hours_budgeted * 100)::numeric, 1)
          END AS utilization_pct
        FROM ppm_clients c
        LEFT JOIN ppm_retainer_utilization r ON r.client_id = c.id
        WHERE c.deactivated_at IS NULL
      `;

      const params: string[] = [];
      if (myClientsOnly) {
        query += ` AND c.id IN (SELECT client_id FROM ppm_client_partners WHERE user_id = $1)`;
        params.push(userId);
      }

      query += ` ORDER BY c.name ASC`;

      const result = await db.pool.query(query, params);
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch client health"));
    }
  }

  /**
   * GET /ppm/api/admin/pipeline
   * Cross-client kanban — all tasks across PPM-linked projects, grouped by status.
   */
  public static async getPipeline(req: Request, res: Response) {
    try {
      const { client_id, assignee_id, type_id } = req.query;

      let query = `
        SELECT
          d.id,
          d.title,
          d.status,
          d.due_date,
          d.worklenz_task_id,
          c.id AS client_id,
          c.name AS client_name,
          p.label AS priority,
          t.label AS type,
          u.name AS assignee_name,
          u.avatar_url AS assignee_avatar
        FROM ppm_deliverables d
        JOIN ppm_clients c ON c.id = d.client_id
        LEFT JOIN ppm_dropdown_options p ON d.priority_id = p.id
        LEFT JOIN ppm_dropdown_options t ON d.type_id = t.id
        LEFT JOIN users u ON d.assignee_id = u.id
        WHERE d.status IN ('queued', 'in_progress', 'internal_review', 'client_review', 'done')
          AND c.deactivated_at IS NULL
      `;

      const params: string[] = [];
      let paramIdx = 1;

      if (client_id && typeof client_id === "string") {
        query += ` AND d.client_id = $${paramIdx++}`;
        params.push(client_id);
      }
      if (assignee_id && typeof assignee_id === "string") {
        query += ` AND d.assignee_id = $${paramIdx++}`;
        params.push(assignee_id);
      }
      if (type_id && typeof type_id === "string") {
        query += ` AND d.type_id = $${paramIdx++}`;
        params.push(type_id);
      }

      query += ` ORDER BY d.due_date ASC NULLS LAST, d.created_at DESC`;

      const result = await db.pool.query(query, params);
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch pipeline"));
    }
  }
}
