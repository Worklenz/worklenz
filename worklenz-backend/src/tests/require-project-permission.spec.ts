/**
 * Phase 2 — requireProjectPermission + project access enforcement helpers.
 */

jest.unmock("../../shared/project-access");
jest.unmock("../../shared/team-permissions");
jest.unmock("../../middlewares/validators/require-project-permission");

jest.mock("../../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import {
  hasProjectPermission,
  resolveRequestProjectId,
} from "../../middlewares/validators/require-project-permission";
import { buildProjectAccess } from "../../shared/project-access";
import { TEAM_ROLE_NAMES } from "../../shared/team-permissions";
import { IWorkLenzRequest } from "../../interfaces/worklenz-request";

describe("require-project-permission helpers", () => {
  it("resolves project id preferring current_project_id", () => {
    const req = {
      query: { current_project_id: "proj-a", project_id: "proj-b" },
      body: { project_id: "proj-c" },
      params: { id: "proj-d" },
    } as unknown as IWorkLenzRequest;

    expect(resolveRequestProjectId(req)).toBe("proj-a");
  });

  it("falls back through body and params", () => {
    const req = {
      query: {},
      body: { project_id: "proj-body" },
      params: { projectId: "proj-param" },
    } as unknown as IWorkLenzRequest;

    expect(resolveRequestProjectId(req)).toBe("proj-body");
  });
});

describe("Phase 2 permission matrix (Member PM vs Member)", () => {
  it("Member+PM on A has settings/statuses/members; not delete/assignPm", () => {
    const pm = buildProjectAccess({
      teamRole: TEAM_ROLE_NAMES.MEMBER,
      isGuest: false,
      isActive: true,
      accessLevel: "PROJECT_MANAGER",
      financeAccess: false,
      canCreateProjectsFromTemplates: false,
      isProjectMember: true,
    });

    expect(hasProjectPermission(pm.permissions, "settings")).toBe(true);
    expect(hasProjectPermission(pm.permissions, "statuses")).toBe(true);
    expect(hasProjectPermission(pm.permissions, "phases")).toBe(true);
    expect(hasProjectPermission(pm.permissions, "customColumns")).toBe(true);
    expect(hasProjectPermission(pm.permissions, "members.add")).toBe(true);
    expect(hasProjectPermission(pm.permissions, "members.removeMember")).toBe(true);
    expect(hasProjectPermission(pm.permissions, "delete")).toBe(false);
    expect(hasProjectPermission(pm.permissions, "archive")).toBe(false);
    expect(hasProjectPermission(pm.permissions, "move")).toBe(false);
    expect(hasProjectPermission(pm.permissions, "assignPm")).toBe(false);
    expect(hasProjectPermission(pm.permissions, "finance")).toBe(false);
  });

  it("plain Member on B is denied settings and member management", () => {
    const member = buildProjectAccess({
      teamRole: TEAM_ROLE_NAMES.MEMBER,
      isGuest: false,
      isActive: true,
      accessLevel: "MEMBER",
      financeAccess: false,
      canCreateProjectsFromTemplates: false,
      isProjectMember: true,
    });

    expect(hasProjectPermission(member.permissions, "settings")).toBe(false);
    expect(hasProjectPermission(member.permissions, "statuses")).toBe(false);
    expect(hasProjectPermission(member.permissions, "members.add")).toBe(false);
    expect(hasProjectPermission(member.permissions, "delete")).toBe(false);
  });
});
