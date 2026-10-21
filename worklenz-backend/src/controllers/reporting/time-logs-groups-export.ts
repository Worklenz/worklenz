import Excel from "exceljs";
import { CSV_UTF8_BOM, formatCsvCell } from "../../shared/csv-utils";
import { formatCsvHours, toHours, toMinutes, truncationNote } from "./time-logs-export";
import { TimeLogsGroupBy } from "./time-logs-query-builder";

/** One group as `buildTimeLogsGroupsQuery` returns it, reduced to what the export uses. */
export interface ITimeLogGroupExportRow {
  group_label: string | null;
  /** Member groups only: "active", "deactivated" or "removed". */
  group_status?: string | null;
  /** Seconds. */
  subtotal: number | null;
  entry_count: number | null;
  task_count?: number | null;
  project_count: number | null;
  member_count: number | null;
  billable_entry_count: number | null;
  billable_task_count: number | null;
  /** Seconds. */
  billable_time: number | null;
  non_billable_entry_count: number | null;
  non_billable_task_count: number | null;
  /** Seconds. */
  non_billable_time: number | null;
}

export interface ITimeLogGroupsExportOptions {
  /** More groups matched than the export cap allows; the rest were left out. */
  truncated?: boolean;
}

interface IGroupLayout {
  /** Heading of the name column: what the rows are. */
  identity: string;
  /** Heading of the one dimension-dependent count: members and clients span several projects, a project several members. */
  secondary: string;
  sheetName: string;
}

// A Map, like the query builder's lookups: the grouping comes from the client.
const GROUP_LAYOUTS = new Map<TimeLogsGroupBy, IGroupLayout>([
  ["member", { identity: "Member", secondary: "Projects", sheetName: "Time Logs by Member" }],
  ["project", { identity: "Project", secondary: "Members", sheetName: "Time Logs by Project" }],
  ["client", { identity: "Client", secondary: "Projects", sheetName: "Time Logs by Client" }],
]);

const getLayout = (groupBy: TimeLogsGroupBy): IGroupLayout => {
  const layout = GROUP_LAYOUTS.get(groupBy);
  if (!layout) throw new Error(`Unknown grouping: ${groupBy}`);
  return layout;
};

/**
 * The columns of the grouped table on screen — name, the one dimension-dependent count, the rollup
 * counts and times — with time as numbers a spreadsheet can add up: hours for the billable split,
 * minutes and hours for the total (like the ungrouped export).
 */
export const getTimeLogGroupsExportHeaders = (groupBy: TimeLogsGroupBy): string[] => [
  getLayout(groupBy).identity,
  getLayout(groupBy).secondary,
  "Total Entries",
  "Billable Entries",
  "Billable Tasks",
  "Billable Time (Hours)",
  "Non-billable Entries",
  "Non-billable Tasks",
  "Non-billable Time (Hours)",
  "Total Time (Minutes)",
  "Total Time (Hours)",
];

const HOURS_NUM_FMT = "0.00";
const FIRST_DATA_ROW = 2;
// Column letters follow getTimeLogGroupsExportHeaders.
const COLUMNS = {
  name: "A",
  secondary: "B",
  entries: "C",
  billableEntries: "D",
  billableTasks: "E",
  billableHours: "F",
  nonBillableEntries: "G",
  nonBillableTasks: "H",
  nonBillableHours: "I",
  totalMinutes: "J",
  totalHours: "K",
} as const;
const LAST_COLUMN = COLUMNS.totalHours;

const toSeconds = (value: number | null | undefined): number => Math.max(0, Number(value) || 0);
const toCount = (value: number | null | undefined): number => Number(value) || 0;

const STATUS_SUFFIX: Record<string, string> = {
  deactivated: " (Deactivated)",
  removed: " (Removed)",
};

/** The group's name as the table shows it: a former member carries their standing. */
const getGroupName = (row: ITimeLogGroupExportRow, groupBy: TimeLogsGroupBy): string => {
  const name = row.group_label ?? (groupBy === "client" ? "No client" : "Unknown");
  return `${name}${groupBy === "member" ? (STATUS_SUFFIX[row.group_status ?? ""] ?? "") : ""}`;
};

interface IGroupValues {
  name: string;
  secondary: number;
  entries: number;
  billableEntries: number;
  billableTasks: number;
  billableSeconds: number;
  nonBillableEntries: number;
  nonBillableTasks: number;
  nonBillableSeconds: number;
  totalSeconds: number;
}

const toValues = (row: ITimeLogGroupExportRow, groupBy: TimeLogsGroupBy): IGroupValues => ({
  name: getGroupName(row, groupBy),
  secondary: toCount(groupBy === "project" ? row.member_count : row.project_count),
  entries: toCount(row.entry_count),
  billableEntries: toCount(row.billable_entry_count),
  billableTasks: toCount(row.billable_task_count),
  billableSeconds: toSeconds(row.billable_time),
  nonBillableEntries: toCount(row.non_billable_entry_count),
  nonBillableTasks: toCount(row.non_billable_task_count),
  nonBillableSeconds: toSeconds(row.non_billable_time),
  totalSeconds: toSeconds(row.subtotal),
});

interface IGroupTotals {
  entries: number;
  billableEntries: number;
  billableHours: number;
  nonBillableEntries: number;
  nonBillableHours: number;
  /** The sum of the rows' whole minutes — what the sheet's own SUBTOTAL adds up. */
  minutes: number;
  hours: number;
}

/** What the Total row adds up, over every group of the export (not just a page of them). */
export const summarizeGroupRows = (rows: ITimeLogGroupExportRow[], groupBy: TimeLogsGroupBy): IGroupTotals => {
  const totals: IGroupTotals = {
    entries: 0,
    billableEntries: 0,
    billableHours: 0,
    nonBillableEntries: 0,
    nonBillableHours: 0,
    minutes: 0,
    hours: 0,
  };
  for (const row of rows) {
    const values = toValues(row, groupBy);
    totals.entries += values.entries;
    totals.billableEntries += values.billableEntries;
    totals.billableHours += toHours(values.billableSeconds);
    totals.nonBillableEntries += values.nonBillableEntries;
    totals.nonBillableHours += toHours(values.nonBillableSeconds);
    totals.minutes += toMinutes(values.totalSeconds);
    totals.hours += toHours(values.totalSeconds);
  }
  return totals;
};

export const buildTimeLogGroupsCsv = (
  rows: ITimeLogGroupExportRow[],
  groupBy: TimeLogsGroupBy,
  options: ITimeLogGroupsExportOptions = {}
): string => {
  const lines: string[] = [getTimeLogGroupsExportHeaders(groupBy).map(h => formatCsvCell(h)).join(",")];

  for (const row of rows) {
    const v = toValues(row, groupBy);
    lines.push(
      [
        v.name,
        v.secondary,
        v.entries,
        v.billableEntries,
        v.billableTasks,
        formatCsvHours(toHours(v.billableSeconds)),
        v.nonBillableEntries,
        v.nonBillableTasks,
        formatCsvHours(toHours(v.nonBillableSeconds)),
        toMinutes(v.totalSeconds),
        formatCsvHours(toHours(v.totalSeconds)),
      ]
        .map(formatCsvCell)
        .join(",")
    );
  }

  const totals = summarizeGroupRows(rows, groupBy);
  lines.push(
    [
      "Total",
      "",
      totals.entries,
      totals.billableEntries,
      "",
      formatCsvHours(totals.billableHours),
      totals.nonBillableEntries,
      "",
      formatCsvHours(totals.nonBillableHours),
      totals.minutes,
      formatCsvHours(totals.hours),
    ]
      .map(formatCsvCell)
      .join(",")
  );

  if (options.truncated) {
    lines.push("", formatCsvCell(truncationNote("groups")));
  }

  return CSV_UTF8_BOM + lines.join("\n");
};

export const buildTimeLogGroupsWorkbook = (
  rows: ITimeLogGroupExportRow[],
  groupBy: TimeLogsGroupBy,
  options: ITimeLogGroupsExportOptions = {}
): Excel.Workbook => {
  const workbook = new Excel.Workbook();
  const worksheet = workbook.addWorksheet(getLayout(groupBy).sheetName, {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  const headers = getTimeLogGroupsExportHeaders(groupBy);
  worksheet.columns = [
    { header: headers[0], key: "name", width: 30 },
    { header: headers[1], key: "secondary", width: 12 },
    { header: headers[2], key: "entries", width: 15 },
    { header: headers[3], key: "billableEntries", width: 17 },
    { header: headers[4], key: "billableTasks", width: 15 },
    { header: headers[5], key: "billableHours", width: 22 },
    { header: headers[6], key: "nonBillableEntries", width: 21 },
    { header: headers[7], key: "nonBillableTasks", width: 19 },
    { header: headers[8], key: "nonBillableHours", width: 26 },
    { header: headers[9], key: "totalMinutes", width: 21 },
    { header: headers[10], key: "totalHours", width: 19 },
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE6E6FA" } };

  for (const row of rows) {
    const v = toValues(row, groupBy);
    const added = worksheet.addRow({
      name: v.name,
      secondary: v.secondary,
      entries: v.entries,
      billableEntries: v.billableEntries,
      billableTasks: v.billableTasks,
      billableHours: toHours(v.billableSeconds),
      nonBillableEntries: v.nonBillableEntries,
      nonBillableTasks: v.nonBillableTasks,
      nonBillableHours: toHours(v.nonBillableSeconds),
      totalMinutes: toMinutes(v.totalSeconds),
      totalHours: toHours(v.totalSeconds),
    });
    for (const column of [COLUMNS.billableHours, COLUMNS.nonBillableHours, COLUMNS.totalHours]) {
      added.getCell(column).numFmt = HOURS_NUM_FMT;
    }
  }

  const totals = summarizeGroupRows(rows, groupBy);
  // The columns a total makes sense for. A count of distinct things (the projects a member touched,
  // the tasks they logged on) does not add up across groups — the same project or task can sit in
  // several — so the Total row leaves those blank, exactly as the table's footer does.
  const additiveColumns: [string, number][] = [
    [COLUMNS.entries, totals.entries],
    [COLUMNS.billableEntries, totals.billableEntries],
    [COLUMNS.billableHours, totals.billableHours],
    [COLUMNS.nonBillableEntries, totals.nonBillableEntries],
    [COLUMNS.nonBillableHours, totals.nonBillableHours],
    [COLUMNS.totalMinutes, totals.minutes],
    [COLUMNS.totalHours, totals.hours],
  ];

  const totalRow = worksheet.getRow(FIRST_DATA_ROW + rows.length);
  totalRow.getCell(COLUMNS.name).value = "Total";

  if (rows.length > 0) {
    const lastDataRow = FIRST_DATA_ROW + rows.length - 1;
    for (const [column, total] of additiveColumns) {
      // SUBTOTAL(109) ignores rows hidden by an Excel filter, so the total follows whatever the
      // reader filters down to. `result` is the cached value for viewers that don't recalculate.
      totalRow.getCell(column).value = {
        formula: `SUBTOTAL(109,${column}${FIRST_DATA_ROW}:${column}${lastDataRow})`,
        result: total,
      };
    }
    // Explicit range: the filter covers the groups only, never the total row.
    worksheet.autoFilter = { from: "A1", to: `${LAST_COLUMN}${lastDataRow}` };
  } else {
    for (const [column] of additiveColumns) totalRow.getCell(column).value = 0;
  }
  for (const column of [COLUMNS.billableHours, COLUMNS.nonBillableHours, COLUMNS.totalHours]) {
    totalRow.getCell(column).numFmt = HOURS_NUM_FMT;
  }
  totalRow.font = { bold: true };
  totalRow.border = { top: { style: "thin" } };

  if (options.truncated) {
    worksheet.getRow(FIRST_DATA_ROW + rows.length + 2).getCell(COLUMNS.name).value = truncationNote("groups");
  }

  return workbook;
};
