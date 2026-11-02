/**
 * View-all non-members receive scheme Create/Edit/Delete/Comment grants.
 */

jest.unmock("../shared/project-role-permissions");
jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  getProjectRolePermissionFlags,
} from "../shared/project-role-permissions";
import {
  ORGANIZATION_PERMISSIONS,
  PROJECT_ROLE_PERMISSIONS,
} from "../shared/organization-permissions";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from "../config/db";

const mockedDb = db as jest.Mocked<typeof db>;

const memberRow = {
  team_id: "team-1",
  project_id: "project-1",
  role_name: "Member",
  owner: false,
  is_team_guest: false,
  is_project_member: false,
  is_project_guest: false,
};

describe("getProjectRolePermissionFlags — View all projects", () => {
  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
  });

  it("denies task actions for non-member without View all projects", async () => {
    (mockedDb.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [memberRow] })
      .mockResolvedValueOnce({ rows: [] }); // no View all projects grant

    const flags = await getProjectRolePermissionFlags("user-1", "project-1");

    expect(flags).toEqual({
      create_tasks: false,
      edit_tasks: false,
      delete_tasks: false,
      comment: false,
    });
  });

  it("keeps View-all non-member view-only even if scheme grants task actions to role", async () => {
    (mockedDb.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [memberRow] })
      .mockResolvedValueOnce({
        rows: [{ permission: ORGANIZATION_PERMISSIONS.VIEW_ALL_PROJECTS, granted: true }],
      });

    const flags = await getProjectRolePermissionFlags("user-1", "project-1");

    expect(flags).toEqual({
      create_tasks: false,
      edit_tasks: false,
      delete_tasks: false,
      comment: false,
    });
  });

  it("stays view-only for View-all non-member when task actions are revoked", async () => {
    (mockedDb.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [memberRow] })
      .mockResolvedValueOnce({
        rows: [{ permission: ORGANIZATION_PERMISSIONS.VIEW_ALL_PROJECTS, granted: true }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            permission: PROJECT_ROLE_PERMISSIONS.CREATE_TASKS,
            granted: false,
            is_default: true,
          },
          {
            permission: PROJECT_ROLE_PERMISSIONS.EDIT_TASKS,
            granted: false,
            is_default: true,
          },
          {
            permission: PROJECT_ROLE_PERMISSIONS.DELETE_TASKS,
            granted: false,
            is_default: true,
          },
          {
            permission: PROJECT_ROLE_PERMISSIONS.COMMENT,
            granted: false,
            is_default: true,
          },
        ],
      });

    const flags = await getProjectRolePermissionFlags("user-1", "project-1");

    expect(flags).toEqual({
      create_tasks: false,
      edit_tasks: false,
      delete_tasks: false,
      comment: false,
    });
  });
});
