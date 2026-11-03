import AdminCenterTeamsController from "../controllers/admin-center/admin-center-teams-controller";
import db from "../config/db";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { checkTeamSubscriptionStatus, getActiveTeamMemberCount } from "../shared/paddle-utils";
import { updateUsers } from "../shared/paddle-requests";
import { NotificationsService } from "../services/notifications/notifications.service";
import { IO } from "../shared/io";
import { logAuditEvent, actorFromSessionUser } from "../services/audit-log.service";
import { AUDIT_EVENT_TYPE } from "../shared/audit-log-constants";

jest.mock("../config/db", () => ({
  query: jest.fn(),
}));

jest.mock("../shared/paddle-utils", () => ({
  checkTeamSubscriptionStatus: jest.fn(),
  getActiveTeamMemberCount: jest.fn(),
}));

jest.mock("../shared/paddle-requests", () => ({
  updateUsers: jest.fn(),
}));

jest.mock("../services/notifications/notifications.service", () => ({
  NotificationsService: {
    sendNotificationToUser: jest.fn(),
  },
}));

jest.mock("../shared/io", () => ({
  IO: {
    emitByUserId: jest.fn(),
  },
}));

jest.mock("../services/audit-log.service", () => ({
  logAuditEvent: jest.fn(),
  actorFromSessionUser: jest.fn((user: any) => ({
    userId: user?.id,
    name: user?.name,
    email: user?.email,
  })),
}));

const mockQuery = db.query as jest.Mock;
const mockCheckTeamSubscriptionStatus = checkTeamSubscriptionStatus as jest.Mock;
const mockGetActiveTeamMemberCount = getActiveTeamMemberCount as jest.Mock;
const mockUpdateUsers = updateUsers as jest.Mock;
const mockSendNotification = NotificationsService.sendNotificationToUser as jest.Mock;
const mockEmitByUserId = IO.emitByUserId as jest.Mock;
const mockLogAuditEvent = logAuditEvent as jest.Mock;

describe("AdminCenterTeamsController", () => {
  const mockUser = {
    id: "user-1",
    owner_id: "owner-1",
    organization_id: "org-1",
    team_id: "team-1",
    team_member_id: "tm-1",
    name: "John Doe",
    team_name: "Engineering",
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (actorFromSessionUser as jest.Mock).mockImplementation((user: any) => ({
      userId: user?.id,
      name: user?.name,
      email: user?.email,
    }));
  });

  describe("getOrganizationTeams", () => {
    it("returns 200 with teams data when offset is 0", async () => {
      const teamsData = {
        total: 1,
        data: [
          {
            id: "team-2",
            name: "QA Team",
            members_count: 3,
            team_members: [{ name: "Alice" }],
          },
        ],
        current_team_data: {
          id: "team-1",
          name: "Engineering",
          members_count: 5,
          team_members: [{ name: "Bob" }],
        },
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ teams: teamsData }],
      });

      const req = createMockRequest({
        user: mockUser,
        query: { index: "1", size: "10" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.getOrganizationTeams(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(teamsData);
      expect(res.body.body.current_team_data.names[0].color_code).toBeDefined();
    });

    it("returns 200 with teams data when offset > 0 and search is applied", async () => {
      const teamsData = {
        total: 1,
        data: [
          {
            id: "team-3",
            name: "DevOps",
            members_count: 2,
            team_members: [],
          },
        ],
      };

      mockQuery.mockResolvedValueOnce({
        rows: [{ teams: teamsData }],
      });

      const req = createMockRequest({
        user: mockUser,
        query: { index: "2", size: "5", search: "Dev" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.getOrganizationTeams(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body).toEqual(teamsData);
    });
  });

  describe("getTeamDetails", () => {
    it("returns 200 with team details and decorated color-coded member tags", async () => {
      const teamObj = {
        id: "team-2",
        name: "Design Team",
        members_count: 2,
        team_members: [
          { id: "tm-10", name: "Alice Design", role_name: "Owner" },
          { id: "tm-11", name: "Bob UI", role_name: "Member" },
        ],
      };

      mockQuery.mockResolvedValueOnce({ rows: [teamObj] });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.getTeamDetails(req, res);

      expect(mockQuery).toHaveBeenCalledWith(expect.stringContaining("user_id = $2"), ["team-2", "owner-1"]);
      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.id).toBe("team-2");
      expect(res.body.body.names).toBeDefined();
      expect(res.body.body.names[0].color_code).toBeDefined();
    });
  });

  describe("getTeamDetails ownership", () => {
    it("returns 404 when the team is not owned by the session owner", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] });

      const req = createMockRequest({ user: mockUser, params: { id: "foreign-team" } });
      const res = createMockResponse();

      await AdminCenterTeamsController.getTeamDetails(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.done).toBe(false);
    });
  });

  describe("updateTeam", () => {
    it("returns 404 when team is not found", async () => {
      mockQuery.mockResolvedValueOnce({ rows: [] }); // update name returning empty

      const req = createMockRequest({
        user: mockUser,
        params: { id: "non-existent-team" },
        body: { name: "New Name", teamMembers: [] },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.updateTeam(req, res);

      expect(res.statusCode).toBe(404);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("Team not found");
    });

    it("updates team name, roles, and member names for active members and invitees", async () => {
      mockQuery.mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes("UPDATE teams SET name")) {
          return { rows: [{ id: "team-2" }] };
        }
        if (sql.includes("SELECT tm.user_id")) {
          const memberId = params[0];
          return { rows: [{ user_id: memberId === "tm-1" ? "user-active" : null }] };
        }
        if (sql.includes("UPDATE team_members SET role_id")) {
          return { rows: [] };
        }
        if (sql.includes("UPDATE users SET name")) {
          return { rows: [] };
        }
        if (sql.includes("UPDATE email_invitations")) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
        body: {
          name: "Updated Team Name",
          teamMembers: [
            { id: "tm-1", role_name: "Admin", user_id: null, name: "Active User Updated" },
            { id: "tm-2", role_name: "Member", user_id: null, name: "Pending User Updated" },
          ],
        },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.updateTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(res.body.message).toBe("Team updated successfully");
    });

    it("skips role update when member role is Owner", async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("UPDATE teams SET name")) {
          return { rows: [{ id: "team-2" }] };
        }
        if (sql.includes("SELECT tm.user_id")) {
          return { rows: [{ user_id: "user-owner" }] };
        }
        return { rows: [] };
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
        body: {
          name: "Team Name",
          teamMembers: [
            { id: "tm-owner", role_name: "Owner", user_id: null, name: "Owner Name" },
          ],
        },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.updateTeam(req, res);

      expect(res.statusCode).toBe(200);
      const roleUpdateCalls = mockQuery.mock.calls.filter(([sql]) =>
        sql.includes("UPDATE team_members") && sql.includes("SET role_id")
      );
      expect(roleUpdateCalls.length).toBe(0);
    });

    it("returns 500 when database throws an exception", async () => {
      mockQuery.mockRejectedValueOnce(new Error("DB Connection Error"));

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
        body: { name: "Failing Update" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.updateTeam(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("Failed to update team");
    });
  });

  describe("deleteTeam", () => {
    it("returns 200 false when owner_id is missing from session", async () => {
      const req = createMockRequest({
        user: { id: "user-1" },
        params: { id: "team-2" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("User not found");
    });

    it("prevents deletion of the presently active team", async () => {
      const req = createMockRequest({
        user: mockUser, // team_id is "team-1"
        params: { id: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.message).toContain("Please switch to another team");
      expect(res.body.title).toContain("Unable to remove the presently active team!");
    });

    it("blocks deletion when team has active users", async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("has_active_users")) {
          return { rows: [{ has_active_users: true, has_project_folders: false }] };
        }
        return { rows: [] };
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.title).toBe("Unable to delete team");
      expect(res.body.message).toContain("one or more users still have it selected as their active team");
    });

    it("blocks deletion when team has project folders", async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("has_active_users")) {
          return { rows: [{ has_active_users: false, has_project_folders: true }] };
        }
        return { rows: [] };
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.title).toBe("Unable to delete team");
      expect(res.body.message).toContain("still has project folders associated with it");
    });

    it("returns 200 false when team row is not found during delete", async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("has_active_users")) {
          return { rows: [{ has_active_users: false, has_project_folders: false }] };
        }
        if (sql.includes("SELECT name FROM teams")) {
          return { rows: [{ name: "Missing Team" }] };
        }
        if (sql.includes("DELETE FROM teams")) {
          return { rowCount: 0, rows: [] };
        }
        return { rows: [] };
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("Team not found");
    });

    it("deletes team successfully and logs an audit event", async () => {
      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("has_active_users")) {
          return { rows: [{ has_active_users: false, has_project_folders: false }] };
        }
        if (sql.includes("SELECT name FROM teams")) {
          return { rows: [{ name: "Deprecated Team" }] };
        }
        if (sql.includes("DELETE FROM teams")) {
          return { rowCount: 1, rows: [{ id: "team-2" }] };
        }
        return { rows: [] };
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "team-2" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteTeam(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(mockLogAuditEvent).toHaveBeenCalledWith({
        organizationId: "org-1",
        teamId: null,
        actor: expect.objectContaining({ userId: "user-1" }),
        eventType: AUDIT_EVENT_TYPE.TEAM_DELETED.id,
        description: 'Deleted team "Deprecated Team"',
      });
    });
  });

  describe("deleteById (remove team member)", () => {
    it("returns 200 false when id or teamId is missing", async () => {
      const req = createMockRequest({
        user: mockUser,
        params: { id: "" },
        body: {},
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.body).toBe("Required fields are missing.");
    });

    it("prevents self-removal from team", async () => {
      const req = createMockRequest({
        user: mockUser, // team_member_id is "tm-1"
        params: { id: "tm-1" },
        body: { teamId: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.message).toBe("You cannot remove yourself from the team.");
    });

    it("returns 200 false when subscription status is excluded", async () => {
      mockCheckTeamSubscriptionStatus.mockResolvedValueOnce({
        subscription_status: "past_due",
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "tm-other" },
        body: { teamId: "team-1" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.body).toBe("Please check your subscription status.");
    });

    it("removes team member, updates paddle seats if needed, sends notification and socket event", async () => {
      mockCheckTeamSubscriptionStatus.mockResolvedValueOnce({
        subscription_status: "active",
        quantity: 5,
        is_credit: false,
        is_custom: false,
        subscription_id: "sub-123",
      });

      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("remove_team_member")) {
          return { rows: [{ member: { id: "user-removed", team: "Engineering" } }] };
        }
        if (sql.includes("checkIfUserActiveInOtherTeams") || sql.includes("team_member_info_view")) {
          return { rows: [{ exists: false }] };
        }
        return { rows: [] };
      });

      mockGetActiveTeamMemberCount.mockResolvedValueOnce({ user_count: 4 });
      mockUpdateUsers.mockResolvedValueOnce({
        body: { subscription_id: "sub-123" },
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "tm-other" },
        body: { teamId: "team-1" },
        query: { email: "removed@example.com" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(true);
      expect(mockUpdateUsers).toHaveBeenCalledWith("sub-123", 4);
      expect(mockSendNotification).toHaveBeenCalledWith(
        "user-removed",
        "user-1",
        "Engineering",
        "team-1",
        expect.stringContaining("You have been removed")
      );
      expect(mockEmitByUserId).toHaveBeenCalled();
    });

    it("returns subscription error message if updateUsers fails", async () => {
      mockCheckTeamSubscriptionStatus.mockResolvedValueOnce({
        subscription_status: "active",
        quantity: 5,
        is_credit: false,
        is_custom: false,
        subscription_id: "sub-123",
      });

      mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("remove_team_member")) {
          return { rows: [{ member: { id: "user-removed", team: "Engineering" } }] };
        }
        if (sql.includes("team_member_info_view")) {
          return { rows: [{ exists: false }] };
        }
        return { rows: [] };
      });

      mockGetActiveTeamMemberCount.mockResolvedValueOnce({ user_count: 4 });
      mockUpdateUsers.mockResolvedValueOnce({
        body: {},
        message: "Failed to update subscription in Paddle",
      });

      const req = createMockRequest({
        user: mockUser,
        params: { id: "tm-other" },
        body: { teamId: "team-1" },
        query: { email: "removed@example.com" },
      });
      const res = createMockResponse();

      await AdminCenterTeamsController.deleteById(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.done).toBe(false);
      expect(res.body.body).toBe("Failed to update subscription in Paddle");
    });
  });
});
