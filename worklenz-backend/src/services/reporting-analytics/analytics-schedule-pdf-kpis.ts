import type { ScheduleChartSource } from "./analytics-schedule-charts";
import type { SchedulePdfKpiTile } from "./analytics-schedule-pdf";

const TONES = {
  primary: "#1890ff",
  success: "#52c41a",
  warn: "#faad14",
  purple: "#722ed1",
  danger: "#ff4d4f",
  muted: "#8c8c8c",
} as const;

function fmtNum(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const rounded = Math.round(value * 10 ** digits) / 10 ** digits;
  return String(rounded);
}

function fmtPct(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${fmtNum(value, 1)}%`;
}

function fmtHours(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return fmtNum(value, 1);
}

/** Map live chart/series payloads into PDF KPI cards that match the in-app tiles. */
export function buildSchedulePdfKpis(
  source: ScheduleChartSource | null | undefined
): SchedulePdfKpiTile[] {
  if (!source) return [];

  switch (source.kind) {
    case "velocity": {
      const { kpis } = source.data;
      return [
        {
          label: "Avg velocity",
          value: kpis.completed_sprint_count > 0 ? fmtNum(kpis.avg_velocity) : "—",
          sub: "completed work / sprint",
          tone: TONES.primary,
        },
        {
          label: "Last sprint",
          value:
            kpis.last_sprint_velocity === null ? "—" : fmtNum(kpis.last_sprint_velocity),
          sub: "most recent completed",
          tone: TONES.success,
        },
        {
          label: "Commitment",
          value: fmtPct(kpis.commitment_accuracy_pct),
          sub: "accuracy",
          tone: TONES.warn,
        },
        {
          label: "Sprints",
          value: String(kpis.completed_sprint_count),
          sub: "completed buckets",
          tone: TONES.purple,
        },
      ];
    }
    case "project-health": {
      const { kpis } = source.data;
      return [
        {
          label: "On track",
          value: String(kpis.on_track),
          sub: "projects",
          tone: TONES.success,
        },
        {
          label: "At risk",
          value: String(kpis.at_risk),
          sub: "projects",
          tone: TONES.warn,
        },
        {
          label: "Off track",
          value: String(kpis.off_track),
          sub: "projects",
          tone: TONES.danger,
        },
        {
          label: "Overdue tasks",
          value: String(kpis.overdue_tasks),
          sub: "across selection",
          tone: TONES.primary,
        },
      ];
    }
    case "planned-vs-actual-tasks": {
      const { kpis } = source.data;
      return [
        {
          label: "Planned",
          value: String(kpis.planned),
          sub: "tasks",
          tone: TONES.primary,
        },
        {
          label: "Completed",
          value: String(kpis.completed),
          sub: fmtPct(kpis.completed_pct_of_plan) + " of plan",
          tone: TONES.success,
        },
        {
          label: "Overdue",
          value: String(kpis.overdue),
          sub: "tasks",
          tone: TONES.danger,
        },
        {
          label: "Avg variance",
          value: fmtNum(kpis.avg_variance_days),
          sub: "days",
          tone: TONES.warn,
        },
      ];
    }
    case "planned-vs-actual-milestones": {
      const { kpis } = source.data;
      return [
        {
          label: "Milestones",
          value: String(kpis.milestones),
          sub: "in scope",
          tone: TONES.primary,
        },
        {
          label: "On time",
          value: String(kpis.on_time),
          sub: "delivered",
          tone: TONES.success,
        },
        {
          label: "Late",
          value: String(kpis.late),
          sub: "milestones",
          tone: TONES.danger,
        },
        {
          label: "Avg slip",
          value: fmtNum(kpis.avg_slip_days),
          sub: "days",
          tone: TONES.warn,
        },
      ];
    }
    case "utilization": {
      const { kpis } = source.data;
      return [
        {
          label: "Avg utilization",
          value: fmtPct(kpis.avg_utilization_pct),
          sub: "team average",
          tone: TONES.primary,
        },
        {
          label: "Team size",
          value: String(kpis.team_size),
          sub: "members",
          tone: TONES.purple,
        },
        {
          label: "Overutilized",
          value: String(kpis.overutilized_count),
          sub: "members",
          tone: TONES.danger,
        },
        {
          label: "Logged hours",
          value: fmtHours(kpis.total_logged_hours),
          sub: `of ${fmtHours(kpis.total_capacity_hours)} capacity`,
          tone: TONES.success,
        },
      ];
    }
    case "time-report": {
      const { kpis } = source.data;
      return [
        {
          label: "Logged",
          value: fmtHours(kpis.logged_hours),
          sub: "hours",
          tone: TONES.primary,
        },
        {
          label: "Estimated",
          value: fmtHours(kpis.estimated_hours),
          sub: "hours",
          tone: TONES.muted,
        },
        {
          label: "Billable",
          value: fmtHours(kpis.billable_hours),
          sub: fmtPct(kpis.billable_pct),
          tone: TONES.success,
        },
        {
          label: "Over estimate",
          value: fmtHours(kpis.over_estimate_hours),
          sub: "hours",
          tone: TONES.warn,
        },
      ];
    }
    case "budget-tracking": {
      const { kpis } = source.data;
      return [
        {
          label: "Total budget",
          value: fmtNum(kpis.total_budget, 0),
          sub: "allocated",
          tone: TONES.primary,
        },
        {
          label: "Spent",
          value: fmtNum(kpis.spent, 0),
          sub: fmtPct(kpis.utilization_pct) + " used",
          tone: TONES.warn,
        },
        {
          label: "Remaining",
          value: fmtNum(kpis.remaining, 0),
          sub: "budget left",
          tone: kpis.remaining < 0 ? TONES.danger : TONES.success,
        },
        {
          label: "Over budget",
          value: String(kpis.over_budget_count),
          sub: "projects",
          tone: kpis.over_budget_count > 0 ? TONES.danger : TONES.success,
        },
      ];
    }
    case "cumulative-flow": {
      const { indicators } = source.data;
      return [
        {
          label: "Current WIP",
          value: String(indicators.current_wip),
          sub: "in progress",
          tone: TONES.primary,
        },
        {
          label: "Throughput",
          value: fmtNum(indicators.avg_throughput_per_day, 2),
          sub: "issues / day",
          tone: TONES.success,
        },
        {
          label: "Avg cycle time",
          value: fmtNum(indicators.avg_cycle_days),
          sub: "days",
          tone: TONES.warn,
        },
        {
          label: "Avg lead time",
          value: fmtNum(indicators.avg_lead_days),
          sub: "days",
          tone: TONES.purple,
        },
      ];
    }
    case "time-in-status": {
      const { summary } = source.data;
      return [
        {
          label: "Issues",
          value: String(summary.issue_count),
          sub: "in selection",
          tone: TONES.primary,
        },
        {
          label: "Avg cycle",
          value: fmtNum(summary.avg_cycle_days),
          sub: "days",
          tone: TONES.warn,
        },
        {
          label: "Status visits",
          value: String(summary.status_visit_count),
          sub: "transitions",
          tone: TONES.purple,
        },
        {
          label: "Outliers",
          value: String(summary.outlier_count),
          sub: "issues",
          tone: summary.outlier_count > 0 ? TONES.danger : TONES.success,
        },
      ];
    }
    default:
      return [];
  }
}
