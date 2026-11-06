import Excel from "exceljs";
import {
  barGeometry,
  buildRoadmapExcel,
  buildRoadmapPdf,
  excelSafeText,
  prepareRoadmapExport,
  roadmapExportFileName,
  timelineTicks,
  timelineWindow,
  todayMarker,
} from "../services/roadmap/roadmap-export";

const row = (overrides: Record<string, unknown> = {}) => ({
  kind: "task",
  name: "Design review",
  group: "Discovery",
  startDate: "2026-03-02",
  endDate: "2026-03-10",
  progress: 40,
  status: "Doing",
  priority: "High",
  assignees: "Ada Lovelace",
  dependencies: "Kickoff",
  parent: "",
  color: null,
  ...overrides,
});

describe("roadmap export", () => {
  it("rejects an unknown format and an invalid date", () => {
    expect(prepareRoadmapExport({ format: "csv", group_by: "phase", rows: [] }).ok).toBe(false);
    const dated = prepareRoadmapExport({
      format: "pdf",
      group_by: "phase",
      rows: [row({ startDate: "2026-02-31" })],
    });
    expect(dated.ok).toBe(false);
  });

  it("keeps the current grouping and swaps a reversed date range", () => {
    const prepared = prepareRoadmapExport({
      format: "xlsx",
      group_by: "status",
      grouping_label: "Status",
      rows: [row({ startDate: "2026-04-10", endDate: "2026-04-01", name: "=HYPERLINK(\"x\")" })],
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;
    expect(prepared.value.groupBy).toBe("status");
    expect(prepared.value.rows[0].startDate).toBe("2026-04-01");
    expect(prepared.value.rows[0].endDate).toBe("2026-04-10");
    expect(prepared.value.rows[0].name.startsWith("=")).toBe(true);
    expect(excelSafeText(prepared.value.rows[0].name).startsWith("'")).toBe(true);
  });

  it("places a one-day task inside a padded window and marks today", () => {
    const window = timelineWindow([{ startDate: "2026-06-01", endDate: "2026-06-01" }]);
    expect(window).not.toBeNull();
    if (!window) return;
    const bar = barGeometry("2026-06-01", "2026-06-01", window);
    expect(bar).not.toBeNull();
    expect(bar!.left).toBeGreaterThan(0);
    expect(bar!.left + bar!.width).toBeLessThanOrEqual(1);
    expect(todayMarker(window, "2026-06-01")).not.toBeNull();
    expect(todayMarker(window, "2027-01-01")).toBeNull();
    expect(timelineTicks(window).length).toBeGreaterThan(0);
  });

  it("writes an Excel sheet with the phase, task, and subtask rows", async () => {
    const prepared = prepareRoadmapExport({
      format: "xlsx",
      group_by: "phase",
      grouping_label: "Phase",
      rows: [
        row({ kind: "group", name: "Discovery", progress: 25, color: "#52c41a", startDate: "2026-03-01", endDate: "2026-03-20" }),
        row(),
        row({ kind: "subtask", name: "Wireframes", parent: "Design review", progress: 100, assignees: "Grace Hopper" }),
      ],
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const buffer = await buildRoadmapExcel({
      projectName: "Client rollout",
      exportedOn: "2026-11-06",
      groupingLabel: prepared.value.groupingLabel,
      groupBy: prepared.value.groupBy,
      rows: prepared.value.rows,
    });

    const workbook = new Excel.Workbook();
    await workbook.xlsx.load(buffer as unknown as Excel.Buffer);
    const sheet = workbook.getWorksheet("Roadmap");
    expect(sheet?.getCell("A1").value).toBe("Roadmap");
    expect(sheet?.getCell("A2").value).toBe("Client rollout");
    expect(sheet?.getRow(5).getCell(3).value).toBe("Name");
    expect(sheet?.getRow(6).getCell(2).value).toBe("Phase");
    expect(sheet?.getRow(7).getCell(2).value).toBe("Task");
    expect(sheet?.getRow(7).getCell(3).value).toBe("Design review");
    expect(sheet?.getRow(7).getCell(9).value).toBe("Ada Lovelace");
    expect(sheet?.getRow(8).getCell(2).value).toBe("Subtask");
    expect(sheet?.getRow(8).getCell(11).value).toBe("Design review");
    expect(buffer.subarray(0, 2).toString()).toBe("PK");
  });

  it("renders a landscape roadmap PDF", async () => {
    const prepared = prepareRoadmapExport({
      format: "pdf",
      group_by: "phase",
      grouping_label: "Phase",
      rows: [
        row({ kind: "group", name: "Discovery ශ්‍රී", color: "#1677ff" }),
        row({ name: "Design review" }),
      ],
    });
    expect(prepared.ok).toBe(true);
    if (!prepared.ok) return;

    const pdf = await buildRoadmapPdf({
      projectName: "Client rollout",
      exportedOn: "2026-11-06",
      groupingLabel: "Phase",
      rows: prepared.value.rows,
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(roadmapExportFileName("Client / rollout", "pdf", "2026-11-06")).toBe(
      "Roadmap - Client rollout - 2026-11-06.pdf"
    );
  });
});
