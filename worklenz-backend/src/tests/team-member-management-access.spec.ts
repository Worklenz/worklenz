jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  hasTeamMemberManagementAccess,
  ORGANIZATION_PERMISSIONS,
} from "../shared/organization-permissions";
import { IPassportSession } from "../interfaces/passport-session";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

import db from "../config/db";

const mockedDb = db as jest.Mocked<typeof db>;

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
