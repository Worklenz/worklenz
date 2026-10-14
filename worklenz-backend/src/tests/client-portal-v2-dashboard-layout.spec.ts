import {
  DASHBOARD_WIDGET_TYPES,
  getDashboardLayout,
  resetDashboardLayout,
  saveDashboardLayout,
  validateDashboardLayout,
} from "../services/client-portal-v2/dashboard-layout.service";
import type { ClientSubject } from "../services/client-portal-v2/subject";
import { createQueryResult } from "./utils/db-mock";

const query = jest.fn();
const q = { query } as any;

const subject = (role: ClientSubject["role"] = "admin", contactId = "alex"): ClientSubject => ({
  contactId,
  clientId: "client-1",
  teamId: "team-1",
  role,
  name: "Alex Chen",
  email: "alex@brandbase.com",
  clientUserId: "login-1",
});

const PROJECT_ID = "11111111-1111-4111-8111-111111111111";

const widget = (overrides: Record<string, unknown> = {}) => ({ type: "needs-action", x: 0, y: 0, w: 6, h: 9, hidden: false, ...overrides });
const projectsWidget = (settings: unknown) => widget({ type: "projects", w: 12, h: 10, settings });
const layoutOf = (...widgets: unknown[]) => ({ version: 1, widgets });
const SETTINGS = { projectIds: "all", cardFields: ["status", "progress"], view: "cards" };

const expectInvalid = (input: unknown) => expect(() => validateDashboardLayout(input)).toThrow(expect.objectContaining({ status: 400, code: "INVALID_LAYOUT" }));

beforeEach(() => {
  query.mockReset();
  query.mockResolvedValue(createQueryResult([]));
});

describe("validateDashboardLayout", () => {
  it("accepts every known widget with in-grid geometry", () => {
    const widgets = DASHBOARD_WIDGET_TYPES.map((type, index) =>
      type === "projects" ? projectsWidget(SETTINGS) : widget({ type, y: index * 3, w: 3, h: 3 })
    );
    expect(validateDashboardLayout(layoutOf(...widgets)).widgets).toHaveLength(DASHBOARD_WIDGET_TYPES.length);
  });

  it("rejects a missing, wrongly versioned or non-list layout", () => {
    expectInvalid(null);
    expectInvalid({ version: 2, widgets: [] });
    expectInvalid({ version: 1, widgets: "nope" });
  });

  it("rejects unknown and duplicate widgets and too many widgets", () => {
    expectInvalid(layoutOf(widget({ type: "made-up" })));
    expectInvalid(layoutOf(widget(), widget()));
    expectInvalid({ version: 1, widgets: Array.from({ length: 31 }, () => widget()) });
  });

  it.each([
    ["negative x", { x: -1 }],
    ["wider than the grid", { w: 13 }],
    ["overflowing the right edge", { x: 8, w: 6 }],
    ["fractional height", { h: 2.5 }],
    ["zero height", { h: 0 }],
    ["absurd row", { y: 1_000_000 }],
    ["string width", { w: "6" }],
    ["missing hidden flag", { hidden: undefined }],
  ])("rejects geometry that is %s", (_name, override) => {
    expectInvalid(layoutOf(widget(override)));
  });

  it("requires well-formed settings on the projects widget and keeps only known keys", () => {
    expectInvalid(layoutOf(widget({ type: "projects", w: 12, h: 10 })));
    expectInvalid(layoutOf(projectsWidget({ ...SETTINGS, projectIds: "some" })));
    expectInvalid(layoutOf(projectsWidget({ ...SETTINGS, projectIds: ["not-a-uuid"] })));
    expectInvalid(layoutOf(projectsWidget({ ...SETTINGS, cardFields: ["status", "secrets"] })));
    expectInvalid(layoutOf(projectsWidget({ ...SETTINGS, view: "table" })));
    expectInvalid(layoutOf(projectsWidget({ ...SETTINGS, projectIds: Array.from({ length: 201 }, () => PROJECT_ID) })));
  });

  it("dedupes project ids and card fields, and drops settings on other widgets", () => {
    const result = validateDashboardLayout(
      layoutOf(
        projectsWidget({ projectIds: [PROJECT_ID, PROJECT_ID], cardFields: ["status", "status"], view: "compact" }),
        widget({ settings: { anything: true } })
      )
    );
    expect(result.widgets[0].settings).toEqual({ projectIds: [PROJECT_ID], cardFields: ["status"], view: "compact" });
    expect(result.widgets[1]).not.toHaveProperty("settings");
  });
});

describe("getDashboardLayout", () => {
  it("returns null when the person never customised", async () => {
    await expect(getDashboardLayout(q, subject())).resolves.toEqual({ layout: null });
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/WHERE contact_id = \$1/), ["alex"]);
  });

  it("returns the saved layout for this person only", async () => {
    const saved = layoutOf(widget());
    query.mockResolvedValue(createQueryResult([{ layout: saved, version: 1 }]));
    await expect(getDashboardLayout(q, subject("viewer", "sam"))).resolves.toEqual({ layout: saved });
    expect(query.mock.calls[0][1]).toEqual(["sam"]);
  });

  it("ignores a layout written by a newer version", async () => {
    query.mockResolvedValue(createQueryResult([{ layout: layoutOf(widget()), version: 99 }]));
    await expect(getDashboardLayout(q, subject())).resolves.toEqual({ layout: null });
  });
});

describe("saveDashboardLayout", () => {
  it.each(["admin", "member", "viewer"] as const)("lets a %s save their own layout, keyed by contact", async role => {
    const layout = layoutOf(widget(), projectsWidget(SETTINGS));
    await expect(saveDashboardLayout(q, subject(role, `${role}-contact`), layout)).resolves.toEqual({ layout });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toMatch(/INSERT INTO client_portal_dashboard_layouts[\s\S]+ON CONFLICT \(contact_id\) DO UPDATE/);
    expect(params[0]).toBe(`${role}-contact`);
    expect(JSON.parse(params[1])).toEqual(layout);
    expect(params[2]).toBe(1);
  });

  it("writes nothing when the layout is invalid", async () => {
    await expect(saveDashboardLayout(q, subject(), layoutOf(widget({ type: "made-up" })))).rejects.toMatchObject({ status: 400 });
    expect(query).not.toHaveBeenCalled();
  });
});

describe("resetDashboardLayout", () => {
  it("deletes only this person's row", async () => {
    await expect(resetDashboardLayout(q, subject())).resolves.toEqual({ layout: null });
    expect(query).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM client_portal_dashboard_layouts WHERE contact_id = \$1/), ["alex"]);
  });
});
