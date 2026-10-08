import AuditLogController from "../controllers/audit-log-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

const AUDIT_ROW = {
  id: "evt-1",
  created_at: "2026-10-01T10:00:00.000Z",
  actor_user_id: "user-1",
  actor_name: "Ruwan Perera",
  category: "lifecycle",
  event_type: "project_created",
  description: 'Created project "Fraud Detection Rules Engine"',
  old_value: null,
  new_value: null,
  team_id: "team-1",
  total: "1",
};

describe("AuditLogController.getAuditEvents", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.query as jest.Mock).mockResolvedValue({ rows: [AUDIT_ROW] });
  });

  it("returns 200 with an empty org error when organization_id is missing from the session", async () => {
    const req = createMockRequest({ user: { id: "user-1" } });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });

  it("scopes the query to organization_id and orders newest-first with no filters", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1", team_id: "team-1" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("organization_id = $1");
    expect(sql).toContain("ORDER BY created_at DESC, id DESC");
    expect(params[0]).toBe("org-1");

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
    expect(res.body.body.total).toBe(1);
    expect(res.body.body.data).toEqual([
      {
        id: "evt-1",
        created_at: "2026-10-01T10:00:00.000Z",
        actor_user_id: "user-1",
        actor_name: "Ruwan Perera",
        category: "lifecycle",
        event_type: "project_created",
        description: 'Created project "Fraud Detection Rules Engine"',
        old_value: null,
        new_value: null,
        team_id: "team-1",
        actor_in_workspace: false,
      },
    ]);
  });

  it("applies pagination from index/size query params", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { index: "3", size: "10" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("LIMIT");
    expect(sql).toContain("OFFSET");
    // index 3, size 10 -> offset 20
    expect(params).toEqual(expect.arrayContaining(["org-1", 10, 20]));
  });

  it("caps an oversized page size at 200", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { size: "999999" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [, params] = (db.query as jest.Mock).mock.calls[0];
    expect(params).toContain(200);
  });

  it("adds a date-range condition only for the params actually provided", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { start_date: "2026-09-01", end_date: "2026-09-30" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("created_at >= $2::DATE");
    expect(sql).toContain("created_at < ($3::DATE + INTERVAL '1 day')");
    expect(params).toEqual(expect.arrayContaining(["2026-09-01", "2026-09-30"]));
  });

  it("filters by a comma-separated multi-category list, dropping unknown categories", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { category: "access,user,not-a-real-category" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("category = ANY($2::TEXT[])");
    expect(params[1]).toEqual(["access", "user"]);
  });

  it("ignores the category filter entirely when every value is invalid", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { category: "bogus" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).not.toContain("category = ANY");
  });

  it("filters by a comma-separated multi-actor list", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { actor_user_id: "user-1,user-2" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("actor_user_id = ANY($2::UUID[])");
    expect(params[1]).toEqual(["user-1", "user-2"]);
  });

  it("searches description and actor_name with a wildcard ILIKE pattern", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { search: "fraud" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("description ILIKE $2");
    expect(sql).toContain("actor_name ILIKE $3");
    expect(params).toEqual(expect.arrayContaining(["%fraud%"]));
  });

  it("also matches against event type labels when the search term matches one (task 4.3)", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { search: "login" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("event_type = ANY($4::TEXT[])");
    const eventTypeParam = params[3];
    expect(eventTypeParam).toEqual(expect.arrayContaining(["login_success", "login_failed"]));
  });

  it("omits the event-type clause when the search term matches no catalogued label", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { search: "xyz-no-match" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).not.toContain("event_type = ANY");
  });

  it("combines date range, category, actor, and search filters together", async () => {
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: {
        start_date: "2026-09-01",
        end_date: "2026-09-30",
        category: "lifecycle",
        actor_user_id: "user-1",
        search: "fraud",
      },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("organization_id = $1");
    expect(sql).toContain("created_at >= $2::DATE");
    expect(sql).toContain("created_at < ($3::DATE + INTERVAL '1 day')");
    expect(sql).toContain("category = ANY($4::TEXT[])");
    expect(sql).toContain("actor_user_id = ANY($5::UUID[])");
    expect(sql).toContain("description ILIKE $6");
    expect(params[0]).toBe("org-1");
  });

  it("returns total = 0 and an empty array when nothing matches", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
    });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    expect(res.body.body).toEqual({ total: 0, data: [] });
  });
});

describe("AuditLogController.getAuditEvents actor_in_workspace", () => {
  beforeEach(() => jest.clearAllMocks());

  it("flags actors who are no longer members of any team in the organization", async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [
        { ...AUDIT_ROW, id: "evt-1", actor_in_workspace: true },
        { ...AUDIT_ROW, id: "evt-2", actor_in_workspace: false },
      ],
    });
    const req = createMockRequest({ user: { id: "user-1", organization_id: "org-1" } });
    const res = createMockResponse();

    await AuditLogController.getAuditEvents(req, res);

    const [sql] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toMatch(/tm\.user_id = audit_events\.actor_user_id/);
    expect(sql).toMatch(/o\.id = audit_events\.organization_id/);
    expect(res.body.body.data.map((row: { actor_in_workspace: boolean }) => row.actor_in_workspace)).toEqual([
      true,
      false,
    ]);
  });
});

describe("AuditLogController.getSummary", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns per-category counts, the overall total, and failed logins", async () => {
    (db.query as jest.Mock).mockResolvedValue({
      rows: [
        { category: "access", total: "5", failed_logins: "2" },
        { category: "permission", total: "3", failed_logins: "0" },
      ],
    });
    const req = createMockRequest({ user: { id: "user-1", organization_id: "org-1" } });
    const res = createMockResponse();

    await AuditLogController.getSummary(req, res);

    expect(res.body.done).toBe(true);
    expect(res.body.body).toEqual({
      total: 8,
      failed_logins: 2,
      by_category: { access: 5, user: 0, permission: 3, lifecycle: 0 },
    });
  });

  it("applies date, actor and search filters but never the category filter", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const req = createMockRequest({
      user: { id: "user-1", organization_id: "org-1" },
      query: { start_date: "2026-09-01", category: "access", actor_user_id: "user-9", search: "role" },
    });
    const res = createMockResponse();

    await AuditLogController.getSummary(req, res);

    const [sql, params] = (db.query as jest.Mock).mock.calls[0];
    expect(sql).toContain("created_at >= $2::DATE");
    expect(sql).toContain("actor_user_id = ANY($3::UUID[])");
    expect(sql).toContain("description ILIKE $4");
    expect(sql).not.toContain("category = ANY");
    expect(sql).toContain("GROUP BY category");
    expect(params[params.length - 1]).toBe("login_failed");
  });

  it("returns zeroed counts when nothing matches", async () => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const req = createMockRequest({ user: { id: "user-1", organization_id: "org-1" } });
    const res = createMockResponse();

    await AuditLogController.getSummary(req, res);

    expect(res.body.body).toEqual({
      total: 0,
      failed_logins: 0,
      by_category: { access: 0, user: 0, permission: 0, lifecycle: 0 },
    });
  });

  it("fails without querying when the session has no organization", async () => {
    const req = createMockRequest({ user: { id: "user-1" } });
    const res = createMockResponse();

    await AuditLogController.getSummary(req, res);

    expect(res.body.done).toBe(false);
    expect(db.query).not.toHaveBeenCalled();
  });
});
