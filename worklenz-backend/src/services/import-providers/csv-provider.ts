import createHttpError from "http-errors";
import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i++; // skip escaped quote
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (char === "," && !inQuotes) {
      current.push(field.trim());
      field = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (field.length || current.length) {
        current.push(field.trim());
        rows.push(current);
        current = [];
        field = "";
      }
      continue;
    }
    field += char;
  }
  if (field.length || current.length) {
    current.push(field.trim());
    rows.push(current);
  }
  return rows.filter((r) => r.length > 0);
}

export default class CsvProvider implements ImportProvider {
  name = "csv";

  async ingest(
    _job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const csvText = (payload?.csvText as string) || "";
    if (!csvText.trim()) return { tasks: [], fields: [] };

    // Reject binary content (PDF, images, etc.) — check for non-text byte sequences
    const sample = csvText.slice(0, 512);
    const binarySignatures = ["%PDF-", "\x89PNG", "\xFF\xD8\xFF", "PK\x03\x04"];
    if (binarySignatures.some(sig => sample.includes(sig))) {
      throw createHttpError(400, "The uploaded file does not appear to be a CSV. Please upload a valid CSV file.");
    }

    const parsed = parseCsv(csvText);
    if (!parsed.length) throw createHttpError(400, "The CSV file is empty. Please upload a file with at least a header row and one data row.");
    const [headerRow, ...dataRows] = parsed;
    const headers = headerRow.map((h) => h.trim()).filter(Boolean);
    if (!headers.length) throw createHttpError(400, "The CSV file has no column headers. Please ensure the first row contains column names.");
    if (!dataRows.length) throw createHttpError(400, "The CSV file has no data rows. Please ensure there is at least one row of data below the header.");
    const tasks: StageTaskRow[] = dataRows.map((row, idx) => {
      const record: Record<string, string> = {};
      headers.forEach((h, colIdx) => {
        record[h] = row[colIdx] || "";
      });
      return {
        source_task_id: `csv-${idx + 1}`,
        title: record[headers[0]] || `Row ${idx + 1}`,
        description: record.description || record["Description"] || null,
        status: record.status || record["Status"] || null,
        due_at: record.due_at || record["Due date"] || null,
        start_at: record.start_at || record["Start date"] || null,
        worktype: record.type || record["Type"] || null,
        assignee_source_id: record.assignee || record["Assignee"] || null,
        raw: record,
      };
    });
    const fields = headers.map((h) => ({
      source_field: h,
      target_field: h,
      include: true,
    }));
    return { fields, tasks };
  }
}
