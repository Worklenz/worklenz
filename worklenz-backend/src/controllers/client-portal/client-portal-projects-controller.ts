import ClientPortalControllerBase from "./client-portal-base";
import { AuthenticatedClientRequest } from "../../middlewares/client-auth-middleware";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import db from "../../config/db";
import { clientRoleCan } from "../../shared/client-portal-permissions";
import { getClientProject, listClientProjects } from "../../services/client-portal-v2/client-read.service";
import { assertSubjectProject, fileClientVisibleSql, taskClientVisibleSql } from "../../services/client-portal-v2/scope";
import { ClientSubject, loadClientSubject } from "../../services/client-portal-v2/subject";
import { handlePortalError } from "./v2/portal-http";

/**
 * The client-facing project endpoints the current client app uses.
 *
 * These used to scope only by the client organization, so a client saw EVERY task of EVERY project of
 * their company - with logged time, assignee names and emails, attachment URLs and the project's
 * internal notes. They now run the Client Portal v2 gating chain on every request:
 *
 *   the user is Active  AND  assigned to the project  AND  the project's portal is on
 *   AND  the item is Client Visible
 *
 * Response shapes are kept so the existing client app keeps working, but the data is the v2 client
 * allow-list: client-facing wording, simplified status, and no time, cost, assignee or internal notes.
 * Tasks stay Internal Only (and therefore invisible here) until staff share them.
 */

const CLIENT_STATUS_LABEL: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  on_hold: "On hold",
  completed: "Completed",
};

const CLIENT_STATUS_COLOR: Record<string, string> = {
  on_track: "#52c41a",
  at_risk: "#fa8c16",
  on_hold: "#8c8c8c",
  completed: "#1677ff",
};

/**
 * The client user behind this request, resolved from the database now (not from the token), or a 403.
 * A token with no client user cannot use the project portal.
 */
async function resolveSubject(
  req: AuthenticatedClientRequest,
  res: IWorkLenzResponse
): Promise<ClientSubject | null> {
  const { clientUserId, clientId, organizationId } = req;
  if (clientUserId && clientId && organizationId) {
    const subject = await loadClientSubject(db, { clientUserId, clientId, teamId: organizationId });
    if (subject) return subject;
  }
  res
    .status(403)
    .json(new ServerResponse(false, { code: "ACCESS_REVOKED" }, "Your access has been removed. Please contact your administrator."));
  return null;
}

/** A task the subject can open: in an assigned, portal-enabled project and itself Client Visible. */
async function findVisibleTask(
  subject: ClientSubject,
  taskId: string
): Promise<{ id: string; project_id: string } | null> {
  const result = await db.query(
    `SELECT t.id, t.project_id
       FROM tasks t
       JOIN client_contact_project_access a ON a.project_id = t.project_id AND a.client_contact_id = $2
       JOIN project_client_settings pcs ON pcs.project_id = t.project_id AND pcs.portal_enabled IS TRUE
       JOIN projects p ON p.id = t.project_id AND p.client_id = $3 AND p.team_id = $4
      WHERE t.id = $1 AND ${taskClientVisibleSql("t")}`,
    [taskId, subject.contactId, subject.clientId, subject.teamId]
  );
  return result.rows[0] ?? null;
}

/** Counts, per project, the tasks the client can see and how many of those are done. */
async function sharedTaskCounts(projectIds: string[]): Promise<Map<string, { total: number; done: number }>> {
  if (projectIds.length === 0) return new Map();
  const result = await db.query(
    `SELECT t.project_id, COUNT(*)::int AS total, COUNT(*) FILTER (WHERE stc.is_done)::int AS done
       FROM tasks t
       JOIN task_statuses ts ON ts.id = t.status_id
       JOIN sys_task_status_categories stc ON stc.id = ts.category_id
      WHERE t.project_id = ANY($1::uuid[]) AND ${taskClientVisibleSql("t")}
      GROUP BY t.project_id`,
    [projectIds]
  );
  return new Map(result.rows.map(row => [row.project_id as string, { total: row.total as number, done: row.done as number }]));
}

export default class ClientPortalProjectsController extends ClientPortalControllerBase {
  static async getProjects(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
      const status = typeof req.query.status === "string" ? req.query.status.toLowerCase() : "";
      const search = typeof req.query.search === "string" ? req.query.search.trim().toLowerCase() : "";

      // Only assigned, portal-enabled projects exist for this client.
      const accessible = await listClientProjects(db, subject);
      const filtered = accessible.filter(project => {
        if (status && (CLIENT_STATUS_LABEL[project.status] ?? "").toLowerCase() !== status) return false;
        if (search && !`${project.name} ${project.summary}`.toLowerCase().includes(search)) return false;
        return true;
      });

      const pageItems = filtered.slice((page - 1) * limit, page * limit);
      const counts = await sharedTaskCounts(pageItems.map(project => project.id));
      const client = await db.query(
        `SELECT COALESCE(NULLIF(TRIM(company_name), ''), name) AS name FROM clients WHERE id = $1`,
        [subject.clientId]
      );

      const projects = pageItems.map(project => ({
        id: project.id,
        name: project.name,
        // The client-facing summary, never the project's internal notes.
        description: project.summary,
        status: CLIENT_STATUS_LABEL[project.status],
        status_color: CLIENT_STATUS_COLOR[project.status],
        created_at: null,
        updated_at: null,
        client_id: subject.clientId,
        client_name: client.rows[0]?.name ?? null,
        total_tasks: counts.get(project.id)?.total ?? 0,
        completed_tasks: counts.get(project.id)?.done ?? 0,
      }));

      return res.json(
        new ServerResponse(true, { projects, total: filtered.length, page, limit }, "Projects retrieved successfully")
      );
    } catch (error) {
      return handlePortalError(res, error, "Failed to retrieve projects");
    }
  }

  static async getProjectStatuses(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
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

      return res.json(new ServerResponse(true, statuses, "Project statuses retrieved successfully"));
    } catch (error) {
      console.error("Error fetching project statuses:", error);
      return res.status(500).json(new ServerResponse(false, null, "Failed to retrieve project statuses"));
    }
  }

  static async getProjectDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      // 404, never 403, for a project the client is not assigned to or whose portal is off.
      const project = await getClientProject(db, subject, req.params.id);
      const counts = await sharedTaskCounts([project.id]);
      const shared = counts.get(project.id) ?? { total: 0, done: 0 };

      return res.json(
        new ServerResponse(
          true,
          {
            id: project.id,
            name: project.name,
            description: project.summary,
            status: CLIENT_STATUS_LABEL[project.status],
            statusColor: CLIENT_STATUS_COLOR[project.status],
            startDate: project.start_date,
            // A blank Expected completion stays null: the portal never invents a date.
            endDate: project.expected_completion,
            createdAt: null,
            updatedAt: null,
            statistics: {
              totalTasks: shared.total,
              completedTasks: shared.done,
              progressPercentage: project.progress,
            },
          },
          "Project details retrieved successfully"
        )
      );
    } catch (error) {
      return handlePortalError(res, error, "Failed to retrieve project details");
    }
  }

  static async getProjectTasks(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      const { id } = req.params;
      const page = Math.max(Number(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
      const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

      await assertSubjectProject(db, subject, id);

      const params: unknown[] = [id, subject.clientId];
      const searchClause = search
        ? `AND (COALESCE(NULLIF(cts.client_title, ''), t.name) ILIKE $${params.push(`%${search}%`)}
                OR cts.client_description ILIKE $${params.length})`
        : "";

      // Only Client Visible tasks, with client wording and the simplified status. No time logged,
      // no assignee, no internal description.
      const base = `
        FROM tasks t
        JOIN client_portal_task_settings cts ON cts.task_id = t.id AND cts.visibility = 'client'
        JOIN task_statuses ts ON ts.id = t.status_id
        JOIN sys_task_status_categories stc ON stc.id = ts.category_id
        WHERE t.project_id = $1 AND t.archived IS FALSE
        ${searchClause}
      `;

      const total = parseInt((await db.query(`SELECT COUNT(*) AS total ${base}`, params)).rows[0]?.total || "0");

      const limitParam = params.push(limit);
      const offsetParam = params.push((page - 1) * limit);
      const result = await db.query(
        `SELECT t.id,
                COALESCE(NULLIF(cts.client_title, ''), t.name) AS name,
                cts.client_description AS description,
                CASE WHEN stc.is_done THEN 'Done' WHEN stc.is_doing THEN 'In progress' ELSE 'Not started' END AS status,
                stc.color_code AS status_color,
                t.end_date, t.created_at, t.updated_at,
                (SELECT COUNT(*) FROM client_portal_task_comments c
                  WHERE c.task_id = t.id
                    AND c.created_at > COALESCE(
                          (SELECT v.last_viewed_at FROM client_task_views v WHERE v.task_id = t.id AND v.client_id = $2),
                          '1970-01-01'::timestamp)) AS unseen_comments_count
         ${base}
         ORDER BY t.updated_at DESC
         LIMIT $${limitParam} OFFSET $${offsetParam}`,
        params
      );

      const tasks = result.rows.map((row: any) => ({
        id: row.id,
        name: row.name,
        description: row.description ?? "",
        status: row.status,
        statusColor: row.status_color,
        startDate: null,
        endDate: row.end_date,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        unseenCommentsCount: parseInt(row.unseen_comments_count || "0"),
        // Time logged is never shared with a client.
        timeLogged: "",
      }));

      return res.json(new ServerResponse(true, { tasks, total, page, limit }, "Project tasks retrieved successfully"));
    } catch (error) {
      return handlePortalError(res, error, "Failed to retrieve project tasks");
    }
  }

  // Task Details and Comments
  static async getTaskDetails(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      // A hidden task is indistinguishable from one that does not exist.
      const task = await findVisibleTask(subject, req.params.id);
      if (!task) {
        return res.status(404).json(new ServerResponse(false, null, "Task not found or not accessible"));
      }

      const result = await db.query(
        `SELECT t.id, COALESCE(NULLIF(cts.client_title, ''), t.name) AS name, cts.client_description AS description,
                t.end_date, t.created_at, t.updated_at,
                CASE WHEN stc.is_done THEN 'Done' WHEN stc.is_doing THEN 'In progress' ELSE 'Not started' END AS status_name,
                stc.color_code AS status_color,
                COALESCE((SELECT json_agg(json_build_object('id', pf.id, 'name', pf.name, 'type', pf.type, 'size', pf.size, 'created_at', pf.created_at) ORDER BY pf.name)
                            FROM client_portal_task_files tf
                            JOIN project_files pf ON pf.id = tf.file_id AND ${fileClientVisibleSql("pf")}
                           WHERE tf.task_id = t.id), '[]'::json) AS attachments
           FROM tasks t
           JOIN client_portal_task_settings cts ON cts.task_id = t.id
           JOIN task_statuses ts ON ts.id = t.status_id
           JOIN sys_task_status_categories stc ON stc.id = ts.category_id
          WHERE t.id = $1`,
        [task.id]
      );
      const row = result.rows[0];
      if (!row) return res.status(404).json(new ServerResponse(false, null, "Task not found"));

      return res.json(
        new ServerResponse(
          true,
          {
            id: row.id,
            name: row.name,
            description: row.description ?? "",
            startDate: null,
            endDate: row.end_date,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            statusName: row.status_name,
            statusColor: row.status_color,
            priorityName: null,
            priorityColor: null,
            // Assignees are never shown to a client. Attachments are the task's files that are
            // themselves Client Visible, listed without a direct URL (files open through the
            // per-request authorized file endpoint).
            assignees: [],
            attachments: row.attachments,
          },
          "Task details retrieved successfully"
        )
      );
    } catch (error) {
      return handlePortalError(res, error, "Failed to retrieve task details");
    }
  }

  static async getTaskComments(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      const task = await findVisibleTask(subject, req.params.id);
      if (!task) return res.status(404).json(new ServerResponse(false, null, "Task not found"));

      const result = await db.query(
        `SELECT c.id, c.comment, c.sender_type, c.sender_id, c.sender_name, c.created_at, c.updated_at
           FROM client_portal_task_comments c
          WHERE c.task_id = $1 AND c.organization_team_id = $2 AND c.project_id = $3
          ORDER BY c.created_at ASC`,
        [task.id, subject.teamId, task.project_id]
      );

      return res.json(new ServerResponse(true, result.rows, "Comments retrieved successfully"));
    } catch (error) {
      return handlePortalError(res, error, "Failed to retrieve comments");
    }
  }

  static async addTaskComment(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      // A Client Viewer is read-only.
      if (!clientRoleCan(subject.role, "comment")) {
        return res.status(403).json(new ServerResponse(false, { code: "ROLE_FORBIDDEN" }, "Your role cannot comment"));
      }

      const comment = typeof req.body?.comment === "string" ? req.body.comment.trim() : "";
      if (!comment) return res.status(400).json(new ServerResponse(false, null, "Comment is required"));

      const MAX_COMMENT_LENGTH = 5000;
      if (comment.length > MAX_COMMENT_LENGTH) {
        return res
          .status(400)
          .json(new ServerResponse(false, null, `Comment must not exceed ${MAX_COMMENT_LENGTH} characters`));
      }

      const task = await findVisibleTask(subject, req.params.id);
      if (!task) return res.status(404).json(new ServerResponse(false, null, "Task not found"));

      const result = await db.query(
        `INSERT INTO client_portal_task_comments (
           task_id, project_id, organization_team_id, client_id, comment, sender_type, sender_id, sender_name,
           created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, 'client', $6, $7, NOW(), NOW())
         RETURNING id, comment, sender_type, sender_id, sender_name, created_at, updated_at`,
        [task.id, task.project_id, subject.teamId, subject.clientId, comment, subject.clientId, subject.name]
      );

      return res.json(new ServerResponse(true, result.rows[0], "Comment added successfully"));
    } catch (error) {
      return handlePortalError(res, error, "Failed to add comment");
    }
  }

  /**
   * Time logged is never shared with a client, so this returns nothing. It stays as an endpoint only
   * so the current client app, which still asks, gets an empty answer instead of an error.
   */
  static async getProjectTimeLogs(_req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    return res.json(new ServerResponse(true, {}, "Time tracking is not shared with clients"));
  }

  static async markTaskCommentsAsViewed(req: AuthenticatedClientRequest, res: IWorkLenzResponse) {
    try {
      const subject = await resolveSubject(req, res);
      if (!subject) return res;

      const task = await findVisibleTask(subject, req.params.id);
      if (!task) return res.status(404).json(new ServerResponse(false, null, "Task not found"));

      await db.query(
        `INSERT INTO client_task_views (client_id, task_id, last_viewed_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (client_id, task_id)
         DO UPDATE SET last_viewed_at = NOW(), updated_at = NOW()`,
        [subject.clientId, task.id]
      );

      return res.json(new ServerResponse(true, null, "Task comments marked as viewed"));
    } catch (error) {
      return handlePortalError(res, error, "Failed to mark comments as viewed");
    }
  }
}
