/**
 * Phase 1 — getProjectAccess / buildProjectAccess matrix.
 * Pure builder tests (no DB). Covers acceptance scenarios that hang off the resolver.
 */

jest.unmock("../shared/project-access");
jest.unmock("../shared/team-permissions");

import { TEAM_ROLE_NAMES } from "../shared/team-permissions";
import {
  buildProjectAccess,
  getProjectAccessForRequest,
} from "../shared/project-access";
import { IProjectMembershipContext } from "../shared/project-access.types";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IPassportSession } from "../interfaces/passport-session";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from "../config/db";

const mockedDb = db as jest.Mocked<typeof db>;

const memberCtx = (
  overrides: Partial<IProjectMembershipContext> = {}
): IProjectMembershipContext => ({
  teamRole: TEAM_ROLE_NAMES.MEMBER,
  isGuest: false,
  isActive: true,
  accessLevel: "MEMBER",
  financeAccess: false,
  canCreateProjectsFromTemplates: false,
  isProjectMember: true,
  ...overrides,
});

describe("buildProjectAccess (Phase 1)", () => {
  it("Member who is PM gets settings/members/statuses and not archive/delete/assignPm", () => {
    const access = buildProjectAccess(
      memberCtx({
        accessLevel: "PROJECT_MANAGER",
        financeAccess: false,
      })
    );

    expect(access.isProjectManager).toBe(true);
    expect(access.financeAccess).toBe(false);
    expect(access.permissions.settings).toBe(true);
    expect(access.permissions.statuses).toBe(true);
    expect(access.permissions.phases).toBe(true);
    expect(access.permissions.customColumns).toBe(true);
    expect(access.permissions.members.add).toBe(true);
    expect(access.permissions.members.removeMember).toBe(true);
    expect(access.permissions.saveAsTemplate).toBe(true);
    expect(access.permissions.tasks).toBe(true);
    expect(access.permissions.finance).toBe(false);
    expect(access.permissions.archive).toBe(false);
    expect(access.permissions.delete).toBe(false);
    expect(access.permissions.move).toBe(false);
    expect(access.permissions.assignPm).toBe(false);
  });

  it("Member who is PM with finance_access gets finance", () => {
    const access = buildProjectAccess(
      memberCtx({
        accessLevel: "PROJECT_MANAGER",
        financeAccess: true,
      })
    );

    expect(access.financeAccess).toBe(true);
    expect(access.permissions.finance).toBe(true);
  });

  it("plain Member on a project does not get settings or finance", () => {
    const access = buildProjectAccess(memberCtx());

    expect(access.isProjectManager).toBe(false);
    expect(access.permissions.settings).toBe(false);
    expect(access.permissions.members.add).toBe(false);
    expect(access.permissions.saveAsTemplate).toBe(false);
    expect(access.permissions.finance).toBe(false);
    expect(access.permissions.tasks).toBe(true);
  });

  it("Admin gets full access including archive/delete/assignPm regardless of PM row", () => {
    const access = buildProjectAccess(
      memberCtx({
        teamRole: TEAM_ROLE_NAMES.ADMIN,
        accessLevel: "MEMBER",
        financeAccess: false,
      })
    );

    expect(access.permissions.settings).toBe(true);
    expect(access.permissions.finance).toBe(true);
    expect(access.permissions.archive).toBe(true);
    expect(access.permissions.delete).toBe(true);
    expect(access.permissions.assignPm).toBe(true);
    expect(access.financeAccess).toBe(true);
  });

  it("Owner not listed on the project still gets admin permissions", () => {
    const access = buildProjectAccess(
      memberCtx({
        teamRole: TEAM_ROLE_NAMES.OWNER,
        isProjectMember: false,
        accessLevel: null,
      })
    );

    expect(access.permissions.delete).toBe(true);
    expect(access.permissions.assignPm).toBe(true);
    expect(access.permissions.finance).toBe(true);
  });

  it("Guest with PROJECT_MANAGER row gets no PM elevation", () => {
    const access = buildProjectAccess(
      memberCtx({
        isGuest: true,
        accessLevel: "PROJECT_MANAGER",
        financeAccess: true,
      })
    );

    expect(access.isProjectManager).toBe(false);
    expect(access.financeAccess).toBe(false);
    expect(access.permissions.settings).toBe(false);
    expect(access.permissions.finance).toBe(false);
    expect(access.permissions.members.add).toBe(false);
    expect(access.canCreateProjectsFromTemplates).toBe(false);
  });

  it("Team Lead + PM unions Team Lead baseline with PM (finance from flag)", () => {
    const withoutFinance = buildProjectAccess(
      memberCtx({
        teamRole: TEAM_ROLE_NAMES.TEAM_LEAD,
        accessLevel: "PROJECT_MANAGER",
        financeAccess: false,
      })
    );
    expect(withoutFinance.permissions.settings).toBe(true);
    expect(withoutFinance.permissions.saveAsTemplate).toBe(true);
    expect(withoutFinance.permissions.finance).toBe(false);

    const withFinance = buildProjectAccess(
      memberCtx({
        teamRole: TEAM_ROLE_NAMES.TEAM_LEAD,
        accessLevel: "PROJECT_MANAGER",
        financeAccess: true,
      })
    );
    expect(withFinance.permissions.finance).toBe(true);
    expect(withFinance.permissions.assignPm).toBe(false);
  });

  it("Team Lead without PM does not get finance or saveAsTemplate", () => {
    const access = buildProjectAccess(
      memberCtx({
        teamRole: TEAM_ROLE_NAMES.TEAM_LEAD,
        accessLevel: "MEMBER",
      })
    );

    expect(access.permissions.settings).toBe(true);
    expect(access.permissions.finance).toBe(false);
    expect(access.permissions.saveAsTemplate).toBe(false);
  });

  it("inactive membership denies access", () => {
    const access = buildProjectAccess(
      memberCtx({
        isActive: false,
        accessLevel: "PROJECT_MANAGER",
        financeAccess: true,
      })
    );

    expect(access.permissions.settings).toBe(false);
    expect(access.isProjectManager).toBe(false);
  });

  it("can_create_projects_from_templates is exposed for non-guest members", () => {
    const access = buildProjectAccess(
      memberCtx({ canCreateProjectsFromTemplates: true })
    );
    expect(access.canCreateProjectsFromTemplates).toBe(true);

    const guest = buildProjectAccess(
      memberCtx({
        isGuest: true,
        canCreateProjectsFromTemplates: true,
      })
    );
    expect(guest.canCreateProjectsFromTemplates).toBe(false);
  });
});

describe("getProjectAccessForRequest cache", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("caches by project id on the request", async () => {
    mockedDb.query.mockResolvedValue({
      rows: [
        {
          team_role: "Member",
          is_guest: false,
          active: true,
          access_level: "PROJECT_MANAGER",
          finance_access: false,
          can_create_projects_from_templates: false,
          is_project_member: true,
          project_team_id: "team-1",
        },
      ],
      rowCount: 1,
      command: "",
      oid: 0,
      fields: [],
    } as any);

    const user = {
      id: "user-1",
      team_id: "team-1",
      role_name: "Member",
    } as IPassportSession;

    const req = { user } as IWorkLenzRequest;

    const first = await getProjectAccessForRequest(req, "project-a");
    const second = await getProjectAccessForRequest(req, "project-a");

    expect(first).toBe(second);
    expect(mockedDb.query).toHaveBeenCalledTimes(1);
    expect(first.isProjectManager).toBe(true);
    expect(first.permissions.settings).toBe(true);
  });
});
