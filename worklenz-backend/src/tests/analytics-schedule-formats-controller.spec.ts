import { parseFormats } from "../controllers/reporting-analytics/analytics-schedules-controller";

describe("schedule format request parsing", () => {
  it("rejects malformed supplied formats without silently changing them to PDF", () => {
    expect(() => parseFormats({ formats: "CSV" })).toThrow();
    expect(() => parseFormats({ formats: null })).toThrow();
  });
  it("accepts arrays and legacy format, and defaults only when absent", () => {
    expect(parseFormats({ formats: ["CSV", "PDF"] })).toEqual(["CSV", "PDF"]);
    expect(parseFormats({ format: "CSV" })).toEqual(["CSV"]);
    expect(parseFormats({})).toEqual(["PDF"]);
  });
});
