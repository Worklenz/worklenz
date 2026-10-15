import moment from "moment";
import Excel from "exceljs";
import db from "../../../config/db";
import HandleExceptions from "../../../decorators/handle-exceptions";
import { IWorkLenzRequest } from "../../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../../interfaces/worklenz-response";
import { ServerResponse } from "../../../models/server-response";
import { isValidUuid } from "../../../shared/validation-helpers";
import WorklenzControllerBase from "../../worklenz-controller-base";
import {
  DEFAULT_SPRINT_COUNT,
  getVelocity,
  trendLine,
  VELOCITY_METRICS,
  VelocityError,
  VelocityFilters,
} from "../../../services/reporting-velocity.service";

const dash = (value: unknown): string | number => (value === null || value === undefined || value === "" ? "-" : (value as string | number));

export default class ReportingVelocityExportController extends WorklenzControllerBase {
  /**
   * GET /reporting-export/velocity - the Velocity Charts report as Excel: a summary block and one
   * row per sprint (committed, completed, accuracy, delta), plus a trend column when `trend=true`.
   */
  @HandleExceptions()
  public static async export(req: IWorkLenzRequest, res: IWorkLenzResponse): Promise<IWorkLenzResponse | void> {
    const metric = (req.query.metric as string) || "issue_count";
    const projectId = req.query.projectId as string | undefined;
    const sprintCount = req.query.sprintCount === undefined ? DEFAULT_SPRINT_COUNT : Number(req.query.sprintCount);

    if (!(VELOCITY_METRICS as readonly string[]).includes(metric)) return res.status(400).send(new ServerResponse(false, null, "Invalid metric"));
    if (!projectId || !isValidUuid(projectId)) return res.status(400).send(new ServerResponse(false, null, "A valid project is required"));
    if (!Number.isInteger(sprintCount)) return res.status(400).send(new ServerResponse(false, null, "Invalid sprint count"));

    const teamId = req.user?.team_id as string;
    const filters: VelocityFilters = {
      teamId,
      projectId,
      metric: metric as VelocityFilters["metric"],
      includeSubtasks: req.query.includeSubtasks === "true",
      sprintCount,
    };

    let velocity;
    try {
      velocity = await getVelocity(filters);
    } catch (error) {
      if (error instanceof VelocityError) return res.status(error.status).send(new ServerResponse(false, null, error.message));
      throw error;
    }

    const project = await db.query(`SELECT name FROM projects WHERE id = $1 AND team_id = $2`, [projectId, teamId]);
    const projectName: string = project.rows[0]?.name ?? "Project";
    const unit = metric === "issue_count" ? "tasks" : "story points";
    const withTrend = req.query.trend === "true";
    const trend = withTrend ? trendLine(velocity.sprints.map(sprint => sprint.completed)) : [];

    const headers = ["Sprint", "Status", "Start", "End", `Committed (${unit})`, `Completed (${unit})`, "Accuracy (%)", "Delta"];
    if (withTrend) headers.push(`Trend (${unit})`);
    const widths = [30, 12, 14, 14, 20, 20, 14, 12, ...(withTrend ? [18] : [])];

    const exportDate = moment().format("MMM-DD-YYYY");
    const workbook = new Excel.Workbook();
    const sheet = workbook.addWorksheet("Velocity");
    sheet.columns = widths.map(width => ({ width }));
    const lastColumn = sheet.getColumn(headers.length).letter;

    const banner = (row: number, value: string, argb: string, size: number) => {
      const cell = sheet.getCell(`A${row}`);
      cell.value = value;
      sheet.mergeCells(`A${row}:${lastColumn}${row}`);
      cell.alignment = { horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb } };
      cell.font = { size };
    };
    banner(1, `Velocity for ${projectName}`, "D9D9D9", 16);
    banner(2, `Exported on : ${exportDate}`, "F2F2F2", 12);

    const summary: [string, string | number][] = [
      ["Metric", unit],
      ["Sprints shown", velocity.sprints.length],
      ["Includes sub-tasks", filters.includeSubtasks ? "Yes" : "No"],
      [`Average velocity (${unit})`, dash(velocity.average_velocity)],
      ["Best sprint", velocity.best_sprint ? `${velocity.best_sprint.name} (${velocity.best_sprint.completed})` : "-"],
      ["Worst sprint", velocity.worst_sprint ? `${velocity.worst_sprint.name} (${velocity.worst_sprint.completed})` : "-"],
      ["Commitment accuracy (%)", dash(velocity.commitment_accuracy)],
    ];
    summary.forEach(([label, value], index) => {
      const row = sheet.getRow(4 + index);
      row.getCell(1).value = label;
      row.getCell(1).font = { bold: true };
      row.getCell(2).value = value;
      row.getCell(2).alignment = { horizontal: "left" };
    });

    const headerRow = sheet.getRow(4 + summary.length + 1);
    headerRow.values = headers;
    headerRow.font = { bold: true };

    velocity.sprints.forEach((sprint, index) => {
      const delta = sprint.committed === null ? "-" : Math.round((sprint.completed - sprint.committed) * 100) / 100;
      const values: (string | number)[] = [
        sprint.name,
        sprint.sprint_status === "active" ? "Active" : "Completed",
        dash(sprint.start_date),
        dash(sprint.end_date),
        dash(sprint.committed),
        sprint.completed,
        dash(sprint.completion_rate),
        delta,
      ];
      if (withTrend) values.push(trend[index]);
      sheet.addRow(values);
    });

    const fileName = `${projectName} velocity - ${exportDate}`;
    res.setHeader("Content-Type", "application/vnd.openxmlformats");
    res.setHeader("Content-Disposition", `attachment; filename=${encodeURIComponent(fileName)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  }
}
