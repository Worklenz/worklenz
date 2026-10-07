import Excel from "exceljs";
import { CSV_UTF8_BOM, formatCsvCell } from "../../shared/csv-utils";
import { TIME_LOGS_EXPORT_ROW_CAP, TimeLogsGroupBy, TimeLogsView } from "./time-logs-query-builder";

/** The row shape produced by `buildTimeLogsRowsQuery`, reduced to what exports use. */
export interface ITimeLogExportRow {
  log_day: string | null;
  task_key: string | null;
  user_name: string | null;
  client_name: string | null;
  project_name: string | null;
  task_name: string | null;
  description: string | null;
  /** Seconds. */
  time_spent: number | null;
}

export interface ITimeLogsExportOptions {
  /** More rows matched than the export cap allows; the rest were left out. */
  truncated?: boolean;
  /**
   * "task" when each row is a task with its time summed (the By task view): the date is then the
   * task's latest entry, so its column says so. Defaults to "flat".
   */
  view?: TimeLogsView;
}

export const TIME_LOGS_EXPORT_HEADERS = [
  "Date",
  "Task ID",
  "Task Name",
  "Member",
  "Project",
  "Client",
  "Description",
  "Duration (Minutes)",
  "Duration (Hours)",
] as const;

/** The header row: identical for both views except that a By task row's date is its latest entry. */
export const getTimeLogsExportHeaders = (view: TimeLogsView = "flat"): string[] =>
  view === "task" ? ["Last Logged", ...TIME_LOGS_EXPORT_HEADERS.slice(1)] : [...TIME_LOGS_EXPORT_HEADERS];

const SHEET_NAME = "Time Logs";
const DATE_NUM_FMT = "mmm dd, yyyy";
const HOURS_NUM_FMT = "0.00";
const FIRST_DATA_ROW = 2;
// Column letters follow TIME_LOGS_EXPORT_HEADERS — the same order as the table on screen: Date, Task ID,
// Task Name, Member, Project, Client, Description, Duration (Minutes), Duration (Hours).
const MINUTES_COLUMN = "H";
const HOURS_COLUMN = "I";
const LAST_COLUMN = HOURS_COLUMN;

const toSeconds = (row: ITimeLogExportRow): number => Math.max(0, Number(row.time_spent) || 0);

/**
 * Whole minutes, floored — the column's long-standing meaning. The total row
 * sums these cells (exactly what the sheet's own SUBTOTAL does); the hours
 * column is unrounded so its total is exact even with sub-minute entries.
 */
export const toMinutes = (seconds: number): number => Math.floor(seconds / 60);

export const toHours = (seconds: number): number => seconds / 3600;

/** Hours trimmed for CSV: "0.5", "4.5", "1.0167". */
export const formatCsvHours = (hours: number): string => String(Number(hours.toFixed(4)));

/** What a capped export says it left out; `noun` is what the rows are ("entries", "groups"). */
export const truncationNote = (noun = "entries"): string =>
  `Export limited to the first ${TIME_LOGS_EXPORT_ROW_CAP.toLocaleString("en-US")} ${noun} — narrow the date range to export the rest.`;

export interface ITimeLogsTotals {
  minutes: number;
  hours: number;
  seconds: number;
}

export const summarizeExportRows = (rows: ITimeLogExportRow[]): ITimeLogsTotals => {
  let seconds = 0;
  let minutes = 0;
  for (const row of rows) {
    const rowSeconds = toSeconds(row);
    seconds += rowSeconds;
    minutes += toMinutes(rowSeconds);
  }
  return { seconds, minutes, hours: toHours(seconds) };
};

export const buildTimeLogsCsv = (rows: ITimeLogExportRow[], options: ITimeLogsExportOptions = {}): string => {
  const lines: string[] = [getTimeLogsExportHeaders(options.view).map(h => formatCsvCell(h)).join(",")];

  for (const row of rows) {
    const seconds = toSeconds(row);
    lines.push(
      [
        row.log_day ?? "",
        row.task_key,
        row.task_name,
        row.user_name,
        row.project_name,
        row.client_name,
        row.description,
        toMinutes(seconds),
        formatCsvHours(toHours(seconds)),
      ]
        .map(formatCsvCell)
        .join(",")
    );
  }

  const totals = summarizeExportRows(rows);
  lines.push(["Total", "", "", "", "", "", "", totals.minutes, formatCsvHours(totals.hours)].map(formatCsvCell).join(","));

  if (options.truncated) {
    lines.push("", formatCsvCell(truncationNote()));
  }

  return CSV_UTF8_BOM + lines.join("\n");
};

const parseLogDay = (logDay: string | null): Date | string => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(logDay ?? "");
  // UTC midnight of that calendar day, so Excel stores exactly the date shown in the app.
  return match ? new Date(Date.UTC(+match[1], +match[2] - 1, +match[3])) : logDay ?? "";
};

export const buildTimeLogsWorkbook = (rows: ITimeLogExportRow[], options: ITimeLogsExportOptions = {}): Excel.Workbook => {
  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet(SHEET_NAME, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = getTimeLogsExportHeaders(options.view);
  worksheet.columns = [
    { header: headers[0], key: "date", width: 15 },
    { header: headers[1], key: "taskKey", width: 12 },
    { header: headers[2], key: "task", width: 34 },
    { header: headers[3], key: "member", width: 22 },
    { header: headers[4], key: "project", width: 28 },
    { header: headers[5], key: "client", width: 24 },
    { header: headers[6], key: "description", width: 44 },
    { header: headers[7], key: "minutes", width: 20 },
    { header: headers[8], key: "hours", width: 18 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6FA" } };

  for (const row of rows) {
    const seconds = toSeconds(row);
    const added = worksheet.addRow({
      date: parseLogDay(row.log_day),
      taskKey: row.task_key ?? "",
      member: row.user_name ?? "",
      client: row.client_name ?? "",
      project: row.project_name ?? "",
      task: row.task_name ?? "",
      description: row.description ?? "",
      minutes: toMinutes(seconds),
      hours: toHours(seconds),
    });
    added.getCell("date").numFmt = DATE_NUM_FMT;
    added.getCell("hours").numFmt = HOURS_NUM_FMT;
  }

  const totals = summarizeExportRows(rows);
  const totalRow = worksheet.getRow(FIRST_DATA_ROW + rows.length);
  totalRow.getCell("A").value = "Total";

  if (rows.length > 0) {
    const lastDataRow = FIRST_DATA_ROW + rows.length - 1;
    // SUBTOTAL(109) ignores rows hidden by an Excel filter, so the total
    // follows whatever the reader filters down to. `result` is the cached
    // value for viewers that don't recalculate (previews, some importers).
    totalRow.getCell(MINUTES_COLUMN).value = {
      formula: `SUBTOTAL(109,${MINUTES_COLUMN}${FIRST_DATA_ROW}:${MINUTES_COLUMN}${lastDataRow})`,
      result: totals.minutes,
    };
    totalRow.getCell(HOURS_COLUMN).value = {
      formula: `SUBTOTAL(109,${HOURS_COLUMN}${FIRST_DATA_ROW}:${HOURS_COLUMN}${lastDataRow})`,
      result: totals.hours,
    };
    // Explicit range: the filter covers the entries only, never the total row.
    worksheet.autoFilter = { from: "A1", to: `${LAST_COLUMN}${lastDataRow}` };
  } else {
    totalRow.getCell(MINUTES_COLUMN).value = 0;
    totalRow.getCell(HOURS_COLUMN).value = 0;
  }
  totalRow.getCell(HOURS_COLUMN).numFmt = HOURS_NUM_FMT;
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: "thin" } };

  if (options.truncated) {
    worksheet.getRow(FIRST_DATA_ROW + rows.length + 2).getCell("A").value = truncationNote();
  }

  return workbook;
};

const GROUP_FILE_LABELS = new Map<TimeLogsGroupBy, string>([
  ["member", "by-Member"],
  ["project", "by-Project"],
  ["client", "by-Client"],
]);

/** `Time-Logs-Sep-30-2026.csv`, or `Time-Logs-by-Member-Sep-30-2026.csv` for a grouped export. */
export const getTimeLogsExportFileName = (
  extension: "csv" | "xlsx",
  date: string,
  groupBy?: TimeLogsGroupBy | null
): string => {
  const grouping = groupBy ? GROUP_FILE_LABELS.get(groupBy) : undefined;
  return `Time-Logs-${grouping ? `${grouping}-` : ""}${date}.${extension}`;
};
