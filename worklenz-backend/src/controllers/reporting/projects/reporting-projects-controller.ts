import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import ReportingProjectsBase from "./reporting-projects-base";
import ReportingControllerBase from "../reporting-controller-base";
import moment from "moment";
import { DATE_RANGES, TASK_PRIORITY_COLOR_ALPHA } from "../../../shared/constants";
import { getColor, int, formatDuration, formatLogText } from "../../../shared/utils";
import db from "../../../config/db";

export default class ReportingProjectsController extends ReportingProjectsBase {

  private static flatString(text: string) {
    return (text || "").split(",").map(s => `'${s}'`).join(",");
  }

  @HandleExceptions()
  public static async get(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { searchQuery, sortField, sortOrder, size, offset } = this.toPaginationOptions(req.query, ["p.name"]);
    const archived = req.query.archived === "true";

    const teamId = this.getCurrentTeamId(req);

    const statusesClause = req.query.statuses as string
      ? `AND p.status_id IN (${this.flatString(req.query.statuses as string)})`
      : "";

    const healthsClause = req.query.healths as string
      ? `AND p.health_id IN (${this.flatString(req.query.healths as string)})`
      : "";

    const categoriesClause = req.query.categories as string
      ? `AND p.category_id IN (${this.flatString(req.query.categories as string)})`
      : "";

    // const projectManagersClause = req.query.project_managers as string
    //   ? `AND p.id IN (SELECT project_id from project_members WHERE team_member_id IN (${this.flatString(req.query.project_managers as string)}) AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'))`
    //   : "";

    const projectManagersClause = req.query.project_managers as string
    ? `AND p.id IN(SELECT project_id FROM project_members WHERE team_member_id IN(SELECT id FROM team_members WHERE user_id IN (${this.flatString(req.query.project_managers as string)})) AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER'))`
    : "";

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const teamFilterClause = `in_organization(p.team_id, $1)`;

    const result = await ReportingControllerBase.getProjectsByTeam(teamId as string, size, offset, searchQuery, sortField, sortOrder, statusesClause, healthsClause, categoriesClause, archivedClause, teamFilterClause, projectManagersClause);

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

  protected static getMinMaxDates(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      return `,(SELECT '${start}'::DATE )AS start_date, (SELECT '${end}'::DATE )AS end_date`;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return ",(SELECT (CURRENT_DATE - INTERVAL '1 day')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date";
    if (key === DATE_RANGES.LAST_WEEK)
      return ",(SELECT (CURRENT_DATE - INTERVAL '1 week')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date";
    if (key === DATE_RANGES.LAST_MONTH)
      return ",(SELECT (CURRENT_DATE - INTERVAL '1 month')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date";
    if (key === DATE_RANGES.LAST_QUARTER)
      return ",(SELECT (CURRENT_DATE - INTERVAL '3 months')::DATE) AS start_date, (SELECT (CURRENT_DATE)::DATE) AS end_date";
    if (key === DATE_RANGES.ALL_TIME)
      return ",(SELECT (MIN(task_work_log.created_at)::DATE) FROM task_work_log WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)) AS start_date, (SELECT (MAX(task_work_log.created_at)::DATE) FROM task_work_log WHERE task_id IN (SELECT id FROM tasks WHERE project_id = $1)) AS end_date";

    return "";
  }

  @HandleExceptions()
  public static async getProjectTimeLogs(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const projectId = req.body.id;
    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);
    const minMaxDateClause = this.getMinMaxDates(duration || DATE_RANGES.LAST_WEEK, date_range);

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

    const result = await db.query(q, [projectId]);

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

}
