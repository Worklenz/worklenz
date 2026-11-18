import Excel from "exceljs";
import { CSV_UTF8_BOM, formatCsvCell } from "../../shared/csv-utils";
import { decodeHtmlEntities } from "../../shared/html-entity-utils";
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

export async function csvToExcelBuffer(
  csv: string,
  sheetName = "Report",
  chartPngs?: Buffer[] | Buffer | null
): Promise<Buffer> {
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Report");
  const rows = parseCsvRows(csv);
  const charts = normalizeChartPngs(chartPngs);

  let spacerRows = 0;
  if (charts.length) {
    try {
      let rowCursor = 0;
      for (const chartPng of charts) {
        const imageId = workbook.addImage({
          buffer: chartPng,
          extension: "png",
        });
        const height = charts.length > 1 && chartPng === charts[charts.length - 1] ? 260 : 320;
        const width = charts.length > 1 && chartPng === charts[charts.length - 1] ? 420 : 720;
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
      // Still export the table if the image cannot be embedded.
      spacerRows = 0;
    }
  }

  for (const r of rows) {
    sheet.addRow(r);
  }
  const headerRowIndex = spacerRows > 0 ? spacerRows + 1 : 1;
  const headerRow = sheet.getRow(headerRowIndex);
  if (headerRow && rows[0]) {
    headerRow.font = { bold: true };
  }
  sheet.columns.forEach(col => {
    col.width = 18;
  });
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
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
