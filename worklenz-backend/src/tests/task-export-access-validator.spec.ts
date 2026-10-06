/**
 * TE-33: Non-authorized users cannot trigger export (permission decision).
 * Middleware wraps this after loading PM / team-lead flags from DB.
 */
jest.unmock("../services/task-export/task-export-access");

import { hasTaskExportPermission } from "../services/task-export/task-export-access";

describe("hasTaskExportPermission (TE-33)", () => {
  const member = {
    owner: false,
    is_admin: false,
    team_member_id: "tm-member",
  };

  it("rejects missing user", () => {
    expect(
      hasTaskExportPermission({
        user: null,
        projectManagerTeamMemberId: "tm-member",
        isTeamLeadMember: true,
      })
    ).toBe(false);
  });

  it("rejects a regular member (not owner/admin/PM/team lead)", () => {
    expect(
      hasTaskExportPermission({
        user: member,
        projectManagerTeamMemberId: "tm-other",
        isTeamLeadMember: false,
      })
    ).toBe(false);
  });

  it("allows team owner", () => {
    expect(
      hasTaskExportPermission({
        user: { ...member, owner: true },
        isTeamLeadMember: false,
      })
    ).toBe(true);
  });

  it("allows team admin", () => {
    expect(
      hasTaskExportPermission({
        user: { ...member, is_admin: true },
        isTeamLeadMember: false,
      })
    ).toBe(true);
  });

  it("allows project manager for the project", () => {
    expect(
      hasTaskExportPermission({
        user: member,
        projectManagerTeamMemberId: "tm-member",
        isTeamLeadMember: false,
      })
    ).toBe(true);
  });

  it("allows team lead", () => {
    expect(
      hasTaskExportPermission({
        user: member,
        projectManagerTeamMemberId: null,
        isTeamLeadMember: true,
      })
    ).toBe(true);
  });

  it("does not treat a different PM id as authorized", () => {
    expect(
      hasTaskExportPermission({
        user: member,
        projectManagerTeamMemberId: "tm-someone-else",
        isTeamLeadMember: false,
      })
    ).toBe(false);
  });
});
