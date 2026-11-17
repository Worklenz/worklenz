import { CSV_UTF8_BOM, formatCsvCell } from "../../shared/csv-utils";
import { resolveScheduleOwnerAccessibleProjectIds } from "./analytics-schedule-access";
import {
  csvToExcelBuffer,
  csvToPdfBuffer,
  ScheduleExportFile,
  slugFilename,
} from "./analytics-schedule-export-formats";
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

function normalizeFilterInput(filters: Record<string, unknown>): Record<string, unknown> {
  const nested =
    filters.filters && typeof filters.filters === "object" && !Array.isArray(filters.filters)
      ? (filters.filters as Record<string, unknown>)
      : {};
  return { ...nested, ...filters };
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

async function buildLiveCsv(
  reportKind: string,
  ownerId: string,
  teamId: string,
  filtersJson: Record<string, unknown>
): Promise<string> {
  const input = normalizeFilterInput(filtersJson);
  const accessible = await resolveScheduleOwnerAccessibleProjectIds(
    ownerId,
    teamId,
    input
  );

  // Force export scope to the intersection resolved for the owner.
  const scopedInput: Record<string, unknown> = { ...input, project_ids: accessible };

  switch (reportKind) {
    case "planned-vs-actual-tasks": {
      const filters = parsePlannedVsActualTasksFilters(scopedInput, accessible, teamId);
      return buildPlannedVsActualTasksCsv(await getPlannedVsActualTasksSeries(filters));
    }
    case "planned-vs-actual-milestones": {
      const filters = parsePlannedVsActualMilestonesFilters(scopedInput, accessible, teamId);
      return buildPlannedVsActualMilestonesCsv(
        await getPlannedVsActualMilestonesSeries(filters)
      );
    }
    case "project-health": {
      const filters = parseProjectHealthFilters(scopedInput, accessible, teamId);
      return buildProjectHealthCsv(await getProjectHealthSeries(filters));
    }
    case "utilization": {
      const filters = parseUtilizationFilters(scopedInput, accessible, teamId);
      return buildUtilizationCsv(await getUtilizationSeries(filters));
    }
    case "time-report": {
      const filters = parseTimeReportFilters(scopedInput, accessible, teamId);
      return buildTimeReportCsv(await getTimeReportSeries(filters));
    }
    case "budget-tracking": {
      const filters = parseBudgetTrackingFilters(scopedInput, accessible, teamId);
      return buildBudgetTrackingCsv(await getBudgetTrackingSeries(filters));
    }
    case "velocity": {
      const filters = parseVelocityFilters(scopedInput, accessible, teamId);
      return buildVelocityCsv(await getVelocitySeries(filters));
    }
    case "cumulative-flow": {
      const filters = parseCfdFilters(scopedInput, accessible, teamId);
      return buildCfdCsvMatrix(await getCfdSeries(filters));
    }
    case "time-in-status": {
      if (!scopedInput.limit) scopedInput.limit = 2000;
      const filters = parseTimeInStatusFilters(scopedInput, accessible, teamId);
      return buildTimeInStatusCsv(await getTimeInStatusSeries(filters));
    }
    default:
      throw new Error(`Scheduled export is not supported for report kind: ${reportKind}`);
  }
}

/**
 * Generate a live export file for a saved schedule using current data and
 * the filters captured when the schedule was saved.
 */
export async function buildLiveScheduleExport(input: {
  reportKind: string;
  reportName: string;
  ownerId: string;
  teamId: string;
  format: AnalyticsScheduleFormat;
  filtersJson: Record<string, unknown>;
}): Promise<ScheduleExportFile> {
  const csv = await buildLiveCsv(
    input.reportKind,
    input.ownerId,
    input.teamId,
    input.filtersJson
  );
  const base = slugFilename(input.reportName);
  const date = new Date().toISOString().slice(0, 10);

  if (input.format === "CSV") {
    return {
      filename: `${base}-${date}.csv`,
      contentType: "text/csv; charset=utf-8",
      content: Buffer.from(csv, "utf8"),
    };
  }

  if (input.format === "Excel") {
    return {
      filename: `${base}-${date}.xlsx`,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      content: await csvToExcelBuffer(csv, input.reportName),
    };
  }

  return {
    filename: `${base}-${date}.pdf`,
    contentType: "application/pdf",
    content: await csvToPdfBuffer(input.reportName, csv),
  };
}
