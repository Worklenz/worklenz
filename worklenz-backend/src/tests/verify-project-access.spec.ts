jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
}));

import db from "../config/db";
import verifyProjectAccess, {
  verifyNonGuestProjectAccess,
  hasProjectAccess,
  userHasProjectAccessInTeam,
} from "../middlewares/verify-project-access";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedDb = db as jest.Mocked<typeof db>;

describe("verify-project-access middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("verifyProjectAccess", () => {
    it("returns 400 when project id is missing", async () => {
      const req = createMockRequest({
        user: { id: "u-1", team_id: "t-1" },
        params: {},
      });
      const res = createMockResponse();
      const next = jest.fn();

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Project ID is required");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 401 when user is not authenticated", async () => {
      const req = createMockRequest({
        user: null,
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(401);
      expect(res.body.message).toContain("Authentication required");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 403 when user team membership is deactivated", async () => {
      const req = createMockRequest({
        user: { id: "u-1", team_id: "t-1" },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce(createQueryResult([])); // activeMembership check fails

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("deactivated");
      expect(next).not.toHaveBeenCalled();
    });

    it("returns 404 when project does not exist", async () => {
      const req = createMockRequest({
        user: { id: "u-1", team_id: "t-1" },
        params: { id: "p-nonexistent" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active team member
        .mockResolvedValueOnce(createQueryResult([])); // project team query empty

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(404);
      expect(res.body.message).toContain("Project not found");
      expect(next).not.toHaveBeenCalled();
    });

    it("allows team owner without additional DB checks", async () => {
      const req = createMockRequest({
        user: { id: "u-1", team_id: "t-1", owner: true },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active member
        .mockResolvedValueOnce(createQueryResult([{ team_id: "t-1" }])); // project belongs to t-1

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("allows team admin without additional DB checks", async () => {
      const req = createMockRequest({
        user: { id: "u-admin", team_id: "t-1", is_admin: true },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active member
        .mockResolvedValueOnce(createQueryResult([{ team_id: "t-1" }])); // project team

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows team lead when admin_role is true", async () => {
      const req = createMockRequest({
        user: { id: "u-lead", team_id: "t-1" },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active member
        .mockResolvedValueOnce(createQueryResult([{ team_id: "t-1" }])) // project team
        .mockResolvedValueOnce(createQueryResult([{ admin_role: true }])); // team lead check

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("allows regular member when explicitly added to project_members", async () => {
      const req = createMockRequest({
        user: { id: "u-member", team_id: "t-1" },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active member
        .mockResolvedValueOnce(createQueryResult([{ team_id: "t-1" }])) // project team
        .mockResolvedValueOnce(createQueryResult([])) // not a team lead
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])); // found in project_members

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("rejects regular member not added to project_members with 403", async () => {
      const req = createMockRequest({
        user: { id: "u-member", team_id: "t-1" },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active member
        .mockResolvedValueOnce(createQueryResult([{ team_id: "t-1" }])) // project team
        .mockResolvedValueOnce(createQueryResult([])) // not team lead
        .mockResolvedValueOnce(createQueryResult([])); // not project member

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("permission to access this project");
      expect(next).not.toHaveBeenCalled();
    });

    it("handles auto team switch when project belongs to user's other team", async () => {
      const req = createMockRequest({
        user: { id: "u-multi", team_id: "team-a" },
        params: { id: "p-teamb" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])) // active in team-a
        .mockResolvedValueOnce(createQueryResult([{ team_id: "team-b" }])) // project is in team-b
        .mockResolvedValueOnce(createQueryResult([{ owner: true, admin_role: false }])) // user has owner role in team-b
        .mockResolvedValueOnce(createQueryResult([{ activate_team: true }])); // activate_team function

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(req.user.team_id).toBe("team-b"); // auto switched
    });

    it("returns 500 when database throws an error", async () => {
      const req = createMockRequest({
        user: { id: "u-1", team_id: "t-1" },
        params: { id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query.mockRejectedValueOnce(new Error("Database failure"));

      const middleware = verifyProjectAccess("params", "id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(500);
      expect(res.body.message).toContain("An error occurred");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("verifyNonGuestProjectAccess", () => {
    it("returns 400 when project id is missing", async () => {
      const req = createMockRequest({
        user: { id: "u-1" },
        body: {},
      });
      const res = createMockResponse();
      const next = jest.fn();

      const middleware = verifyNonGuestProjectAccess("body", "project_id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(400);
      expect(res.body.message).toContain("Project ID is required");
    });

    it("returns 401 when user is missing", async () => {
      const req = createMockRequest({
        user: null,
        body: { project_id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      const middleware = verifyNonGuestProjectAccess("body", "project_id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(401);
    });

    it("allows non-guest users", async () => {
      const req = createMockRequest({
        user: { id: "u-1" },
        body: { project_id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce(createQueryResult([{ 1: 1 }]));

      const middleware = verifyNonGuestProjectAccess("body", "project_id");
      await middleware(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it("denies guest users with 403", async () => {
      const req = createMockRequest({
        user: { id: "u-guest" },
        body: { project_id: "p-1" },
      });
      const res = createMockResponse();
      const next = jest.fn();

      mockedDb.query.mockResolvedValueOnce(createQueryResult([])); // non-guest predicate fails

      const middleware = verifyNonGuestProjectAccess("body", "project_id");
      await middleware(req, res, next);

      expect(res.statusCode).toBe(403);
      expect(res.body.message).toContain("Guests do not have permission");
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("helper functions", () => {
    it("hasProjectAccess returns true when query finds match", async () => {
      mockedDb.query.mockResolvedValueOnce(createQueryResult([{ id: 1 }]));
      const access = await hasProjectAccess("p-1", "t-1");
      expect(access).toBe(true);
    });

    it("hasProjectAccess returns false on error or empty result", async () => {
      mockedDb.query.mockResolvedValueOnce(createQueryResult([]));
      expect(await hasProjectAccess("p-1", "t-1")).toBe(false);

      mockedDb.query.mockRejectedValueOnce(new Error("DB error"));
      expect(await hasProjectAccess("p-1", "t-1")).toBe(false);
    });

    it("userHasProjectAccessInTeam returns true for owner or admin immediately", async () => {
      expect(await userHasProjectAccessInTeam("p-1", "u-1", "t-1", true, false)).toBe(true);
      expect(await userHasProjectAccessInTeam("p-1", "u-1", "t-1", false, true)).toBe(true);
      expect(mockedDb.query).not.toHaveBeenCalled();
    });

    it("userHasProjectAccessInTeam checks team lead role when not owner/admin", async () => {
      mockedDb.query.mockResolvedValueOnce(createQueryResult([{ id: 1 }]));
      const access = await userHasProjectAccessInTeam("p-1", "u-lead", "t-1", false, false);
      expect(access).toBe(true);
    });

    it("userHasProjectAccessInTeam checks project_members when not team lead", async () => {
      mockedDb.query
        .mockResolvedValueOnce(createQueryResult([])) // not team lead
        .mockResolvedValueOnce(createQueryResult([{ id: 1 }])); // project member
      const access = await userHasProjectAccessInTeam("p-1", "u-member", "t-1", false, false);
      expect(access).toBe(true);
    });
  });
});
