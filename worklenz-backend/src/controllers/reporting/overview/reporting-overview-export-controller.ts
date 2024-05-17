import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import ReportingOverviewBase from "./reporting-overview-base";
import { ReportingExportModel } from "../../../models/reporting-export";
import { formatDuration, formatLogText, getColor, int } from "../../../shared/utils";
import moment from "moment";
import Excel from "exceljs";
import ReportingControllerBase from "../reporting-controller-base";
import { TASK_PRIORITY_COLOR_ALPHA } from "../../../shared/constants";

export default class ReportingOverviewExportController extends ReportingOverviewBase {

  @HandleExceptions()
  public static async getProjects(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse> {
    const { searchQuery, sortField, sortOrder, size, offset } = this.toPaginationOptions(req.query, ["p.name"]);
    const archived = req.query.archived === "true";

    const teamId = req.query.team as string;

    const archivedClause = archived
      ? ""
      : `AND p.id NOT IN (SELECT project_id FROM archived_projects WHERE project_id = p.id AND user_id = '${req.user?.id}') `;

    const teamFilterClause = `p.team_id = $1`;

    const result = await ReportingControllerBase.getProjectsByTeam(teamId, size, offset, searchQuery, sortField, sortOrder, "", "", "", archivedClause, teamFilterClause, "");

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
        const update = project.update[0];
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

    return result;
  }




  @HandleExceptions()
  public static async getProjectsByTeamOrMember(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const teamId = (req.query.team_id as string)?.trim() || null;
    const teamName = (req.query.team_name as string)?.trim() || null;

    const result = await ReportingControllerBase.exportProjects(teamId as string);

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamName} projects - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Projects");

    // define columns in table
    sheet.columns = [
      { header: "Project", key: "name", width: 30 },
      { header: "Client", key: "client", width: 20 },
      { header: "Category", key: "category", width: 20 },
      { header: "Status", key: "status", width: 20 },
      { header: "Start Date", key: "start_date", width: 20 },
      { header: "End Date", key: "end_date", width: 20 },
      { header: "Days Left/Overdue", key: "days_left", width: 20 },
      { header: "Estimated Hours", key: "estimated_hours", width: 20 },
      { header: "Actual Hours", key: "actual_hours", width: 20 },
      { header: "Done Tasks(%)", key: "done_tasks", width: 20 },
      { header: "Doing Tasks(%)", key: "doing_tasks", width: 20 },
      { header: "Todo Tasks(%)", key: "todo_tasks", width: 20 },
      { header: "Last Activity", key: "last_activity", width: 20 },
      { header: "Project Health", key: "project_health", width: 20 },
      { header: "Project Update", key: "project_update", width: 20 }
    ];

    // set title
    sheet.getCell("A1").value = `Projects from ${teamName}`;
    sheet.mergeCells("A1:O1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:O2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    // const start = 'duartion start';
    // const end = 'duartion end';
    // sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    // sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(4).values = ["Project", "Client", "Category", "Status", "Start Date", "End Date", "Days Left/Overdue", "Estimated Hours", "Actual Hours", "Done Tasks(%)", "Doing Tasks(%)", "Todo Tasks(%)", "Last Activity", "Project Health", "Project Update"];
    sheet.getRow(4).font = { bold: true };

    // set table data
    for (const item of result.projects) {

      if (item.is_overdue && item.days_left) {
        item.days_left = `-${item.days_left}`;
      }

      if (item.is_today) {
        item.days_left = `Today`;
      }

      sheet.addRow({
        name: item.name,
        client: item.client ? item.client : "-",
        category: item.category_name ? item.category_name : "-",
        status: item.status_name ? item.status_name : "-",
        start_date: item.start_date ? moment(item.start_date).format("YYYY-MM-DD") : "-",
        end_date: item.end_date ? moment(item.end_date).format("YYYY-MM-DD") : "-",
        days_left: item.days_left ? item.days_left.toString() : "-",
        estimated_hours: item.estimated_time ? item.estimated_time.toString() : "-",
        actual_hours: item.actual_time ? item.actual_time.toString() : "-",
        done_tasks: item.tasks_stat.done ? `${item.tasks_stat.done}` : "-",
        doing_tasks: item.tasks_stat.doing ? `${item.tasks_stat.doing}` : "-",
        todo_tasks: item.tasks_stat.todo ? `${item.tasks_stat.todo}` : "-",
        last_activity: item.last_activity ? item.last_activity.last_activity_string : "-",
        project_health: item.project_health,
        project_update: item.comment ? item.comment : "-",
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
  public static async getMembersByTeam(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const teamId = (req.query.team_id as string)?.trim() || null;
    const teamName = (req.query.team_name as string)?.trim() || null;

    const result = await ReportingExportModel.getMembersByTeam(teamId);

    for (const member of result) {
      member.projects = int(member.projects);
      member.tasks = int(member.tasks);
      member.overdue = int(member.overdue);
      member.completed = int(member.completed);
      member.ongoing = int(member.ongoing);
    }

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamName} members - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Members");

    // define columns in table
    sheet.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Email", key: "email", width: 20 },
      { header: "Projects", key: "projects", width: 20 },
      { header: "Tasks", key: "tasks", width: 20 },
      { header: "Overdue Tasks", key: "overdue_tasks", width: 20 },
      { header: "Completed Tasks", key: "completed_tasks", width: 20 },
      { header: "Ongoing Tasks", key: "ongoing_tasks", width: 20 },
    ];

    // set title
    sheet.getCell("A1").value = `Members from ${teamName}`;
    sheet.mergeCells("A1:G1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:G2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    // const start = 'duartion start';
    // const end = 'duartion end';
    // sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    // sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(4).values = ["Name", "Email", "Projects", "Tasks", "Overdue Tasks", "Completed Tasks", "Ongoing Tasks"];
    sheet.getRow(4).font = { bold: true };

    // set table data
    for (const item of result) {
      sheet.addRow({
        name: item.name,
        email: item.email ? item.email : "-",
        projects: item.projects ? item.projects.toString() : "-",
        tasks: item.tasks ? item.tasks.toString() : "-",
        overdue_tasks: item.overdue ? item.overdue.toString() : "-",
        completed_tasks: item.completed ? item.completed.toString() : "-",
        ongoing_tasks: item.ongoing ? item.ongoing.toString() : "-",
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
  public static async exportProjectMembers(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const projectId = (req.query.project_id as string)?.trim() || null;
    const projectName = (req.query.project_name as string)?.trim() || null;
    const teamName = (req.query.team_name as string)?.trim() || "";

    const results = await ReportingExportModel.getProjectMembers(projectId as string);

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamName} ${projectName} members - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Members");

    // define columns in table
    sheet.columns = [
      { header: "Name", key: "name", width: 30 },
      { header: "Tasks Count", key: "tasks_count", width: 20 },
      { header: "Completed Tasks", key: "completed_tasks", width: 20 },
      { header: "Incomplete Tasks", key: "incomplete_tasks", width: 20 },
      { header: "Overdue Tasks", key: "overdue_tasks", width: 20 },
      { header: "Contribution(%)", key: "contribution", width: 20 },
      { header: "Progress(%)", key: "progress", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 },
    ];

    // set title
    sheet.getCell("A1").value = `Members from ${projectName} - ${teamName}`;
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
    sheet.getRow(4).values = ["Name", "Tasks Count", "Completed Tasks", "Incomplete Tasks", "Overdue Tasks", "Contribution(%)", "Progress(%)", "Logged Time"];
    sheet.getRow(4).font = { bold: true };

    // set table data
    for (const item of results) {
      sheet.addRow({
        name: item.name,
        tasks_count: item.tasks_count ? item.tasks_count : "-",
        completed_tasks: item.completed ? item.completed : "-",
        incomplete_tasks: item.incompleted ? item.incompleted : "-",
        overdue_tasks: item.overdue ? item.overdue : "-",
        contribution: item.contribution ? item.contribution : "-",
        progress: item.progress ? item.progress : "-",
        logged_time: item.time_logged ? item.time_logged : "-",
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
  public static async exportProjectTasks(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const projectId = (req.query.project_id as string)?.trim() || null;
    const projectName = (req.query.project_name as string)?.trim() || null;
    const teamName = (req.query.team_name as string)?.trim() || "";

    const results = await this.getAllTasks(projectId);

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamName} ${projectName} tasks - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Tasks");

    // define columns in table
    sheet.columns = [
      { header: "Task", key: "task", width: 30 },
      { header: "Status", key: "status", width: 20 },
      { header: "Priority", key: "priority", width: 20 },
      { header: "Phase", key: "phase", width: 20 },
      { header: "Due Date", key: "due_date", width: 20 },
      { header: "Completed On", key: "completed_on", width: 20 },
      { header: "Days Overdue", key: "days_overdue", width: 20 },
      { header: "Estimated Time", key: "estimated_time", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 },
      { header: "Overlogged Time", key: "overlogged_time", width: 20 },
    ];

    // set title
    sheet.getCell("A1").value = `Tasks from ${projectName} - ${teamName}`;
    sheet.mergeCells("A1:J1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:J2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    // const start = 'duartion start';
    // const end = 'duartion end';
    // sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    // sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(4).values = ["Task", "Status", "Priority", "Phase", "Due Date", "Completed On", "Days Overdue", "Estimated Time", "Logged Time", "Overlogged Time"];
    sheet.getRow(4).font = { bold: true };

    // set table data
    for (const item of results) {
      const time_spent = { hours: ~~(item.total_minutes_spent / 60), minutes: item.total_minutes_spent % 60 };
      item.total_minutes_spent = Math.ceil(item.total_seconds_spent / 60);

      sheet.addRow({
        task: item.name,
        status: item.status_name ? item.status_name : "-",
        priority: item.priority_name ? item.priority_name : "-",
        phase: item.phase_name ? item.phase_name : "-",
        due_date: item.end_date ? moment(item.end_date).format("YYYY-MM-DD") : "-",
        completed_on: item.completed_at ? moment(item.completed_at).format("YYYY-MM-DD") : "-",
        days_overdue: item.overdue_days ? item.overdue_days : "-",
        estimated_time: item.total_minutes !== "0" ? `${~~(item.total_minutes / 60)}h ${(item.total_minutes % 60)}m` : "-",
        logged_time: item.total_minutes_spent ? `${time_spent.hours}h ${(time_spent.minutes)}m` : "-",
        overlogged_time: item.overlogged_time_string !== "0h 0m" ? item.overlogged_time_string : "-",
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
  public static async exportMemberTasks(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const teamMemberId = (req.query.team_member_id as string)?.trim() || null;
    const teamMemberName = (req.query.team_member_name as string)?.trim() || null;
    const teamName = (req.query.team_name as string)?.trim() || "";

    const { duration, date_range, only_single_member, archived} = req.query;

    const includeArchived = req.query.archived === "true";

    let dateRange: string[] = [];
    if (typeof date_range === "string") {
      dateRange = date_range.split(",");
    }

    const results = await ReportingExportModel.getMemberTasks(teamMemberId as string, null, only_single_member as string, duration as string, dateRange, includeArchived, req.user?.id as string);

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamMemberName} tasks - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Tasks");

    // define columns in table
    sheet.columns = [
      { header: "Task", key: "task", width: 30 },
      { header: "Project", key: "project", width: 20 },
      { header: "Status", key: "status", width: 20 },
      { header: "Priority", key: "priority", width: 20 },
      { header: "Due Date", key: "due_date", width: 20 },
      { header: "Completed Date", key: "completed_on", width: 20 },
      { header: "Estimated Time", key: "estimated_time", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 },
      { header: "Overlogged Time", key: "overlogged_time", width: 20 },
    ];

    // set title
    sheet.getCell("A1").value = `Tasks of ${teamMemberName} - ${teamName}`;
    sheet.mergeCells("A1:I1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:I2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    // const start = 'duartion start';
    // const end = 'duartion end';
    // sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    // sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(4).values = ["Task", "Project", "Status", "Priority", "Due Date", "Completed Date", "Estimated Time", "Logged Time", "Overlogged Time"];
    sheet.getRow(4).font = { bold: true };

    // set table data
    for (const item of results) {
      sheet.addRow({
        task: item.name,
        project: item.project_name ? item.project_name : "-",
        status: item.status_name ? item.status_name : "-",
        priority: item.priority_name ? item.priority_name : "-",
        due_date: item.end_date ? moment(item.end_date).format("YYYY-MM-DD") : "-",
        completed_on: item.completed_date ? moment(item.completed_date).format("YYYY-MM-DD") : "-",
        estimated_time: item.estimated_string ? item.estimated_string : "-",
        logged_time: item.time_spent_string ? item.time_spent_string : "-",
        overlogged_time: item.overlogged_time ? item.overlogged_time : "-",
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
  public static async exportFlatTasks(req: IWorkLenzRequest, res: IWorkLenzResponse) {
    const teamMemberId = (req.query.team_member_id as string)?.trim() || null;
    const teamMemberName = (req.query.team_member_name as string)?.trim() || null;
    const projectId = (req.query.project_id as string)?.trim() || null;
    const projectName = (req.query.project_name as string)?.trim() || null;

    const includeArchived = req.query.archived === "true";

    const results = await ReportingExportModel.getMemberTasks(teamMemberId as string, projectId,  "false", "", [], includeArchived, req.user?.id as string);

    // excel file
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `${teamMemberName}'s tasks in ${projectName}  - ${exportDate}`;
    const workbook = new Excel.Workbook();

    const sheet = workbook.addWorksheet("Tasks");

    // define columns in table
    sheet.columns = [
      { header: "Task", key: "task", width: 30 },
      { header: "Project", key: "project", width: 20 },
      { header: "Status", key: "status", width: 20 },
      { header: "Priority", key: "priority", width: 20 },
      { header: "Due Date", key: "due_date", width: 20 },
      { header: "Completed Date", key: "completed_on", width: 20 },
      { header: "Estimated Time", key: "estimated_time", width: 20 },
      { header: "Logged Time", key: "logged_time", width: 20 },
      { header: "Overlogged Time", key: "overlogged_time", width: 20 },
    ];

    // set title
    sheet.getCell("A1").value = `Tasks of ${teamMemberName} in ${projectName}`;
    sheet.mergeCells("A1:I1");
    sheet.getCell("A1").alignment = { horizontal: "center" };
    sheet.getCell("A1").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "D9D9D9" } };
    sheet.getCell("A1").font = { size: 16 };

    // set export date
    sheet.getCell("A2").value = `Exported on : ${exportDate}`;
    sheet.mergeCells("A2:I2");
    sheet.getCell("A2").alignment = { horizontal: "center" };
    sheet.getCell("A2").style.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "F2F2F2" } };
    sheet.getCell("A2").font = { size: 12 };

    // set duration
    // const start = 'duartion start';
    // const end = 'duartion end';
    // sheet.getCell("A3").value = `From : ${start} To : ${end}`;
    // sheet.mergeCells("A3:D3");

    // set table headers
    sheet.getRow(4).values = ["Task", "Project", "Status", "Priority", "Due Date", "Completed Date", "Estimated Time", "Logged Time", "Overlogged Time"];
    sheet.getRow(4).font = { bold: true };

    // set table data
    for (const item of results) {
      sheet.addRow({
        task: item.name,
        project: item.project_name ? item.project_name : "-",
        status: item.status_name ? item.status_name : "-",
        priority: item.priority_name ? item.priority_name : "-",
        due_date: item.end_date ? moment(item.end_date).format("YYYY-MM-DD") : "-",
        completed_on: item.completed_date ? moment(item.completed_date).format("YYYY-MM-DD") : "-",
        estimated_time: item.estimated_string ? item.estimated_string : "-",
        logged_time: item.time_spent_string ? item.time_spent_string : "-",
        overlogged_time: item.overlogged_time ? item.overlogged_time : "-",
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
