import moment from "moment";
import Excel from "exceljs";
import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import WorklenzControllerBase from "../../worklenz-controller-base";
import {
  FlowError,
  getAllTimeInStatusTasks,
  groupTimeInStatusTasks,
  TimeInStatusTask,
} from "../../../services/reporting-flow.service";
import { parseTimeInStatusRequest } from "./time-in-status-query";

interface ExportColumn {
  header: string;
  width: number;
  value: (task: TimeInStatusTask) => string;
}

const dash = (value: unknown): string => (value === null || value === undefined || value === "" ? "-" : String(value));

/** "11d 4h" / "4h", matching the report table. */
const formatDwell = (hours: number): string => {
  const whole = Math.max(Math.round(hours), 0);
  const days = Math.floor(whole / 24);
  return days > 0 ? `${days}d ${whole % 24}h` : `${whole}h`;
};

/** Keyed like the frontend column visibility so the requested `columns` map straight onto these. */
const COLUMNS: Record<string, ExportColumn> = {
  taskKey: { header: "Key", width: 14, value: t => dash(t.task_key) },
  name: { header: "Task", width: 40, value: t => dash(t.name) },
  project: { header: "Project", width: 26, value: t => dash(t.project_name) },
  status: { header: "Current Status", width: 20, value: t => dash(t.status_name) },
  timeInStatus: { header: "Time in Status", width: 16, value: t => formatDwell(t.hours_in_status) },
  timeOverdue: { header: "Time Overdue", width: 16, value: t => (t.hours_overdue === null ? "-" : formatDwell(t.hours_overdue)) },
  assignees: { header: "Assigned To", width: 30, value: t => (t.assignees.length ? t.assignees.map(a => a.name).join(", ") : "Unassigned") },
  lastUpdated: { header: "Last Updated", width: 16, value: t => moment(t.updated_at).format("YYYY-MM-DD") },
};

export default class ReportingTimeInStatusExportController extends WorklenzControllerBase {
  /**
   * GET /reporting-export/time-in-status
   *  - detailed=true -> every open task, every column, filters ignored
   *  - otherwise     -> the current view: filters, search, sort and visible columns; grouped when view=grouped
   */
  @HandleExceptions()
  public static async export(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse | void> {
    const parsed = parseTimeInStatusRequest(req);
    if (typeof parsed === "string") return res.status(400).send(new ServerResponse(false, null, parsed));

    const detailed = req.query.detailed === "true";
    const grouped = !detailed && req.query.view === "grouped";
    const teamName = (req.query.team_name as string)?.trim() || "Team";

    let tasks: TimeInStatusTask[];
    let truncated: boolean;
    try {
      const filters = detailed ? { ...parsed.filters, projectIds: undefined, assigneeIds: undefined, projectId: undefined, scope: "team" as const } : parsed.filters;
      const query = detailed ? {} : parsed.query;
      ({ tasks, truncated } = await getAllTimeInStatusTasks(filters, query, 5000));
    } catch (error) {
      if (error instanceof FlowError) return res.status(error.status).send(new ServerResponse(false, null, error.message));
      throw error;
    }

    const requested = ((req.query.columns as string) || "")
      .split(",")
      .map(key => key.trim())
      .filter(key => key in COLUMNS);
    const keys = detailed || !requested.length ? Object.keys(COLUMNS) : requested;
    if (!keys.includes("name")) keys.splice(keys.includes("taskKey") ? 1 : 0, 0, "name");
    const columns = keys.map(key => COLUMNS[key]);

    const exportDate = moment().format("MMM-DD-YYYY");
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet("Time in Status");
    sheet.columns = columns.map(c => ({ width: c.width }));
    const lastColumn = sheet.getColumn(columns.length).letter;

    const banner = (cell: string, value: string, argb: string, size: number) => {
      sheet.getCell(cell).value = value;
      sheet.mergeCells(`${cell}:${lastColumn}${cell.slice(1)}`);
      sheet.getCell(cell).alignment = { horizontal: "center" };
      sheet.getCell(cell).style.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      sheet.getCell(cell).font = { size };
    };
    banner("A1", `Time in Status for ${teamName}${grouped ? ` - grouped by ${parsed.groupBy}` : ""}`, "D9D9D9", 16);
    banner("A2", `Exported on : ${exportDate}`, "F2F2F2", 12);
    if (truncated) banner("A3", "Only the first rows are included. Narrow the filters to export the rest.", "FFF2CC", 11);

    const headerRow = sheet.getRow(5);
    headerRow.values = columns.map(c => c.header);
    headerRow.font = { bold: true };

    if (grouped) {
      for (const group of groupTimeInStatusTasks(tasks, parsed.groupBy)) {
        const name = group.group_name || "Unassigned";
        const row = sheet.addRow([`${name} (${group.task_count} tasks, avg ${formatDwell(group.avg_hours)}, ${group.overdue_count} overdue)`]);
        sheet.mergeCells(`A${row.number}:${lastColumn}${row.number}`);
        row.font = { bold: true };
        row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "E6EEF8" } };
        for (const task of group.tasks) sheet.addRow(columns.map(c => c.value(task)));
      }
    } else {
      for (const task of tasks) sheet.addRow(columns.map(c => c.value(task)));
    }

    const fileName = `${teamName} time in status (${detailed ? "detailed" : grouped ? "grouped" : "filtered"}) - ${exportDate}`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(fileName)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
