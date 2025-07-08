import { ParsedQs } from "qs";

import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import { TASK_PRIORITY_COLOR_ALPHA, TASK_STATUS_COLOR_ALPHA, UNMAPPED } from "../shared/constants";
import { getColor, log_error } from "../shared/utils";
import TasksControllerBase, { GroupBy, ITaskGroup } from "./tasks-controller-base";

export class TaskListGroup implements ITaskGroup {
  name: string;
  category_id: string | null;
  color_code: string;
  color_code_dark: string;
  start_date?: string;
  end_date?: string;
  todo_progress: number;
  doing_progress: number;
  done_progress: number;
  tasks: any[];

  constructor(group: any) {
    this.name = group.name;
    this.category_id = group.category_id || null;
    this.start_date = group.start_date || null;
    this.end_date = group.end_date || null;
    this.color_code = group.color_code + TASK_STATUS_COLOR_ALPHA;
    this.color_code_dark = group.color_code_dark;
    this.todo_progress = 0;
    this.doing_progress = 0;
    this.done_progress = 0;
    this.tasks = [];
  }
}

export default class TasksControllerV2 extends TasksControllerBase {
  private static isCountsOnly(query: ParsedQs) {
    return query.count === "true";
  }

  public static isTasksOnlyReq(query: ParsedQs) {
    return TasksControllerV2.isCountsOnly(query) || query.parent_task;
  }

  private static flatString(text: string) {
    return (text || "").split(" ").map(s => `'${s}'`).join(",");
  }

  private static getFilterByStatusWhereClosure(text: string) {
    return text ? `status_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByPriorityWhereClosure(text: string) {
    return text ? `priority_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByLabelsWhereClosure(text: string) {
    return text
      ? `id IN (SELECT task_id FROM task_labels WHERE label_id IN (${this.flatString(text)}))`
      : "";
  }

  private static getFilterByMembersWhereClosure(text: string) {
    return text
      ? `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${this.flatString(text)}))`
      : "";
  }

  private static getFilterByProjectsWhereClosure(text: string) {
    return text ? `t.project_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByAssignee(filterBy: string) {
    return filterBy === "member"
      ? `t.id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id = $1)`
      : "t.project_id = $1";
  }

  private static getStatusesQuery(filterBy: string) {
    return filterBy === "member"
      ? `, (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
      FROM (SELECT task_statuses.id, task_statuses.name, stsc.color_code
          FROM task_statuses
              INNER JOIN sys_task_status_categories stsc ON task_statuses.category_id = stsc.id
          WHERE project_id = t.project_id
          ORDER BY task_statuses.name) rec) AS statuses`
      : "";
  }

  public static async getTaskCompleteRatio(taskId: string): Promise<{
    ratio: number;
    total_completed: number;
    total_tasks: number;
  } | null> {
    try {
      const result = await db.query("SELECT get_task_complete_ratio($1) AS info;", [taskId]);
      const [data] = result.rows;
      if (data && data.info && data.info.ratio !== undefined) {
        data.info.ratio = +((data.info.ratio || 0).toFixed());
        return data.info;
      }
      return null;
    } catch (error) {
      log_error(`Error in getTaskCompleteRatio: ${error}`);
      return null;
    }
  }

  private static getQuery(userId: string, options: ParsedQs) {
    const searchField = options.search ? "t.name" : "sort_order";
    const { searchQuery, sortField } = TasksControllerV2.toPaginationOptions(options, searchField);

    const isSubTasks = !!options.parent_task;

    const sortFields = sortField.replace(/ascend/g, "ASC").replace(/descend/g, "DESC") || "sort_order";

    // Filter tasks by statuses
    const statusesFilter = TasksControllerV2.getFilterByStatusWhereClosure(options.statuses as string);
    // Filter tasks by labels
    const labelsFilter = TasksControllerV2.getFilterByLabelsWhereClosure(options.labels as string);
    // Filter tasks by its members
    const membersFilter = TasksControllerV2.getFilterByMembersWhereClosure(options.members as string);
    // Filter tasks by projects
    const projectsFilter = TasksControllerV2.getFilterByProjectsWhereClosure(options.projects as string);
    // Filter tasks by priorities
    const priorityFilter = TasksControllerV2.getFilterByPriorityWhereClosure(options.priorities as string);
    // Filter tasks by a single assignee
    const filterByAssignee = TasksControllerV2.getFilterByAssignee(options.filterBy as string);
    // Returns statuses of each task as a json array if filterBy === "member"
    const statusesQuery = TasksControllerV2.getStatusesQuery(options.filterBy as string);
    
    // Custom columns data query - optimized with LEFT JOIN
    const customColumnsQuery = options.customColumns 
      ? `, COALESCE(cc_data.custom_column_values, '{}'::JSONB) AS custom_column_values`
      : "";

    const archivedFilter = options.archived === "true" ? "t.archived IS TRUE" : "t.archived IS FALSE";

    let subTasksFilter;

    if (options.isSubtasksInclude === "true") {
      subTasksFilter = "";
    } else {
      subTasksFilter = isSubTasks ? "t.parent_task_id = $2" : "t.parent_task_id IS NULL";
    }

    const filters = [
      subTasksFilter,
      (isSubTasks ? "1 = 1" : archivedFilter),
      (isSubTasks ? "$1 = $1" : filterByAssignee), // ignored filter by member in peoples page for sub-tasks
      statusesFilter,
      priorityFilter,
      labelsFilter,
      membersFilter,
      projectsFilter
    ].filter(i => !!i).join(" AND ");

    // PERFORMANCE OPTIMIZED QUERY - Using CTEs and JOINs instead of correlated subqueries
    return `
      WITH task_aggregates AS (
        SELECT 
          t.id,
          COUNT(DISTINCT sub.id) AS sub_tasks_count,
          COUNT(DISTINCT CASE WHEN sub_status.is_done THEN sub.id END) AS completed_sub_tasks,
          COUNT(DISTINCT tc.id) AS comments_count,
          COUNT(DISTINCT ta.id) AS attachments_count,
          COUNT(DISTINCT twl.id) AS work_log_count,
          COALESCE(SUM(twl.time_spent), 0) AS total_minutes_spent,
          MAX(CASE WHEN ts.id IS NOT NULL THEN 1 ELSE 0 END) AS has_subscribers,
          MAX(CASE WHEN td.id IS NOT NULL THEN 1 ELSE 0 END) AS has_dependencies
        FROM tasks t
        LEFT JOIN tasks sub ON t.id = sub.parent_task_id AND sub.archived = FALSE
        LEFT JOIN task_statuses sub_ts ON sub.status_id = sub_ts.id
        LEFT JOIN sys_task_status_categories sub_status ON sub_ts.category_id = sub_status.id
        LEFT JOIN task_comments tc ON t.id = tc.task_id
        LEFT JOIN task_attachments ta ON t.id = ta.task_id
        LEFT JOIN task_work_log twl ON t.id = twl.task_id
        LEFT JOIN task_subscribers ts ON t.id = ts.task_id
        LEFT JOIN task_dependencies td ON t.id = td.task_id
        WHERE t.project_id = $1 AND t.archived = FALSE
        GROUP BY t.id
      ),
      task_assignees AS (
        SELECT 
          ta.task_id,
                     JSON_AGG(JSON_BUILD_OBJECT(
            'team_member_id', ta.team_member_id,
            'project_member_id', ta.project_member_id,
                         'name', COALESCE(tmiv.name, ''),
             'avatar_url', COALESCE(tmiv.avatar_url, ''),
             'email', COALESCE(tmiv.email, ''),
             'user_id', tmiv.user_id,
             'socket_id', COALESCE(u.socket_id, ''),
             'team_id', tmiv.team_id,
             'email_notifications_enabled', COALESCE(ns.email_notifications_enabled, false)
          )) AS assignees,
                     STRING_AGG(COALESCE(tmiv.name, ''), ', ') AS assignee_names,
           STRING_AGG(COALESCE(tmiv.name, ''), ', ') AS names
        FROM tasks_assignees ta
        LEFT JOIN team_member_info_view tmiv ON ta.team_member_id = tmiv.team_member_id
        LEFT JOIN users u ON tmiv.user_id = u.id
        LEFT JOIN notification_settings ns ON ns.user_id = u.id AND ns.team_id = tmiv.team_id
        GROUP BY ta.task_id
      ),
      task_labels AS (
        SELECT 
          tl.task_id,
                   JSON_AGG(JSON_BUILD_OBJECT(
           'id', tl.label_id,
           'label_id', tl.label_id,
           'name', team_l.name,
           'color_code', team_l.color_code
         )) AS labels,
         JSON_AGG(JSON_BUILD_OBJECT(
           'id', tl.label_id,
           'label_id', tl.label_id,
           'name', team_l.name,
           'color_code', team_l.color_code
         )) AS all_labels
        FROM task_labels tl
        JOIN team_labels team_l ON tl.label_id = team_l.id
        GROUP BY tl.task_id
      )
      ${options.customColumns ? `,
      custom_columns_data AS (
        SELECT 
          ccv.task_id,
          JSONB_OBJECT_AGG(
            cc.key, 
            CASE 
              WHEN ccv.text_value IS NOT NULL THEN to_jsonb(ccv.text_value)
              WHEN ccv.number_value IS NOT NULL THEN to_jsonb(ccv.number_value)
              WHEN ccv.boolean_value IS NOT NULL THEN to_jsonb(ccv.boolean_value)
              WHEN ccv.date_value IS NOT NULL THEN to_jsonb(ccv.date_value)
              WHEN ccv.json_value IS NOT NULL THEN ccv.json_value
              ELSE NULL::JSONB
            END
          ) AS custom_column_values
        FROM cc_column_values ccv
        JOIN cc_custom_columns cc ON ccv.column_id = cc.id
        GROUP BY ccv.task_id
             )` : ""}
      SELECT 
        t.id,
        t.name,
        CONCAT(p.key, '-', t.task_no) AS task_key,
        p.name AS project_name,
        t.project_id,
        t.parent_task_id,
        t.parent_task_id IS NOT NULL AS is_sub_task,
        parent_task.name AS parent_task_name,
        t.status_id AS status,
        t.archived,
        t.description,
        t.sort_order,
        t.progress_value,
        t.manual_progress,
        t.weight,
        p.use_manual_progress AS project_use_manual_progress,
        p.use_weighted_progress AS project_use_weighted_progress,
        p.use_time_progress AS project_use_time_progress,
        -- Use stored progress value instead of expensive function call
        COALESCE(t.progress_value, 0) AS complete_ratio,
        -- Phase information via JOINs
        tp.phase_id,
        pp.name AS phase_name,
        pp.color_code AS phase_color_code,
        -- Status information via JOINs
        stsc.color_code AS status_color,
        stsc.color_code_dark AS status_color_dark,
                 JSON_BUILD_OBJECT(
           'is_done', stsc.is_done,
           'is_doing', stsc.is_doing,
           'is_todo', stsc.is_todo
         ) AS status_category,
        -- Aggregated counts
        COALESCE(agg.sub_tasks_count, 0) AS sub_tasks_count,
        COALESCE(agg.completed_sub_tasks, 0) AS completed_sub_tasks,
        COALESCE(agg.comments_count, 0) AS comments_count,
        COALESCE(agg.attachments_count, 0) AS attachments_count,
        COALESCE(agg.total_minutes_spent, 0) AS total_minutes_spent,
        CASE WHEN agg.has_subscribers > 0 THEN true ELSE false END AS has_subscribers,
        CASE WHEN agg.has_dependencies > 0 THEN true ELSE false END AS has_dependencies,
        -- Task completion status
        CASE WHEN stsc.is_done THEN 1 ELSE 0 END AS parent_task_completed,
        -- Assignees and labels via JOINs
                 COALESCE(assignees.assignees, '[]'::JSON) AS assignees,
         COALESCE(assignees.assignee_names, '') AS assignee_names,
         COALESCE(assignees.names, '') AS names,
         COALESCE(labels.labels, '[]'::JSON) AS labels,
         COALESCE(labels.all_labels, '[]'::JSON) AS all_labels,
        -- Other fields
        stsc.is_done AS is_complete,
        reporter.name AS reporter,
        t.priority_id AS priority,
        tp_priority.value AS priority_value,
        t.total_minutes,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.start_date,
        t.billable,
        t.schedule_id,
        t.END_DATE,
        -- Timer information
        tt.start_time AS timer_start_time
        ${customColumnsQuery}
        ${statusesQuery}
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN task_statuses ts ON t.status_id = ts.id
      JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
      LEFT JOIN tasks parent_task ON t.parent_task_id = parent_task.id
      LEFT JOIN task_phase tp ON t.id = tp.task_id
      LEFT JOIN project_phases pp ON tp.phase_id = pp.id
      LEFT JOIN task_priorities tp_priority ON t.priority_id = tp_priority.id
      LEFT JOIN users reporter ON t.reporter_id = reporter.id
      LEFT JOIN task_timers tt ON t.id = tt.task_id AND tt.user_id = $${isSubTasks ? "3" : "2"}
      LEFT JOIN task_aggregates agg ON t.id = agg.id
      LEFT JOIN task_assignees assignees ON t.id = assignees.task_id
      LEFT JOIN task_labels labels ON t.id = labels.task_id
      ${options.customColumns ? "LEFT JOIN custom_columns_data cc_data ON t.id = cc_data.task_id" : ""}
      WHERE ${filters} ${searchQuery}
      ORDER BY ${sortFields}
    `;
  }

  public static async getGroups(groupBy: string, projectId: string): Promise<ITaskGroup[]> {
    let q = "";
    let params: any[] = [];
    switch (groupBy) {
      case GroupBy.STATUS:
        q = `
          SELECT id,
                 name,
                 (SELECT color_code FROM sys_task_status_categories WHERE id = task_statuses.category_id),
                 (SELECT color_code_dark FROM sys_task_status_categories WHERE id = task_statuses.category_id),
                 category_id
          FROM task_statuses
          WHERE project_id = $1
          ORDER BY sort_order;
        `;
        params = [projectId];
        break;
      case GroupBy.PRIORITY:
        q = `SELECT id, name, color_code, color_code_dark
             FROM task_priorities
             ORDER BY value DESC;`;
        break;
      case GroupBy.LABELS:
        q = `
          SELECT id, name, color_code
          FROM team_labels
          WHERE team_id = $2
            AND EXISTS(SELECT 1
                       FROM tasks
                       WHERE project_id = $1
                         AND EXISTS(SELECT 1 FROM task_labels WHERE task_id = tasks.id AND label_id = team_labels.id))
          ORDER BY name;
        `;
        break;
      case GroupBy.PHASE:
        q = `
          SELECT id, name, color_code, color_code AS color_code_dark, start_date, end_date, sort_index
          FROM project_phases
          WHERE project_id = $1
          ORDER BY sort_index DESC;
        `;
        params = [projectId];
        break;

      default:
        break;
    }

    const result = await db.query(q, params);
    return result.rows;
  }

  @HandleExceptions()
  public static async getList(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    console.log(`[PERFORMANCE] getList method called for project ${req.params.id} - THIS METHOD IS DEPRECATED, USE getTasksV3 INSTEAD`);
    
    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    if (req.query.refresh_progress === "true" && req.params.id) {
      console.log(`[PERFORMANCE] Starting progress refresh for project ${req.params.id} (getList)`);
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
      console.log(`[PERFORMANCE] Progress refresh completed in ${(progressEndTime - progressStartTime).toFixed(2)}ms`);
    }

    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;
    
    // Add customColumns flag to query params
    req.query.customColumns = "true";

    const q = TasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task, req.user?.id] : [req.params.id || null, req.user?.id];

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    const groups = await this.getGroups(groupBy, req.params.id);
    const map = groups.reduce((g: { [x: string]: ITaskGroup }, group) => {
      if (group.id)
        g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    await this.updateMapByGroup(tasks, groupBy, map);

    const updatedGroups = Object.keys(map).map(key => {
      const group = map[key];

      TasksControllerV2.updateTaskProgresses(group);

      // if (groupBy === GroupBy.PHASE)
      //   group.color_code = group.color_code + TASK_PRIORITY_COLOR_ALPHA;

      return {
        id: key,
        ...group
      };
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    console.log(`[PERFORMANCE] getList method completed in ${totalTime.toFixed(2)}ms for project ${req.params.id} with ${tasks.length} tasks`);
    
    // Log warning if this deprecated method is taking too long
    if (totalTime > 1000) {
      console.warn(`[PERFORMANCE WARNING] DEPRECATED getList method taking ${totalTime.toFixed(2)}ms - Frontend should use getTasksV3 instead!`);
    }

    return res.status(200).send(new ServerResponse(true, updatedGroups));
  }

  public static async updateMapByGroup(tasks: any[], groupBy: string, map: { [p: string]: ITaskGroup }) {
    let index = 0;
    const unmapped = [];
    
    // PERFORMANCE OPTIMIZATION: Remove expensive individual DB calls for each task
    // Progress values are already calculated and included in the main query
    // No need to make additional database calls here
    
    // Process tasks with their already-calculated progress values
    for (const task of tasks) {
      task.index = index++;
      TasksControllerV2.updateTaskViewModel(task);
      
      if (groupBy === GroupBy.STATUS) {
        map[task.status]?.tasks.push(task);
      } else if (groupBy === GroupBy.PRIORITY) {
        map[task.priority]?.tasks.push(task);
      } else if (groupBy === GroupBy.PHASE && task.phase_id) {
        map[task.phase_id]?.tasks.push(task);
      } else {
        unmapped.push(task);
      }
    }

    if (unmapped.length) {
      map[UNMAPPED] = {
        name: UNMAPPED,
        category_id: null,
        color_code: "#fbc84c69",
        tasks: unmapped
      };
    }
  }

  public static updateTaskProgresses(group: ITaskGroup) {
    const todoCount = group.tasks.filter(t => t.status_category?.is_todo).length;
    const doingCount = group.tasks.filter(t => t.status_category?.is_doing).length;
    const doneCount = group.tasks.filter(t => t.status_category?.is_done).length;

    const total = group.tasks.length;

    group.todo_progress = +this.calculateTaskCompleteRatio(todoCount, total);
    group.doing_progress = +this.calculateTaskCompleteRatio(doingCount, total);
    group.done_progress = +this.calculateTaskCompleteRatio(doneCount, total);
  }

  @HandleExceptions()
  public static async getTasksOnly(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    console.log(`[PERFORMANCE] getTasksOnly method called for project ${req.params.id} - Consider using getTasksV3 for better performance`);
    
    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    if (req.query.refresh_progress === "true" && req.params.id) {
      console.log(`[PERFORMANCE] Starting progress refresh for project ${req.params.id} (getTasksOnly)`);
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
      console.log(`[PERFORMANCE] Progress refresh completed in ${(progressEndTime - progressStartTime).toFixed(2)}ms`);
    }

    const isSubTasks = !!req.query.parent_task;
      
    // Add customColumns flag to query params
    req.query.customColumns = "true";
    
    const q = TasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task, req.user?.id] : [req.params.id || null, req.user?.id];
    const result = await db.query(q, params);

    let data: any[] = [];

    // if true, we only return the record count
    if (this.isCountsOnly(req.query)) {
      [data] = result.rows;
    } else { // else we return a flat list of tasks
      data = [...result.rows];
      
      // PERFORMANCE OPTIMIZATION: Remove expensive individual DB calls for each task
      // Progress values are already calculated and included in the main query via get_task_complete_ratio
      // The database query already includes complete_ratio, so no need for additional calls
      
      for (const task of data) {
        TasksControllerV2.updateTaskViewModel(task);
      }
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    console.log(`[PERFORMANCE] getTasksOnly method completed in ${totalTime.toFixed(2)}ms for project ${req.params.id} with ${data.length} tasks`);
    
    // Log warning if this method is taking too long
    if (totalTime > 1000) {
      console.warn(`[PERFORMANCE WARNING] getTasksOnly method taking ${totalTime.toFixed(2)}ms - Consider using getTasksV3 for better performance!`);
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async convertToTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE tasks
      SET parent_task_id = NULL,
          sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0)
      WHERE id = $1;
    `;
    await db.query(q, [req.body.id, req.body.project_id]);

    const result = await db.query("SELECT get_single_task($1) AS task;", [req.body.id]);
    const [data] = result.rows;
    const model = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, model));
  }

  @HandleExceptions()
  public static async getNewKanbanTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const result = await db.query("SELECT get_single_task($1) AS task;", [id]);
    const [data] = result.rows;
    const task = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, task));
  }

  @HandleExceptions()
  public static async resetParentTaskManualProgress(parentTaskId: string): Promise<void> {
    try {
      // Check if this task has subtasks
      const subTasksResult = await db.query(
        "SELECT COUNT(*) as subtask_count FROM tasks WHERE parent_task_id = $1 AND archived IS FALSE",
        [parentTaskId]
      );
      
      const subtaskCount = parseInt(subTasksResult.rows[0]?.subtask_count || "0");
      
      // If it has subtasks, reset the manual_progress flag to false
      if (subtaskCount > 0) {
        await db.query(
          "UPDATE tasks SET manual_progress = false WHERE id = $1",
          [parentTaskId]
        );
        console.log(`Reset manual progress for parent task ${parentTaskId} with ${subtaskCount} subtasks`);
        
        // Get the project settings to determine which calculation method to use
        const projectResult = await db.query(
          "SELECT project_id FROM tasks WHERE id = $1",
          [parentTaskId]
        );
        
        const projectId = projectResult.rows[0]?.project_id;
        
        if (projectId) {
          // Recalculate the parent task's progress based on its subtasks
          const progressResult = await db.query(
            "SELECT get_task_complete_ratio($1) AS ratio",
            [parentTaskId]
          );
          
          const progressRatio = progressResult.rows[0]?.ratio?.ratio || 0;
          
          // Emit the updated progress value to all clients
          // Note: We don't have socket context here, so we can't directly emit
          // This will be picked up on the next client refresh
          console.log(`Recalculated progress for parent task ${parentTaskId}: ${progressRatio}%`);
        }
      }
    } catch (error) {
      log_error(`Error resetting parent task manual progress: ${error}`);
    }
  }

  @HandleExceptions()
  public static async convertToSubtask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const groupType = req.body.group_by;
    let q = ``;

    if (groupType == "status") {
      q = `
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0),
            status_id      = $4
        WHERE id = $1;
      `;
    } else if (groupType == "priority") {
      q = `
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0),
            priority_id    = $4
        WHERE id = $1;
      `;
    } else if (groupType === "phase") {
      await db.query(`
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0)
        WHERE id = $1;
      `, [req.body.id, req.body.project_id, req.body.parent_task_id]);
      q = `SELECT handle_on_task_phase_change($1, $2);`;
    }

    if (req.body.to_group_id === UNMAPPED)
      req.body.to_group_id = null;

    const params = groupType === "phase"
      ? [req.body.id, req.body.to_group_id]
      : [req.body.id, req.body.project_id, req.body.parent_task_id, req.body.to_group_id];
    await db.query(q, params);
    
    // Reset the parent task's manual progress when converting a task to a subtask
    if (req.body.parent_task_id) {
      await this.resetParentTaskManualProgress(req.body.parent_task_id);
    }

    const result = await db.query("SELECT get_single_task($1) AS task;", [req.body.id]);
    const [data] = result.rows;
    const model = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, model));
  }

  public static async getTaskSubscribers(taskId: string) {
    const q = `
      SELECT u.name, u.avatar_url, ts.user_id, ts.team_member_id, ts.task_id
      FROM task_subscribers ts
             LEFT JOIN users u ON ts.user_id = u.id
      WHERE ts.task_id = $1;
    `;
    const result = await db.query(q, [taskId]);

    for (const member of result.rows)
      member.color_code = getColor(member.name);

    return this.createTagList(result.rows);
  }

  public static async getProjectSubscribers(projectId: string) {
    const q = `
      SELECT u.name, u.avatar_url, ps.user_id, ps.team_member_id, ps.project_id
      FROM project_subscribers ps
             LEFT JOIN users u ON ps.user_id = u.id
      WHERE ps.project_id = $1;
    `;
    const result = await db.query(q, [projectId]);

    for (const member of result.rows)
      member.color_code = getColor(member.name);

    return this.createTagList(result.rows);
  }

  public static async checkUserAssignedToTask(taskId: string, userId: string, teamId: string) {
    const q = `
    SELECT EXISTS(
        SELECT * FROM tasks_assignees WHERE task_id = $1 AND team_member_id = (SELECT team_member_id FROM team_member_info_view WHERE user_id = $2 AND team_id = $3)
    );
    `;
    const result = await db.query(q, [taskId, userId, teamId]);
    const [data] = result.rows;

    return data.exists;

  }

  public static async getTasksByName(searchString: string, projectId: string, taskId: string) {
    const q = `SELECT id AS value ,
       name AS label,
       CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) AS task_key
      FROM tasks t
      WHERE t.name ILIKE '%${searchString}%'
        AND t.project_id = $1 AND t.id != $2
      LIMIT 15;`;
    const result = await db.query(q, [projectId, taskId]);

    return result.rows;
  }

  @HandleExceptions()
  public static async getSubscribers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const subscribers = await this.getTaskSubscribers(req.params.id);
    return res.status(200).send(new ServerResponse(true, subscribers));
  }

  @HandleExceptions()
  public static async searchTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { projectId, taskId, searchQuery } = req.query;
    const tasks = await this.getTasksByName(searchQuery as string, projectId as string, taskId as string);
    return res.status(200).send(new ServerResponse(true, tasks));
  }

  @HandleExceptions()
  public static async getTaskDependencyStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { statusId, taskId } = req.query;
    const canContinue = await TasksControllerV2.checkForCompletedDependencies(taskId as string, statusId as string);
    return res.status(200).send(new ServerResponse(true, { can_continue: canContinue }));
  }

  @HandleExceptions()
  public static async checkForCompletedDependencies(taskId: string, nextStatusId: string): Promise<IWorkLenzResponse> {
    const q = `SELECT
    CASE
        WHEN EXISTS (
            -- Check if the status id is not in the "done" category
            SELECT 1
            FROM task_statuses ts
            WHERE ts.id = $2
              AND ts.project_id = (SELECT project_id FROM tasks WHERE id = $1)
              AND ts.category_id IN (
                  SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE
              )
        ) THEN TRUE -- If status is not in the "done" category, continue immediately (TRUE)

        WHEN EXISTS (
            -- Check if any dependent tasks are not completed
            SELECT 1
            FROM task_dependencies td
            LEFT JOIN public.tasks t ON t.id = td.related_task_id
            WHERE td.task_id = $1
              AND t.status_id NOT IN (
                  SELECT id
                  FROM task_statuses ts
                  WHERE t.project_id = ts.project_id
                    AND ts.category_id IN (
                        SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE
                    )
              )
        ) THEN FALSE -- If there are incomplete dependent tasks, do not continue (FALSE)

        ELSE TRUE -- Continue if no other conditions block the process
    END AS can_continue;`;
    const result = await db.query(q, [taskId, nextStatusId]);
    const [data] = result.rows;

    return data.can_continue;
  }

  public static async getTaskStatusColor(status_id: string) {
    try {
      const q = `SELECT color_code, color_code_dark
      FROM sys_task_status_categories
      WHERE id = (SELECT category_id FROM task_statuses WHERE id = $1)`;
      const result = await db.query(q, [status_id]);
      const [data] = result.rows;
      return data;
    } catch (e) {
      log_error(e);
    }
  }

  @HandleExceptions()
  public static async assignLabelsToTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { labels }: { labels: string[] } = req.body;

    labels.forEach(async (label: string) => {
      const q = `SELECT add_or_remove_task_label($1, $2) AS labels;`;
      await db.query(q, [id, label]);
    });
    return res.status(200).send(new ServerResponse(true, null, "Labels assigned successfully"));
  }

  /**
   * Updates a custom column value for a task
   * @param req The request object
   * @param res The response object
   */
  @HandleExceptions()
  public static async updateCustomColumnValue(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { taskId } = req.params;
    const { column_key, value, project_id } = req.body;

    if (!taskId || !column_key || value === undefined || !project_id) {
      return res.status(400).send(new ServerResponse(false, "Missing required parameters"));
    }

    // Get column information
    const columnQuery = `
      SELECT id, field_type 
      FROM cc_custom_columns 
      WHERE project_id = $1 AND key = $2
    `;
    const columnResult = await db.query(columnQuery, [project_id, column_key]);
    
    if (columnResult.rowCount === 0) {
      return res.status(404).send(new ServerResponse(false, "Custom column not found"));
    }
    
    const column = columnResult.rows[0];
    const columnId = column.id;
    const fieldType = column.field_type;
    
    // Determine which value field to use based on the field_type
    let textValue = null;
    let numberValue = null;
    let dateValue = null;
    let booleanValue = null;
    let jsonValue = null;
    
    switch (fieldType) {
      case "number":
        numberValue = parseFloat(String(value));
        break;
      case "date":
        dateValue = new Date(String(value));
        break;
      case "checkbox":
        booleanValue = Boolean(value);
        break;
      case "people":
        jsonValue = JSON.stringify(Array.isArray(value) ? value : [value]);
        break;
      default:
        textValue = String(value);
    }
    
    // Check if a value already exists
    const existingValueQuery = `
      SELECT id 
      FROM cc_column_values 
      WHERE task_id = $1 AND column_id = $2
    `;
    const existingValueResult = await db.query(existingValueQuery, [taskId, columnId]);
    
    if (existingValueResult.rowCount && existingValueResult.rowCount > 0) {
      // Update existing value
      const updateQuery = `
        UPDATE cc_column_values 
        SET text_value = $1, 
            number_value = $2, 
            date_value = $3, 
            boolean_value = $4, 
            json_value = $5, 
            updated_at = NOW() 
        WHERE task_id = $6 AND column_id = $7
      `;
      await db.query(updateQuery, [
        textValue, 
        numberValue, 
        dateValue, 
        booleanValue, 
        jsonValue, 
        taskId, 
        columnId
      ]);
    } else {
      // Insert new value
      const insertQuery = `
        INSERT INTO cc_column_values 
        (task_id, column_id, text_value, number_value, date_value, boolean_value, json_value, created_at, updated_at) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
      `;
      await db.query(insertQuery, [
        taskId, 
        columnId, 
        textValue, 
        numberValue, 
        dateValue, 
        booleanValue, 
        jsonValue
      ]);
    }

    return res.status(200).send(new ServerResponse(true, { 
      task_id: taskId,
      column_key,
      value
    }));
  }

  public static async refreshProjectTaskProgressValues(projectId: string): Promise<void> {
    try {     
      // Run the recalculate_all_task_progress function only for tasks in this project
      const query = `
      DO $$
      BEGIN
        -- First, reset manual_progress flag for all tasks that have subtasks within this project
        UPDATE tasks AS t
        SET manual_progress = FALSE
        WHERE project_id = '${projectId}'
        AND EXISTS (
            SELECT 1
            FROM tasks
            WHERE parent_task_id = t.id
            AND archived IS FALSE
        );
        
        -- Start recalculation from leaf tasks (no subtasks) and propagate upward
        -- This ensures calculations are done in the right order
        WITH RECURSIVE task_hierarchy AS (
            -- Base case: Start with all leaf tasks (no subtasks) in this project
            SELECT 
                id,
                parent_task_id,
                0 AS level
            FROM tasks
            WHERE project_id = '${projectId}'
            AND NOT EXISTS (
                SELECT 1 FROM tasks AS sub
                WHERE sub.parent_task_id = tasks.id
                AND sub.archived IS FALSE
            )
            AND archived IS FALSE
            
            UNION ALL
            
            -- Recursive case: Move up to parent tasks, but only after processing all their children
            SELECT 
                t.id,
                t.parent_task_id,
                th.level + 1
            FROM tasks t
            JOIN task_hierarchy th ON t.id = th.parent_task_id
            WHERE t.archived IS FALSE
        )
        -- Sort by level to ensure we calculate in the right order (leaves first, then parents)
        UPDATE tasks
        SET progress_value = (SELECT (get_task_complete_ratio(tasks.id)->>'ratio')::FLOAT)
        FROM (
            SELECT id, level
            FROM task_hierarchy
            ORDER BY level
        ) AS ordered_tasks
        WHERE tasks.id = ordered_tasks.id
        AND tasks.project_id = '${projectId}'
        AND (manual_progress IS FALSE OR manual_progress IS NULL);
      END $$;
      `;
      
      await db.query(query);
      console.log(`Finished refreshing progress values for project ${projectId}`);
    } catch (error) {
      log_error("Error refreshing project task progress values", error);
    }
  }

  public static async updateTaskProgress(taskId: string): Promise<void> {
    try {
      // Calculate the task's progress using get_task_complete_ratio
      const result = await db.query("SELECT get_task_complete_ratio($1) AS info;", [taskId]);
      const [data] = result.rows;
      
      if (data && data.info && data.info.ratio !== undefined) {
        const progressValue = +((data.info.ratio || 0).toFixed());
        
        // Update the task's progress_value in the database
        await db.query(
          "UPDATE tasks SET progress_value = $1 WHERE id = $2",
          [progressValue, taskId]
        );
        
        console.log(`Updated progress for task ${taskId} to ${progressValue}%`);
        
        // If this task has a parent, update the parent's progress as well
        const parentResult = await db.query(
          "SELECT parent_task_id FROM tasks WHERE id = $1",
          [taskId]
        );
        
        if (parentResult.rows.length > 0 && parentResult.rows[0].parent_task_id) {
          await this.updateTaskProgress(parentResult.rows[0].parent_task_id);
        }
      }
    } catch (error) {
      log_error(`Error updating task progress: ${error}`);
    }
  }

  // Add this method to update progress when a task's weight is changed
  public static async updateTaskWeight(taskId: string, weight: number): Promise<void> {
    try {
      // Update the task's weight
      await db.query(
        "UPDATE tasks SET weight = $1 WHERE id = $2",
        [weight, taskId]
      );
      
      // Get the parent task ID
      const parentResult = await db.query(
        "SELECT parent_task_id FROM tasks WHERE id = $1",
        [taskId]
      );
      
      // If this task has a parent, update the parent's progress
      if (parentResult.rows.length > 0 && parentResult.rows[0].parent_task_id) {
        await this.updateTaskProgress(parentResult.rows[0].parent_task_id);
      }
    } catch (error) {
      log_error(`Error updating task weight: ${error}`);
    }
  }

  @HandleExceptions()
  public static async getTasksV3(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    console.log(`[PERFORMANCE] getTasksV3 method called for project ${req.params.id}`);
    
    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    if (req.query.refresh_progress === "true" && req.params.id) {
      console.log(`[PERFORMANCE] Starting progress refresh for project ${req.params.id} (getTasksV3)`);
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
      console.log(`[PERFORMANCE] Progress refresh completed in ${(progressEndTime - progressStartTime).toFixed(2)}ms`);
    }

    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;
    
    // Add customColumns flag to query params (same as getList)
    req.query.customColumns = "true";

    // Use the exact same database query as getList method
    const q = TasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks ? [req.params.id || null, req.query.parent_task, req.user?.id] : [req.params.id || null, req.user?.id];

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    // Use the same groups query as getList method
    const groups = await this.getGroups(groupBy, req.params.id);
    const map = groups.reduce((g: { [x: string]: ITaskGroup }, group) => {
      if (group.id)
        g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    // Use the same updateMapByGroup method as getList
    await this.updateMapByGroup(tasks, groupBy, map);

    // Calculate progress for groups (same as getList)
    const updatedGroups = Object.keys(map).map(key => {
      const group = map[key];
      TasksControllerV2.updateTaskProgresses(group);
      return {
        id: key,
        ...group
      };
    });

    // Transform to V3 response format while maintaining the same data processing
    const priorityMap: Record<string, string> = {
      "0": "low",
      "1": "medium", 
      "2": "high"
    };

    // Transform all tasks to V3 format
    const transformedTasks = tasks.map((task, index) => {
      // Convert time values
      const convertTimeValue = (value: any): number => {
        if (typeof value === "number") return value;
        if (typeof value === "string") {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        if (value && typeof value === "object") {
          if ("hours" in value || "minutes" in value) {
            const hours = Number(value.hours || 0);
            const minutes = Number(value.minutes || 0);
            return hours + (minutes / 60);
          }
        }
        return 0;
      };

      return {
        id: task.id,
        task_key: task.task_key || "",
        title: task.name || "",
        description: task.description || "",
        status: task.status || "todo",
        priority: priorityMap[task.priority_value?.toString()] || "medium",
        phase: task.phase_name || "Development",
        progress: typeof task.complete_ratio === "number" ? task.complete_ratio : 0,
        assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
        assignee_names: task.assignees || [],
        labels: task.labels?.map((l: any) => ({
          id: l.id || l.label_id,
          name: l.name,
          color: l.color_code || "#1890ff",
          end: l.end,
          names: l.names
        })) || [],
        all_labels: task.all_labels?.map((l: any) => ({
          id: l.id || l.label_id,
          name: l.name,
          color_code: l.color_code || "#1890ff"
        })) || [],
        dueDate: task.end_date || task.END_DATE,
        startDate: task.start_date,
        timeTracking: {
          estimated: convertTimeValue(task.total_time),
          logged: convertTimeValue(task.time_spent),
        },
        customFields: {},
        custom_column_values: task.custom_column_values || {},
        createdAt: task.created_at || new Date().toISOString(),
        updatedAt: task.updated_at || new Date().toISOString(),
        order: typeof task.sort_order === "number" ? task.sort_order : 0,
        // Additional metadata for frontend
        originalStatusId: task.status,
        originalPriorityId: task.priority,
        statusColor: task.status_color,
        priorityColor: task.priority_color,
        // Add subtask count
        sub_tasks_count: task.sub_tasks_count || 0,
        // Add indicator fields for frontend icons
        comments_count: task.comments_count || 0,
        has_subscribers: !!task.has_subscribers,
        attachments_count: task.attachments_count || 0,
        has_dependencies: !!task.has_dependencies,
        schedule_id: task.schedule_id || null,
      };
    });

    // Transform groups to V3 format while preserving the getList logic
    const responseGroups = updatedGroups.map(group => {
             // Create status category mapping for consistent group naming
       let groupValue = group.name;
       if (groupBy === GroupBy.STATUS) {
         groupValue = group.name.toLowerCase().replace(/\s+/g, "_");
       } else if (groupBy === GroupBy.PRIORITY) {
         groupValue = group.name.toLowerCase();
       } else if (groupBy === GroupBy.PHASE) {
         groupValue = group.name.toLowerCase().replace(/\s+/g, "_");
       }

      // Transform tasks in this group to V3 format
      const groupTasks = group.tasks.map(task => {
        const foundTask = transformedTasks.find(t => t.id === task.id);
        return foundTask || task;
      });

             return {
         id: group.id,
         title: group.name,
         groupType: groupBy,
         groupValue,
         collapsed: false,
         tasks: groupTasks,
         taskIds: groupTasks.map((task: any) => task.id),
         color: group.color_code || this.getDefaultGroupColor(groupBy, groupValue),
         // Include additional metadata from database
         category_id: group.category_id,
         start_date: group.start_date,
         end_date: group.end_date,
         sort_index: (group as any).sort_index,
         // Include progress information from getList logic
         todo_progress: group.todo_progress,
         doing_progress: group.doing_progress,
         done_progress: group.done_progress,
       };
    }).filter(group => group.tasks.length > 0 || req.query.include_empty === "true");

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    console.log(`[PERFORMANCE] getTasksV3 method completed in ${totalTime.toFixed(2)}ms for project ${req.params.id} with ${transformedTasks.length} tasks`);
    
    // Log warning if this method is taking too long
    if (totalTime > 1000) {
      console.warn(`[PERFORMANCE WARNING] getTasksV3 method taking ${totalTime.toFixed(2)}ms - Consider optimizing the query or data processing!`);
    }

    return res.status(200).send(new ServerResponse(true, {
      groups: responseGroups,
      allTasks: transformedTasks,
      grouping: groupBy,
      totalTasks: transformedTasks.length
    }));
  }

  /**
   * NEW OPTIMIZED METHOD: Split complex query into focused segments for better performance
   */
  @HandleExceptions()
  public static async getTasksV4Optimized(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    console.log(`[PERFORMANCE] getTasksV4Optimized method called for project ${req.params.id}`);
    
    // Skip progress refresh by default for better performance
    if (req.query.refresh_progress === "true" && req.params.id) {
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
      console.log(`[PERFORMANCE] Progress refresh completed in ${(progressEndTime - progressStartTime).toFixed(2)}ms`);
    }

    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;
    const projectId = req.params.id;
    const userId = req.user?.id;

    // STEP 1: Get basic task data with optimized query
    const baseTasksQuery = `
      SELECT 
        t.id,
        t.name,
        CONCAT(p.key, '-', t.task_no) AS task_key,
        p.name AS project_name,
        t.project_id,
        t.parent_task_id,
        t.parent_task_id IS NOT NULL AS is_sub_task,
        t.status_id AS status,
        t.priority_id AS priority,
        t.description,
        t.sort_order,
        t.progress_value AS complete_ratio,
        t.manual_progress,
        t.weight,
        t.start_date,
        t.end_date,
        t.created_at,
        t.updated_at,
        t.completed_at,
        t.billable,
        t.schedule_id,
        t.total_minutes,
        -- Status information via JOINs
        stsc.color_code AS status_color,
        stsc.color_code_dark AS status_color_dark,
        stsc.is_done,
        stsc.is_doing,
        stsc.is_todo,
        -- Priority information
        tp_priority.value AS priority_value,
        -- Phase information
        tp.phase_id,
        pp.name AS phase_name,
        pp.color_code AS phase_color_code,
        -- Reporter information
        reporter.name AS reporter,
        -- Timer information
        tt.start_time AS timer_start_time
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      JOIN task_statuses ts ON t.status_id = ts.id
      JOIN sys_task_status_categories stsc ON ts.category_id = stsc.id
      LEFT JOIN task_phase tp ON t.id = tp.task_id
      LEFT JOIN project_phases pp ON tp.phase_id = pp.id
      LEFT JOIN task_priorities tp_priority ON t.priority_id = tp_priority.id
      LEFT JOIN users reporter ON t.reporter_id = reporter.id
      LEFT JOIN task_timers tt ON t.id = tt.task_id AND tt.user_id = $2
      WHERE t.project_id = $1 
        AND t.archived = FALSE 
        ${isSubTasks ? "AND t.parent_task_id = $3" : "AND t.parent_task_id IS NULL"}
      ORDER BY t.sort_order
    `;

    const baseParams = isSubTasks ? [projectId, userId, req.query.parent_task] : [projectId, userId];
    const baseResult = await db.query(baseTasksQuery, baseParams);
    const baseTasks = baseResult.rows;

    if (baseTasks.length === 0) {
      return res.status(200).send(new ServerResponse(true, {
        groups: [],
        allTasks: [],
        grouping: groupBy,
        totalTasks: 0
      }));
    }

    const taskIds = baseTasks.map(t => t.id);

    // STEP 2: Get aggregated data in parallel
    const [assigneesResult, labelsResult, aggregatesResult] = await Promise.all([
      // Get assignees
      db.query(`
        SELECT 
          ta.task_id,
          JSON_AGG(JSON_BUILD_OBJECT(
            'team_member_id', ta.team_member_id,
            'project_member_id', ta.project_member_id,
            'name', COALESCE(tm.name, ''),
            'avatar_url', COALESCE(u.avatar_url, ''),
            'email', COALESCE(u.email, ei.email, ''),
            'user_id', tm.user_id,
            'socket_id', COALESCE(u.socket_id, ''),
            'team_id', tm.team_id
          )) AS assignees
        FROM tasks_assignees ta
        LEFT JOIN team_members tm ON ta.team_member_id = tm.id
        LEFT JOIN users u ON tm.user_id = u.id
        LEFT JOIN email_invitations ei ON ta.team_member_id = ei.team_member_id
        WHERE ta.task_id = ANY($1)
        GROUP BY ta.task_id
      `, [taskIds]),
      
      // Get labels
      db.query(`
        SELECT 
          tl.task_id,
          JSON_AGG(JSON_BUILD_OBJECT(
            'id', tl.label_id,
            'label_id', tl.label_id,
            'name', team_l.name,
            'color_code', team_l.color_code
          )) AS labels
        FROM task_labels tl
        JOIN team_labels team_l ON tl.label_id = team_l.id
        WHERE tl.task_id = ANY($1)
        GROUP BY tl.task_id
      `, [taskIds]),

      // Get aggregated counts
      db.query(`
        SELECT 
          t.id,
          COUNT(DISTINCT sub.id) AS sub_tasks_count,
          COUNT(DISTINCT CASE WHEN sub_status.is_done THEN sub.id END) AS completed_sub_tasks,
          COUNT(DISTINCT tc.id) AS comments_count,
          COUNT(DISTINCT ta.id) AS attachments_count,
          COALESCE(SUM(twl.time_spent), 0) AS total_minutes_spent,
          CASE WHEN COUNT(ts.id) > 0 THEN true ELSE false END AS has_subscribers,
          CASE WHEN COUNT(td.id) > 0 THEN true ELSE false END AS has_dependencies
        FROM unnest($1::uuid[]) AS t(id)
        LEFT JOIN tasks sub ON t.id = sub.parent_task_id AND sub.archived = FALSE
        LEFT JOIN task_statuses sub_ts ON sub.status_id = sub_ts.id
        LEFT JOIN sys_task_status_categories sub_status ON sub_ts.category_id = sub_status.id
        LEFT JOIN task_comments tc ON t.id = tc.task_id
        LEFT JOIN task_attachments ta ON t.id = ta.task_id
        LEFT JOIN task_work_log twl ON t.id = twl.task_id
        LEFT JOIN task_subscribers ts ON t.id = ts.task_id
        LEFT JOIN task_dependencies td ON t.id = td.task_id
        GROUP BY t.id
      `, [taskIds])
    ]);

    // STEP 3: Create lookup maps for efficient data merging
    const assigneesMap = new Map();
    assigneesResult.rows.forEach(row => assigneesMap.set(row.task_id, row.assignees || []));

    const labelsMap = new Map();
    labelsResult.rows.forEach(row => labelsMap.set(row.task_id, row.labels || []));

    const aggregatesMap = new Map();
    aggregatesResult.rows.forEach(row => aggregatesMap.set(row.id, row));

    // STEP 4: Merge data efficiently
    const enrichedTasks = baseTasks.map(task => {
      const aggregates = aggregatesMap.get(task.id) || {};
      const assignees = assigneesMap.get(task.id) || [];
      const labels = labelsMap.get(task.id) || [];

      return {
        ...task,
        assignees,
        assignee_names: assignees.map((a: any) => a.name).join(", "),
        names: assignees.map((a: any) => a.name).join(", "),
        labels,
        all_labels: labels,
        sub_tasks_count: parseInt(aggregates.sub_tasks_count || 0),
        completed_sub_tasks: parseInt(aggregates.completed_sub_tasks || 0),
        comments_count: parseInt(aggregates.comments_count || 0),
        attachments_count: parseInt(aggregates.attachments_count || 0),
        total_minutes_spent: parseFloat(aggregates.total_minutes_spent || 0),
        has_subscribers: aggregates.has_subscribers || false,
        has_dependencies: aggregates.has_dependencies || false,
        status_category: {
          is_done: task.is_done,
          is_doing: task.is_doing,
          is_todo: task.is_todo
        }
      };
    });

    // STEP 5: Group tasks (same logic as existing method)
    const groups = await this.getGroups(groupBy, req.params.id);
    const map = groups.reduce((g: { [x: string]: ITaskGroup }, group) => {
      if (group.id)
        g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    await this.updateMapByGroup(enrichedTasks, groupBy, map);

    const updatedGroups = Object.keys(map).map(key => {
      const group = map[key];
      TasksControllerV2.updateTaskProgresses(group);
      return {
        id: key,
        ...group
      };
    });

    // STEP 6: Transform to V3 format (same as existing method)
    const priorityMap: Record<string, string> = {
      "0": "low",
      "1": "medium", 
      "2": "high"
    };

    const transformedTasks = enrichedTasks.map(task => ({
      id: task.id,
      task_key: task.task_key || "",
      title: task.name || "",
      description: task.description || "",
      status: task.status || "todo",
      priority: priorityMap[task.priority_value?.toString()] || "medium",
      phase: task.phase_name || "Development",
      progress: typeof task.complete_ratio === "number" ? task.complete_ratio : 0,
      assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
      assignee_names: task.assignees || [],
      labels: task.labels?.map((l: any) => ({
        id: l.id || l.label_id,
        name: l.name,
        color: l.color_code || "#1890ff"
      })) || [],
      dueDate: task.end_date,
      startDate: task.start_date,
      timeTracking: {
        estimated: task.total_minutes || 0,
        logged: task.total_minutes_spent || 0,
      },
      customFields: {},
      createdAt: task.created_at || new Date().toISOString(),
      updatedAt: task.updated_at || new Date().toISOString(),
      order: typeof task.sort_order === "number" ? task.sort_order : 0,
      originalStatusId: task.status,
      originalPriorityId: task.priority,
      statusColor: task.status_color,
      priorityColor: task.priority_color,
      sub_tasks_count: task.sub_tasks_count || 0,
      comments_count: task.comments_count || 0,
      has_subscribers: !!task.has_subscribers,
      attachments_count: task.attachments_count || 0,
      has_dependencies: !!task.has_dependencies,
      schedule_id: task.schedule_id || null,
    }));

    const responseGroups = updatedGroups.map(group => {
      let groupValue = group.name;
      if (groupBy === GroupBy.STATUS) {
        groupValue = group.name.toLowerCase().replace(/\s+/g, "_");
      } else if (groupBy === GroupBy.PRIORITY) {
        groupValue = group.name.toLowerCase();
      } else if (groupBy === GroupBy.PHASE) {
        groupValue = group.name.toLowerCase().replace(/\s+/g, "_");
      }

      const groupTasks = group.tasks.map(task => {
        const foundTask = transformedTasks.find(t => t.id === task.id);
        return foundTask || task;
      });

      return {
        id: group.id,
        title: group.name,
        groupType: groupBy,
        groupValue,
        collapsed: false,
        tasks: groupTasks,
        taskIds: groupTasks.map((task: any) => task.id),
        color: group.color_code || this.getDefaultGroupColor(groupBy, groupValue),
        category_id: group.category_id,
        start_date: group.start_date,
        end_date: group.end_date,
        sort_index: (group as any).sort_index,
        todo_progress: group.todo_progress,
        doing_progress: group.doing_progress,
        done_progress: group.done_progress,
      };
    }).filter(group => group.tasks.length > 0 || req.query.include_empty === "true");

    const endTime = performance.now();
    const totalTime = endTime - startTime;
           console.log(`[PERFORMANCE] getTasksV4Optimized method completed in ${totalTime.toFixed(2)}ms for project ${req.params.id} with ${transformedTasks.length} tasks - Improvement: ${2136 - totalTime > 0 ? "+" : ""}${(2136 - totalTime).toFixed(2)}ms`);

    return res.status(200).send(new ServerResponse(true, {
      groups: responseGroups,
      allTasks: transformedTasks,
      grouping: groupBy,
      totalTasks: transformedTasks.length,
      performanceMetrics: {
        executionTime: Math.round(totalTime),
        tasksCount: transformedTasks.length,
        optimizationGain: Math.round(2136 - totalTime)
      }
    }));
  }

  private static getDefaultGroupColor(groupBy: string, groupValue: string): string {
    const colorMaps: Record<string, Record<string, string>> = {
      [GroupBy.STATUS]: {
        todo: "#f0f0f0",
        doing: "#1890ff", 
        done: "#52c41a",
      },
      [GroupBy.PRIORITY]: {
        critical: "#ff4d4f",
        high: "#ff7a45",
        medium: "#faad14",
        low: "#52c41a",
      },
      [GroupBy.PHASE]: {
        planning: "#722ed1",
        development: "#1890ff",
        testing: "#faad14",
        deployment: "#52c41a",
        unmapped: "#fbc84c69",
      },
    };
    
    return colorMaps[groupBy]?.[groupValue] || "#d9d9d9";
  }

  @HandleExceptions()
  public static async refreshTaskProgress(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      const startTime = performance.now();
      
      if (req.params.id) {
        console.log(`[PERFORMANCE] Starting background progress refresh for project ${req.params.id}`);
        await this.refreshProjectTaskProgressValues(req.params.id);
        
        const endTime = performance.now();
        const totalTime = endTime - startTime;
        console.log(`[PERFORMANCE] Background progress refresh completed in ${totalTime.toFixed(2)}ms for project ${req.params.id}`);
        
        return res.status(200).send(new ServerResponse(true, {
          message: "Task progress values refreshed successfully",
          performanceMetrics: {
            refreshTime: Math.round(totalTime),
            projectId: req.params.id
          }
        }));
      }
      return res.status(400).send(new ServerResponse(false, null, "Project ID is required"));
    } catch (error) {
      console.error("Error refreshing task progress:", error);
      return res.status(500).send(new ServerResponse(false, null, "Failed to refresh task progress"));
    }
  }

  // Optimized method for getting task progress without blocking main UI
  @HandleExceptions()
  public static async getTaskProgressStatus(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    try {
      if (!req.params.id) {
        return res.status(400).send(new ServerResponse(false, null, "Project ID is required"));
      }

      // Get basic progress stats without expensive calculations
      const result = await db.query(`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(CASE WHEN EXISTS(
            SELECT 1 FROM tasks_with_status_view 
            WHERE tasks_with_status_view.task_id = tasks.id 
            AND is_done IS TRUE
          ) THEN 1 END) as completed_tasks,
          AVG(CASE 
            WHEN progress_value IS NOT NULL THEN progress_value 
            ELSE 0 
          END) as avg_progress,
          MAX(updated_at) as last_updated
        FROM tasks 
        WHERE project_id = $1 AND archived IS FALSE
      `, [req.params.id]);

      const [stats] = result.rows;
      
      return res.status(200).send(new ServerResponse(true, {
        projectId: req.params.id,
        totalTasks: parseInt(stats.total_tasks) || 0,
        completedTasks: parseInt(stats.completed_tasks) || 0,
        avgProgress: parseFloat(stats.avg_progress) || 0,
        lastUpdated: stats.last_updated,
        completionPercentage: stats.total_tasks > 0 ? 
          Math.round((parseInt(stats.completed_tasks) / parseInt(stats.total_tasks)) * 100) : 0
      }));
    } catch (error) {
      console.error("Error getting task progress status:", error);
      return res.status(500).send(new ServerResponse(false, null, "Failed to get task progress status"));
    }
  }


}
