jest.unmock("../shared/organization-permissions");
jest.unmock("../shared/team-permissions");

import {
  getProjectSchemeRoleGrants,
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

interface IGrantRow {
  permission: string;
  granted: boolean;
  is_default: boolean;
}

const mockGrantRows = (rows: IGrantRow[]) => {
  (mockedDb.query as jest.Mock).mockResolvedValueOnce({ rows });
};

const { CREATE_TASKS, EDIT_TASKS } = PROJECT_ROLE_PERMISSIONS;

describe("getProjectSchemeRoleGrants — Create tasks", () => {
  beforeEach(() => {
    (mockedDb.query as jest.Mock).mockReset();
  });

  it("falls back to DEFAULT_GRANTS when nothing is saved", async () => {
    mockGrantRows([]);
    await expect(getProjectSchemeRoleGrants("team", "project", "Member", [CREATE_TASKS])).resolves.toEqual([
      CREATE_TASKS,
    ]);

    mockGrantRows([]);
    await expect(getProjectSchemeRoleGrants("team", "project", "Guest", [CREATE_TASKS])).resolves.toEqual([]);
  });

  it("inherits the saved Edit tasks grant until Create tasks is saved", async () => {
    mockGrantRows([{ permission: EDIT_TASKS, granted: true, is_default: true }]);
    await expect(getProjectSchemeRoleGrants("team", "project", "Guest", [CREATE_TASKS])).resolves.toEqual([
      CREATE_TASKS,
    ]);
  });

  it("uses the saved Create tasks grant over Edit tasks", async () => {
    mockGrantRows([
      { permission: EDIT_TASKS, granted: true, is_default: true },
      { permission: CREATE_TASKS, granted: false, is_default: true },
    ]);
    await expect(getProjectSchemeRoleGrants("team", "project", "Member", [CREATE_TASKS])).resolves.toEqual([]);
  });

  it("lets the project's scheme override the default scheme", async () => {
    mockGrantRows([
      { permission: CREATE_TASKS, granted: false, is_default: true },
      { permission: CREATE_TASKS, granted: true, is_default: false },
    ]);
    await expect(getProjectSchemeRoleGrants("team", "project", "Guest", [CREATE_TASKS])).resolves.toEqual([
      CREATE_TASKS,
    ]);
  });

  it("queries the source permission alongside the requested one", async () => {
    mockGrantRows([]);
    await getProjectSchemeRoleGrants("team", "project", "Member", [CREATE_TASKS]);
    const params = (mockedDb.query as jest.Mock).mock.calls[0][1];
    expect(params[3]).toEqual([CREATE_TASKS, EDIT_TASKS]);
  });
});
