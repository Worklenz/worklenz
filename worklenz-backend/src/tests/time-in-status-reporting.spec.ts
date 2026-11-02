jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
jest.mock("../redis/analytics-cache", () => ({
  getAnalyticsCache: jest.fn(), setAnalyticsCache: jest.fn(),
  withLastUpdated: (data: object, updated?: string) => ({ ...data, last_updated_at: updated ?? "now" }),
}));

import db from "../config/db";
import i18next from "../config/i18n";
import { getAnalyticsCache, setAnalyticsCache } from "../redis/analytics-cache";
import {
  durationDays, getTimeInStatusSeries, parseTimeInStatusFilters,
  MAX_TIS_HISTORY_ROWS, TimeInStatusServiceError,
} from "../services/reporting-analytics/time-in-status.service";
import TimeInStatusController from "../controllers/reporting-analytics/time-in-status-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const cache = new Map<string, unknown>();
const makeFilters = (query: Record<string, unknown> = {}) => parseTimeInStatusFilters(query, ["project"], "team");
const historyRow = (id: string, entered: string, exited: string | null) => ({
  history_id: id, task_id: id, status_id: "status", entered_at: entered, exited_at: exited,
  task_name: id, task_key: `P-${id}`, project_id: "project", project_name: "Project",
  status_name: "Doing", status_color: null, status_sort_order: 1, is_doing: true,
});

beforeAll(async () => { await i18next.init({ lng: "en", resources: {} }); });
beforeEach(() => {
  jest.useFakeTimers({ doNotFake: ["performance"] }).setSystemTime(new Date("2026-11-02T12:00:00.000Z"));
  cache.clear();
  (db.query as jest.Mock).mockReset().mockResolvedValue({ rows: [] });
  (getAnalyticsCache as jest.Mock).mockImplementation(async (...parts: string[]) => cache.get(parts.join(":")) ?? null);
  (setAnalyticsCache as jest.Mock).mockImplementation(async (data: unknown, parts: string[]) => {
    // Match Redis serialization, including Date -> string conversion.
    const payload = JSON.parse(JSON.stringify({ data, lastUpdatedAt: "2026-11-02T12:00:00.000Z" }));
    cache.set(parts.join(":"), payload);
    return payload;
  });
});
afterEach(() => jest.useRealTimers());

it("keeps the default thirty-day range", () => {
  expect(makeFilters()).toMatchObject({ dateFrom: "2026-10-04", dateTo: "2026-11-02" });
});
it("clamps intersecting old and future presets to retained history through today", () => {
  expect(makeFilters({ date_from: "0001-01-01", date_to: "9999-12-31" }))
    .toMatchObject({ dateFrom: "2024-11-02", dateTo: "2026-11-02" });
});
it.each([
  { date_from: "2000-01-01", date_to: "2000-02-01" },
  { date_from: "9999-01-01", date_to: "9999-12-31" },
  { date_from: "2026-11-02", date_to: "2026-11-01" },
  { date_from: "2026-02-30" }, { date_from: "invalid" },
  { date_to: ["2026-11-02"] }, { date_to: {} }, { date_to: 42 },
])("rejects invalid or wholly unavailable ranges %p", query => {
  expect(() => makeFilters(query)).toThrow(TimeInStatusServiceError);
});
it("validates direct service calls before cache or database access", async () => {
  await expect(getTimeInStatusSeries({ ...makeFilters(), dateFrom: "2000-01-01", dateTo: "2000-02-01" }))
    .rejects.toBeInstanceOf(TimeInStatusServiceError);
  expect(db.query).not.toHaveBeenCalled();
  expect(getAnalyticsCache).not.toHaveBeenCalled();
});

it("loads at most the history budget plus a sentinel, then rejects before mapping/computing", async () => {
  // Undefined rows would fail during mapping if the budget guard did not run first.
  (db.query as jest.Mock).mockResolvedValue({ rows: new Array(MAX_TIS_HISTORY_ROWS + 1) });
  await expect(getTimeInStatusSeries(makeFilters())).rejects.toBeInstanceOf(TimeInStatusServiceError);
  const [sql, params] = (db.query as jest.Mock).mock.calls[0];
  expect(sql).toMatch(/LIMIT \$\d+/);
  expect(params[params.length - 1]).toBe(MAX_TIS_HISTORY_ROWS + 1);
  expect(sql.indexOf("LIMIT $")).toBeLessThan(sql.indexOf("AS assignee_name"));
  expect(sql).toContain("FROM bounded_history h");
  expect(setAnalyticsCache).not.toHaveBeenCalled();
});

it("shares computed visits across pages, sorts, views, and equivalent date presets", async () => {
  (db.query as jest.Mock).mockResolvedValue({ rows: [
    historyRow("b", "2026-10-30T00:00:00Z", "2026-11-02T00:00:00Z"),
    historyRow("a", "2026-10-26T00:00:00Z", null),
  ] });
  const base = { date_to: "9999-12-31", exclude_weekends: "true", view_mode: "per_issue", limit: 1 };
  const first = await getTimeInStatusSeries(makeFilters(base));
  expect(first.issues.map(issue => issue.task_id)).toEqual(["a"]);
  expect(first.pagination).toEqual({ total: 2, limit: 1, offset: 0 });
  expect(first.summary.status_visit_count).toBe(2);
  const second = await getTimeInStatusSeries(makeFilters({ ...base, date_to: "2026-11-02", offset: 1 }));
  expect(second.issues.map(issue => issue.task_id)).toEqual(["b"]);
  const sorted = await getTimeInStatusSeries(makeFilters({ ...base, sort: "total_asc", limit: 2 }));
  expect(sorted.issues.map(issue => issue.task_id)).toEqual(["b", "a"]);
  const aggregate = await getTimeInStatusSeries(makeFilters({ ...base, view_mode: "aggregate", sort: "name_asc" }));
  expect(aggregate.issues).toEqual([]);
  expect(aggregate.aggregate.reduce((total, row) => total + row.count, 0)).toBe(2);
  expect(aggregate.last_updated_at).toBe(first.last_updated_at);
  expect(db.query).toHaveBeenCalledTimes(1);
  expect(setAnalyticsCache).toHaveBeenCalledTimes(1);
});

it("separates cached project access scopes and duration-affecting filters", async () => {
  await getTimeInStatusSeries(makeFilters());
  await getTimeInStatusSeries(makeFilters({ exclude_weekends: true }));
  await getTimeInStatusSeries(makeFilters({ date_mode: "entered" }));
  await getTimeInStatusSeries(parseTimeInStatusFilters({}, ["other-project"], "team"));
  await getTimeInStatusSeries(parseTimeInStatusFilters({}, ["project"], "other-team"));
  expect(db.query).toHaveBeenCalledTimes(5);
  expect(new Set((getAnalyticsCache as jest.Mock).mock.calls.map(parts => parts.join(":"))).size).toBe(5);
});

it("retains full visit durations when the report dates only select overlap", async () => {
  (db.query as jest.Mock).mockResolvedValue({ rows: [historyRow("a", "2026-10-01T00:00:00Z", "2026-11-01T00:00:00Z")] });
  const result = await getTimeInStatusSeries(makeFilters({ date_from: "2026-10-31", date_to: "2026-11-01" }));
  expect(result.aggregate.find(row => row.count)?.avg_days).toBe(31);
});

it.each(["getSeries", "getFilterOptions", "exportCsv"] as const)("returns HTTP 400 for invalid ranges on %s", async method => {
  const invalid = { date_from: "2000-01-01", date_to: "2000-02-01" };
  const req = createMockRequest({ query: invalid, body: { filters: invalid } });
  const res = createMockResponse();
  await TimeInStatusController[method](req, res);
  expect(res.statusCode).toBe(400);
  expect(db.query).not.toHaveBeenCalled();
});

it.each(["getSeries", "exportCsv"] as const)("returns HTTP 400 on history overflow on %s", async method => {
  (db.query as jest.Mock).mockResolvedValue({ rows: new Array(MAX_TIS_HISTORY_ROWS + 1) });
  const req = createMockRequest();
  Object.assign(req, { analyticsAccessibleProjectIds: ["project"] });
  const res = createMockResponse();
  await TimeInStatusController[method](req, res);
  expect(res.statusCode).toBe(400);
});

/** Reference integration of UTC weekday portions for the arithmetic regression tests. */
function referenceWeekdays(start: number, end: number): number {
  let elapsed = 0;
  for (let cursor = start; cursor < end;) {
    const next = Math.min((Math.floor(cursor / 86400000) + 1) * 86400000, end);
    const day = new Date(cursor).getUTCDay();
    if (day !== 0 && day !== 6) elapsed += next - cursor;
    cursor = next;
  }
  return elapsed / 86400000;
}

it("matches partial-day UTC behavior across every starting weekday and week boundary", () => {
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (const hour of [0, 9.5, 23.999]) {
      const start = Date.parse("2026-10-25T00:00:00Z") + (weekday + hour / 24) * 86400000;
      for (const span of [0, 0.01, 0.5, 1, 2.75, 7, 14.75, 30.123]) {
        const end = start + span * 86400000;
        expect(durationDays(new Date(start), new Date(end), true)).toBeCloseTo(referenceWeekdays(start, end), 9);
      }
    }
  }
});
it("computes millennia in constant bounded work", () => {
  const start = new Date("0001-01-01T00:00:00.000Z"); // Monday
  const end = new Date("9999-12-31T00:00:00.000Z");
  const days = (end.getTime() - start.getTime()) / 86400000;
  const remainder = days % 7;
  expect(durationDays(start, end, true)).toBe(Math.floor(days / 7) * 5 + Math.min(remainder, 5));
});

it("accepts exactly the row budget without truncating statistics", async () => {
  (db.query as jest.Mock).mockResolvedValue({ rows: Array.from({ length: MAX_TIS_HISTORY_ROWS }, () =>
    historyRow("a", "2026-10-30T00:00:00Z", "2026-11-02T00:00:00Z")) });
  const result = await getTimeInStatusSeries(makeFilters());
  expect(result.summary.status_visit_count).toBe(MAX_TIS_HISTORY_ROWS);
  expect(result.summary.issue_count).toBe(1);
});

it("normalizes unordered equivalent filter sets in the cache key", async () => {
  const options = { status_ids: "one,two,one", label_ids: "a,b", project_ids: "project" };
  await getTimeInStatusSeries(makeFilters(options));
  const calls = (db.query as jest.Mock).mock.calls.length;
  await getTimeInStatusSeries(makeFilters({ ...options, status_ids: "two,one", label_ids: "b,a" }));
  expect(db.query).toHaveBeenCalledTimes(calls);
  expect(setAnalyticsCache).toHaveBeenCalledTimes(1);
});
