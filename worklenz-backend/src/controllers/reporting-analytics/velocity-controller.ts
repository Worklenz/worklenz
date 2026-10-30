import Excel from "exceljs";
import moment from "moment";

import {
  expandAccessibleProjects,
  parseAccessibleTeamIdsFromInput,
} from "../../shared/analytics-expand-projects";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import WorklenzControllerBase from "../worklenz-controller-base";
import HandleExceptions from "../../decorators/handle-exceptions";
import {
  getVelocitySeries,
  parseVelocityFilters,
  VelocitySeriesFilters,
  VelocitySeriesResult,
} from "../../services/reporting-analytics/velocity-series.service";

type AnalyticsRequest = IWorkLenzRequest & {
  analyticsAccessibleProjectIds?: string[];
};

export default class VelocityController extends WorklenzControllerBase {
  @HandleExceptions()
  public static async getSeries(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<IWorkLenzResponse> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      return res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
    }

    const query = req.query as Record<string, unknown>;
    const base =
      (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
    const accessible = await expandAccessibleProjects(
      userId,
      teamId,
      base,
      await parseAccessibleTeamIdsFromInput(userId, teamId, query)
    );
    const filters = parseVelocityFilters(query, accessible, teamId);

    const data = await getVelocitySeries(filters);
    return res.status(200).send(new ServerResponse(true, data));
  }

  @HandleExceptions()
  public static async exportExcel(
    req: IWorkLenzRequest,
    res: IWorkLenzResponse
  ): Promise<void> {
    const teamId = req.user?.team_id;
    const userId = req.user?.id;
    if (!teamId || !userId) {
      res.status(401).send(new ServerResponse(false, null, "Unauthorized"));
      return;
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const merged = { ...body, ...((body.filters as object) ?? {}) };
    const base =
      (req as AnalyticsRequest).analyticsAccessibleProjectIds ?? [];
    const accessible = await expandAccessibleProjects(
      userId,
      teamId,
      base,
      await parseAccessibleTeamIdsFromInput(userId, teamId, merged)
    );
    const filters = parseVelocityFilters(merged, accessible, teamId);

    const data = await getVelocitySeries(filters);
    const chartImage =
      typeof body.chart_image === "string" ? body.chart_image : null;

    await VelocityController.writeExcel(res, data, filters, chartImage);
  }

  private static async writeExcel(
    res: IWorkLenzResponse,
    data: VelocitySeriesResult,
    filters: VelocitySeriesFilters,
    chartImage: string | null
  ): Promise<void> {
    const exportDate = moment().format("MMM-DD-YYYY");
    const fileName = `Velocity-Report-${exportDate}`;
    const workbook = new Excel.Workbook();

    const summary = workbook.addWorksheet("Summary");
    summary.getCell("A1").value = "Velocity Report";
    summary.getCell("A1").font = { size: 16, bold: true };
    summary.mergeCells("A1:D1");

    summary.getCell("A2").value = `Exported on: ${exportDate}`;
    summary.getCell("A3").value = `View by: ${filters.viewBy}`;
    summary.getCell("A4").value = `Metric: ${filters.metric}`;
    summary.getCell("A5").value = `Avg window: ${filters.avgWindow}`;
    summary.getCell("A6").value = `Sprint count filter: ${filters.sprintCount}`;

    summary.getCell("A8").value = "KPI";
    summary.getCell("B8").value = "Value";
    summary.getRow(8).font = { bold: true };

    summary.getCell("A9").value = "Average velocity";
    summary.getCell("B9").value = data.kpis.avg_velocity;
    summary.getCell("A10").value = "Last sprint velocity";
    summary.getCell("B10").value = data.kpis.last_sprint_velocity ?? "—";
    summary.getCell("A11").value = "Commitment accuracy %";
    summary.getCell("B11").value = data.kpis.commitment_accuracy_pct ?? "—";
    summary.getCell("A12").value = "Completed sprints";
    summary.getCell("B12").value = data.kpis.completed_sprint_count;

    if (chartImage) {
      const base64 = chartImage.replace(/^data:image\/\w+;base64,/, "");
      try {
        const imageId = workbook.addImage({
          base64,
          extension: "png",
        });
        summary.addImage(imageId, {
          tl: { col: 0, row: 14 },
          ext: { width: 640, height: 320 },
        });
      } catch {
        // Ignore invalid chart images — still export tabular sheets.
      }
    }

    const breakdown = workbook.addWorksheet("Breakdown");
    const header = [
      "Sprint",
      "Project ID",
      "Team ID",
      "Completed at",
      "Committed",
      "Completed",
      "Commitment %",
      "Member / Overlay",
      "Committed (stack)",
      "Completed (stack)",
    ];
    breakdown.addRow(header);
    breakdown.getRow(1).font = { bold: true };

    for (const point of data.series) {
      const stacks =
        point.stacks && point.stacks.length > 0
          ? point.stacks
          : point.overlays && point.overlays.length > 0
            ? point.overlays
            : [null];

      for (const stack of stacks) {
        breakdown.addRow([
          point.sprint_name,
          point.project_id,
          point.team_id,
          point.completed_at ?? "",
          point.committed,
          point.completed,
          point.commitment_accuracy ?? "",
          stack?.name ?? "",
          stack?.committed ?? "",
          stack?.completed ?? "",
        ]);
      }
    }

    breakdown.columns.forEach(col => {
      col.width = 18;
    });

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=${fileName}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  }
}
