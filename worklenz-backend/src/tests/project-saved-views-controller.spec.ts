jest.unmock("../shared/project-saved-views");

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
    pool: { connect: jest.fn() },
  },
}));

import db from "../config/db";
import ProjectSavedViewsController from "../controllers/project-saved-views-controller";
import { SAVED_VIEW_CONFIG_VERSION, SAVED_VIEWS_PER_PROJECT_LIMIT } from "../shared/project-saved-views";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedConnect = db.connect as jest.Mock;

const PROJECT_ID = "550e8400-e29b-41d4-a716-446655440000";
const USER_ID = "user-123";

const validBody = () => ({
  name: "My view",
  base_view: "tasks-list",
  config: { version: SAVED_VIEW_CONFIG_VERSION },
});

const createRequest = (overrides: Record<string, unknown> = {}) =>
  createMockRequest({
    params: { projectId: PROJECT_ID },
    body: validBody(),
    user: { id: USER_ID, email: "test@worklenz.com", team_id: "team-123", name: "Test User" },
    ...overrides,
  });

const savedViewRow = {
  id: "view-1",
  project_id: PROJECT_ID,
  name: "My view",
  base_view: "tasks-list",
  config: { version: SAVED_VIEW_CONFIG_VERSION },
  sort_order: 49,
  created_by: USER_ID,
  created_by_name: "Test User",
  created_at: "2026-10-21T00:00:00.000Z",
  updated_at: "2026-10-21T00:00:00.000Z",
};

interface CreateScenario {
  projectExists?: boolean;
  viewCount?: number;
  maxOrder?: number;
}

const mockCreateClient = ({
  projectExists = true,
  viewCount = 0,
  maxOrder,
}: CreateScenario = {}) => {
  let currentCount = viewCount;
  const client = {
    release: jest.fn(),
    query: jest.fn().mockImplementation((sql: string) => {
      if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
        return Promise.resolve(createQueryResult([]));
      }
      if (/SELECT id FROM projects WHERE id = \$1 FOR UPDATE/.test(sql)) {
        return Promise.resolve(createQueryResult(projectExists ? [{ id: PROJECT_ID }] : [], projectExists ? 1 : 0));
      }
      if (/COUNT\(\*\)::INT AS total/.test(sql)) {
        return Promise.resolve(
          createQueryResult([
            {
              total: currentCount,
              max_order: maxOrder !== undefined ? maxOrder : currentCount - 1,
            },
          ])
        );
      }
      if (/INSERT INTO project_saved_views/.test(sql)) {
        currentCount += 1;
        return Promise.resolve(createQueryResult([{ ...savedViewRow, sort_order: currentCount - 1 }]));
      }
      return Promise.resolve(createQueryResult([]));
    }),
  };
  mockedConnect.mockResolvedValue(client);
  return { client, getCount: () => currentCount };
};

const sqlStatements = (client: { query: jest.Mock }) =>
  client.query.mock.calls.map(call => call[0] as string);

describe("ProjectSavedViewsController.create", () => {
  beforeEach(() => {
    mockedConnect.mockReset();
  });

  it("rejects an invalid name before touching the database", async () => {
    const res = createMockResponse();
    await ProjectSavedViewsController.create(createRequest({ body: { ...validBody(), name: "  " } }), res);

    expect(res.statusCode).toBe(400);
    expect(mockedConnect).not.toHaveBeenCalled();
  });

  it("locks the project row before counting and inserting", async () => {
    const { client } = mockCreateClient({ viewCount: 0 });
    const res = createMockResponse();
    await ProjectSavedViewsController.create(createRequest(), res);

    expect(res.statusCode).toBe(200);
    const sql = sqlStatements(client);
    expect(sql).toContain("BEGIN");
    expect(sql.some(s => /SELECT id FROM projects WHERE id = \$1 FOR UPDATE/.test(s))).toBe(true);
    expect(sql.some(s => /COUNT\(\*\)::INT AS total/.test(s))).toBe(true);
    expect(sql.some(s => /INSERT INTO project_saved_views/.test(s))).toBe(true);
    expect(sql).toContain("COMMIT");
    expect(client.release).toHaveBeenCalledTimes(1);

    const lockIdx = sql.findIndex(s => /FOR UPDATE/.test(s));
    const countIdx = sql.findIndex(s => /COUNT\(\*\)::INT AS total/.test(s));
    const insertIdx = sql.findIndex(s => /INSERT INTO project_saved_views/.test(s));
    expect(lockIdx).toBeGreaterThan(-1);
    expect(countIdx).toBeGreaterThan(lockIdx);
    expect(insertIdx).toBeGreaterThan(countIdx);
  });

  it("refuses creation when the project already has the limit", async () => {
    const { client } = mockCreateClient({ viewCount: SAVED_VIEWS_PER_PROJECT_LIMIT });
    const res = createMockResponse();
    await ProjectSavedViewsController.create(createRequest(), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.message).toContain(String(SAVED_VIEWS_PER_PROJECT_LIMIT));
    expect(sqlStatements(client).some(s => /INSERT INTO project_saved_views/.test(s))).toBe(false);
    expect(sqlStatements(client)).toContain("ROLLBACK");
  });

  it("returns 404 when the project row is missing", async () => {
    const { client } = mockCreateClient({ projectExists: false });
    const res = createMockResponse();
    await ProjectSavedViewsController.create(createRequest(), res);

    expect(res.statusCode).toBe(404);
    expect(sqlStatements(client).some(s => /INSERT INTO project_saved_views/.test(s))).toBe(false);
    expect(sqlStatements(client)).toContain("ROLLBACK");
  });

  it("serializes concurrent creates at the limit so only one succeeds", async () => {
    let viewCount = SAVED_VIEWS_PER_PROJECT_LIMIT - 1;
    let lockHeld = false;
    let releaseLock: (() => void) | null = null;

    mockedConnect.mockImplementation(async () => {
      const client = {
        release: jest.fn(),
        query: jest.fn().mockImplementation(async (sql: string) => {
          if (sql === "BEGIN") return createQueryResult([]);
          if (/SELECT id FROM projects WHERE id = \$1 FOR UPDATE/.test(sql)) {
            if (lockHeld) {
              await new Promise<void>(resolve => {
                releaseLock = resolve;
              });
            }
            lockHeld = true;
            return createQueryResult([{ id: PROJECT_ID }], 1);
          }
          if (/COUNT\(\*\)::INT AS total/.test(sql)) {
            return createQueryResult([{ total: viewCount, max_order: viewCount - 1 }]);
          }
          if (/INSERT INTO project_saved_views/.test(sql)) {
            viewCount += 1;
            return createQueryResult([{ ...savedViewRow, sort_order: viewCount - 1 }]);
          }
          if (sql === "COMMIT" || sql === "ROLLBACK") {
            lockHeld = false;
            const waiter = releaseLock;
            releaseLock = null;
            waiter?.();
            return createQueryResult([]);
          }
          return createQueryResult([]);
        }),
      };
      return client;
    });

    const res1 = createMockResponse();
    const res2 = createMockResponse();
    const first = ProjectSavedViewsController.create(createRequest(), res1);
    // Let the first request acquire the project lock before starting the second.
    await Promise.resolve();
    await Promise.resolve();
    const second = ProjectSavedViewsController.create(createRequest(), res2);

    await Promise.all([first, second]);

    const statuses = [res1.statusCode, res2.statusCode].sort();
    expect(statuses).toEqual([200, 400]);
    expect(viewCount).toBe(SAVED_VIEWS_PER_PROJECT_LIMIT);
  });
});
