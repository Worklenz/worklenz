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
import * as sharedUtils from "../shared/utils";
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
    clientQuery.mockReset().mockImplementation((sql: string) =>
      Promise.resolve({
        rows: sql.includes("pg_try_advisory_xact_lock")
          ? [{ acquired: true }]
          : [],
        rowCount: 0,
      })
    );
    clientRelease.mockReset();
    (db.connect as jest.Mock).mockReset().mockResolvedValue(client);
    jest.spyOn(sharedUtils, "log_error").mockImplementation(() => {});
  });
  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

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
      .mockResolvedValueOnce({ rows: [{ acquired: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ acquired: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });

    await expect(captureSnapshotsForDate("2026-11-02", ["project"])).resolves.toBe(2);
    expect(clientQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(clientQuery.mock.calls[1][0]).toContain("pg_try_advisory_xact_lock_shared");
    expect(clientQuery.mock.calls[2][1]).toEqual(["cfd-daily-snapshots", ["project"]]);
    expect(clientQuery.mock.calls[3][0]).toContain("DELETE FROM cfd_daily_snapshots");
    expect(clientQuery.mock.calls[4][0]).toContain("INSERT INTO cfd_daily_snapshots");
    expect(clientQuery.mock.calls[5][0]).toBe("COMMIT");
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  it("backfills only missing project/day pairs using explicit UTC boundaries", async () => {
    clientQuery.mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ acquired: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [{ acquired: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [
      { project_id: "a", snapshot_date: "2026-11-01" },
      { project_id: "b", snapshot_date: "2026-11-02" },
      ], rowCount: 2 })
      .mockResolvedValueOnce({ rowCount: 1 })
      .mockResolvedValueOnce({ rowCount: 2 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    await expect(backfillRange(["a", "b"], "2026-11-01", "2026-11-02")).resolves.toBe(2);
    const [sql, params] = clientQuery.mock.calls[5];
    expect(params).toEqual([["a", "b"], ["2026-11-02", "2026-11-01"]]);
    expect(sql).toContain("unnest($1::UUID[], $2::DATE[])");
    expect(sql).toContain("h.entered_at < ((n.day + 1)::TIMESTAMP AT TIME ZONE 'UTC')");
    expect(sql).toContain("h.exited_at >= ((n.day + 1)::TIMESTAMP AT TIME ZONE 'UTC')");
    expect(clientQuery.mock.calls[1][0]).toContain("pg_try_advisory_xact_lock");
    expect(clientQuery.mock.calls[0][0]).toBe("BEGIN");
    expect(clientQuery.mock.calls[6][0]).toBe("COMMIT");
    expect(clientRelease).toHaveBeenCalledTimes(1);
  });

  it("releases a contending pool client before retrying the snapshot lock", async () => {
    const contendingQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ acquired: false }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });
    const contendingRelease = jest.fn();
    const acquiredQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [], rowCount: null })
      .mockResolvedValueOnce({ rows: [{ acquired: true }], rowCount: 1 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: 0 })
      .mockResolvedValueOnce({ rows: [], rowCount: null });

    (db.connect as jest.Mock).mockReset()
      .mockResolvedValueOnce({ query: contendingQuery, release: contendingRelease })
      .mockImplementationOnce(async () => {
        expect(contendingRelease).toHaveBeenCalledTimes(1);
        return { query: acquiredQuery, release: jest.fn() };
      });

    jest.useRealTimers();
    const pending = captureSnapshotsForDate("2026-11-02");
    await expect(pending).resolves.toBe(0);

    expect(contendingQuery.mock.calls.map(([sql]) => sql)).toEqual([
      "BEGIN",
      expect.stringContaining("pg_try_advisory_xact_lock"),
      "ROLLBACK",
    ]);
    expect(contendingRelease).toHaveBeenCalledTimes(1);
  });

  it("releases all project locks before retrying a partially contended set", async () => {
    const contendingQuery = jest.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({ rows: [{ acquired: false }] })
      .mockResolvedValueOnce({ rows: [] });
    const release = jest.fn();
    (db.connect as jest.Mock).mockReset()
      .mockResolvedValueOnce({ query: contendingQuery, release })
      .mockImplementationOnce(async () => {
        expect(release).toHaveBeenCalledTimes(1);
        return client;
      });
    jest.useRealTimers();

    await expect(captureSnapshotsForDate("2026-11-02", ["b", "a", "b"])).resolves.toBe(0);
    expect(contendingQuery.mock.calls[1][0]).toContain("pg_try_advisory_xact_lock_shared");
    expect(contendingQuery.mock.calls[2][1]).toEqual(["cfd-daily-snapshots", ["a", "b"]]);
    expect(contendingQuery.mock.calls[3][0]).toBe("ROLLBACK");
  });

  it("takes the exclusive global lock for full-table snapshot capture", async () => {
    await captureSnapshotsForDate("2026-11-02");
    expect(clientQuery.mock.calls[1][0]).toBe(
      "SELECT pg_try_advisory_xact_lock(hashtext($1)) AS acquired"
    );
    expect(clientQuery.mock.calls[2][0]).toContain("DELETE FROM cfd_daily_snapshots");
  });

  it("allows independent projects to write while an overlapping project waits", async () => {
    jest.useRealTimers();
    const lockedProjects = new Set<string>();
    let releaseFirst!: () => void;
    let firstStarted!: () => void;
    const firstBlocked = new Promise<void>(resolve => { releaseFirst = resolve; });
    const firstStartedPromise = new Promise<void>(resolve => { firstStarted = resolve; });
    let blockFirstInsert = true;

    (db.connect as jest.Mock).mockImplementation(async () => {
      const held: string[] = [];
      return {
        release: jest.fn(),
        query: jest.fn(async (sql: string, params?: [string, string[]]) => {
          if (sql.includes("pg_try_advisory_xact_lock_shared")) return { rows: [{ acquired: true }] };
          if (sql.includes("bool_and(pg_try_advisory_xact_lock")) {
            const projects = params?.[1] ?? [];
            const acquired = projects.every(id => !lockedProjects.has(id));
            if (acquired) projects.forEach(id => { lockedProjects.add(id); held.push(id); });
            return { rows: [{ acquired }] };
          }
          if (sql.includes("INSERT INTO cfd_daily_snapshots") && blockFirstInsert) {
            blockFirstInsert = false;
            firstStarted();
            await firstBlocked;
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") held.forEach(id => lockedProjects.delete(id));
          return { rows: [], rowCount: 0 };
        }),
      };
    });

    const first = captureSnapshotsForDate("2026-11-02", ["a"]);
    await firstStartedPromise;
    await expect(captureSnapshotsForDate("2026-11-02", ["b"])).resolves.toBe(0);
    let overlappingFinished = false;
    const overlapping = captureSnapshotsForDate("2026-11-02", ["a"]).then(result => {
      overlappingFinished = true;
      return result;
    });
    await new Promise(resolve => setTimeout(resolve, 75));
    expect(overlappingFinished).toBe(false);
    releaseFirst();
    await expect(Promise.all([first, overlapping])).resolves.toEqual([0, 0]);
  });

  it.each([
    [
      "snapshot capture",
      () => captureSnapshotsForDate("2026-11-02", ["project"]),
      "DELETE FROM cfd_daily_snapshots",
    ],
    [
      "backfill",
      () => backfillRange(["project"], "2026-11-01", "2026-11-02"),
      "SELECT project_id::TEXT",
    ],
  ])("preserves the original %s error when rollback fails", async (_name, operation, failingQuery) => {
    const originalError = new Error("operation failed");
    const rollbackError = new Error("rollback failed");
    const query = jest.fn().mockImplementation((sql: string) => {
      if (sql === "BEGIN") return Promise.resolve({ rows: [], rowCount: null });
      if (sql.includes("pg_try_advisory_xact_lock")) {
        return Promise.resolve({ rows: [{ acquired: true }], rowCount: 1 });
      }
      if (sql.includes(failingQuery)) return Promise.reject(originalError);
      if (sql === "ROLLBACK") return Promise.reject(rollbackError);
      return Promise.resolve({ rows: [], rowCount: 0 });
    });
    const release = jest.fn();
    (db.connect as jest.Mock).mockResolvedValueOnce({ query, release });

    await expect(operation()).rejects.toBe(originalError);
    expect(sharedUtils.log_error).toHaveBeenCalledWith(rollbackError);
    expect(release).toHaveBeenCalledWith(true);
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
