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
import ChartJsImage from "chartjs-to-image";

enum IToggleOptions {
  'WORKING_DAYS' = 'WORKING_DAYS', 'MAN_DAYS' = 'MAN_DAYS'
}

export default class ReportingAllocationController extends ReportingControllerBase {
  private static async getTimeLoggedByProjects(projects: string[], users: string[], key: string, dateRange: string[], archived = false, user_id = "", billable: { billable: boolean; nonBillable: boolean }): Promise<any> {
    try {
      const projectIds = projects.map(p => `'${p}'`).join(",");
      const userIds = users.map(u => `'${u}'`).join(",");

      const duration = this.getDateRangeClause(key || DATE_RANGES.LAST_WEEK, dateRange);
      const archivedClause = archived
        ? ""
        : `AND projects.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = projects.id AND user_id = '${user_id}') `;

      const billableQuery = this.buildBillableQuery(billable);

      const projectTimeLogs = await this.getTotalTimeLogsByProject(archived, duration, projectIds, userIds, archivedClause, billableQuery);
      const userTimeLogs = await this.getTotalTimeLogsByUser(archived, duration, projectIds, userIds, billableQuery);

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

  private static async getTotalTimeLogsByProject(archived: boolean, duration: string, projectIds: string, userIds: string, archivedClause = "", billableQuery = '') {
    try {
      const q = `SELECT projects.name,
               projects.color_code,
               sps.name AS status_name,
               sps.color_code AS status_color_code,
               sps.icon AS status_icon,
               (SELECT COUNT(*)
                FROM tasks
                WHERE CASE WHEN ($1 IS TRUE) THEN project_id IS NOT NULL ELSE archived = FALSE END
                  AND project_id = projects.id ${billableQuery}) AS all_tasks_count,
               (SELECT COUNT(*)
                FROM tasks
                WHERE CASE WHEN ($1 IS TRUE) THEN project_id IS NOT NULL ELSE archived = FALSE END
                  AND project_id = projects.id ${billableQuery}
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
                                       LEFT JOIN tasks ON task_work_log.task_id = tasks.id
                                WHERE user_id = users.id
                                  AND CASE WHEN ($1 IS TRUE) THEN tasks.project_id IS NOT NULL ELSE tasks.archived = FALSE END
                                  AND tasks.project_id = projects.id
                                  ${billableQuery}
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

  private static async getTotalTimeLogsByUser(archived: boolean, duration: string, projectIds: string, userIds: string, billableQuery = "") {
    try {
      const q = `(SELECT id,
                    (SELECT COALESCE(SUM(time_spent), 0)
                    FROM task_work_log
                            LEFT JOIN tasks ON task_work_log.task_id = tasks.id
                    WHERE user_id = users.id
                    AND CASE WHEN ($1 IS TRUE) THEN tasks.project_id IS NOT NULL ELSE tasks.archived = FALSE END
                    AND tasks.project_id IN (${projectIds})
                    ${billableQuery}
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
    const billable = req.body.billable;

    const teamIds = teams.map(id => `'${id}'`).join(",");
    const projectIds = (req.body.projects || []) as string[];

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const users = await this.getUserIds(teamIds);
    const userIds = users.map((u: any) => u.id);

    const { projectTimeLogs, userTimeLogs } = await this.getTimeLoggedByProjects(projectIds, userIds, req.body.duration, req.body.date_range, (req.query.archived === "true"), req.user?.id, billable);

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
    const billable = req.body.billable ? req.body.billable : { billable: req.query.billable === "true", nonBillable: req.query.nonBillable === "true" };

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

    const { projectTimeLogs, userTimeLogs } = await this.getTimeLoggedByProjects(projectIds, userIds, duration as string, dateRange, (req.query.include_archived === "true"), req.user?.id, billable);

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

    const categories = (req.body.categories || []) as string[];
    const noCategory = req.body.noCategory || false;
    const billable = req.body.billable;

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const billableQuery = this.buildBillableQuery(billable);

    // Prepare projects filter
    let projectsFilter = "";
    if (projectIds.length > 0) {
      projectsFilter = `AND p.id IN (${projectIds})`;
    } else {
      // If no projects are selected, don't show any data
      projectsFilter = `AND 1=0`; // This will match no rows
    }

    // Prepare categories filter - updated logic
    let categoriesFilter = "";
    if (categories.length > 0 && noCategory) {
      // Both specific categories and "No Category" are selected
      const categoryIds = categories.map(id => `'${id}'`).join(",");
      categoriesFilter = `AND (p.category_id IS NULL OR p.category_id IN (${categoryIds}))`;
    } else if (categories.length === 0 && noCategory) {
      // Only "No Category" is selected
      categoriesFilter = `AND p.category_id IS NULL`;
    } else if (categories.length > 0 && !noCategory) {
      // Only specific categories are selected
      const categoryIds = categories.map(id => `'${id}'`).join(",");
      categoriesFilter = `AND p.category_id IN (${categoryIds})`;
    } else {
      // categories.length === 0 && !noCategory - no categories selected, show nothing
      categoriesFilter = `AND 1=0`; // This will match no rows
    }

    const q = `
        SELECT p.id,
            p.name,
            (SELECT SUM(time_spent)) AS logged_time,
            SUM(total_minutes) AS estimated,
            color_code
        FROM projects p
                LEFT JOIN tasks ON tasks.project_id = p.id
                LEFT JOIN task_work_log ON task_work_log.task_id = tasks.id
        WHERE p.id IN (${projectIds}) ${durationClause} ${archivedClause} ${categoriesFilter} ${billableQuery}
        GROUP BY p.id, p.name
        ORDER BY logged_time DESC;`;
    const result = await db.query(q, []);

    const utilization = (req.body.utilization || []) as string[];

    const data = [];

    for (const project of result.rows) {
      project.value = project.logged_time ? parseFloat(moment.duration(project.logged_time, "seconds").asHours().toFixed(2)) : 0;
      project.estimated_value = project.estimated ? parseFloat(moment.duration(project.estimated, "minutes").asHours().toFixed(2)) : 0;

      if (project.value > 0) {
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

    const categories = (req.body.categories || []) as string[];
    const noCategory = req.body.noCategory || false;
    const billable = req.body.billable;

    if (!teamIds)
      return res.status(200).send(new ServerResponse(true, { filteredRows: [], totals: { total_time_logs: "0", total_estimated_hours: "0", total_utilization: "0" } }));

    const { duration, date_range } = req.body;

    // Calculate the date range (start and end)
    let startDate: moment.Moment;
    let endDate: moment.Moment;
    if (date_range && date_range.length === 2) {
      startDate = moment(date_range[0]);
      endDate = moment(date_range[1]);
    } else if (duration === DATE_RANGES.ALL_TIME) {
      // Fetch the earliest start_date (or created_at if null) from selected projects
      const minDateQuery = projectIds.length > 0 
        ? `SELECT MIN(COALESCE(start_date, created_at)) as min_date FROM projects WHERE id IN (${projectIds})`
        : `SELECT MIN(COALESCE(start_date, created_at)) as min_date FROM projects WHERE team_id IN (${teamIds})`;
      const minDateResult = await db.query(minDateQuery, []);
      const minDate = minDateResult.rows[0]?.min_date;
      startDate = minDate ? moment(minDate) : moment('2000-01-01');
      endDate = moment();
    } else {
      switch (duration) {
        case DATE_RANGES.YESTERDAY:
          startDate = moment().subtract(1, "day");
          endDate = moment().subtract(1, "day");
          break;
        case DATE_RANGES.LAST_WEEK:
          startDate = moment().subtract(1, "week").startOf("isoWeek");
          endDate = moment().subtract(1, "week").endOf("isoWeek");
          break;
        case DATE_RANGES.LAST_MONTH:
          startDate = moment().subtract(1, "month").startOf("month");
          endDate = moment().subtract(1, "month").endOf("month");
          break;
        case DATE_RANGES.LAST_QUARTER:
          startDate = moment().subtract(3, "months").startOf("quarter");
          endDate = moment().subtract(1, "quarter").endOf("quarter");
          break;
        default:
          startDate = moment().startOf("day");
          endDate = moment().endOf("day");
      }
    }

    // Get organization working days
    const orgWorkingDaysQuery = `
      SELECT monday, tuesday, wednesday, thursday, friday, saturday, sunday
      FROM organization_working_days
      WHERE organization_id IN (
        SELECT t.organization_id 
        FROM teams t 
        WHERE t.id IN (${teamIds})
        LIMIT 1
      );
    `;
    const orgWorkingDaysResult = await db.query(orgWorkingDaysQuery, []);
    const workingDaysConfig = orgWorkingDaysResult.rows[0] || {
      monday: true,
      tuesday: true,
      wednesday: true,
      thursday: true,
      friday: true,
      saturday: false,
      sunday: false
    };

    // Count working days based on organization settings
    let workingDays = 0;
    let current = startDate.clone();
    while (current.isSameOrBefore(endDate, 'day')) {
      const day = current.isoWeekday();
      if (
        (day === 1 && workingDaysConfig.monday) ||
        (day === 2 && workingDaysConfig.tuesday) ||
        (day === 3 && workingDaysConfig.wednesday) ||
        (day === 4 && workingDaysConfig.thursday) ||
        (day === 5 && workingDaysConfig.friday) ||
        (day === 6 && workingDaysConfig.saturday) ||
        (day === 7 && workingDaysConfig.sunday)
      ) {
        workingDays++;
      }
      current.add(1, 'day');
    }

    // Get organization working hours
    const orgWorkingHoursQuery = `SELECT working_hours FROM organizations WHERE id = (SELECT t.organization_id FROM teams t WHERE t.id IN (${teamIds}) LIMIT 1)`;
    const orgWorkingHoursResult = await db.query(orgWorkingHoursQuery, []);
    const orgWorkingHours = orgWorkingHoursResult.rows[0]?.working_hours || 8;
    
    // Calculate total working hours with minimum baseline for non-working day scenarios
    let totalWorkingHours = workingDays * orgWorkingHours;
    let isNonWorkingPeriod = false;
    
    // If no working days but there might be logged time, set minimum baseline
    // This ensures that time logged on non-working days is treated as over-utilization
    // Business Logic: If someone works on weekends/holidays when workingDays = 0,
    // we use a minimal baseline (1 hour) so any logged time results in >100% utilization
    if (totalWorkingHours === 0) {
      totalWorkingHours = 1; // Minimal baseline to ensure over-utilization
      isNonWorkingPeriod = true;
    }

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const billableQuery = this.buildBillableQuery(billable);
    const members = (req.body.members || []) as string[];
    
    // Prepare members filter
    let membersFilter = "";
    if (members.length > 0) {
      const memberIds = members.map(id => `'${id}'`).join(",");
      membersFilter = `AND tmiv.team_member_id IN (${memberIds})`;
    }

    // Prepare projects filter
    let projectsFilter = "";
    if (projectIds.length > 0) {
      projectsFilter = `AND p.id IN (${projectIds})`;
    } else {
      // If no projects are selected, don't show any data
      projectsFilter = `AND 1=0`; // This will match no rows
    }

    // Prepare categories filter - updated logic
    let categoriesFilter = "";
    if (categories.length > 0 && noCategory) {
      // Both specific categories and "No Category" are selected
      const categoryIds = categories.map(id => `'${id}'`).join(",");
      categoriesFilter = `AND (p.category_id IS NULL OR p.category_id IN (${categoryIds}))`;
    } else if (categories.length === 0 && noCategory) {
      // Only "No Category" is selected
      categoriesFilter = `AND p.category_id IS NULL`;
    } else if (categories.length > 0 && !noCategory) {
      // Only specific categories are selected
      const categoryIds = categories.map(id => `'${id}'`).join(",");
      categoriesFilter = `AND p.category_id IN (${categoryIds})`;
    } else {
      // categories.length === 0 && !noCategory - no categories selected, show nothing
      categoriesFilter = `AND 1=0`; // This will match no rows
    }

    // Create custom duration clause for twl table alias
    let customDurationClause = "";
    if (date_range && date_range.length === 2) {
      const start = moment(date_range[0]).format("YYYY-MM-DD");
      const end = moment(date_range[1]).format("YYYY-MM-DD");
      if (start === end) {
        customDurationClause = `AND twl.created_at::DATE = '${start}'::DATE`;
      } else {
        customDurationClause = `AND twl.created_at::DATE >= '${start}'::DATE AND twl.created_at < '${end}'::DATE + INTERVAL '1 day'`;
      }
    } else {
      const key = duration || DATE_RANGES.LAST_WEEK;
      if (key === DATE_RANGES.YESTERDAY)
        customDurationClause = "AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 day')::DATE AND twl.created_at < CURRENT_DATE::DATE";
      else if (key === DATE_RANGES.LAST_WEEK)
        customDurationClause = "AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 week')::DATE AND twl.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'";
      else if (key === DATE_RANGES.LAST_MONTH)
        customDurationClause = "AND twl.created_at >= (CURRENT_DATE - INTERVAL '1 month')::DATE AND twl.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'";
      else if (key === DATE_RANGES.LAST_QUARTER)
        customDurationClause = "AND twl.created_at >= (CURRENT_DATE - INTERVAL '3 months')::DATE AND twl.created_at < CURRENT_DATE::DATE + INTERVAL '1 day'";
    }

    // Modified query to start from team members and calculate filtered time logs
    const q = `
      SELECT 
        tmiv.team_member_id, 
        tmiv.email, 
        tmiv.name, 
        COALESCE(
          (SELECT SUM(twl.time_spent)
           FROM task_work_log twl
           LEFT JOIN tasks t ON t.id = twl.task_id
           LEFT JOIN projects p ON p.id = t.project_id
           WHERE twl.user_id = tmiv.user_id
             ${customDurationClause}
             ${projectsFilter}
             ${categoriesFilter}
             ${archivedClause}
             ${billableQuery}
             AND p.team_id = tmiv.team_id
          ), 0
        ) AS logged_time
      FROM team_member_info_view tmiv
      WHERE tmiv.team_id IN (${teamIds})
        AND tmiv.active = TRUE
        ${membersFilter}
      GROUP BY tmiv.email, tmiv.name, tmiv.team_member_id, tmiv.user_id, tmiv.team_id
      ORDER BY logged_time DESC;`;

    const result = await db.query(q, []);
    const utilization = (req.body.utilization || []) as string[];

    // Precompute totalWorkingHours * 3600 for efficiency
    const totalWorkingSeconds = totalWorkingHours * 3600;
    const hasUtilizationFilter = utilization.length > 0;

    // calculate utilization state
    for (let i = 0, len = result.rows.length; i < len; i++) {
      const member = result.rows[i];
      const loggedSeconds = member.logged_time ? parseFloat(member.logged_time) : 0;
      const utilizedHours = loggedSeconds / 3600;
      
      // For individual members, use the same logic as total calculation
      let memberWorkingHours = totalWorkingHours;
      if (isNonWorkingPeriod && loggedSeconds > 0) {
        // Any time logged during non-working period should be treated as over-utilization
        memberWorkingHours = Math.min(utilizedHours, 1); // Use actual time or 1 hour, whichever is smaller
      }
      
      const utilizationPercent = memberWorkingHours > 0 && loggedSeconds
        ? ((loggedSeconds / (memberWorkingHours * 3600)) * 100)
        : 0;
      const overUnder = utilizedHours - memberWorkingHours;

      member.value = utilizedHours ? parseFloat(utilizedHours.toFixed(2)) : 0;
      member.color_code = getColor(member.name);
      member.total_working_hours = memberWorkingHours;
      member.utilization_percent = utilizationPercent.toFixed(2);
      member.utilized_hours = utilizedHours.toFixed(2);
      member.over_under_utilized_hours = overUnder.toFixed(2);

      if (utilizationPercent < 90) {
        member.utilization_state = 'under';
      } else if (utilizationPercent <= 110) {
        member.utilization_state = 'optimal';
      } else {
        member.utilization_state = 'over';
      }
    }

    const filteredRows = hasUtilizationFilter
      ? result.rows.filter(member => utilization.includes(member.utilization_state))
      : result.rows;

    // Calculate totals
    const total_time_logs = filteredRows.reduce((sum, member) => sum + parseFloat(member.logged_time || '0'), 0);
    const total_estimated_hours = totalWorkingHours * filteredRows.length; // Total for all members
    const total_utilization = total_time_logs > 0 && total_estimated_hours > 0
      ? ((total_time_logs / (total_estimated_hours * 3600)) * 100).toFixed(1)
      : '0';

    return res.status(200).send(new ServerResponse(true, {
      filteredRows,
      totals: {
        total_time_logs: ((total_time_logs / 3600).toFixed(2)).toString(),
        total_estimated_hours: total_estimated_hours.toString(),
        total_utilization: total_utilization.toString(),
      },
    }));
  }

  @HandleExceptions()
  public static async exportTest(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {

    const archived = req.query.archived === "true";
    const teamId = this.getCurrentTeamId(req);
    const { duration, date_range } = req.query;

    const durationClause = this.getDateRangeClause(duration as string || DATE_RANGES.LAST_WEEK, date_range as string[]);

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
        WHERE in_organization(p.team_id, $1)
        ${durationClause} ${archivedClause}
        GROUP BY p.id, p.name
        ORDER BY p.name ASC;`;
    const result = await db.query(q, [teamId]);

    const labelsX = [];
    const dataX = [];

    for (const project of result.rows) {
      project.value = project.logged_time ? parseFloat(moment.duration(project.logged_time, "seconds").asHours().toFixed(2)) : 0;
      project.estimated_value = project.estimated ? parseFloat(moment.duration(project.estimated, "minutes").asHours().toFixed(2)) : 0;
      labelsX.push(project.name);
      dataX.push(project.value || 0);
    }

    const chart = new ChartJsImage();
    chart.setConfig({
      type: "bar",
      data: {
        labels: labelsX,
        datasets: [
          { label: "", data: dataX }
        ]
      },
    });
    chart.setWidth(1920).setHeight(1080).setBackgroundColor("transparent");
    const url = chart.getUrl();
    chart.toFile("test.png");
    return res.status(200).send(new ServerResponse(true, url));
  }

  private static getEstimated(project: any, type: string) {
    // if (project.estimated_man_days === 0 || project.estimated_working_days === 0) {
    //     return (parseFloat(moment.duration(project.estimated, "minutes").asHours().toFixed(2)) / int(project.hours_per_day)).toFixed(2)
    // }

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
    
    const categories = (req.body.categories || []) as string[];
    const noCategory = req.body.noCategory || false;
    const { type, billable } = req.body;

    if (!teamIds || !projectIds.length)
      return res.status(200).send(new ServerResponse(true, { users: [], projects: [] }));

    const { duration, date_range } = req.body;

    const durationClause = this.getDateRangeClause(duration || DATE_RANGES.LAST_WEEK, date_range);

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const billableQuery = this.buildBillableQuery(billable);

    // Prepare projects filter
    let projectsFilter = "";
    if (projectIds.length > 0) {
      projectsFilter = `AND p.id IN (${projectIds})`;
    } else {
      // If no projects are selected, don't show any data
      projectsFilter = `AND 1=0`; // This will match no rows
    }

    // Prepare categories filter - updated logic
    let categoriesFilter = "";
    if (categories.length > 0 && noCategory) {
      // Both specific categories and "No Category" are selected
      const categoryIds = categories.map(id => `'${id}'`).join(",");
      categoriesFilter = `AND (p.category_id IS NULL OR p.category_id IN (${categoryIds}))`;
    } else if (categories.length === 0 && noCategory) {
      // Only "No Category" is selected
      categoriesFilter = `AND p.category_id IS NULL`;
    } else if (categories.length > 0 && !noCategory) {
      // Only specific categories are selected
      const categoryIds = categories.map(id => `'${id}'`).join(",");
      categoriesFilter = `AND p.category_id IN (${categoryIds})`;
    } else {
      // categories.length === 0 && !noCategory - no categories selected, show nothing
      categoriesFilter = `AND 1=0`; // This will match no rows
    }

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
                LEFT JOIN tasks ON tasks.project_id = p.id
                LEFT JOIN task_work_log ON task_work_log.task_id = tasks.id
        WHERE p.id IN (${projectIds}) ${durationClause} ${archivedClause} ${categoriesFilter} ${billableQuery}
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

      if (project.value > 0 || project.estimated_value > 0) {
        data.push(project);
      }

    }

    return res.status(200).send(new ServerResponse(true, data));
  }
}
