import type { ScheduleChartSource } from "./analytics-schedule-charts";
import { getScheduleChartConfigs } from "./analytics-schedule-charts";

export type ExcelNativeChartType =
  | "bar"
  | "column"
  | "line"
  | "pie"
  | "doughnut"
  | "area";

export interface ExcelNativeChartSpec {
  type: ExcelNativeChartType;
  title?: string;
  sheet: string;
  categories: string;
  series: Array<{ nameRef?: string; name?: string; ref: string; colour?: string }>;
  anchor: { col: number; row: number };
  width?: number;
  height?: number;
  horizontal?: boolean;
  stacked?: boolean;
  legend?: "r" | "l" | "t" | "b" | false;
}

export interface ExcelNativeChartPlan {
  /** Hidden sheet holding category/series values the charts bind to. */
  dataSheetName: string;
  dataRows: (string | number)[][];
  charts: ExcelNativeChartSpec[];
  /** 1-based row where the report table starts on the Report sheet. */
  tableStartRow: number;
}

const CHART_DATA_SHEET = "ChartData";
const REPORT_SHEET = "Report";
const CHART_BLOCK_GAP = 2;

function colLetter(index0: number): string {
  let n = index0 + 1;
  let letters = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    letters = String.fromCharCode(65 + rem) + letters;
    n = Math.floor((n - 1) / 26);
  }
  return letters;
}

function absRange(
  sheet: string,
  c1: number,
  r1: number,
  c2: number,
  r2: number
): string {
  const safe = sheet.includes(" ") || /[^A-Za-z0-9_]/.test(sheet) ? `'${sheet.replace(/'/g, "''")}'` : sheet;
  return `${safe}!$${colLetter(c1)}$${r1}:$${colLetter(c2)}$${r2}`;
}

function absCell(sheet: string, c: number, r: number): string {
  const safe = sheet.includes(" ") || /[^A-Za-z0-9_]/.test(sheet) ? `'${sheet.replace(/'/g, "''")}'` : sheet;
  return `${safe}!$${colLetter(c)}$${r}`;
}

function asNumber(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asColour(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const hex = value.trim();
  if (/^#[0-9a-fA-F]{6}$/.test(hex)) return hex.slice(1).toUpperCase();
  return undefined;
}

interface ChartJsLikeConfig {
  type?: string;
  data?: {
    labels?: unknown[];
    datasets?: Array<{
      label?: string;
      data?: unknown[];
      backgroundColor?: unknown;
      borderColor?: unknown;
    }>;
  };
  options?: {
    indexAxis?: "x" | "y";
    scales?: { y?: { stacked?: boolean } };
  };
}

/**
 * Build a ChartData sheet + native Excel chart specs from schedule chart source.
 * Returns null when there is nothing chartable.
 */
export function buildExcelNativeChartPlan(
  source: ScheduleChartSource | null | undefined,
  reportSheetName = REPORT_SHEET
): ExcelNativeChartPlan | null {
  if (!source) return null;
  const configs = getScheduleChartConfigs(source) as ChartJsLikeConfig[];
  if (!configs.length) return null;

  const dataRows: (string | number)[][] = [];
  const charts: ExcelNativeChartSpec[] = [];
  let cursorRow = 1; // 1-based within ChartData
  let anchorRow = 0; // 0-based on Report sheet

  configs.forEach((config, chartIndex) => {
    const labels = Array.isArray(config.data?.labels)
      ? config.data!.labels!.map(l => String(l ?? ""))
      : [];
    const datasets = Array.isArray(config.data?.datasets) ? config.data!.datasets! : [];
    if (!labels.length || !datasets.length) return;

    const header = ["Category", ...datasets.map((d, i) => d.label || `Series ${i + 1}`)];
    const blockStart = cursorRow;
    dataRows.push(header);
    for (let i = 0; i < labels.length; i++) {
      dataRows.push([
        labels[i],
        ...datasets.map(d => asNumber(Array.isArray(d.data) ? d.data[i] : 0)),
      ]);
    }
    const blockEnd = cursorRow + labels.length; // last data row (1-based)
    const catRange = absRange(CHART_DATA_SHEET, 0, blockStart + 1, 0, blockEnd);
    const series = datasets.map((d, di) => {
      const colours = d.backgroundColor;
      let colour: string | undefined;
      if (Array.isArray(colours)) {
        colour = asColour(colours[0]);
      } else {
        colour = asColour(colours) || asColour(d.borderColor);
      }
      return {
        nameRef: absCell(CHART_DATA_SHEET, di + 1, blockStart),
        ref: absRange(CHART_DATA_SHEET, di + 1, blockStart + 1, di + 1, blockEnd),
        colour,
      };
    });

    const chartJsType = String(config.type || "bar");
    const horizontal = config.options?.indexAxis === "y";
    const stacked = !!config.options?.scales?.y?.stacked;
    let type: ExcelNativeChartType = "column";
    if (chartJsType === "line") type = "line";
    else if (chartJsType === "pie") type = "pie";
    else if (chartJsType === "doughnut") type = "doughnut";
    else if (chartJsType === "area") type = "area";
    else if (horizontal) type = "bar";
    else type = "column";

    const isCompact = type === "doughnut" || type === "pie";
    const height = isCompact ? 280 : 340;
    const width = isCompact ? 420 : 720;

    charts.push({
      type,
      title: chartIndex === 0 ? undefined : undefined,
      sheet: reportSheetName.slice(0, 31) || REPORT_SHEET,
      categories: catRange,
      series,
      anchor: { col: 0, row: anchorRow },
      width,
      height,
      horizontal: type === "bar" ? true : undefined,
      stacked: stacked || undefined,
      legend: type === "doughnut" || type === "pie" ? "r" : "b",
    });

    cursorRow = blockEnd + 1 + CHART_BLOCK_GAP;
    // Leave vertical space on Report for the floating chart (~18px/row).
    anchorRow += Math.ceil(height / 18) + 1;
  });

  if (!charts.length) return null;

  return {
    dataSheetName: CHART_DATA_SHEET,
    dataRows,
    charts,
    tableStartRow: anchorRow + 1,
  };
}
