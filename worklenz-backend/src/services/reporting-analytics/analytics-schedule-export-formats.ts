import Excel from "exceljs";
import { CSV_UTF8_BOM } from "../../shared/csv-utils";
import { renderSchedulePdf } from "./analytics-schedule-pdf";

export interface ScheduleExportFile {
  filename: string;
  contentType: string;
  content: Buffer;
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
  return rows.filter(r => r.some(c => c.trim().length > 0));
}

export async function csvToExcelBuffer(
  csv: string,
  sheetName = "Report",
  chartPng?: Buffer | null
): Promise<Buffer> {
  const workbook = new Excel.Workbook();
  const sheet = workbook.addWorksheet(sheetName.slice(0, 31) || "Report");
  const rows = parseCsvRows(csv);

  if (chartPng?.length) {
    try {
      const imageId = workbook.addImage({
        buffer: chartPng,
        extension: "png",
      });
      sheet.addImage(imageId, {
        tl: { col: 0, row: 0 },
        ext: { width: 720, height: 320 },
      });
      // Leave room under the chart before the table header.
      for (let i = 0; i < 18; i++) {
        sheet.addRow([]);
      }
    } catch {
      // Still export the table if the image cannot be embedded.
    }
  }

  for (const r of rows) {
    sheet.addRow(r);
  }
  const headerRowIndex = chartPng?.length ? 19 : 1;
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
  chartPng?: Buffer | null
): Promise<Buffer> {
  return renderSchedulePdf(title, parseCsvRows(csv), chartPng);
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
