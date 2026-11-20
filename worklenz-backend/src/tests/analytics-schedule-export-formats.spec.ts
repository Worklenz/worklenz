import { captureCharts, chartCount } from "chartsheet";
import {
  csvToExcelBuffer,
  slugFilename,
} from "../services/reporting-analytics/analytics-schedule-export-formats";
import type { ScheduleChartSource } from "../services/reporting-analytics/analytics-schedule-charts";

describe("analytics-schedule-export-formats", () => {
  it("slugifies report names for filenames", () => {
    expect(slugFilename("Planned vs Actual: Tasks")).toBe("planned-vs-actual-tasks");
  });

  it("builds an xlsx buffer from csv text", async () => {
    const csv = "Name,Value\nAlpha,1\nBeta,2\n";
    const buffer = await csvToExcelBuffer(csv, "Report");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.byteLength).toBeGreaterThan(100);
    // ZIP/XLSX signature
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
  });

  it("embeds a native Excel chart part for time-report source data", async () => {
    const csv =
      "Member,Project,Logged (h),Estimated (h)\nA,Proj1,1,2\nB,Proj2,3,4\n";
    const source = {
      kind: "time-report",
      data: {
        projects: [
          {
            project_id: "p1",
            project_name: "Alpha",
            logged_hours: 10,
            estimated_hours: 12,
            updated_at: "2026-11-18T00:00:00.000Z",
          },
          {
            project_id: "p2",
            project_name: "Beta",
            logged_hours: 4,
            estimated_hours: 8,
            updated_at: "2026-11-17T00:00:00.000Z",
          },
        ],
        members: [],
        kpis: {},
      },
    } as unknown as ScheduleChartSource;

    const buffer = await csvToExcelBuffer(csv, "Time Report", source);
    expect(buffer.subarray(0, 2).toString("utf8")).toBe("PK");
    expect(chartCount(await captureCharts(buffer))).toBeGreaterThan(0);
  });
});
