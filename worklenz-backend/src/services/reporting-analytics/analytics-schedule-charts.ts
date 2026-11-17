import ChartJsImage from "chartjs-to-image";
import type { BudgetTrackingResult } from "./budget-tracking.service";
import type { CfdSeriesResult } from "./cfd-series.service";
import type { PlannedVsActualMilestonesResult } from "./planned-vs-actual-milestones.service";
import type { PlannedVsActualTasksResult } from "./planned-vs-actual-tasks.service";
import type { ProjectHealthResult } from "./project-health.service";
import type { TimeInStatusResult } from "./time-in-status.service";
import type { TimeReportResult } from "./time-report.service";
import type { UtilizationResult } from "./utilization.service";
import type { VelocitySeriesResult } from "./velocity-series.service";

const MAX_BARS = 20;
const CHART_WIDTH = 960;
const CHART_HEIGHT = 420;

const COLORS = {
  primary: "#1890ff",
  secondary: "#722ed1",
  success: "#52c41a",
  warning: "#fa8c16",
  danger: "#ff4d4f",
  muted: "#8c8c8c",
  capacity: "#d9d9d9",
  logged: "#1890ff",
  planned: "#69c0ff",
  completed: "#52c41a",
  overdue: "#ff4d4f",
  budget: "#9254de",
  spent: "#fa8c16",
  progress: "#1890ff",
  budgetUsed: "#fa8c16",
};

type ChartConfig = Record<string, unknown>;

function shortLabel(name: string, max = 18): string {
  const value = (name || "").trim() || "—";
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}

function baseOptions(indexAxis: "x" | "y" = "x"): Record<string, unknown> {
  return {
    indexAxis,
    plugins: {
      legend: {
        display: true,
        position: "bottom",
      },
    },
    scales: {
      x: { ticks: { maxRotation: 45, autoSkip: true } },
      y: { beginAtZero: true },
    },
  };
}

function velocityConfig(data: VelocitySeriesResult): ChartConfig | null {
  const series = data.series.slice(-MAX_BARS);
  if (!series.length) return null;
  return {
    type: "line",
    data: {
      labels: series.map(p => shortLabel(p.sprint_name)),
      datasets: [
        {
          label: "Committed",
          data: series.map(p => p.committed),
          borderColor: COLORS.secondary,
          backgroundColor: COLORS.secondary,
          fill: false,
          tension: 0,
        },
        {
          label: "Completed",
          data: series.map(p => p.completed),
          borderColor: COLORS.primary,
          backgroundColor: COLORS.primary,
          fill: false,
          tension: 0,
        },
      ],
    },
    options: baseOptions(),
  };
}

function pvaTasksConfig(data: PlannedVsActualTasksResult): ChartConfig | null {
  const projects = data.projects.slice(0, MAX_BARS);
  if (!projects.length) return null;
  return {
    type: "bar",
    data: {
      labels: projects.map(p => shortLabel(p.project_name)),
      datasets: [
        {
          label: "Planned",
          data: projects.map(p => p.planned),
          backgroundColor: COLORS.planned,
        },
        {
          label: "Completed",
          data: projects.map(p => p.completed),
          backgroundColor: COLORS.completed,
        },
        {
          label: "Overdue",
          data: projects.map(p => p.overdue),
          backgroundColor: COLORS.overdue,
        },
      ],
    },
    options: baseOptions(),
  };
}

function pvaMilestonesConfig(data: PlannedVsActualMilestonesResult): ChartConfig | null {
  const milestones = data.milestones.slice(0, MAX_BARS);
  if (!milestones.length) return null;
  return {
    type: "bar",
    data: {
      labels: milestones.map(m => shortLabel(m.milestone_name)),
      datasets: [
        {
          label: "Days late",
          data: milestones.map(m => m.variance_days),
          backgroundColor: COLORS.warning,
        },
      ],
    },
    options: baseOptions(),
  };
}

function projectHealthConfig(data: ProjectHealthResult): ChartConfig | null {
  const projects = data.projects.slice(0, MAX_BARS);
  if (!projects.length) return null;
  return {
    type: "bar",
    data: {
      labels: projects.map(p => shortLabel(p.project_name)),
      datasets: [
        {
          label: "Progress %",
          data: projects.map(p => p.progress_pct),
          backgroundColor: COLORS.progress,
        },
        {
          label: "Budget used %",
          data: projects.map(p => p.budget_used_pct),
          backgroundColor: COLORS.budgetUsed,
        },
      ],
    },
    options: baseOptions(),
  };
}

function utilizationConfig(data: UtilizationResult): ChartConfig | null {
  const members = data.members.slice(0, MAX_BARS);
  if (!members.length) return null;
  return {
    type: "bar",
    data: {
      labels: members.map(m => shortLabel(m.member_name)),
      datasets: [
        {
          label: "Capacity",
          data: members.map(m => m.capacity_hours),
          backgroundColor: COLORS.capacity,
        },
        {
          label: "Logged",
          data: members.map(m => m.logged_hours),
          backgroundColor: COLORS.logged,
        },
      ],
    },
    options: baseOptions(),
  };
}

function timeReportConfig(data: TimeReportResult): ChartConfig | null {
  const projects = data.projects.slice(0, MAX_BARS);
  if (!projects.length) return null;
  return {
    type: "bar",
    data: {
      labels: projects.map(p => shortLabel(p.project_name)),
      datasets: [
        {
          label: "Logged",
          data: projects.map(p => p.logged_hours),
          backgroundColor: COLORS.logged,
        },
        {
          label: "Estimated",
          data: projects.map(p => p.estimated_hours),
          backgroundColor: COLORS.muted,
        },
      ],
    },
    options: baseOptions(),
  };
}

function budgetTrackingConfig(data: BudgetTrackingResult): ChartConfig | null {
  const projects = data.projects.slice(0, MAX_BARS);
  if (!projects.length) return null;
  return {
    type: "bar",
    data: {
      labels: projects.map(p => shortLabel(p.project_name)),
      datasets: [
        {
          label: "Budget",
          data: projects.map(p => p.budget),
          backgroundColor: COLORS.budget,
        },
        {
          label: "Spent",
          data: projects.map(p => p.spent),
          backgroundColor: COLORS.spent,
        },
      ],
    },
    options: baseOptions(),
  };
}

function cfdConfig(data: CfdSeriesResult): ChartConfig | null {
  if (!data.dates.length || !data.statuses.length) return null;
  const statuses = data.statuses.slice(0, 12);
  const byStatus = new Map<string, number[]>();
  for (const row of data.series) {
    if (!statuses.some(s => s.id === row.status_id)) continue;
    const existing = byStatus.get(row.status_id) ?? data.dates.map(() => 0);
    row.values.forEach((v, i) => {
      existing[i] += Number(v ?? 0);
    });
    byStatus.set(row.status_id, existing);
  }
  return {
    type: "line",
    data: {
      labels: data.dates,
      datasets: statuses.map((status, index) => ({
        label: status.name,
        data: byStatus.get(status.id) ?? data.dates.map(() => 0),
        fill: true,
        tension: 0.2,
        borderColor: status.color || COLORS.primary,
        backgroundColor: status.color
          ? `${status.color}73`
          : `hsla(${(index * 37) % 360}, 70%, 50%, 0.35)`,
        pointRadius: 0,
      })),
    },
    options: {
      ...baseOptions(),
      scales: {
        x: { ticks: { maxRotation: 45, autoSkip: true, maxTicksLimit: 12 } },
        y: { beginAtZero: true, stacked: true },
      },
    },
  };
}

function timeInStatusConfig(data: TimeInStatusResult): ChartConfig | null {
  const rows = data.aggregate.slice(0, MAX_BARS);
  if (!rows.length) return null;
  return {
    type: "bar",
    data: {
      labels: rows.map(r => shortLabel(r.status_name, 24)),
      datasets: [
        {
          label: "Avg days",
          data: rows.map(r => r.avg_days),
          backgroundColor: rows.map(r => r.color || COLORS.primary),
        },
      ],
    },
    options: baseOptions("y"),
  };
}

export type ScheduleChartSource =
  | { kind: "velocity"; data: VelocitySeriesResult }
  | { kind: "planned-vs-actual-tasks"; data: PlannedVsActualTasksResult }
  | { kind: "planned-vs-actual-milestones"; data: PlannedVsActualMilestonesResult }
  | { kind: "project-health"; data: ProjectHealthResult }
  | { kind: "utilization"; data: UtilizationResult }
  | { kind: "time-report"; data: TimeReportResult }
  | { kind: "budget-tracking"; data: BudgetTrackingResult }
  | { kind: "cumulative-flow"; data: CfdSeriesResult }
  | { kind: "time-in-status"; data: TimeInStatusResult };

function configForSource(source: ScheduleChartSource): ChartConfig | null {
  switch (source.kind) {
    case "velocity":
      return velocityConfig(source.data);
    case "planned-vs-actual-tasks":
      return pvaTasksConfig(source.data);
    case "planned-vs-actual-milestones":
      return pvaMilestonesConfig(source.data);
    case "project-health":
      return projectHealthConfig(source.data);
    case "utilization":
      return utilizationConfig(source.data);
    case "time-report":
      return timeReportConfig(source.data);
    case "budget-tracking":
      return budgetTrackingConfig(source.data);
    case "cumulative-flow":
      return cfdConfig(source.data);
    case "time-in-status":
      return timeInStatusConfig(source.data);
    default:
      return null;
  }
}

/**
 * Renders a Chart.js config to a PNG buffer via QuickChart (chartjs-to-image).
 * Returns null when there is no data or rendering fails — callers still send the table.
 */
export async function renderScheduleChartPng(
  source: ScheduleChartSource
): Promise<Buffer | null> {
  const config = configForSource(source);
  if (!config) return null;

  try {
    const chart = new ChartJsImage();
    chart.setConfig(config);
    chart.setChartJsVersion("4");
    chart.setWidth(CHART_WIDTH);
    chart.setHeight(CHART_HEIGHT);
    chart.setBackgroundColor("white");
    const binary = await chart.toBinary();
    return Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
  } catch {
    return null;
  }
}
