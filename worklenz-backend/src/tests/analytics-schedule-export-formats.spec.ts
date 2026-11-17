import {
  csvToExcelBuffer,
  slugFilename,
} from "../services/reporting-analytics/analytics-schedule-export-formats";

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
});
