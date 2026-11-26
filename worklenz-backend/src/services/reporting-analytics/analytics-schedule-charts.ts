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
/** Taller default so landscape PDF page-1 charts fill available height. */
const CHART_HEIGHT = 520;

interface WithUpdatedAt {
  updated_at?: string | null;
}

/** Match on-screen analytics charts: latest updated N, not first N by name. */
function latestUpdatedSlice<T extends WithUpdatedAt>(rows: T[], limit = MAX_BARS): T[] {
  return [...rows]
    .sort((a, b) => {
      const aTs = a.updated_at ? Date.parse(String(a.updated_at)) : 0;
      const bTs = b.updated_at ? Date.parse(String(b.updated_at)) : 0;
      return bTs - aTs;
    })
    .slice(0, limit);
}

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
  const projects = latestUpdatedSlice(data.projects);
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

const PROJECT_HEALTH_TONE_COLORS = {
  on_track: "#52c41a",
  at_risk: "#faad14",
  off_track: "#ff4d4f",
  not_set: "#8c8c8c",
} as const;

export interface ScheduleChartLegendItem {
  label: string;
  color: string;
  count: number;
}

const PROJECT_HEALTH_LEGEND: Array<{
  key: keyof typeof PROJECT_HEALTH_TONE_COLORS;
  label: string;
}> = [
  { key: "on_track", label: "On track" },
  { key: "at_risk", label: "At risk" },
  { key: "off_track", label: "Off track" },
  { key: "not_set", label: "Not set" },
];

export function buildProjectHealthLegend(
  data: ProjectHealthResult
): ScheduleChartLegendItem[] {
  return PROJECT_HEALTH_LEGEND.map(slice => ({
    label: slice.label,
    color: PROJECT_HEALTH_TONE_COLORS[slice.key],
    count: data.kpis[slice.key] ?? 0,
  }));
}

function projectHealthBarConfig(data: ProjectHealthResult): ChartConfig | null {
  const projects = latestUpdatedSlice(data.projects);
  if (!projects.length) return null;
  const options = baseOptions();
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
    options: {
      ...options,
      scales: {
        ...(options.scales as Record<string, unknown>),
        y: {
          beginAtZero: true,
          suggestedMax: 100,
          ticks: { callback: (value: string | number) => `${value}%` },
        },
      },
    },
  };
}

/**
 * Project Health donut PNG: ring + center total only.
 * Legend is drawn point-wise in the PDF (like the on-page card) so labels stay readable.
 */
function projectHealthDonutConfig(data: ProjectHealthResult): ChartConfig | null {
  const allSlices = PROJECT_HEALTH_LEGEND.map(slice => ({
    ...slice,
    count: data.kpis[slice.key] ?? 0,
    color: PROJECT_HEALTH_TONE_COLORS[slice.key],
  }));

  const visibleSlices = allSlices.filter(slice => slice.count > 0);
  if (!visibleSlices.length) return null;

  const total = allSlices.reduce((sum, slice) => sum + slice.count, 0);

  return {
    type: "doughnut",
    data: {
      labels: visibleSlices.map(s => s.label),
      datasets: [
        {
          data: visibleSlices.map(s => s.count),
          backgroundColor: visibleSlices.map(s => s.color),
          borderColor: "#ffffff",
          borderWidth: 2,
        },
      ],
    },
    options: {
      cutout: "62%",
      plugins: {
        legend: { display: false },
        // QuickChart center label (mirrors page total + "projects").
        doughnutlabel: {
          labels: [
            {
              text: String(total),
              font: { size: 26, weight: "bold" },
              color: "#262626",
            },
            {
              text: "projects",
              font: { size: 12 },
              color: "#8c8c8c",
            },
          ],
        },
      },
    },
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
  const projects = latestUpdatedSlice(data.projects);
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
  const projects = latestUpdatedSlice(data.projects);
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

/** Chart.js configs used for PDF PNGs and native Excel chart data. */
export function getScheduleChartConfigs(source: ScheduleChartSource): ChartConfig[] {
  return configsForSource(source);
}

/** Topic titles drawn above each chart in scheduled PDFs (matches on-page chart topics). */
export function getScheduleChartTitles(source: ScheduleChartSource): string[] {
  switch (source.kind) {
    case "project-health":
      return ["Progress & budget", "Health status"];
    case "velocity":
      return ["Velocity"];
    case "planned-vs-actual-tasks":
      return ["Planned vs Actual: Tasks"];
    case "planned-vs-actual-milestones":
      return ["Planned vs Actual: Milestones"];
    case "utilization":
      return ["Utilization"];
    case "time-report":
      return ["Time Report"];
    case "budget-tracking":
      return ["Budget Tracking"];
    case "cumulative-flow":
      return ["Cumulative Flow"];
    case "time-in-status":
      return ["Time in Status"];
    default:
      return [];
  }
}

/**
 * Optional hint lines under each chart topic in scheduled PDFs.
 * Empty string = no hint for that chart slot.
 */
export function getScheduleChartHints(source: ScheduleChartSource): string[] {
  switch (source.kind) {
    case "project-health":
      return ["", "Based on health set in project settings"];
    default:
      return [];
  }
}

/**
 * Optional point-wise legends per chart slot (drawn in PDF, not baked into PNG).
 * Empty array = no legend for that slot.
 */
export function getScheduleChartLegends(
  source: ScheduleChartSource
): ScheduleChartLegendItem[][] {
  switch (source.kind) {
    case "project-health":
      return [[], buildProjectHealthLegend(source.data)];
    default:
      return [];
  }
}

function configsForSource(source: ScheduleChartSource): ChartConfig[] {
  switch (source.kind) {
    case "velocity":
      return [velocityConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "planned-vs-actual-tasks":
      return [pvaTasksConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "planned-vs-actual-milestones":
      return [pvaMilestonesConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "project-health":
      // UI shows bar + donut; scheduled PDF/Excel should include both.
      return [
        projectHealthBarConfig(source.data),
        projectHealthDonutConfig(source.data),
      ].filter(Boolean) as ChartConfig[];
    case "utilization":
      return [utilizationConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "time-report":
      return [timeReportConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "budget-tracking":
      return [budgetTrackingConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "cumulative-flow":
      return [cfdConfig(source.data)].filter(Boolean) as ChartConfig[];
    case "time-in-status":
      return [timeInStatusConfig(source.data)].filter(Boolean) as ChartConfig[];
    default:
      return [];
  }
}

async function renderChartConfigPng(
  config: ChartConfig,
  size?: { width?: number; height?: number }
): Promise<Buffer | null> {
  try {
    const chart = new ChartJsImage();
    chart.setConfig(config);
    chart.setChartJsVersion("4");
    chart.setWidth(size?.width ?? CHART_WIDTH);
    chart.setHeight(size?.height ?? CHART_HEIGHT);
    chart.setBackgroundColor("white");
    const binary = await chart.toBinary();
    return Buffer.isBuffer(binary) ? binary : Buffer.from(binary);
  } catch {
    return null;
  }
}

/**
 * Renders Chart.js configs to PNG buffers via QuickChart (chartjs-to-image).
 * Empty when there is no data or rendering fails — callers still send the table.
 */
export async function renderScheduleChartPngs(
  source: ScheduleChartSource
): Promise<Buffer[]> {
  const configs = configsForSource(source);
  if (!configs.length) return [];

  const isProjectHealthPair =
    source.kind === "project-health" && configs.length === 2;

  const buffers = await Promise.all(
    configs.map((config, index) => {
      const isDonut = config.type === "doughnut";
      // Project Health PDF: bar ~3/4 + donut ~1/4.
      // Bar aspect ~2.9:1 matches the PDF slot (avoids stretch/blurry axis labels).
      if (isProjectHealthPair) {
        // Taller bar (~2:1) fills the PDF chart slot.
        // Donut is square (legend is drawn in PDF under the image).
        return renderChartConfigPng(
          config,
          isDonut || index === 1
            ? { width: 420, height: 420 }
            : { width: 1100, height: 560 }
        );
      }
      return renderChartConfigPng(
        config,
        isDonut
          ? { width: 640, height: 420 }
          : { width: CHART_WIDTH, height: CHART_HEIGHT }
      );
    })
  );

  return buffers.filter((buf): buf is Buffer => !!buf?.length);
}

/** @deprecated Prefer renderScheduleChartPngs for multi-chart reports. */
export async function renderScheduleChartPng(
  source: ScheduleChartSource
): Promise<Buffer | null> {
  const buffers = await renderScheduleChartPngs(source);
  return buffers[0] ?? null;
}
