import { Request, Response } from "express";

import db from "../../config/db";
import { ServerResponse } from "../../models/server-response";
import { log_error } from "../../shared/utils";
import { UUID_RE } from "../utils/ppm-db";

export default class AdminClientsController {
  /**
   * GET /ppm/api/admin/clients
   * List all clients with summary stats.
   */
  public static async list(_req: Request, res: Response) {
    try {
      const result = await db.pool.query(`
        SELECT
          c.id,
          c.name,
          c.status,
          c.website,
          c.contact_name,
          c.contact_email,
          c.contracted_hours_monthly,
          c.created_at,
          c.deactivated_at,
          (SELECT COUNT(*) FROM ppm_deliverables d WHERE d.client_id = c.id) AS deliverable_count,
          (SELECT COUNT(*) FROM ppm_deliverables d WHERE d.client_id = c.id AND d.status = 'incoming') AS pending_count,
          (SELECT COUNT(*) FROM ppm_client_users cu WHERE cu.client_id = c.id AND cu.deactivated_at IS NULL) AS user_count,
          (SELECT u.name FROM ppm_client_partners cp JOIN users u ON u.id = cp.user_id
           WHERE cp.client_id = c.id AND cp.role = 'primary' LIMIT 1) AS primary_partner_name
        FROM ppm_clients c
        ORDER BY c.name ASC
      `);

      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch clients"));
    }
  }

  /**
   * GET /ppm/api/admin/clients/:id
   * Client detail with users, partners, and linked projects.
   */
  public static async getById(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }

      const [clientResult, usersResult, partnersResult, projectsResult] = await Promise.all([
        db.pool.query(
          `SELECT * FROM ppm_clients WHERE id = $1`, [id]
        ),
        db.pool.query(
          `SELECT id, email, display_name, role, last_login_at, created_at, deactivated_at
           FROM ppm_client_users WHERE client_id = $1 ORDER BY created_at ASC`, [id]
        ),
        db.pool.query(
          `SELECT cp.id, cp.user_id, cp.role, cp.created_at, u.name AS user_name, u.email AS user_email
           FROM ppm_client_partners cp
           JOIN users u ON u.id = cp.user_id
           WHERE cp.client_id = $1 ORDER BY cp.role ASC`, [id]
        ),
        db.pool.query(
          `SELECT cp.id AS link_id, cp.project_id, cp.is_primary, cp.incoming_status_id, cp.created_at,
                  p.name AS project_name
           FROM ppm_client_projects cp
           JOIN projects p ON p.id = cp.project_id
           WHERE cp.client_id = $1 ORDER BY cp.is_primary DESC, cp.created_at ASC`, [id]
        ),
      ]);

      if (!clientResult.rows[0]) {
        return res.status(404).json(new ServerResponse(false, null, "Client not found"));
      }

      return res.status(200).json(new ServerResponse(true, {
        ...clientResult.rows[0],
        users: usersResult.rows,
        partners: partnersResult.rows,
        projects: projectsResult.rows,
      }));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch client"));
    }
  }

  /**
   * POST /ppm/api/admin/clients
   * Create a new client. Optionally auto-creates a Worklenz project.
   */
  public static async create(req: Request, res: Response) {
    try {
      const { name, status, website, contact_name, contact_email, contact_phone, contracted_scope, contracted_hours_monthly } = req.body;

      if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Client name is required"));
      }

      const result = await db.pool.query(
        `INSERT INTO ppm_clients (name, status, website, contact_name, contact_email, contact_phone, contracted_scope, contracted_hours_monthly)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING *`,
        [name.trim(), status || "active_project", website, contact_name, contact_email, contact_phone, contracted_scope, contracted_hours_monthly]
      );

      return res.status(201).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to create client"));
    }
  }

  /**
   * GET /ppm/api/admin/clients/:id/users
   * List users for a client.
   */
  public static async listUsers(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }
      const result = await db.pool.query(
        `SELECT id, email, display_name, role, last_login_at, created_at, deactivated_at
         FROM ppm_client_users WHERE client_id = $1 ORDER BY created_at ASC`, [id]
      );
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch users"));
    }
  }

  /**
   * GET /ppm/api/admin/clients/:id/partners
   * List partners for a client.
   */
  public static async listPartners(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }
      const result = await db.pool.query(
        `SELECT cp.id, cp.user_id, cp.role, cp.created_at, u.name AS user_name, u.email AS user_email
         FROM ppm_client_partners cp
         JOIN users u ON u.id = cp.user_id
         WHERE cp.client_id = $1 ORDER BY cp.role ASC`, [id]
      );
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch partners"));
    }
  }

  /**
   * GET /ppm/api/admin/clients/:id/projects
   * List linked projects for a client.
   */
  public static async listProjects(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }
      const result = await db.pool.query(
        `SELECT cp.id AS link_id, cp.project_id, cp.is_primary, cp.incoming_status_id, cp.created_at,
                p.name AS project_name
         FROM ppm_client_projects cp
         JOIN projects p ON p.id = cp.project_id
         WHERE cp.client_id = $1 ORDER BY cp.is_primary DESC, cp.created_at ASC`, [id]
      );
      return res.status(200).json(new ServerResponse(true, result.rows));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to fetch projects"));
    }
  }

  /**
   * POST /ppm/api/admin/clients/:id/users
   * Add a client user and send magic link invitation.
   */
  public static async addUser(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }

      const { email, display_name, role } = req.body;
      if (!email || typeof email !== "string" || !email.trim()) {
        return res.status(400).json(new ServerResponse(false, null, "Email is required"));
      }

      const invitedBy = (req.user as any)?.id;

      const result = await db.pool.query(
        `INSERT INTO ppm_client_users (email, display_name, client_id, role, invited_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, display_name, role, created_at`,
        [email.trim().toLowerCase(), display_name || null, id, role || "viewer", invitedBy]
      );

      // TODO: Send magic link invitation email via Resend (Stream F)

      return res.status(201).json(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      if (error.code === "23505") { // unique violation
        return res.status(409).json(new ServerResponse(false, null, "User with this email already exists"));
      }
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to add user"));
    }
  }

  /**
   * PUT /ppm/api/admin/clients/:id/users/:userId
   * Update a client user's role.
   */
  public static async updateUser(req: Request, res: Response) {
    try {
      const { id, userId } = req.params;
      if (!id || !UUID_RE.test(id) || !userId || !UUID_RE.test(userId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid ID"));
      }

      const { role } = req.body;
      if (!role || !["viewer", "reviewer", "admin"].includes(role)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid role"));
      }

      const result = await db.pool.query(
        `UPDATE ppm_client_users SET role = $1
         WHERE id = $2 AND client_id = $3 AND deactivated_at IS NULL
         RETURNING id, email, role`,
        [role, userId, id]
      );

      if (!result.rows[0]) {
        return res.status(404).json(new ServerResponse(false, null, "User not found"));
      }

      return res.status(200).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to update user"));
    }
  }

  /**
   * DELETE /ppm/api/admin/clients/:id/users/:userId
   * Deactivate a client user (soft delete).
   */
  public static async removeUser(req: Request, res: Response) {
    try {
      const { id, userId } = req.params;
      if (!id || !UUID_RE.test(id) || !userId || !UUID_RE.test(userId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid ID"));
      }

      const result = await db.pool.query(
        `UPDATE ppm_client_users SET deactivated_at = NOW()
         WHERE id = $1 AND client_id = $2 AND deactivated_at IS NULL
         RETURNING id, email`,
        [userId, id]
      );

      if (!result.rows[0]) {
        return res.status(404).json(new ServerResponse(false, null, "User not found or already deactivated"));
      }

      return res.status(200).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to deactivate user"));
    }
  }

  /**
   * POST /ppm/api/admin/clients/:id/partners
   * Assign a partner to a client.
   */
  public static async addPartner(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }

      const { user_id, role } = req.body;
      if (!user_id || !UUID_RE.test(user_id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid user ID"));
      }
      if (!role || !["primary", "creative", "paid_media", "retention"].includes(role)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid partner role"));
      }

      const result = await db.pool.query(
        `INSERT INTO ppm_client_partners (client_id, user_id, role)
         VALUES ($1, $2, $3)
         RETURNING id, client_id, user_id, role`,
        [id, user_id, role]
      );

      return res.status(201).json(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json(new ServerResponse(false, null, "Partner already assigned with this role"));
      }
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to assign partner"));
    }
  }

  /**
   * DELETE /ppm/api/admin/clients/:id/partners/:partnerId
   * Remove a partner assignment.
   */
  public static async removePartner(req: Request, res: Response) {
    try {
      const { id, partnerId } = req.params;
      if (!id || !UUID_RE.test(id) || !partnerId || !UUID_RE.test(partnerId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid ID"));
      }

      const result = await db.pool.query(
        `DELETE FROM ppm_client_partners WHERE id = $1 AND client_id = $2 RETURNING id`,
        [partnerId, id]
      );

      if (!result.rows[0]) {
        return res.status(404).json(new ServerResponse(false, null, "Partner assignment not found"));
      }

      return res.status(200).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to remove partner"));
    }
  }

  /**
   * POST /ppm/api/admin/clients/:id/projects
   * Link an existing Worklenz project to a client.
   */
  public static async linkProject(req: Request, res: Response) {
    try {
      const { id } = req.params;
      if (!id || !UUID_RE.test(id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid client ID"));
      }

      const { project_id, is_primary } = req.body;
      if (!project_id || !UUID_RE.test(project_id)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid project ID"));
      }

      const result = await db.pool.query(
        `INSERT INTO ppm_client_projects (client_id, project_id, is_primary)
         VALUES ($1, $2, $3)
         RETURNING id, client_id, project_id, is_primary`,
        [id, project_id, is_primary || false]
      );

      // TODO: Seed PPM statuses for the linked project + populate ppm_status_mapping (Stream A4)

      return res.status(201).json(new ServerResponse(true, result.rows[0]));
    } catch (error: any) {
      if (error.code === "23505") {
        return res.status(409).json(new ServerResponse(false, null, "Project already linked to this client"));
      }
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to link project"));
    }
  }

  /**
   * DELETE /ppm/api/admin/clients/:id/projects/:projectId
   * Unlink a project from a client.
   */
  public static async unlinkProject(req: Request, res: Response) {
    try {
      const { id, projectId } = req.params;
      if (!id || !UUID_RE.test(id) || !projectId || !UUID_RE.test(projectId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid ID"));
      }

      const result = await db.pool.query(
        `DELETE FROM ppm_client_projects WHERE client_id = $1 AND project_id = $2 RETURNING id`,
        [id, projectId]
      );

      if (!result.rows[0]) {
        return res.status(404).json(new ServerResponse(false, null, "Project link not found"));
      }

      return res.status(200).json(new ServerResponse(true, result.rows[0]));
    } catch (error) {
      log_error(error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to unlink project"));
    }
  }

  /**
   * PUT /ppm/api/admin/clients/:id/projects/:projectId/primary
   * Set a project as the primary project for a client.
   */
  public static async setPrimaryProject(req: Request, res: Response) {
    try {
      const { id, projectId } = req.params;
      if (!id || !UUID_RE.test(id) || !projectId || !UUID_RE.test(projectId)) {
        return res.status(400).json(new ServerResponse(false, null, "Invalid ID"));
      }

      // Use a transaction: unset old primary, set new primary
      const conn = await db.pool.connect();
      try {
        await conn.query("BEGIN");

        // Unset any existing primary
        await conn.query(
          `UPDATE ppm_client_projects SET is_primary = false WHERE client_id = $1 AND is_primary = true`,
          [id]
        );

        // Set new primary
        const result = await conn.query(
          `UPDATE ppm_client_projects SET is_primary = true
           WHERE client_id = $1 AND project_id = $2
           RETURNING id, project_id, is_primary`,
          [id, projectId]
        );

        if (!result.rows[0]) {
          await conn.query("ROLLBACK");
          return res.status(404).json(new ServerResponse(false, null, "Project link not found"));
        }

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
      return res.status(500).json(new ServerResponse(false, null, "Failed to set primary project"));
    }
  }
}
