import moment from "moment";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { formatDuration, getColor, int } from "../../shared/utils";
import ReportingControllerBase from "./reporting-controller-base";

interface IAllTasksRequest {
  index: number;
  size: number;
  sortField: string;
  sortOrder: "asc" | "desc";
  search?: string;
  teams?: string[];
  projects?: string[];
  statuses?: string[];
  priorities?: string[];
  assignees?: string[];
  labels?: string[];
  phases?: string[];
  dateField?: "due_date" | "start_date" | "created_at" | "completed_at";
  dateFrom?: string | null;
  dateTo?: string | null;
  includeArchived?: boolean;
  includeSubtasks?: boolean;
  completionStatus?: "all" | "completed" | "incomplete" | "overdue";
  billable?: "all" | "billable" | "non-billable";
  groupBy?: string;
}

export default class ReportingAllTasksController extends ReportingControllerBase {

  private static buildWhereClause(req: IWorkLenzRequest, body: IAllTasksRequest): string {
    const clauses: string[] = [];
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    // Teams filter - if teams are provided, use only those; otherwise use current team
    if (body.teams && body.teams.length > 0) {
      const teamIds = body.teams.map(id => `'${id}'`).join(",");
      clauses.push(`t.project_id IN (SELECT id FROM projects WHERE team_id IN (${teamIds}))`);
    } else {
      // Base team filter - only apply if no teams filter is provided
      clauses.push(`t.project_id IN (SELECT id FROM projects WHERE team_id = '${teamId}')`);
    }

    // Archived filter
    if (!body.includeArchived) {
      clauses.push(`t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND user_id = '${userId}')`);
    }

    // Subtasks filter
    if (!body.includeSubtasks) {
      clauses.push(`t.parent_task_id IS NULL`);
    }

    // Projects filter
    if (body.projects && body.projects.length > 0) {
      const projectIds = body.projects.map(id => `'${id}'`).join(",");
      clauses.push(`t.project_id IN (${projectIds})`);
    }

    // Status filter (by category: todo, doing, done)
    if (body.statuses && body.statuses.length > 0) {
      const statusConditions: string[] = [];
      if (body.statuses.includes("todo")) {
        statusConditions.push(`is_todo(t.status_id, t.project_id)`);
      }
      if (body.statuses.includes("doing")) {
        statusConditions.push(`is_doing(t.status_id, t.project_id)`);
      }
      if (body.statuses.includes("done")) {
        statusConditions.push(`is_completed(t.status_id, t.project_id)`);
      }
      if (statusConditions.length > 0) {
        clauses.push(`(${statusConditions.join(" OR ")})`);
      }
    }

    // Priority filter
    if (body.priorities && body.priorities.length > 0) {
      const priorityIds = body.priorities.map(id => `'${id}'`).join(",");
      clauses.push(`t.priority_id IN (${priorityIds})`);
    }

    // Assignee filter
    if (body.assignees && body.assignees.length > 0) {
      const hasUnassigned = body.assignees.includes("unassigned");
      const memberIds = body.assignees.filter(id => id !== "unassigned");
      
      const assigneeConditions: string[] = [];
      if (hasUnassigned) {
        assigneeConditions.push(`NOT EXISTS (SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id)`);
      }
      if (memberIds.length > 0) {
        const ids = memberIds.map(id => `'${id}'`).join(",");
        assigneeConditions.push(`EXISTS (SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id AND ta.team_member_id IN (${ids}))`);
      }
      if (assigneeConditions.length > 0) {
        clauses.push(`(${assigneeConditions.join(" OR ")})`);
      }
    }

    // Labels filter
    if (body.labels && body.labels.length > 0) {
      const labelIds = body.labels.map(id => `'${id}'`).join(",");
      clauses.push(`EXISTS (SELECT 1 FROM task_labels tl WHERE tl.task_id = t.id AND tl.label_id IN (${labelIds}))`);
    }

    // Phases filter
    if (body.phases && body.phases.length > 0) {
      const phaseIds = body.phases.map(id => `'${id}'`).join(",");
      clauses.push(`EXISTS (SELECT 1 FROM task_phase tp WHERE tp.task_id = t.id AND tp.phase_id IN (${phaseIds}))`);
    }

    // Date filter
    if (body.dateFrom || body.dateTo) {
      const dateField = body.dateField || "end_date";
      const dbField = dateField === "due_date" ? "end_date" : dateField;
      
      if (body.dateFrom) {
        clauses.push(`t.${dbField}::DATE >= '${body.dateFrom}'::DATE`);
      }
      if (body.dateTo) {
        clauses.push(`t.${dbField}::DATE <= '${body.dateTo}'::DATE`);
      }
    }

    // Completion status filter
    if (body.completionStatus && body.completionStatus !== "all") {
      if (body.completionStatus === "completed") {
        clauses.push(`is_completed(t.status_id, t.project_id)`);
      } else if (body.completionStatus === "incomplete") {
        clauses.push(`NOT is_completed(t.status_id, t.project_id)`);
      } else if (body.completionStatus === "overdue") {
        clauses.push(`t.end_date::DATE < CURRENT_DATE AND NOT is_completed(t.status_id, t.project_id)`);
      }
    }

    // Billable filter
    if (body.billable && body.billable !== "all") {
      if (body.billable === "billable") {
        clauses.push(`t.billable IS TRUE`);
      } else if (body.billable === "non-billable") {
        clauses.push(`t.billable IS FALSE OR t.billable IS NULL`);
      }
    }

    // Search filter
    if (body.search && body.search.trim()) {
      const searchTerm = body.search.trim().replace(/'/g, "''");
      clauses.push(`(t.name ILIKE '%${searchTerm}%' OR (SELECT key FROM projects WHERE id = t.project_id) || '-' || t.task_no ILIKE '%${searchTerm}%')`);
    }

    return clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
  }

  private static buildOrderClause(body: IAllTasksRequest): string {
    const sortField = body.sortField || "end_date";
    const sortOrder = body.sortOrder === "desc" ? "DESC" : "ASC";
    
    const fieldMap: Record<string, string> = {
      "name": "t.name",
      "project_name": "project_name",
      "status_name": "status_name",
      "priority_name": "priority_name",
      "end_date": "t.end_date",
      "start_date": "t.start_date",
      "created_at": "t.created_at",
      "completed_at": "t.completed_at",
      "updated_at": "t.updated_at",
      "overdue_days": "overdue_days",
      "progress": "t.progress",
      "sub_tasks_count": "sub_tasks_count",
    };

    const dbField = fieldMap[sortField] || "t.end_date";
    return `ORDER BY ${dbField} ${sortOrder} NULLS LAST`;
  }

  @HandleExceptions()
  public static async getReportingAllTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const body: IAllTasksRequest = req.body;
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
    }

    const page = body.index || 1;
    const pageSize = body.size || 50;
    const offset = (page - 1) * pageSize;

    const whereClause = this.buildWhereClause(req, body);
    const orderClause = this.buildOrderClause(body);

    // Main query for tasks
    const tasksQuery = `
      SELECT 
        t.id,
        t.name,
        t.task_no,
        (SELECT key FROM projects WHERE id = t.project_id) || '-' || t.task_no AS task_key,
        t.project_id,
        (SELECT name FROM projects WHERE id = t.project_id) AS project_name,
        (SELECT color_code FROM projects WHERE id = t.project_id) AS color_code,
        t.status_id,
        (SELECT name FROM task_statuses WHERE id = t.status_id) AS status_name,
        (SELECT color_code FROM sys_task_status_categories WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
        t.priority_id,
        (SELECT name FROM task_priorities WHERE id = t.priority_id) AS priority_name,
        (SELECT color_code FROM task_priorities WHERE id = t.priority_id) AS priority_color,
        t.start_date,
        t.end_date,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.parent_task_id,
        t.parent_task_id IS NOT NULL AS is_sub_task,
        t.total_minutes,
        t.progress_value AS progress,
        t.billable,
        
        -- Overdue days calculation
        (CASE
          WHEN t.end_date IS NOT NULL 
            AND CURRENT_DATE::DATE > t.end_date::DATE 
            AND NOT is_completed(t.status_id, t.project_id)
          THEN CURRENT_DATE::DATE - t.end_date::DATE
          ELSE NULL 
        END) AS overdue_days,
        
        -- Is overdue flag
        (t.end_date IS NOT NULL 
          AND CURRENT_DATE::DATE > t.end_date::DATE 
          AND NOT is_completed(t.status_id, t.project_id)) AS is_overdue,
        
        -- Time data (will be formatted in application layer)
        (SELECT COALESCE(SUM(time_spent), 0) FROM task_work_log WHERE task_id = t.id) AS time_spent_seconds,
        
        -- Subtasks count
        (SELECT COUNT(*) FROM tasks WHERE parent_task_id = t.id) AS sub_tasks_count,
        
        -- Comments count
        (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) AS comments_count,
        
        -- Attachments count
        (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) AS attachments_count,
        
        -- Phase info
        (SELECT phase_id FROM task_phase WHERE task_id = t.id LIMIT 1) AS phase_id,
        (SELECT pp.name FROM project_phases pp WHERE pp.id = (SELECT phase_id FROM task_phase WHERE task_id = t.id LIMIT 1)) AS phase_name,
        (SELECT pp.color_code FROM project_phases pp WHERE pp.id = (SELECT phase_id FROM task_phase WHERE task_id = t.id LIMIT 1)) AS phase_color,
        
        -- Assignees (using team_member_info_view)
        (SELECT COALESCE(JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', tmiv.team_member_id,
            'name', tmiv.name,
            'avatar_url', tmiv.avatar_url
          )
        ), '[]'::JSON) FROM tasks_assignees ta 
        JOIN team_member_info_view tmiv ON ta.team_member_id = tmiv.team_member_id 
        WHERE ta.task_id = t.id) AS names,
        
        -- Labels
        (SELECT COALESCE(JSON_AGG(
          JSON_BUILD_OBJECT(
            'id', l.id,
            'name', l.name,
            'color_code', l.color_code
          )
        ), '[]'::JSON) FROM task_labels tl 
        JOIN team_labels l ON tl.label_id = l.id 
        WHERE tl.task_id = t.id) AS labels

      FROM tasks t
      ${whereClause}
      ${orderClause}
      LIMIT ${pageSize} OFFSET ${offset}
    `;

    // Count query
    const countQuery = `
      SELECT COUNT(*) AS total
      FROM tasks t
      ${whereClause}
    `;

    // Stats query
    const statsQuery = `
      SELECT 
        COUNT(*) AS total_tasks,
        COUNT(*) FILTER (WHERE is_completed(t.status_id, t.project_id)) AS completed_tasks,
        COUNT(*) FILTER (WHERE is_doing(t.status_id, t.project_id)) AS in_progress_tasks,
        COUNT(*) FILTER (WHERE t.end_date::DATE < CURRENT_DATE AND NOT is_completed(t.status_id, t.project_id)) AS overdue_tasks,
        COUNT(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id)) AS unassigned_tasks,
        COUNT(*) FILTER (WHERE t.end_date::DATE >= CURRENT_DATE AND t.end_date::DATE <= CURRENT_DATE + INTERVAL '7 days') AS due_this_week
      FROM tasks t
      ${whereClause}
    `;

    try {
      const [tasksResult, countResult, statsResult] = await Promise.all([
        db.query(tasksQuery),
        db.query(countQuery),
        db.query(statsQuery),
      ]);

      const tasks = tasksResult.rows;
      const total = parseInt(countResult.rows[0]?.total || "0", 10);
      const stats = statsResult.rows[0] || {};

      // Format time strings in application layer
      for (const task of tasks) {
        const totalMinutes = parseInt(task.total_minutes || "0", 10);
        const timeSpentSeconds = parseInt(task.time_spent_seconds || "0", 10);
        const timeSpentMinutes = Math.ceil(timeSpentSeconds / 60);
        
        // Format estimated time
        const estHours = Math.floor(totalMinutes / 60);
        const estMins = totalMinutes % 60;
        task.total_time_string = `${estHours}h ${estMins}m`;
        
        // Format logged time
        const logHours = Math.floor(timeSpentMinutes / 60);
        const logMins = timeSpentMinutes % 60;
        task.time_spent_string = `${logHours}h ${logMins}m`;
        
        // Format overlogged time
        const estimatedSeconds = totalMinutes * 60;
        if (timeSpentSeconds > estimatedSeconds) {
          const overloggedSeconds = timeSpentSeconds - estimatedSeconds;
          const overloggedMinutes = Math.ceil(overloggedSeconds / 60);
          const overHours = Math.floor(overloggedMinutes / 60);
          const overMins = overloggedMinutes % 60;
          task.overlogged_time_string = `${overHours}h ${overMins}m`;
        } else {
          task.overlogged_time_string = null;
        }
      }

      return res.status(200).send(new ServerResponse(true, {
        data: tasks,
        total,
        page,
        pageSize,
        stats: {
          totalTasks: parseInt(stats.total_tasks || "0", 10),
          completedTasks: parseInt(stats.completed_tasks || "0", 10),
          inProgressTasks: parseInt(stats.in_progress_tasks || "0", 10),
          overdueTasks: parseInt(stats.overdue_tasks || "0", 10),
          unassignedTasks: parseInt(stats.unassigned_tasks || "0", 10),
          dueThisWeek: parseInt(stats.due_this_week || "0", 10),
        },
      }));
    } catch (error) {
      console.error("Error fetching all tasks:", error);
      return res.status(500).send(new ServerResponse(false, null, "Failed to fetch tasks"));
    }
  }
}
