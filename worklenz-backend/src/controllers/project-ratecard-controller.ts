import db from "../config/db";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import HandleExceptions from "../decorators/handle-exceptions";
import WorklenzControllerBase from "./worklenz-controller-base";

export default class ProjectRateCardController extends WorklenzControllerBase {

  // Insert a single role for a project
  @HandleExceptions()
  public static async createOne(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, job_title_id, rate } = req.body;
    if (!project_id || !job_title_id || typeof rate !== "number") {
      return res.status(400).send(new ServerResponse(false, null, "Invalid input"));
    }
    const q = `
    INSERT INTO finance_project_rate_card_roles (project_id, job_title_id, rate)
    VALUES ($1, $2, $3)
    ON CONFLICT (project_id, job_title_id) DO UPDATE SET rate = EXCLUDED.rate
    RETURNING *,
      (SELECT name FROM job_titles jt WHERE jt.id = finance_project_rate_card_roles.job_title_id) AS jobtitle;
  `;
    const result = await db.query(q, [project_id, job_title_id, rate]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }
  // Insert multiple roles for a project
  @HandleExceptions()
  public static async createMany(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, roles } = req.body;
    if (!Array.isArray(roles) || !project_id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid input"));
    }
    const values = roles.map((role: any) => [
      project_id,
      role.job_title_id,
      role.rate
    ]);
    const q = `
      INSERT INTO finance_project_rate_card_roles (project_id, job_title_id, rate)
      VALUES ${values.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",")}
      ON CONFLICT (project_id, job_title_id) DO UPDATE SET rate = EXCLUDED.rate
      RETURNING *,
      (SELECT name FROM job_titles jt WHERE jt.id = finance_project_rate_card_roles.job_title_id) AS Jobtitle;
    `;
    const flatValues = values.flat();
    const result = await db.query(q, flatValues);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  // Get all roles for a project
  @HandleExceptions()
  public static async getByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.params;
    const q = `
      SELECT
      fprr.*,
      jt.name as jobtitle,
      (
        SELECT COALESCE(json_agg(pm.id), '[]'::json)
        FROM project_members pm
        WHERE pm.project_rate_card_role_id = fprr.id
      ) AS members
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
      WHERE fprr.project_id = $1
      ORDER BY jt.name;
    `;
    const result = await db.query(q, [project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  // Get a single role by id
  @HandleExceptions()
  public static async getById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `
      SELECT
      fprr.*,
      jt.name as jobtitle,
      (
        SELECT COALESCE(json_agg(pm.id), '[]'::json)
        FROM project_members pm
        WHERE pm.project_rate_card_role_id = fprr.id
      ) AS members
      FROM finance_project_rate_card_roles fprr
      LEFT JOIN job_titles jt ON fprr.job_title_id = jt.id
      WHERE fprr.id = $1;
    `;
    const result = await db.query(q, [id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  // Update a single role by id
  @HandleExceptions()
  public static async updateById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { job_title_id, rate } = req.body;
    const q = `
      WITH updated AS (
      UPDATE finance_project_rate_card_roles
      SET job_title_id = $1, rate = $2, updated_at = NOW()
      WHERE id = $3
      RETURNING *
      ),
      jobtitles AS (
      SELECT u.*, jt.name AS jobtitle
      FROM updated u
      JOIN job_titles jt ON jt.id = u.job_title_id
      ),
      members AS (
      SELECT json_agg(pm.id) AS members, pm.project_rate_card_role_id
      FROM project_members pm
      WHERE pm.project_rate_card_role_id IN (SELECT id FROM jobtitles)
      GROUP BY pm.project_rate_card_role_id
      )
      SELECT jt.*, m.members
      FROM jobtitles jt
      LEFT JOIN members m ON m.project_rate_card_role_id = jt.id;
    `;
    const result = await db.query(q, [job_title_id, rate, id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  // update project member rate for a project with members
  @HandleExceptions()
  public static async updateProjectMemberByProjectIdAndMemberId(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { project_id, id } = req.params;
    const { project_rate_card_role_id } = req.body;

    if (!project_id || !id || !project_rate_card_role_id) {
      return res.status(400).send(new ServerResponse(false, null, "Missing values"));
    }

    try {
      // Step 1: Check current role assignment
      const checkQuery = `
        SELECT project_rate_card_role_id
        FROM project_members
        WHERE id = $1 AND project_id = $2;
        `;
      const { rows: checkRows } = await db.query(checkQuery, [id, project_id]);

      const currentRoleId = checkRows[0]?.project_rate_card_role_id;

      if (currentRoleId !== null && currentRoleId !== project_rate_card_role_id) {
        // Step 2: Fetch members with the requested role
        const membersQuery = `
            SELECT COALESCE(json_agg(id), '[]'::json) AS members
            FROM project_members
            WHERE project_id = $1 AND project_rate_card_role_id = $2;
            `;
        const { rows: memberRows } = await db.query(membersQuery, [project_id, project_rate_card_role_id]);

        return res.status(200).send(
          new ServerResponse(false, memberRows[0], "Already Assigned !")
        );
      }

      // Step 3: Perform the update
      const updateQuery = `
          UPDATE project_members
          SET project_rate_card_role_id = CASE
          WHEN project_rate_card_role_id = $1 THEN NULL
          ELSE $1
          END
          WHERE id = $2
          AND project_id = $3
          AND EXISTS (
          SELECT 1
          FROM finance_project_rate_card_roles
          WHERE id = $1 AND project_id = $3
          )
          RETURNING project_rate_card_role_id;
          `;
      const { rows: updateRows } = await db.query(updateQuery, [project_rate_card_role_id, id, project_id]);

      if (updateRows.length === 0) {
        return res.status(200).send(new ServerResponse(true, [], "Project member not found or invalid project_rate_card_role_id"));
      }

      const updatedRoleId = updateRows[0].project_rate_card_role_id || project_rate_card_role_id;

      // Step 4: Fetch updated members list
      const membersQuery = `
        SELECT COALESCE(json_agg(id), '[]'::json) AS members
        FROM project_members
        WHERE project_id = $1 AND project_rate_card_role_id = $2;
        `;
      const { rows: finalMembers } = await db.query(membersQuery, [project_id, updatedRoleId]);

      return res.status(200).send(new ServerResponse(true, finalMembers[0]));
    } catch (error) {
      return res.status(500).send(new ServerResponse(false, null, "Internal server error"));
    }
  }
  // Update all roles for a project (delete then insert)
  @HandleExceptions()
  public static async updateByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id, roles } = req.body;
    if (!Array.isArray(roles) || !project_id) {
      return res.status(400).send(new ServerResponse(false, null, "Invalid input"));
    }
    if (roles.length === 0) {
      // If no roles provided, do nothing and return empty array
      return res.status(200).send(new ServerResponse(true, []));
    }
    // Build upsert query for all roles
    const values = roles.map((role: any) => [
      project_id,
      role.job_title_id,
      role.rate
    ]);
    const q = `
        WITH upserted AS (
        INSERT INTO finance_project_rate_card_roles (project_id, job_title_id, rate)
        VALUES ${values.map((_, i) => `($${i * 3 + 1}, $${i * 3 + 2}, $${i * 3 + 3})`).join(",")}
        ON CONFLICT (project_id, job_title_id)
        DO UPDATE SET rate = EXCLUDED.rate, updated_at = NOW()
        RETURNING *
        ),
        jobtitles AS (
        SELECT upr.*, jt.name AS jobtitle
        FROM upserted upr
        JOIN job_titles jt ON jt.id = upr.job_title_id
        ),
        members AS (
        SELECT json_agg(pm.id) AS members, pm.project_rate_card_role_id
        FROM project_members pm
        WHERE pm.project_rate_card_role_id IN (SELECT id FROM jobtitles)
        GROUP BY pm.project_rate_card_role_id
        )
        SELECT jt.*, m.members
        FROM jobtitles jt
        LEFT JOIN members m ON m.project_rate_card_role_id = jt.id;
    `;
    const flatValues = values.flat();
    const result = await db.query(q, flatValues);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  // Delete a single role by id
  @HandleExceptions()
  public static async deleteById(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const q = `DELETE FROM finance_project_rate_card_roles WHERE id = $1 RETURNING *;`;
    const result = await db.query(q, [id]);
    return res.status(200).send(new ServerResponse(true, result.rows[0]));
  }

  // Delete all roles for a project
  @HandleExceptions()
  public static async deleteByProjectId(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { project_id } = req.params;
    const q = `DELETE FROM finance_project_rate_card_roles WHERE project_id = $1 RETURNING *;`;
    const result = await db.query(q, [project_id]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }
}
