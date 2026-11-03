jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  getDefaultProjectPermissions,
  PROJECT_ROLE_PERMISSIONS,
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

describe("getDefaultProjectPermissions", () => {
  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
  });

  it("includes Archive project when granted to Member in the default scheme", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: PROJECT_ROLE_PERMISSIONS.ARCHIVE_PROJECT, granted: true }],
    });

    const permissions = await getDefaultProjectPermissions(memberSession);

    expect(permissions).toContain(PROJECT_ROLE_PERMISSIONS.ARCHIVE_PROJECT);
  });

  it("excludes Archive project when not granted to Member", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const permissions = await getDefaultProjectPermissions(memberSession);

    expect(permissions).not.toContain(PROJECT_ROLE_PERMISSIONS.ARCHIVE_PROJECT);
  });
});
