import type { ScheduleChartSource } from "./analytics-schedule-charts";
import type { BudgetAlert } from "./budget-tracking.service";
import type { UtilizationStatus } from "./utilization.service";

const COLORS = {
  danger: "#ff4d4f",
  success: "#52c41a",
  warning: "#faad14",
  secondary: "#8c8c8c",
} as const;

/** Hex color per cell; null = default text. First row is the header (all null). */
export type TableCellColorGrid = Array<Array<string | null>>;

function varianceColor(days: number): string {
  if (days > 0) return COLORS.danger;
  if (days < 0) return COLORS.success;
  return COLORS.secondary;
}

/** Page-style variance label, e.g. "+3 days", "-1.5 days", "0 days". */
export function formatVarianceDaysLabel(days: number): string {
  const signed = days > 0 ? `+${days}` : String(days);
  return `${signed} days`;
}

function overdueCountColor(count: number): string {
  return count > 0 ? COLORS.danger : COLORS.secondary;
}

function utilizationPctColor(pct: number): string {
  if (pct > 100) return COLORS.danger;
  if (pct > 80) return COLORS.success;
  return COLORS.warning;
}

function utilizationStatusColor(status: UtilizationStatus | string): string | null {
  if (status === "over") return COLORS.danger;
  if (status === "optimal") return COLORS.success;
  if (status === "under") return COLORS.warning;
  return null;
}

function burnPctColor(pct: number): string {
  if (pct > 85) return COLORS.danger;
  if (pct > 65) return COLORS.warning;
  return COLORS.success;
}

function budgetAlertColor(alert: BudgetAlert | string): string | null {
  if (alert === "high") return COLORS.danger;
  if (alert === "watch") return COLORS.warning;
  if (alert === "ok") return COLORS.success;
  return null;
}

function emptyRow(cols: number): Array<string | null> {
  return Array.from({ length: cols }, () => null);
}

/**
 * Cell text colors matching on-page tables for reports that tint numeric/status values.
 * Grid aligns with CSV / PDF table rows (header + body).
 */
export function buildScheduleTableCellColors(
  source: ScheduleChartSource | null | undefined
): TableCellColorGrid | null {
  if (!source) return null;

  switch (source.kind) {
    case "planned-vs-actual-tasks": {
      // Project, Planned tasks, Completed, Overdue, Variance (days)
      const cols = 5;
      const grid: TableCellColorGrid = [emptyRow(cols)];
      for (const row of source.data.projects) {
        const colors = emptyRow(cols);
        colors[3] = overdueCountColor(row.overdue);
        colors[4] = varianceColor(row.variance_days);
        grid.push(colors);
      }
      return grid;
    }
    case "planned-vs-actual-milestones": {
      const cols = 5; // Milestone, Project, Planned, Actual, Variance
      const grid: TableCellColorGrid = [emptyRow(cols)];
      for (const row of source.data.milestones) {
        const colors = emptyRow(cols);
        colors[4] = varianceColor(row.variance_days);
        grid.push(colors);
      }
      return grid;
    }
    case "utilization": {
      // Member, Role, Capacity, Logged, Billable, Utilization %, Status
      const cols = 7;
      const grid: TableCellColorGrid = [emptyRow(cols)];
      for (const row of source.data.members) {
        const colors = emptyRow(cols);
        colors[5] = utilizationPctColor(row.utilization_pct);
        colors[6] = utilizationStatusColor(row.status);
        grid.push(colors);
      }
      return grid;
    }
    case "budget-tracking": {
      // Project, Client, Currency, Budget, Spent, Remaining, Burn %, Alert
      const cols = 8;
      const grid: TableCellColorGrid = [emptyRow(cols)];
      for (const row of source.data.projects) {
        const colors = emptyRow(cols);
        if (row.has_budget) {
          if (row.burn_pct > 85) colors[4] = COLORS.danger;
          colors[5] = row.remaining < 0 ? COLORS.danger : COLORS.success;
          colors[6] = burnPctColor(row.burn_pct);
        }
        colors[7] = budgetAlertColor(row.alert);
        grid.push(colors);
      }
      return grid;
    }
    default:
      return null;
  }
}

export function hexToExcelArgb(hex: string): string {
  const cleaned = hex.replace("#", "").trim();
  if (cleaned.length === 6) return `FF${cleaned.toUpperCase()}`;
  if (cleaned.length === 8) return cleaned.toUpperCase();
  return "FF262626";
}
