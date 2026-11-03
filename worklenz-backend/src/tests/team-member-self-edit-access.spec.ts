jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../services/token-service", () => ({
  __esModule: true,
  default: {},
}));

jest.mock("../services/team-member-audit.service", () => ({
  __esModule: true,
  captureTeamMember: jest.fn().mockResolvedValue(null),
  logTeamEvent: jest.fn(),
  logTeamMemberChanges: jest.fn(),
  logTeamMemberEvent: jest.fn(),
}));

jest.mock("../services/audit-log.service", () => ({
  __esModule: true,
  actorFromSessionUser: jest.fn().mockReturnValue({}),
  logAuditEvent: jest.fn(),
  resolveOrganizationIdForUserId: jest.fn().mockResolvedValue("org-1"),
}));

jest.mock("../shared/paddle-utils", () => ({
  __esModule: true,
  checkTeamSubscriptionStatus: jest.fn(),
}));

jest.mock("../shared/subscription-limits", () => ({
  __esModule: true,
  getTeamMemberSeatLimit: jest.fn(),
}));

jest.mock("../shared/team-seat-lock", () => ({
  __esModule: true,
  withTeamSeatLock: jest.fn(),
}));

jest.mock("../services/notifications/notifications.service", () => ({
  __esModule: true,
  NotificationsService: {
    sendTeamMembersInvitations: jest.fn(),
  },
}));

jest.mock("../shared/pm-lifecycle", () => ({
  __esModule: true,
  clearPmAccessForTeamMember: jest.fn(),
  listPmProjectsForTeamMember: jest.fn(),
  notifyClearedPmRows: jest.fn(),
}));

import db from "../config/db";
import TeamMembersController from "../controllers/team-members-controller";
import teamMemberSelfOrManagementValidator from "../middlewares/validators/team-member-self-or-management-validator";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedQuery = db.query as jest.Mock;

describe("teamMemberSelfOrManagementValidator", () => {
  const memberId = "00000000-0000-0000-0000-000000000001";
  const otherMemberId = "00000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("returns 401 when request is unauthenticated", async () => {
    const req = createMockRequest({ user: null, params: { id: memberId } });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("allows request when user is Team Owner", async () => {
    const req = createMockRequest({
      user: { id: "u-owner", team_id: "t-1", owner: true, role_name: "Owner" },
      params: { id: otherMemberId },
    });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows request when user is Team Admin", async () => {
    const req = createMockRequest({
      user: { id: "u-admin", team_id: "t-1", is_admin: true, role_name: "Admin" },
      params: { id: otherMemberId },
    });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows Member accessing their own record via session team_member_id", async () => {
    const req = createMockRequest({
      user: { id: "u-member", team_id: "t-1", team_member_id: memberId, role_name: "Member" },
      params: { id: memberId },
    });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows Team Lead accessing their own record via session team_member_id", async () => {
    const req = createMockRequest({
      user: { id: "u-lead", team_id: "t-1", team_member_id: memberId, role_name: "Team Lead" },
      params: { id: memberId },
    });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects Member attempting to access another member's record", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const req = createMockRequest({
      user: { id: "u-member", team_id: "t-1", team_member_id: memberId, role_name: "Member" },
      params: { id: otherMemberId },
    });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  it("rejects Team Lead attempting to access another member's record", async () => {
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    const req = createMockRequest({
      user: { id: "u-lead", team_id: "t-1", team_member_id: memberId, role_name: "Team Lead" },
      params: { id: otherMemberId },
    });
    const res = createMockResponse();
    const next = jest.fn();

    await teamMemberSelfOrManagementValidator(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("TeamMembersController self-service operations", () => {
  const memberId = "00000000-0000-0000-0000-000000000001";
  const otherMemberId = "00000000-0000-0000-0000-000000000002";
  const teamId = "00000000-0000-0000-0000-000000000010";

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("getById allows Member to read their own profile", async () => {
    // 1. getTeamMemberRoleName
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Member" }]));
    // 2. actual getById query
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ id: memberId, name: "Alice", email: "alice@test.com" }]));

    const req = createMockRequest({
      user: { id: "u-1", team_id: teamId, team_member_id: memberId, role_name: "Member" },
      params: { id: memberId },
    });
    const res = createMockResponse();

    await TeamMembersController.getById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
    expect(res.body.body.name).toBe("Alice");
  });

  it("getById rejects Member attempting to read another member", async () => {
    // 1. getTeamMemberRoleName for target
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Member" }]));

    const req = createMockRequest({
      user: { id: "u-1", team_id: teamId, team_member_id: memberId, role_name: "Member" },
      params: { id: otherMemberId },
    });
    const res = createMockResponse();

    await TeamMembersController.getById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toMatch(/not authorized to manage/i);
  });

  it("updateMemberName allows Member to update their own name", async () => {
    // 1. getTeamMemberRoleName
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Member" }]));
    // 2. resolve user_id for member
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ user_id: "u-1" }]));
    // 3. update users table
    mockedQuery.mockResolvedValueOnce(createQueryResult([], 1));

    const req = createMockRequest({
      user: { id: "u-1", team_id: teamId, team_member_id: memberId, role_name: "Member" },
      params: { id: memberId },
      body: { name: "Alice Updated" },
    });
    const res = createMockResponse();

    await TeamMembersController.updateMemberName(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
  });

  it("update preserves and locks role/admin on self-update even if privilege escalation attempted", async () => {
    // 1. getTeamMemberRoleName in ensureManageableTarget
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Member" }]));
    // 2. getTeamMemberRoleName in update
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Member" }]));
    // 3. update_team_member query
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ team_member: memberId }]));

    const req = createMockRequest({
      user: { id: "u-1", team_id: teamId, team_member_id: memberId, role_name: "Member" },
      params: { id: memberId },
      body: {
        job_title: "Software Engineer",
        department_id: null,
        practice_id: null,
        // Attempt privilege escalation:
        role_name: "Admin",
        is_admin: true,
      },
    });
    const res = createMockResponse();

    await TeamMembersController.update(req, res);

    // Because caller is self/non-manager, role_name was locked to previousRoleName ("Member")
    // and is_admin was locked to false before calling update_team_member!
    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);

    const updateCall = mockedQuery.mock.calls.find(call =>
      typeof call[0] === "string" && call[0].includes("update_team_member")
    );
    expect(updateCall).toBeDefined();
    const passedPayload = JSON.parse(updateCall[1][0]);
    expect(passedPayload.role_name).toBe("Member");
    expect(passedPayload.is_admin).toBe(false);
    expect(passedPayload.job_title).toBe("Software Engineer");
  });
});
