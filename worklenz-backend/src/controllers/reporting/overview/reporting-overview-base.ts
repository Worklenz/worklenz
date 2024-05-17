import db from "../../../config/db";
import { ITasksByDue, ITasksByPriority, ITasksByStatus } from "../interfaces";
import ReportingControllerBase from "../reporting-controller-base";
import {
  DATE_RANGES,
  TASK_DUE_COMPLETED_COLOR,
  TASK_DUE_NO_DUE_COLOR,
  TASK_DUE_OVERDUE_COLOR,
  TASK_DUE_UPCOMING_COLOR,
  TASK_PRIORITY_HIGH_COLOR,
  TASK_PRIORITY_LOW_COLOR,
  TASK_PRIORITY_MEDIUM_COLOR,
  TASK_STATUS_DOING_COLOR,
  TASK_STATUS_DONE_COLOR,
  TASK_STATUS_TODO_COLOR
} from "../../../shared/constants";
import { formatDuration, int } from "../../../shared/utils";
import moment from "moment";

export interface IChartObject {
  name: string,
  color: string,
  y: number
}

export default class ReportingOverviewBase extends ReportingControllerBase {

  private static createChartObject(name: string, color: string, y: number) {
    return {
      name,
      color,
      y
    };
  }

  protected static async getTeamsCounts(teamId: string | null, archivedQuery = "") {

    const q = `
      SELECT JSON_BUILD_OBJECT(
               'teams', (SELECT COUNT(*) FROM teams WHERE in_organization(id, $1)),
               'projects',
               (SELECT COUNT(*) FROM projects WHERE in_organization(team_id, $1) ${archivedQuery}),
               'team_members', (SELECT COUNT(DISTINCT email)
                                FROM team_member_info_view
                                WHERE in_organization(team_id, $1))
               ) AS counts;
    `;

    const res = await db.query(q, [teamId]);
    const [data] = res.rows;

    return {
      count: int(data?.counts.teams),
      projects: int(data?.counts.projects),
      members: int(data?.counts.team_members),
    };
  }

  protected static async getProjectsCounts(teamId: string | null, archivedQuery = "") {
    const q = `
      SELECT JSON_BUILD_OBJECT(
               'active_projects', (SELECT COUNT(*)
                                   FROM projects
                                   WHERE in_organization(team_id, $1) AND (end_date > CURRENT_TIMESTAMP
                                      OR end_date IS NULL) ${archivedQuery}),
               'overdue_projects', (SELECT COUNT(*)
                                    FROM projects
                                    WHERE in_organization(team_id, $1)
                                      AND end_date < CURRENT_TIMESTAMP
                                      AND status_id NOT IN
                                          (SELECT id FROM sys_project_statuses WHERE name = 'Completed') ${archivedQuery})
               ) AS counts;
    `;

    const res = await db.query(q, [teamId]);
    const [data] = res.rows;

    return {
      count: 0,
      active: int(data?.counts.active_projects),
      overdue: int(data?.counts.overdue_projects),
    };
  }

  protected static async getMemberCounts(teamId: string | null) {
    const q = `
      SELECT JSON_BUILD_OBJECT(
               'unassigned', (SELECT COUNT(*)
                              FROM team_members
                              WHERE in_organization(team_id, $1)
                                AND id NOT IN (SELECT team_member_id FROM tasks_assignees)),
               'with_overdue', (SELECT COUNT(*)
                                FROM team_members
                                WHERE in_organization(team_id, $1)
                                  AND id IN (SELECT team_member_id
                                             FROM tasks_assignees
                                             WHERE is_overdue(task_id) IS TRUE))
               ) AS counts;
    `;

    const res = await db.query(q, [teamId]);
    const [data] = res.rows;

    return {
      count: 0,
      unassigned: int(data?.counts.unassigned),
      overdue: int(data?.counts.with_overdue),
    };
  }

  protected static async getProjectStats(projectId: string | null) {
    const q = `
      SELECT JSON_BUILD_OBJECT(
               'completed', (SELECT COUNT(*)
                             FROM tasks
                             WHERE project_id = $1
                               AND is_completed(tasks.status_id, tasks.project_id) IS TRUE),
               'incompleted', (SELECT COUNT(*)
                               FROM tasks
                               WHERE project_id = $1
                                 AND is_completed(tasks.status_id, tasks.project_id) IS FALSE),
               'overdue', (SELECT COUNT(*)
                           FROM tasks
                           WHERE project_id = $1
                             AND is_overdue(tasks.id)),
               'total_allocated', (SELECT SUM(total_minutes)
                                   FROM tasks
                                   WHERE project_id = $1),
               'total_logged', (SELECT SUM((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id))
                                FROM tasks
                                WHERE project_id = $1)
               ) AS counts;
    `;

    const res = await db.query(q, [projectId]);
    const [data] = res.rows;

    return {
      completed: int(data?.counts.completed),
      incompleted: int(data?.counts.incompleted),
      overdue: int(data?.counts.overdue),
      total_allocated: moment.duration(int(data?.counts.total_allocated), "minutes").asHours().toFixed(0),
      total_logged: moment.duration(int(data?.counts.total_logged), "seconds").asHours().toFixed(0),
    };
  }

  protected static async getTasksByStatus(projectId: string | null): Promise<ITasksByStatus> {
    const q = `
      SELECT JSON_BUILD_OBJECT(
               'all', (SELECT COUNT(*)
                       FROM tasks
                       WHERE project_id = $1),
               'todo', (SELECT COUNT(*)
                        FROM tasks
                        WHERE project_id = $1
                          AND is_todo(tasks.status_id, tasks.project_id) IS TRUE),
               'doing', (SELECT COUNT(*)
                         FROM tasks
                         WHERE project_id = $1
                           AND is_doing(tasks.status_id, tasks.project_id) IS TRUE),
               'done', (SELECT COUNT(*)
                        FROM tasks
                        WHERE project_id = $1
                          AND is_completed(tasks.status_id, tasks.project_id) IS TRUE)
               ) AS counts;
    `;

    const res = await db.query(q, [projectId]);
    const [data] = res.rows;

    const all = int(data?.counts.all);
    const todo = int(data?.counts.todo);
    const doing = int(data?.counts.doing);
    const done = int(data?.counts.done);

    const chart: IChartObject[] = [];

    return {
      all,
      todo,
      doing,
      done,
      chart
    };
  }

  protected static async getTasksByPriority(projectId: string | null): Promise<ITasksByPriority> {
    const q = `
      SELECT JSON_BUILD_OBJECT(
               'low', (SELECT COUNT(*)
                       FROM tasks
                       WHERE project_id = $1
                         AND priority_id = (SELECT id FROM task_priorities WHERE value = 0)),
               'medium', (SELECT COUNT(*)
                          FROM tasks
                          WHERE project_id = $1
                            AND priority_id = (SELECT id FROM task_priorities WHERE value = 1)),
               'high', (SELECT COUNT(*)
                        FROM tasks
                        WHERE project_id = $1
                          AND priority_id = (SELECT id FROM task_priorities WHERE value = 2))
               ) AS counts;
    `;

    const res = await db.query(q, [projectId]);
    const [data] = res.rows;

    const low = int(data?.counts.low);
    const medium = int(data?.counts.medium);
    const high = int(data?.counts.high);

    const chart: IChartObject[] = [];

    return {
      all: 0,
      low,
      medium,
      high,
      chart
    };
  }

  protected static async getTaskCountsByDue(projectId: string | null): Promise<ITasksByDue> {
    const q = `
      SELECT JSON_BUILD_OBJECT(
               'no_due', (SELECT COUNT(*)
                          FROM tasks
                          WHERE project_id = $1
                            AND end_date IS NULL),
               'upcoming', (SELECT COUNT(*)
                            FROM tasks
                            WHERE project_id = $1
                              AND end_date > CURRENT_TIMESTAMP)
               ) AS counts;
    `;

    const res = await db.query(q, [projectId]);
    const [data] = res.rows;

    const chart: IChartObject[] = [];

    return {
      all: 0,
      completed: 0,
      upcoming: int(data?.counts.upcoming),
      overdue: 0,
      no_due: int(data?.counts.no_due),
      chart
    };
  }

  protected static createByStatusChartData(body: ITasksByStatus) {
    body.chart = [
      this.createChartObject("Todo", TASK_STATUS_TODO_COLOR, body.todo),
      this.createChartObject("Doing", TASK_STATUS_DOING_COLOR, body.doing),
      this.createChartObject("Done", TASK_STATUS_DONE_COLOR, body.done),
    ];
  }

  protected static createByPriorityChartData(body: ITasksByPriority) {
    body.chart = [
      this.createChartObject("Low", TASK_PRIORITY_LOW_COLOR, body.low),
      this.createChartObject("Medium", TASK_PRIORITY_MEDIUM_COLOR, body.medium),
      this.createChartObject("High", TASK_PRIORITY_HIGH_COLOR, body.high),
    ];
  }

  protected static createByDueDateChartData(body: ITasksByDue) {
    body.chart = [
      this.createChartObject("Completed", TASK_DUE_COMPLETED_COLOR, body.completed),
      this.createChartObject("Upcoming", TASK_DUE_UPCOMING_COLOR, body.upcoming),
      this.createChartObject("Overdue", TASK_DUE_OVERDUE_COLOR, body.overdue),
      this.createChartObject("No due date", TASK_DUE_NO_DUE_COLOR, body.no_due),
    ];
  }

  // Team Member Overview

  protected static async getProjectCountOfTeamMember(teamMemberId: string | null, includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND pm.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = pm.project_id AND archived_projects.user_id = '${userId}')`;


    const q = `
      SELECT COUNT(*)
      FROM project_members pm
      WHERE team_member_id = $1 ${archivedClause};
    `;
    const result = await db.query(q, [teamMemberId]);
    const [data] = result.rows;
    return int(data.count);
  }

  protected static async getTeamCountOfTeamMember(teamMemberId: string | null) {
    const q = `
      SELECT COUNT(*)
      FROM team_members
      WHERE id = $1;
    `;
    const result = await db.query(q, [teamMemberId]);
    const [data] = result.rows;
    return int(data.count);
  }

  protected static memberTasksDurationFilter(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `AND t.end_date::DATE >= '${start}'::DATE AND t.end_date::DATE <= '${end}'::DATE`;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE`;
    if (key === DATE_RANGES.LAST_WEEK)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_MONTH)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_QUARTER)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;

    return "";

  }

  protected static activityLogDurationFilter(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      return `
      AND (is_doing(
          (SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' AND tl.created_at::DATE <= '${end}'::DATE ORDER BY tl.created_at DESC LIMIT 1
          )::UUID, t.project_id)
        OR is_todo(
          (SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' AND tl.created_at::DATE <= '${end}'::DATE ORDER BY tl.created_at DESC LIMIT 1
          )::UUID, t.project_id)
        OR is_completed_between(t.id::UUID, '${start}'::DATE, '${end}'::DATE))`;
    }
    return `AND (is_doing(
      (SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' AND tl.created_at::DATE <= NOW()::DATE ORDER BY tl.created_at DESC LIMIT 1
      )::UUID, t.project_id)
    OR is_todo(
      (SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' AND tl.created_at::DATE <= NOW()::DATE ORDER BY tl.created_at DESC LIMIT 1
      )::UUID, t.project_id)
    OR is_completed(t.status_id::UUID, t.project_id::UUID))`;
  }

  protected static memberAssignDurationFilter(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return `AND ta.updated_at::DATE = '${start}'::DATE`;
      }

      return `AND ta.updated_at::DATE >= '${start}'::DATE AND ta.updated_at::DATE <= '${end}'::DATE`;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE`;
    if (key === DATE_RANGES.LAST_WEEK)
      return `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_MONTH)
      return `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_QUARTER)
      return `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;

    return "";
  }

  protected static completedDurationFilter(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return `AND t.completed_at::DATE = '${start}'::DATE`;
      }

      return `AND t.completed_at::DATE >= '${start}'::DATE AND t.completed_at::DATE <= '${end}'::DATE`;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE`;
    if (key === DATE_RANGES.LAST_WEEK)
      return `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_MONTH)
      return `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_QUARTER)
      return `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;

    return "";
  }

  protected static overdueTasksByDate(key: string, dateRange: string[], archivedClause: string) {
    if (dateRange.length === 2) {
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `(SELECT COUNT(CASE WHEN is_overdue_for_date(t.id, '${end}'::DATE) IS TRUE THEN 1 END)
              FROM tasks t
                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
              WHERE ta.team_member_id = $1 ${archivedClause})`;
    }

    return `(SELECT COUNT(CASE WHEN is_overdue_for_date(t.id, NOW()::DATE) IS TRUE THEN 1 END)
              FROM tasks t
                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
              WHERE ta.team_member_id = $1 ${archivedClause})`;

  }


  protected static overdueTasksDurationFilter(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `AND t.end_date::DATE >= '${start}'::DATE AND t.end_date::DATE <= '${end}'::DATE`;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND t.end_date::DATE < NOW()::DATE`;
    if (key === DATE_RANGES.LAST_WEEK)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND t.end_date::DATE < NOW()::DATE`;
    if (key === DATE_RANGES.LAST_MONTH)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND t.end_date::DATE < NOW()::DATE`;
    if (key === DATE_RANGES.LAST_QUARTER)
      return `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND t.end_date::DATE < NOW()::DATE`;
    if (key === DATE_RANGES.ALL_TIME)
      return `AND t.end_date::DATE < NOW()::DATE`;

    return "";
  }

  protected static taskWorklogDurationFilter(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `AND created_at::DATE >= '${start}'::DATE AND created_at::DATE <= '${end}'::DATE`;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return `AND created_at::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND created_at::DATE < CURRENT_DATE::DATE`;
    if (key === DATE_RANGES.LAST_WEEK)
      return `AND created_at::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND created_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_MONTH)
      return `AND created_at::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND created_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;
    if (key === DATE_RANGES.LAST_QUARTER)
      return `AND created_at::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND created_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`;

    return "";
  }

  protected static async getTeamMemberStats(teamMemberId: string | null, includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;

    const q = `SELECT JSON_BUILD_OBJECT(

                    'total_tasks', (SELECT COUNT(ta.task_id)
                                    FROM tasks t
                                            LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                    WHERE ta.team_member_id = $1 ${archivedClause}),

                    'completed', (SELECT COUNT(CASE WHEN is_completed(t.status_id, t.project_id) IS TRUE THEN 1 END)
                                  FROM tasks t
                                          LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  WHERE ta.team_member_id = $1 ${archivedClause}),

                    'ongoing', (SELECT COUNT(CASE WHEN is_doing(t.status_id, t.project_id) IS TRUE THEN 1 END)
                                FROM tasks t
                                        LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                WHERE ta.team_member_id = $1 ${archivedClause}),

                    'overdue', (SELECT COUNT(CASE WHEN is_overdue(t.id) IS TRUE THEN 1 END)
                                  FROM tasks t
                                          LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  WHERE ta.team_member_id = $1 ${archivedClause}),

                    'total_logged', (SELECT SUM((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id AND user_id = (SELECT user_id FROM team_member_info_view WHERE team_member_info_view.team_member_id = $1) ${archivedClause})) AS total_logged

                    FROM tasks t
                              LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                    WHERE ta.team_member_id = $1)
                ) AS counts;`;

    const res = await db.query(q, [teamMemberId]);
    const [data] = res.rows;

    return {
      teams: 0,
      projects: 0,
      completed: int(data?.counts.completed),
      ongoing: int(data?.counts.ongoing),
      overdue: int(data?.counts.overdue),
      total_tasks: int(data?.counts.total_tasks),
      total_logged: formatDuration(moment.duration(data?.counts.total_logged, "seconds")),
    };
  }

  protected static async getMemberStats(teamMemberId: string | null, key: string, dateRange: string[] | [], includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;

    const durationFilter = this.memberTasksDurationFilter(key, dateRange);
    const workLogDurationFilter = this.taskWorklogDurationFilter(key, dateRange);
    const assignClause = this.memberAssignDurationFilter(key, dateRange);
    const completedDurationClasue = this.completedDurationFilter(key, dateRange);
    const overdueClauseByDate = this.overdueTasksByDate(key, dateRange, archivedClause);

    const q = `SELECT JSON_BUILD_OBJECT(

                    'total_tasks', (SELECT COUNT(ta.task_id)
                                    FROM tasks t
                                            LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                    WHERE ta.team_member_id = $1 ${durationFilter} ${archivedClause}),

                    'assigned', (SELECT COUNT(ta.task_id)
                                  FROM tasks t
                                          LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  WHERE ta.team_member_id = $1 ${assignClause} ${archivedClause}),

                    'completed', (SELECT COUNT(CASE WHEN is_completed(t.status_id, t.project_id) IS TRUE THEN 1 END)
                                  FROM tasks t
                                          LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  WHERE ta.team_member_id = $1 ${completedDurationClasue} ${archivedClause}),

                    'ongoing', (SELECT COUNT(CASE WHEN is_doing(t.status_id, t.project_id) IS TRUE THEN 1 END)
                                FROM tasks t
                                        LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                WHERE ta.team_member_id = $1 ${archivedClause}),

                    'overdue', ${overdueClauseByDate},

                    'total_logged', (SELECT SUM((SELECT SUM(time_spent) FROM task_work_log WHERE task_id = t.id AND user_id = (SELECT user_id FROM team_member_info_view WHERE team_member_info_view.team_member_id = $1) ${workLogDurationFilter} ${archivedClause})) AS total_logged

                    FROM tasks t
                              LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                    WHERE ta.team_member_id = $1)
                ) AS counts;`;

    const res = await db.query(q, [teamMemberId]);
    const [data] = res.rows;

    return {
      teams: 0,
      projects: 0,
      assigned: int(data?.counts.assigned),
      completed: int(data?.counts.completed),
      ongoing: int(data?.counts.ongoing),
      overdue: int(data?.counts.overdue),
      total_tasks: int(data?.counts.total_tasks),
      total_logged: formatDuration(moment.duration(data?.counts.total_logged, "seconds")),
    };
  }

  protected static async getTasksByProjectOfTeamMemberOverview(teamMemberId: string | null, includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND archived_projects.user_id = '${userId}')`;

    const q = `
      SELECT p.id,
            p.color_code AS color,
            p.name AS label,
            COUNT(t.id) AS count
        FROM projects p
              JOIN tasks t ON p.id = t.project_id
              JOIN tasks_assignees ta ON t.id = ta.task_id AND ta.team_member_id = $1
              JOIN project_members pm ON p.id = pm.project_id AND pm.team_member_id = $1
        WHERE (is_doing(t.status_id, t.project_id)
        OR is_todo(t.status_id, t.project_id)
        OR is_completed(t.status_id, t.project_id)) ${archivedClause}
        GROUP BY p.id, p.name;
    `;
    const result = await db.query(q, [teamMemberId]);

    const chart: IChartObject[] = [];

    const total = result.rows.reduce((accumulator: number, current: {
      count: number
    }) => accumulator + int(current.count), 0);

    for (const project of result.rows) {
      project.count = int(project.count);
      chart.push(this.createChartObject(project.label, project.color, project.count));
    }

    return { chart, total, data: result.rows };
  }

  protected static async getTasksByProjectOfTeamMember(teamMemberId: string | null, key: string, dateRange: string[] | [], includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND archived_projects.user_id = '${userId}')`;

    const durationFilter = this.memberTasksDurationFilter(key, dateRange);
    const activityLogDateFilter = this.getActivityLogsCreationClause(key, dateRange);
    const completedDatebetweenClause = this.getCompletedBetweenClause(key, dateRange);

    const q = `
      SELECT p.id,
            p.color_code AS color,
            p.name AS label,
            COUNT(t.id) AS count
        FROM projects p
              JOIN tasks t ON p.id = t.project_id
              JOIN tasks_assignees ta ON t.id = ta.task_id AND ta.team_member_id = $1
              JOIN project_members pm ON p.id = pm.project_id AND pm.team_member_id = $1
        WHERE (is_doing(
                    (SELECT new_value
                    FROM task_activity_logs tl
                    WHERE tl.task_id = t.id
                      AND tl.attribute_type = 'status'
                      ${activityLogDateFilter}
                    ORDER BY tl.created_at DESC
                    LIMIT 1)::UUID, t.project_id)
        OR is_todo(
                    (SELECT new_value
                    FROM task_activity_logs tl
                    WHERE tl.task_id = t.id
                      AND tl.attribute_type = 'status'
                      ${activityLogDateFilter}
                    ORDER BY tl.created_at DESC
                    LIMIT 1)::UUID, t.project_id)
        OR ${completedDatebetweenClause}) ${archivedClause}
        GROUP BY p.id, p.name;
    `;
    const result = await db.query(q, [teamMemberId]);

    const chart: IChartObject[] = [];

    const total = result.rows.reduce((accumulator: number, current: {
      count: number
    }) => accumulator + int(current.count), 0);

    for (const project of result.rows) {
      project.count = int(project.count);
      chart.push(this.createChartObject(project.label, project.color, project.count));
    }

    return { chart, total, data: result.rows };
  }

  protected static async getTasksByPriorityOfTeamMemberOverview(teamMemberId: string | null, includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;


    const q = `
      SELECT COUNT(CASE WHEN tp.value = 0 THEN 1 END) AS low,
             COUNT(CASE WHEN tp.value = 1 THEN 1 END) AS medium,
             COUNT(CASE WHEN tp.value = 2 THEN 1 END) AS high
      FROM tasks t
             LEFT JOIN task_priorities tp ON t.priority_id = tp.id
             JOIN tasks_assignees ta ON t.id = ta.task_id
      WHERE ta.team_member_id = $1 AND (is_doing(t.status_id, t.project_id)
                                    OR is_todo(t.status_id, t.project_id)
                                    OR is_completed(t.status_id, t.project_id)) ${archivedClause};
    `;

    const result = await db.query(q, [teamMemberId]);
    const [d] = result.rows;

    const total = int(d.low) + int(d.medium) + int(d.high);

    const chart = [
      this.createChartObject("Low", TASK_PRIORITY_LOW_COLOR, d.low),
      this.createChartObject("Medium", TASK_PRIORITY_MEDIUM_COLOR, d.medium),
      this.createChartObject("High", TASK_PRIORITY_HIGH_COLOR, d.high),
    ];

    const data = [
      { label: "Low", color: TASK_PRIORITY_LOW_COLOR, count: d.low },
      { label: "Medium", color: TASK_PRIORITY_MEDIUM_COLOR, count: d.medium },
      { label: "High", color: TASK_PRIORITY_HIGH_COLOR, count: d.high },
    ];

    return { chart, total, data };
  }

  protected static async getTasksByPriorityOfTeamMember(teamMemberId: string | null, key: string, dateRange: string[] | [], includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;


    const durationFilter = this.memberTasksDurationFilter(key, dateRange);
    const activityLogDateFilter = this.getActivityLogsCreationClause(key, dateRange);
    const completedDatebetweenClause = this.getCompletedBetweenClause(key, dateRange);

    const q = `
      SELECT COUNT(CASE WHEN tp.value = 0 THEN 1 END) AS low,
             COUNT(CASE WHEN tp.value = 1 THEN 1 END) AS medium,
             COUNT(CASE WHEN tp.value = 2 THEN 1 END) AS high
      FROM tasks t
             LEFT JOIN task_priorities tp ON t.priority_id = tp.id
             JOIN tasks_assignees ta ON t.id = ta.task_id
      WHERE ta.team_member_id = $1 AND (is_doing(
                                            (SELECT new_value
                                            FROM task_activity_logs tl
                                            WHERE tl.task_id = t.id
                                              AND tl.attribute_type = 'status'
                                              ${activityLogDateFilter}
                                            ORDER BY tl.created_at DESC
                                            LIMIT 1)::UUID, t.project_id)
                                    OR is_todo(
                                            (SELECT new_value
                                            FROM task_activity_logs tl
                                            WHERE tl.task_id = t.id
                                              AND tl.attribute_type = 'status'
                                              ${activityLogDateFilter}
                                            ORDER BY tl.created_at DESC
                                            LIMIT 1)::UUID, t.project_id)
                                    OR ${completedDatebetweenClause}) ${archivedClause};
    `;

    const result = await db.query(q, [teamMemberId]);
    const [d] = result.rows;

    const total = int(d.low) + int(d.medium) + int(d.high);

    const chart = [
      this.createChartObject("Low", TASK_PRIORITY_LOW_COLOR, d.low),
      this.createChartObject("Medium", TASK_PRIORITY_MEDIUM_COLOR, d.medium),
      this.createChartObject("High", TASK_PRIORITY_HIGH_COLOR, d.high),
    ];

    const data = [
      { label: "Low", color: TASK_PRIORITY_LOW_COLOR, count: d.low },
      { label: "Medium", color: TASK_PRIORITY_MEDIUM_COLOR, count: d.medium },
      { label: "High", color: TASK_PRIORITY_HIGH_COLOR, count: d.high },
    ];

    return { chart, total, data };
  }

  protected static getActivityLogsCreationClause(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `AND tl.created_at::DATE <= '${end}'::DATE`;
    }
    return `AND tl.created_at::DATE <= NOW()::DATE`;
  }

  protected static getCompletedBetweenClause(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `is_completed_between(t.id::UUID, '${start}'::DATE, '${end}'::DATE)`;
    }
    return `is_completed(t.status_id::UUID, t.project_id::UUID)`;
  }

  protected static async getTasksByStatusOfTeamMemberOverview(teamMemberId: string | null, includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;


    const q = `
      SELECT COUNT(ta.task_id) AS total,
             COUNT(CASE WHEN is_todo(t.status_id, t.project_id) IS TRUE THEN 1 END) AS todo,
             COUNT(CASE WHEN is_doing(t.status_id, t.project_id) IS TRUE THEN 1 END) AS doing,
             COUNT(CASE WHEN is_completed(t.status_id, t.project_id) IS TRUE THEN 1 END) AS done
      FROM tasks t
             JOIN tasks_assignees ta ON t.id = ta.task_id
      WHERE ta.team_member_id = $1 ${archivedClause};
    `;

    const res = await db.query(q, [teamMemberId]);
    const [d] = res.rows;

    const total = int(d.total);

    const chart = [
      this.createChartObject("Todo", TASK_STATUS_TODO_COLOR, d.todo),
      this.createChartObject("Doing", TASK_STATUS_DOING_COLOR, d.doing),
      this.createChartObject("Done", TASK_STATUS_DONE_COLOR, d.done),
    ];

    const data = [
      { label: "Todo", color: TASK_STATUS_TODO_COLOR, count: d.todo },
      { label: "Doing", color: TASK_STATUS_DOING_COLOR, count: d.doing },
      { label: "Done", color: TASK_STATUS_DONE_COLOR, count: d.done },
    ];


    return { chart, total, data };
  }

  protected static async getTasksByStatusOfTeamMember(teamMemberId: string | null, key: string, dateRange: string[] | [], includeArchived: boolean, userId: string) {

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;


    const durationFilter = this.memberTasksDurationFilter(key, dateRange);
    const completedBetweenFilter = this.getCompletedBetweenClause(key, dateRange);
    const activityLogCreationFilter = this.getActivityLogsCreationClause(key, dateRange);

    const q = `
      SELECT COUNT(ta.task_id) AS total,
             COUNT(CASE WHEN is_todo((SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' ${activityLogCreationFilter} ORDER BY tl.created_at DESC LIMIT 1)::UUID, t.project_id) IS TRUE THEN 1 END) AS todo,
             COUNT(CASE WHEN is_doing((SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' ${activityLogCreationFilter} ORDER BY tl.created_at DESC LIMIT 1)::UUID, t.project_id) IS TRUE THEN 1 END) AS doing,
             COUNT(CASE WHEN ${completedBetweenFilter} IS TRUE THEN 1 END) AS done
      FROM tasks t
             JOIN tasks_assignees ta ON t.id = ta.task_id
      WHERE ta.team_member_id = $1 ${archivedClause};
    `;

    const res = await db.query(q, [teamMemberId]);
    const [d] = res.rows;

    const total = int(d.todo) + int(d.doing) + int(d.done);

    const chart = [
      this.createChartObject("Todo", TASK_STATUS_TODO_COLOR, d.todo),
      this.createChartObject("Doing", TASK_STATUS_DOING_COLOR, d.doing),
      this.createChartObject("Done", TASK_STATUS_DONE_COLOR, d.done),
    ];

    const data = [
      { label: "Todo", color: TASK_STATUS_TODO_COLOR, count: d.todo },
      { label: "Doing", color: TASK_STATUS_DOING_COLOR, count: d.doing },
      { label: "Done", color: TASK_STATUS_DONE_COLOR, count: d.done },
    ];

    return { chart, total, data };
  }

  protected static async getProjectsByStatus(teamId: string | null, archivedClause = ""): Promise<any> {
    const q = `WITH ProjectCounts AS (
          SELECT
            COUNT(*) AS all_projects,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'Cancelled') THEN 1 ELSE 0 END) AS cancelled,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'Blocked') THEN 1 ELSE 0 END) AS blocked,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'On Hold') THEN 1 ELSE 0 END) AS on_hold,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'Proposed') THEN 1 ELSE 0 END) AS proposed,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'In Planning') THEN 1 ELSE 0 END) AS in_planning,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'In Progress') THEN 1 ELSE 0 END) AS in_progress,
            SUM(CASE WHEN status_id = (SELECT id FROM sys_project_statuses WHERE name = 'Completed') THEN 1 ELSE 0 END) AS completed
          FROM projects
          WHERE team_id = $1 ${archivedClause})

        SELECT JSON_BUILD_OBJECT(
          'all_projects', all_projects,
          'cancelled', cancelled,
          'blocked', blocked,
          'on_hold', on_hold,
          'proposed', proposed,
          'in_planning', in_planning,
          'in_progress', in_progress,
          'completed', completed
          ) AS counts
        FROM ProjectCounts;`;
    const res = await db.query(q, [teamId]);
    const [data] = res.rows;

    const all = int(data?.counts.all_projects);
    const cancelled = int(data?.counts.cancelled);
    const blocked = int(data?.counts.blocked);
    const on_hold = int(data?.counts.on_hold);
    const proposed = int(data?.counts.proposed);
    const in_planning = int(data?.counts.in_planning);
    const in_progress = int(data?.counts.in_progress);
    const completed = int(data?.counts.completed);

    const chart : IChartObject[]  = [];

    return {
      all,
      cancelled,
      blocked,
      on_hold,
      proposed,
      in_planning,
      in_progress,
      completed,
      chart
    };

  }

  protected static async getProjectsByCategory(teamId: string | null, archivedClause = ""): Promise<any> {
    const q = `
      SELECT
        pc.id,
        pc.color_code AS color,
        pc.name AS label,
        COUNT(pc.id) AS count
      FROM project_categories pc
        JOIN projects ON pc.id = projects.category_id
        WHERE projects.team_id = $1 ${archivedClause}
      GROUP BY pc.id, pc.name;
    `;
    const result = await db.query(q, [teamId]);

    const chart: IChartObject[]  = [];

    const total = result.rows.reduce((accumulator: number, current: {
      count: number
    }) => accumulator + int(current.count), 0);

    for (const category of result.rows) {
      category.count = int(category.count);
      chart.push({
        name: category.label,
        color: category.color,
        y: category.count
      });
    }

    return { chart, total, data: result.rows };

  }

  protected static async getProjectsByHealth(teamId: string | null, archivedClause = ""): Promise<any> {
    const q = `
                SELECT JSON_BUILD_OBJECT(
                  'needs_attention', (SELECT COUNT(*)
                          FROM projects
                          WHERE team_id = $1 ${archivedClause}
                            AND health_id = (SELECT id FROM sys_project_healths WHERE name = 'Needs Attention')),
                  'at_risk', (SELECT COUNT(*)
                          FROM projects
                          WHERE team_id = $1 ${archivedClause}
                            AND health_id = (SELECT id FROM sys_project_healths WHERE name = 'At Risk')),
                  'good', (SELECT COUNT(*)
                          FROM projects
                          WHERE team_id = $1 ${archivedClause}
                            AND health_id = (SELECT id FROM sys_project_healths WHERE name = 'Good')),
                  'not_set', (SELECT COUNT(*)
                          FROM projects
                          WHERE team_id = $1 ${archivedClause}
                            AND health_id = (SELECT id FROM sys_project_healths WHERE name = 'Not Set'))
                  ) AS counts;
    `;
    const res = await db.query(q, [teamId]);
    const [data] = res.rows;

    const not_set = int(data?.counts.not_set);
    const needs_attention = int(data?.counts.needs_attention);
    const at_risk = int(data?.counts.at_risk);
    const good = int(data?.counts.good);

    const chart: IChartObject[]  = [];

    return {
      not_set,
      needs_attention,
      at_risk,
      good,
      chart
    };

  }

  // Team Overview
  protected static createByProjectStatusChartData(body: any) {
    body.chart = [
      this.createChartObject("Cancelled", "#f37070", body.cancelled),
      this.createChartObject("Blocked", "#cbc8a1", body.blocked),
      this.createChartObject("On Hold", "#cbc8a1", body.on_hold),
      this.createChartObject("Proposed", "#cbc8a1", body.proposed),
      this.createChartObject("In Planning", "#cbc8a1", body.in_planning),
      this.createChartObject("In Progress", "#80ca79", body.in_progress),
      this.createChartObject("Completed", "#80ca79", body.completed)
    ];
  }

  protected static createByProjectHealthChartData(body: any) {
    body.chart = [
      this.createChartObject("Not Set", "#a9a9a9", body.not_set),
      this.createChartObject("Needs Attention", "#f37070", body.needs_attention),
      this.createChartObject("At Risk", "#fbc84c", body.at_risk),
      this.createChartObject("Good", "#75c997", body.good)
    ];
  }

}
