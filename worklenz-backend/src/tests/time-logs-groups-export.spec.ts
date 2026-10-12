import Excel from "exceljs";
import {
  buildTimeLogGroupsCsv,
  buildTimeLogGroupsWorkbook,
  getTimeLogGroupsExportHeaders,
  ITimeLogGroupExportRow,
  summarizeGroupRows,
} from "../controllers/reporting/time-logs-groups-export";
import { getTimeLogsExportFileName } from "../controllers/reporting/time-logs-export";

const group = (overrides: Partial<ITimeLogGroupExportRow> = {}): ITimeLogGroupExportRow => ({
  group_label: "Kai Buhler",
  group_status: "active",
  subtotal: 18000, // 5h = 3h 30m billable + 1h 30m not
  entry_count: 6,
  task_count: 4,
  project_count: 2,
  member_count: 1,
  billable_entry_count: 4,
  billable_task_count: 3,
  billable_time: 12600,
  non_billable_entry_count: 2,
  non_billable_task_count: 1,
  non_billable_time: 5400,
  ...overrides,
});

const parseCsv = (csv: string): string[][] =>
  csv
    .replace(/^﻿/, "")
    .split("\n")
    .filter(Boolean)
    .map(line => line.slice(1, -1).split('","'));

describe("getTimeLogGroupsExportHeaders", () => {
  it.each([
    ["member", "Member", "Projects"],
    ["project", "Project", "Members"],
    ["client", "Client", "Projects"],
  ] as const)("names the %s columns like the table on screen", (groupBy, identity, secondary) => {
    expect(getTimeLogGroupsExportHeaders(groupBy)).toEqual([
      identity,
      secondary,
      "Total Entries",
      "Billable Entries",
      "Billable Tasks",
      "Billable Time (Hours)",
      "Non-billable Entries",
      "Non-billable Tasks",
      "Non-billable Time (Hours)",
      "Total Time (Minutes)",
      "Total Time (Hours)",
    ]);
  });
});

describe("buildTimeLogGroupsCsv", () => {
  it("writes one row per group, with its rollup, and a Total row", () => {
    const csv = buildTimeLogGroupsCsv(
      [group(), group({ group_label: "Ushani", subtotal: 3600, entry_count: 1, billable_entry_count: 1, billable_time: 3600, non_billable_entry_count: 0, non_billable_time: 0, project_count: 1, billable_task_count: 1, non_billable_task_count: 0 })],
      "member"
    );
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = parseCsv(csv);
    expect(lines).toHaveLength(4);
    expect(lines[0][0]).toBe("Member");
    // name | projects | entries | billable entries | billable tasks | billable h | non-billable entries |
    // non-billable tasks | non-billable h | total minutes | total hours
    expect(lines[1]).toEqual(["Kai Buhler", "2", "6", "4", "3", "3.5", "2", "1", "1.5", "300", "5"]);
    expect(lines[2]).toEqual(["Ushani", "1", "1", "1", "1", "1", "0", "0", "0", "60", "1"]);
  });

  it("totals only what adds up across groups, and leaves distinct counts blank", () => {
    const lines = parseCsv(buildTimeLogGroupsCsv([group(), group({ group_label: "Ushani" })], "member"));
    // projects, billable tasks and non-billable tasks can repeat between groups, so no total for them
    expect(lines[3]).toEqual(["Total", "", "12", "8", "", "7", "4", "", "3", "600", "10"]);
  });

  it("writes a Total row of zeros when there are no groups", () => {
    const lines = parseCsv(buildTimeLogGroupsCsv([], "project"));
    expect(lines).toHaveLength(2);
    expect(lines[1]).toEqual(["Total", "", "0", "0", "", "0", "0", "", "0", "0", "0"]);
  });

  it("counts a project's members, not its projects", () => {
    const lines = parseCsv(buildTimeLogGroupsCsv([group({ group_label: "Website", member_count: 5, project_count: 1 })], "project"));
    expect(lines[0][1]).toBe("Members");
    expect(lines[1][1]).toBe("5");
  });

  it("names the projects without a client \"No client\"", () => {
    const lines = parseCsv(buildTimeLogGroupsCsv([group({ group_label: null, group_status: null })], "client"));
    expect(lines[1][0]).toBe("No client");
  });

  it("tags a member who is no longer active, as the table does", () => {
    const lines = parseCsv(
      buildTimeLogGroupsCsv(
        [
          group({ group_label: "Anna", group_status: "active" }),
          group({ group_label: "Tharindu Nishan", group_status: "deactivated" }),
          group({ group_label: "Olivia Rose", group_status: "removed" }),
        ],
        "member"
      )
    );
    expect(lines.slice(1, 4).map(l => l[0])).toEqual(["Anna", "Tharindu Nishan (Deactivated)", "Olivia Rose (Removed)"]);
  });

  it("does not tag a project or client with a member standing", () => {
    const lines = parseCsv(buildTimeLogGroupsCsv([group({ group_label: "Website", group_status: "removed" })], "project"));
    expect(lines[1][0]).toBe("Website");
  });

  it("neutralises formula injection in a group name", () => {
    const csv = buildTimeLogGroupsCsv([group({ group_label: "=HYPERLINK(\"http://evil\",\"x\")" })], "client");
    expect(csv).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
  });

  it("treats missing figures as zero", () => {
    const lines = parseCsv(
      buildTimeLogGroupsCsv(
        [group({ subtotal: null, billable_time: null, non_billable_time: null, entry_count: null, project_count: null })],
        "member"
      )
    );
    expect(lines[1]).toEqual(["Kai Buhler", "0", "0", "4", "3", "0", "2", "1", "0", "0", "0"]);
  });

  it("appends a note when the export was cut at the cap", () => {
    expect(buildTimeLogGroupsCsv([group()], "member", { truncated: true })).toContain("Export limited to the first 50,000 groups");
    expect(buildTimeLogGroupsCsv([group()], "member")).not.toContain("Export limited");
  });
});

describe("summarizeGroupRows", () => {
  it("sums entries and time over every group; minutes are the sum of each group's whole minutes", () => {
    const totals = summarizeGroupRows([group({ subtotal: 90 }), group({ subtotal: 90 })], "member");
    // 90 s floors to 1 minute each, as each row's minutes cell shows — what the sheet's SUBTOTAL adds
    expect(totals.minutes).toBe(2);
    expect(totals.hours).toBeCloseTo(0.05, 10);
    expect(totals.entries).toBe(12);
    expect(totals.billableHours).toBeCloseTo(7, 10);
    expect(totals.nonBillableHours).toBeCloseTo(3, 10);
  });
});

describe("buildTimeLogGroupsWorkbook", () => {
  const load = async (rows: ITimeLogGroupExportRow[], groupBy: "member" | "project" | "client" = "member", options = {}) => {
    const buffer = await buildTimeLogGroupsWorkbook(rows, groupBy, options).xlsx.writeBuffer();
    const reread = new Excel.Workbook();
    await reread.xlsx.load(buffer as ArrayBuffer);
    return reread.worksheets[0];
  };

  it("names the sheet after the grouping, with a frozen header", async () => {
    expect((await load([group()], "member")).name).toBe("Time Logs by Member");
    expect((await load([group()], "project")).name).toBe("Time Logs by Project");
    const sheet = await load([group()], "client");
    expect(sheet.name).toBe("Time Logs by Client");
    expect(sheet.views[0]).toMatchObject({ state: "frozen", ySplit: 1 });
  });

  it("writes real numbers for every count and time", async () => {
    const sheet = await load([group()]);
    expect(sheet.getRow(1).getCell(1).value).toBe("Member");
    expect(sheet.getRow(1).getCell(11).value).toBe("Total Time (Hours)");
    const data = sheet.getRow(2);
    expect(data.getCell(1).value).toBe("Kai Buhler");
    expect(data.getCell(2).value).toBe(2);
    expect(data.getCell(3).value).toBe(6);
    expect(data.getCell(6).value).toBeCloseTo(3.5, 10);
    expect(data.getCell(9).value).toBeCloseTo(1.5, 10);
    expect(data.getCell(10).value).toBe(300);
    expect(data.getCell(11).value).toBeCloseTo(5, 10);
  });

  it("totals the additive columns with SUBTOTAL formulas that follow an Excel filter", async () => {
    const sheet = await load([group(), group({ group_label: "Ushani" })]);
    const total = sheet.getRow(4);
    expect(total.getCell(1).value).toBe("Total");
    expect(total.getCell(3).value).toMatchObject({ formula: "SUBTOTAL(109,C2:C3)", result: 12 });
    expect(total.getCell(4).value).toMatchObject({ formula: "SUBTOTAL(109,D2:D3)", result: 8 });
    expect(total.getCell(6).value).toMatchObject({ formula: "SUBTOTAL(109,F2:F3)" });
    expect(total.getCell(7).value).toMatchObject({ formula: "SUBTOTAL(109,G2:G3)" });
    expect(total.getCell(9).value).toMatchObject({ formula: "SUBTOTAL(109,I2:I3)" });
    expect(total.getCell(10).value).toMatchObject({ formula: "SUBTOTAL(109,J2:J3)", result: 600 });
    expect(total.getCell(11).value).toMatchObject({ formula: "SUBTOTAL(109,K2:K3)" });
    expect((total.getCell(11).value as { result: number }).result).toBeCloseTo(10, 10);
    expect(total.font?.bold).toBe(true);
  });

  it("leaves the distinct-count columns of the Total row empty", async () => {
    const total = (await load([group(), group()])).getRow(4);
    for (const column of [2, 5, 8]) {
      expect(total.getCell(column).value).toBeNull();
    }
  });

  it("limits the auto-filter to the groups so the Total row is never filtered away", async () => {
    // 2 groups → rows 2-3; the Total row (4) sits outside the filter range
    expect((await load([group(), group()])).autoFilter).toBe("A1:K3");
  });

  it("writes a plain zero total when there are no groups", async () => {
    const sheet = await load([]);
    expect(sheet.getRow(2).getCell(1).value).toBe("Total");
    expect(sheet.getRow(2).getCell(3).value).toBe(0);
    expect(sheet.getRow(2).getCell(10).value).toBe(0);
  });

  it("keeps formula-looking text as text, not a formula", async () => {
    expect((await load([group({ group_label: "=1+1" })])).getRow(2).getCell(1).value).toBe("=1+1");
  });

  it("tags former members and names the no-client group", async () => {
    const members = await load([group({ group_status: "removed" })]);
    expect(members.getRow(2).getCell(1).value).toBe("Kai Buhler (Removed)");
    const clients = await load([group({ group_label: null, group_status: null })], "client");
    expect(clients.getRow(2).getCell(1).value).toBe("No client");
  });

  it("notes truncation below the total", async () => {
    const sheet = await load([group()], "member", { truncated: true });
    expect(String(sheet.getRow(5).getCell(1).value)).toContain("Export limited to the first 50,000 groups");
  });
});

describe("getTimeLogsExportFileName", () => {
  it("names a grouped export after its grouping", () => {
    expect(getTimeLogsExportFileName("xlsx", "Sep-30-2026", "member")).toBe("Time-Logs-by-Member-Sep-30-2026.xlsx");
    expect(getTimeLogsExportFileName("csv", "Sep-30-2026", "project")).toBe("Time-Logs-by-Project-Sep-30-2026.csv");
    expect(getTimeLogsExportFileName("csv", "Sep-30-2026", "client")).toBe("Time-Logs-by-Client-Sep-30-2026.csv");
  });

  it("keeps the plain name when nothing is grouped", () => {
    expect(getTimeLogsExportFileName("csv", "Sep-30-2026", null)).toBe("Time-Logs-Sep-30-2026.csv");
    expect(getTimeLogsExportFileName("csv", "Sep-30-2026")).toBe("Time-Logs-Sep-30-2026.csv");
  });
});
