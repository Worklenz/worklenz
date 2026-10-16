// jest.config.js sets automock: true repo-wide - unmock the pure helpers the controller relies on so
// the real SQL fragments and limits are used.
jest.unmock("../shared/home-pins");
jest.unmock("../shared/home-task-query-builder");
jest.unmock("../shared/validation-helpers");
jest.unmock("../shared/home-preferences");

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    pool: { connect: jest.fn() },
  },
}));

jest.mock("../shared/io", () => ({
  __esModule: true,
  IO: {},
}));

// Not under test: the assignee-scope SQL has its own coverage.
jest.mock("../shared/assignee-task-scope", () => ({
  __esModule: true,
  buildMultiProjectAssigneeScopeClause: jest.fn().mockReturnValue(""),
  isAssigneeScopeSessionExempt: jest.fn().mockReturnValue(true),
}));

import db from "../config/db";
import HomePageController from "../controllers/home-page-controller";
import HomePreferencesController from "../controllers/home-preferences-controller";
import { DEFAULT_HOME_PREFERENCES } from "../shared/home-preferences";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;
const mockedConnect = (db as any).pool.connect as jest.Mock;

const TASK_ID = "550e8400-e29b-41d4-a716-446655440000";
const PINNED_AT = "2026-10-03T08:00:00.000Z";

interface PinScenario {
  visible?: boolean;
  alreadyPinnedAt?: string | null;
  visiblePinCount?: number;
}

// Answers the pin endpoint's queries by what they are, not by call order, so the test does not
// break if a harmless query is added.
const mockPinClient = ({ visible = true, alreadyPinnedAt = null, visiblePinCount = 0 }: PinScenario = {}) => {
  const client = {
    release: jest.fn(),
    query: jest.fn().mockImplementation((sql: string) => {
      if (/FROM tasks t\s+JOIN projects p/.test(sql) && /SELECT t\.id/.test(sql)) {
        return Promise.resolve(createQueryResult(visible ? [{ id: TASK_ID }] : []));
      }
      if (/SELECT pinned_at FROM user_pinned_tasks/.test(sql)) {
        return Promise.resolve(createQueryResult(alreadyPinnedAt ? [{ pinned_at: alreadyPinnedAt }] : []));
      }
      if (/COUNT\(\*\)::INT AS count/.test(sql)) {
        return Promise.resolve(createQueryResult([{ count: visiblePinCount }]));
      }
      if (/INSERT INTO user_pinned_tasks/.test(sql)) {
        return Promise.resolve(createQueryResult([{ pinned_at: PINNED_AT }]));
      }
      return Promise.resolve(createQueryResult([]));
    }),
  };
  mockedConnect.mockResolvedValue(client);
  return client;
};

const sqlStatements = (client: { query: jest.Mock }) => client.query.mock.calls.map(call => call[0] as string);
const ranInsert = (client: { query: jest.Mock }) => sqlStatements(client).some(sql => /INSERT INTO user_pinned_tasks/.test(sql));

describe("HomePageController.pinTask", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
    mockedConnect.mockReset();
  });

  it("rejects a malformed task id before touching the database", async () => {
    const res = createMockResponse();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: "not-a-uuid" } }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("pins a visible task and returns when it was pinned", async () => {
    const client = mockPinClient();
    const res = createMockResponse();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body).toEqual({ task_id: TASK_ID, is_pinned: true, pinned_at: PINNED_AT });
    expect(ranInsert(client)).toBe(true);
    expect(sqlStatements(client)).toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("locks per user, so two quick clicks cannot both pass the limit check", async () => {
    const client = mockPinClient();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), createMockResponse());

    const lock = client.query.mock.calls.find(call => /pg_advisory_xact_lock/.test(call[0]));
    expect(lock?.[1]).toEqual(["home-pins:user-123"]);
  });

  it("locks the task row while checking visibility, so a concurrent completion cannot leave a stale pin", async () => {
    const client = mockPinClient();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), createMockResponse());

    const visibility = client.query.mock.calls.find(
      call => /FROM tasks t\s+JOIN projects p/.test(call[0]) && /SELECT t\.id/.test(call[0])
    );
    expect(visibility?.[0]).toMatch(/FOR SHARE OF t\s*$/);
  });

  it("returns 404 for a task the user cannot see, and pins nothing", async () => {
    const client = mockPinClient({ visible: false });
    const res = createMockResponse();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);

    expect(res.statusCode).toBe(404);
    expect(ranInsert(client)).toBe(false);
    expect(sqlStatements(client)).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it("decides visibility with the list's own rules: team, not archived, not done, either assignee group", async () => {
    const client = mockPinClient();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), createMockResponse());

    const visibility = sqlStatements(client).find(sql => /SELECT t\.id/.test(sql)) as string;
    expect(visibility).toMatch(/t\.archived IS FALSE/);
    expect(visibility).toMatch(/p\.team_id = \$1/);
    expect(visibility).toMatch(/archived_projects/);
    expect(visibility).toMatch(/is_done IS FALSE/);
    // "Either assignee group": assigned to me OR assigned by me.
    expect(visibility).toMatch(/team_member_id = \(SELECT id FROM team_members/);
    expect(visibility).toMatch(/assigned_by = \$2/);
  });

  it("is idempotent: an already-pinned task keeps its original pin time and is not inserted again", async () => {
    const client = mockPinClient({ alreadyPinnedAt: "2026-01-01T00:00:00.000Z", visiblePinCount: 25 });
    const res = createMockResponse();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body.pinned_at).toBe("2026-01-01T00:00:00.000Z");
    expect(ranInsert(client)).toBe(false);
  });

  it("refuses the 26th pin with 409 and a code the client can recognise", async () => {
    const client = mockPinClient({ visiblePinCount: 25 });
    const res = createMockResponse();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);

    expect(res.statusCode).toBe(409);
    expect(res.body.done).toBe(false);
    expect(res.body.body).toEqual({ code: "PIN_LIMIT_REACHED", limit: 25 });
    expect(ranInsert(client)).toBe(false);
    expect(sqlStatements(client)).toContain("ROLLBACK");
  });

  it("allows the 25th pin", async () => {
    const client = mockPinClient({ visiblePinCount: 24 });
    const res = createMockResponse();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);

    expect(res.statusCode).toBe(200);
    expect(ranInsert(client)).toBe(true);
  });

  it("counts only pins on tasks the user can still see, so stale pins do not use up the limit", async () => {
    const client = mockPinClient();
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), createMockResponse());

    const count = sqlStatements(client).find(sql => /COUNT\(\*\)::INT AS count/.test(sql)) as string;
    expect(count).toMatch(/FROM user_pinned_tasks upt/);
    expect(count).toMatch(/upt\.user_id = \$2/);
    expect(count).toMatch(/t\.archived IS FALSE/);
    expect(count).toMatch(/assigned_by = \$2/);
  });

  it("rolls back and releases the connection when a query fails", async () => {
    const client = mockPinClient();
    client.query.mockImplementation((sql: string) =>
      /SELECT t\.id/.test(sql) ? Promise.reject(new Error("boom")) : Promise.resolve(createQueryResult([]))
    );
    await HomePageController.pinTask(createMockRequest({ params: { taskId: TASK_ID } }), createMockResponse());

    expect(sqlStatements(client)).toContain("ROLLBACK");
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});

describe("HomePageController.unpinTask", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("removes only the caller's own pin, whatever the task's visibility", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([], 1));
    const res = createMockResponse();
    await HomePageController.unpinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body).toEqual({ task_id: TASK_ID, is_pinned: false });
    expect(mockedQuery).toHaveBeenCalledWith(expect.stringMatching(/DELETE FROM user_pinned_tasks WHERE user_id = \$1 AND task_id = \$2/), [
      "user-123",
      TASK_ID,
    ]);
  });

  it("succeeds when the task was not pinned", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([], 0));
    const res = createMockResponse();
    await HomePageController.unpinTask(createMockRequest({ params: { taskId: TASK_ID } }), res);
    expect(res.statusCode).toBe(200);
  });

  it("rejects a malformed task id", async () => {
    const res = createMockResponse();
    await HomePageController.unpinTask(createMockRequest({ params: { taskId: "nope" } }), res);
    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

// createMockResponse has no res.set(), which getPreferences uses for Cache-Control.
const createResponseWithHeaders = () => {
  const res = createMockResponse();
  res.set = jest.fn();
  return res;
};

describe("HomePreferencesController", () => {
  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("returns the defaults for a user who has never saved", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const res = createResponseWithHeaders();
    await HomePreferencesController.getPreferences(createMockRequest(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body.body.preferences).toEqual(DEFAULT_HOME_PREFERENCES);
    expect(res.body.body.updated_at).toBeNull();
    expect(mockedQuery).toHaveBeenCalledWith(expect.stringMatching(/WHERE user_id = \$1/), ["user-123"]);
  });

  it("returns the stored document", async () => {
    const stored = JSON.parse(JSON.stringify(DEFAULT_HOME_PREFERENCES));
    stored.selections.period = "week";
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ preferences: stored, updated_at: PINNED_AT }]));
    const res = createResponseWithHeaders();
    await HomePreferencesController.getPreferences(createMockRequest(), res);

    expect(res.body.body.preferences.selections.period).toBe("week");
    expect(res.body.body.updated_at).toBe(PINNED_AT);
  });

  it("falls back to the defaults when the stored document no longer validates", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ preferences: { version: 99 }, updated_at: PINNED_AT }]));
    const res = createResponseWithHeaders();
    await HomePreferencesController.getPreferences(createMockRequest(), res);

    expect(res.body.body.preferences).toEqual(DEFAULT_HOME_PREFERENCES);
  });

  it("saves a valid document for the caller only", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ updated_at: PINNED_AT }]));
    const res = createMockResponse();
    await HomePreferencesController.updatePreferences(
      createMockRequest({ body: JSON.parse(JSON.stringify(DEFAULT_HOME_PREFERENCES)) }),
      res
    );

    expect(res.statusCode).toBe(200);
    const [sql, params] = mockedQuery.mock.calls[0];
    expect(sql).toMatch(/ON CONFLICT \(user_id\) DO UPDATE/);
    expect(params[0]).toBe("user-123");
    expect(JSON.parse(params[1])).toEqual(DEFAULT_HOME_PREFERENCES);
  });

  it("rejects an invalid document with 400 and writes nothing", async () => {
    const res = createMockResponse();
    await HomePreferencesController.updatePreferences(
      createMockRequest({ body: { ...DEFAULT_HOME_PREFERENCES, version: 7 } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(res.body.done).toBe(false);
    expect(mockedQuery).not.toHaveBeenCalled();
  });

  it("never writes fields the validator does not know about", async () => {
    const res = createMockResponse();
    await HomePreferencesController.updatePreferences(
      createMockRequest({ body: { ...DEFAULT_HOME_PREFERENCES, isAdmin: true } }),
      res
    );

    expect(res.statusCode).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe("HomePageController.getTasks with pins", () => {
  const countRow = { total: 0, today: 0, upcoming: 0, overdue: 0, no_due_date: 0, in_progress: 0 };

  const run = async (query: Record<string, string>) => {
    mockedQuery.mockReset();
    mockedQuery.mockImplementation((sql: string) =>
      Promise.resolve(createQueryResult(/COUNT\(\*\) AS total/.test(sql) ? [countRow] : []))
    );
    const res = createResponseWithHeaders();
    await HomePageController.getTasks(createMockRequest({ query }), res);
    const calls = mockedQuery.mock.calls as [string, unknown[]][];
    const list = calls.find(([sql]) => !/COUNT\(\*\) AS total/.test(sql)) as [string, unknown[]];
    const counts = calls.find(([sql]) => /COUNT\(\*\) AS total/.test(sql)) as [string, unknown[]];
    return { res, list, counts };
  };

  // Every $N in the SQL must have a parameter, and every parameter must be used.
  const expectPlaceholdersMatchParams = ([sql, params]: [string, unknown[]]) => {
    const used = (sql.match(/\$(\d+)/g) ?? []).map(match => Number(match.slice(1)));
    expect(Math.max(...used)).toBe(params.length);
    for (let i = 1; i <= params.length; i++) expect(used).toContain(i);
  };

  it("the Pinned tab lists only pins, newest pin first, and counts the same set", async () => {
    const { res, list, counts } = await run({ current_tab: "Pinned", index: "1", size: "10" });

    expect(res.statusCode).toBe(200);
    expect(list[0]).toMatch(/LEFT JOIN user_pinned_tasks upt ON upt\.task_id = t\.id AND upt\.user_id = \$2/);
    expect(list[0]).toMatch(/AND upt\.id IS NOT NULL/);
    expect(list[0]).toMatch(/ORDER BY upt\.pinned_at DESC, t\.id ASC/);
    expect(list[0]).toMatch(/\(upt\.id IS NOT NULL\) AS is_pinned/);
    // The total behind the pagination uses the same join and predicate, so pages line up with rows.
    expect(counts[0]).toMatch(/LEFT JOIN user_pinned_tasks upt/);
    expect(counts[0]).toMatch(/AND upt\.id IS NOT NULL/);
    expectPlaceholdersMatchParams(list);
    expectPlaceholdersMatchParams(counts);
  });

  it("another tab keeps its own filter and puts the user's pins first inside it", async () => {
    const { list, counts } = await run({
      current_tab: "Overdue",
      index: "1",
      size: "10",
      sort_field: "priority",
      pin_first: "true",
    });

    expect(list[0]).toMatch(/NOT is_completed\(t\.status_id, t\.project_id\)/);
    expect(list[0]).not.toMatch(/AND upt\.id IS NOT NULL/);
    expect(list[0]).toMatch(/ORDER BY \(upt\.id IS NULL\) ASC, upt\.pinned_at DESC NULLS LAST, tp\.value ASC NULLS LAST, t\.id ASC/);
    expect(counts[0]).not.toMatch(/AND upt\.id IS NOT NULL/);
    expectPlaceholdersMatchParams(list);
    expectPlaceholdersMatchParams(counts);
  });

  it("leaves the order alone for callers that do not show pins, such as My Tasks", async () => {
    const { list } = await run({ current_tab: "Overdue", index: "1", size: "10", sort_field: "priority" });

    expect(list[0]).toMatch(/ORDER BY tp\.value ASC NULLS LAST, t\.id ASC/);
    expect(list[0]).not.toMatch(/ORDER BY \(upt\.id IS NULL\)/);
    expectPlaceholdersMatchParams(list);
  });

  it("keeps placeholders and parameters aligned when filters and pagination are also in play", async () => {
    const projectId = "550e8400-e29b-41d4-a716-446655440000";
    const { list, counts } = await run({
      current_tab: "Pinned",
      index: "2",
      size: "5",
      project_ids: projectId,
      search: "report",
    });

    expectPlaceholdersMatchParams(list);
    expectPlaceholdersMatchParams(counts);
  });

  it("an unknown tab still falls back to All", async () => {
    const { list } = await run({ current_tab: "Bogus", index: "1", size: "10" });
    expect(list[0]).not.toMatch(/AND upt\.id IS NOT NULL/);
  });
});
