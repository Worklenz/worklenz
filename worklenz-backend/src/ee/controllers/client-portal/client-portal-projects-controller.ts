import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import db from "../../../config/db";
import moment from "moment";
import { formatDuration } from "../../../shared/utils";
export default class ClientPortalProjectsController extends ClientPortalControllerBase {

  static async getProjects(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId, organizationId } = req;
      const { page = 1, limit = 10, status, search } = req.query;

      // Build query with pagination and filtering - only show projects assigned to this client AND organization
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
        WHERE p.client_id = $1 AND p.team_id = $2
      `;

      const queryParams: (string | number)[] = [clientId as string, organizationId as string];
      let paramIndex = 3;

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
        WHERE p.client_id = $1 AND p.team_id = $2
        ${status ? "AND sps.name = $3" : ""}
        ${
          search
            ? `AND (p.name ILIKE $${status ? 4 : 3} OR p.notes ILIKE $${
                status ? 4 : 3
              })`
            : ""
        }
      `;
      const countParams =
        status && search
          ? [clientId, organizationId, status, `%${search}%`]
          : status
          ? [clientId, organizationId, status]
          : search
          ? [clientId, organizationId, `%${search}%`]
          : [clientId, organizationId];
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

  static async getProjectStatuses(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const query = `
        SELECT 
          id,
          name,
          color_code,
          icon,
          is_default,
          sort_order
        FROM sys_project_statuses
        ORDER BY sort_order ASC, name ASC
      `;
      
      const result = await db.query(query, []);
      
      const statuses = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        colorCode: row.color_code,
        icon: row.icon,
        isDefault: row.is_default,
        sortOrder: row.sort_order,
      }));

      return res.json(
        new ServerResponse(
          true,
          statuses,
          "Project statuses retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching project statuses:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve project statuses")
        );
    }
  }

  static async getProjectDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId, organizationId } = req;

      // Get project details with client access validation - verify both client_id AND team_id
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
        WHERE p.id = $1 AND p.client_id = $2 AND p.team_id = $3
        GROUP BY p.id, p.name, p.notes, p.status_id, sps.name, sps.color_code, p.created_at, p.updated_at, p.start_date, p.end_date, c.name, c.company_name
      `;

      const result = await db.query(query, [id, clientId, organizationId]);

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
      const { clientId, organizationId } = req;
      const { page = 1, limit = 10, search } = req.query;
 
      // Verify client has access to this project - check both client_id AND team_id
      const accessCheck = await db.query(
        `SELECT id FROM projects WHERE id = $1 AND client_id = $2 AND team_id = $3`,
        [id, clientId, organizationId]
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
          t.updated_at,
          COALESCE((
            SELECT SUM(twl.time_spent)
            FROM task_work_log twl
            WHERE twl.task_id = t.id
          ), 0)::INT AS time_spent_seconds,
          (
            SELECT COUNT(*)
            FROM client_portal_task_comments c
            WHERE c.task_id = t.id
              AND c.created_at > COALESCE(
                (SELECT last_viewed_at FROM client_task_views v
                 WHERE v.task_id = t.id AND v.client_id = $2),
                '1970-01-01'::timestamp
              )
          ) as unseen_comments_count
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        LEFT JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        WHERE t.project_id = $1
      `;
 
      const queryParams: (string | number)[] = [id as string, clientId as string];
      let paramIndex = 3;
 
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
      const tasks = tasksResult.rows.map((row: any) => {
        const seconds = parseInt(row.time_spent_seconds || "0");
        const timeLogged = formatDuration(moment.duration(seconds, "seconds"));
        return {
          id: row.id,
          name: row.name,
          description: row.description,
          status: row.status,
          statusColor: row.status_color,
          startDate: row.start_date,
          endDate: row.end_date,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          unseenCommentsCount: parseInt(row.unseen_comments_count || "0"),
          timeLogged,
        };
      });
 
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

  // Task Details and Comments
  static async getTaskDetails(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId, organizationId } = req;

      // Verify client has access to this task via project - check both client_id AND team_id
      const accessCheck = await db.query(
        `SELECT t.id FROM tasks t
         INNER JOIN projects p ON t.project_id = p.id
         WHERE t.id = $1 AND p.client_id = $2 AND p.team_id = $3`,
        [id, clientId, organizationId]
      );

      if (accessCheck.rows.length === 0) {
        return res
          .status(404)
          .json(
            new ServerResponse(false, null, "Task not found or not accessible")
          );
      }

      // Fetch task details with all related data
      const baseUrl = process.env.AWS_S3_BASE_URL || '';
      const query = `
        SELECT
          t.id,
          t.name,
          t.description,
          t.start_date,
          t.end_date,
          t.created_at,
          t.updated_at,
          ts.name as status_name,
          stsc.color_code as status_color,
          tp.name as priority_name,
          tp.color_code as priority_color,
          (
            SELECT json_agg(json_build_object(
              'id', tm.id,
              'name', u.name,
              'email', u.email,
              'avatar_url', u.avatar_url
            ))
            FROM tasks_assignees ta
            LEFT JOIN team_members tm ON ta.team_member_id = tm.id
            LEFT JOIN users u ON tm.user_id = u.id
            WHERE ta.task_id = t.id
          ) as assignees,
          (
            SELECT json_agg(json_build_object(
              'id', att.id,
              'name', att.name,
              'url', CONCAT($2::text, '/', att.team_id::text, '/', att.project_id::text, '/', att.id::text, '.', att.type),
              'size', att.size,
              'type', att.type,
              'created_at', att.created_at
            ))
            FROM task_attachments att
            WHERE att.task_id = t.id
          ) as attachments
        FROM tasks t
        LEFT JOIN task_statuses ts ON t.status_id = ts.id
        LEFT JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
        LEFT JOIN task_priorities tp ON t.priority_id = tp.id
        WHERE t.id = $1
      `;

      const result = await db.query(query, [id, baseUrl]);

      if (result.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Task not found"));
      }

      const taskDetails = {
        id: result.rows[0].id,
        name: result.rows[0].name,
        description: result.rows[0].description,
        startDate: result.rows[0].start_date,
        endDate: result.rows[0].end_date,
        createdAt: result.rows[0].created_at,
        updatedAt: result.rows[0].updated_at,
        statusName: result.rows[0].status_name,
        statusColor: result.rows[0].status_color,
        priorityName: result.rows[0].priority_name,
        priorityColor: result.rows[0].priority_color,
        assignees: result.rows[0].assignees || [],
        attachments: result.rows[0].attachments || [],
      };

      return res.json(
        new ServerResponse(
          true,
          taskDetails,
          "Task details retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching task details:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve task details")
        );
    }
  }

  static async getTaskComments(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId, organizationId } = req;

      // Verify client has access to this task - check both client_id AND team_id
      const accessCheck = await db.query(
        `SELECT t.id, t.project_id FROM tasks t
         INNER JOIN projects p ON t.project_id = p.id
         WHERE t.id = $1 AND p.client_id = $2 AND p.team_id = $3`,
        [id, clientId, organizationId]
      );

      if (accessCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Task not found"));
      }

      const projectId = accessCheck.rows[0].project_id;

      // Get comments for the task
      const query = `
        SELECT
          c.id,
          c.comment,
          c.sender_type,
          c.sender_id,
          c.sender_name,
          c.created_at,
          c.updated_at
        FROM client_portal_task_comments c
        WHERE c.task_id = $1
          AND c.organization_team_id = $2
          AND c.project_id = $3
        ORDER BY c.created_at ASC
      `;

      const result = await db.query(query, [id, organizationId, projectId]);

      return res.json(
        new ServerResponse(
          true,
          result.rows,
          "Comments retrieved successfully"
        )
      );
    } catch (error) {
      console.error("Error fetching task comments:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to retrieve comments")
        );
    }
  }

  static async addTaskComment(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId, organizationId } = req;
      const { comment } = req.body;

      if (!comment || !comment.trim()) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, "Comment is required"));
      }

      const MAX_COMMENT_LENGTH = 5000;
      if (comment.trim().length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json(
            new ServerResponse(
              false,
              null,
              `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`
            )
          );
      }

      // Verify task exists and client has access - check both client_id AND team_id
      const taskCheck = await db.query(
        `SELECT t.id, t.project_id FROM tasks t
         INNER JOIN projects p ON t.project_id = p.id
         WHERE t.id = $1 AND p.client_id = $2 AND p.team_id = $3`,
        [id, clientId, organizationId]
      );

      if (taskCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Task not found"));
      }

      const projectId = taskCheck.rows[0].project_id;

      // Get client name for sender_name
      const clientQuery = await db.query(
        "SELECT name FROM clients WHERE id = $1",
        [clientId]
      );
      const senderName = clientQuery.rows[0]?.name || "Client";

      // Insert comment
      const insertQuery = `
        INSERT INTO client_portal_task_comments (
          task_id,
          project_id,
          organization_team_id,
          client_id,
          comment,
          sender_type,
          sender_id,
          sender_name,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, 'client', $6, $7, NOW(), NOW())
        RETURNING id, comment, sender_type, sender_id, sender_name, created_at, updated_at
      `;

      const result = await db.query(insertQuery, [
        id,
        projectId,
        organizationId,
        clientId,
        comment.trim(),
        clientId,
        senderName,
      ]);

      return res.json(
        new ServerResponse(true, result.rows[0], "Comment added successfully")
      );
    } catch (error) {
      console.error("Error adding task comment:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to add comment"));
    }
  }

   static async getProjectTimeLogs(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { clientId, organizationId } = req;

      const query = `
        SELECT
          p.id AS project_id,
          COALESCE(SUM(twl.time_spent), 0)::INT AS total_time_seconds
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        LEFT JOIN task_work_log twl ON twl.task_id = t.id
        WHERE p.client_id = $1
          AND p.team_id = $2
        GROUP BY p.id
      `;

      const result = await db.query(query, [clientId, organizationId]);

      const timeMap: Record<string, string> = {};
      for (const row of result.rows) {
        const seconds = parseInt(row.total_time_seconds || "0");
        timeMap[row.project_id] = formatDuration(
          moment.duration(seconds, "seconds")
        );
      }

      return res.json(
        new ServerResponse(true, timeMap, "Time logs retrieved successfully")
      );
    } catch (error) {
      console.error("Error fetching project time logs:", error);
      return res
        .status(500)
        .json(new ServerResponse(false, null, "Failed to retrieve time logs"));
    }
  }

  static async markTaskCommentsAsViewed(
    req: AuthenticatedClientRequest,
    res: IWorkLenzResponse
  ) {
    try {
      const { id } = req.params;
      const { clientId, organizationId } = req;

      // Verify client has access to this task - check both client_id AND team_id
      const accessCheck = await db.query(
        `SELECT t.id FROM tasks t
         INNER JOIN projects p ON t.project_id = p.id
         WHERE t.id = $1 AND p.client_id = $2 AND p.team_id = $3`,
        [id, clientId, organizationId]
      );

      if (accessCheck.rows.length === 0) {
        return res
          .status(404)
          .json(new ServerResponse(false, null, "Task not found"));
      }

      // Upsert the view record
      const query = `
        INSERT INTO client_task_views (client_id, task_id, last_viewed_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        ON CONFLICT (client_id, task_id)
        DO UPDATE SET last_viewed_at = NOW(), updated_at = NOW()
        RETURNING last_viewed_at
      `;

      await db.query(query, [clientId, id]);

      return res.json(
        new ServerResponse(true, null, "Task comments marked as viewed")
      );
    } catch (error) {
      console.error("Error marking task comments as viewed:", error);
      return res
        .status(500)
        .json(
          new ServerResponse(false, null, "Failed to mark comments as viewed")
        );
    }
  }

}
