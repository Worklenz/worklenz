jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn(), connect: jest.fn() },
}));

import db from "../config/db";
import i18next from "../config/i18n";
import { IPassportSession } from "../interfaces/passport-session";
import {
  ANALYTICS_REPORT_KINDS,
  MAX_ANALYTICS_TEMPLATES_PER_USER,
  MAX_WORKSPACE_ANALYTICS_TEMPLATES,
  MAX_VELOCITY_TEMPLATES_PER_USER,
  MAX_WORKSPACE_VELOCITY_TEMPLATES,
  TEMPLATE_FILTERS_MAX_BYTES,
} from "../shared/reporting-analytics.constants";
import {
  createTemplate,
  listTemplates,
  setTemplateShare,
} from "../services/reporting-analytics/analytics-templates.service";

const user: IPassportSession = { id: "user", team_id: "team", owner: true };
const row = {
  id: "template", team_id: "team", owner_id: "user", report_kind: "velocity",
  name: "Saved", is_workspace_shared: false, is_default: false,
  filters_json: {}, created_at: "2026-11-02", updated_at: "2026-11-02",
};
const query = jest.fn();
const release = jest.fn();
let ownerCount = { count: 0, total_count: 0 };
let sharedCount = { count: 0, total_count: 0 };

beforeAll(async () => {
  await i18next.init({ lng: "en", resources: {} });
});

beforeEach(() => {
  ownerCount = { count: 0, total_count: 0 };
  sharedCount = { count: 0, total_count: 0 };
  (db.connect as jest.Mock).mockResolvedValue({ query, release });
  (db.query as jest.Mock).mockResolvedValue({ rows: [row] });
  query.mockImplementation(async (sql: string, params?: unknown[]) => {
    if (sql.includes("COUNT(*)")) {
      return { rows: [sql.includes("owner_id =") ? ownerCount : sharedCount] };
    }
    if (sql.includes("INSERT INTO")) {
      return { rows: [{ ...row, report_kind: params?.[2], filters_json: JSON.parse(String(params?.[6])) }] };
    }
    return { rows: [row] };
  });
});

it.each(["invented", "all", "", "VELOCITY", 123, {}, ["velocity"]])(
  "rejects unsupported report kind %p before database access", async reportKind => {
    await expect(createTemplate(user, { name: "Saved", reportKind: reportKind as string }))
      .rejects.toMatchObject({ statusCode: 400, message: "Unsupported report kind" });
    expect(db.connect).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  }
);

it.each(ANALYTICS_REPORT_KINDS)("accepts catalogue report %s", async reportKind => {
  const result = await createTemplate(user, { name: "Saved", reportKind, filters: { projects: ["one"] } });
  expect(result.report_kind).toBe(reportKind);
  expect(result.filters_json).toEqual({ projects: ["one"] });
  expect(query).toHaveBeenLastCalledWith("COMMIT");
  expect(release).toHaveBeenCalledTimes(1);
});

it("defaults omitted report kind and filters to velocity and an empty object", async () => {
  expect(await createTemplate(user, { name: " Saved " })).toMatchObject({ report_kind: "velocity", filters_json: {} });
});

it("accepts exactly the serialized byte limit", async () => {
  const filters = { value: "x".repeat(TEMPLATE_FILTERS_MAX_BYTES - Buffer.byteLength(JSON.stringify({ value: "" }))) };
  expect((await createTemplate(user, { name: "Saved", filters })).filters_json).toEqual(filters);
});

it.each(["x", "界"])("rejects oversized serialized filters using UTF-8 bytes (%s)", async character => {
  const filters = { value: character.repeat(Math.floor(TEMPLATE_FILTERS_MAX_BYTES / Buffer.byteLength(character))) };
  await expect(createTemplate(user, { name: "Saved", filters, isDefault: true }))
    .rejects.toMatchObject({ statusCode: 400 });
  expect(db.connect).not.toHaveBeenCalled();
});

it.each([[], "text", 42])("rejects non-object filters %p", async filters => {
  await expect(createTemplate(user, { name: "Saved", filters: filters as unknown as Record<string, unknown> }))
    .rejects.toMatchObject({ statusCode: 400 });
  expect(db.connect).not.toHaveBeenCalled();
});

it.each(["kind", "total"])("enforces the owner %s quota before clearing defaults or inserting", async quota => {
  ownerCount = quota === "kind"
    ? { count: MAX_VELOCITY_TEMPLATES_PER_USER, total_count: MAX_VELOCITY_TEMPLATES_PER_USER }
    : { count: 0, total_count: MAX_ANALYTICS_TEMPLATES_PER_USER };
  await expect(createTemplate(user, { name: "Saved", isDefault: true })).rejects.toMatchObject({ statusCode: 400 });
  expect(query.mock.calls.some(([sql]) => /INSERT|UPDATE/.test(sql))).toBe(false);
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(release).toHaveBeenCalledTimes(1);
});

it.each(["create", "share"])("enforces aggregate and per-kind shared quotas on %s", async operation => {
  for (const counts of [
    { count: 0, total_count: MAX_WORKSPACE_ANALYTICS_TEMPLATES },
    { count: MAX_WORKSPACE_VELOCITY_TEMPLATES, total_count: MAX_WORKSPACE_VELOCITY_TEMPLATES },
  ]) {
    query.mockClear();
    sharedCount = counts;
    const action = operation === "create"
      ? createTemplate(user, { name: "Saved", isWorkspaceShared: true })
      : setTemplateShare(user, "template", true);
    await expect(action).rejects.toMatchObject({ statusCode: 400 });
    expect(query.mock.calls.some(([sql]) => /INSERT|UPDATE/.test(sql))).toBe(false);
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  }
});

it("allows unsharing even at the workspace quota", async () => {
  sharedCount.total_count = MAX_WORKSPACE_ANALYTICS_TEMPLATES;
  await expect(setTemplateShare(user, "template", false)).resolves.toMatchObject({ id: "template" });
  expect(query).toHaveBeenLastCalledWith("COMMIT");
});

it("locks the team before checking counts and writing", async () => {
  await createTemplate(user, { name: "Saved", isWorkspaceShared: true });
  expect(query.mock.calls[0]).toEqual(["BEGIN"]);
  expect(query.mock.calls[1]).toEqual([
    "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))", ["analytics-template-quota:team"],
  ]);
  expect(query.mock.calls[2][0]).toContain("COUNT(*)");
});

it("rolls back and releases the connection when an insert fails", async () => {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("INSERT INTO")) throw new Error("write failed");
    return { rows: [{ count: 0, total_count: 0 }] };
  });
  await expect(createTemplate(user, { name: "Saved", isDefault: true })).rejects.toThrow("write failed");
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(release).toHaveBeenCalledTimes(1);
});

it("preserves listing all saved reports", async () => {
  await expect(listTemplates("team", "user", "all")).resolves.toHaveLength(1);
  expect(db.query).toHaveBeenCalledWith(expect.not.stringContaining("t.report_kind ="), ["team", "user"]);
});

it("allows creation just below both owner and shared limits", async () => {
  ownerCount = { count: MAX_VELOCITY_TEMPLATES_PER_USER - 1, total_count: MAX_ANALYTICS_TEMPLATES_PER_USER - 1 };
  sharedCount = { count: MAX_WORKSPACE_VELOCITY_TEMPLATES - 1, total_count: MAX_WORKSPACE_ANALYTICS_TEMPLATES - 1 };
  await expect(createTemplate(user, { name: "Saved", isWorkspaceShared: true, isDefault: true }))
    .resolves.toMatchObject({ id: "template" });
  expect(query.mock.calls.some(([sql]) => sql.includes("SET is_default = FALSE"))).toBe(true);
});

it("preserves sharing authorization for members", async () => {
  await expect(createTemplate({ ...user, owner: false, role_name: "Member" }, {
    name: "Saved", isWorkspaceShared: true,
  })).rejects.toMatchObject({ statusCode: 403 });
  expect(db.connect).not.toHaveBeenCalled();
});
