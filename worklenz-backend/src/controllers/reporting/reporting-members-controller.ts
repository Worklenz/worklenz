import moment from "moment";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { SqlHelper } from "../../shared/sql-helpers";
import { DATE_RANGES, TASK_PRIORITY_COLOR_ALPHA } from "../../shared/constants";
import { formatDuration, getColor, int } from "../../shared/utils";
import ReportingControllerBaseWithTimezone from "./reporting-controller-base-with-timezone";
import ReportingControllerBase from "./reporting-controller-base";
import Excel from "exceljs";

export default class ReportingMembersController extends ReportingControllerBaseWithTimezone {

  protected static getPercentage(n: number, total: number) {
    return +(n ? (n / total) * 100 : 0).toFixed();
  }

  protected static getCurrentTeamId(req: IWorkLenzRequest): string | null {
    return req.user?.team_id ?? null;
  }

  public static convertMinutesToHoursAndMinutes(totalMinutes: number) {
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours}h ${minutes}m`;
  }

  public static convertSecondsToHoursAndMinutes(seconds: number) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  }

  protected static formatEndDate(endDate: string) {
    const end = moment(endDate).format("YYYY-MM-DD");
    const fEndDate = moment(end);
    return fEndDate;
  }

  protected static formatCurrentDate() {
    const current = moment().format("YYYY-MM-DD");
    const fCurrentDate = moment(current);
    return fCurrentDate;
  }

  protected static getDaysLeft(endDate: string): number | null {
    if (!endDate) return null;

    const fCurrentDate = this.formatCurrentDate();
    const fEndDate = this.formatEndDate(endDate);

    return fEndDate.diff(fCurrentDate, "days");
  }

  protected static isOverdue(endDate: string): boolean {
    if (!endDate) return false;

    const fCurrentDate = this.formatCurrentDate();
    const fEndDate = this.formatEndDate(endDate);

    return fEndDate.isBefore(fCurrentDate);
  }

  protected static isToday(endDate: string): boolean {
    if (!endDate) return false;

    const fCurrentDate = this.formatCurrentDate();
    const fEndDate = this.formatEndDate(endDate);

    return fEndDate.isSame(fCurrentDate);
  }

  private static async getMembers(
    teamId: string, searchQuery = "",
    searchParams: string[] = [],
    size: number | null = null,
    offset: number | null = null,
    teamsClause = "",
    teamIdsParams: string[] = [],
    key = DATE_RANGES.LAST_WEEK,
    dateRange: string[] = [],
    includeArchived: boolean,
    userId: string,
    req?: any
  ) {
    const pagingClause = (size !== null && offset !== null) ? `LIMIT ${size} OFFSET ${offset}` : "";
    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`;

    // Use parameterized queries
    // Note: $1 is teamId, searchParams use $2+, so other parameters start after searchParams
    let paramOffset = 2 + searchParams.length;
    const assignClauseResult = this.memberAssignDurationFilter(key, dateRange, paramOffset);
    const assignClause = assignClauseResult.clause;
    const assignParams = assignClauseResult.params;
    paramOffset += assignParams.length;
    
    const completedDurationResult = this.completedDurationFilter(key, dateRange, paramOffset);
    const completedDurationClasue = completedDurationResult.clause;
    const completedParams = completedDurationResult.params;
    paramOffset += completedParams.length;
    
    const overdueActivityLogsResult = this.getActivityLogsOverdue(key, dateRange, paramOffset);
    const overdueActivityLogsClause = overdueActivityLogsResult.clause;
    const overdueParams = overdueActivityLogsResult.params;
    paramOffset += overdueParams.length;
    
    const activityLogCreationResult = this.getActivityLogsCreationClause(key, dateRange, paramOffset);
    const activityLogCreationFilter = activityLogCreationResult.clause;
    const activityLogParams = activityLogCreationResult.params;
    paramOffset += activityLogParams.length;
    
    const timeLogDateRangeResult = this.getTimeLogDateRangeClause(key, dateRange, paramOffset);
    const timeLogDateRangeClause = timeLogDateRangeResult.clause;
    const timeLogParams = timeLogDateRangeResult.params;
    paramOffset += timeLogParams.length;

    // Add project filtering for Team Leads - only show members working on assigned projects
    let memberFilterClause = "";
    let projectParams: any[] = [];
    if (req) {
      const projectFilter = await ReportingControllerBase.buildProjectFilterForTeamLead(req);
      if (projectFilter && projectFilter !== "") {
        // Team Lead: only show members who work on their assigned projects
        const assignedProjects = await ReportingControllerBase.getTeamLeadProjects(req.user?.id, teamId);
        if (assignedProjects.length > 0) {
          // Use parameterized query for array with correct offset
          const { clause, params } = SqlHelper.buildInClause(assignedProjects, paramOffset);
          projectParams = params;
          memberFilterClause = `AND tmiv.team_member_id IN (
            SELECT DISTINCT pm.team_member_id 
            FROM project_members pm 
            WHERE pm.project_id IN (${clause})
          )`;
          paramOffset += projectParams.length;
        } else {
          // Team Lead with no projects assigned - show no members
          memberFilterClause = "AND FALSE";
        }
      }
    }

    const q = `SELECT COUNT(DISTINCT email) AS total,
              (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
                  FROM (SELECT team_member_id AS id,
                              name,
                              avatar_url,
                              email,
                              (SELECT COUNT(project_id)
                              FROM project_members pm
                              WHERE pm.team_member_id = tmiv.team_member_id) AS projects,

                              (SELECT GREATEST(
                                (SELECT MAX(created_at) FROM task_activity_logs WHERE user_id = (SELECT user_id FROM team_members WHERE id = tmiv.team_member_id) AND team_id = $1),
                                (SELECT MAX(created_at) FROM task_work_log WHERE user_id = (SELECT user_id FROM team_members WHERE id = tmiv.team_member_id)
                                AND task_id IN (SELECT id FROM tasks t WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1 )
                                )))) AS last_user_activity,

                              (SELECT COUNT(*)
                              FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id ${archivedClause}) AS total_tasks,

                              (SELECT COUNT(*)
                              FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id ${assignClause} ${archivedClause}) AS tasks,

                              (SELECT COUNT(*)
                              FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id
                                  AND is_completed(status_id, t.project_id) ${archivedClause}) AS total_completed,

                              (SELECT COUNT(*) FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id  AND is_completed(status_id, t.project_id) ${completedDurationClasue} ${archivedClause}) AS completed,

                              (SELECT COUNT(*)
                              FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id
                                  AND is_doing(status_id, t.project_id) ${archivedClause}) AS total_ongoing,

                              (SELECT COUNT(*)
                              FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id
                                  AND is_doing(status_id, t.project_id) ${archivedClause}) AS ongoing,

                              (SELECT COUNT(*) FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id ${overdueActivityLogsClause} ${archivedClause}) AS overdue,

                              (SELECT COUNT(*)
                              FROM tasks t
                                      LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                              WHERE team_member_id = tmiv.team_member_id
                                  AND is_todo(status_id, t.project_id) ${archivedClause}) AS todo,

                              (SELECT COUNT(*)
                                  FROM tasks t
                                          LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  WHERE team_member_id = tmiv.team_member_id
                                      AND is_todo((SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' ${activityLogCreationFilter} ORDER BY tl.created_at DESC LIMIT 1)::UUID, t.project_id) ${archivedClause}) AS todo_by_activity_logs,

                              (SELECT COUNT(*)
                                  FROM tasks t
                                          LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                                  WHERE team_member_id = tmiv.team_member_id
                                      AND is_doing((SELECT new_value FROM task_activity_logs tl WHERE tl.task_id = t.id AND tl.attribute_type = 'status' ${activityLogCreationFilter} ORDER BY tl.created_at DESC LIMIT 1)::UUID, t.project_id) ${archivedClause}) AS ongoing_by_activity_logs,

                              (SELECT COALESCE(SUM(twl.time_spent), 0)
                                  FROM task_work_log twl
                                  LEFT JOIN tasks t ON twl.task_id = t.id
                                  WHERE twl.user_id = (SELECT user_id FROM team_members WHERE id = tmiv.team_member_id)
                                      AND t.billable IS TRUE
                                      AND t.project_id IN (SELECT id FROM projects WHERE team_id = $1)
                                      ${timeLogDateRangeClause}
                                      ${includeArchived ? "" : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`}) AS billable_time,

                              (SELECT COALESCE(SUM(twl.time_spent), 0)
                                  FROM task_work_log twl
                                  LEFT JOIN tasks t ON twl.task_id = t.id
                                  WHERE twl.user_id = (SELECT user_id FROM team_members WHERE id = tmiv.team_member_id)
                                      AND t.billable IS FALSE
                                      AND t.project_id IN (SELECT id FROM projects WHERE team_id = $1)
                                      ${timeLogDateRangeClause}
                                      ${includeArchived ? "" : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${userId}')`}) AS non_billable_time
                      FROM team_member_info_view tmiv
                      WHERE tmiv.team_id = $1 ${teamsClause} ${memberFilterClause}
                          ${searchQuery}
                      GROUP BY email, name, avatar_url, team_member_id, tmiv.team_id
                      ORDER BY last_user_activity DESC NULLS LAST

                      ${pagingClause}) t) AS members
                  FROM team_member_info_view tmiv
                  WHERE tmiv.team_id = $1 ${teamsClause} ${memberFilterClause}
                  ${searchQuery}`;
    // Pass all parameters - searchParams come after teamId, then teamIdsParams, then other filter params
    const queryParams = [teamId, ...searchParams, ...teamIdsParams, ...assignParams, ...completedParams, ...overdueParams, ...activityLogParams, ...timeLogParams, ...projectParams];
    const result = await db.query(q, queryParams);
    const [data] = result.rows;

    for (const member of data.members) {
      member.color_code = getColor(member.name) + TASK_PRIORITY_COLOR_ALPHA;
      member.tasks_stat = {
        todo: this.getPercentage(int(member.todo_by_activity_logs), +  (member.completed + member.todo_by_activity_logs + member.ongoing_by_activity_logs)),
        doing: this.getPercentage(int(member.ongoing_by_activity_logs), +  (member.completed + member.todo_by_activity_logs + member.ongoing_by_activity_logs)),
        done: this.getPercentage(int(member.completed), + (member.completed + member.todo_by_activity_logs + member.ongoing_by_activity_logs))
      };
      member.member_teams = this.createTagList(member.member_teams, 2);
    }
    return data;
  }


  protected static memberTasksDurationFilter(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return {
          clause: `AND t.end_date::DATE = $${paramOffset}::DATE`,
          params: [start]
        };
      }

      return {
        clause: `AND t.end_date::DATE >= $${paramOffset}::DATE AND t.end_date::DATE <= $${paramOffset + 1}::DATE`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND t.end_date::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };

    return { clause: "", params: [] };
  }

  protected static memberAssignDurationFilter(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return {
          clause: `AND ta.updated_at::DATE = $${paramOffset}::DATE`,
          params: [start]
        };
      }

      return {
        clause: `AND ta.updated_at::DATE >= $${paramOffset}::DATE AND ta.updated_at::DATE <= $${paramOffset + 1}::DATE`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `AND ta.updated_at::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND ta.updated_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };

    return { clause: "", params: [] };
  }

  protected static completedDurationFilter(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return {
          clause: `AND t.completed_at::DATE = $${paramOffset}::DATE`,
          params: [start]
        };
      }

      return {
        clause: `AND t.completed_at::DATE >= $${paramOffset}::DATE AND t.completed_at::DATE <= $${paramOffset + 1}::DATE`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `AND t.completed_at::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND t.completed_at::DATE < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };

    return { clause: "", params: [] };
  }

  protected static getOverdueClause(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return {
          clause: `AND t.end_date::DATE = $${paramOffset}::DATE`,
          params: [start]
        };
      }

      return {
        clause: `AND t.end_date::DATE >= $${paramOffset}::DATE AND t.end_date::DATE <= $${paramOffset + 1}::DATE`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND t.end_date::DATE < NOW()::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND t.end_date::DATE < NOW()::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND t.end_date::DATE < NOW()::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `AND t.end_date::DATE >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND t.end_date::DATE < NOW()::DATE`, params: [] };

    return { clause: ` AND t.end_date::DATE < NOW()::DATE `, params: [] };
  }

  protected static getTaskSelectorClause() {
    return `SELECT t.id,
                    t.name,
                    t.project_id,
                    (SELECT name FROM projects WHERE id = t.project_id) AS project_name,
                    t.parent_task_id,
                    t.parent_task_id IS NOT NULL AS is_sub_task,

                    t.end_date,
                    t.completed_at,

                    (CASE
                    WHEN (CURRENT_DATE::DATE > end_date::DATE AND
                          status_id IN (SELECT id
                                        FROM task_statuses
                                        WHERE project_id = t.project_id
                                          AND category_id IN
                                              (SELECT id FROM sys_task_status_categories WHERE is_done IS FALSE)))
                        THEN CURRENT_DATE::DATE - end_date::DATE
                    ELSE 0 END) AS days_overdue,

                    (SELECT name FROM task_statuses WHERE id = t.status_id) AS status_name,
                    (SELECT color_code FROM sys_task_status_categories WHERE id = (SELECT category_id FROM task_statuses WHERE id = t.status_id AND t.project_id = t.project_id)) AS status_color,

                    (SELECT name FROM task_priorities WHERE id = t.priority_id) AS priority_name,
                    (SELECT color_code FROM task_priorities WHERE id = t.priority_id) AS priority_color,

                    (SELECT name FROM project_phases WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_name,
                    (SELECT color_code FROM project_phases WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = t.id)) AS phase_color,

                    (total_minutes * 60) AS total_minutes,
                    (SELECT SUM(time_spent) FROM task_work_log twl WHERE twl.task_id = t.id AND twl.user_id = (SELECT user_id FROM team_members WHERE id = $1)) AS time_logged,
                    ((SELECT SUM(time_spent) FROM task_work_log twl WHERE twl.task_id = t.id AND twl.user_id = (SELECT user_id FROM team_members WHERE id = $1)) - (total_minutes * 60)) AS overlogged_time`;
  }

  protected static getActivityLogsOverdue(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return {
        clause: `AND is_overdue_for_date(t.id, $${paramOffset}::DATE)`,
        params: [end]
      };
    }

    return { clause: `AND is_overdue_for_date(t.id, NOW()::DATE)`, params: [] };
  }

  protected static getActivityLogsCreationClause(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return {
        clause: `AND tl.created_at::DATE <= $${paramOffset}::DATE`,
        params: [end]
      };
    }
    return { clause: `AND tl.created_at::DATE <= NOW()::DATE`, params: [] };
  }

  protected static getDateRangeClauseMembers(key: string, dateRange: string[], tableAlias: string, paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return {
          clause: `AND ${tableAlias}.created_at::DATE = $${paramOffset}::DATE`,
          params: [start]
        };
      }

      return {
        clause: `AND ${tableAlias}.created_at::DATE >= $${paramOffset}::DATE AND ${tableAlias}.created_at < $${paramOffset + 1}::DATE + INTERVAL '1 day'`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `AND ${tableAlias}.created_at >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND ${tableAlias}.created_at < CURRENT_DATE::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `AND ${tableAlias}.created_at >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND ${tableAlias}.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `AND ${tableAlias}.created_at >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND ${tableAlias}.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `AND ${tableAlias}.created_at >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND ${tableAlias}.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };

    return { clause: "", params: [] };
  }

  protected static getTimeLogDateRangeClause(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");

      if (start === end) {
        return {
          clause: `AND twl.created_at::DATE = $${paramOffset}::DATE`,
          params: [start]
        };
      }

      return {
        clause: `AND twl.created_at::DATE >= $${paramOffset}::DATE AND twl.created_at < $${paramOffset + 1}::DATE + INTERVAL '1 day'`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND twl.created_at < CURRENT_DATE::DATE`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND twl.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND twl.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `AND twl.created_at >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND twl.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'`, params: [] };

    return { clause: "", params: [] };
  }

  private static formatDuration(duration: moment.Duration) {
    const empty = "0h 0m";
    let format = "";

    if (duration.asMilliseconds() === 0) return empty;

    const h = ~~(duration.asHours());
    const m = duration.minutes();
    const s = duration.seconds();

    if (h === 0 && s > 0) {
      format = `${m}m ${s}s`;
    } else if (h > 0 && s === 0) {
      format = `${h}h ${m}m`;
    } else if (h > 0 && s > 0) {
      format = `${h}h ${m}m ${s}s`;
    } else {
      format = `${h}h ${m}m`;
    }

    return format;
  }

  @HandleExceptions()
  public static async getReportingMembers(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // teamId is $1, so search params start at $2
    const { searchQuery, searchParams, size, offset } = this.toPaginationOptions(req.query, ["tmiv.name"], false, 2);
    const { duration, date_range } = req.query;
    const archived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    let teamsClause = "";
    let teamIdsParams: string[] = [];
    if (req.query.teams) {
      const teamIds = (req.query.teams as string).split(" ").filter(id => id.trim());
      // Parameters will be added after searchParams, so offset = 2 + searchParams.length
      const { clause } = SqlHelper.buildInClause(teamIds, 2 + searchParams.length);
      teamsClause = `AND tmiv.team_id IN (${clause})`;
      teamIdsParams = teamIds;
    }

    const teamId = this.getCurrentTeamId(req);
    const result = await this.getMembers(teamId as string, searchQuery, searchParams, size, offset, teamsClause, teamIdsParams, duration as string, dateRange, archived, req.user?.id as string, req);
    const body = {
      total: result.total,
      members: result.members,
      team: {
        id: req.user?.team_id,
        name: req.user?.team_name
      }
    };
    return res.status(200).send(new ServerResponse(true, body));
  }

  public static formatDurationDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  @HandleExceptions()
  public static async export(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const { search } = req.body;
    const { duration, date_range } = req.query;
    const archived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    const teamId = this.getCurrentTeamId(req);
    const teamName = (req.query.team_name as string)?.trim() || null;
    const result = await this.getMembers(teamId as string, "", [], null, null, "", [], duration as string, dateRange, archived, req.user?.id as string, req);

    let start = "-";
    let end = "-";

    if (dateRange.length === 2) {
      start = dateRange[0] ? this.formatDurationDate(new Date(dateRange[0])).toString() : "-";
      end = dateRange[1] ? this.formatDurationDate(new Date(dateRange[1])).toString() : "-";
    } else {
      switch (duration) {
        case DATE_RANGES.YESTERDAY:
          start = moment().subtract(1, "day").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_WEEK:
          start = moment().subtract(1, "week").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_MONTH:
          start = moment().subtract(1, "month").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_QUARTER:
          start = moment().subtract(3, "months").format("YYYY-MM-DD").toString();
          break;
      }
      end = moment().format("YYYY-MM-DD").toString();
    }

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamName} members - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Members");

    sheet.columns = [
      { header: "Member", key: "name", width: 30 },
      { header: "Email", key: "email", width: 20 },
      { header: "Tasks Assigned", key: "tasks", width: 20 },
      { header: "Overdue Tasks", key: "overdue_tasks", width: 20 },
      { header: "Completed Tasks", key: "completed_tasks", width: 20 },
      { header: "Ongoing Tasks", key: "ongoing_tasks", width: 20 },
      { header: "Billable Time (seconds)", key: "billable_time", width: 25 },
      { header: "Non-Billable Time (seconds)", key: "non_billable_time", width: 25 },
      { header: "Done Tasks(%)", key: "done_tasks", width: 20 },
      { header: "Doing Tasks(%)", key: "doing_tasks", width: 20 },
      { header: "Todo Tasks(%)", key: "todo_tasks", width: 20 }
    ];

    // set title
    sheet.getCell("A1").value = `Members from ${teamName}`;
    sheet.mergeCells("A1:M1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:M2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(5).values = ["Member", "Email", "Tasks Assigned", "Overdue Tasks", "Completed Tasks", "Ongoing Tasks", "Billable Time (seconds)", "Non-Billable Time (seconds)", "Done Tasks(%)", "Doing Tasks(%)", "Todo Tasks(%)"];
    sheet.getRow(5).font = { bold: true };

    for (const member of result.members) {
      sheet.addRow({
        name: member.name,
        email: member.email,
        tasks: member.tasks,
        overdue_tasks: member.overdue,
        completed_tasks: member.completed,
        ongoing_tasks: member.ongoing,
        billable_time: member.billable_time || 0,
        non_billable_time: member.non_billable_time || 0,
        done_tasks: member.completed,
        doing_tasks: member.ongoing_by_activity_logs,
        todo_tasks: member.todo_by_activity_logs
      });
    }

    // download excel
    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });

  }

  @HandleExceptions()
  public static async exportTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse) {

    const { duration, date_range, team_id, team_member_id } = req.query;

    const includeArchived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    // Get user timezone for proper date filtering
    const userTimezone = await this.getUserTimezone(req.user?.id as string);
    // $1 => team_id, $2 => team_member_id, so date params start at $3
    const durationClauseResult = this.getDateRangeClauseWithTimezoneParams(
      (duration as string) || DATE_RANGES.LAST_WEEK,
      dateRange,
      userTimezone,
      3
    );
    const durationClause = durationClauseResult.clause;
    const durationParams = durationClauseResult.params;

    const minMaxDateClauseResult = this.getMinMaxDates(
      (duration as string) || DATE_RANGES.LAST_WEEK,
      dateRange,
      "task_work_log",
      3 + durationParams.length
    );
    const minMaxDateClause = minMaxDateClauseResult.clause;
    const minMaxParams = minMaxDateClauseResult.params;
    const memberName = (req.query.member_name as string)?.trim() || null;

    const queryParams = [...durationParams, ...minMaxParams];

    const logGroups = await this.memberTimeLogsData(
      durationClause,
      minMaxDateClause,
      team_id as string,
      team_member_id as string,
      includeArchived,
      req.user?.id as string,
      "",
      queryParams
    );

    let start = "-";
    let end = "-";

    if (dateRange.length === 2) {
      start = dateRange[0] ? this.formatDurationDate(new Date(dateRange[0])).toString() : "-";
      end = dateRange[1] ? this.formatDurationDate(new Date(dateRange[1])).toString() : "-";
    } else {
      switch (duration) {
        case DATE_RANGES.YESTERDAY:
          start = moment().subtract(1, "day").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_WEEK:
          start = moment().subtract(1, "week").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_MONTH:
          start = moment().subtract(1, "month").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_QUARTER:
          start = moment().subtract(3, "months").format("YYYY-MM-DD").toString();
          break;
      }
      end = moment().format("YYYY-MM-DD").toString();
    }


    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${memberName} timelogs - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Members");

    sheet.columns = [
      { header: "Date", key: "date", width: 30 },
      { header: "Log", key: "log", width: 120 },
    ];

    sheet.getCell("A1").value = `Timelogs of ${memberName}`;
    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(5).values = ["Time Logs"];
    sheet.getRow(5).font = { bold: true };

    for (const row of logGroups) {
      for (const log of row.logs) {
        sheet.addRow({
          date: row.log_day,
          log: `Logged ${log.time_spent_string} for ${log.task_name} in ${log.project_name}`
        });
      }
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });


  }

  @HandleExceptions()
  public static async exportActivityLogs(req: IWorkLenzRequest, res: IWorkLenzResponse) {

    const { duration, date_range, team_id, team_member_id } = req.query;
    const includeArchived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    // Use parameterized queries
    // $1 => team_id, $2 => team_member_id, so date params start at $3
    const durationClauseResult = ReportingMembersController.getDateRangeClauseMembers(
      duration as string || DATE_RANGES.LAST_WEEK,
      dateRange,
      "tal",
      3
    );
    const durationClause = durationClauseResult.clause;
    const durationParams = durationClauseResult.params;
    
    const minMaxDateClauseResult = this.getMinMaxDates(
      duration as string || DATE_RANGES.LAST_WEEK,
      dateRange,
      "task_activity_logs",
      3 + durationParams.length
    );
    const minMaxDateClause = minMaxDateClauseResult.clause;
    const minMaxParams = minMaxDateClauseResult.params;
    
    const memberName = (req.query.member_name as string)?.trim() || null;

    // Combine all parameters for the query
    const allParams = [...durationParams, ...minMaxParams];
    const logGroups = await this.memberActivityLogsData(durationClause, minMaxDateClause, team_id as string, team_member_id as string, includeArchived, req.user?.id as string, allParams);

    let start = "-";
    let end = "-";

    if (dateRange.length === 2) {
      start = dateRange[0] ? this.formatDurationDate(new Date(dateRange[0])).toString() : "-";
      end = dateRange[1] ? this.formatDurationDate(new Date(dateRange[1])).toString() : "-";
    } else {
      switch (duration) {
        case DATE_RANGES.YESTERDAY:
          start = moment().subtract(1, "day").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_WEEK:
          start = moment().subtract(1, "week").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_MONTH:
          start = moment().subtract(1, "month").format("YYYY-MM-DD").toString();
          break;
        case DATE_RANGES.LAST_QUARTER:
          start = moment().subtract(3, "months").format("YYYY-MM-DD").toString();
          break;
      }
      end = moment().format("YYYY-MM-DD").toString();
    }


    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${memberName} activitylogs - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Members");

    sheet.columns = [
      { header: "Date", key: "date", width: 30 },
      { header: "Log", key: "log", width: 120 },
    ];

    sheet.getCell("A1").value = `Activities of ${memberName}`;
    sheet.mergeCells("A1:K1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:K2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(5).values = ["Activity Logs"];
    sheet.getRow(5).font = { bold: true };

    for (const row of logGroups) {
      for (const log of row.logs) {
        !log.previous ? log.previous = "NULL" : log.previous;
        !log.current ? log.current = "NULL" : log.current;
        switch (log.attribute_type) {
          case "start_date":
            log.attribute_type = "Start Date";
            break;
          case "end_date":
            log.attribute_type = "End Date";
            break;
          case "status":
            log.attribute_type = "Status";
            break;
          case "priority":
            log.attribute_type = "Priority";
            break;
          case "phase":
            log.attribute_type = "Phase";
            break;
          default:
            break;
        }
        sheet.addRow({
          date: row.log_day,
          log: `Updated ${log.attribute_type} from ${log.previous} to ${log.current} in ${log.task_name} within ${log.project_name}.`
        });
      }
    }

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });

  }


  public static async getMemberProjectsData(teamId: string, teamMemberId: string, searchQuery: string, searchParams: string[] = [], archived: boolean, userId: string, req?: any) {

    const teamClause = teamId
      ? `team_member_id = '${teamMemberId as string}'`
      : `team_member_id IN (SELECT team_member_id
            FROM team_member_info_view tmiv
            WHERE LOWER(email) = LOWER((SELECT email
                        FROM team_member_info_view tmiv2
                        WHERE tmiv2.team_member_id = '${teamMemberId}' AND in_organization(p.team_id, tmiv2.team_id))))`;

    const archivedClause = archived ? `` : ` AND pm.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = pm.project_id AND user_id = '${userId}')`;

    // Add project filtering for Team Leads
    let projectFilterClause = "";
    if (req) {
      const filter = await ReportingControllerBase.buildProjectFilterForTeamLead(req);
      projectFilterClause = filter.replace('p.id', 'pm.project_id');
    }

    const q = `SELECT p.id, p.name, pm.team_member_id,
                  (SELECT name FROM teams WHERE id = p.team_id) AS team,
                  (SELECT COUNT(task_id)
                      FROM tasks_assignees ta
                      WHERE pm.team_member_id = ta.team_member_id
                      AND task_id IN (SELECT id FROM tasks t WHERE t.project_id = pm.project_id))::INT AS task_count,
                  (SELECT COUNT(*)
                      FROM tasks
                      WHERE archived IS FALSE
                      AND project_id = pm.project_id
                      AND CASE
                              WHEN (TRUE IS TRUE) THEN project_id IS NOT NULL
                              ELSE archived IS FALSE END)::INT AS project_task_count,
                  (SELECT COUNT(*)
                      FROM tasks t
                              LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
                      WHERE project_id = pm.project_id
                      AND ta.team_member_id = pm.team_member_id
                      AND is_completed(t.status_id, t.project_id) IS TRUE)::INT AS completed,
                  (SELECT COUNT(*)
                      FROM tasks t
                              LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
                      WHERE project_id = pm.project_id
                      AND ta.team_member_id = pm.team_member_id
                      AND is_overdue(t.status_id) IS TRUE)::INT AS overdue,
                  (SELECT COUNT(*)
                      FROM tasks t
                              LEFT JOIN tasks_assignees ta ON ta.task_id = t.id
                      WHERE project_id = pm.project_id
                      AND ta.team_member_id = pm.team_member_id
                      AND is_completed(t.status_id, t.project_id) IS FALSE)::INT AS incompleted,
                  (SELECT SUM(time_spent)
                      FROM task_work_log twl
                      WHERE task_id IN (SELECT id FROM tasks WHERE tasks.project_id = pm.project_id)
                      AND user_id = (SELECT user_id FROM team_member_info_view tmiv WHERE pm.team_member_id = tmiv.team_member_id)) AS time_logged
              FROM project_members pm
                      LEFT JOIN projects p ON p.id = pm.project_id
              WHERE ${teamClause} ${searchQuery} ${archivedClause} ${projectFilterClause}
              ORDER BY name;`;
    const result = await db.query(q, searchParams);

    for (const project of result.rows) {
      project.time_logged = formatDuration(moment.duration(project.time_logged, "seconds"));
      project.contribution = project.project_task_count > 0 ? ((project.task_count / project.project_task_count) * 100).toFixed(0) : 0;
    }

    return result.rows;
  }

  @HandleExceptions()
  public static async getMemberProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // No other parameters before search params, so they start at $1
    const { searchQuery, searchParams } = this.toPaginationOptions(req.query, ["p.name"], false, 1);
    const { teamMemberId, teamId } = req.query;
    const archived = req.query.archived === "true";

    const result = await this.getMemberProjectsData(teamId as string, teamMemberId as string, searchQuery, searchParams, archived, req.user?.id as string, req);

    return res.status(200).send(new ServerResponse(true, result));
  }


  protected static getMinMaxDates(key: string, dateRange: string[], tableName: string, paramOffset = 1): { clause: string; params: any[] } {
    if (dateRange.length === 2) {
      // Use parameterized queries for dates
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return {
        clause: `,(SELECT $${paramOffset}::DATE )AS start_date, (SELECT $${paramOffset + 1}::DATE )AS end_date`,
        params: [start, end]
      };
    }

    if (key === DATE_RANGES.YESTERDAY)
      return { clause: `,(SELECT (CURRENT_DATE - INTERVAL '1 day')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date`, params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: `,(SELECT (CURRENT_DATE - INTERVAL '1 week')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date`, params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: `,(SELECT (CURRENT_DATE - INTERVAL '1 month')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date`, params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: `,(SELECT (CURRENT_DATE - INTERVAL '3 months')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date`, params: [] };
    if (key === DATE_RANGES.ALL_TIME)
      return { clause: `,(SELECT (MIN(created_at)::DATE) FROM ${tableName} WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1))) AS start_date, (SELECT (MAX(created_at)::DATE) FROM ${tableName} WHERE task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1))) AS end_date`, params: [] };

    return { clause: "", params: [] };
  }



  @HandleExceptions()
  public static async getMemberActivities(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { team_member_id, team_id, duration, date_range, archived } = req.body;

    // Use parameterized queries
    // $1 => team_id, $2 => team_member_id, so date params start at $3
    const durationClauseResult = ReportingMembersController.getDateRangeClauseMembers(
      duration || DATE_RANGES.LAST_WEEK,
      date_range,
      "tal",
      3
    );
    const durationClause = durationClauseResult.clause;
    const durationParams = durationClauseResult.params;
    
    const minMaxDateClauseResult = this.getMinMaxDates(
      duration || DATE_RANGES.LAST_WEEK,
      date_range,
      "task_activity_logs",
      3 + durationParams.length
    );
    const minMaxDateClause = minMaxDateClauseResult.clause;
    const minMaxParams = minMaxDateClauseResult.params;

    // Combine all parameters for the query
    const allParams = [...durationParams, ...minMaxParams];
    const logGroups = await this.memberActivityLogsData(durationClause, minMaxDateClause, team_id, team_member_id, archived, req.user?.id as string, allParams);

    return res.status(200).send(new ServerResponse(true, logGroups));
  }

  private static async formatLog(result: { start_date: string, end_date: string, time_logs: any[] }) {

    result.time_logs.forEach((row) => {
      const duration = moment.duration(row.time_spent, "seconds");
      row.time_spent_string = this.formatDuration(duration);
    });

    return result;
  }

  private static async getTimeLogDays(result: { start_date: string, end_date: string, time_logs: any[] }) {
    if (result) {
      const startDate = moment(result.start_date).isValid() ? moment(result.start_date, "YYYY-MM-DD").clone() : null;
      const endDate = moment(result.end_date).isValid() ? moment(result.end_date, "YYYY-MM-DD").clone() : null;

      const days = [];
      const logDayGroups = [];

      while (startDate && moment(startDate).isSameOrBefore(endDate)) {
        days.push(startDate.clone().format("YYYY-MM-DD"));
        startDate ? startDate.add(1, "day") : null;
      }

      for (const day of days) {
        const logsForDay = result.time_logs.filter((log) => moment(moment(log.created_at).format("YYYY-MM-DD")).isSame(moment(day).format("YYYY-MM-DD")));
        if (logsForDay.length) {
          logDayGroups.push({
            log_day: day,
            logs: logsForDay
          });
        }
      }

      return logDayGroups;

    }
    return [];
  }

  private static async getActivityLogDays(result: { start_date: string, end_date: string, activity_logs: any[] }) {
    if (result) {
      const startDate = moment(result.start_date).isValid() ? moment(result.start_date, "YYYY-MM-DD").clone() : null;
      const endDate = moment(result.end_date).isValid() ? moment(result.end_date, "YYYY-MM-DD").clone() : null;

      const days = [];
      const logDayGroups = [];

      while (startDate && moment(startDate).isSameOrBefore(endDate)) {
        days.push(startDate.clone().format("YYYY-MM-DD"));
        startDate ? startDate.add(1, "day") : null;
      }

      for (const day of days) {
        const logsForDay = result.activity_logs.filter((log) => moment(moment(log.created_at).format("YYYY-MM-DD")).isSame(moment(day).format("YYYY-MM-DD")));
        if (logsForDay.length) {
          logDayGroups.push({
            log_day: day,
            logs: logsForDay
          });
        }
      }

      return logDayGroups;

    }
    return [];
  }


  private static async memberTimeLogsData(
    durationClause: string,
    minMaxDateClause: string,
    team_id: string,
    team_member_id: string,
    includeArchived: boolean,
    userId: string,
    billableQuery = "",
    params: any[] = []
  ) {

    const archivedClause = includeArchived
    ? ""
    : `AND project_id NOT IN (SELECT project_id FROM archived_projects WHERE archived_projects.user_id = '${userId}')`;

    const q = `
                SELECT user_id,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(tl))), '[]'::JSON)
                      FROM (SELECT time_spent,
                                  created_at,
                                  twl.task_id AS task_id,
                                  (SELECT project_id FROM tasks WHERE tasks.id = twl.task_id) AS project_id,
                                  (SELECT name FROM projects WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = twl.task_id)) AS project_name,
                                  (SELECT name FROM tasks WHERE tasks.id = twl.task_id) AS task_name,
                                  CONCAT((SELECT key
                                          FROM projects
                                          WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = twl.task_id)), '-',
                                          (SELECT task_no FROM tasks WHERE tasks.id = twl.task_id)) AS task_key
                            FROM task_work_log twl
                            WHERE twl.user_id = tmiv.user_id
                              ${durationClause}
                              AND task_id IN (SELECT id FROM tasks WHERE project_id IN (SELECT id FROM projects WHERE team_id = $1) ${archivedClause} ${billableQuery})
                            ORDER BY twl.updated_at DESC) tl) AS time_logs
                      ${minMaxDateClause}
                FROM team_member_info_view tmiv
                WHERE tmiv.team_id = $1
                AND tmiv.team_member_id = $2
      `;

    const queryParams = [team_id, team_member_id, ...params];
    const result = await db.query(q, queryParams);

    let logGroups: any[] = [];

    if (result.rows.length) {
      const [data] = result.rows;

      const formattedLogs = await this.formatLog(data);

      logGroups = await this.getTimeLogDays(formattedLogs);
    }

    return logGroups;
  }

  private static async memberActivityLogsData(durationClause: string, minMaxDateClause: string, team_id: string, team_member_id: string, includeArchived:boolean, userId: string, params: any[]) {

    let archivedClause = "";
    let archivedParams: any[] = [];
    if (!includeArchived) {
      archivedClause = `AND (SELECT project_id FROM tasks WHERE id = tal.task_id) NOT IN (SELECT project_id FROM archived_projects WHERE archived_projects.user_id = $${params.length + 3})`;
      archivedParams = [userId];
    }

    const q = `
                SELECT user_id,
                      (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(al))), '[]'::JSON)
                      FROM (SELECT task_id,
                                   user_id,
                                   (SELECT project_id FROM tasks WHERE id = tal.task_id) AS project_id,
                                   tal.task_id AS task_id,
                                   (SELECT name FROM projects WHERE id = (SELECT project_id FROM tasks WHERE id = tal.task_id)) AS project_name,
                                    (SELECT name FROM tasks WHERE tasks.id = tal.task_id) AS task_name,
                                    CONCAT((SELECT key
                                            FROM projects
                                            WHERE id = (SELECT project_id FROM tasks WHERE tasks.id = tal.task_id)), '-',
                                          (SELECT task_no FROM tasks WHERE tasks.id = tal.task_id)) AS task_key,
                                    created_at,
                                    attribute_type,
                                    log_type,
                                    (CASE
                                        WHEN (attribute_type = 'status' AND old_value <> 'Unmapped')
                                            THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                        WHEN (attribute_type = 'priority' AND old_value <> 'Unmapped')
                                            THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                        WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                            THEN (SELECT name FROM project_phases WHERE id = old_value::UUID)
                                        ELSE (old_value) END) AS previous,

                                    (CASE
                                        WHEN (attribute_type = 'status' AND new_value <> 'Unmapped')
                                            THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                        WHEN (attribute_type = 'priority' AND new_value <> 'Unmapped')
                                            THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                        WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                            THEN (SELECT name FROM project_phases WHERE id = new_value::UUID)
                                        ELSE (new_value) END) AS current,

                                    (CASE
                                        WHEN (attribute_type = 'status' AND old_value <> 'Unmapped')
                                            THEN (SELECT ROW_TO_JSON(rec)
                                                  FROM (SELECT (SELECT name FROM task_statuses WHERE id = old_value::UUID),
                                                                (SELECT color_code
                                                                FROM sys_task_status_categories
                                                                WHERE id = (SELECT category_id FROM task_statuses WHERE id = old_value::UUID))) rec)
                                        ELSE (NULL) END) AS previous_status,

                                    (CASE
                                        WHEN (attribute_type = 'status' AND new_value <> 'Unmapped')
                                            THEN (SELECT ROW_TO_JSON(rec)
                                                  FROM (SELECT (SELECT name FROM task_statuses WHERE id = new_value::UUID),
                                                                (SELECT color_code
                                                                FROM sys_task_status_categories
                                                                WHERE id = (SELECT category_id FROM task_statuses WHERE id = new_value::UUID))) rec)
                                        ELSE (NULL) END) AS next_status,

                                    (CASE
                                        WHEN (attribute_type = 'priority' AND old_value <> 'Unmapped')
                                            THEN (SELECT ROW_TO_JSON(rec)
                                                  FROM (SELECT (SELECT name FROM task_priorities WHERE id = old_value::UUID),
                                                                (SELECT color_code FROM task_priorities WHERE id = old_value::UUID)) rec)
                                        ELSE (NULL) END) AS previous_priority,

                                    (CASE
                                        WHEN (attribute_type = 'priority' AND new_value <> 'Unmapped')
                                            THEN (SELECT ROW_TO_JSON(rec)
                                                  FROM (SELECT (SELECT name FROM task_priorities WHERE id = new_value::UUID),
                                                                (SELECT color_code FROM task_priorities WHERE id = new_value::UUID)) rec)
                                        ELSE (NULL) END) AS next_priority,

                                    (CASE
                                          WHEN (attribute_type = 'phase' AND old_value <> 'Unmapped')
                                              THEN (SELECT ROW_TO_JSON(rec)
                                                    FROM (SELECT (SELECT name FROM project_phases WHERE id = old_value::UUID),
                                                                  (SELECT color_code FROM project_phases WHERE id = old_value::UUID)) rec)
                                          ELSE (NULL) END) AS previous_phase,

                                      (CASE
                                          WHEN (attribute_type = 'phase' AND new_value <> 'Unmapped')
                                              THEN (SELECT ROW_TO_JSON(rec)
                                                    FROM (SELECT (SELECT name FROM project_phases WHERE id = new_value::UUID),
                                                                  (SELECT color_code FROM project_phases WHERE id = new_value::UUID)) rec)
                                          ELSE (NULL) END) AS next_phase

                            FROM task_activity_logs tal
                            WHERE tal.user_id = tmiv.user_id
                                  ${durationClause}
                                  AND tal.team_id = $1 AND tal.attribute_type IN ('status', 'priority', 'phase', 'end_date', 'start_date')
                                  ${archivedClause}
                            ORDER BY created_at DESC) al) AS activity_logs
                      ${minMaxDateClause}
                FROM team_member_info_view tmiv
                WHERE tmiv.team_id = $1
                AND tmiv.team_member_id = $2
      `;

    const result = await db.query(q, [team_id, team_member_id, ...params, ...archivedParams]);

    let logGroups: any[] = [];

    if (result.rows.length) {
      const [data] = result.rows;

      logGroups = await this.getActivityLogDays(data);
    }

    return logGroups;

  }

  protected static buildBillableQuery(selectedStatuses: { billable: boolean; nonBillable: boolean }, tableAlias = "tasks"): string {
    const { billable, nonBillable } = selectedStatuses;
  
    if (billable && nonBillable) {
      // Both are enabled, no need to filter
      return "";
    } else if (billable) {
      // Only billable is enabled
      return ` AND ${tableAlias}.billable IS TRUE`;
    } else if (nonBillable) {
      // Only non-billable is enabled
      return ` AND ${tableAlias}.billable IS FALSE`;
    } 

    return "";
  }

  @HandleExceptions()
  public static async getMemberTimelogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { team_member_id, team_id, duration, date_range, archived, billable } = req.body;

    // Get user timezone for proper date filtering
    const userTimezone = await this.getUserTimezone(req.user?.id as string);
    // $1 => team_id, $2 => team_member_id, so date params start at $3
    const durationClauseResult = this.getDateRangeClauseWithTimezoneParams(
      duration || DATE_RANGES.LAST_WEEK,
      date_range,
      userTimezone,
      3
    );
    const durationClause = durationClauseResult.clause;
    const durationParams = durationClauseResult.params;

    const minMaxDateClauseResult = this.getMinMaxDates(
      duration || DATE_RANGES.LAST_WEEK,
      date_range,
      "task_work_log",
      3 + durationParams.length
    );
    const minMaxDateClause = minMaxDateClauseResult.clause;
    const minMaxParams = minMaxDateClauseResult.params;

    const billableQuery = this.buildBillableQuery(billable);
    const queryParams = [...durationParams, ...minMaxParams];

    const logGroups = await this.memberTimeLogsData(
      durationClause,
      minMaxDateClause,
      team_id,
      team_member_id,
      archived,
      req.user?.id as string,
      billableQuery,
      queryParams
    );

    return res.status(200).send(new ServerResponse(true, logGroups));
  }

  @HandleExceptions()
  public static async getMemberTaskStats(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const { duration, date_range, team_member_id } = req.query;
    const includeArchived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    const archivedClause = includeArchived
    ? ""
    : `AND t.project_id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = t.project_id AND archived_projects.user_id = '${req.user?.id}')`;


    // Use parameterized queries
    // Note: $1 is used for team_member_id, so parameter offsets start from 2
    const assignClauseResult = this.memberAssignDurationFilter(duration as string, dateRange, 2);
    const assignClause = assignClauseResult.clause;
    const assignParams = assignClauseResult.params;
    let paramOffset = 2 + assignParams.length;
    
    const completedDurationResult = this.completedDurationFilter(duration as string, dateRange, paramOffset);
    const completedDurationClasue = completedDurationResult.clause;
    const completedParams = completedDurationResult.params;
    paramOffset += completedParams.length;
    
    const overdueClauseResult = this.getActivityLogsOverdue(duration as string, dateRange, paramOffset);
    const overdueClauseByDate = overdueClauseResult.clause;
    const overdueParams = overdueClauseResult.params;
    paramOffset += overdueParams.length;
    
    const taskSelectorClause = this.getTaskSelectorClause();
    
    const durationFilterResult = this.memberTasksDurationFilter(duration as string, dateRange, paramOffset);
    const durationFilter = durationFilterResult.clause;
    const durationParams = durationFilterResult.params;
    paramOffset += durationParams.length;

    const q = `
              SELECT name AS team_member_name,

                  (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(assigned))), '[]')
                  FROM (${taskSelectorClause}
                        FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                        WHERE ta.team_member_id = $1 ${assignClause} ${archivedClause}) assigned) AS assigned,

                  (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(assigned))), '[]')
                  FROM (${taskSelectorClause}
                        FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                        WHERE ta.team_member_id = $1 ${durationFilter} ${assignClause} ${archivedClause}) assigned) AS total,

                  (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(completed))), '[]')
                  FROM (${taskSelectorClause}
                        FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                        WHERE ta.team_member_id = $1
                          AND is_completed(status_id, t.project_id)
                          ${completedDurationClasue} ${archivedClause}) completed) AS completed,

                  (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(ongoing))), '[]')
                  FROM (${taskSelectorClause}
                        FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                        WHERE ta.team_member_id = $1
                          AND is_doing(status_id, t.project_id) ${archivedClause}) ongoing) AS ongoing,

                  (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(overdue))), '[]')
                  FROM (${taskSelectorClause}
                        FROM tasks t
                                  LEFT JOIN tasks_assignees ta ON t.id = ta.task_id
                        WHERE ta.team_member_id = $1 ${overdueClauseByDate} ${archivedClause}) overdue) AS overdue

              FROM team_member_info_view WHERE team_member_id =  $1;
    `;

    // Pass all parameters
    const queryParams = [team_member_id, ...assignParams, ...completedParams, ...overdueParams, ...durationParams];
    const result = await db.query(q, queryParams);
    const [data] = result.rows;

    if (data) {
      for (const taskArray of [data.assigned, data.completed, data.ongoing, data.overdue]) {
        this.updateTaskProperties(taskArray);
      }
    }

    const body = {
      team_member_name: data.team_member_name,
      groups: [
        {
          name: "Total Tasks",
          color_code: "#7590c9",
          tasks: data.total ? data.total : 0
        },
        {
          name: "Tasks Assigned",
          color_code: "#7590c9",
          tasks: data.assigned ? data.assigned : 0
        },
        {
          name: "Tasks Completed",
          color_code: "#75c997",
          tasks: data.completed ? data.completed : 0
        },
        {
          name: "Tasks Overdue",
          color_code: "#eb6363",
          tasks: data.overdue ? data.overdue : 0
        },
        {
          name: "Tasks Ongoing",
          color_code: "#7cb5ec",
          tasks: data.ongoing ? data.ongoing : 0
        },
      ]
    };

    return res.status(200).send(new ServerResponse(true, body));
  }

  @HandleExceptions()
  public static async getTimelogsFlat(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { team_member_id, duration, date_range, billable, search } = req.body || {};

    // Get the team_id from request user
    const teamId = req.user?.team_id;

    // Get user timezone and date clauses
    const userTimezone = await this.getUserTimezone(req.user?.id as string);
    
    // Build params array with timezone first, then date range values
    const params: any[] = [userTimezone];
    let paramIndex = 2;
    
    // Add date range parameters and build duration clause
    let durationClause = '';
    if (date_range && date_range.length === 2) {
      const startDate = moment(date_range[0]).format('YYYY-MM-DD HH:mm:ss');
      const endDate = moment(date_range[1]).add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
      durationClause = `AND twl.created_at >= $${paramIndex}::TIMESTAMP AND twl.created_at < $${paramIndex + 1}::TIMESTAMP`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else {
      // Use default duration logic if no date_range provided
      const rawDurationClause = this.getDateRangeClauseWithTimezone(duration || DATE_RANGES.LAST_WEEK, date_range, userTimezone);
      // This method returns hardcoded $1, $2 - we need to extract the logic or handle it differently
      // For now, use a simpler approach for common cases
      if (!duration || duration === DATE_RANGES.LAST_WEEK) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 week')::TIMESTAMP`;
      } else if (duration === DATE_RANGES.YESTERDAY) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP AND twl.created_at < CURRENT_DATE::TIMESTAMP`;
      } else if (duration === DATE_RANGES.LAST_MONTH) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 month')::TIMESTAMP`;
      } else if (duration === DATE_RANGES.LAST_QUARTER) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '3 months')::TIMESTAMP`;
      }
    }

    const billableQuery = this.buildBillableQuery(billable || { billable: true, nonBillable: true }, "t");

    // Team filter - only show logs from current team if team_id is available
    let teamFilter = '';

    if (teamId) {
      teamFilter = `AND p.team_id = $${paramIndex}`;
      params.push(teamId);
      paramIndex++;
    }

    // Optional member filter
    const memberFilter = team_member_id ? `AND u.id = (SELECT user_id FROM team_members WHERE id = $${paramIndex})` : '';
    if (team_member_id) {
      params.push(team_member_id);
      paramIndex++;
    }

    // Optional search filter (task, project, member, description)
    const searchFilter = search ? `AND (
      LOWER(t.name) LIKE LOWER($${paramIndex}) OR
      LOWER(p.name) LIKE LOWER($${paramIndex}) OR
      LOWER(u.name) LIKE LOWER($${paramIndex}) OR
      LOWER(COALESCE(twl.description, '')) LIKE LOWER($${paramIndex})
    )` : '';
    if (search) {
      params.push(`%${search}%`);
    }

    const q = `
      SELECT
        (twl.created_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::DATE AS log_day,
        u.name AS user_name,
        p.name AS project_name,
        t.name AS task_name,
        twl.time_spent,
        twl.description
      FROM task_work_log twl
      JOIN tasks t ON t.id = twl.task_id
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = twl.user_id
      WHERE 1=1
        ${teamFilter}
        ${memberFilter}
        ${durationClause}
        ${billableQuery}
        ${searchFilter}
      ORDER BY log_day DESC, user_name ASC`;

    const rows = await db.query(q, params);

    // Group rows by day
    const groups: any[] = [];
    const byDay: Record<string, any[]> = {};
    for (const r of rows.rows) {
      if (!byDay[r.log_day]) byDay[r.log_day] = [];
      byDay[r.log_day].push({
        user_name: r.user_name,
        project_name: r.project_name,
        task_name: r.task_name,
        time_spent_string: this.secondsToReadable(r.time_spent || 0),
        description: r.description || null,
      });
    }
    for (const day of Object.keys(byDay).sort((a, b) => (a < b ? 1 : -1))) {
      groups.push({ log_day: day, logs: byDay[day] });
    }

    return res.status(200).send(new ServerResponse(true, groups));
  }

  @HandleExceptions()
  public static async exportTimelogsFlatCSV(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    let { team_member_id, duration, date_range, billable, search } = req.query;

    // Convert query parameters to strings or undefined
    const teamMemberIdStr = this.convertQueryParam(team_member_id);
    const durationStr = this.convertQueryParam(duration);
    const dateRangeStr = this.convertQueryParam(date_range);
    const billableStr = this.convertQueryParam(billable);
    const searchStr = this.convertQueryParam(search);

    // Get data using shared helper method
    const rows = await this.getTimelogsFlatData(req, teamMemberIdStr, durationStr, dateRangeStr, billableStr, searchStr);

    // Prepare CSV data
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Time-Logs-${exportDate}`;

    // Build CSV content
    const csvRows: string[] = [];

    // Add headers
    csvRows.push("Date,Member,Project,Task,Description,Duration");

    // Add data rows
    for (const row of rows.rows) {
      const date = row.log_day || "";
      const member = (row.user_name || "").replace(/"/g, '""'); // Escape quotes
      const project = (row.project_name || "").replace(/"/g, '""');
      const task = (row.task_name || "").replace(/"/g, '""');
      const description = (row.description || "").replace(/"/g, '""');
      const duration = this.secondsToReadable(row.time_spent || 0);

      csvRows.push(`"${date}","${member}","${project}","${task}","${description}","${duration}"`);
    }

    const csvContent = csvRows.join("\n");

    // Set response headers for CSV
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}.csv"`);

    // Add BOM for better Excel compatibility
    res.write('\uFEFF' + csvContent);
    res.end();
  }

  private static secondsToReadable(totalSeconds: number): string {
    const sec = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(sec / 3600);
    const minutes = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  }

  /**
   * Helper function to convert query parameters to strings or undefined
   */
  private static convertQueryParam(param: any): string | undefined {
    if (Array.isArray(param)) {
      return param[0] ? String(param[0]) : undefined;
    }
    return param ? String(param) : undefined;
  }

  /**
   * Shared helper method to fetch timelogs data for both CSV and Excel exports
   */
  private static async getTimelogsFlatData(req: IWorkLenzRequest, team_member_id?: string, duration?: string, date_range?: string, billable?: string, search?: string): Promise<any> {
    // Get the team_id from request user
    const teamId = req.user?.team_id;

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    // Get user timezone
    const userTimezone = await this.getUserTimezone(req.user?.id as string);
    
    // Build params array with timezone first, then date range values
    const params: any[] = [userTimezone];
    let paramIndex = 2;
    
    // Add date range parameters and build duration clause
    let durationClause = '';
    if (dateRange && dateRange.length === 2) {
      const startDate = moment(dateRange[0]).format('YYYY-MM-DD HH:mm:ss');
      const endDate = moment(dateRange[1]).add(1, 'day').format('YYYY-MM-DD HH:mm:ss');
      durationClause = `AND twl.created_at >= $${paramIndex}::TIMESTAMP AND twl.created_at < $${paramIndex + 1}::TIMESTAMP`;
      params.push(startDate, endDate);
      paramIndex += 2;
    } else {
      // Use default duration logic if no date_range provided
      if (!duration || duration === DATE_RANGES.LAST_WEEK) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 week')::TIMESTAMP`;
      } else if (duration === DATE_RANGES.YESTERDAY) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 day')::TIMESTAMP AND twl.created_at < CURRENT_DATE::TIMESTAMP`;
      } else if (duration === DATE_RANGES.LAST_MONTH) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 month')::TIMESTAMP`;
      } else if (duration === DATE_RANGES.LAST_QUARTER) {
        durationClause = `AND twl.created_at >= (CURRENT_DATE - INTERVAL '3 months')::TIMESTAMP`;
      }
    }

    // Parse billable filter
    let billableFilter = { billable: true, nonBillable: true };
    if (typeof billable === "string") {
      try {
        billableFilter = JSON.parse(billable);
      } catch (e) {
        // Use default
      }
    }
    const billableQuery = this.buildBillableQuery(billableFilter, "t");

    // Team filter - only show logs from current team if team_id is available
    let teamFilter = '';
    if (teamId) {
      teamFilter = `AND p.team_id = $${paramIndex}`;
      params.push(teamId);
      paramIndex++;
    }

    // Optional member filter
    const memberFilter = team_member_id ? `AND u.id = (SELECT user_id FROM team_members WHERE id = $${paramIndex})` : '';
    if (team_member_id) {
      params.push(team_member_id);
      paramIndex++;
    }

    // Optional search filter
    const searchFilter = search ? `AND (
      LOWER(t.name) LIKE LOWER($${paramIndex}) OR
      LOWER(p.name) LIKE LOWER($${paramIndex}) OR
      LOWER(u.name) LIKE LOWER($${paramIndex}) OR
      LOWER(COALESCE(twl.description, '')) LIKE LOWER($${paramIndex})
    )` : '';
    if (search) {
      params.push(`%${search}%`);
    }

    const q = `
      SELECT
        (twl.created_at AT TIME ZONE 'UTC' AT TIME ZONE $1)::DATE AS log_day,
        u.name AS user_name,
        p.name AS project_name,
        t.name AS task_name,
        twl.time_spent,
        twl.description
      FROM task_work_log twl
      JOIN tasks t ON t.id = twl.task_id
      JOIN projects p ON p.id = t.project_id
      JOIN users u ON u.id = twl.user_id
      WHERE 1=1
        ${teamFilter}
        ${memberFilter}
        ${durationClause}
        ${billableQuery}
        ${searchFilter}
      ORDER BY log_day DESC, user_name ASC`;

    return await db.query(q, params);
  }

  @HandleExceptions()
  public static async exportTimelogsFlatExcel(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<void> {
    let { team_member_id, duration, date_range, billable, search } = req.query;

    // Convert query parameters to strings or undefined
    const teamMemberIdStr = this.convertQueryParam(team_member_id);
    const durationStr = this.convertQueryParam(duration);
    const dateRangeStr = this.convertQueryParam(date_range);
    const billableStr = this.convertQueryParam(billable);
    const searchStr = this.convertQueryParam(search);

    // Get data using shared helper method
    const rows = await this.getTimelogsFlatData(req, teamMemberIdStr, durationStr, dateRangeStr, billableStr, searchStr);

    // Create Excel workbook
    const workbook = new Excel.Workbook();
    const worksheet = workbook.addWorksheet('Time Logs');

    // Add headers
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Member', key: 'member', width: 20 },
      { header: 'Project', key: 'project', width: 25 },
      { header: 'Task', key: 'task', width: 30 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Duration', key: 'duration', width: 15 }
    ];

    // Style the header row
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6E6FA' }
    };

    // Add data rows
    for (const row of rows.rows) {
      worksheet.addRow({
        date: moment(row.log_day).format('MMM DD, YYYY'),
        member: row.user_name || '',
        project: row.project_name || '',
        task: row.task_name || '',
        description: row.description || '',
        duration: this.secondsToReadable(row.time_spent || 0)
      });
    }

    // Set response headers for Excel
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Time-Logs-${exportDate}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);

    // Write Excel file to response
    await workbook.xlsx.write(res);
    res.end();
  }

  private static updateTaskProperties(tasks: any[]) {
    for (const task of tasks) {
        task.project_color = getColor(task.project_name);
        task.estimated_string = formatDuration(moment.duration(~~(task.total_minutes), "seconds"));
        task.time_spent_string = formatDuration(moment.duration(~~(task.time_logged), "seconds"));
        task.overlogged_time_string = formatDuration(moment.duration(~~(task.overlogged_time), "seconds"));
        task.overdue_days = task.days_overdue ? task.days_overdue : null;
    }
}

@HandleExceptions()
public static async getSingleMemberProjects(req: IWorkLenzRequest, res: IWorkLenzResponse) {
  const { team_member_id } = req.query;
  const includeArchived = req.query.archived === "true";

  const archivedClause = includeArchived
    ? ""
    : `AND projects.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id AND archived_projects.user_id = '${req.user?.id}')`;

  const q = `SELECT id,
                    name,
                    color_code,
                    start_date,
                    end_date,

                    (SELECT icon FROM sys_project_statuses WHERE id = projects.status_id) AS status_icon,
                    (SELECT name FROM sys_project_statuses WHERE id = projects.status_id) AS status_name,
                    (SELECT color_code FROM sys_project_statuses WHERE id = projects.status_id) AS status_color,

                    (SELECT name FROM sys_project_healths WHERE id = projects.health_id) AS health_name,
                    (SELECT color_code FROM sys_project_healths WHERE id = projects.health_id) AS health_color,

                    (SELECT name FROM project_categories WHERE id = projects.category_id) AS category_name,
                    (SELECT color_code
                      FROM project_categories
                      WHERE id = projects.category_id) AS category_color,

                    (SELECT COALESCE(ROW_TO_JSON(pm), '{}'::JSON)
                      FROM (SELECT team_member_id AS pm_id,
                                  (SELECT COALESCE(ROW_TO_JSON(pmi), '{}'::JSON)
                                    FROM (SELECT name, email, avatar_url
                                          FROM team_member_info_view tmiv
                                          WHERE tmiv.team_member_id = pm.team_member_id) pmi) AS project_manager_info,
                                  EXISTS(SELECT email
                                          FROM email_invitations
                                          WHERE team_member_id = pm.team_member_id
                                            AND email_invitations.team_id = (SELECT team_id
                                                                            FROM team_member_info_view
                                                                            WHERE team_member_id = pm.team_member_id)) AS pending_invitation,
                                  (SELECT active FROM team_members WHERE id = pm.team_member_id)
                            FROM project_members pm
                            WHERE project_id = projects.id
                              AND project_access_level_id =
                                  (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')) pm) AS project_manager,

                    (SELECT COALESCE(SUM(total_minutes), 0)
                      FROM tasks
                      WHERE project_id = projects.id) AS estimated_time,

                    (SELECT SUM((SELECT COALESCE(SUM(time_spent), 0)
                                  FROM task_work_log
                                  WHERE task_id = tasks.id))
                      FROM tasks
                      WHERE project_id = projects.id) AS actual_time,

                    (SELECT name FROM team_member_info_view WHERE team_member_id = $1) As team_member_name

              FROM projects
              WHERE projects.id IN (SELECT project_id FROM project_members WHERE team_member_id = $1) ${archivedClause};`;

  const result = await db.query(q, [team_member_id]);
  const data = result.rows;

  for (const row of data) {
    row.estimated_time = int(row.estimated_time);
    row.actual_time = int(row.actual_time);
    row.estimated_time_string = this.convertMinutesToHoursAndMinutes(int(row.estimated_time));
    row.actual_time_string = this.convertSecondsToHoursAndMinutes(int(row.actual_time));
    row.days_left = this.getDaysLeft(row.end_date);
    row.is_overdue = this.isOverdue(row.end_date);
    if (row.days_left && row.is_overdue) {
      row.days_left = row.days_left.toString().replace(/-/g, "");
    }
    row.is_today = this.isToday(row.end_date);
    if (row.project_manager) {
      row.project_manager.name = row.project_manager.project_manager_info.name;
      row.project_manager.avatar_url = row.project_manager.project_manager_info.avatar_url;
      row.project_manager.color_code = getColor(row.project_manager.name);
    }
    row.project_health = row.health_name ? row.health_name : null;
  }

  const body = {
    team_member_name: data[0].team_member_name,
    projects: data
  };

  return res.status(200).send(new ServerResponse(true, body));

}

  @HandleExceptions()
  public static async exportMemberProjects(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const teamMemberId = (req.query.team_member_id as string)?.trim() || null;
    const teamId = (req.query.team_id as string)?.trim() || null;
    const memberName = (req.query.team_member_name as string)?.trim() || null;
    const teamName = (req.query.team_name as string)?.trim() || "";
    const archived = req.query.archived === "true";

    const result = await this.getMemberProjectsData(teamId as string, teamMemberId as string, "", [], archived, req.user?.id as string, req);

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${memberName} projects - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Projects");

    sheet.columns = [
      { header: "Project", key: "project", width: 30 },
      { header: "Team", key: "team", width: 20 },
      { header: "Tasks", key: "tasks", width: 20 },
      { header: "Contribution(%)", key: "contribution", width: 20 },
      { header: "Incompleted Tasks", key: "incompleted_tasks", width: 20 },
      { header: "Completed Tasks", key: "completed_tasks", width: 20 },
      { header: "Overdue Tasks", key: "overdue_tasks", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 }
    ];

    // set title
    sheet.getCell("A1").value = `Projects of ${memberName} - ${teamName}`;
    sheet.mergeCells("A1:H1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:H2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    // const start = 'duartion start';
    // const end = 'duartion end';
    // sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    // sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(4).values = ["Project", "Team", "Tasks", "Contribution(%)", "Incompleted Tasks", "Completed Tasks", "Overdue Tasks", "Logged Time"];
    sheet.getRow(4).font = { bold: true };

    for (const project of result) {
      sheet.addRow({
        project: project.name,
        team: project.team,
        tasks: project.task_count ? project.task_count.toString() : "-",
        contribution: project.contribution ? project.contribution.toString() : "-",
        incompleted_tasks: project.incompleted ? project.incompleted.toString() : "-",
        completed_tasks: project.completed ? project.completed.toString() : "-",
        overdue_tasks: project.overdue ? project.overdue.toString() : "-",
        logged_time: project.time_logged ? project.time_logged.toString() : "-"
      });
    }

    // download excel
    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });

  }

}