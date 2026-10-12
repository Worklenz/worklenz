/**
 * Authorization for the custom-columns API:
 * - POST /custom-columns   → requireProjectPermission("customColumns", ...)
 * - PUT/DELETE /:id        → requireCustomColumnPermission("customColumns")
 */

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from "../config/db";
import {
  ProjectIdSource,
  requireProjectPermission,
} from "../middlewares/validators/require-project-permission";
import requireCustomColumnPermission from "../middlewares/validators/require-custom-column-permission";

const mockedQuery = db.query as jest.Mock;

const TEAM_ID = "team-1";
const USER_ID = "user-1";
const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_PROJECT_ID = "22222222-2222-4222-8222-222222222222";
const COLUMN_UUID = "33333333-3333-4333-8333-333333333333";
const COLUMN_KEY = "V1StGXR8_Z5jdHi6B-myT";

const CREATE_SOURCES: { sources: ProjectIdSource[] } = {
  sources: ["body.project_id", "query.current_project_id", "query.project_id"],
};

interface IMembershipOverrides {
  team_role?: string;
  is_guest?: boolean;
  access_level?: string | null;
  is_project_member?: boolean;
}

const membershipRow = (overrides: IMembershipOverrides = {}) => ({
  team_role: "Member",
  is_guest: false,
  active: true,
  access_level: "PROJECT_MANAGER",
  finance_access: false,
  can_create_projects_from_templates: false,
  is_project_member: true,
  project_team_id: TEAM_ID,
  ...overrides,
});

const rows = (data: unknown[]) => ({ rows: data, rowCount: data.length });

const createReqRes = (init: {
  params?: Record<string, string>;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
}) => {
  const req: any = {
    user: { id: USER_ID, team_id: TEAM_ID, owner: false, is_admin: false },
    params: init.params ?? {},
    body: init.body ?? {},
    query: init.query ?? {},
  };
  const res: any = {
    status: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  };
  const next = jest.fn();
  return { req, res, next };
};

describe("POST /custom-columns authorization (requireProjectPermission)", () => {
  const middleware = requireProjectPermission("customColumns", CREATE_SOURCES);

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("allows a Member who is PROJECT_MANAGER on the project to create", async () => {
    const { req, res, next } = createReqRes({ body: { project_id: PROJECT_ID } });
    mockedQuery.mockResolvedValueOnce(rows([membershipRow()]));

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(mockedQuery).toHaveBeenCalledWith(expect.any(String), [PROJECT_ID, USER_ID]);
  });

  it("allows a Team Lead who is PROJECT_MANAGER on the project to create", async () => {
    const { req, res, next } = createReqRes({ body: { project_id: PROJECT_ID } });
    mockedQuery.mockResolvedValueOnce(rows([membershipRow({ team_role: "Team Lead" })]));

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
  });

  it("denies a guest even when their access level is PROJECT_MANAGER", async () => {
    const { req, res, next } = createReqRes({ body: { project_id: PROJECT_ID } });
    mockedQuery.mockResolvedValueOnce(rows([membershipRow({ is_guest: true })]));

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("denies a project manager of a project in another team", async () => {
    const { req, res, next } = createReqRes({ body: { project_id: PROJECT_ID } });
    mockedQuery.mockResolvedValueOnce(
      rows([{ ...membershipRow(), project_team_id: "team-other" }])
    );

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 400 when no project id is provided", async () => {
    const { req, res, next } = createReqRes({ body: {} });

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe("PUT/DELETE /custom-columns/:id authorization (requireCustomColumnPermission)", () => {
  const middleware = requireCustomColumnPermission("customColumns");

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("looks up a UUID id by primary key and authorizes a project manager", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_UUID } });
    mockedQuery
      .mockResolvedValueOnce(rows([{ id: COLUMN_UUID, project_id: PROJECT_ID }]))
      .mockResolvedValueOnce(rows([membershipRow()]));

    await middleware(req, res, next);

    expect(mockedQuery.mock.calls[0][0]).toContain("WHERE id = $1::UUID");
    expect(mockedQuery.mock.calls[0][1]).toEqual([COLUMN_UUID]);
    expect(mockedQuery.mock.calls[1][1]).toEqual([PROJECT_ID, USER_ID]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.params.id).toBe(COLUMN_UUID);
  });

  it("looks up a nanoid key without casting to UUID and rewrites params.id to the column UUID", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_KEY } });
    mockedQuery
      .mockResolvedValueOnce(rows([{ id: COLUMN_UUID, project_id: PROJECT_ID }]))
      .mockResolvedValueOnce(rows([membershipRow()]));

    await middleware(req, res, next);

    const [lookupSql, lookupParams] = mockedQuery.mock.calls[0];
    expect(lookupSql).toContain("WHERE key = $1");
    expect(lookupSql).not.toContain("::UUID");
    expect(lookupParams).toEqual([COLUMN_KEY]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.params.id).toBe(COLUMN_UUID);
  });

  it("scopes a key lookup to the project when a project id is provided", async () => {
    const { req, res, next } = createReqRes({
      params: { id: COLUMN_KEY },
      query: { current_project_id: PROJECT_ID },
    });
    mockedQuery
      .mockResolvedValueOnce(rows([{ id: COLUMN_UUID, project_id: PROJECT_ID }]))
      .mockResolvedValueOnce(rows([membershipRow()]));

    await middleware(req, res, next);

    const [lookupSql, lookupParams] = mockedQuery.mock.calls[0];
    expect(lookupSql).toContain("project_id = $2::UUID");
    expect(lookupParams).toEqual([COLUMN_KEY, PROJECT_ID]);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.params.id).toBe(COLUMN_UUID);
  });

  it("rejects a key that matches columns in multiple projects without authorizing either", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_KEY } });
    mockedQuery.mockResolvedValueOnce(
      rows([
        { id: COLUMN_UUID, project_id: PROJECT_ID },
        { id: "44444444-4444-4444-8444-444444444444", project_id: OTHER_PROJECT_ID },
      ])
    );

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
    expect(req.params.id).toBe(COLUMN_KEY);
  });

  it("returns 404 when the UUID does not exist", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_UUID } });
    mockedQuery.mockResolvedValueOnce(rows([]));

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 404 when the key does not exist", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_KEY } });
    mockedQuery.mockResolvedValueOnce(rows([]));

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("denies a guest on the column's project", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_KEY } });
    mockedQuery
      .mockResolvedValueOnce(rows([{ id: COLUMN_UUID, project_id: PROJECT_ID }]))
      .mockResolvedValueOnce(rows([membershipRow({ is_guest: true })]));

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(req.params.id).toBe(COLUMN_KEY);
  });

  it("returns 500 when the lookup fails", async () => {
    const { req, res, next } = createReqRes({ params: { id: COLUMN_UUID } });
    mockedQuery.mockRejectedValueOnce(new Error("db down"));

    await middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
