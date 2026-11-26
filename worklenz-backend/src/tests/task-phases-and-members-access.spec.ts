import db from "../config/db";
import TeamMembersController from "../controllers/team-members-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
const query = db.query as jest.MockedFunction<typeof db.query>;

const user = { id: "user-123", team_id: "team-123" };
beforeEach(() => jest.clearAllMocks());

describe("team-members access restrictions", () => {
  describe("getTeamMembersTreeMap", () => {
    it("denies access when requested teamId does not match user team", async () => {
      const req = createMockRequest({ user, query: { team: "foreign-team", selected: "time" } });
      const res = createMockResponse();
      await TeamMembersController.getTeamMembersTreeMap(req, res);
      expect(res.statusCode).toBe(403);
      expect(query).not.toHaveBeenCalled();
    });

    it("uses user active team when team param is omitted or matching", async () => {
      query.mockResolvedValueOnce(createQueryResult([{
        team_members: { data: [] }
      }]));
      const req = createMockRequest({ user, query: { team: "team-123", selected: "time" } });
      const res = createMockResponse();
      await TeamMembersController.getTeamMembersTreeMap(req, res);
      expect(res.statusCode).toBe(200);
      expect(query.mock.calls[0][1][0]).toBe("team-123");
    });
  });

  describe("getProjectsByTeamMember", () => {
    it("denies access when team member belongs to a different team", async () => {
      query.mockResolvedValueOnce(createQueryResult([])); // memberCheck not found
      const req = createMockRequest({ user, params: { id: "foreign-member" }, query: {} });
      const res = createMockResponse();
      await TeamMembersController.getProjectsByTeamMember(req, res);
      expect(res.statusCode).toBe(403);
      expect(query.mock.calls[0][1]).toEqual(["foreign-member", "team-123"]);
    });

    it("allows access when team member belongs to caller team", async () => {
      query.mockResolvedValueOnce(createQueryResult([{ id: "own-member" }])); // memberCheck ok
      query.mockResolvedValueOnce(createQueryResult([])); // projects query
      const req = createMockRequest({ user, params: { id: "own-member" }, query: {} });
      const res = createMockResponse();
      await TeamMembersController.getProjectsByTeamMember(req, res);
      expect(res.statusCode).toBe(200);
    });
  });

  describe("getTreeDataByMember", () => {
    it("denies access when team member belongs to a different team", async () => {
      query.mockResolvedValueOnce(createQueryResult([])); // memberCheck not found
      const req = createMockRequest({ user, query: { id: "foreign-member", selected: "tasks" } });
      const res = createMockResponse();
      await TeamMembersController.getTreeDataByMember(req, res);
      expect(res.statusCode).toBe(403);
    });

    it("rejects when member id is missing", async () => {
      const req = createMockRequest({ user, query: { selected: "tasks" } });
      const res = createMockResponse();
      await TeamMembersController.getTreeDataByMember(req, res);
      expect(res.statusCode).toBe(400);
    });
  });
});
