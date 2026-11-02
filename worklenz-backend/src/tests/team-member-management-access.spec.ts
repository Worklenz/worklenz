jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  hasTeamMemberManagementAccess,
  ORGANIZATION_PERMISSIONS,
} from "../shared/organization-permissions";
import {
  getManageUsersAssignableRoles,
  TEAM_ROLE_NAMES,
} from "../shared/team-permissions";
import { IPassportSession } from "../interfaces/passport-session";
import TeamMembersController from "../controllers/team-members-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

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

import db from "../config/db";

const mockedDb = db as jest.Mocked<typeof db>;
const mockedQuery = db.query as jest.Mock;

const memberSession = {
  team_id: "team-1",
  owner: false,
  is_admin: false,
  is_guest: false,
} as unknown as IPassportSession;

const adminSession = {
  team_id: "team-1",
  owner: false,
  is_admin: true,
  is_guest: false,
} as unknown as IPassportSession;

describe("hasTeamMemberManagementAccess", () => {
  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
  });

  it("allows Owner/Admin without a scheme grant lookup when is_admin is set", async () => {
    await expect(hasTeamMemberManagementAccess(adminSession)).resolves.toBe(true);
    expect(mockedDb.query).not.toHaveBeenCalled();
  });

  it("allows a Member when Manage users is granted", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });

    await expect(hasTeamMemberManagementAccess(memberSession)).resolves.toBe(true);
  });

  it("denies a Member when Manage users is not granted", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(hasTeamMemberManagementAccess(memberSession)).resolves.toBe(false);
  });
});

describe("getManageUsersAssignableRoles", () => {
  it("returns only roles below Admin", () => {
    expect(getManageUsersAssignableRoles()).toEqual([
      TEAM_ROLE_NAMES.TEAM_LEAD,
      TEAM_ROLE_NAMES.MEMBER,
    ]);
    expect(getManageUsersAssignableRoles()).not.toContain(TEAM_ROLE_NAMES.ADMIN);
    expect(getManageUsersAssignableRoles()).not.toContain(TEAM_ROLE_NAMES.OWNER);
  });
});

describe("addTeamMember authorization", () => {
  const teamId = "00000000-0000-0000-0000-000000000010";

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("rejects a Manage users Member assigning Owner", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });
    const req = createMockRequest({
      user: { ...memberSession, id: "u-1", team_id: teamId, role_name: "Member" },
      params: { id: teamId },
      body: { emails: ["u-1@test.com"], role_name: "Owner", is_admin: true },
    });
    const res = createMockResponse();

    await TeamMembersController.addTeamMember(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toMatch(/not authorized to assign/i);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a Manage users Member assigning Admin", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });
    const req = createMockRequest({
      user: { ...memberSession, id: "u-1", team_id: teamId, role_name: "Member" },
      params: { id: teamId },
      body: { emails: ["u-2@test.com"], role_name: "Admin" },
    });
    const res = createMockResponse();

    await TeamMembersController.addTeamMember(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toMatch(/not authorized to assign/i);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a Manage users Member assigning Admin via is_admin: true without role_name", async () => {
    mockedQuery.mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });
    const req = createMockRequest({
      user: { ...memberSession, id: "u-1", team_id: teamId, role_name: "Member" },
      params: { id: teamId },
      body: { emails: ["u-2@test.com"], is_admin: true },
    });
    const res = createMockResponse();

    await TeamMembersController.addTeamMember(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toMatch(/not authorized to assign/i);
    expect(mockedQuery).toHaveBeenCalledTimes(1);
  });

  it("rejects a target team different from the caller's active team", async () => {
    const req = createMockRequest({
      user: { ...memberSession, id: "u-1", team_id: teamId, role_name: "Member" },
      params: { id: "00000000-0000-0000-0000-000000000011" },
      body: { emails: ["u-1@test.com"], role_name: "Member" },
    });
    const res = createMockResponse();

    await TeamMembersController.addTeamMember(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.done).toBe(false);
    expect(mockedQuery).not.toHaveBeenCalled();
  });
});

describe("ensureManageableTarget — Manage users cannot edit Admins", () => {
  const memberId = "00000000-0000-0000-0000-000000000001";
  const adminMemberId = "00000000-0000-0000-0000-000000000002";
  const teamId = "00000000-0000-0000-0000-000000000010";

  beforeEach(() => {
    mockedQuery.mockReset();
  });

  it("rejects a Manage users Member targeting an Admin", async () => {
    // getTeamMemberRoleName → Admin
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Admin" }]));
    // isSelfMemberInTeam → not self
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    // hasTeamMemberManagementAccess → Manage users granted
    mockedQuery.mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });

    const req = createMockRequest({
      user: {
        id: "u-1",
        team_id: teamId,
        team_member_id: memberId,
        role_name: "Member",
        owner: false,
        is_admin: false,
      },
      params: { id: adminMemberId },
    });
    const res = createMockResponse();

    await TeamMembersController.getById(req, res);

    expect(res.body.done).toBe(false);
    expect(res.body.message).toMatch(/not authorized to manage/i);
  });

  it("allows a Manage users Member targeting a Member", async () => {
    const otherMemberId = "00000000-0000-0000-0000-000000000003";
    // getTeamMemberRoleName → Member
    mockedQuery.mockResolvedValueOnce(createQueryResult([{ name: "Member" }]));
    // isSelfMemberInTeam → not self
    mockedQuery.mockResolvedValueOnce(createQueryResult([]));
    // hasTeamMemberManagementAccess → Manage users granted
    mockedQuery.mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.MANAGE_USERS, granted: true }],
    });
    // getById query
    mockedQuery.mockResolvedValueOnce(
      createQueryResult([{ id: otherMemberId, name: "Bob", email: "bob@test.com" }])
    );

    const req = createMockRequest({
      user: {
        id: "u-1",
        team_id: teamId,
        team_member_id: memberId,
        role_name: "Member",
        owner: false,
        is_admin: false,
      },
      params: { id: otherMemberId },
    });
    const res = createMockResponse();

    await TeamMembersController.getById(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.done).toBe(true);
  });
});
