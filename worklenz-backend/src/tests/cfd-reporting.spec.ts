jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
}));
jest.mock("../redis/analytics-cache", () => ({
  getAnalyticsCache: jest.fn().mockResolvedValue(null),
  setAnalyticsCache: jest.fn().mockResolvedValue({ lastUpdatedAt: "now" }),
  withLastUpdated: (data: object) => ({ ...data, last_updated_at: "now" }),
}));

import db from "../config/db";
import { cfdDatesInclusive } from "../services/reporting-analytics/cfd-date-range";
import {
  backfillRange,
  captureSnapshotsForDate,
} from "../services/reporting-analytics/cfd-snapshot.service";
import { buildCfdCsvMatrix, CfdSeriesResult, getCfdSeries, parseCfdFilters } from "../services/reporting-analytics/cfd-series.service";

const clientQuery = jest.fn();
const clientRelease = jest.fn();
const client = { query: clientQuery, release: clientRelease };

describe("CFD date bounds and exports", () => {
  beforeEach(() => {
    jest.useFakeTimers({ doNotFake: ["performance"] }).setSystemTime(new Date("2026-11-02T12:00:00Z"));
    (db.query as jest.Mock).mockReset();
    clientQuery.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    clientRelease.mockReset();
    (db.connect as jest.Mock).mockReset().mockResolvedValue(client);
  });
  afterEach(() => jest.useRealTimers());

  it("caps future month-end and far-future filters at today", () => {
    for (const date_to of ["2026-11-30", "9999-12-31"]) {
      const filters = parseCfdFilters({ date_to }, ["project"], "team");
      expect(filters.dateTo).toBe("2026-11-02");
      expect(cfdDatesInclusive(filters.dateFrom, filters.dateTo)).toHaveLength(30);
    }
  });

  it.each([[], ["2026-11-01"], {}, 42])("rejects non-scalar date parameters: %p", date_to => {
    expect(() => parseCfdFilters({ date_to }, [], "team")).toThrow("Invalid date");
  });

  it("rejects ranges entirely outside retained history", () => {
    expect(() => parseCfdFilters({ date_from: "2000-01-01", date_to: "2000-02-01" }, [], "team")).toThrow();
    expect(() => parseCfdFilters({ date_from: "9999-01-01", date_to: "9999-12-31" }, [], "team")).toThrow();
  });

  it("bounds direct backfill calls before querying", async () => {
    await expect(backfillRange(["project"], "2026-01-01", "9999-12-31")).rejects.toThrow();
    expect(db.query).not.toHaveBeenCalled();
    expect(() => cfdDatesInclusive("2000-01-01", "2026-11-02")).toThrow();
  });

  it("locks snapshot writes before replacing captured rows", async () => {
    clientQuery.mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });

    await expect(captureSnapshotsForDate("2026-11-02", ["project"])).resolves.toBe(2);
    expect(clientQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(clientQuery.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
    expect(clientQuery.mock.calls[2][0]).toContain("DELETE FROM cfd_daily_snapshots");
    expect(clientQuery.mock.calls[3][0]).toContain("INSERT INTO cfd_daily_snapshots");
    expect(clientQuery.mock.calls[4][0]).toBe("COMMIT");
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  it("backfills only missing project/day pairs using explicit UTC boundaries", async () => {
    clientQuery.mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [
      { project_id: "a", snapshot_date: "2026-11-01" },
      { project_id: "b", snapshot_date: "2026-11-02" },
      ], rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    await expect(backfillRange(["a", "b"], "2026-11-01", "2026-11-02")).resolves.toBe(2);
    const [sql, params] = clientQuery.mock.calls[4];
    expect(params).toEqual([["a", "b"], ["2026-11-02", "2026-11-01"]]);
    expect(sql).toContain("unnest($1::UUID[], $2::DATE[])");
    expect(sql).toContain("h.entered_at < ((n.day + 1)::TIMESTAMP AT TIME ZONE 'UTC')");
    expect(sql).toContain("h.exited_at >= ((n.day + 1)::TIMESTAMP AT TIME ZONE 'UTC')");
    expect(clientQuery.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
    expect(clientQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(clientQuery.mock.calls[5][0]).toBe("COMMIT");
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  it.each(["epic", "label", "assignee"])("loads all days in a single grouped %s query", async group_by => {
    const query = db.query as jest.Mock;
    query.mockResolvedValue({ rows: [], rowCount: 0 });
    await getCfdSeries(parseCfdFilters({
      project_ids: "project", group_by, date_from: "2026-10-01", date_to: "2026-10-31",
    }, ["project"], "team"));
    const grouped = query.mock.calls.filter(([sql]) => sql.includes("AS group_name"));
    expect(grouped).toHaveLength(1);
    expect(grouped[0][1][1]).toHaveLength(31);
  });

  it.each(["=", "+", "-", "@", "\t", "\r"])("neutralizes formula-leading status names: %p", lead => {
    const data = {
      dates: ["2026-11-02"],
      statuses: [{ id: "status", name: `${lead}SUM(1,2)` }],
      series: [{ status_id: "status", group_name: 'Group "A"', values: [3] }],
      meta: { granularity: "week" },
    } as CfdSeriesResult;
    const csv = buildCfdCsvMatrix(data);
    expect(csv).toContain(`"'${lead}SUM(1,2) / Group ""A"""`);
    expect(csv).toContain('"2026-11-02",3');
  });
});
