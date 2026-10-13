import {
  GADGET_TYPES,
  InvalidDashboardError,
  validateDashboardFilters,
  validateDashboardMeta,
  validateGadgets,
} from "../services/dashboard-validation";
import { canViewDashboard } from "../services/dashboards.service";

const PROJECT_ID = "6f1c1f3e-0f5a-4c43-9a3b-1b7f2f4f9c11";
const gadget = (overrides: Record<string, unknown> = {}) => ({ type: "text", x: 0, y: 0, w: 4, h: 3, config: {}, ...overrides });

describe("validateDashboardMeta", () => {
  it("applies defaults on create", () => {
    expect(validateDashboardMeta({ name: "  Sprint health " })).toEqual({
      name: "Sprint health",
      description: null,
      visibility: "private",
      visible_roles: [],
      filters: {},
    });
  });

  it("rejects an empty or oversized name", () => {
    expect(() => validateDashboardMeta({ name: "   " })).toThrow(InvalidDashboardError);
    expect(() => validateDashboardMeta({ name: "x".repeat(101) })).toThrow(InvalidDashboardError);
  });

  it("requires roles for role visibility and rejects unknown roles", () => {
    expect(() => validateDashboardMeta({ name: "a", visibility: "role" })).toThrow(/at least one role/);
    expect(() => validateDashboardMeta({ name: "a", visibility: "role", visible_roles: ["Wizard"] })).toThrow(/unknown role/);
    expect(validateDashboardMeta({ name: "a", visibility: "role", visible_roles: ["Admin", "Admin"] }).visible_roles).toEqual(["Admin"]);
  });

  it("only returns the fields sent on a partial update", () => {
    expect(validateDashboardMeta({ name: "Renamed" }, true)).toEqual({ name: "Renamed" });
    expect(validateDashboardMeta({}, true)).toEqual({});
  });
});

describe("validateDashboardFilters", () => {
  it("accepts project scope, date range and refresh interval", () => {
    expect(
      validateDashboardFilters({
        project_ids: [PROJECT_ID, PROJECT_ID],
        date_range: { preset: "custom", start: "2026-01-01", end: "2026-02-01" },
        refresh_interval_seconds: 60,
      })
    ).toEqual({
      project_ids: [PROJECT_ID],
      date_range: { preset: "custom", start: "2026-01-01", end: "2026-02-01" },
      refresh_interval_seconds: 60,
    });
  });

  it("rejects bad ids, inverted or impossible dates, unknown intervals and unknown fields", () => {
    expect(() => validateDashboardFilters({ project_ids: ["nope"] })).toThrow(InvalidDashboardError);
    expect(() => validateDashboardFilters({ date_range: { preset: "custom", start: "2026-02-01", end: "2026-01-01" } })).toThrow(/not be after/);
    expect(() => validateDashboardFilters({ date_range: { preset: "custom", start: "2026-02-31x", end: "2026-03-01" } })).toThrow(InvalidDashboardError);
    expect(() => validateDashboardFilters({ date_range: { preset: "last_7_days", start: "2026-01-01" } })).toThrow(InvalidDashboardError);
    expect(() => validateDashboardFilters({ refresh_interval_seconds: 5 })).toThrow(InvalidDashboardError);
    expect(() => validateDashboardFilters({ extra: 1 })).toThrow(/unknown field/);
  });
});

describe("validateGadgets", () => {
  it("accepts every registered type, including repeats of one type", () => {
    const gadgets = GADGET_TYPES.map((type, i) => gadget({ type, y: i }));
    gadgets.push(gadget({ type: "text", y: 99 }));
    expect(validateGadgets(gadgets)).toHaveLength(GADGET_TYPES.length + 1);
  });

  it("rejects unknown types, including prototype keys", () => {
    expect(() => validateGadgets([gadget({ type: "bogus" })])).toThrow(/unknown gadget type/);
    expect(() => validateGadgets([gadget({ type: "constructor" })])).toThrow(/unknown gadget type/);
  });

  it("keeps gadgets inside the 12-column grid", () => {
    expect(() => validateGadgets([gadget({ x: 10, w: 4 })])).toThrow(/outside the grid/);
    expect(() => validateGadgets([gadget({ w: 0 })])).toThrow(InvalidDashboardError);
    expect(() => validateGadgets([gadget({ h: 61 })])).toThrow(/invalid gadget size/);
    expect(() => validateGadgets([gadget({ x: 1.5 })])).toThrow(InvalidDashboardError);
  });

  it("validates config per type and rejects unknown config fields", () => {
    expect(validateGadgets([gadget({ type: "velocity_chart", config: { project_id: PROJECT_ID, sprint_count: 6 } })])[0].config).toEqual({
      project_id: PROJECT_ID,
      sprint_count: 6,
    });
    expect(() => validateGadgets([gadget({ type: "velocity_chart", config: { project_id: "x" } })])).toThrow(InvalidDashboardError);
    expect(() => validateGadgets([gadget({ type: "velocity_chart", config: { sprint_count: 99 } })])).toThrow(InvalidDashboardError);
  });

  it("validates burndown / burnup gadget config", () => {
    const config = { project_id: PROJECT_ID, metric: "issue_count", include_subtasks: true };
    expect(validateGadgets([gadget({ type: "burndown_chart", config })])[0].config).toEqual(config);
    expect(() => validateGadgets([gadget({ type: "burnup_chart", config: { metric: "hours" } })])).toThrow(InvalidDashboardError);
    expect(() => validateGadgets([gadget({ type: "burnup_chart", config: { include_subtasks: "yes" } })])).toThrow(InvalidDashboardError);
    expect(() => validateGadgets([gadget({ type: "text", config: { url: "http://evil" } })])).toThrow(/unknown field/);
  });

  it("rejects a non-list and an oversized list", () => {
    expect(() => validateGadgets({})).toThrow(InvalidDashboardError);
    expect(() => validateGadgets(Array.from({ length: 41 }, () => gadget()))).toThrow(/too many/);
  });
});

describe("canViewDashboard", () => {
  const owner = { userId: "owner", role: "Owner" };
  const admin = { userId: "other", role: "Admin" };
  const base = { owner_id: "owner", visible_roles: [] as string[] };

  it("always lets the owner in and keeps private dashboards private", () => {
    expect(canViewDashboard({ ...base, visibility: "private" }, owner)).toBe(true);
    expect(canViewDashboard({ ...base, visibility: "private" }, admin)).toBe(false);
  });

  it("honours workspace and role visibility", () => {
    expect(canViewDashboard({ ...base, visibility: "workspace" }, admin)).toBe(true);
    expect(canViewDashboard({ ...base, visibility: "role", visible_roles: ["Admin"] }, admin)).toBe(true);
    expect(canViewDashboard({ ...base, visibility: "role", visible_roles: ["Member"] }, admin)).toBe(false);
  });

  it("opens link dashboards only through their token", () => {
    expect(canViewDashboard({ ...base, visibility: "link" }, admin)).toBe(false);
    expect(canViewDashboard({ ...base, visibility: "link" }, admin, { viaShareToken: true })).toBe(true);
  });
});
