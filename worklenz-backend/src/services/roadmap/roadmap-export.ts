import Excel from "exceljs";
import { createElement, ReactElement } from "react";
import { DocumentProps, renderToBuffer } from "@react-pdf/renderer";

import { RoadmapDocument } from "../../shared/pdf/RoadmapDocument";
import { registerPdfFonts } from "../../shared/pdf/fonts";
import { safeColor } from "../../shared/pdf/format";

export type RoadmapExportFormat = "pdf" | "xlsx";
export type RoadmapGroupBy = "phase" | "status" | "priority";
export type RoadmapRowKind = "group" | "task" | "subtask";

export interface RoadmapExportRow {
  kind: RoadmapRowKind;
  name: string;
  group: string;
  startDate: string | null;
  endDate: string | null;
  progress: number | null;
  status: string;
  priority: string;
  assignees: string;
  dependencies: string;
  dependencyLinks?: Array<{ name: string; relation: string }>;
  parent: string;
  color: string | null;
}

export interface PreparedRoadmapExport {
  format: RoadmapExportFormat;
  groupBy: RoadmapGroupBy;
  groupingLabel: string;
  rows: RoadmapExportRow[];
  timelineStart: string | null;
  timelineEnd: string | null;
}

export interface TimelineWindow {
  startMs: number;
  endMs: number;
}

export interface TimelineTick {
  label: string;
  /** 0–1 across the timeline. */
  left: number;
}

export interface TimelineBar {
  left: number;
  width: number;
}

export interface TimelinePeriod {
  label: string;
  startMs: number;
  endMs: number;
}

export interface RoadmapDependencyLink {
  from: string;
  to: string;
  group: string;
  kind: RoadmapRowKind;
  relation: string;
}

const MAX_ROWS = 500;
const MAX_TEXT = 500;
const MAX_TIMELINE_COLUMNS = 52;
/** Cap dependency expansion so one dense dependencies cell cannot explode export size. */
const MAX_DEPENDENCY_LINKS_PER_ROW = 25;
/** Hard ceiling across the whole export (Excel Dependencies sheet + PDF page). */
const MAX_DEPENDENCY_LINKS = 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DETAIL_HEADERS = [
  "Group",
  "Type",
  "Name",
  "Start",
  "End",
  "Progress",
  "Status",
  "Priority",
  "Assignees",
  "Dependencies",
  "Parent",
] as const;

const GROUP_TYPE_LABEL: Record<RoadmapGroupBy, string> = {
  phase: "Phase",
  status: "Status",
  priority: "Priority",
};

const GROUPING_FALLBACK: Record<RoadmapGroupBy, string> = {
  phase: "Phase",
  status: "Status",
  priority: "Priority",
};

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const parseExportDay = (value: string): number | null => {
  const match = DATE_RE.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const ms = Date.UTC(year, month - 1, day);
  const check = new Date(ms);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day) {
    return null;
  }
  return ms;
};

const cleanText = (value: unknown, max = MAX_TEXT): string => {
  if (typeof value !== "string") return "";
  const cleaned = value.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
  const points: string[] = [];
  for (const point of cleaned) {
    if (points.length >= max) break;
    points.push(point);
  }
  return points.join("");
};

/** Stop a cell that starts with a formula trigger from executing in Excel. */
export const excelSafeText = (value: string): string =>
  /^[=+\-@]/.test(value) ? `'${value}` : value;

const cleanDate = (value: unknown): string | null => {
  if (value == null || value === "") return null;
  if (typeof value !== "string") return null;
  return parseExportDay(value) == null ? null : value;
};

const cleanProgress = (value: unknown): number | null => {
  if (value == null || value === "") return null;
  const number = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.max(0, Math.min(100, Math.round(number)));
};

const cleanColor = (value: unknown): string | null => {
  if (typeof value !== "string" || !value.trim()) return null;
  const safe = safeColor(value, "");
  if (!safe) return null;
  const short = /^#([0-9a-f]{3})$/i.exec(safe);
  if (short) {
    const [r, g, b] = short[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toLowerCase();
  }
  return safe.toLowerCase();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const prepareRoadmapExport = (
  body: unknown
): { ok: true; value: PreparedRoadmapExport } | { ok: false; message: string } => {
  if (!isRecord(body)) {
    return { ok: false, message: "Export payload is required" };
  }

  const format = body.format;
  if (format !== "pdf" && format !== "xlsx") {
    return { ok: false, message: "Export format must be pdf or xlsx" };
  }

  const groupBy = body.group_by;
  if (groupBy !== "phase" && groupBy !== "status" && groupBy !== "priority") {
    return { ok: false, message: "Grouping must be phase, status, or priority" };
  }

  if (!Array.isArray(body.rows)) {
    return { ok: false, message: "Roadmap rows are required" };
  }
  if (body.rows.length > MAX_ROWS) {
    return { ok: false, message: `A roadmap export can include at most ${MAX_ROWS} rows` };
  }

  const groupingLabel = cleanText(body.grouping_label, 40) || GROUPING_FALLBACK[groupBy];
  const rows: RoadmapExportRow[] = [];

  for (const raw of body.rows) {
    if (!isRecord(raw)) {
      return { ok: false, message: "Each roadmap row must be an object" };
    }
    if (raw.kind !== "group" && raw.kind !== "task" && raw.kind !== "subtask") {
      return { ok: false, message: "Each roadmap row needs a type of group, task, or subtask" };
    }

    const startDate = raw.startDate == null || raw.startDate === "" ? null : cleanDate(raw.startDate);
    const endDate = raw.endDate == null || raw.endDate === "" ? null : cleanDate(raw.endDate);
    if ((raw.startDate != null && raw.startDate !== "" && !startDate) || (raw.endDate != null && raw.endDate !== "" && !endDate)) {
      return { ok: false, message: "Roadmap dates must use YYYY-MM-DD" };
    }

    let start = startDate;
    let end = endDate;
    if (start && end && start > end) {
      const swap = start;
      start = end;
      end = swap;
    }

    rows.push({
      kind: raw.kind,
      name: cleanText(raw.name) || (raw.kind === "group" ? "Untitled" : "Untitled task"),
      group: cleanText(raw.group),
      startDate: start,
      endDate: end,
      progress: cleanProgress(raw.progress),
      status: cleanText(raw.status),
      priority: cleanText(raw.priority),
      assignees: cleanText(raw.assignees),
      dependencies: cleanText(raw.dependencies),
      dependencyLinks: Array.isArray(raw.dependencyLinks)
        ? raw.dependencyLinks.slice(0, MAX_DEPENDENCY_LINKS_PER_ROW).filter(isRecord).map(link => ({
            name: cleanText(link.name),
            relation: cleanText(link.relation, 80) || "depends on",
          })).filter(link => link.name.length > 0)
        : undefined,
      parent: cleanText(raw.parent),
      color: cleanColor(raw.color),
    });
  }

  const timelineStart = cleanDate(body.timeline_start);
  const timelineEnd = cleanDate(body.timeline_end);
  if ((body.timeline_start != null || body.timeline_end != null) &&
      (!timelineStart || !timelineEnd || timelineStart > timelineEnd)) {
    return { ok: false, message: "Timeline bounds must be valid ordered dates" };
  }
  return { ok: true, value: { format, groupBy, groupingLabel, rows, timelineStart, timelineEnd } };
};

export const timelineWindow = (rows: Array<Pick<RoadmapExportRow, "startDate" | "endDate">>): TimelineWindow | null => {
  let min = Infinity;
  let max = -Infinity;

  for (const row of rows) {
    const start = row.startDate ? parseExportDay(row.startDate) : null;
    const end = row.endDate ? parseExportDay(row.endDate) : null;
    const from = start ?? end;
    const to = end ?? start;
    if (from == null || to == null) continue;
    min = Math.min(min, from, to);
    max = Math.max(max, from, to);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max === min) {
    return { startMs: min - DAY_MS, endMs: max + 2 * DAY_MS };
  }
  return { startMs: min - DAY_MS, endMs: max + DAY_MS };
};

const formatDayLabel = (ms: number): string => {
  const date = new Date(ms);
  return `${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}`;
};

const formatMonthLabel = (ms: number): string => {
  const date = new Date(ms);
  return `${MONTHS[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
};

const pushTick = (ticks: TimelineTick[], window: TimelineWindow, ms: number, label: string): void => {
  const span = window.endMs - window.startMs;
  if (span <= 0) return;
  const left = (ms - window.startMs) / span;
  if (left < 0 || left > 0.96) return;
  if (ticks.some(tick => Math.abs(tick.left - left) < 0.04)) return;
  ticks.push({ label, left });
};

export const timelineTicks = (window: TimelineWindow): TimelineTick[] => {
  const spanDays = (window.endMs - window.startMs) / DAY_MS;
  const ticks: TimelineTick[] = [];

  if (spanDays <= 45) {
    const step = spanDays <= 16 ? 1 : 7;
    for (let ms = window.startMs; ms <= window.endMs; ms += step * DAY_MS) {
      pushTick(ticks, window, ms, formatDayLabel(ms));
    }
    return ticks;
  }

  if (spanDays <= 200) {
    const cursor = new Date(window.startMs);
    const day = cursor.getUTCDay();
    const shift = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
    let ms = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + shift);
    if (ms < window.startMs) ms += 7 * DAY_MS;
    while (ms <= window.endMs) {
      pushTick(ticks, window, ms, formatDayLabel(ms));
      ms += 7 * DAY_MS;
    }
    return ticks;
  }

  const cursor = new Date(window.startMs);
  let ms = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), 1);
  if (ms < window.startMs) {
    ms = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1);
  }
  const stepMonths = spanDays > 800 ? 3 : 1;
  while (ms <= window.endMs) {
    pushTick(ticks, window, ms, formatMonthLabel(ms));
    const next = new Date(ms);
    ms = Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + stepMonths, 1);
  }
  return ticks;
};

export const barGeometry = (
  startDate: string | null,
  endDate: string | null,
  window: TimelineWindow
): TimelineBar | null => {
  const start = startDate ? parseExportDay(startDate) : null;
  const end = endDate ? parseExportDay(endDate) : null;
  const from = start ?? end;
  const to = end ?? start;
  if (from == null || to == null) return null;

  const span = window.endMs - window.startMs;
  if (span <= 0) return null;

  let left = (from - window.startMs) / span;
  let right = (to + DAY_MS - window.startMs) / span;
  left = Math.max(0, Math.min(1, left));
  right = Math.max(0, Math.min(1, right));
  if (right - left < 0.012) {
    const mid = (left + right) / 2;
    left = Math.max(0, mid - 0.006);
    right = Math.min(1, left + 0.012);
  }
  return { left, width: Math.max(0.012, right - left) };
};

export const todayMarker = (window: TimelineWindow, exportedOn: string): number | null => {
  const today = parseExportDay(exportedOn);
  if (today == null) return null;
  const span = window.endMs - window.startMs;
  if (span <= 0 || today < window.startMs || today > window.endMs) return null;
  return (today - window.startMs) / span;
};

const addCalendarMonths = (ms: number, months: number): number => {
  const date = new Date(ms);
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1);
};

/** Period columns that paint the Excel roadmap chart. */
export const timelinePeriods = (window: TimelineWindow): TimelinePeriod[] => {
  const spanDays = (window.endMs - window.startMs) / DAY_MS;
  let mode: "day" | "week" | "month" | "quarter" =
    spanDays <= 45 ? "day" : spanDays <= 200 ? "week" : spanDays <= 800 ? "month" : "quarter";

  const build = (active: typeof mode): TimelinePeriod[] => {
    const periods: TimelinePeriod[] = [];
    if (active === "day") {
      for (let ms = window.startMs; ms < window.endMs; ms += DAY_MS) {
        periods.push({ label: formatDayLabel(ms), startMs: ms, endMs: ms + DAY_MS });
      }
      return periods;
    }
    if (active === "week") {
      const cursor = new Date(window.startMs);
      const day = cursor.getUTCDay();
      const shift = day === 0 ? -6 : 1 - day;
      let ms = Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate() + shift);
      while (ms < window.endMs) {
        const end = ms + 7 * DAY_MS;
        periods.push({ label: formatDayLabel(ms), startMs: ms, endMs: end });
        ms = end;
      }
      return periods;
    }
    const months = active === "quarter" ? 3 : 1;
    let ms = Date.UTC(new Date(window.startMs).getUTCFullYear(), new Date(window.startMs).getUTCMonth(), 1);
    while (ms < window.endMs) {
      const end = addCalendarMonths(ms, months);
      periods.push({ label: formatMonthLabel(ms), startMs: ms, endMs: end });
      ms = end;
    }
    return periods;
  };

  let periods = build(mode);
  while (periods.length > MAX_TIMELINE_COLUMNS) {
    if (mode === "day") mode = "week";
    else if (mode === "week") mode = "month";
    else if (mode === "month") mode = "quarter";
    else break;
    periods = build(mode);
  }
  if (periods.length <= MAX_TIMELINE_COLUMNS) return periods;

  // Aggregate long timelines instead of dropping dates beyond the column limit.
  const groupSize = Math.ceil(periods.length / MAX_TIMELINE_COLUMNS);
  return periods.filter((_, index) => index % groupSize === 0).map((period, index) => {
    const last = periods[Math.min((index + 1) * groupSize - 1, periods.length - 1)];
    return { label: period.label, startMs: period.startMs, endMs: last.endMs };
  });
};

const splitDependencyParts = (value: string, maxParts = MAX_DEPENDENCY_LINKS_PER_ROW): string[] => {
  const trimmed = value.trim();
  if (!trimmed) return [];
  const raw = trimmed.includes(";") ? trimmed.split(";") : trimmed.split(",");
  const parts: string[] = [];
  for (const part of raw) {
    const cleaned = part.trim();
    if (!cleaned) continue;
    parts.push(cleaned);
    if (parts.length >= maxParts) break;
  }
  return parts;
};

export const parseDependencyLinks = (rows: RoadmapExportRow[]): RoadmapDependencyLink[] => {
  const links: RoadmapDependencyLink[] = [];
  for (const row of rows) {
    if (links.length >= MAX_DEPENDENCY_LINKS) break;
    if (row.kind === "group") continue;
    if (row.dependencyLinks) {
      for (const link of row.dependencyLinks.slice(0, Math.min(MAX_DEPENDENCY_LINKS_PER_ROW, MAX_DEPENDENCY_LINKS - links.length))) {
        links.push({ from: row.name, to: link.name, group: row.group, kind: row.kind, relation: link.relation });
      }
      continue;
    }
    if (!row.dependencies.trim()) continue;

    const remaining = MAX_DEPENDENCY_LINKS - links.length;
    const perRowCap = Math.min(MAX_DEPENDENCY_LINKS_PER_ROW, remaining);
    for (const part of splitDependencyParts(row.dependencies, perRowCap)) {
      const typed = /^(.*)\s*\[([^\]]+)\]\s*$/.exec(part);
      links.push({
        from: row.name,
        to: (typed ? typed[1] : part).trim(),
        group: row.group,
        kind: row.kind,
        relation: typed ? typed[2].trim() : "depends on",
      });
      if (links.length >= MAX_DEPENDENCY_LINKS) break;
    }
  }
  return links;
};

const rowTypeLabel = (row: RoadmapExportRow, groupBy: RoadmapGroupBy): string => {
  if (row.kind === "task") return "Task";
  if (row.kind === "subtask") return "Subtask";
  return GROUP_TYPE_LABEL[groupBy];
};

const indentName = (row: RoadmapExportRow): string => {
  if (row.kind === "subtask") return `    ${row.name}`;
  if (row.kind === "task") return `  ${row.name}`;
  return row.name;
};

const argbFromHex = (hex: string | null, fallback: string): string => {
  const safe = cleanColor(hex) || fallback;
  return `FF${safe.slice(1).toUpperCase()}`;
};

const barFillColor = (row: RoadmapExportRow): string => {
  if (row.kind === "subtask") return "FF69B1FF";
  if (row.kind === "task") return "FF1890FF";
  return argbFromHex(row.color, "#8C8C8C");
};

const styleHeaderCell = (cell: Excel.Cell): void => {
  cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
  cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1890FF" } };
  cell.alignment = { vertical: "middle", wrapText: true, horizontal: "center" };
};

const writeSheetTitle = (
  sheet: Excel.Worksheet,
  input: { projectName: string; exportedOn: string; groupingLabel: string },
  lastColumn: number
): void => {
  sheet.mergeCells(1, 1, 1, lastColumn);
  sheet.getCell(1, 1).value = "Roadmap";
  sheet.getCell(1, 1).font = { size: 16, bold: true, color: { argb: "FF262626" } };

  sheet.mergeCells(2, 1, 2, lastColumn);
  sheet.getCell(2, 1).value = excelSafeText(input.projectName);
  sheet.getCell(2, 1).font = { size: 12, bold: true };

  sheet.mergeCells(3, 1, 3, lastColumn);
  sheet.getCell(3, 1).value = `Grouped by ${excelSafeText(input.groupingLabel)}  ·  Exported ${input.exportedOn}`;
  sheet.getCell(3, 1).font = { size: 10, color: { argb: "FF595959" } };
};

const detailValues = (row: RoadmapExportRow, groupBy: RoadmapGroupBy): Array<string | number> => [
  excelSafeText(row.group),
  rowTypeLabel(row, groupBy),
  excelSafeText(row.name),
  row.startDate ?? "",
  row.endDate ?? "",
  row.progress ?? "",
  excelSafeText(row.status),
  excelSafeText(row.priority),
  excelSafeText(row.assignees),
  excelSafeText(row.dependencies),
  excelSafeText(row.parent),
];

const writeTasksSheet = (
  workbook: Excel.Workbook,
  input: {
    projectName: string;
    exportedOn: string;
    groupingLabel: string;
    groupBy: RoadmapGroupBy;
    rows: RoadmapExportRow[];
  }
): void => {
  const sheet = workbook.addWorksheet("Tasks");
  writeSheetTitle(sheet, input, DETAIL_HEADERS.length);

  const header = sheet.getRow(5);
  DETAIL_HEADERS.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    styleHeaderCell(cell);
  });
  header.height = 20;

  input.rows.forEach((row, index) => {
    const values = detailValues(row, input.groupBy);
    const excelRow = sheet.getRow(6 + index);
    values.forEach((value, column) => {
      excelRow.getCell(column + 1).value = value;
    });
    if (row.kind === "group") {
      excelRow.font = { bold: true };
      values.forEach((_, column) => {
        excelRow.getCell(column + 1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      });
    }
  });

  sheet.columns = [
    { width: 22 },
    { width: 12 },
    { width: 36 },
    { width: 14 },
    { width: 14 },
    { width: 12 },
    { width: 16 },
    { width: 14 },
    { width: 28 },
    { width: 36 },
    { width: 28 },
  ];
  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.autoFilter = {
    from: { row: 5, column: 1 },
    to: { row: 5, column: DETAIL_HEADERS.length },
  };
};

const writeTimelineSheet = (
  workbook: Excel.Workbook,
  input: {
    projectName: string;
    exportedOn: string;
    groupingLabel: string;
    groupBy: RoadmapGroupBy;
    rows: RoadmapExportRow[];
  }
): void => {
  const sheet = workbook.addWorksheet("Timeline", { properties: { defaultColWidth: 4 } });
  const window = timelineWindow(input.rows);
  const periods = window ? timelinePeriods(window) : [];
  const metaHeaders = ["Name", "Type", "Start", "End", "Progress", "Status", "Dependencies"] as const;
  const lastColumn = Math.max(metaHeaders.length, metaHeaders.length + periods.length);
  writeSheetTitle(sheet, input, lastColumn);

  const header = sheet.getRow(5);
  metaHeaders.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    styleHeaderCell(cell);
  });

  const todayMs = parseExportDay(input.exportedOn);
  periods.forEach((period, index) => {
    const cell = header.getCell(metaHeaders.length + index + 1);
    cell.value = period.label;
    styleHeaderCell(cell);
    cell.alignment = { textRotation: 90, vertical: "bottom", horizontal: "center", wrapText: true };
    if (todayMs != null && todayMs >= period.startMs && todayMs < period.endMs) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFF4D4F" } };
    }
  });
  header.height = periods.length ? 48 : 20;

  input.rows.forEach((row, index) => {
    const excelRow = sheet.getRow(6 + index);
    const values: Array<string | number> = [
      excelSafeText(indentName(row)),
      rowTypeLabel(row, input.groupBy),
      row.startDate ?? "",
      row.endDate ?? "",
      row.progress ?? "",
      excelSafeText(row.status),
      excelSafeText(row.dependencies),
    ];
    values.forEach((value, column) => {
      excelRow.getCell(column + 1).value = value;
    });
    if (row.kind === "group") {
      excelRow.font = { bold: true };
      values.forEach((_, column) => {
        excelRow.getCell(column + 1).fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F5F5" },
        };
      });
    }

    if (!window || !periods.length) return;
    const start = row.startDate ? parseExportDay(row.startDate) : null;
    const end = row.endDate ? parseExportDay(row.endDate) : null;
    const from = start ?? end;
    const to = end ?? start;
    if (from == null || to == null) return;
    const taskEnd = to + DAY_MS;
    const fill = barFillColor(row);
    periods.forEach((period, periodIndex) => {
      if (from < period.endMs && taskEnd > period.startMs) {
        const cell = excelRow.getCell(metaHeaders.length + periodIndex + 1);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
        if (row.kind !== "group" && row.progress != null) {
          cell.note = `${row.progress}% complete`;
        }
      }
    });
  });

  sheet.getColumn(1).width = 36;
  sheet.getColumn(2).width = 12;
  sheet.getColumn(3).width = 12;
  sheet.getColumn(4).width = 12;
  sheet.getColumn(5).width = 10;
  sheet.getColumn(6).width = 14;
  sheet.getColumn(7).width = 28;
  periods.forEach((_, index) => {
    sheet.getColumn(metaHeaders.length + index + 1).width = 3.2;
  });
  sheet.views = [{ state: "frozen", xSplit: metaHeaders.length, ySplit: 5 }];
};

const writeDependenciesSheet = (
  workbook: Excel.Workbook,
  input: {
    projectName: string;
    exportedOn: string;
    groupingLabel: string;
    groupBy: RoadmapGroupBy;
    rows: RoadmapExportRow[];
  }
): void => {
  const sheet = workbook.addWorksheet("Dependencies");
  const links = parseDependencyLinks(input.rows);
  const headers = ["Group", "Task", "Task type", "Depends on", "Relation"] as const;
  writeSheetTitle(sheet, input, headers.length);

  const header = sheet.getRow(5);
  headers.forEach((label, index) => {
    const cell = header.getCell(index + 1);
    cell.value = label;
    styleHeaderCell(cell);
  });
  header.height = 20;

  if (links.length === 0) {
    sheet.getCell("A6").value = "No roadmap dependencies in this export.";
    sheet.getCell("A6").font = { color: { argb: "FF8C8C8C" }, italic: true };
  } else {
    links.forEach((link, index) => {
      const excelRow = sheet.getRow(6 + index);
      excelRow.getCell(1).value = excelSafeText(link.group);
      excelRow.getCell(2).value = excelSafeText(link.from);
      excelRow.getCell(3).value = link.kind === "subtask" ? "Subtask" : "Task";
      excelRow.getCell(4).value = excelSafeText(link.to);
      excelRow.getCell(5).value = excelSafeText(link.relation);
    });
  }

  sheet.columns = [{ width: 22 }, { width: 36 }, { width: 12 }, { width: 36 }, { width: 18 }];
  sheet.views = [{ state: "frozen", ySplit: 5 }];
  sheet.autoFilter = { from: { row: 5, column: 1 }, to: { row: 5, column: headers.length } };
};

export const buildRoadmapExcel = async (input: {
  projectName: string;
  exportedOn: string;
  groupingLabel: string;
  groupBy: RoadmapGroupBy;
  rows: RoadmapExportRow[];
}): Promise<Buffer> => {
  const workbook = new Excel.Workbook();
  workbook.creator = "Worklenz";
  // Timeline first so the visual roadmap chart is the opening sheet.
  writeTimelineSheet(workbook, input);
  writeTasksSheet(workbook, input);
  writeDependenciesSheet(workbook, input);

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

export const buildRoadmapPdf = async (input: {
  projectName: string;
  exportedOn: string;
  groupingLabel: string;
  rows: RoadmapExportRow[];
  timelineStart?: string | null;
  timelineEnd?: string | null;
}): Promise<Buffer> => {
  registerPdfFonts();
  const window = input.timelineStart && input.timelineEnd
    ? timelineWindow([{ startDate: input.timelineStart, endDate: input.timelineEnd }])
    : timelineWindow(input.rows);
  const model = {
    projectName: input.projectName,
    exportedOn: input.exportedOn,
    groupingLabel: input.groupingLabel,
    hasTimeline: window != null,
    ticks: window ? timelineTicks(window) : [],
    todayLeft: window ? todayMarker(window, input.exportedOn) : null,
    rows: input.rows.map(row => ({
      ...row,
      bar: window ? barGeometry(row.startDate, row.endDate, window) : null,
    })),
    dependencies: parseDependencyLinks(input.rows),
  };

  return renderToBuffer(
    createElement(RoadmapDocument, { model }) as unknown as ReactElement<DocumentProps>
  );
};

export const roadmapExportFileName = (
  projectName: string,
  format: RoadmapExportFormat,
  exportedOn: string
): string => {
  const safe = Array.from(
    projectName.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()
  ).slice(0, 80).join("") || "project";
  return `Roadmap - ${safe} - ${exportedOn}.${format}`;
};

export const roadmapContentDisposition = (fileName: string): string => {
  const ascii = fileName.replace(/[^\x20-\x7E]/g, "_").replace(/["\\]/g, "");
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
};
