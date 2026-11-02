/**
 * Template-create access helpers.
 */

jest.unmock("../shared/template-create-access");
jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  userCanCreateProjectsFromTemplates,
  userCanCreateProjectsFromTemplatesAsync,
} from "../shared/template-create-access";
import { ORGANIZATION_PERMISSIONS } from "../shared/organization-permissions";
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
  partial as IPassportSession;

describe("template-create-access", () => {
  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
  });

  it("allows Owner (sync)", () => {
    expect(
      userCanCreateProjectsFromTemplates(session({ owner: true }))
    ).toBe(true);
  });

  it("allows Admin (sync)", () => {
    expect(
      userCanCreateProjectsFromTemplates(session({ is_admin: true }))
    ).toBe(true);
  });

  it("denies Member even when the legacy flag is set (sync)", () => {
    expect(
      userCanCreateProjectsFromTemplates(
        session({ can_create_projects_from_templates: true })
      )
    ).toBe(false);
  });

  it("allows Member with Create projects (async)", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({
      rows: [{ permission: ORGANIZATION_PERMISSIONS.CREATE_PROJECTS, granted: true }],
    });

    await expect(
      userCanCreateProjectsFromTemplatesAsync(
        session({
          team_id: "team-1",
          role_name: "Member",
          owner: false,
          is_admin: false,
        })
      )
    ).resolves.toBe(true);
  });

  it("denies Member without Create projects (async)", async () => {
    (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows: [] });

    await expect(
      userCanCreateProjectsFromTemplatesAsync(
        session({
          team_id: "team-1",
          role_name: "Member",
          owner: false,
          is_admin: false,
        })
      )
    ).resolves.toBe(false);
  });

  it("denies missing user", async () => {
    expect(userCanCreateProjectsFromTemplates(null)).toBe(false);
    expect(userCanCreateProjectsFromTemplates(undefined)).toBe(false);
    await expect(userCanCreateProjectsFromTemplatesAsync(null)).resolves.toBe(false);
    await expect(userCanCreateProjectsFromTemplatesAsync(undefined)).resolves.toBe(false);
  });
});
