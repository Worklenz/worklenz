import { CSV_UTF8_BOM, formatCsvCell } from "../../shared/csv-utils";
import db from "../../config/db";
import { resolveScheduleOwnerAccessibleProjectIds } from "./analytics-schedule-access";
import { applyLiveScheduleDateBounds } from "./analytics-schedule-date-bounds";
import {
  renderScheduleChartPngs,
  ScheduleChartSource,
  getScheduleChartTitles,
} from "./analytics-schedule-charts";
import {
  csvToExcelBuffer,
  csvToPdfBuffer,
  normalizeScheduleExportCsv,
  ScheduleExportFile,
  slugFilename,
} from "./analytics-schedule-export-formats";
import { formatSchedulePdfFilterDetails } from "./analytics-schedule-date-bounds";
import { buildSchedulePdfKpis } from "./analytics-schedule-pdf-kpis";
import { resolveSchedulePdfLogo } from "./resolve-schedule-pdf-logo";
import {
  buildBudgetTrackingCsv,
  getBudgetTrackingSeries,
  parseBudgetTrackingFilters,
} from "./budget-tracking.service";
import {
  buildCfdCsvMatrix,
  getCfdSeries,
  parseCfdFilters,
} from "./cfd-series.service";
import {
  buildPlannedVsActualMilestonesCsv,
  getPlannedVsActualMilestonesSeries,
  parsePlannedVsActualMilestonesFilters,
} from "./planned-vs-actual-milestones.service";
import {
  buildPlannedVsActualTasksCsv,
  getPlannedVsActualTasksSeries,
  parsePlannedVsActualTasksFilters,
} from "./planned-vs-actual-tasks.service";
import {
  buildProjectHealthCsv,
  getProjectHealthSeries,
  parseProjectHealthFilters,
} from "./project-health.service";
import {
  buildTimeInStatusCsv,
  getTimeInStatusSeries,
  parseTimeInStatusFilters,
} from "./time-in-status.service";
import {
  buildTimeReportCsv,
  getTimeReportSeries,
  parseTimeReportFilters,
} from "./time-report.service";
import {
  buildUtilizationCsv,
  getUtilizationSeries,
  parseUtilizationFilters,
} from "./utilization.service";
import {
  getVelocitySeries,
  parseVelocityFilters,
} from "./velocity-series.service";

type AnalyticsScheduleFormat = "PDF" | "CSV" | "Excel";

interface LiveExportPayload {
  csv: string;
  chartSource: ScheduleChartSource | null;
}

function normalizeFilterInput(filters: Record<string, unknown>): Record<string, unknown> {
  const nested =
    filters.filters && typeof filters.filters === "object" && !Array.isArray(filters.filters)
      ? (filters.filters as Record<string, unknown>)
      : {};
  return { ...nested, ...filters };
}

/** Re-pick the N most recently updated projects at send time (matches UI default seed). */
async function resolveLatestUpdatedProjectIds(
  accessible: string[],
  limit: number
): Promise<string[]> {
  if (!accessible.length || limit <= 0) return [];
  const result = await db.query(
    `SELECT id
     FROM projects
     WHERE id = ANY($1::UUID[])
     ORDER BY updated_at DESC NULLS LAST, LOWER(name) ASC
     LIMIT $2`,
    [accessible, limit]
  );
  return result.rows.map((row: { id: string }) => String(row.id));
}

async function resolveExportProjectIds(
  input: Record<string, unknown>,
  accessible: string[]
): Promise<string[]> {
  if (input.project_scope === "latest") {
    const limit = Math.max(
      1,
      Math.min(100, Number(input.chart_project_limit) || 20)
    );
    return resolveLatestUpdatedProjectIds(accessible, limit);
  }
  return accessible;
}

function buildVelocityCsv(data: Awaited<ReturnType<typeof getVelocitySeries>>): string {
  const header = [
    "Sprint",
    "Project ID",
    "Team ID",
    "Completed at",
    "Committed",
    "Completed",
    "Commitment %",
  ];
  const lines = [header.map(formatCsvCell).join(",")];
  for (const point of data.series) {
    lines.push(
      [
        point.sprint_name,
        point.project_id,
        point.team_id,
        point.completed_at ?? "",
        point.committed,
        point.completed,
        point.commitment_accuracy ?? "",
      ]
        .map(formatCsvCell)
        .join(",")
    );
  }
  return `${CSV_UTF8_BOM}${lines.join("\n")}`;
}

async function buildLivePayload(
  reportKind: string,
  ownerId: string,
  teamId: string,
  filtersJson: Record<string, unknown>,
  timezone?: string | null
): Promise<LiveExportPayload> {
  const normalized = normalizeFilterInput(filtersJson);
  // Relative date presets (yesterday, last_30_days, …) re-resolve at send time.
  const input = applyLiveScheduleDateBounds(normalized, timezone);
  const accessible = await resolveScheduleOwnerAccessibleProjectIds(
    ownerId,
    teamId,
    input
  );

  // Live = all accessible; latest = re-pick top N by updated_at; explicit = frozen IDs.
  const projectIds = await resolveExportProjectIds(input, accessible);
  const scopedInput: Record<string, unknown> = { ...input, project_ids: projectIds };

  switch (reportKind) {
    case "planned-vs-actual-tasks": {
      const filters = parsePlannedVsActualTasksFilters(scopedInput, accessible, teamId);
      const data = await getPlannedVsActualTasksSeries(filters);
      return {
        csv: buildPlannedVsActualTasksCsv(data),
        chartSource: { kind: "planned-vs-actual-tasks", data },
      };
    }
    case "planned-vs-actual-milestones": {
      const filters = parsePlannedVsActualMilestonesFilters(scopedInput, accessible, teamId);
      const data = await getPlannedVsActualMilestonesSeries(filters);
      return {
        csv: buildPlannedVsActualMilestonesCsv(data),
        chartSource: { kind: "planned-vs-actual-milestones", data },
      };
    }
    case "project-health": {
      const filters = parseProjectHealthFilters(scopedInput, accessible, teamId);
      const data = await getProjectHealthSeries(filters);
      return {
        csv: buildProjectHealthCsv(data),
        chartSource: { kind: "project-health", data },
      };
    }
    case "utilization": {
      const filters = parseUtilizationFilters(scopedInput, accessible, teamId);
      const data = await getUtilizationSeries(filters);
      return {
        csv: buildUtilizationCsv(data),
        chartSource: { kind: "utilization", data },
      };
    }
    case "time-report": {
      const filters = parseTimeReportFilters(scopedInput, accessible, teamId);
      const data = await getTimeReportSeries(filters);
      return {
        csv: buildTimeReportCsv(data),
        chartSource: { kind: "time-report", data },
      };
    }
    case "budget-tracking": {
      const filters = parseBudgetTrackingFilters(scopedInput, accessible, teamId);
      const data = await getBudgetTrackingSeries(filters);
      return {
        csv: buildBudgetTrackingCsv(data),
        chartSource: { kind: "budget-tracking", data },
      };
    }
    case "velocity": {
      const filters = parseVelocityFilters(scopedInput, accessible, teamId);
      const data = await getVelocitySeries(filters);
      return {
        csv: buildVelocityCsv(data),
        chartSource: { kind: "velocity", data },
      };
    }
    case "cumulative-flow": {
      const filters = parseCfdFilters(scopedInput, accessible, teamId);
      const data = await getCfdSeries(filters);
      return {
        csv: buildCfdCsvMatrix(data),
        chartSource: { kind: "cumulative-flow", data },
      };
    }
    case "time-in-status": {
      if (!scopedInput.limit) scopedInput.limit = 2000;
      const filters = parseTimeInStatusFilters(scopedInput, accessible, teamId);
      const data = await getTimeInStatusSeries(filters);
      return {
        csv: buildTimeInStatusCsv(data),
        chartSource: { kind: "time-in-status", data },
      };
    }
    default:
      throw new Error(`Scheduled export is not supported for report kind: ${reportKind}`);
  }
}

async function buildExportFilesFromPayload(input: {
  reportName: string;
  formats: AnalyticsScheduleFormat[];
  csv: string;
  chartSource: ScheduleChartSource | null;
  teamId: string;
  filtersJson?: Record<string, unknown>;
  timezone?: string | null;
}): Promise<ScheduleExportFile[]> {
  const base = slugFilename(input.reportName);
  const date = new Date().toISOString().slice(0, 10);
  const uniqueFormats = [...new Set(input.formats)];
  const files: ScheduleExportFile[] = [];
  const filterDetails = formatSchedulePdfFilterDetails(
    input.filtersJson,
    input.timezone
  );

  let chartPngs: Buffer[] | null = null;
  let logo: Buffer | null | undefined;
  const kpis = buildSchedulePdfKpis(input.chartSource);

  for (const format of uniqueFormats) {
    if (format === "CSV") {
      files.push({
        filename: `${base}-${date}.csv`,
        contentType: "text/csv; charset=utf-8",
        content: Buffer.from(input.csv, "utf8"),
      });
      continue;
    }

    if (format === "Excel") {
      files.push({
        filename: `${base}-${date}.xlsx`,
        contentType:
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        // Native Excel charts bound to ChartData cells (not PNG images).
        content: await csvToExcelBuffer(input.csv, input.reportName, input.chartSource),
      });
      continue;
    }

    if (chartPngs == null) {
      chartPngs = input.chartSource
        ? await renderScheduleChartPngs(input.chartSource)
        : [];
    }
    if (logo === undefined) {
      logo = await resolveSchedulePdfLogo(input.teamId);
    }
    files.push({
      filename: `${base}-${date}.pdf`,
      contentType: "application/pdf",
      content: await csvToPdfBuffer(input.reportName, input.csv, {
        chartPngs,
        chartTitles: input.chartSource
          ? getScheduleChartTitles(input.chartSource)
          : [input.reportName],
        logo,
        kpis,
        filterDetails,
        exportedOn: date,
        footerNote: `Auto-generated by Worklenz · ${date} · ${input.reportName}`,
      }),
    });
  }

  return files;
}

/**
 * Generate a live export file for a saved schedule using current data and
 * the filters captured when the schedule was saved.
 * PDF includes chart images; Excel uses native chart objects; CSV is table-only.
 */
export async function buildLiveScheduleExport(input: {
  reportKind: string;
  reportName: string;
  ownerId: string;
  teamId: string;
  format: AnalyticsScheduleFormat;
  filtersJson: Record<string, unknown>;
  /** Schedule timezone — used to re-resolve relative date presets at send time. */
  timezone?: string | null;
}): Promise<ScheduleExportFile> {
  const files = await buildLiveScheduleExports({
    ...input,
    formats: [input.format],
  });
  return files[0];
}

/**
 * Generate one or more live export files for a schedule (shared CSV payload).
 */
export async function buildLiveScheduleExports(input: {
  reportKind: string;
  reportName: string;
  ownerId: string;
  teamId: string;
  formats: AnalyticsScheduleFormat[];
  filtersJson: Record<string, unknown>;
  timezone?: string | null;
}): Promise<ScheduleExportFile[]> {
  const { csv: rawCsv, chartSource } = await buildLivePayload(
    input.reportKind,
    input.ownerId,
    input.teamId,
    input.filtersJson,
    input.timezone
  );
  // Shared by CSV / Excel / PDF so project names decode the same in every format.
  const csv = normalizeScheduleExportCsv(rawCsv);
  return buildExportFilesFromPayload({
    reportName: input.reportName,
    formats: input.formats.length ? input.formats : ["PDF"],
    csv,
    chartSource,
    teamId: input.teamId,
    filtersJson: input.filtersJson,
    timezone: input.timezone,
  });
}
