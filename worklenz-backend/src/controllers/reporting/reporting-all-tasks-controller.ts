import moment from "moment";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { formatDuration, getColor, int } from "../../shared/utils";
import ReportingControllerBase from "./reporting-controller-base";
import SqlHelper from "../../shared/sql-helpers";
import Excel from "exceljs";

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
  clients?: string[];
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

  private static buildWhereClause(req: IWorkLenzRequest, body: IAllTasksRequest, values: any[]): string {
    const clauses: string[] = [];
    const teamId = req.user?.team_id;
    const userId = req.user?.id;

    // Teams filter - if specific teams are selected, use those; otherwise use current team
    if (body.teams && body.teams.length > 0) {
      // User has selected specific teams, use only those
      const { clause, params } = SqlHelper.buildInClause(body.teams, values.length + 1);
      clauses.push(`t.project_id IN (SELECT id FROM projects WHERE team_id IN (${clause}))`);
      values.push(...params);
    } else {
      // No specific teams selected, fall back to current user's team
      values.push(teamId);
      clauses.push(`t.project_id IN (SELECT id FROM projects WHERE team_id = $${values.length})`);
    }

    // Archived filter
    if (!body.includeArchived) {
      values.push(userId);
      clauses.push(`t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND user_id = $${values.length})`);
    }

    // Subtasks filter
    if (!body.includeSubtasks) {
      clauses.push(`t.parent_task_id IS NULL`);
    }

    // Projects filter
    if (body.projects && body.projects.length > 0) {
      const { clause, params } = SqlHelper.buildInClause(body.projects, values.length + 1);
      clauses.push(`t.project_id IN (${clause})`);
      values.push(...params);
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
      const { clause, params } = SqlHelper.buildInClause(body.priorities, values.length + 1);
      clauses.push(`t.priority_id IN (${clause})`);
      values.push(...params);
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
        const { clause, params } = SqlHelper.buildInClause(memberIds, values.length + 1);
        assigneeConditions.push(`EXISTS (SELECT 1 FROM tasks_assignees ta WHERE ta.task_id = t.id AND ta.team_member_id IN (${clause}))`);
        values.push(...params);
      }
      if (assigneeConditions.length > 0) {
        clauses.push(`(${assigneeConditions.join(" OR ")})`);
      }
    }

    // Labels filter
    if (body.labels && body.labels.length > 0) {
      const { clause, params } = SqlHelper.buildInClause(body.labels, values.length + 1);
      clauses.push(`EXISTS (SELECT 1 FROM task_labels tl WHERE tl.task_id = t.id AND tl.label_id IN (${clause}))`);
      values.push(...params);
    }

    // Phases filter
    if (body.phases && body.phases.length > 0) {
      const { clause, params } = SqlHelper.buildInClause(body.phases, values.length + 1);
      clauses.push(`EXISTS (SELECT 1 FROM task_phase tp WHERE tp.task_id = t.id AND tp.phase_id IN (${clause}))`);
      values.push(...params);
    }

    // Clients filter 
    if (body.clients && body.clients.length > 0) {
      const { clause, params } = SqlHelper.buildInClause(body.clients, values.length + 1);
      clauses.push(`t.project_id IN (SELECT id FROM projects WHERE client_id IN (${clause}))`);
      values.push(...params);
    }

    // Date filter
    if (body.dateFrom || body.dateTo) {
      const dateField = body.dateField || "end_date";
      // Validate field name to prevent injection
      const allowedFields = ["due_date", "start_date", "created_at", "completed_at", "end_date"];
      let dbField = allowedFields.includes(dateField) ? dateField : "end_date";
      if (dbField === "due_date") dbField = "end_date";

      if (body.dateFrom) {
        values.push(body.dateFrom);
        clauses.push(`t.${dbField}::DATE >= $${values.length}::DATE`);
      }
      if (body.dateTo) {
        values.push(body.dateTo);
        clauses.push(`t.${dbField}::DATE <= $${values.length}::DATE`);
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
      const { clause, params } = SqlHelper.buildLikeClause('t.name', body.search.trim(), values.length + 1);
      clauses.push(`(${clause} OR (SELECT key FROM projects WHERE id = t.project_id) || '-' || t.task_no ILIKE $${values.length + 1})`);
      values.push(...params);
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

    if (!teamId) {
      return res.status(400).send(new ServerResponse(false, null, "Team ID is required"));
    }

    const result = await this.getTasksData(req, body);

    return res.status(200).send(new ServerResponse(true, result));
  }

  @HandleExceptions()
  public static async exportExcel(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const body: IAllTasksRequest = req.body;
    // For export, we usually want all data, but respect filters. 
    // Usually size is ignored or set to large number, but let's see. 
    // If user wants all, we should probably set pagination to very large or disable limit.
    // For now, let's assume we export what matches the filter, but maybe all pages?
    // Typically exports export ALL matching data, not just the current page.
    const exportBody = { ...body, index: 1, size: 100000 }; // Fetch all matching records

    const result = await this.getTasksData(req, exportBody);
    const tasks = result.data;

    // Excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `All Tasks - ${exportDate}`;
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet("Tasks");

    // Define columns
    sheet.columns = [
      { header: "Task Key", key: "task_key", width: 15 },
      { header: "Task", key: "task", width: 40 },
      { header: "Project", key: "project", width: 30 },
      { header: "Status", key: "status", width: 20 },
      { header: "Priority", key: "priority", width: 20 },
      { header: "Assignees", key: "assignees", width: 30 },
      { header: "Labels", key: "labels", width: 30 },
      { header: "Start Date", key: "start_date", width: 20 },
      { header: "Due Date", key: "due_date", width: 20 },
      { header: "Completed Date", key: "completed_on", width: 20 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Estimated Time", key: "estimated_time", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 },
      { header: "Overlogged Time", key: "overlogged_time", width: 20 },
    ];

    // Style header
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFE0E0E0" }
    };

    // Add data
    for (const task of tasks) {
      const assigneeNames = (task.names as any[] || []).map(a => a.name).join(", ");
      const labelNames = (task.labels as any[] || []).map((l: any) => l.name).join(", ");

      sheet.addRow({
        task_key: task.task_key || "-",
        task: task.name,
        project: task.project_name,
        status: task.status_name,
        priority: task.priority_name,
        assignees: assigneeNames,
        labels: labelNames || "-",
        start_date: task.start_date ? moment(task.start_date).format("YYYY-MM-DD") : "-",
        due_date: task.end_date ? moment(task.end_date).format("YYYY-MM-DD") : "-",
        completed_on: task.completed_at ? moment(task.completed_at).format("YYYY-MM-DD") : "-",
        created_at: task.created_at ? moment(task.created_at).format("YYYY-MM-DD") : "-",
        estimated_time: task.total_time_string,
        logged_time: task.time_spent_string,
        overlogged_time: task.overlogged_time_string || "-"
      });
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  }

  @HandleExceptions()
  public static async exportCSV(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const body: IAllTasksRequest = req.body;
    const exportBody = { ...body, index: 1, size: 100000 };

    const result = await this.getTasksData(req, exportBody);
    const tasks = result.data;

    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `All Tasks - ${exportDate}`;
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet("Tasks");

    // Define columns
    sheet.columns = [
      { header: "Task Key", key: "task_key", width: 15 },
      { header: "Task", key: "task", width: 40 },
      { header: "Project", key: "project", width: 30 },
      { header: "Status", key: "status", width: 20 },
      { header: "Priority", key: "priority", width: 20 },
      { header: "Assignees", key: "assignees", width: 30 },
      { header: "Labels", key: "labels", width: 30 },
      { header: "Start Date", key: "start_date", width: 20 },
      { header: "Due Date", key: "due_date", width: 20 },
      { header: "Completed Date", key: "completed_on", width: 20 },
      { header: "Created At", key: "created_at", width: 20 },
      { header: "Estimated Time", key: "estimated_time", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 },
      { header: "Overlogged Time", key: "overlogged_time", width: 20 },
      { header: "Client", key: "client", width: 25 },
    ];

    // Add data
    for (const task of tasks) {
      const assigneeNames = (task.names as any[] || []).map(a => a.name).join(", ");
      const labelNames = (task.labels as any[] || []).map((l: any) => l.name).join(", ");

      sheet.addRow({
        task_key: task.task_key || "-",
        task: task.name,
        project: task.project_name,
        status: task.status_name,
        priority: task.priority_name,
        assignees: assigneeNames,
        labels: labelNames || "-",
        start_date: task.start_date ? moment(task.start_date).format("YYYY-MM-DD") : "-",
        due_date: task.end_date ? moment(task.end_date).format("YYYY-MM-DD") : "-",
        completed_on: task.completed_at ? moment(task.completed_at).format("YYYY-MM-DD") : "-",
        created_at: task.created_at ? moment(task.created_at).format("YYYY-MM-DD") : "-",
        estimated_time: task.total_time_string,
        logged_time: task.time_spent_string,
        overlogged_time: task.overlogged_time_string || "-",
        client: task.client_name || "-",
      });
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.csv`);

    await workbook.csv.write(res);
    res.end();
  }

  private static async getTasksData(req: IWorkLenzRequest, body: IAllTasksRequest) {
    const page = body.index || 1;
    const pageSize = body.size || 50;
    const offset = (page - 1) * pageSize;

    const values: any[] = [];
    const whereClause = this.buildWhereClause(req, body, values);
    const orderClause = this.buildOrderClause(body);

    const countValues = [...values];
    const statsValues = [...values];

    // Params for Limit/Offset
    values.push(pageSize);
    const limitParam = `$${values.length}`;
    values.push(offset);
    const offsetParam = `$${values.length}`;

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

        -- Client info (ADD THIS)
        (SELECT c.name FROM clients c 
        WHERE c.id = (SELECT client_id FROM projects WHERE id = t.project_id)) AS client_name,
        
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
      LIMIT ${limitParam} OFFSET ${offsetParam}
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

    const [tasksResult, countResult, statsResult] = await Promise.all([
      db.query(tasksQuery, values),
      db.query(countQuery, countValues),
      db.query(statsQuery, statsValues),
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

    return {
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
    };
  }
}
