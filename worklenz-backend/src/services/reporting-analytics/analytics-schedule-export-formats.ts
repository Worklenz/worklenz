import Excel from "exceljs";
import { addCharts } from "chartsheet";
import { CSV_UTF8_BOM, formatCsvCell } from "../../shared/csv-utils";
import { decodeHtmlEntities } from "../../shared/html-entity-utils";
import type { ScheduleChartSource } from "./analytics-schedule-charts";
import { buildExcelNativeChartPlan } from "./analytics-schedule-excel-charts";
import { renderSchedulePdf } from "./analytics-schedule-pdf";

export interface ScheduleExportFile {
  filename: string;
  contentType: string;
  content: Buffer;
}

function decodeExportCell(value: string): string {
  let text = value ?? "";
  for (let i = 0; i < 3; i++) {
    const next = decodeHtmlEntities(text);
    if (next === text) break;
    text = next;
  }
  return text;
}

export function parseCsvRows(csv: string): string[][] {
  const text = csv.startsWith(CSV_UTF8_BOM) ? csv.slice(CSV_UTF8_BOM.length) : csv;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];
    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch === "\r") {
      // ignore CR (handle CRLF)
    } else {
      cell += ch;
    }
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows
    .filter(r => r.some(c => c.trim().length > 0))
    .map(r => r.map(decodeExportCell));
}

/** Decode HTML entities in CSV cells for scheduled CSV/Excel/PDF exports. */
export function normalizeScheduleExportCsv(csv: string): string {
  const rows = parseCsvRows(csv);
  if (!rows.length) return csv.startsWith(CSV_UTF8_BOM) ? csv : `${CSV_UTF8_BOM}${csv}`;
  const lines = rows.map(row => row.map(formatCsvCell).join(","));
  return `${CSV_UTF8_BOM}${lines.join("\n")}`;
}

function normalizeChartPngs(chartPngs?: Buffer[] | Buffer | null): Buffer[] {
  if (!chartPngs) return [];
  if (Array.isArray(chartPngs)) return chartPngs.filter(buf => !!buf?.length);
  return chartPngs.length ? [chartPngs] : [];
}

function coerceExcelCell(value: string): string | number {
  const trimmed = value.trim();
  if (!trimmed) return "";
  // Keep IDs / codes with leading zeros as text.
  if (/^0\d+$/.test(trimmed)) return trimmed;
  const asNum = Number(trimmed);
  if (Number.isFinite(asNum) && /^-?\d+(\.\d+)?$/.test(trimmed)) return asNum;
  return value;
}

/**
 * Build an .xlsx with the report table and native Excel charts (not images).
 * Charts bind to a hidden ChartData sheet derived from the live series.
 */
export async function csvToExcelBuffer(
  csv: string,
  sheetName = "Report",
  chartPngsOrSource?: Buffer[] | Buffer | ScheduleChartSource | null
): Promise<Buffer> {
  const workbook = new Excel.Workbook();
  const reportName = sheetName.slice(0, 31) || "Report";
  const sheet = workbook.addWorksheet(reportName);
  const rows = parseCsvRows(csv);

  const chartSource =
    chartPngsOrSource &&
    !Buffer.isBuffer(chartPngsOrSource) &&
    !Array.isArray(chartPngsOrSource) &&
    typeof chartPngsOrSource === "object" &&
    "kind" in chartPngsOrSource
      ? (chartPngsOrSource as ScheduleChartSource)
      : null;

  const plan = buildExcelNativeChartPlan(chartSource, reportName);

  // Legacy path: embedded PNG images (kept for callers that still pass buffers).
  const chartPngs = chartSource
    ? []
    : normalizeChartPngs(chartPngsOrSource as Buffer[] | Buffer | null | undefined);

  let spacerRows = 0;

  if (plan) {
    const dataSheet = workbook.addWorksheet(plan.dataSheetName);
    dataSheet.state = "hidden";
    for (const r of plan.dataRows) {
      dataSheet.addRow(r);
    }
    dataSheet.getRow(1).font = { bold: true };
    dataSheet.columns.forEach(col => {
      col.width = 16;
    });

    spacerRows = Math.max(0, plan.tableStartRow - 1);
    for (let i = 0; i < spacerRows; i++) {
      sheet.addRow([]);
    }
  } else if (chartPngs.length) {
    try {
      let rowCursor = 0;
      for (const chartPng of chartPngs) {
        const imageId = workbook.addImage({
          buffer: chartPng,
          extension: "png",
        });
        const height = chartPngs.length > 1 && chartPng === chartPngs[chartPngs.length - 1] ? 260 : 320;
        const width = chartPngs.length > 1 && chartPng === chartPngs[chartPngs.length - 1] ? 420 : 720;
        sheet.addImage(imageId, {
          tl: { col: 0, row: rowCursor },
          ext: { width, height },
        });
        const rowsUsed = Math.ceil(height / 18) + 1;
        rowCursor += rowsUsed;
        spacerRows += rowsUsed;
      }
      for (let i = 0; i < spacerRows; i++) {
        sheet.addRow([]);
      }
    } catch {
      spacerRows = 0;
    }
  }

  for (const r of rows) {
    sheet.addRow(r.map(coerceExcelCell));
  }
  const headerRowIndex = spacerRows > 0 ? spacerRows + 1 : 1;
  const headerRow = sheet.getRow(headerRowIndex);
  if (headerRow && rows[0]) {
    headerRow.font = { bold: true };
  }
  sheet.columns.forEach(col => {
    col.width = 18;
  });

  let arrayBuffer = await workbook.xlsx.writeBuffer();
  let buffer = Buffer.from(arrayBuffer);

  if (plan?.charts.length) {
    try {
      buffer = Buffer.from(await addCharts(buffer, plan.charts));
    } catch {
      // Keep the workbook/table even if native chart injection fails.
    }
  }

  return buffer;
}

export async function csvToPdfBuffer(
  title: string,
  csv: string,
  chartPngs?: Buffer[] | Buffer | null
): Promise<Buffer> {
  return renderSchedulePdf(title, parseCsvRows(csv), chartPngs);
}

export function slugFilename(name: string): string {
  return (
    name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "report"
  );
}
