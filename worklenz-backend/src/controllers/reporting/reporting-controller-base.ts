import WorklenzControllerBase from "../worklenz-controller-base";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import db from "../../config/db";
import moment from "moment";
import { DATE_RANGES, TASK_PRIORITY_COLOR_ALPHA } from "../../shared/constants";
import { formatDuration, formatLogText, getColor, int } from "../../shared/utils";

export default abstract class ReportingControllerBase extends WorklenzControllerBase {
  protected static getPercentage(n: number, total: number) {
    return +(n ? (n / total) * 100 : 0).toFixed();
  }

  protected static getCurrentTeamId(req: IWorkLenzRequest): string | null {
    return req.user?.team_id ?? null;
  }

  protected static async getTotalTasksCount(projectId: string | null) {
    const q = `
      SELECT COUNT(*) AS count
      FROM tasks
      WHERE project_id = $1;
    `;
    const result = await db.query(q, [projectId]);
    const [data] = result.rows;
    return data.count || 0;
  }

  protected static async getArchivedProjectsClause(archived = false, user_id: string, column_name: string) {
    return archived
      ? ""
      : `AND ${column_name} NOT IN (SELECT project_id FROM archived_projects WHERE project_id = ${column_name} AND user_id = '${user_id}') `;
  }

  protected static async getAllTasks(projectId: string | null) {
    const q = `
      SELECT  id,
              name,
              parent_task_id,
              parent_task_id IS NOT NULL AS is_sub_task,
              status_id AS status,
              (SELECT name FROM task_statuses WHERE id = tasks.status_id) AS status_name,
              (SELECT color_code
              FROM sys_task_status_categories
              WHERE id = (SELECT category_id FROM task_statuses WHERE id = status_id)) AS status_color,
              priority_id AS priority,
              (SELECT value FROM task_priorities WHERE id = tasks.priority_id) AS priority_value,
              (SELECT name FROM task_priorities WHERE id = tasks.priority_id) AS priority_name,
              (SELECT color_code FROM task_priorities WHERE id = tasks.priority_id) AS priority_color,
              end_date,
              (SELECT phase_id FROM task_phase WHERE task_id = tasks.id) AS phase_id,
              (SELECT name
              FROM project_phases
              WHERE id = (SELECT phase_id FROM task_phase WHERE task_id = tasks.id)) AS phase_name,
              completed_at,
              total_minutes,
              (SELECT SUM(time_spent) FROM task_work_log WHERE task_id = tasks.id) AS total_seconds_spent
      FROM tasks
      WHERE project_id = $1
      ORDER BY name;
    `;
    const result = await db.query(q, [projectId]);

    for (const item of result.rows) {
      const endDate = moment(item.end_date);
      const completedDate = moment(item.completed_at);
      const overdueDays = completedDate.diff(endDate, "days");

      if (overdueDays > 0) {
        item.overdue_days = overdueDays.toString();
      } else {
        item.overdue_days = "0";
      }

      item.total_minutes_spent = Math.ceil(item.total_seconds_spent / 60);

      if (~~(item.total_minutes_spent) > ~~(item.total_minutes)) {
        const overlogged_time = ~~(item.total_minutes_spent) - ~~(item.total_minutes);
        item.overlogged_time_string = formatDuration(moment.duration(overlogged_time, "minutes"));
      } else {
        item.overlogged_time_string = `0h 0m`;
      }
    }

    return result.rows;
  }

  protected static getDateRangeClause(key: string, dateRange: string[]) {
    if (dateRange.length === 2) {
      const start = moment(dateRange[0]).format("YYYY-MM-DD");
      const end = moment(dateRange[1]).format("YYYY-MM-DD");
      let query = `AND task_work_log.created_at::DATE >= '${start}'::DATE AND task_work_log.created_at < '${end}'::DATE + INTERVAL '1 day'`;

      if (start === end) {
        query = `AND task_work_log.created_at::DATE = '${start}'::DATE`;
      }

      return query;
    }

    if (key === DATE_RANGES.YESTERDAY)
      return "AND task_work_log.created_at >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND task_work_log.created_at < CURRENT_DATE::DATE";
    if (key === DATE_RANGES.LAST_WEEK)
      return "AND task_work_log.created_at >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND task_work_log.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'";
    if (key === DATE_RANGES.LAST_MONTH)
      return "AND task_work_log.created_at >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND task_work_log.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'";
    if (key === DATE_RANGES.LAST_QUARTER)
      return "AND task_work_log.created_at >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND task_work_log.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'";

    return "";
  }

  protected static buildBillableQuery(selectedStatuses: { billable: boolean; nonBillable: boolean }): string {
    const { billable, nonBillable } = selectedStatuses;
  
    if (billable && nonBillable) {
      // Both are enabled, no need to filter
      return "";
    } else if (billable) {
      // Only billable is enabled
      return " AND tasks.billable IS TRUE";
    } else if (nonBillable) {
      // Only non-billable is enabled
      return " AND tasks.billable IS FALSE";
    } 

    return "";
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


  public static async getProjectsByTeam(
    teamId: string,
    size: string | number | null,
    offset: string | number | null,
    searchQuery: string | null,
    sortField: string,
    sortOrder: string,
    statusClause: string,
    healthClause: string,
    categoryClause: string,
    archivedClause = "",
    teamFilterClause: string,
    projectManagersClause: string) {

    const q = `SELECT COUNT(*) AS total,
             (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
              FROM (SELECT p.id,
                           p.name,
                           p.color_code,

                           p.health_id AS project_health,
                           (SELECT color_code
                            FROM sys_project_healths
                            WHERE sys_project_healths.id = p.health_id) AS health_color,
                            (SELECT name
                            FROM sys_project_healths
                            WHERE sys_project_healths.id = p.health_id) AS health_name,

                           pc.id AS category_id,
                           pc.name AS category_name,
                           pc.color_code AS category_color,

                           (SELECT name FROM clients WHERE id = p.client_id) AS client,

                           p.team_id,
                           (SELECT name FROM teams WHERE id = p.team_id) AS team_name,

                           ps.id AS status_id,
                           ps.name AS status_name,
                           ps.color_code AS status_color,
                           ps.icon AS status_icon,

                           start_date,
                           end_date,

                           (SELECT COALESCE(ROW_TO_JSON(pm), '{}'::JSON)
                           FROM (SELECT team_member_id AS id,
                                       (SELECT COALESCE(ROW_TO_JSON(pmi), '{}'::JSON)
                                         FROM (SELECT name,
                                                     email,
                                                     avatar_url
                                               FROM team_member_info_view tmiv
                                               WHERE tmiv.team_member_id = pm.team_member_id
                                                 AND tmiv.team_id = (SELECT team_id FROM projects WHERE id = p.id)) pmi) AS project_manager_info,
                                       EXISTS(SELECT email
                                               FROM email_invitations
                                               WHERE team_member_id = pm.team_member_id
                                                 AND email_invitations.team_id = (SELECT team_id
                                                                                 FROM team_member_info_view
                                                                                 WHERE team_member_id = pm.team_member_id)) AS pending_invitation,
                                       (SELECT active FROM team_members WHERE id = pm.team_member_id)
                                                FROM project_members pm
                                                WHERE project_id =p.id
                                                  AND project_access_level_id = (SELECT id FROM project_access_levels WHERE key = 'PROJECT_MANAGER')) pm) AS project_manager,

                           (SELECT COALESCE(SUM(total_minutes), 0)
                            FROM tasks
                            WHERE project_id = p.id) AS estimated_time,

                           (SELECT SUM((SELECT COALESCE(SUM(time_spent), 0)
                                        FROM task_work_log
                                        WHERE task_id = tasks.id))
                            FROM tasks
                            WHERE project_id = p.id) AS actual_time,

                           (SELECT ROW_TO_JSON(rec)
                            FROM (SELECT COUNT(ta.id) AS total,
                                         COUNT(CASE WHEN is_completed(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS done,
                                         COUNT(CASE WHEN is_doing(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS doing,
                                         COUNT(CASE WHEN is_todo(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS todo
                                  FROM tasks ta
                                  WHERE project_id = p.id) rec) AS tasks_stat,

                           (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                            FROM (SELECT pu.content AS content,
                                         (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                                          FROM (SELECT u.name AS user_name,
                                                       u.email AS user_email
                                                FROM project_comment_mentions pcm
                                                         LEFT JOIN users u ON pcm.informed_by = u.id
                                                WHERE pcm.comment_id = pu.id) rec) AS mentions,
                                         pu.updated_at
                                  FROM project_comments pu
                                  WHERE pu.project_id = p.id
                                  ORDER BY pu.updated_at DESC
                                  LIMIT 1) AS rec) AS update,

                     (SELECT ROW_TO_JSON(rec)
                      FROM (SELECT attribute_type,
                                   log_type,
                                   -- new case,
                                   (CASE
                                        WHEN (attribute_type = 'status')
                                            THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                        WHEN (attribute_type = 'priority')
                                            THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                        ELSE (old_value) END)                                                      AS previous,

                                   -- new case
                                   (CASE
                                        WHEN (attribute_type = 'assignee')
                                            THEN (SELECT name FROM users WHERE id = new_value::UUID)
                                        WHEN (attribute_type = 'label')
                                            THEN (SELECT name FROM team_labels WHERE id = new_value::UUID)
                                        WHEN (attribute_type = 'status')
                                            THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                        WHEN (attribute_type = 'priority')
                                            THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                        ELSE (new_value) END)                                                      AS current,
                                   (SELECT name
                                    FROM users
                                    WHERE id = (SELECT reporter_id FROM tasks WHERE id = tal.task_id)),
                                   (SELECT ROW_TO_JSON(rec)
                                    FROM (SELECT (SELECT name FROM users WHERE users.id = tal.user_id),
                                                 (SELECT avatar_url FROM users WHERE users.id = tal.user_id)) rec) AS done_by,
                                   (CASE
                                        WHEN (attribute_type = 'assignee')
                                            THEN (SELECT ROW_TO_JSON(rec)
                                                  FROM (SELECT (CASE
                                                                    WHEN (new_value IS NOT NULL)
                                                                        THEN (SELECT name FROM users WHERE users.id = new_value::UUID)
                                                                    ELSE (next_string) END) AS name,
                                                               (SELECT avatar_url FROM users WHERE users.id = new_value::UUID)) rec)
                                        ELSE (NULL) END)                                                           AS assigned_user,
                                   (SELECT name FROM tasks WHERE tasks.id = tal.task_id)
                            FROM task_activity_logs tal
                            WHERE task_id IN (SELECT id FROM tasks t WHERE t.project_id = p.id)
                            ORDER BY tal.created_at DESC
                            LIMIT 1) rec) AS last_activity
                    FROM projects p
                             LEFT JOIN project_categories pc ON pc.id = p.category_id
                             LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
                    WHERE ${teamFilterClause} ${searchQuery} ${healthClause} ${statusClause} ${categoryClause} ${projectManagersClause} ${archivedClause}
                    ORDER BY ${sortField} ${sortOrder}
                    LIMIT $2 OFFSET $3) t) AS projects
      FROM projects p
               LEFT JOIN project_categories pc ON pc.id = p.category_id
               LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
      WHERE ${teamFilterClause} ${searchQuery} ${healthClause} ${statusClause} ${categoryClause} ${projectManagersClause} ${archivedClause};`;
    const result = await db.query(q, [teamId, size, offset]);
    const [data] = result.rows;

    for (const project of data.projects) {
      if (project.project_manager) {
        project.project_manager.name = project.project_manager.project_manager_info.name;
        project.project_manager.avatar_url = project.project_manager.project_manager_info.avatar_url;
        project.project_manager.color_code = getColor(project.project_manager.name);
      }
    }

    return data;
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

  public static async exportProjects(teamId: string) {
    const q = `SELECT COUNT(*) AS total,
         (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
          FROM (SELECT p.id,
                       p.name,
                       (SELECT name
                        FROM sys_project_healths
                        WHERE sys_project_healths.id = p.health_id) AS project_health,
                       pc.name AS category_name,
                       (SELECT name FROM clients WHERE id = p.client_id) AS client,
                       (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                       ps.name AS status_name,
                       start_date,
                       end_date,
                       (SELECT COALESCE(SUM(total_minutes), 0)
                        FROM tasks
                        WHERE project_id = p.id) AS estimated_time,
                       (SELECT SUM((SELECT COALESCE(SUM(time_spent), 0)
                                    FROM task_work_log
                                    WHERE task_id = tasks.id))
                        FROM tasks
                        WHERE project_id = p.id) AS actual_time,
                       (SELECT ROW_TO_JSON(rec)
                        FROM (SELECT COUNT(ta.id) AS total,
                                     COUNT(CASE WHEN is_completed(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS done,
                                     COUNT(CASE WHEN is_doing(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS doing,
                                     COUNT(CASE WHEN is_todo(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS todo
                              FROM tasks ta
                              WHERE project_id = p.id) rec) AS tasks_stat,
                       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                        FROM (SELECT pu.content AS content,
                                     (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                                      FROM (SELECT u.name AS user_name,
                                                   u.email AS user_email
                                            FROM project_comment_mentions pcm
                                                     LEFT JOIN users u ON pcm.informed_by = u.id
                                            WHERE pcm.comment_id = pu.id) rec) AS mentions,
                                     pu.updated_at
                              FROM project_comments pu
                              WHERE pu.project_id = p.id
                              ORDER BY pu.updated_at DESC
                              LIMIT 1) AS rec) AS update,
                 (SELECT ROW_TO_JSON(rec)
                  FROM (SELECT attribute_type,
                               log_type,
                               -- new case,
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                    ELSE (old_value) END)                                                      AS previous,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT name FROM users WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT name FROM team_labels WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                    ELSE (new_value) END)                                                      AS current,
                               (SELECT name
                                FROM users
                                WHERE id = (SELECT reporter_id FROM tasks WHERE id = tal.task_id)),
                               (SELECT ROW_TO_JSON(rec)
                                FROM (SELECT (SELECT name FROM users WHERE users.id = tal.user_id),
                                             (SELECT avatar_url FROM users WHERE users.id = tal.user_id)) rec) AS done_by,
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (CASE
                                                                WHEN (new_value IS NOT NULL)
                                                                    THEN (SELECT name FROM users WHERE users.id = new_value::UUID)
                                                                ELSE (next_string) END) AS name,
                                                           (SELECT avatar_url FROM users WHERE users.id = new_value::UUID)) rec)
                                    ELSE (NULL) END)                                                           AS assigned_user,
                               (SELECT name FROM tasks WHERE tasks.id = tal.task_id)
                        FROM task_activity_logs tal
                        WHERE task_id IN (SELECT id FROM tasks t WHERE t.project_id = p.id)
                        ORDER BY tal.created_at
                        LIMIT 1) rec) AS last_activity
                FROM projects p
                         LEFT JOIN project_categories pc ON pc.id = p.category_id
                         LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
                WHERE p.team_id = $1 ORDER BY p.name) t) AS projects
  FROM projects p
           LEFT JOIN project_categories pc ON pc.id = p.category_id
           LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
  WHERE p.team_id = $1;`;

    const result = await db.query(q, [teamId]);

    const [data] = result.rows;

    for (const project of data.projects) {
      project.team_color = getColor(project.team_name) + TASK_PRIORITY_COLOR_ALPHA;
      project.days_left = this.getDaysLeft(project.end_date);
      project.is_overdue = this.isOverdue(project.end_date);
      if (project.days_left && project.is_overdue) {
        project.days_left = project.days_left.toString().replace(/-/g, "");
      }
      project.is_today = this.isToday(project.end_date);
      project.estimated_time = this.convertMinutesToHoursAndMinutes(int(project.estimated_time));
      project.actual_time = this.convertSecondsToHoursAndMinutes(int(project.actual_time));
      project.tasks_stat = {
        todo: this.getPercentage(int(project.tasks_stat.todo), +project.tasks_stat.total),
        doing: this.getPercentage(int(project.tasks_stat.doing), +project.tasks_stat.total),
        done: this.getPercentage(int(project.tasks_stat.done), +project.tasks_stat.total)
      };
      if (project.update.length > 0) {
        const update = project.update[0];
        const placeHolders = update.content.match(/{\d+}/g);
        if (placeHolders) {
          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
            const index = parseInt(placeHolder.match(/\d+/)[0]);
            if (index >= 0 && index < update.mentions.length) {
              update.content = update.content.replace(placeHolder, ` @${update.mentions[index].user_name} `);
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
    return data;
  }

  public static async exportProjectsAll(teamId: string) {
    const q = `SELECT COUNT(*) AS total,
         (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(t))), '[]'::JSON)
          FROM (SELECT p.id,
                       p.name,
                       (SELECT name
                        FROM sys_project_healths
                        WHERE sys_project_healths.id = p.health_id) AS project_health,
                       pc.name AS category_name,
                       (SELECT name FROM clients WHERE id = p.client_id) AS client,
                       (SELECT name FROM teams WHERE id = p.team_id) AS team_name,
                       ps.name AS status_name,
                       start_date,
                       end_date,
                       (SELECT COALESCE(SUM(total_minutes), 0)
                        FROM tasks
                        WHERE project_id = p.id) AS estimated_time,
                       (SELECT SUM((SELECT COALESCE(SUM(time_spent), 0)
                                    FROM task_work_log
                                    WHERE task_id = tasks.id))
                        FROM tasks
                        WHERE project_id = p.id) AS actual_time,
                       (SELECT ROW_TO_JSON(rec)
                        FROM (SELECT COUNT(ta.id) AS total,
                                     COUNT(CASE WHEN is_completed(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS done,
                                     COUNT(CASE WHEN is_doing(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS doing,
                                     COUNT(CASE WHEN is_todo(ta.status_id, ta.project_id) IS TRUE THEN 1 END) AS todo
                              FROM tasks ta
                              WHERE project_id = p.id) rec) AS tasks_stat,
                       (SELECT COALESCE(ARRAY_TO_JSON(ARRAY_AGG(ROW_TO_JSON(rec))), '[]'::JSON)
                        FROM (SELECT pu.content AS content,
                                     (SELECT COALESCE(JSON_AGG(rec), '[]'::JSON)
                                      FROM (SELECT u.name AS user_name,
                                                   u.email AS user_email
                                            FROM project_comment_mentions pcm
                                                     LEFT JOIN users u ON pcm.informed_by = u.id
                                            WHERE pcm.comment_id = pu.id) rec) AS mentions,
                                     pu.updated_at
                              FROM project_comments pu
                              WHERE pu.project_id = p.id
                              ORDER BY pu.updated_at DESC
                              LIMIT 1) AS rec) AS update,
                 (SELECT ROW_TO_JSON(rec)
                  FROM (SELECT attribute_type,
                               log_type,
                               -- new case,
                               (CASE
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = old_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = old_value::UUID)
                                    ELSE (old_value) END)                                                      AS previous,

                               -- new case
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT name FROM users WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'label')
                                        THEN (SELECT name FROM team_labels WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'status')
                                        THEN (SELECT name FROM task_statuses WHERE id = new_value::UUID)
                                    WHEN (attribute_type = 'priority')
                                        THEN (SELECT name FROM task_priorities WHERE id = new_value::UUID)
                                    ELSE (new_value) END)                                                      AS current,
                               (SELECT name
                                FROM users
                                WHERE id = (SELECT reporter_id FROM tasks WHERE id = tal.task_id)),
                               (SELECT ROW_TO_JSON(rec)
                                FROM (SELECT (SELECT name FROM users WHERE users.id = tal.user_id),
                                             (SELECT avatar_url FROM users WHERE users.id = tal.user_id)) rec) AS done_by,
                               (CASE
                                    WHEN (attribute_type = 'assignee')
                                        THEN (SELECT ROW_TO_JSON(rec)
                                              FROM (SELECT (CASE
                                                                WHEN (new_value IS NOT NULL)
                                                                    THEN (SELECT name FROM users WHERE users.id = new_value::UUID)
                                                                ELSE (next_string) END) AS name,
                                                           (SELECT avatar_url FROM users WHERE users.id = new_value::UUID)) rec)
                                    ELSE (NULL) END)                                                           AS assigned_user,
                               (SELECT name FROM tasks WHERE tasks.id = tal.task_id)
                        FROM task_activity_logs tal
                        WHERE task_id IN (SELECT id FROM tasks t WHERE t.project_id = p.id)
                        ORDER BY tal.created_at
                        LIMIT 1) rec) AS last_activity
                FROM projects p
                         LEFT JOIN project_categories pc ON pc.id = p.category_id
                         LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
                WHERE in_organization(p.team_id, $1) ORDER BY p.name) t) AS projects
  FROM projects p
           LEFT JOIN project_categories pc ON pc.id = p.category_id
           LEFT JOIN sys_project_statuses ps ON p.status_id = ps.id
  WHERE in_organization(p.team_id, $1);`;

    const result = await db.query(q, [teamId]);

    const [data] = result.rows;

    for (const project of data.projects) {
      project.team_color = getColor(project.team_name) + TASK_PRIORITY_COLOR_ALPHA;
      project.days_left = this.getDaysLeft(project.end_date);
      project.is_overdue = this.isOverdue(project.end_date);
      if (project.days_left && project.is_overdue) {
        project.days_left = project.days_left.toString().replace(/-/g, "");
      }
      project.is_today = this.isToday(project.end_date);
      project.estimated_time = this.convertMinutesToHoursAndMinutes(int(project.estimated_time));
      project.actual_time = this.convertSecondsToHoursAndMinutes(int(project.actual_time));
      project.tasks_stat = {
        todo: this.getPercentage(int(project.tasks_stat.todo), +project.tasks_stat.total),
        doing: this.getPercentage(int(project.tasks_stat.doing), +project.tasks_stat.total),
        done: this.getPercentage(int(project.tasks_stat.done), +project.tasks_stat.total)
      };
      if (project.update.length > 0) {
        const update = project.update[0];
        const placeHolders = update.content.match(/{\d+}/g);
        if (placeHolders) {
          placeHolders.forEach((placeHolder: { match: (arg0: RegExp) => string[]; }) => {
            const index = parseInt(placeHolder.match(/\d+/)[0]);
            if (index >= 0 && index < update.mentions.length) {
              update.content = update.content.replace(placeHolder, ` @${update.mentions[index].user_name} `);
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
    return data;
  }

}
