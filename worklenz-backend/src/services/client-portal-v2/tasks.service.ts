import db from "../../config/db";
import { withTransaction } from "../client-contacts-service";
import { AuditActor, recordAuditEvent } from "./audit.service";
import { badRequest, notFound } from "./errors";
import { cleanPortalRichText } from "./rich-text";
import { getProjectRef } from "./project-core";
import { StaffRef, toStaffRef } from "./staff";
import { PortalVisibility, Queryable, isPortalVisibility } from "./types";
import { containsPattern } from "./list-params";

/**
 * Staff keep managing tasks in WorkLenz as usual. A task gains one portal property: Internal Only
 * (default, and what "no settings row" means) or Client Visible, with optional client-facing wording.
 *
 * Time estimates, time logged, costs, billing rates, dependencies, internal comments and private
 * assignee notes are NEVER part of a client payload, whatever the visibility. They appear here only
 * in `never_shared` so staff can see what stays hidden; the client serializers do not include them.
 */

export interface PortalTaskView {
  id: string;
  key: string;
  project_id: string;
  title: string;
  status: "todo" | "in_progress" | "done";
  due_date: string | null;
  assignee: StaffRef | null;
  visibility: PortalVisibility;
  client_title: string;
  client_description: string;
  attached_file_ids: string[];
  never_shared: {
    estimate_hours: number | null;
    logged_hours: number | null;
    internal_comments: number;
  };
}

// $1 = project id, $2 = team id.
const TASK_SELECT = `
  SELECT t.id, t.task_no, (p.key || '-' || t.task_no::text) AS key, t.project_id, t.name AS title,
         CASE WHEN stc.is_done THEN 'done' WHEN stc.is_doing THEN 'in_progress' ELSE 'todo' END AS status,
         t.end_date::date::text AS due_date,
         asg.team_member_id, asg.assignee_name,
         COALESCE(cts.visibility, 'internal') AS visibility,
         COALESCE(cts.client_title, '') AS client_title,
         COALESCE(cts.client_description, '') AS client_description,
         COALESCE((SELECT array_agg(tf.file_id) FROM client_portal_task_files tf WHERE tf.task_id = t.id), '{}') AS attached_file_ids,
         CASE WHEN t.total_minutes > 0 THEN ROUND(t.total_minutes / 60.0, 2) END AS estimate_hours,
         (SELECT ROUND(SUM(w.time_spent) / 3600.0, 2) FROM task_work_log w WHERE w.task_id = t.id) AS logged_hours,
         (SELECT COUNT(*)::int FROM task_comments tc WHERE tc.task_id = t.id AND tc.is_deleted IS NOT TRUE) AS internal_comments
    FROM tasks t
    JOIN projects p ON p.id = t.project_id
    JOIN task_statuses ts ON ts.id = t.status_id
    JOIN sys_task_status_categories stc ON stc.id = ts.category_id
    LEFT JOIN client_portal_task_settings cts ON cts.task_id = t.id
    LEFT JOIN LATERAL (
      SELECT ta.team_member_id, u.name AS assignee_name
        FROM tasks_assignees ta
        JOIN team_members tm ON tm.id = ta.team_member_id
        JOIN users u ON u.id = tm.user_id
       WHERE ta.task_id = t.id
       ORDER BY ta.created_at
       LIMIT 1
    ) asg ON TRUE
   WHERE t.project_id = $1 AND p.team_id = $2 AND t.archived IS FALSE
`;

const toView = (row: any): PortalTaskView => ({
  id: row.id,
  key: row.key,
  project_id: row.project_id,
  title: row.title,
  status: row.status,
  due_date: row.due_date ?? null,
  assignee: row.team_member_id ? toStaffRef(row.team_member_id, row.assignee_name) : null,
  visibility: row.visibility,
  client_title: row.client_title,
  client_description: row.client_description,
  attached_file_ids: row.attached_file_ids ?? [],
  never_shared: {
    estimate_hours: row.estimate_hours != null ? Number(row.estimate_hours) : null,
    logged_hours: row.logged_hours != null ? Number(row.logged_hours) : null,
    internal_comments: row.internal_comments ?? 0,
  },
});

export interface PortalTasksParams {
  visibility?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export async function listPortalTasks(teamId: string, projectId: string, params: PortalTasksParams) {
  await getProjectRef(db, teamId, projectId);

  const page = Math.max(Number(params.page) || 1, 1);
  const limit = Math.min(Math.max(Number(params.limit) || 20, 1), 100);
  const filters: string[] = [];
  const values: unknown[] = [projectId, teamId];

  if (params.visibility !== undefined && params.visibility !== "") {
    if (!isPortalVisibility(params.visibility)) throw badRequest("Invalid visibility filter");
    filters.push(`COALESCE(cts.visibility, 'internal') = $${values.push(params.visibility)}`);
  }
  const search = (params.search ?? "").trim();
  if (search) {
    const n = values.push(containsPattern(search));
    filters.push(`(t.name ILIKE $${n} OR (p.key || '-' || t.task_no::text) ILIKE $${n} OR cts.client_title ILIKE $${n})`);
  }

  const where = filters.length ? `AND ${filters.join(" AND ")}` : "";
  const limitParam = values.push(limit);
  const offsetParam = values.push((page - 1) * limit);

  const rows = await db.query(
    `SELECT l.*, COUNT(*) OVER()::int AS total_count
       FROM (${TASK_SELECT} ${where}) l
      ORDER BY l.task_no
      LIMIT $${limitParam} OFFSET $${offsetParam}`,
    values
  );

  const counts = await db.query(
    `SELECT COUNT(*)::int AS "all",
            COUNT(*) FILTER (WHERE COALESCE(cts.visibility, 'internal') = 'client')::int AS client,
            COUNT(*) FILTER (WHERE COALESCE(cts.visibility, 'internal') = 'internal')::int AS internal
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       LEFT JOIN client_portal_task_settings cts ON cts.task_id = t.id
      WHERE t.project_id = $1 AND p.team_id = $2 AND t.archived IS FALSE`,
    [projectId, teamId]
  );

  return {
    items: rows.rows.map(toView),
    total: rows.rows[0]?.total_count ?? 0,
    page,
    limit,
    counts: {
      all: counts.rows[0]?.all ?? 0,
      client: counts.rows[0]?.client ?? 0,
      internal: counts.rows[0]?.internal ?? 0,
    },
  };
}

export async function getPortalTask(q: Queryable, teamId: string, taskId: string): Promise<PortalTaskView> {
  const owner = await q.query(
    `SELECT t.project_id FROM tasks t JOIN projects p ON p.id = t.project_id WHERE t.id = $1 AND p.team_id = $2`,
    [taskId, teamId]
  );
  if (owner.rows.length === 0) throw notFound("Task");

  const result = await q.query(`${TASK_SELECT} AND t.id = $3`, [owner.rows[0].project_id, teamId, taskId]);
  if (result.rows.length === 0) throw notFound("Task");
  return toView(result.rows[0]);
}

export interface UpdatePortalTaskInput {
  visibility?: string;
  client_title?: string;
  client_description?: string;
  attached_file_ids?: string[];
}

/**
 * Shares or withdraws a task, and stores its client-facing wording and attachments. Switching
 * visibility writes an audit event; switching to Internal Only removes the task (and its discussion
 * thread) from the client's views on their next request while keeping the wording and history.
 */
export async function updatePortalTask(input: {
  teamId: string;
  taskId: string;
  actor: AuditActor;
  userId: string;
  patch: UpdatePortalTaskInput;
}): Promise<PortalTaskView> {
  const { teamId, taskId, patch } = input;

  await withTransaction(async tx => {
    const current = await getPortalTask(tx, teamId, taskId);

    const visibility = patch.visibility ?? current.visibility;
    if (!isPortalVisibility(visibility)) throw badRequest("Invalid visibility");
    const clientTitle = (patch.client_title ?? current.client_title).trim().slice(0, 200);
    const clientDescription = cleanPortalRichText(patch.client_description ?? current.client_description, 4000, "The description");

    await tx.query(
      `INSERT INTO client_portal_task_settings
         (task_id, project_id, visibility, client_title, client_description, updated_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (task_id) DO UPDATE SET
         visibility = EXCLUDED.visibility,
         client_title = EXCLUDED.client_title,
         client_description = EXCLUDED.client_description,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [taskId, current.project_id, visibility, clientTitle, clientDescription, input.userId]
    );

    if (patch.attached_file_ids !== undefined) {
      const fileIds = Array.from(new Set(patch.attached_file_ids));
      if (fileIds.length > 0) {
        const valid = await tx.query(
          `SELECT id FROM project_files WHERE id = ANY($1::uuid[]) AND project_id = $2 AND status = 'active'`,
          [fileIds, current.project_id]
        );
        if (valid.rows.length !== fileIds.length) {
          throw badRequest("An attached file is not in this project", "INVALID_ATTACHMENT");
        }
      }
      await tx.query(`DELETE FROM client_portal_task_files WHERE task_id = $1`, [taskId]);
      if (fileIds.length > 0) {
        await tx.query(
          `INSERT INTO client_portal_task_files (task_id, file_id) SELECT $1, unnest($2::uuid[])`,
          [taskId, fileIds]
        );
      }
    }

    if (visibility !== current.visibility) {
      const project = await getProjectRef(tx, teamId, current.project_id);
      await recordAuditEvent(tx, {
        teamId,
        event: visibility === "client" ? "Entity made Client Visible" : "Entity returned to Internal Only",
        actor: input.actor,
        clientId: project.clientId,
        clientName: project.clientName,
        projectId: project.id,
        targetType: "task",
        targetId: taskId,
        targetLabel: `Task: ${current.title}`,
      });
    }
  });

  return getPortalTask(db, teamId, taskId);
}
