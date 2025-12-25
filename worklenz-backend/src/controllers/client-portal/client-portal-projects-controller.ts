import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";

export default class ClientPortalProjectsController extends ClientPortalControllerBase {

  static async getProjects(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId } = req;
      const { page = 1, limit = 10, status, search } = req.query;

      // Build query with pagination and filtering - only show projects assigned to this client
      let query = `
        SELECT 
          p.id,
          p.name,
          p.notes,
          p.status_id,
          sps.name as status_name,
          sps.color_code as status_color,
          p.created_at,
          p.updated_at,
          p.client_id,
          c.name as client_name,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done = true) THEN 1 END) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE p.client_id = $1
      `;

      const queryParams: (string | number)[] = [clientId as string];
      let paramIndex = 2;

      // Add status filter if provided
      if (status) {
        query += ` AND sps.name = $${paramIndex}`;
        queryParams.push(String(status));
        paramIndex++;
      }

      // Add search filter if provided
      if (search) {
        query += ` AND (p.name ILIKE $${paramIndex} OR p.notes ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      query += ` GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at, p.client_id, c.name`;

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        WHERE p.client_id = $1
        ${status ? "AND sps.name = $2" : ""}
        ${
          search
            ? `AND (p.name ILIKE $${status ? 3 : 2} OR p.notes ILIKE $${
                status ? 3 : 2
              })`
            : ""
        }
      `;
      const countParams =
        status && search
          ? [clientId, status, `%${search}%`]
          : status
          ? [clientId, status]
          : search
          ? [clientId, `%${search}%`]
          : [clientId];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add pagination
      const offset = (Number(page) - 1) * Number(limit);
      query += ` ORDER BY p.created_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const result = await db.query(query, queryParams);
      const projects = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.notes,
        status: row.status_name,
        status_color: row.status_color,
        created_at: row.created_at,
        updated_at: row.updated_at,
        client_id: row.client_id,
        client_name: row.client_name,
        total_tasks: parseInt(row.total_tasks || "0"),
        completed_tasks: parseInt(row.completed_tasks || "0"),
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            projects,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Projects retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching projects:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve projects"));
    }
  }

  static async getProjectDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { organizationId } = req;

      // Get project details with client access validation
      const query = `
        SELECT 
          p.id,
          p.name,
          p.notes as description,
          p.status_id,
          sps.name as status_name,
          sps.color_code as status_color,
          p.created_at,
          p.updated_at,
          p.start_date,
          p.end_date,
          c.name as client_name,
          c.company_name,
          COUNT(t.id) as total_tasks,
          COUNT(CASE WHEN ts.category_id IN (SELECT id FROM sys_task_status_categories WHERE is_done = true) THEN 1 END) as completed_tasks
        FROM projects p
        LEFT JOIN sys_project_statuses sps ON p.status_id = sps.id
        LEFT JOIN clients c ON p.client_id = c.id
        LEFT JOIN tasks t ON p.id = t.project_id
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        WHERE p.id = $1 AND p.client_id = $2
        GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at, p.start_date, p.end_date, c.name, c.company_name
      `;

      const result = await db.query(query, [id, clientId]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Project not found or not accessible"
            )
          );
      }

      const project = result.rows[0];

      const projectDetails = {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status_name,
        statusColor: project.status_color,
        startDate: project.start_date,
        endDate: project.end_date,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        statistics: {
          totalTasks: parseInt(project.total_tasks || "0"),
          completedTasks: parseInt(project.completed_tasks || "0"),
          progressPercentage:
            project.total_tasks > 0
              ? Math.round(
                  (project.completed_tasks / project.total_tasks) * 100
                )
              : 0,
        },
      };

      return res.json(
        new ServerResponse(
          true,
          projectDetails,
          "Project details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching project details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve project details")
        );
    }
  }

  static async getProjectTasks(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId } = req;
      const { page = 1, limit = 10, search } = req.query;

      // Verify client has access to this project
      const accessCheck = await db.query(
        `SELECT id FROM projects WHERE id = $1 AND client_id = $2`,
        [id, clientId]
      );

      if (accessCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(
              false,
              null,
              "Project not found or not accessible"
            )
          );
      }

      // Build tasks query with pagination
      let tasksQuery = `
        SELECT 
          t.id,
          t.name,
          t.description,
          ts.name as status,
          stsc.color_code as status_color,
          t.start_date,
          t.end_date,
          t.created_at,
          t.updated_at
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        LEFT JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        WHERE t.project_id = $1
      `;

      const queryParams: (string | number)[] = [id as string];
      let paramIndex = 2;

      // Add search filter if provided
      if (search) {
        tasksQuery += ` AND (t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
        queryParams.push(`%${search}%`);
        paramIndex++;
      }

      // Get total count
      const countQuery = `
        SELECT COUNT(*) as total
        FROM tasks t
        WHERE t.project_id = $1
        ${search ? `AND (t.name ILIKE $2 OR t.description ILIKE $2)` : ""}
      `;
      const countParams = search ? [id, `%${search}%`] : [id];
      const countResult = await db.query(countQuery, countParams);
      const total = parseInt(countResult.rows[0]?.total || "0");

      // Add ordering and pagination - last updated first
      const offset = (Number(page) - 1) * Number(limit);
      tasksQuery += ` ORDER BY t.updated_at DESC LIMIT $${paramIndex} OFFSET $${
        paramIndex + 1
      }`;
      queryParams.push(String(Number(limit)), String(offset));

      const tasksResult = await db.query(tasksQuery, queryParams);
      const tasks = tasksResult.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        status: row.status,
        statusColor: row.status_color,
        startDate: row.start_date,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return res.json(
        new ServerResponse(
          true,
          {
            tasks,
            total,
            page: Number(page),
            limit: Number(limit),
          },
          "Project tasks retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching project tasks:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve project tasks")
        );
    }
  }

}
