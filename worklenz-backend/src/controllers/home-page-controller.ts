import momentTime from "moment-timezone";
import db from "../config/db";
import HandleExceptions from "../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";
import { ServerResponse } from "../models/server-response";
import WorklenzControllerBase from "./worklenz-controller-base";
import { SocketEvents } from "../socket.io/events";
import { IO } from "../shared/io";
import { getColor } from "../shared/utils";
import SqlHelper from "../shared/sql-helpers";
import { DEFAULT_PAGE_SIZE } from "../shared/constants";
import { buildTaskFilterClauses, buildTaskOrderClause, buildTabClause } from "../shared/home-task-query-builder";

export default class HomePageController extends WorklenzControllerBase {

  private static readonly GROUP_BY_ASSIGNED_TO_ME = "0";
  private static readonly GROUP_BY_ASSIGN_BY_ME = "1";
  private static readonly GROUP_BY_ALL = "2";
  private static readonly ALL_TAB = "All";
  private static readonly TODAY_TAB = "Today";
  private static readonly UPCOMING_TAB = "Upcoming";
  private static readonly OVERDUE_TAB = "Overdue";
  private static readonly NO_DUE_DATE_TAB = "NoDueDate";
  private static readonly UPCOMING_NOW_ON_TAB = "UpcomingNowOn";
  // Ceiling on the My Tasks filter dropdowns (projects/statuses/assignees) —
  // these are DISTINCT scans over the caller's full task set with no natural
  // bound otherwise.
  private static readonly FILTER_OPTIONS_LIMIT = 500;

  // Positional param convention shared by getTasks/getUnassignedTasks and
  // everything they call: $1 team, $2 user, $3 time_zone, filters/pagination
  // from $4 onward. Keeping time_zone as its own fixed slot (rather than one
  // more entry in the filter `values` array) lets getTaskSelectColumns,
  // buildTaskFilterClauses's overdue_only, and buildTabClause all reference
  // the same $N regardless of which/how-many other filters are active.
  private static readonly TZ_PARAM_INDEX = 3;
  private static readonly BASE_PARAM_OFFSET = 3;

  private static isValidGroup(groupBy: string) {
    return groupBy === this.GROUP_BY_ASSIGNED_TO_ME
      || groupBy === this.GROUP_BY_ASSIGN_BY_ME
      || groupBy === this.GROUP_BY_ALL;
  }

  private static isValidView(currentView: string) {
    return currentView === this.ALL_TAB
      || currentView === this.TODAY_TAB
      || currentView === this.UPCOMING_TAB
      || currentView === this.OVERDUE_TAB
      || currentView === this.NO_DUE_DATE_TAB
      || currentView === this.UPCOMING_NOW_ON_TAB;
  }

  @HandleExceptions()
  public static async createPersonalTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `INSERT INTO personal_todo_list (name, color_code, user_id, index)
               VALUES ($1, $2, $3, ((SELECT index FROM personal_todo_list ORDER BY index DESC LIMIT 1) + 1))
               RETURNING id, name`;
    const result = await db.query(q, [req.body.name, req.body.color_code, req.user?.id]);
    const [data] = result.rows;

    // Emit socket event for real-time update (including to the creator's own other
    // open tabs — same self-echo pattern useHomeDashboardSocketSync.ts already relies
    // on for other task-mutation events).
    const socketId = req.user?.socket_id;
    if (socketId) {
      IO.getSocketById(socketId)?.emit(SocketEvents.PERSONAL_TASK_CREATED.toString(), data);
    }

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static getTasksByGroupClosure(groupBy: string) {
    switch (groupBy) {
      // tasks_assignees has no team_id column — team scoping for this branch
      // comes from the caller's own `p.team_id = $1` predicate instead.
      case this.GROUP_BY_ASSIGN_BY_ME:
        return `AND t.id IN (
                    SELECT task_id
                    FROM tasks_assignees
                    WHERE assigned_by = $2)`;

      // "All" = tasks assigned to me OR tasks I assigned to someone else.
      case this.GROUP_BY_ALL:
        return `AND (t.id IN (
                        SELECT task_id
                        FROM tasks_assignees
                        WHERE team_member_id = (SELECT id FROM team_members WHERE user_id = $2 AND team_id = $1))
                  OR t.id IN (
                        SELECT task_id
                        FROM tasks_assignees
                        WHERE assigned_by = $2))`;

      case this.GROUP_BY_ASSIGNED_TO_ME:
      default:
        return `AND t.id IN (
                    SELECT task_id
                    FROM tasks_assignees
                    WHERE team_member_id = (SELECT id FROM team_members WHERE user_id = $2 AND team_id = $1))`;
    }
  }

  // Tab predicate ($1 team, $2 user, $3 time_zone, filters from $4 — see
  // getTasks/getUnassignedTasks) delegated to buildTabClause so the task
  // list and its counts query share one tz-aware definition of each tab.
  private static getTasksByTabClosure(text: string, tzParamIndex: number) {
    return buildTabClause(text, tzParamIndex);
  }

  // Shared SELECT column list for "my tasks"-shaped rows, reused by both the
  // assignee-scoped query (getTasksResult) and the unassigned-tasks query
  // (getUnassignedTasksResult) below so their response shape stays identical.
  // Relies on the joins from getTaskJoins() being present in the FROM clause.
  // `tzParamIndex` is the positional param ($N) the caller has bound the
  // caller's time_zone to, used for is_overdue's "today" comparison.
  private static getTaskSelectColumns(tzParamIndex: number): string {
    return `t.id,
             t.name,
             CONCAT(p.key, '-', t.task_no) AS task_key,
             t.project_id,
             t.parent_task_id,
             t.parent_task_id IS NOT NULL AS is_sub_task,
             parent_t.name AS parent_task_name,
             t.status_id,
             t.start_date,
             t.end_date,
             t.created_at,
             p.team_id,
             p.name AS project_name,
             p.color_code AS project_color,
             ts.name AS status,
             stc.color_code AS status_color,
             (CASE
                WHEN stc.id IS NULL THEN '{}'::JSON
                ELSE JSON_BUILD_OBJECT('is_done', stc.is_done, 'is_doing', stc.is_doing, 'is_todo', stc.is_todo)
              END) AS status_category,
             (t.end_date IS NOT NULL
               AND (t.end_date AT TIME ZONE $${tzParamIndex})::DATE < (NOW() AT TIME ZONE $${tzParamIndex})::DATE
               AND NOT is_completed(t.status_id, t.project_id)) AS is_overdue,
             t.priority_id,
             tp.name AS priority_name,
             tp.color_code AS priority_color,
             tp.color_code_dark AS priority_color_dark,
             TRUE AS is_task,
             FALSE AS done,
             t.updated_at,
             (SELECT COUNT('*')::INT FROM tasks WHERE parent_task_id = t.id) AS sub_tasks_count,
             (SELECT get_task_assignees(t.id)) AS assignees,
             ps.project_statuses`;
  }

  // Joins backing getTaskSelectColumns() — appended to the FROM clause
  // wherever that column list is used. Replaces what used to be a handful of
  // correlated scalar subqueries per row (status/priority/status-category
  // looked up 3x each, project_statuses recomputed identically for every
  // task in the same project) with single indexed joins computed once.
  // The project_statuses join is LATERAL and correlated on t.project_id so
  // Postgres computes it once per task row scoped to that task's own
  // project — a plain GROUP BY subquery here can't be scoped by the join
  // condition and would aggregate every project's statuses on every request.
  private static getTaskJoins(): string {
    return `LEFT JOIN tasks parent_t ON parent_t.id = t.parent_task_id
             LEFT JOIN task_statuses ts ON ts.id = t.status_id
             LEFT JOIN sys_task_status_categories stc ON stc.id = ts.category_id
             LEFT JOIN task_priorities tp ON tp.id = t.priority_id
             LEFT JOIN LATERAL (
               SELECT ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(x))) AS project_statuses
               FROM (
                 SELECT s.id, s.name, cat.color_code
                 FROM task_statuses s
                 LEFT JOIN sys_task_status_categories cat ON cat.id = s.category_id
                 WHERE s.project_id = t.project_id
               ) x
             ) ps ON TRUE`;
  }

  private static async getTasksResult(
    groupByClosure: string,
    currentTabClosure: string,
    params: unknown[],
    tzParamIndex: number,
    extraFilterClause = "",
    orderClause = "ORDER BY t.end_date ASC, t.id ASC",
    limitClause = ""
  ): Promise<{ end_date?: string }[]> {
    const q = `
      SELECT ${this.getTaskSelectColumns(tzParamIndex)}
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
             ${this.getTaskJoins()}
      WHERE t.archived IS FALSE
        AND p.team_id = $1
        AND t.status_id NOT IN (SELECT id
                                FROM task_statuses
                                WHERE category_id NOT IN (SELECT id
                                                          FROM sys_task_status_categories
                                                          WHERE is_done IS FALSE))
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        ${groupByClosure}
        ${currentTabClosure}
        ${extraFilterClause}
      ${orderClause}
      ${limitClause}`;

    const result = await db.query(q, params);
    this.stampAssigneeColors(result.rows);
    return result.rows;
  }

  // Unassigned tasks aren't scoped by "current user is an assignee" at all
  // (by definition they have no assignees), so this can't reuse
  // getTasksByGroupClosure — it needs its own team-scoped, membership-aware
  // WHERE clause instead.
  // "Unassigned" = tasks the current user created (reporter_id) that nobody
  // has been assigned to yet — not just any unassigned task they can see.
  private static readonly UNASSIGNED_TASKS_BASE_WHERE = `
        t.archived IS FALSE
        AND p.team_id = $1
        AND t.reporter_id = $2
        AND t.status_id NOT IN (SELECT id
                                FROM task_statuses
                                WHERE category_id NOT IN (SELECT id
                                                          FROM sys_task_status_categories
                                                          WHERE is_done IS FALSE))
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        AND NOT EXISTS(SELECT 1 FROM tasks_assignees WHERE task_id = t.id)`;

  private static async getUnassignedTasksResult(
    teamId: string,
    userId: string,
    timeZone: string,
    filterClause: string,
    orderClause: string,
    limitClause: string,
    extraParams: unknown[]
  ): Promise<{ end_date?: string }[]> {
    const q = `
      SELECT ${this.getTaskSelectColumns(this.TZ_PARAM_INDEX)}
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
             ${this.getTaskJoins()}
      WHERE ${this.UNASSIGNED_TASKS_BASE_WHERE}
        ${filterClause}
      ${orderClause}
      ${limitClause}`;

    const result = await db.query(q, [teamId, userId, timeZone, ...extraParams]);
    this.stampAssigneeColors(result.rows);
    return result.rows;
  }

  // Same bucket shape as getCountsResult, scoped to the unassigned-tasks
  // WHERE instead of a group_by closure, so the My Tasks stat cards can read
  // from the same {total, today, overdue, in_progress, ...} shape regardless
  // of which side-view is active — no more approximating from one page.
  private static async getUnassignedTasksCounts(teamId: string, userId: string, timeZone: string, filterClause: string, extraParams: unknown[]) {
    const q = `
      SELECT COUNT(*) AS total,
             COUNT(CASE WHEN (t.end_date AT TIME ZONE $3)::DATE = (NOW() AT TIME ZONE $3)::DATE THEN 1 END) AS today,
             COUNT(CASE WHEN (t.end_date AT TIME ZONE $3)::DATE > (NOW() AT TIME ZONE $3)::DATE THEN 1 END) AS upcoming,
             COUNT(CASE WHEN (t.end_date AT TIME ZONE $3)::DATE < (NOW() AT TIME ZONE $3)::DATE AND NOT is_completed(t.status_id, t.project_id) THEN 1 END) AS overdue,
             COUNT(CASE WHEN t.end_date IS NULL THEN 1 END) AS no_due_date,
             COUNT(CASE WHEN is_doing(t.status_id, t.project_id) THEN 1 END) AS in_progress
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
             LEFT JOIN task_statuses ts ON ts.id = t.status_id
      WHERE ${this.UNASSIGNED_TASKS_BASE_WHERE}
        ${filterClause}`;

    const result = await db.query(q, [teamId, userId, timeZone, ...extraParams]);
    const [row] = result.rows;
    return row;
  }

  @HandleExceptions()
  public static async getUnassignedTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id as string;
    const userId = req.user?.id as string;
    const timeZone = (req.query.time_zone as string) || "UTC";

    const values: unknown[] = [];
    const filterClause = buildTaskFilterClauses(req.query, values, this.BASE_PARAM_OFFSET, this.TZ_PARAM_INDEX);
    const orderClause = buildTaskOrderClause(req.query);

    const size = Math.max(1, +(req.query.size as string) || DEFAULT_PAGE_SIZE);
    const index = Math.max(1, +(req.query.index as string) || 1);
    const offset = (index - 1) * size;
    const { clause: limitClause, params: limitParams } = SqlHelper.buildPaginationClause(size, offset, values.length + this.BASE_PARAM_OFFSET + 1);

    const [tasks, counts] = await Promise.all([
      this.getUnassignedTasksResult(teamId, userId, timeZone, filterClause, orderClause, limitClause, [...values, ...limitParams]),
      this.getUnassignedTasksCounts(teamId, userId, timeZone, filterClause, values),
    ]);

    res.set("Cache-Control", "no-store");
    return res.status(200).send(new ServerResponse(true, {
      tasks,
      total: counts.total,
      today: counts.today,
      upcoming: counts.upcoming,
      overdue: counts.overdue,
      no_due_date: counts.no_due_date,
      in_progress: counts.in_progress,
    }));
  }

  // Lightweight lookup endpoint for the My Tasks filter dropdowns. Scoped
  // identically to the main list query (group_by + team/user + not-done-status
  // + not-archived) but explicitly excludes the status/priority/project/
  // assignee/search filters themselves, so picking one filter doesn't shrink
  // the options available for the others.
  @HandleExceptions()
  public static async getTaskFilterOptions(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id as string;
    const userId = req.user?.id as string;

    const currentGroup = this.isValidGroup(req.query.group_by as string) ? req.query.group_by : this.GROUP_BY_ASSIGNED_TO_ME;
    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);

    const baseWhere = `
      t.archived IS FALSE
      AND p.team_id = $1
      AND t.status_id NOT IN (SELECT id
                              FROM task_statuses
                              WHERE category_id NOT IN (SELECT id
                                                        FROM sys_task_status_categories
                                                        WHERE is_done IS FALSE))
      AND NOT EXISTS(SELECT project_id
                     FROM archived_projects
                     WHERE project_id = p.id
                       AND user_id = $2)
      ${groupByClosure}`;

    const params = [teamId, userId];

    const projectsQuery = `
      SELECT DISTINCT p.id AS project_id, p.name AS project_name
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
      WHERE ${baseWhere}
      ORDER BY p.name
      LIMIT ${this.FILTER_OPTIONS_LIMIT}`;

    const statusesQuery = `
      SELECT MIN(ts.name) AS name
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
             JOIN task_statuses ts ON ts.id = t.status_id
      WHERE ${baseWhere}
      GROUP BY LOWER(ts.name)
      ORDER BY MIN(ts.name)
      LIMIT ${this.FILTER_OPTIONS_LIMIT}`;

    const assigneesQuery = `
      SELECT DISTINCT tmi.team_member_id, tmi.name
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
             JOIN tasks_assignees ta ON ta.task_id = t.id
             JOIN team_member_info_view tmi ON tmi.team_member_id = ta.team_member_id
      WHERE ${baseWhere}
      ORDER BY tmi.name
      LIMIT ${this.FILTER_OPTIONS_LIMIT}`;

    const [projectsResult, statusesResult, assigneesResult] = await Promise.all([
      db.query(projectsQuery, params),
      db.query(statusesQuery, params),
      db.query(assigneesQuery, params),
    ]);

    res.set("Cache-Control", "no-store");
    return res.status(200).send(new ServerResponse(true, {
      projects: projectsResult.rows,
      statuses: statusesResult.rows,
      assignees: assigneesResult.rows,
    }));
  }

  private static stampAssigneeColors(tasks: { assignees?: { name?: string; color_code?: string }[] }[]) {
    for (const task of tasks) {
      if (Array.isArray(task.assignees)) {
        for (const assignee of task.assignees) {
          assignee.color_code = getColor(assignee.name);
        }
      }
    }
  }

  @HandleExceptions()
  public static async getMyProgress(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const timeZone = (req.query.time_zone as string) || "UTC";

    const currentGroup = this.isValidGroup(req.query.group_by as string) ? req.query.group_by : this.GROUP_BY_ASSIGNED_TO_ME;
    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);

    // Same status-category method the reporting module uses for its project
    // task-progress stats (is_todo/is_doing/is_completed SQL functions), but
    // — unlike the previous version of this endpoint — date bucketing is
    // done in JS below, the same way getTaskStats does it. tasks.end_date is
    // TIMESTAMPTZ; comparing it server-side via `t.end_date::DATE = $n::DATE`
    // truncates using the DATABASE session's timezone, not the caller's, so
    // it could bucket a task into the wrong day (and disagree with the stat
    // cards) for any user not in that timezone.
    const q = `
      SELECT t.end_date,
             is_todo(t.status_id, t.project_id) AS is_todo,
             is_doing(t.status_id, t.project_id) AS is_doing,
             is_completed(t.status_id, t.project_id) AS is_completed
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
      WHERE t.archived IS FALSE
        AND p.team_id = $1
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        ${groupByClosure}`;

    const result = await db.query(q, [teamId, userId]);

    const nowInTz = momentTime.tz(timeZone);
    const today = nowInTz.format("YYYY-MM-DD");
    const weekStart = nowInTz.clone().startOf("week").format("YYYY-MM-DD");
    const weekEnd = nowInTz.clone().endOf("week").format("YYYY-MM-DD");

    const todayBucket = { total: 0, todo: 0, doing: 0, done: 0 };
    const weekBucket = { total: 0, todo: 0, doing: 0, done: 0 };

    for (const task of result.rows) {
      if (!task.end_date) continue;
      const taskDate = momentTime.tz(task.end_date, timeZone).format("YYYY-MM-DD");
      const isToday = taskDate === today;
      const isThisWeek = taskDate >= weekStart && taskDate <= weekEnd;
      if (!isToday && !isThisWeek) continue;

      const bucket = task.is_todo ? "todo" : task.is_doing ? "doing" : task.is_completed ? "done" : null;

      if (isToday) {
        todayBucket.total++;
        if (bucket) todayBucket[bucket as "todo" | "doing" | "done"]++;
      }
      if (isThisWeek) {
        weekBucket.total++;
        if (bucket) weekBucket[bucket as "todo" | "doing" | "done"]++;
      }
    }

    const data = { today: todayBucket, week: weekBucket };
    res.set("Cache-Control", "no-store");

    return res.status(200).send(new ServerResponse(true, data));
  }

  // Lightweight companion to getTasksResult for callers (getTaskStats) that
  // only need to date-bucket in JS, not render a task list — skips
  // getTaskJoins()/getTaskSelectColumns() entirely so a team's full open-task
  // set isn't paid for (assignees, project_statuses aggregation, parent task
  // name, etc.) just to look at end_date. Mirrors getMyProgress's minimal
  // query shape immediately below.
  private static async getOpenTaskDatesResult(groupByClosure: string, params: unknown[]): Promise<{ end_date?: string }[]> {
    const q = `
      SELECT t.end_date
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
      WHERE t.archived IS FALSE
        AND p.team_id = $1
        AND t.status_id NOT IN (SELECT id
                                FROM task_statuses
                                WHERE category_id NOT IN (SELECT id
                                                          FROM sys_task_status_categories
                                                          WHERE is_done IS FALSE))
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        ${groupByClosure}`;

    const result = await db.query(q, params);
    return result.rows;
  }

  private static async getCompletedTasksResult(groupByClosure: string, params: unknown[]) {
    const q = `
      SELECT t.id, t.completed_at
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
      WHERE t.archived IS FALSE
        AND p.team_id = $1
        AND t.completed_at IS NOT NULL
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        ${groupByClosure}`;

    const result = await db.query(q, params);
    return result.rows;
  }

  @HandleExceptions()
  public static async getTaskStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const timeZone = (req.query.time_zone as string) || "UTC";
    const today = new Date();

    const currentGroup = this.isValidGroup(req.query.group_by as string) ? req.query.group_by : this.GROUP_BY_ASSIGNED_TO_ME;
    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);
    const params = [teamId, userId];

    const [openTasks, completedTasks] = await Promise.all([
      this.getOpenTaskDatesResult(groupByClosure, params),
      this.getCompletedTasksResult(groupByClosure, params),
    ]);

    const formatToday = momentTime(today).format("YYYY-MM-DD");
    const startOfWeek = momentTime.tz(today, timeZone).startOf("week").format("YYYY-MM-DD");
    const endOfWeek = momentTime.tz(today, timeZone).endOf("week").format("YYYY-MM-DD");

    let todayCount = 0;
    let weekCount = 0;
    let overdueCount = 0;

    for (const task of openTasks) {
      if (!task.end_date) continue;
      const taskEndDate = momentTime.tz(task.end_date, timeZone).format("YYYY-MM-DD");
      if (momentTime(taskEndDate).isSame(formatToday)) todayCount++;
      if (momentTime(taskEndDate).isSameOrAfter(startOfWeek) && momentTime(taskEndDate).isSameOrBefore(endOfWeek)) weekCount++;
      if (momentTime(taskEndDate).isBefore(formatToday)) overdueCount++;
    }

    let completedToday = 0;
    let completedWeek = 0;

    for (const task of completedTasks) {
      if (!task.completed_at) continue;
      const completedDate = momentTime.tz(task.completed_at, timeZone).format("YYYY-MM-DD");
      if (momentTime(completedDate).isSame(formatToday)) completedToday++;
      if (momentTime(completedDate).isSameOrAfter(startOfWeek) && momentTime(completedDate).isSameOrBefore(endOfWeek)) completedWeek++;
    }

    const data = {
      today: todayCount,
      week: weekCount,
      overdue: overdueCount,
      completed_today: completedToday,
      completed_week: completedWeek,
    };
    res.set("Cache-Control", "no-store");

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async getCountsResult(
    groupByClosure: string,
    teamId: string,
    userId: string,
    timeZone: string,
    filterClause = "",
    filterParams: unknown[] = [],
    tabClosure = ""
  ) {
    const q = `SELECT COUNT(*) AS total,
                      COUNT(CASE WHEN (t.end_date AT TIME ZONE $3)::DATE = (NOW() AT TIME ZONE $3)::DATE THEN 1 END) AS today,
                      COUNT(CASE WHEN (t.end_date AT TIME ZONE $3)::DATE > (NOW() AT TIME ZONE $3)::DATE THEN 1 END) AS upcoming,
                      COUNT(CASE WHEN (t.end_date AT TIME ZONE $3)::DATE < (NOW() AT TIME ZONE $3)::DATE AND NOT is_completed(t.status_id, t.project_id) THEN 1 END) AS overdue,
                      COUNT(CASE WHEN t.end_date::DATE IS NULL THEN 1 END) AS no_due_date,
                      COUNT(CASE WHEN is_doing(t.status_id, t.project_id) THEN 1 END) AS in_progress
               FROM tasks t
                      JOIN projects p ON t.project_id = p.id
                      LEFT JOIN task_statuses ts ON ts.id = t.status_id
               WHERE t.archived IS FALSE
                 AND p.team_id = $1
                 AND t.status_id NOT IN (SELECT id
                                         FROM task_statuses
                                         WHERE category_id NOT IN (SELECT id
                                                                   FROM sys_task_status_categories
                                                                   WHERE is_done IS FALSE))
                 AND NOT EXISTS(SELECT project_id
                                FROM archived_projects
                                WHERE project_id = p.id
                                  AND user_id = $2)
                 ${groupByClosure}
                 ${tabClosure}
                 ${filterClause}`;

    const result = await db.query(q, [teamId, userId, timeZone, ...filterParams]);
    const [row] = result.rows;
    return row;
  }

  @HandleExceptions()
  public static async getTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id as string;
    const userId = req.user?.id as string;
    const timeZone = (req.query.time_zone as string) || "UTC";
    const today = new Date();

    const currentGroup = this.isValidGroup(req.query.group_by as string) ? req.query.group_by : this.GROUP_BY_ASSIGNED_TO_ME;
    const currentTab = this.isValidView(req.query.current_tab as string) ? req.query.current_tab : this.ALL_TAB;

    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);

    const isCalendarView = req.query.is_calendar_view;

    if (isCalendarView == "true") {
      const selectedDate = req.query.selected_date as string;
      const calendarClosure = `AND t.end_date::DATE = $3::DATE`;
      const params = [teamId, userId, selectedDate, timeZone];
      const result = await this.getTasksResult(groupByClosure, calendarClosure, params, 4);
      const counts = await this.getCountsResult(groupByClosure, teamId, userId, timeZone);

      res.set("Cache-Control", "no-store");
      return res.status(200).send(new ServerResponse(true, {
        tasks: result,
        total: counts.total,
        today: counts.today,
        upcoming: counts.upcoming,
        overdue: counts.overdue,
        no_due_date: counts.no_due_date,
        in_progress: counts.in_progress,
      }));
    }

    // Server-side pagination/filtering (HomeMyTasksView) — signalled by the
    // presence of index/size. Additive: callers that don't send these
    // (TasksList.tsx, HomeContinueCard.tsx) fall through to the legacy path
    // below and see byte-for-byte the same response as before.
    const usesServerPagination = req.query.index !== undefined || req.query.size !== undefined;

    if (usesServerPagination) {
      // Activates getTasksByTabClosure (previously dead code — the legacy
      // path below does this filtering in JS via groupByDate instead) so
      // TasksList.tsx's All/Today/Overdue/Upcoming/NoDueDate tabs keep
      // working once it's switched onto this branch.
      const currentTabClosure = this.getTasksByTabClosure(currentTab as string, this.TZ_PARAM_INDEX);

      // `values` holds only the filter clause's own params — teamId/userId/
      // timeZone are NOT in it (they're prepended separately below), matching
      // the same convention getUnassignedTasksResult/-Counts already use.
      // Seeding this array with the base params up front (as an earlier
      // version of this code did) double-counts them inside
      // buildTaskFilterClauses's nextParam(), producing wrong $N references
      // that collide with the LIMIT/OFFSET placeholders below.
      const values: unknown[] = [];
      const filterClause = buildTaskFilterClauses(req.query, values, this.BASE_PARAM_OFFSET, this.TZ_PARAM_INDEX);
      const orderClause = buildTaskOrderClause(req.query);

      const size = Math.max(1, +(req.query.size as string) || DEFAULT_PAGE_SIZE);
      const index = Math.max(1, +(req.query.index as string) || 1);
      const offset = (index - 1) * size;
      const { clause: limitClause, params: limitParams } = SqlHelper.buildPaginationClause(size, offset, values.length + this.BASE_PARAM_OFFSET + 1);

      const [tasks, counts] = await Promise.all([
        this.getTasksResult(groupByClosure, currentTabClosure, [teamId, userId, timeZone, ...values, ...limitParams], this.TZ_PARAM_INDEX, filterClause, orderClause, limitClause),
        this.getCountsResult(groupByClosure, teamId, userId, timeZone, filterClause, values, currentTabClosure),
      ]);

      res.set("Cache-Control", "no-store");
      return res.status(200).send(new ServerResponse(true, {
        tasks,
        total: counts.total,
        today: counts.today,
        upcoming: counts.upcoming,
        overdue: counts.overdue,
        no_due_date: counts.no_due_date,
        in_progress: counts.in_progress,
      }));
    }

    // Legacy path — unchanged response shape/values for TasksList.tsx and
    // HomeContinueCard.tsx, just computed via SQL counts instead of a JS
    // pass over the full fetched array.
    const params = [teamId, userId, timeZone];
    const result = await this.getTasksResult(groupByClosure, "", params, 3);
    const groupedResult = await this.groupByDate(currentTab as string, result, timeZone, today);
    const counts = await this.getCountsResult(groupByClosure, teamId, userId, timeZone);

    const data = {
      tasks: groupedResult,
      total: counts.total,
      today: counts.today,
      upcoming: counts.upcoming,
      overdue: counts.overdue,
      no_due_date: counts.no_due_date,
      in_progress: counts.in_progress,
    };
    res.set("Cache-Control", "no-store");

    return res.status(200).send(new ServerResponse(true, data));
  }

  private static async groupByDate(currentTab: string, tasks: { end_date?: string }[], timeZone: string, today: Date) {
    const formatToday = momentTime(today).format("YYYY-MM-DD");

    const tasksReturn = [];

    if (currentTab === this.ALL_TAB) {
      for (const task of tasks) {
        tasksReturn.push(task);
      }
    }

    if (currentTab === this.NO_DUE_DATE_TAB) {
      for (const task of tasks) {
        if (!task.end_date) {
          tasksReturn.push(task);
        }
      }
    }

    if (currentTab === this.TODAY_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (momentTime(taskEndDate).isSame(formatToday)) {
            tasksReturn.push(task);
          }
        }
      }
    }

    if (currentTab === this.UPCOMING_NOW_ON_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (momentTime(taskEndDate).isSameOrAfter(formatToday)) {
            tasksReturn.push(task);
          }
        }
      }
    }

    if (currentTab === this.UPCOMING_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (momentTime(taskEndDate).isAfter(formatToday)) {
            tasksReturn.push(task);
          }
        }
      }
    }

    if (currentTab === this.OVERDUE_TAB) {
      for (const task of tasks) {
        if (task.end_date) {
          const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
          if (momentTime(taskEndDate).isBefore(formatToday)) {
            tasksReturn.push(task);
          }
        }
      }
    }

    return tasksReturn;
  }

  private static async groupBySingleDate(tasks: { end_date?: string }[], timeZone: string, selectedDate: string) {
    const formatSelectedDate = momentTime(selectedDate).format("YYYY-MM-DD");

    const tasksReturn = [];

    for (const task of tasks) {
      if (task.end_date) {
        const taskEndDate = momentTime.tz(task.end_date, `${timeZone}`).format("YYYY-MM-DD");
        if (momentTime(taskEndDate).isSame(formatSelectedDate)) {
          tasksReturn.push(task);
        }
      }
    }

    return tasksReturn;

  }

  @HandleExceptions()
  public static async getTaskCountsByMonth(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const month = req.query.month as string; // Format: YYYY-MM
    const currentGroup = this.isValidGroup(req.query.group_by as string)
      ? req.query.group_by
      : this.GROUP_BY_ASSIGNED_TO_ME;

    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);

    // Get first and last day of month
    const startDate = `${month}-01`;
    const endDate = momentTime(startDate).endOf("month").format("YYYY-MM-DD");

    const q = `
      SELECT t.end_date::DATE as date, COUNT(*)::INT as count
      FROM tasks t
      JOIN projects p ON t.project_id = p.id
      WHERE t.archived IS FALSE
        AND p.team_id = $1
        AND t.end_date IS NOT NULL
        AND t.end_date::DATE >= $3::DATE
        AND t.end_date::DATE <= $4::DATE
        AND t.status_id NOT IN (
          SELECT id FROM task_statuses
          WHERE category_id NOT IN (
            SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE
          )
        )
        AND NOT EXISTS(
          SELECT project_id FROM archived_projects
          WHERE project_id = p.id AND user_id = $2
        )
        ${groupByClosure}
      GROUP BY t.end_date::DATE
      ORDER BY t.end_date::DATE
    `;

    const result = await db.query(q, [teamId, userId, startDate, endDate]);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getTasksByDateRange(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    const startDate = req.query.start_date as string;
    const endDate = req.query.end_date as string;

    const currentGroup = this.isValidGroup(req.query.group_by as string)
      ? req.query.group_by
      : this.GROUP_BY_ASSIGNED_TO_ME;

    const groupByClosure = this.getTasksByGroupClosure(currentGroup as string);

    const q = `
      SELECT t.id,
             t.name,
             t.project_id,
             t.status_id,
             t.end_date,
             p.name AS project_name,
             p.color_code AS project_color,
             p.client_id,
             (SELECT name FROM clients WHERE id = p.client_id) AS client_name,
             t.priority_id,
             (SELECT name FROM task_priorities WHERE id = t.priority_id) AS priority_name,
             (SELECT color_code FROM task_priorities WHERE id = t.priority_id) AS priority_color,
             (SELECT name FROM task_statuses WHERE id = t.status_id) AS status_name,
             (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id)) AS status_color,
             is_todo(t.status_id, t.project_id) AS is_todo,
             is_doing(t.status_id, t.project_id) AS is_doing,
             is_completed(t.status_id, t.project_id) AS is_completed,
             (SELECT get_task_assignees(t.id)) AS assignees
      FROM tasks t
             JOIN projects p ON t.project_id = p.id
      WHERE t.archived IS FALSE
        AND p.team_id = $1
        AND t.end_date IS NOT NULL
        AND t.end_date::DATE >= $3::DATE
        AND t.end_date::DATE <= $4::DATE
        AND NOT EXISTS(SELECT project_id
                       FROM archived_projects
                       WHERE project_id = p.id
                         AND user_id = $2)
        ${groupByClosure}
      ORDER BY t.end_date ASC`;

    const result = await db.query(q, [teamId, userId, startDate, endDate]);
    this.stampAssigneeColors(result.rows);
    res.set("Cache-Control", "no-store");
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getPersonalTasks(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const user_id = req.user?.id;
    const { filter = "all", year, startDate, endDate } = req.query;

    const conditions: string[] = [`user_id = $1`];
    const params: unknown[] = [user_id];
    let paramCount = 1;

    const range = (column: string) => {
      const s = ++paramCount;
      const e = ++paramCount;
      params.push(startDate, endDate);
      return `(${column} >= $${s}::TIMESTAMP AND ${column} < $${e}::TIMESTAMP)`;
    };

    if (startDate && endDate) {
      const cr = range("created_at");
      const ur = range("updated_at");
      conditions.push(`(${cr} OR (done = TRUE AND ${ur}))`);
    } else if (filter === "today") {
      conditions.push(`(created_at::DATE = CURRENT_DATE OR (done = TRUE AND updated_at::DATE = CURRENT_DATE))`);
    } else if (filter === "week") {
      const cr = range("created_at");
      const ur = range("updated_at");
      conditions.push(`(${cr} OR (done = TRUE AND ${ur}))`);
    } else if (filter === "month") {
      const cr = range("created_at");
      const ur = range("updated_at");
      conditions.push(`(${cr} OR (done = TRUE AND ${ur}))`);
    } else if (filter === "year") {
      const yearParam = year || new Date().getFullYear().toString();
      conditions.push(`(EXTRACT(YEAR FROM created_at) = $${++paramCount} OR (done = TRUE AND EXTRACT(YEAR FROM updated_at) = $${paramCount}))`);
      params.push(yearParam);
    }

    const whereClause = conditions.join(" AND ");
    const orderBy = (filter === "all") ? "updated_at DESC" : "created_at DESC";

    // LIMIT is a defensive backstop, not a real pagination boundary — the
    // date-bounded filters (today/week/month/year) are naturally self-
    // limiting for realistic usage; this just protects the unbounded
    // "all"/default branch from ever returning a user's entire history.
    const q = `SELECT id, name, created_at, FALSE AS is_task, done, updated_at
               FROM personal_todo_list
               WHERE ${whereClause}
               ORDER BY ${orderBy}
               LIMIT 500`;

    const results = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, results.rows));
  }

  @HandleExceptions()
  public static async getProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const team_id = req.user?.team_id;
    const user_id = req.user?.id;

    const current_view = req.query.view;

    const isFavorites = current_view === "1" ? ` AND EXISTS(SELECT user_id FROM favorite_projects WHERE user_id = $2 AND project_id = projects.id)` : "";
    const isArchived = req.query.filter === "2"
      ? ` AND EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = projects.id)`
      : ` AND NOT EXISTS(SELECT user_id FROM archived_projects WHERE user_id = $2 AND project_id = projects.id)`;

    // Optional — absent means today's exact unbounded behavior. The only
    // live caller (HomeContinueCard's "Projects" tab) only ever displays 12
    // rows, so it passes limit=12 instead of fetching every team project
    // just to discard the rest client-side.
    const params: unknown[] = [team_id, user_id];
    let limitClause = "";
    if (req.query.limit !== undefined) {
      const limit = Math.max(1, Math.min(200, +(req.query.limit as string) || 12));
      params.push(limit);
      limitClause = `LIMIT $${params.length}`;
    }

    const q = `SELECT id,
                      name,
                      EXISTS(SELECT user_id
                             FROM favorite_projects
                             WHERE user_id = $2
                               AND project_id = projects.id) AS favorite,
                      EXISTS(SELECT user_id
                             FROM archived_projects
                             WHERE user_id = $2
                               AND project_id = projects.id) AS archived,
                      color_code,
                      (SELECT COUNT(*)
                       FROM tasks
                       WHERE archived IS FALSE
                         AND project_id = projects.id) AS all_tasks_count,
                      (SELECT COUNT(*)
                       FROM tasks
                       WHERE archived IS FALSE
                         AND project_id = projects.id
                         AND status_id IN (SELECT id
                                           FROM task_statuses
                                           WHERE project_id = projects.id
                                             AND category_id IN
                                                 (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
                      (SELECT COUNT(*)
                       FROM project_members
                       WHERE project_id = projects.id) AS members_count,
                      (SELECT get_project_members(projects.id)) AS names,
                      (SELECT CASE
                                WHEN ((SELECT MAX(updated_at)
                                       FROM tasks
                                       WHERE archived IS FALSE
                                         AND project_id = projects.id) >
                                      updated_at)
                                  THEN (SELECT MAX(updated_at)
                                        FROM tasks
                                        WHERE archived IS FALSE
                                          AND project_id = projects.id)
                                ELSE updated_at END) AS updated_at
               FROM projects
               WHERE team_id = $1 ${isArchived} ${isFavorites} AND is_member_of_project(projects.id , $2
                   , $1)
               ORDER BY updated_at DESC
               ${limitClause}`;

    const result = await db.query(q, params);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async getProjectsByTeam(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const team_id = req.user?.team_id;
    const user_id = req.user?.id;
    const queryParams = [team_id, user_id];
    // Owners/admins see every team project, matching the access rule used by
    // the main projects list; regular members only see projects they belong to.
    let filterByMember = "";
    if (!req.user?.owner && !req.user?.is_admin) {
      filterByMember = " AND is_member_of_project(projects.id, $2, $1) ";
    }
    const q = `
      SELECT id, name, color_code
      FROM projects
      WHERE team_id = $1
        AND NOT EXISTS (SELECT 1 FROM archived_projects
                        WHERE archived_projects.project_id = projects.id
                          AND archived_projects.user_id = $2)
        ${filterByMember}
    `;
    const result = await db.query(q, queryParams);
    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  @HandleExceptions()
  public static async updatePersonalTask(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const q = `
      UPDATE personal_todo_list
      SET done = TRUE,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id, done, updated_at
    `;
    const result = await db.query(q, [req.body.id]);
    const [data] = result.rows;

    // Emit socket event for real-time update — see createPersonalTask above.
    const socketId = req.user?.socket_id;
    if (socketId) {
      IO.getSocketById(socketId)?.emit(SocketEvents.PERSONAL_TASK_UPDATED.toString(), data);
    }

    return res.status(200).send(new ServerResponse(true, data));
  }
}
