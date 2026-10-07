import Excel from "exceljs";
import {
  buildTimeLogsCsv,
  buildTimeLogsWorkbook,
  getTimeLogsExportFileName,
  ITimeLogExportRow,
  summarizeExportRows,
} from "../controllers/reporting/time-logs-export";

const row = (overrides: Partial<ITimeLogExportRow> = {}): ITimeLogExportRow => ({
  log_day: "2026-09-17",
  user_name: "Kai Buhler",
  client_name: "Insolvenz GmbH",
  project_name: "InsolvenzTool MASTER",
  task_key: "INS-12",
  task_name: "Project Management",
  description: "Meeting",
  time_spent: 5400, // 1h 30m
  ...overrides,
});

const parseCsv = (csv: string): string[][] =>
  csv
    .replace(/^﻿/, "")
    .split("\n")
    .filter(Boolean)
    .map(line => line.slice(1, -1).split('","'));

describe("summarizeExportRows", () => {
  it("sums raw seconds for hours and floored minutes for the minutes column", () => {
    const totals = summarizeExportRows([row({ time_spent: 90 }), row({ time_spent: 90 }), row({ time_spent: 3600 })]);
    expect(totals.seconds).toBe(3780);
    expect(totals.hours).toBeCloseTo(1.05, 10);
    // 90 s floors to 1 minute each, as the minutes column shows them
    expect(totals.minutes).toBe(1 + 1 + 60);
  });

  it("treats missing durations as zero", () => {
    expect(summarizeExportRows([row({ time_spent: null })])).toEqual({ seconds: 0, minutes: 0, hours: 0 });
  });
});

describe("buildTimeLogsCsv", () => {
  it("writes the header, one line per entry and a Total row", () => {
    const csv = buildTimeLogsCsv([row(), row({ time_spent: 1800, user_name: "Ushani" })]);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = parseCsv(csv);
    expect(lines[0]).toEqual([
      "Date",
      "Task ID",
      "Task Name",
      "Member",
      "Project",
      "Client",
      "Description",
      "Duration (Minutes)",
      "Duration (Hours)",
    ]);
    expect(lines[1]).toEqual(["2026-09-17", "INS-12", "Project Management", "Kai Buhler", "InsolvenzTool MASTER", "Insolvenz GmbH", "Meeting", "90", "1.5"]);
    expect(lines[2][3]).toBe("Ushani");
    expect(lines[3]).toEqual(["Total", "", "", "", "", "", "", "120", "2"]);
  });

  it("still writes a Total row of zero when there are no entries", () => {
    const lines = parseCsv(buildTimeLogsCsv([]));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual(["Total", "", "", "", "", "", "", "0", "0"]);
  });

  it("leaves the Client cell empty for a project without a client", () => {
    const lines = parseCsv(buildTimeLogsCsv([row({ client_name: null })]));
    expect(lines[1][5]).toBe("");
  });

  it("neutralises formula injection in free-text cells", () => {
    const csv = buildTimeLogsCsv([row({ description: '=HYPERLINK("http://evil","x")', task_name: "+1+1" })]);
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
    expect(csv).toContain(`"'+1+1"`);
  });

  it("keeps embedded commas, quotes and newlines inside one quoted cell", () => {
    const csv = buildTimeLogsCsv([row({ description: 'said "hi",\nbye' })]);
    expect(csv).toContain('"said ""hi"",\nbye"');
  });

  it("appends a note when the export was cut at the row cap", () => {
    expect(buildTimeLogsCsv([row()], { truncated: true })).toContain("Export limited to the first 50,000 entries");
    expect(buildTimeLogsCsv([row()])).not.toContain("Export limited");
  });

  it("trims hour decimals instead of padding them", () => {
    const lines = parseCsv(buildTimeLogsCsv([row({ time_spent: 61 })]));
    expect(lines[1][8]).toBe("0.0169");
  });

  it("labels the date column 'Last Logged' for a By task export, and keeps every other column", () => {
    const lines = parseCsv(buildTimeLogsCsv([row({ user_name: "Kai Buhler, Ushani", time_spent: 7200 })], { view: "task" }));
    expect(lines[0]).toEqual([
      "Last Logged",
      "Task ID",
      "Task Name",
      "Member",
      "Project",
      "Client",
      "Description",
      "Duration (Minutes)",
      "Duration (Hours)",
    ]);
    // a task's members arrive already joined, so they stay one cell
    expect(lines[1]).toEqual(["2026-09-17", "INS-12", "Project Management", "Kai Buhler, Ushani", "InsolvenzTool MASTER", "Insolvenz GmbH", "Meeting", "120", "2"]);
    expect(lines[2]).toEqual(["Total", "", "", "", "", "", "", "120", "2"]);
  });

  it("uses 'Date' for the flat view whether the view is named or omitted", () => {
    expect(parseCsv(buildTimeLogsCsv([row()], { view: "flat" }))[0][0]).toBe("Date");
    expect(parseCsv(buildTimeLogsCsv([row()]))[0][0]).toBe("Date");
  });
});

describe("buildTimeLogsWorkbook", () => {
  const load = async (rows: ITimeLogExportRow[], options = {}) => {
    const buffer = await buildTimeLogsWorkbook(rows, options).xlsx.writeBuffer();
    const reread = new Excel.Workbook();
    await reread.xlsx.load(buffer as ArrayBuffer);
    return reread.getWorksheet("Time Logs")!;
  };

  it("writes real dates, minutes and hours, with a frozen header", async () => {
    const sheet = await load([row()]);
    expect(sheet.getRow(1).getCell(1).value).toBe("Date");
    expect(sheet.getRow(1).getCell(2).value).toBe("Task ID");
    expect(sheet.getRow(1).getCell(3).value).toBe("Task Name");
    expect(sheet.getRow(1).getCell(6).value).toBe("Client");
    expect(sheet.getRow(1).getCell(9).value).toBe("Duration (Hours)");
    const data = sheet.getRow(2);
    expect(data.getCell(1).value).toEqual(new Date(Date.UTC(2026, 8, 17)));
    expect(data.getCell(2).value).toBe("INS-12");
    expect(data.getCell(3).value).toBe("Project Management");
    expect(data.getCell(6).value).toBe("Insolvenz GmbH");
    expect(data.getCell(8).value).toBe(90);
    expect(data.getCell(9).value).toBeCloseTo(1.5, 10);
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("labels the date column 'Last Logged' for a By task export, with the same layout and total", async () => {
    const sheet = await load([row(), row({ time_spent: 1800 })], { view: "task" });
    expect(sheet.getRow(1).getCell(1).value).toBe("Last Logged");
    expect(sheet.getRow(1).getCell(9).value).toBe("Duration (Hours)");
    expect(sheet.getRow(2).getCell(1).value).toEqual(new Date(Date.UTC(2026, 8, 17)));
    expect(sheet.getRow(4).getCell(8).value).toMatchObject({ formula: "SUBTOTAL(109,H2:H3)", result: 120 });
    expect(sheet.autoFilter).toBe("A1:I3");
  });

  it("totals with SUBTOTAL formulas that follow an Excel filter, and caches the result", async () => {
    const sheet = await load([row(), row({ time_spent: 1800 }), row({ time_spent: 3600 })]);
    const total = sheet.getRow(5);
    expect(total.getCell(1).value).toBe("Total");
    expect(total.getCell(8).value).toMatchObject({ formula: "SUBTOTAL(109,H2:H4)", result: 180 });
    expect(total.getCell(9).value).toMatchObject({ formula: "SUBTOTAL(109,I2:I4)" });
    expect((total.getCell(9).value as { result: number }).result).toBeCloseTo(3, 10);
    expect(total.font?.bold).toBe(true);
  });

  it("limits the auto-filter to the entries so the Total row is never filtered away", async () => {
    const sheet = await load([row(), row()]);
    // 2 entries → rows 2-3; the Total row (4) sits outside the filter range
    expect(sheet.autoFilter).toBe("A1:I3");
  });

  it("writes a plain zero total when there are no entries", async () => {
    const sheet = await load([]);
    expect(sheet.getRow(2).getCell(1).value).toBe("Total");
    expect(sheet.getRow(2).getCell(8).value).toBe(0);
  });

  it("keeps formula-looking text as text, not a formula", async () => {
    const sheet = await load([row({ description: "=1+1" })]);
    expect(sheet.getRow(2).getCell(7).value).toBe("=1+1");
  });

  it("notes truncation below the total", async () => {
    const sheet = await load([row()], { truncated: true });
    expect(String(sheet.getRow(5).getCell(1).value)).toContain("Export limited to the first 50,000 entries");
  });
});

describe("getTimeLogsExportFileName", () => {
  it("builds a dated file name per extension", () => {
    expect(getTimeLogsExportFileName("csv", "Sep-30-2026")).toBe("Time-Logs-Sep-30-2026.csv");
    expect(getTimeLogsExportFileName("xlsx", "Sep-30-2026")).toBe("Time-Logs-Sep-30-2026.xlsx");
  });
});
