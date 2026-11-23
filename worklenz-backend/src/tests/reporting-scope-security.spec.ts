import db from "../config/db";
import { verifyReportingScope } from "../middlewares/verify-reporting-scope";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
const query = db.query as jest.MockedFunction<typeof db.query>;
const id = "4d20da6e-6df2-4e6c-b595-d592eae80d4a";
const user = { id: "user", team_id: "team" };
beforeEach(() => jest.clearAllMocks());

describe("reporting organization scope", () => {
  it.each(["team", "project", "member"] as const)("denies a foreign %s", async resource => {
    query.mockResolvedValueOnce(createQueryResult([]));
    const req = createMockRequest({ user, params: { id } });
    const res = createMockResponse();
    const next = jest.fn();
    await verifyReportingScope({ resource, location: "params", field: "id" })(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(query.mock.calls[0][1]).toEqual([id, "team", "user"]);
    expect(query.mock.calls[0][0]).toContain("active_team.user_id = target_team.user_id");
    expect(query.mock.calls[0][0]).toContain("tm.active IS TRUE");
  });
  it("allows an authorized organization team", async () => {
    query.mockResolvedValueOnce(createQueryResult([{ ok: 1 }]));
    const next = jest.fn();
    await verifyReportingScope({ resource: "team", location: "params", field: "id" })(createMockRequest({ user, params: { id } }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
  it("rejects malformed IDs without querying", async () => {
    const res = createMockResponse();
    await verifyReportingScope({ resource: "project", location: "query", field: "id" })(createMockRequest({ user, query: { id: "invalid" } }), res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(query).not.toHaveBeenCalled();
  });
  it("permits an omitted optional project filter", async () => {
    const next = jest.fn();
    await verifyReportingScope({ resource: "project", location: "query", field: "id", optional: true })(createMockRequest({ user }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  describe("array reporting scope validation", () => {
    const id2 = "b7280a8f-2877-4b71-92b0-8c2901dbfa91";

    it("allows authorized array of teams in body", async () => {
      query.mockResolvedValueOnce(createQueryResult([{ count: 2 }]));
      const next = jest.fn();
      const req = createMockRequest({ user, body: { teams: [id, id2] } });
      await verifyReportingScope({ resource: "team", location: "body", field: "teams", isArray: true })(req, createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(query.mock.calls[0][1]).toEqual([[id, id2], "team", "user"]);
    });

    it("denies array containing a foreign team", async () => {
      query.mockResolvedValueOnce(createQueryResult([{ count: 1 }])); // 1 out of 2 authorized
      const next = jest.fn();
      const res = createMockResponse();
      const req = createMockRequest({ user, body: { teams: [id, id2] } });
      await verifyReportingScope({ resource: "team", location: "body", field: "teams", isArray: true })(req, res, next);
      expect(res.statusCode).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    it("allows comma-separated query string of projects", async () => {
      query.mockResolvedValueOnce(createQueryResult([{ count: 2 }]));
      const next = jest.fn();
      const req = createMockRequest({ user, query: { projects: `${id},${id2}` } });
      await verifyReportingScope({ resource: "project", location: "query", field: "projects", isArray: true })(req, createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("rejects invalid UUID in array with 400", async () => {
      const res = createMockResponse();
      const next = jest.fn();
      const req = createMockRequest({ user, query: { projects: `${id},not-a-uuid` } });
      await verifyReportingScope({ resource: "project", location: "query", field: "projects", isArray: true })(req, res, next);
      expect(res.statusCode).toBe(400);
      expect(next).not.toHaveBeenCalled();
      expect(query).not.toHaveBeenCalled();
    });

    it("permits omitted optional array", async () => {
      const next = jest.fn();
      const req = createMockRequest({ user, query: {} });
      await verifyReportingScope({ resource: "project", location: "query", field: "projects", optional: true, isArray: true })(req, createMockResponse(), next);
      expect(next).toHaveBeenCalledTimes(1);
    });

    it("rejects unauthenticated request with 401", async () => {
      const res = createMockResponse();
      const next = jest.fn();
      const req = createMockRequest({ user: undefined, params: { id } });
      await verifyReportingScope({ resource: "member", location: "params", field: "id" })(req, res, next);
      expect(res.statusCode).toBe(401);
      expect(next).not.toHaveBeenCalled();
    });
  });
});
