/**
 * Organization "Create projects" grants for non-admin roles.
 */

jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  getOrganizationPermissions,
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

const session = (partial: Partial<IPassportSession>): IPassportSession =>
  ({
    team_id: "team-1",
    owner: false,
    is_admin: false,
    is_guest: false,
    ...partial,
  }) as IPassportSession;

describe("getOrganizationPermissions — Create projects", () => {
  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
  });

  it("includes Create projects when granted to Member", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.CREATE_PROJECTS, granted: true }],
    });

    const permissions = await getOrganizationPermissions(
      session({ role_name: "Member" })
    );

    expect(permissions).toContain(ORGANIZATION_PERMISSIONS.CREATE_PROJECTS);
  });

  it("includes Create projects when granted to Guest", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.CREATE_PROJECTS, granted: true }],
    });

    const permissions = await getOrganizationPermissions(
      session({ role_name: "Member", is_guest: true })
    );

    expect(permissions).toContain(ORGANIZATION_PERMISSIONS.CREATE_PROJECTS);
  });

  it("includes Create projects for Team Lead by default when nothing is saved", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const permissions = await getOrganizationPermissions(
      session({ role_name: "Team Lead" })
    );

    expect(permissions).toContain(ORGANIZATION_PERMISSIONS.CREATE_PROJECTS);
  });

  it("excludes Create projects when not granted to Member", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    const permissions = await getOrganizationPermissions(
      session({ role_name: "Member" })
    );

    expect(permissions).not.toContain(ORGANIZATION_PERMISSIONS.CREATE_PROJECTS);
  });
});
