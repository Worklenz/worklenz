import createHttpError from "http-errors";
import { ImportProvider, ProviderResult } from "./provider-types";
import { ImportJob, StageTaskRow } from "../imports-service";
import {
  tokenizeCsv,
  isBinaryContent,
  MAX_CSV_ROWS,
  MAX_CSV_SIZE_BYTES,
  autoMapHeaders,
  parseDate,
} from "./csv-parser-strategies";


export default class CsvProvider implements ImportProvider {
  name = "csv";

  async ingest(
    _job: ImportJob,
    payload?: Record<string, unknown>
  ): Promise<ProviderResult> {
    const csvText = (payload?.csvText as string) || "";
    if (!csvText.trim()) return { tasks: [], fields: [] };


    const byteLength = Buffer.byteLength(csvText, "utf-8");
    if (byteLength > MAX_CSV_SIZE_BYTES) {
      throw createHttpError(
        400,
        `The CSV file exceeds the maximum allowed size of ${MAX_CSV_SIZE_BYTES / (1024 * 1024)} MB. Please reduce the file size and try again.`
      );
    }

    if (isBinaryContent(csvText)) {
      throw createHttpError(
        400,
        "The uploaded file does not appear to be a CSV. Please upload a valid CSV file."
      );
    }

    
    const parsed = tokenizeCsv(csvText);

    if (!parsed.length) {
      throw createHttpError(
        400,
        "The CSV file is empty. Please upload a file with at least a header row and one data row."
      );
    }

    const [headerRow, ...dataRows] = parsed;
    const headers = headerRow.map((h) => h.trim()).filter(Boolean);

    if (!headers.length) {
      throw createHttpError(
        400,
        "The CSV file has no column headers. Please ensure the first row contains column names."
      );
    }

    if (!dataRows.length) {
      throw createHttpError(
        400,
        "The CSV file has no data rows. Please ensure there is at least one row of data below the header."
      );
    }


    if (dataRows.length > MAX_CSV_ROWS) {
      throw createHttpError(
        400,
        `The CSV file contains ${dataRows.length} rows, which exceeds the maximum of ${MAX_CSV_ROWS} tasks per import. Please split the file into smaller batches.`
      );
    }

    const autoMappings = autoMapHeaders(headers);

    
    const titleHeader = headers.find((h) => autoMappings[h] === "key") || headers[0];


    const tasks: StageTaskRow[] = dataRows.map((row, idx) => {
      const record: Record<string, string> = {};
      headers.forEach((h, colIdx) => {
        record[h] = row[colIdx] || "";
      });

 
      const title = record[titleHeader]?.trim() || `Row ${idx + 1}`;

   
      const descHeader = headers.find((h) => autoMappings[h] === "description");
      const description = descHeader ? record[descHeader] || null : null;

   
      const statusHeader = headers.find((h) => autoMappings[h] === "status");
      const status = statusHeader ? record[statusHeader] || null : null;

   
      const assigneeHeader = headers.find((h) => autoMappings[h] === "assignees");
      const assignee = assigneeHeader ? record[assigneeHeader] || null : null;

    
      const dueHeader = headers.find((h) => autoMappings[h] === "dueDate");
      const dueRaw = dueHeader ? record[dueHeader] || null : null;
      const dueParsed = dueRaw ? parseDate(dueRaw) : null;
      const dueAt = dueParsed ? dueParsed.toISOString() : dueRaw;

  
      const startHeader = headers.find((h) => autoMappings[h] === "startDate");
      const startRaw = startHeader ? record[startHeader] || null : null;
      const startParsed = startRaw ? parseDate(startRaw) : null;
      const startAt = startParsed ? startParsed.toISOString() : startRaw;

      return {
        source_task_id: `csv-${idx + 1}`,
        title,
        description,
        status,
        due_at: dueAt,
        start_at: startAt,
        assignee_source_id: assignee,
        raw: record,
      };
    });


    const fields = headers.map((h) => ({
      source_field: h,
      target_field: autoMappings[h] || h,
      required: autoMappings[h] === "key",
      include: true,
    }));

    return { fields, tasks };
  }
}
