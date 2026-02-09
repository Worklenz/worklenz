import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import ReportingProjectsBase from "./reporting-projects-base";
import ReportingControllerBase from "../reporting-controller-base";
import moment from "moment";
import { DATE_RANGES, TASK_PRIORITY_COLOR_ALPHA } from "../../../shared/constants";
import { getColor, int, formatDuration, formatLogText } from "../../../shared/utils";
import { SqlHelper } from "../../../shared/sql-helpers";
import db from "../../../config/db";

export default class ReportingProjectsController extends ReportingProjectsBase {

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // teamId is $1, size is $2, offset is $3, so search params start at $4
    const { searchQuery, searchParams, sortField, sortOrder, size, offset } = this.toPaginationOptions(req.query, ["p.name"], false, 4);
    const archived = req.query.archived === "true";

    const teamId = this.getCurrentTeamId(req);

    // Note: teamId is $1, size is $2, offset is $3, search params are $4+, then filter params continue after
    const filterParams: any[] = [...searchParams];
    let paramOffset = 4 + searchParams.length; // Start after teamId, size, offset, and search params

    let statusesClause = "";
    if (req.query.statuses) {
      const statusIds = (req.query.statuses as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(statusIds, 'p.status_id', paramOffset);
      statusesClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let healthsClause = "";
    if (req.query.healths) {
      const healthIds = (req.query.healths as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(healthIds, 'p.health_id', paramOffset);
      healthsClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let categoriesClause = "";
    if (req.query.categories) {
      const categoryIds = (req.query.categories as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(categoryIds, 'p.category_id', paramOffset);
      categoriesClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let projectManagersClause = "";
    if (req.query.project_managers) {
      const managerIds = (req.query.project_managers as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildInClause(managerIds, paramOffset);
      projectManagersClause = `AND p.id IN(SELECT project_id FROM project_members WHERE team_member_id IN(SELECT id FROM team_members WHERE user_id IN (${clause})) AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'))`;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let teamsClause = "";
    if (req.query.teams) {
      const teamIds = (req.query.teams as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(teamIds, 'p.team_id', paramOffset);
      teamsClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let archivedClause = "";
    if (!archived) {
      archivedClause = `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = $${paramOffset})`;
      filterParams.push(req.user?.id);
      paramOffset++;
    }

    // Add project filtering for Team Leads
    const projectFilterClause = await this.buildProjectFilterForTeamLead(req);
    const teamFilterClause = `in_organization(p.team_id, $1) ${projectFilterClause} ${teamsClause}`;

    const result = await ReportingControllerBase.getProjectsByTeam(teamId as string, size, offset, searchQuery, sortField, sortOrder, statusesClause, healthsClause, categoriesClause, archivedClause, teamFilterClause, projectManagersClause, filterParams);

    for (const project of result.projects) {
      project.team_color = getColor(project.team_name) + TASK_PRIORITY_COLOR_ALPHA;
      project.days_left = ReportingControllerBase.getDaysLeft(project.end_date);
      project.is_overdue = ReportingControllerBase.isOverdue(project.end_date);
      if (project.days_left && project.is_overdue) {
        project.days_left = project.days_left.toString().replace(/-/g, "");
      }
      project.is_today = this.isToday(project.end_date);
      project.estimated_time = int(project.estimated_time);
      project.actual_time = int(project.actual_time);
      project.estimated_time_string = this.convertMinutesToHoursAndMinutes(int(project.estimated_time));
      project.actual_time_string = this.convertSecondsToHoursAndMinutes(int(project.actual_time));
      project.tasks_stat = {
        todo: this.getPercentage(int(project.tasks_stat.todo), +project.tasks_stat.total),
        doing: this.getPercentage(int(project.tasks_stat.doing), +project.tasks_stat.total),
        done: this.getPercentage(int(project.tasks_stat.done), +project.tasks_stat.total)
      };
      if (project.update.length > 0) {
        const [update] = project.update;
        const placeHolders = update.content.match(/{\d+}/g);
        if (placeHolders) {
          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
            const index = parseInt(placeHolder.match(/\d+/)[0]);
            if (index >= 0 && index < update.mentions.length) {
              update.content = update.content.replace(placeHolder, `
                  <span class='mentions'> @${update.mentions[index].user_name} </span>`);
            }
          });
        }
        project.comment = update.content;
      }
      if (project.last_activity) {
        if (project.last_activity.attribute_type === "estimation") {
          project.last_activity.previous = formatDuration(moment.duration(project.last_activity.previous, "minutes"));
          project.last_activity.current = formatDuration(moment.duration(project.last_activity.current, "minutes"));
        }
        if (project.last_activity.assigned_user) project.last_activity.assigned_user.color_code = getColor(project.last_activity.assigned_user.name);
        project.last_activity.done_by.color_code = getColor(project.last_activity.done_by.name);
        project.last_activity.log_text = await formatLogText(project.last_activity);
        project.last_activity.attribute_type = project.last_activity.attribute_type?.replace(/_/g, " ");
        project.last_activity.last_activity_string = `${project.last_activity.done_by.name} ${project.last_activity.log_text} ${project.last_activity.attribute_type}`;
      }
    }

    return res.status(200).send(new ServerResponse(true, result));
  }

  protected static getMinMaxDates(key: string, dateRange: string[], paramOffset = 1): { clause: string; params: any[] } {
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
      return { clause: ",(SELECT (CURRENT_DATE - INTERVAL '1 day')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date", params: [] };
    if (key === DATE_RANGES.LAST_WEEK)
      return { clause: ",(SELECT (CURRENT_DATE - INTERVAL '1 week')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date", params: [] };
    if (key === DATE_RANGES.LAST_MONTH)
      return { clause: ",(SELECT (CURRENT_DATE - INTERVAL '1 month')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date", params: [] };
    if (key === DATE_RANGES.LAST_QUARTER)
      return { clause: ",(SELECT (CURRENT_DATE - INTERVAL '3 months')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date", params: [] };
    if (key === DATE_RANGES.ALL_TIME)
      return { clause: ",(SELECT (MIN(task_work_log.created_at)::DATE) FROM task_work_log WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)) AS start_date, (SELECT (MAX(task_work_log.created_at)::DATE) FROM task_work_log WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)) AS end_date", params: [] };

    return { clause: "", params: [] };
  }

  @HandleExceptions()
  public static async getProjectTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body.id;
    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);
    // Extract clause and params from getMinMaxDates
    const minMaxDateClauseResult = this.getMinMaxDates(duration || DATE_RANGES.LAST_WEEK, date_range, 2);
    const minMaxDateClause = minMaxDateClauseResult.clause;
    const minMaxParams = minMaxDateClauseResult.params;

    const q = `SELECT
                    (SELECT name FROM projects WHERE projects.id = $1) AS project_name,
                    (SELECT key FROM projects WHERE projects.id = $1) AS project_key,
                    (SELECT task_no FROM tasks WHERE tasks.id = task_work_log.task_id) AS task_key_num,
                    (SELECT name FROM tasks WHERE tasks.id = task_work_log.task_id) AS task_name,
                    task_work_log.time_spent,
                    (SELECT name FROM users WHERE users.id = task_work_log.user_id) AS user_name,
                    (SELECT email FROM users WHERE users.id = task_work_log.user_id) AS user_email,
                    (SELECT avatar_url FROM users WHERE users.id = task_work_log.user_id) AS avatar_url,
                    task_work_log.created_at
                    ${minMaxDateClause}
                FROM task_work_log
                WHERE
                    task_id IN (select id from tasks WHERE project_id = $1)
                    ${durationClause}
                ORDER BY task_work_log.created_at DESC`;

    // Pass all parameters
    const queryParams = [projectId, ...minMaxParams];
    const result = await db.query(q, queryParams);

    const formattedResult = await this.formatLog(result.rows);

    const logGroups = await this.getTimeLogDays(formattedResult);

    return res.status(200).send(new ServerResponse(true, logGroups));
  }

  private static async formatLog(result: any[]) {

    result.forEach((row) => {
      const duration = moment.duration(row.time_spent, "seconds");
      row.time_spent_string = this.formatDuration(duration);
      row.task_key = `${row.project_key}-${row.task_key_num}`;
    });

    return result;
  }

  private static async getTimeLogDays(result: any[]) {
    if (result.length) {
      const startDate = moment(result[0].start_date).isValid() ? moment(result[0].start_date, "YYYY-MM-DD").clone() : null;
      const endDate = moment(result[0].end_date).isValid() ? moment(result[0].end_date, "YYYY-MM-DD").clone() : null;

      const days = [];
      const logDayGroups = [];

      while (startDate && moment(startDate).isSameOrBefore(endDate)) {
        days.push(startDate.clone().format("YYYY-MM-DD"));
        startDate ? startDate.add(1, "day") : null;
      }

      for (const day of days) {
        const logsForDay = result.filter((log) => moment(moment(log.created_at).format("YYYY-MM-DD")).isSame(moment(day).format("YYYY-MM-DD")));
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
  public static async getGrouped(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    // teamId is $1, so search params start at $2
    const { searchQuery, searchParams, sortField, sortOrder, size, offset } = this.toPaginationOptions(req.query, ["p.name"], false, 2);
    const archived = req.query.archived === "true";
    const groupBy = (req.query.group_by as string) || "category";

    const teamId = this.getCurrentTeamId(req);

    // Note: teamId is $1, search params are $2+, filter params continue after (no LIMIT/OFFSET in grouped query)
    const filterParams: any[] = [...searchParams];
    let paramOffset = 2 + searchParams.length; // Start after teamId and search params

    let statusesClause = "";
    if (req.query.statuses) {
      const statusIds = (req.query.statuses as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(statusIds, 'p.status_id', paramOffset);
      statusesClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let healthsClause = "";
    if (req.query.healths) {
      const healthIds = (req.query.healths as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(healthIds, 'p.health_id', paramOffset);
      healthsClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let categoriesClause = "";
    if (req.query.categories) {
      const categoryIds = (req.query.categories as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(categoryIds, 'p.category_id', paramOffset);
      categoriesClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let projectManagersClause = "";
    if (req.query.project_managers) {
      const managerIds = (req.query.project_managers as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildInClause(managerIds, paramOffset);
      projectManagersClause = `AND p.id IN(SELECT project_id FROM project_members WHERE team_member_id IN(SELECT id FROM team_members WHERE user_id IN (${clause})) AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'))`;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let teamsClause = "";
    if (req.query.teams) {
      const teamIds = (req.query.teams as string).split(",").filter(id => id.trim());
      const { clause, params } = SqlHelper.buildOptionalInClause(teamIds, 'p.team_id', paramOffset);
      teamsClause = clause;
      filterParams.push(...params);
      paramOffset += params.length;
    }

    let archivedClause = "";
    if (!archived) {
      archivedClause = `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = $${paramOffset})`;
      filterParams.push(req.user?.id);
      paramOffset++;
    }

    // Add project filtering for Team Leads
    const projectFilterClause = await this.buildProjectFilterForTeamLead(req);
    const teamFilterClause = `in_organization(p.team_id, $1) ${projectFilterClause} ${teamsClause}`;

    // Determine grouping fields based on groupBy parameter
    let groupField = "";
    let groupName = "";
    let groupColor = "";
    let groupJoin = "";
    let groupByFields = "";
    let groupOrderBy = "";

    switch (groupBy) {
      case "status":
        groupField = "COALESCE(p.status_id::text, 'no-status')";
        groupName = "COALESCE(ps.name, 'No Status')";
        groupColor = "COALESCE(ps.color_code, '#888')";
        groupByFields = "p.status_id, ps.name, ps.color_code";
        groupOrderBy = "COALESCE(ps.name, 'No Status')";
        break;
      case "health":
        groupField = "COALESCE(p.health_id::text, 'not-set')";
        groupName = "COALESCE(sph.name, 'Not Set')";
        groupColor = "COALESCE(sph.color_code, '#888')";
        // Join already exists at line 427: LEFT JOIN sys_project_healths sph ON p.health_id = sph.id
        groupByFields = "p.health_id, sph.name, sph.color_code";
        groupOrderBy = "COALESCE(sph.name, 'Not Set')";
        break;
      case "team":
        groupField = "COALESCE(p.team_id::text, 'no-team')";
        groupName = "COALESCE(t.name, 'No Team')";
        groupColor = "COALESCE('#1890ff', '#888')";
        groupJoin = "LEFT JOIN teams t ON p.team_id = t.id";
        groupByFields = "p.team_id, t.name";
        groupOrderBy = "COALESCE(t.name, 'No Team')";
        break;
      case "manager":
        groupField = "COALESCE((SELECT pm.team_member_id::text FROM project_members pm WHERE pm.project_id = p.id AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER') LIMIT 1), 'no-manager')";
        groupName = "COALESCE((SELECT name FROM team_member_info_view tmiv WHERE tmiv.team_member_id = (SELECT pm.team_member_id FROM project_members pm WHERE pm.project_id = p.id AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER') LIMIT 1)), 'No Manager')";
        groupColor = "'#1890ff'";
        groupByFields = "(SELECT pm.team_member_id FROM project_members pm WHERE pm.project_id = p.id AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER') LIMIT 1), (SELECT name FROM team_member_info_view tmiv WHERE tmiv.team_member_id = (SELECT pm.team_member_id FROM project_members pm WHERE pm.project_id = p.id AND pm.project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER') LIMIT 1))";
        groupOrderBy = groupName;
        break;
      case "category":
      default:
        groupField = "COALESCE(p.category_id::text, 'uncategorized')";
        groupName = "COALESCE(pc.name, 'Uncategorized')";
        groupColor = "COALESCE(pc.color_code, '#888')";
        groupByFields = "p.category_id, pc.name, pc.color_code";
        groupOrderBy = "COALESCE(pc.name, 'Uncategorized')";
    }

    // Build optimized query with group-level task aggregations
    const q = `
      WITH project_tasks AS (
        SELECT 
          t.project_id,
          COUNT(t.id) AS total_tasks,
          COUNT(CASE WHEN is_completed(t.status_id, t.project_id) IS TRUE THEN 1 END) AS done_tasks,
          COUNT(CASE WHEN is_doing(t.status_id, t.project_id) IS TRUE THEN 1 END) AS doing_tasks,
          COUNT(CASE WHEN is_todo(t.status_id, t.project_id) IS TRUE THEN 1 END) AS todo_tasks
        FROM tasks t
        WHERE t.archived IS FALSE
        GROUP BY t.project_id
      )
      SELECT 
        ${groupField} AS group_id,
        ${groupName} AS group_name,
        ${groupColor} AS group_color,
        COUNT(DISTINCT p.id) AS project_count,
        COALESCE(SUM(pt.total_tasks), 0)::INT AS total_tasks,
        COALESCE(SUM(pt.done_tasks), 0)::INT AS done_tasks,
        COALESCE(SUM(pt.doing_tasks), 0)::INT AS doing_tasks,
        COALESCE(SUM(pt.todo_tasks), 0)::INT AS todo_tasks,
        COALESCE(ARRAY_TO_JSON(ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'id', p.id,
            'name', p.name,
            'color_code', p.color_code,
            'category_id', pc.id,
            'category_name', pc.name,
            'category_color', pc.color_code,
            'status_id', ps.id,
            'status_name', ps.name,
            'status_color', ps.color_code,
            'health_id', p.health_id,
            'health_name', sph.name,
            'health_color', sph.color_code,
            'team_id', p.team_id,
            'team_name', (SELECT name FROM teams WHERE id = p.team_id),
            'start_date', p.start_date,
            'end_date', p.end_date,
            'tasks_stat', JSON_BUILD_OBJECT(
              'total', COALESCE(pt.total_tasks, 0),
              'todo', COALESCE(pt.todo_tasks, 0),
              'doing', COALESCE(pt.doing_tasks, 0),
              'done', COALESCE(pt.done_tasks, 0)
            )
          ) ORDER BY p.name
        )), '[]'::JSON) AS projects
      FROM projects p
      LEFT JOIN project_categories pc ON p.category_id = pc.id
      LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
      LEFT JOIN sys_project_healths sph ON p.health_id = sph.id
      LEFT JOIN project_tasks pt ON p.id = pt.project_id
      ${groupJoin}
      WHERE ${teamFilterClause} ${searchQuery} ${healthsClause} ${statusesClause} ${categoriesClause} ${projectManagersClause} ${archivedClause}
      GROUP BY ${groupByFields}
      ORDER BY ${groupOrderBy}
    `;

    // Build final params: teamId ($1), searchParams ($2+), then filter params
    // Note: getGrouped query doesn't use LIMIT/OFFSET
    const finalParams = [teamId, ...filterParams];
    const result = await db.query(q, finalParams);

    const groups = result.rows.map(row => ({
      group_id: row.group_id,
      group_name: row.group_name,
      group_color: row.group_color,
      project_count: int(row.project_count),
      total_tasks: int(row.total_tasks),
      done_tasks: int(row.done_tasks),
      doing_tasks: int(row.doing_tasks),
      todo_tasks: int(row.todo_tasks),
      projects: row.projects
    }));

    return res.status(200).send(new ServerResponse(true, {
      groups,
      total_groups: groups.length
    }));
  }

}
