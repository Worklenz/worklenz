import moment from "moment";
import db from "../../config/db";
import HandleExceptions from "../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getColor, int, log_error } from "../../shared/utils";
import ReportingControllerBase from "./reporting-controller-base";
import { DATE_RANGES } from "../../shared/constants";
import Excel from "exceljs";

enum IToggleOptions {
  'WORKING_DAYS' = 'WORKING_DAYS', 'MAN_DAYS' = 'MAN_DAYS'
}

export default class ReportingAllocationController extends ReportingControllerBase {
  private static async getTimeLoggedByProjects(projects: string[], users: string[], key: string, dateRange: string[], archived = false, user_id = ""): Promise<any> {
    try {
      const projectIds = projects.map(p => `'${p}'`).join(",");
      const userIds = users.map(u => `'${u}'`).join(",");

      const duration = this.getDateRangeClause(key || DATE_RANGES.LAST_WEEK, dateRange);
      const archivedClause = archived
        ? ""
        : `AND projects.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id AND user_id = '${user_id}') `;

      const projectTimeLogs = await this.getTotalTimeLogsByProject(archived, duration, projectIds, userIds, archivedClause);
      const userTimeLogs = await this.getTotalTimeLogsByUser(archived, duration, projectIds, userIds);

      const format = (seconds: number) => {
        if (seconds === 0) return "-";
        const duration = moment.duration(seconds, "seconds");
        const formattedDuration = `${~~(duration.asHours())}h ${duration.minutes()}m ${duration.seconds()}s`;
        return formattedDuration;
      };

      let totalProjectsTime = 0;
      let totalUsersTime = 0;

      for (const project of projectTimeLogs) {
        if (project.all_tasks_count > 0) {
          project.progress = Math.round((project.completed_tasks_count / project.all_tasks_count) * 100);
        } else {
          project.progress = 0;
        }

        let total = 0;
        for (const log of project.time_logs) {
          total += log.time_logged;
          log.time_logged = format(log.time_logged);
        }
        project.totalProjectsTime = totalProjectsTime + total;
        project.total = format(total);
      }

      for (const log of userTimeLogs) {
        log.totalUsersTime = totalUsersTime + parseInt(log.time_logged)
        log.time_logged = format(parseInt(log.time_logged));
      }

      return { projectTimeLogs, userTimeLogs };
    } catch (error) {
      log_error(error);
    }
    return [];
  }

  private static async getTotalTimeLogsByProject(archived: boolean, duration: string, projectIds: string, userIds: string, archivedClause = "") {
    try {
      const q = `SELECT projects.name,
               projects.color_code,
               sps.name AS status_name,
               sps.color_code AS status_color_code,
               sps.icon AS status_icon,
               (SELECT COUNT(*)
                FROM tasks
                WHERE CASE WHEN ($1 IS TRUE) THEN project_id IS NOT NULL ELSE archived = FALSE END
                  AND project_id = projects.id) AS all_tasks_count,
               (SELECT COUNT(*)
                FROM tasks
                WHERE CASE WHEN ($1 IS TRUE) THEN project_id IS NOT NULL ELSE archived = FALSE END
                  AND project_id = projects.id
                  AND status_id IN (SELECT id
                                    FROM task_statuses
                                    WHERE project_id = projects.id
                                      AND category_id IN
                                          (SELECT id FROM sys_task_status_categories WHERE is_done IS TRUE))) AS completed_tasks_count,
               (
                 SELECT COALESCE(JSON_AGG(r), '[]'::JSON)
                 FROM (
                        SELECT name,
                               (SELECT COALESCE(SUM(time_spent), 0)
                                FROM task_work_log
                                       LEFT JOIN tasks t ON task_work_log.task_id = t.id
                                WHERE user_id = users.id
                                  AND CASE WHEN ($1 IS TRUE) THEN t.project_id IS NOT NULL ELSE t.archived = FALSE END
                                  AND t.project_id = projects.id
                                  ${duration}) AS time_logged
                        FROM users
                        WHERE id IN (${userIds})
                        ORDER BY name
                      ) r
               ) AS time_logs
            FROM projects
                LEFT JOIN sys_project_statuses sps ON projects.status_id = sps.id
            WHERE projects.id IN (${projectIds}) ${archivedClause};`;

      const result = await db.query(q, [archived]);
      return result.rows;
    } catch (error) {
      log_error(error);
      return [];
    }
  }

  private static async getTotalTimeLogsByUser(archived: boolean, duration: string, projectIds: string, userIds: string) {
    try {
      const q = `(SELECT id,
                    (SELECT COALESCE(SUM(time_spent), 0)
                    FROM task_work_log
                            LEFT JOIN tasks t ON task_work_log.task_id = t.id
                    WHERE user_id = users.id
                    AND CASE WHEN ($1 IS TRUE) THEN t.project_id IS NOT NULL ELSE t.archived = FALSE END
                    AND t.project_id IN (${projectIds})
                    ${duration}) AS time_logged
                    FROM users
                    WHERE id IN (${userIds})
                    ORDER BY name);`;
      const result = await db.query(q, [archived]);
      return result.rows;
    } catch (error) {
      log_error(error);
      return [];
    }
  }

  private static async getUserIds(teamIds: any) {
    try {
      const q = `SELECT id, (SELECT name)
               FROM users
               WHERE id IN (SELECT user_id
                            FROM team_members
                            WHERE team_id IN (${teamIds}))
               GROUP BY id
               ORDER BY name`;
      const result = await db.query(q, []);
      return result.rows;
    } catch (error) {
      log_error(error);
      return [];
    }
  }

  @HandleExceptions()
  public static async getAllocation(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const teams = (req.body.teams || []) as string[]; // ids

    const teamIds = teams.map(id => `'${id}'`).join(",");
    const projectIds = (req.body.projects || []) as string[];

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const users = await this.getUserIds(teamIds);
    const userIds = users.map((u: any) => u.id);

    const { projectTimeLogs, userTimeLogs } = await this.getTimeLoggedByProjects(projectIds, userIds, req.body.duration, req.body.date_range, (req.query.archived === "true"), req.user?.id);

    for (const [i, user] of users.entries()) {
      user.total_time = userTimeLogs[i].time_logged;
    }

    return res.status(200).send(new ServerResponse(true, { users, projects: projectTimeLogs }));
  }

  public static formatDurationDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  @HandleExceptions()
  public static async export(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const teams = (req.query.teams as string)?.split(",");
    const teamIds = teams.map(t => `'${t}'`).join(",");

    const projectIds = (req.query.projects as string)?.split(",");

    const duration = req.query.duration;

    const dateRange = (req.query.date_range as string)?.split(",");

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

    const users = await this.getUserIds(teamIds);
    const userIds = users.map((u: any) => u.id);

    const { projectTimeLogs, userTimeLogs } = await this.getTimeLoggedByProjects(projectIds, userIds, duration as string, dateRange, (req.query.include_archived === "true"), req.user?.id);

    for (const [i, user] of users.entries()) {
      user.total_time = userTimeLogs[i].time_logged;
    }

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Reporting Time Sheet - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Reporting Time Sheet");

    sheet.columns = [
      { header: "Project", key: "project", width: 25 },
      { header: "Logged Time", key: "logged_time", width: 20 },
      { header: "Total", key: "total", width: 25 },
    ];

    sheet.getCell("A1").value = `Reporting Time Sheet`;
    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    sheet.mergeCells("A3:D3");

    let totalProjectTime = 0;
    let totalMemberTime = 0;

    if (projectTimeLogs.length > 0) {
      const rowTop = sheet.getRow(5);
      rowTop.getCell(1).value = "";

      users.forEach((user: { id: string, name: string, total_time: string }, index: any) => {
        rowTop.getCell(index + 2).value = user.name;
      });

      rowTop.getCell(users.length + 2).value = "Total";

      rowTop.font = {
        bold: true
      };

      for (const project of projectTimeLogs) {

        const rowValues = [];
        rowValues[1] = project.name;
        project.time_logs.forEach((log: any, index: any) => {
          rowValues[index + 2] = log.time_logged === "0h 0m 0s" ? "-" : log.time_logged;
        });
        rowValues[project.time_logs.length + 2] = project.total;
        sheet.addRow(rowValues);

        const { lastRow } = sheet;
        if (lastRow) {
          const totalCell = lastRow.getCell(project.time_logs.length + 2);
          totalCell.style.font = { bold: true };
        }
        totalProjectTime = totalProjectTime + project.totalProjectsTime
      }

      const rowBottom = sheet.getRow(projectTimeLogs.length + 6);
      rowBottom.getCell(1).value = "Total";
      rowBottom.getCell(1).style.font = { bold: true };
      userTimeLogs.forEach((log: { id: string, time_logged: string, totalUsersTime: number }, index: any) => {
        totalMemberTime = totalMemberTime + log.totalUsersTime
        rowBottom.getCell(index + 2).value = log.time_logged;
      });
      rowBottom.font = {
        bold: true
      };

    }

    const format = (seconds: number) => {
      if (seconds === 0) return "-";
      const duration = moment.duration(seconds, "seconds");
      const formattedDuration = `${~~(duration.asHours())}h ${duration.minutes()}m ${duration.seconds()}s`;
      return formattedDuration;
    };

    const projectTotalTimeRow = sheet.getRow(projectTimeLogs.length + 8);
    projectTotalTimeRow.getCell(1).value = "Total logged time of Projects"
    projectTotalTimeRow.getCell(2).value = `${format(totalProjectTime)}`
    projectTotalTimeRow.getCell(1).style.font = { bold: true };
    projectTotalTimeRow.getCell(2).style.font = { bold: true };

    const membersTotalTimeRow = sheet.getRow(projectTimeLogs.length + 9);
    membersTotalTimeRow.getCell(1).value = "Total logged time of Members"
    membersTotalTimeRow.getCell(2).value = `${format(totalMemberTime)}`
    membersTotalTimeRow.getCell(1).style.font = { bold: true };
    membersTotalTimeRow.getCell(2).style.font = { bold: true };

    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${fileName}.xlsx`);

    await workbook.xlsx.write(res)
      .then(() => {
        res.end();
      });

  }


  @HandleExceptions()
  public static async getProjectTimeSheets(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const archived = req.query.archived === "true";

    const teams = (req.body.teams || []) as string[]; // ids
    const teamIds = teams.map(id => `'${id}'`).join(",");

    const projects = (req.body.projects || []) as string[];
    const projectIds = projects.map(p => `'${p}'`).join(",");

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const q = `
        SELECT p.id,
            p.name,
            (SELECT SUM(time_spent)) AS logged_time,
            SUM(total_minutes) AS estimated,
            color_code
        FROM projects p
                LEFT JOIN tasks t ON t.project_id = p.id
                LEFT JOIN task_work_log ON task_work_log.task_id = t.id
        WHERE p.id IN (${projectIds}) ${durationClause} ${archivedClause}
        GROUP BY p.id, p.name
        ORDER BY logged_time DESC;`;
    const result = await db.query(q, []);

    const data = [];

    for (const project of result.rows) {
      project.value = project.logged_time ? parseFloat(moment.duration(project.logged_time, "seconds").asHours().toFixed(2)) : 0;
      project.estimated_value = project.estimated ? parseFloat(moment.duration(project.estimated, "minutes").asHours().toFixed(2)) : 0;

      if (project.value > 0 ) {
        data.push(project);
      }

    }

    return res.status(200).send(new ServerResponse(true, data));
  }


  @HandleExceptions()
  public static async getMemberTimeSheets(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const archived = req.query.archived === "true";

    const teams = (req.body.teams || []) as string[]; // ids
    const teamIds = teams.map(id => `'${id}'`).join(",");

    const projects = (req.body.projects || []) as string[];
    const projectIds = projects.map(p => `'${p}'`).join(",");

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);
    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const q = `
        SELECT tmiv.email, tmiv.name, SUM(time_spent) AS logged_time
            FROM team_member_info_view tmiv
                    LEFT JOIN task_work_log ON task_work_log.user_id = tmiv.user_id
                    LEFT JOIN tasks t ON t.id = task_work_log.task_id
                    LEFT JOIN projects p ON p.id = t.project_id AND p.team_id = tmiv.team_id
            WHERE p.id IN (${projectIds})
            ${durationClause} ${archivedClause}
            GROUP BY tmiv.email, tmiv.name
            ORDER BY logged_time DESC;`;
    const result = await db.query(q, []);

    for (const member of result.rows) {
      member.value = member.logged_time ? parseFloat(moment.duration(member.logged_time, "seconds").asHours().toFixed(2)) : 0;
      member.color_code = getColor(member.name);
    }

    return res.status(200).send(new ServerResponse(true, result.rows));
  }

  private static getEstimated(project: any, type: string) {

    switch (type) {
      case IToggleOptions.MAN_DAYS:
        return project.estimated_man_days ?? 0;;

      case IToggleOptions.WORKING_DAYS:
        return project.estimated_working_days ?? 0;;

      default:
        return 0;
    }
  }

  @HandleExceptions()
  public static async getEstimatedVsActual(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const archived = req.query.archived === "true";

    const teams = (req.body.teams || []) as string[]; // ids
    const teamIds = teams.map(id => `'${id}'`).join(",");

    const projects = (req.body.projects || []) as string[];
    const projectIds = projects.map(p => `'${p}'`).join(",");
    const { type } = req.body;

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const q = `
        SELECT p.id,
            p.name,
            p.end_date,
            p.hours_per_day::INT,
            p.estimated_man_days::INT,
            p.estimated_working_days::INT,
            (SELECT SUM(time_spent)) AS logged_time,
            (SELECT COALESCE(SUM(total_minutes), 0)
            FROM tasks
            WHERE project_id = p.id) AS estimated,
            color_code
        FROM projects p
                LEFT JOIN tasks t ON t.project_id = p.id
                LEFT JOIN task_work_log ON task_work_log.task_id = t.id
        WHERE p.id IN (${projectIds}) ${durationClause} ${archivedClause}
        GROUP BY p.id, p.name
        ORDER BY logged_time DESC;`;
    const result = await db.query(q, []);

    const data = [];

    for (const project of result.rows) {
      const durationInHours = parseFloat(moment.duration(project.logged_time, "seconds").asHours().toFixed(2));
      const hoursPerDay = parseInt(project.hours_per_day ?? 1);

      project.value = parseFloat((durationInHours / hoursPerDay).toFixed(2)) ?? 0;

      project.estimated_value = this.getEstimated(project, type);
      project.estimated_man_days = project.estimated_man_days ?? 0;
      project.estimated_working_days = project.estimated_working_days ?? 0;
      project.hours_per_day = project.hours_per_day ?? 0;

      if (project.value > 0 || project.estimated_value > 0 ) {
        data.push(project);
      }

    }

    return res.status(200).send(new ServerResponse(true, data));
  }
}
