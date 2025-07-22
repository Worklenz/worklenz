import { ParsedQs } from "qs";

import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import {
  TASK_PRIORITY_COLOR_ALPHA,
  TASK_STATUS_COLOR_ALPHA,
  UNMAPPED,
} from "../shared/constants";
import { getColor, log_error } from "../shared/utils";
import TasksControllerBase, {
  GroupBy,
  ITaskGroup,
} from "./tasks-controller-base";

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
    return (text || "")
      .split(" ")
      .map((s) => `'${s}'`)
      .join(",");
  }

  private static getFilterByStatusWhereClosure(text: string) {
    return text ? `status_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByPriorityWhereClosure(text: string) {
    return text ? `priority_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByLabelsWhereClosure(text: string) {
    return text
      ? `id IN (SELECT task_id FROM task_labels WHERE label_id IN (${this.flatString(
          text
        )}))`
      : "";
  }

  private static getFilterByMembersWhereClosure(text: string) {
    return text
      ? `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id IN (${this.flatString(
          text
        )}))`
      : "";
  }

  private static getFilterByProjectsWhereClosure(text: string) {
    return text ? `project_id IN (${this.flatString(text)})` : "";
  }

  private static getFilterByAssignee(filterBy: string) {
    return filterBy === "member"
      ? `id IN (SELECT task_id FROM tasks_assignees WHERE team_member_id = $1)`
      : "project_id = $1";
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
      const result = await db.query(
        "SELECT get_task_complete_ratio($1) AS info;",
        [taskId]
      );
      const [data] = result.rows;
      if (data && data.info && data.info.ratio !== undefined) {
        data.info.ratio = +(data.info.ratio || 0).toFixed();
        return data.info;
      }
      return null;
    } catch (error) {
      log_error(`Error in getTaskCompleteRatio: ${error}`);
      return null;
    }
  }

  private static getQuery(userId: string, options: ParsedQs) {
    // Determine which sort column to use based on grouping
    const groupBy = options.group || "status";
    let defaultSortColumn = "sort_order";
    switch (groupBy) {
      case "status":
        defaultSortColumn = "status_sort_order";
        break;
      case "priority":
        defaultSortColumn = "priority_sort_order";
        break;
      case "phase":
        defaultSortColumn = "phase_sort_order";
        break;
      default:
        defaultSortColumn = "sort_order";
    }

    const searchField = options.search
      ? [
          "t.name",
          "CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no)",
        ]
      : defaultSortColumn;
    const { searchQuery, sortField } = TasksControllerV2.toPaginationOptions(
      options,
      searchField
    );

    const isSubTasks = !!options.parent_task;

    const sortFields =
      sortField.replace(/ascend/g, "ASC").replace(/descend/g, "DESC") ||
      defaultSortColumn;

    // Filter tasks by statuses
    const statusesFilter = TasksControllerV2.getFilterByStatusWhereClosure(
      options.statuses as string
    );
    // Filter tasks by labels
    const labelsFilter = TasksControllerV2.getFilterByLabelsWhereClosure(
      options.labels as string
    );
    // Filter tasks by its members
    const membersFilter = TasksControllerV2.getFilterByMembersWhereClosure(
      options.members as string
    );
    // Filter tasks by projects
    const projectsFilter = TasksControllerV2.getFilterByProjectsWhereClosure(
      options.projects as string
    );
    // Filter tasks by priorities
    const priorityFilter = TasksControllerV2.getFilterByPriorityWhereClosure(
      options.priorities as string
    );
    // Filter tasks by a single assignee
    const filterByAssignee = TasksControllerV2.getFilterByAssignee(
      options.filterBy as string
    );
    // Returns statuses of each task as a json array if filterBy === "member"
    const statusesQuery = TasksControllerV2.getStatusesQuery(
      options.filterBy as string
    );

    // Custom columns data query
    const customColumnsQuery = options.customColumns
      ? `, (SELECT COALESCE(
            jsonb_object_agg(
              custom_cols.key,
              custom_cols.value
            ),
            '{}'::JSONB
          )
          FROM (
            SELECT
              cc.key,
              CASE
                WHEN ccv.text_value IS NOT NULL THEN to_jsonb(ccv.text_value)
                WHEN ccv.number_value IS NOT NULL THEN to_jsonb(ccv.number_value)
                WHEN ccv.boolean_value IS NOT NULL THEN to_jsonb(ccv.boolean_value)
                WHEN ccv.date_value IS NOT NULL THEN to_jsonb(ccv.date_value)
                WHEN ccv.json_value IS NOT NULL THEN ccv.json_value
                ELSE NULL::JSONB
              END AS value
            FROM cc_column_values ccv
            JOIN cc_custom_columns cc ON ccv.column_id = cc.id
            WHERE ccv.task_id = t.id
          ) AS custom_cols
          WHERE custom_cols.value IS NOT NULL) AS custom_column_values`
      : "";

    const archivedFilter =
      options.archived === "true" ? "archived IS TRUE" : "archived IS FALSE";

    let subTasksFilter;

    if (options.isSubtasksInclude === "true") {
      subTasksFilter = "";
    } else {
      subTasksFilter = isSubTasks
        ? "parent_task_id = $2"
        : "parent_task_id IS NULL";
    }

    const filters = [
      subTasksFilter,
      isSubTasks ? "1 = 1" : archivedFilter,
      isSubTasks ? "$1 = $1" : filterByAssignee, // ignored filter by member in peoples page for sub-tasks
      statusesFilter,
      priorityFilter,
      labelsFilter,
      membersFilter,
      projectsFilter,
    ]
      .filter((i) => !!i)
      .join(" AND ");

    return `
      SELECT id,
             name,
             CONCAT((SELECT key FROM projects WHERE id = t.project_id), '-', task_no) AS task_key,
             (SELECT name FROM projects WHERE id = t.project_id) AS project_name,
             t.project_id AS project_id,
             t.parent_task_id,
             t.parent_task_id IS NOT NULL AS is_sub_task,
             (SELECT name FROM tasks WHERE id = t.parent_task_id) AS parent_task_name,
             (SELECT COUNT(*)
              FROM tasks
              WHERE parent_task_id = t.id)::INT AS sub_tasks_count,

             t.status_id AS status,
             t.archived,
             t.description,
             t.sort_order,
             t.status_sort_order,
             t.priority_sort_order,
             t.phase_sort_order,
             t.progress_value,
             t.manual_progress,
             t.weight,
             (SELECT use_manual_progress FROM projects WHERE id = t.project_id) AS project_use_manual_progress,
             (SELECT use_weighted_progress FROM projects WHERE id = t.project_id) AS project_use_weighted_progress,
             (SELECT use_time_progress FROM projects WHERE id = t.project_id) AS project_use_time_progress,
             (SELECT get_task_complete_ratio(t.id)->>'ratio') AS complete_ratio,

             (SELECT phase_id FROM task_phase WHERE task_id = t.id) AS phase_id,
             (SELECT name
              FROM project_phases
              WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_name,
              (SELECT color_code
                FROM project_phases
                WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_color_code,

             (EXISTS(SELECT 1 FROM task_subscribers WHERE task_id = t.id)) AS has_subscribers,
             (EXISTS(SELECT 1 FROM task_dependencies td WHERE td.task_id = t.id)) AS has_dependencies,
             (SELECT start_time
              FROM task_timers
              WHERE task_id = t.id
                AND user_id = '${userId}') AS timer_start_time,

             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,

             (SELECT color_code_dark
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color_dark,

             (SELECT COALESCE(ROW_TO_JSON(r), '{}'::JSON)
              FROM (SELECT is_done, is_doing, is_todo
                    FROM sys_task_status_categories
                    WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) r) AS status_category,

             (SELECT COUNT(*) FROM task_comments WHERE task_id = t.id) AS comments_count,
             (SELECT COUNT(*) FROM task_attachments WHERE task_id = t.id) AS attachments_count,
             (CASE
                WHEN EXISTS(SELECT 1
                            FROM tasks_with_status_view
                            WHERE tasks_with_status_view.task_id = t.id
                              AND is_done IS TRUE) THEN 1
                ELSE 0 END) AS parent_task_completed,
             (SELECT get_task_assignees(t.id)) AS assignees,
             (SELECT COUNT(*)
              FROM tasks_with_status_view tt
              WHERE tt.parent_task_id = t.id
                AND tt.is_done IS TRUE)::INT
               AS completed_sub_tasks,

             (SELECT COALESCE(JSON_AGG(r), '[]'::JSON)
              FROM (SELECT task_labels.label_id AS id,
                           (SELECT name FROM team_labels WHERE id = task_labels.label_id),
                           (SELECT color_code FROM team_labels WHERE id = task_labels.label_id)
                    FROM task_labels
                    WHERE task_id = t.id) r) AS labels,
             (SELECT is_completed(status_id, project_id)) AS is_complete,
             (SELECT name FROM users WHERE id = t.reporter_id) AS reporter,
             (SELECT id FROM task_priorities WHERE id = t.priority_id) AS priority,
             (SELECT value FROM task_priorities WHERE id = t.priority_id) AS priority_value,
             total_minutes,
             (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id) AS total_minutes_spent,
             created_at,
             updated_at,
             completed_at,
             start_date,
             billable,
             schedule_id,
             END_DATE ${customColumnsQuery} ${statusesQuery}
      FROM tasks t
      WHERE ${filters} ${searchQuery}
      ORDER BY ${sortFields}
    `;
  }

  public static async getGroups(
    groupBy: string,
    projectId: string
  ): Promise<ITaskGroup[]> {
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
  public static async getList(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    console.log(
      `[PERFORMANCE] getList method called for project ${req.params.id} - THIS METHOD IS DEPRECATED, USE getTasksV3 INSTEAD`
    );

    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    if (req.query.refresh_progress === "true" && req.params.id) {
      console.log(
        `[PERFORMANCE] Starting progress refresh for project ${req.params.id} (getList)`
      );
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
      console.log(
        `[PERFORMANCE] Progress refresh completed in ${(
          progressEndTime - progressStartTime
        ).toFixed(2)}ms`
      );
    }

    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;

    // Add customColumns flag to query params
    req.query.customColumns = "true";

    const q = TasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks
      ? [req.params.id || null, req.query.parent_task]
      : [req.params.id || null];

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    const groups = await this.getGroups(groupBy, req.params.id);
    const map = groups.reduce((g: { [x: string]: ITaskGroup }, group) => {
      if (group.id) g[group.id] = new TaskListGroup(group);
      return g;
    }, {});

    await this.updateMapByGroup(tasks, groupBy, map);

    const updatedGroups = Object.keys(map).map((key) => {
      const group = map[key];

      TasksControllerV2.updateTaskProgresses(group);

      // if (groupBy === GroupBy.PHASE)
      //   group.color_code = group.color_code + TASK_PRIORITY_COLOR_ALPHA;

      return {
        id: key,
        ...group,
      };
    });

    const endTime = performance.now();
    const totalTime = endTime - startTime;
    console.log(
      `[PERFORMANCE] getList method completed in ${totalTime.toFixed(
        2
      )}ms for project ${req.params.id} with ${tasks.length} tasks`
    );

    // Log warning if this deprecated method is taking too long
    if (totalTime > 1000) {
      console.warn(
        `[PERFORMANCE WARNING] DEPRECATED getList method taking ${totalTime.toFixed(
          2
        )}ms - Frontend should use getTasksV3 instead!`
      );
    }

    return res.status(200).send(new ServerResponse(true, updatedGroups));
  }

  public static async updateMapByGroup(
    tasks: any[],
    groupBy: string,
    map: { [p: string]: ITaskGroup }
  ) {
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
        color_code_dark: "#fbc84c69",
        tasks: unmapped,
      };
    }
  }

  public static updateTaskProgresses(group: ITaskGroup) {
    const todoCount = group.tasks.filter(
      (t) => t.status_category?.is_todo
    ).length;
    const doingCount = group.tasks.filter(
      (t) => t.status_category?.is_doing
    ).length;
    const doneCount = group.tasks.filter(
      (t) => t.status_category?.is_done
    ).length;

    const total = group.tasks.length;

    group.todo_progress = +this.calculateTaskCompleteRatio(todoCount, total);
    group.doing_progress = +this.calculateTaskCompleteRatio(doingCount, total);
    group.done_progress = +this.calculateTaskCompleteRatio(doneCount, total);
  }

  @HandleExceptions()
  public static async getTasksOnly(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    console.log(
      `[PERFORMANCE] getTasksOnly method called for project ${req.params.id} - Consider using getTasksV3 for better performance`
    );

    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    if (req.query.refresh_progress === "true" && req.params.id) {
      console.log(
        `[PERFORMANCE] Starting progress refresh for project ${req.params.id} (getTasksOnly)`
      );
      const progressStartTime = performance.now();
      await this.refreshProjectTaskProgressValues(req.params.id);
      const progressEndTime = performance.now();
      console.log(
        `[PERFORMANCE] Progress refresh completed in ${(
          progressEndTime - progressStartTime
        ).toFixed(2)}ms`
      );
    }

    const isSubTasks = !!req.query.parent_task;

    // Add customColumns flag to query params
    req.query.customColumns = "true";

    const q = TasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks
      ? [req.params.id || null, req.query.parent_task]
      : [req.params.id || null];
    const result = await db.query(q, params);

    let data: any[] = [];

    // if true, we only return the record count
    if (this.isCountsOnly(req.query)) {
      [data] = result.rows;
    } else {
      // else we return a flat list of tasks
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
    console.log(
      `[PERFORMANCE] getTasksOnly method completed in ${totalTime.toFixed(
        2
      )}ms for project ${req.params.id} with ${data.length} tasks`
    );

    // Log warning if this method is taking too long
    if (totalTime > 1000) {
      console.warn(
        `[PERFORMANCE WARNING] getTasksOnly method taking ${totalTime.toFixed(
          2
        )}ms - Consider using getTasksV3 for better performance!`
      );
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async convertToTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE tasks
      SET parent_task_id = NULL,
          sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0)
      WHERE id = $1;
    `;
    await db.query(q, [req.body.id, req.body.project_id]);

    const result = await db.query("SELECT get_single_task($1) AS task;", [
      req.body.id,
    ]);
    const [data] = result.rows;
    const model = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, model));
  }

  @HandleExceptions()
  public static async getNewKanbanTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const result = await db.query("SELECT get_single_task($1) AS task;", [id]);
    const [data] = result.rows;
    const task = TasksControllerV2.updateTaskViewModel(data.task);
    return res.status(200).send(new ServerResponse(true, task));
  }

  @HandleExceptions()
  public static async resetParentTaskManualProgress(
    parentTaskId: string
  ): Promise<void> {
    try {
      // Check if this task has subtasks
      const subTasksResult = await db.query(
        "SELECT COUNT(*) as subtask_count FROM tasks WHERE parent_task_id = $1 AND archived IS FALSE",
        [parentTaskId]
      );

      const subtaskCount = parseInt(
        subTasksResult.rows[0]?.subtask_count || "0"
      );

      // If it has subtasks, reset the manual_progress flag to false
      if (subtaskCount > 0) {
        await db.query(
          "UPDATE tasks SET manual_progress = false WHERE id = $1",
          [parentTaskId]
        );
        console.log(
          `Reset manual progress for parent task ${parentTaskId} with ${subtaskCount} subtasks`
        );

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
          console.log(
            `Recalculated progress for parent task ${parentTaskId}: ${progressRatio}%`
          );
        }
      }
    } catch (error) {
      log_error(`Error resetting parent task manual progress: ${error}`);
    }
  }

  @HandleExceptions()
  public static async convertToSubtask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
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
      await db.query(
        `
        UPDATE tasks
        SET parent_task_id = $3,
            sort_order     = COALESCE((SELECT MAX(sort_order) + 1 FROM tasks WHERE project_id = $2), 0)
        WHERE id = $1;
      `,
        [req.body.id, req.body.project_id, req.body.parent_task_id]
      );
      q = `SELECT handle_on_task_phase_change($1, $2);`;
    }

    if (req.body.to_group_id === UNMAPPED) req.body.to_group_id = null;

    const params =
      groupType === "phase"
        ? [req.body.id, req.body.to_group_id]
        : [
            req.body.id,
            req.body.project_id,
            req.body.parent_task_id,
            req.body.to_group_id,
          ];
    await db.query(q, params);

    // Reset the parent task's manual progress when converting a task to a subtask
    if (req.body.parent_task_id) {
      await this.resetParentTaskManualProgress(req.body.parent_task_id);
    }

    const result = await db.query("SELECT get_single_task($1) AS task;", [
      req.body.id,
    ]);
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

    for (const member of result.rows) member.color_code = getColor(member.name);

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

    for (const member of result.rows) member.color_code = getColor(member.name);

    return this.createTagList(result.rows);
  }

  public static async checkUserAssignedToTask(
    taskId: string,
    userId: string,
    teamId: string
  ) {
    const q = `
    SELECT EXISTS(
        SELECT * FROM tasks_assignees WHERE task_id = $1 AND team_member_id = (SELECT team_member_id FROM team_member_info_view WHERE user_id = $2 AND team_id = $3)
    );
    `;
    const result = await db.query(q, [taskId, userId, teamId]);
    const [data] = result.rows;

    return data.exists;
  }

  public static async getTasksByName(
    searchString: string,
    projectId: string,
    taskId: string
  ) {
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
  public static async getSubscribers(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const subscribers = await this.getTaskSubscribers(req.params.id);
    return res.status(200).send(new ServerResponse(true, subscribers));
  }

  @HandleExceptions()
  public static async searchTasks(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { projectId, taskId, searchQuery } = req.query;
    const tasks = await this.getTasksByName(
      searchQuery as string,
      projectId as string,
      taskId as string
    );
    return res.status(200).send(new ServerResponse(true, tasks));
  }

  @HandleExceptions()
  public static async getTaskDependencyStatus(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { statusId, taskId } = req.query;
    const canContinue = await TasksControllerV2.checkForCompletedDependencies(
      taskId as string,
      statusId as string
    );
    return res
      .status(200)
      .send(new ServerResponse(true, { can_continue: canContinue }));
  }

  @HandleExceptions()
  public static async checkForCompletedDependencies(
    taskId: string,
    nextStatusId: string
  ): Promise<IWorkLenzResponse> {
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
  public static async assignLabelsToTask(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const { id } = req.params;
    const { labels }: { labels: string[] } = req.body;

    labels.forEach(async (label: string) => {
      const q = `SELECT add_or_remove_task_label($1, $2) AS labels;`;
      await db.query(q, [id, label]);
    });
    return res
      .status(200)
      .send(new ServerResponse(true, null, "Labels assigned successfully"));
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
      return res
        .status(400)
        .send(new ServerResponse(false, "Missing required parameters"));
    }

    // Get column information
    const columnQuery = `
      SELECT id, field_type
      FROM cc_custom_columns
      WHERE project_id = $1 AND key = $2
    `;
    const columnResult = await db.query(columnQuery, [project_id, column_key]);

    if (columnResult.rowCount === 0) {
      return res
        .status(404)
        .send(new ServerResponse(false, "Custom column not found"));
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
    const existingValueResult = await db.query(existingValueQuery, [
      taskId,
      columnId,
    ]);

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
        columnId,
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
        jsonValue,
      ]);
    }

    return res.status(200).send(
      new ServerResponse(true, {
        task_id: taskId,
        column_key,
        value,
      })
    );
  }

  public static async refreshProjectTaskProgressValues(
    projectId: string
  ): Promise<void> {
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
      console.log(
        `Finished refreshing progress values for project ${projectId}`
      );
    } catch (error) {
      log_error("Error refreshing project task progress values", error);
    }
  }

  public static async updateTaskProgress(taskId: string): Promise<void> {
    try {
      // Calculate the task's progress using get_task_complete_ratio
      const result = await db.query(
        "SELECT get_task_complete_ratio($1) AS info;",
        [taskId]
      );
      const [data] = result.rows;

      if (data && data.info && data.info.ratio !== undefined) {
        const progressValue = +(data.info.ratio || 0).toFixed();

        // Update the task's progress_value in the database
        await db.query("UPDATE tasks SET progress_value = $1 WHERE id = $2", [
          progressValue,
          taskId,
        ]);

        console.log(`Updated progress for task ${taskId} to ${progressValue}%`);

        // If this task has a parent, update the parent's progress as well
        const parentResult = await db.query(
          "SELECT parent_task_id FROM tasks WHERE id = $1",
          [taskId]
        );

        if (
          parentResult.rows.length > 0 &&
          parentResult.rows[0].parent_task_id
        ) {
          await this.updateTaskProgress(parentResult.rows[0].parent_task_id);
        }
      }
    } catch (error) {
      log_error(`Error updating task progress: ${error}`);
    }
  }

  // Add this method to update progress when a task's weight is changed
  public static async updateTaskWeight(
    taskId: string,
    weight: number
  ): Promise<void> {
    try {
      // Update the task's weight
      await db.query("UPDATE tasks SET weight = $1 WHERE id = $2", [
        weight,
        taskId,
      ]);

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
  public static async getTasksV3(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const startTime = performance.now();
    const isSubTasks = !!req.query.parent_task;
    const groupBy = (req.query.group || GroupBy.STATUS) as string;

    // PERFORMANCE OPTIMIZATION: Skip expensive progress calculation by default
    // Progress values are already calculated and stored in the database
    // Only refresh if explicitly requested via refresh_progress=true query parameter
    // This dramatically improves initial load performance (from ~2-5s to ~200-500ms)
    const shouldRefreshProgress = req.query.refresh_progress === "true";

    if (shouldRefreshProgress && req.params.id) {
      await this.refreshProjectTaskProgressValues(req.params.id);
    }

    const q = TasksControllerV2.getQuery(req.user?.id as string, req.query);
    const params = isSubTasks
      ? [req.params.id || null, req.query.parent_task]
      : [req.params.id || null];

    const result = await db.query(q, params);
    const tasks = [...result.rows];

    // Get groups metadata dynamically from database
    const groups = await this.getGroups(groupBy, req.params.id);

    // Create priority value to name mapping
    const priorityMap: Record<string, string> = {
      "0": "low",
      "1": "medium",
      "2": "high",
    };

    // Create status category mapping based on actual status names from database
    const statusCategoryMap: Record<string, string> = {};
    for (const group of groups) {
      if (groupBy === GroupBy.STATUS && group.id) {
        // Use the actual status name from database, convert to lowercase for consistency
        statusCategoryMap[group.id] = group.name
          .toLowerCase()
          .replace(/\s+/g, "_");
      }
    }

    // Transform tasks with all necessary data preprocessing
    const transformedTasks = tasks.map((task, index) => {
      // Update task with calculated values (lightweight version)
      TasksControllerV2.updateTaskViewModel(task);
      task.index = index;

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
            return hours + minutes / 60;
          }
        }
        return 0;
      };

      return {
        id: task.id,
        task_key: task.task_key || "",
        title: task.name || "",
        description: task.description || "",
        // Use dynamic status mapping from database
        status: statusCategoryMap[task.status] || task.status,
        // Pre-processed priority using mapping
        priority: priorityMap[task.priority_value?.toString()] || "medium",
        // Use actual phase name from database
        phase: task.phase_name || "Development",
        progress:
          typeof task.complete_ratio === "number" ? task.complete_ratio : 0,
        assignees: task.assignees?.map((a: any) => a.team_member_id) || [],
        assignee_names: task.assignee_names || task.names || [],
        labels:
          task.labels?.map((l: any) => ({
            id: l.id || l.label_id,
            name: l.name,
            color: l.color_code || "#1890ff",
            end: l.end,
            names: l.names,
          })) || [],
        dueDate: task.end_date || task.END_DATE,
        startDate: task.start_date,
        timeTracking: {
          estimated: convertTimeValue(task.total_time),
          logged: convertTimeValue(task.time_spent),
        },
        customFields: {},
        custom_column_values: task.custom_column_values || {}, // Include custom column values
        createdAt: task.created_at || new Date().toISOString(),
        updatedAt: task.updated_at || new Date().toISOString(),
        order: TasksControllerV2.getTaskSortOrder(task, groupBy),
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
        reporter: task.reporter || null,
      };
    });
    const groupedResponse: Record<string, any> = {};

    // Initialize groups from database data
    groups.forEach((group) => {
      const groupKey =
        groupBy === GroupBy.STATUS
          ? group.name.toLowerCase().replace(/\s+/g, "_")
          : groupBy === GroupBy.PRIORITY
          ? priorityMap[(group as any).value?.toString()] ||
            group.name.toLowerCase()
          : group.name.toLowerCase().replace(/\s+/g, "_");

      groupedResponse[groupKey] = {
        id: group.id,
        title: group.name,
        groupType: groupBy,
        groupValue: groupKey,
        collapsed: false,
        tasks: [],
        taskIds: [],
        color: group.color_code || this.getDefaultGroupColor(groupBy, groupKey),
        color_code_dark:
          group.color_code_dark || this.getDefaultGroupColor(groupBy, groupKey),
        // Include additional metadata from database
        category_id: group.category_id,
        start_date: group.start_date,
        end_date: group.end_date,
        sort_index: (group as any).sort_index,
      };
    });

    // Distribute tasks into groups
    const unmappedTasks: any[] = [];

    transformedTasks.forEach((task) => {
      let groupKey: string;
      let taskAssigned = false;

      if (groupBy === GroupBy.STATUS) {
        groupKey = task.status;
        if (groupedResponse[groupKey]) {
          groupedResponse[groupKey].tasks.push(task);
          groupedResponse[groupKey].taskIds.push(task.id);
          taskAssigned = true;
        }
      } else if (groupBy === GroupBy.PRIORITY) {
        groupKey = task.priority;
        if (groupedResponse[groupKey]) {
          groupedResponse[groupKey].tasks.push(task);
          groupedResponse[groupKey].taskIds.push(task.id);
          taskAssigned = true;
        }
      } else if (groupBy === GroupBy.PHASE) {
        // For phase grouping, check if task has a valid phase
        if (task.phase && task.phase.trim() !== "") {
          groupKey = task.phase.toLowerCase().replace(/\s+/g, "_");
          if (groupedResponse[groupKey]) {
            groupedResponse[groupKey].tasks.push(task);
            groupedResponse[groupKey].taskIds.push(task.id);
            taskAssigned = true;
          }
        }
        // If task doesn't have a valid phase, add to unmapped
        if (!taskAssigned) {
          unmappedTasks.push(task);
        }
      }
    });

    // Calculate progress stats for priority and phase grouping
    if (groupBy === GroupBy.PRIORITY || groupBy === GroupBy.PHASE) {
      Object.values(groupedResponse).forEach((group: any) => {
        if (group.tasks && group.tasks.length > 0) {
          const todoCount = group.tasks.filter((task: any) => {
            // For tasks, we need to check their original status category
            const originalTask = tasks.find((t) => t.id === task.id);
            return originalTask?.status_category?.is_todo;
          }).length;

          const doingCount = group.tasks.filter((task: any) => {
            const originalTask = tasks.find((t) => t.id === task.id);
            return originalTask?.status_category?.is_doing;
          }).length;

          const doneCount = group.tasks.filter((task: any) => {
            const originalTask = tasks.find((t) => t.id === task.id);
            return originalTask?.status_category?.is_done;
          }).length;

          const total = group.tasks.length;

          // Calculate progress percentages
          group.todo_progress =
            total > 0 ? +((todoCount / total) * 100).toFixed(0) : 0;
          group.doing_progress =
            total > 0 ? +((doingCount / total) * 100).toFixed(0) : 0;
          group.done_progress =
            total > 0 ? +((doneCount / total) * 100).toFixed(0) : 0;
        }
        group.todo_progress = 0;
        group.doing_progress = 0;
        group.done_progress = 0;
      });
    }

    // Create unmapped group if there are tasks without proper phase assignment
    if (unmappedTasks.length > 0 && groupBy === GroupBy.PHASE) {
      const unmappedGroup = {
        id: UNMAPPED,
        title: UNMAPPED,
        groupType: groupBy,
        groupValue: UNMAPPED.toLowerCase(),
        collapsed: false,
        tasks: unmappedTasks,
        taskIds: unmappedTasks.map((task) => task.id),
        color: "#fbc84c69", // Orange color with transparency
        category_id: null,
        start_date: null,
        end_date: null,
        sort_index: 999, // Put unmapped group at the end
        todo_progress: 0,
        doing_progress: 0,
        done_progress: 0,
      };

      // Calculate progress stats for unmapped group
      if (unmappedTasks.length > 0) {
        const todoCount = unmappedTasks.filter((task: any) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          return originalTask?.status_category?.is_todo;
        }).length;

        const doingCount = unmappedTasks.filter((task: any) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          return originalTask?.status_category?.is_doing;
        }).length;

        const doneCount = unmappedTasks.filter((task: any) => {
          const originalTask = tasks.find((t) => t.id === task.id);
          return originalTask?.status_category?.is_done;
        }).length;

        const total = unmappedTasks.length;

        unmappedGroup.todo_progress =
          total > 0 ? +((todoCount / total) * 100).toFixed(0) : 0;
        unmappedGroup.doing_progress =
          total > 0 ? +((doingCount / total) * 100).toFixed(0) : 0;
        unmappedGroup.done_progress =
          total > 0 ? +((doneCount / total) * 100).toFixed(0) : 0;
      }

      groupedResponse[UNMAPPED.toLowerCase()] = unmappedGroup;
    }

    // Sort tasks within each group by order
    Object.values(groupedResponse).forEach((group: any) => {
      group.tasks.sort((a: any, b: any) => a.order - b.order);
    });

    // Convert to array format expected by frontend, maintaining database order
    const responseGroups = groups
      .map((group) => {
        const groupKey =
          groupBy === GroupBy.STATUS
            ? group.name.toLowerCase().replace(/\s+/g, "_")
            : groupBy === GroupBy.PRIORITY
            ? priorityMap[(group as any).value?.toString()] ||
              group.name.toLowerCase()
            : group.name.toLowerCase().replace(/\s+/g, "_");

        return groupedResponse[groupKey];
      })
      .filter(
        (group) =>
          group &&
          (group.tasks.length > 0 || req.query.include_empty === "true")
      );

    // Add unmapped group to the end if it exists
    if (groupedResponse[UNMAPPED.toLowerCase()]) {
      responseGroups.push(groupedResponse[UNMAPPED.toLowerCase()]);
    }

    const endTime = performance.now();
    const totalTime = endTime - startTime;

    // Log warning if request is taking too long
    if (totalTime > 1000) {
      console.warn(
        `[PERFORMANCE WARNING] Slow request detected: ${totalTime.toFixed(
          2
        )}ms for project ${req.params.id} with ${transformedTasks.length} tasks`
      );
    }

    return res.status(200).send(
      new ServerResponse(true, {
        groups: responseGroups,
        allTasks: transformedTasks,
        grouping: groupBy,
        totalTasks: transformedTasks.length,
      })
    );
  }

  private static getTaskSortOrder(task: any, groupBy: string): number {
    switch (groupBy) {
      case GroupBy.STATUS:
        return typeof task.status_sort_order === "number"
          ? task.status_sort_order
          : 0;
      case GroupBy.PRIORITY:
        return typeof task.priority_sort_order === "number"
          ? task.priority_sort_order
          : 0;
      case GroupBy.PHASE:
        return typeof task.phase_sort_order === "number"
          ? task.phase_sort_order
          : 0;
      default:
        return typeof task.sort_order === "number" ? task.sort_order : 0;
    }
  }

  private static getDefaultGroupColor(
    groupBy: string,
    groupValue: string
  ): string {
    const colorMaps: Record<string, Record<string, string>> = {
      [GroupBy.STATUS]: {
        todo: "#f0f0f0",
        doing: "#1890ff",
        done: "#52c41a",
      },
      [GroupBy.PRIORITY]: {
        high: "#ff7a45",
        medium: "#faad14",
        low: "#52c41a",
      },
      [GroupBy.PHASE]: {
        unmapped: "#fbc84c69",
      },
    };

    return colorMaps[groupBy]?.[groupValue] || "#d9d9d9";
  }

  @HandleExceptions()
  public static async refreshTaskProgress(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    try {
      const startTime = performance.now();

      if (req.params.id) {
        console.log(
          `[PERFORMANCE] Starting background progress refresh for project ${req.params.id}`
        );
        await this.refreshProjectTaskProgressValues(req.params.id);

        const endTime = performance.now();
        const totalTime = endTime - startTime;
        console.log(
          `[PERFORMANCE] Background progress refresh completed in ${totalTime.toFixed(
            2
          )}ms for project ${req.params.id}`
        );

        return res.status(200).send(
          new ServerResponse(true, {
            message: "Task progress values refreshed successfully",
            performanceMetrics: {
              refreshTime: Math.round(totalTime),
              projectId: req.params.id,
            },
          })
        );
      }
      return res
        .status(400)
        .send(new ServerResponse(false, null, "Project ID is required"));
    } catch (error) {
      console.error("Error refreshing task progress:", error);
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to refresh task progress")
        );
    }
  }

  // Optimized method for getting task progress without blocking main UI
  @HandleExceptions()
  public static async getTaskProgressStatus(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    try {
      if (!req.params.id) {
        return res
          .status(400)
          .send(new ServerResponse(false, null, "Project ID is required"));
      }

      // Get basic progress stats without expensive calculations
      const result = await db.query(
        `
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
      `,
        [req.params.id]
      );

      const [stats] = result.rows;

      return res.status(200).send(
        new ServerResponse(true, {
          projectId: req.params.id,
          totalTasks: parseInt(stats.total_tasks) || 0,
          completedTasks: parseInt(stats.completed_tasks) || 0,
          avgProgress: parseFloat(stats.avg_progress) || 0,
          lastUpdated: stats.last_updated,
          completionPercentage:
            stats.total_tasks > 0
              ? Math.round(
                  (parseInt(stats.completed_tasks) /
                    parseInt(stats.total_tasks)) *
                    100
                )
              : 0,
        })
      );
    } catch (error) {
      console.error("Error getting task progress status:", error);
      return res
        .status(500)
        .send(
          new ServerResponse(false, null, "Failed to get task progress status")
        );
    }
  }
}
