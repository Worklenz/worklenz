jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));

import {
  buildPortfolio,
  PortfolioProjectRow,
  resolvePortfolioRange,
} from "../services/reporting-portfolio.service";

const lookups = {
  statuses: [{ id: "s-progress", name: "In Progress", color: null }],
  priorities: [{ id: "pr-high", name: "High", color: null }],
  healths: [{ id: "h-good", name: "Good", color: null }],
};

const row = (overrides: Partial<PortfolioProjectRow>): PortfolioProjectRow => ({
  id: "p",
  name: "Project",
  category_id: "c1",
  category_name: "Strategic",
  status_id: "s-progress",
  status_name: "In Progress",
  status_color: null,
  priority_id: "pr-high",
  priority_name: "High",
  priority_color: null,
  priority_value: 2,
  health_id: "h-good",
  health_name: "Good",
  health_color: null,
  manager: null,
  start_date: null,
  end_date: null,
  created_at: "2026-01-10T00:00:00Z",
  updated_at: "2026-01-10T00:00:00Z",
  ...overrides,
});

describe("resolvePortfolioRange", () => {
  it("resolves yearly, quarterly and monthly ranges as UTC [start, end)", () => {
    expect(resolvePortfolioRange({ period: "yearly", year: 2026 })).toEqual({
      start: new Date("2026-01-01T00:00:00Z"),
      end: new Date("2027-01-01T00:00:00Z"),
    });
    expect(resolvePortfolioRange({ period: "quarterly", year: 2026, quarter: 4 })).toEqual({
      start: new Date("2026-10-01T00:00:00Z"),
      end: new Date("2027-01-01T00:00:00Z"),
    });
    expect(resolvePortfolioRange({ period: "monthly", year: 2026, month: 12 })).toEqual({
      start: new Date("2026-12-01T00:00:00Z"),
      end: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("rejects out-of-range values", () => {
    expect(resolvePortfolioRange({ period: "quarterly", year: 2026, quarter: 5 })).toBeNull();
    expect(resolvePortfolioRange({ period: "monthly", year: 2026 })).toBeNull();
    expect(resolvePortfolioRange({ period: "yearly", year: 12 })).toBeNull();
  });
});

describe("buildPortfolio", () => {
  const range = resolvePortfolioRange({ period: "monthly", year: 2026, month: 3 })!;
  const now = new Date("2026-03-15T00:00:00Z").getTime();

  it("derives opening/new/close/closing and keeps the identity", () => {
    const rows = [
      row({ id: "a" }), // opening
      row({ id: "b", status_name: "Completed", updated_at: "2026-02-01T00:00:00Z" }), // closed before: excluded
      row({ id: "c", status_name: "Completed", updated_at: "2026-03-05T00:00:00Z" }), // opening + closed in period
      row({ id: "d", created_at: "2026-03-02T00:00:00Z", updated_at: "2026-03-02T00:00:00Z" }), // new
      row({ id: "e", created_at: "2026-04-02T00:00:00Z", updated_at: "2026-04-02T00:00:00Z" }), // after period
    ];
    const result = buildPortfolio(rows, "monthly", range, lookups, now);
    expect(result.kpis).toEqual({ opening: 2, new: 1, close: 1, closing: 2 });
    expect(result.totals.total).toBe(3);
  });

  it("counts per real status/priority/health option and groups uncategorised projects last", () => {
    const rows = [
      row({ id: "a", status_id: "s-proposed", status_name: "Proposed", priority_id: "pr-critical", health_id: "h-risk", end_date: "2026-03-01T00:00:00Z" }),
      row({ id: "b", category_id: null, category_name: null, status_id: "s-done", status_name: "Completed", updated_at: "2026-03-03T00:00:00Z", end_date: "2026-03-01T00:00:00Z", priority_id: null, health_id: null }),
    ];
    const result = buildPortfolio(rows, "monthly", range, lookups, now);
    expect(result.categories.map(c => c.name)).toEqual(["Strategic", null]);
    const strategic = result.categories[0];
    expect(strategic.status).toEqual({ "s-proposed": 1 });
    expect(strategic.priority).toEqual({ "pr-critical": 1 });
    expect(strategic.health).toEqual({ "h-risk": 1 });
    expect(strategic.overdue).toBe(1);
    const none = result.categories[1];
    expect(none.overdue).toBe(0); // closed projects are never overdue
    expect(none.priority).toEqual({}); // unset priority counts in total only
    expect(result.totals.total).toBe(2);
    expect(result.totals.status).toEqual({ "s-proposed": 1, "s-done": 1 });
  });
});
