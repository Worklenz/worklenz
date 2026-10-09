/**
 * Task work log manage access — own log, Owner/Admin, or PM on that project.
 */

jest.unmock("../shared/task-work-log-access");
jest.unmock("../shared/team-permissions");

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../shared/project-access", () => ({
  getProjectAccess: jest.fn(),
}));

jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
}));

import db from "../config/db";
import { getProjectAccess } from "../shared/project-access";
import { resolveTaskWorkLogManageAccess } from "../shared/task-work-log-access";
import { IPassportSession } from "../interfaces/passport-session";

const mockedDb = db as jest.Mocked<typeof db>;
const mockedGetProjectAccess = getProjectAccess as jest.MockedFunction<
  typeof getProjectAccess
>;

const session = (partial: Partial<IPassportSession>): IPassportSession =>
  partial as IPassportSession;

const LOG_ROW = {
  id: "log-1",
  task_id: "task-1",
  user_id: "owner-user",
  project_id: "project-1",
  team_id: "team-1",
};

describe("resolveTaskWorkLogManageAccess", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null when work log id or user is missing", async () => {
    expect(await resolveTaskWorkLogManageAccess("", session({ id: "u1" }))).toBeNull();
    expect(await resolveTaskWorkLogManageAccess("log-1", undefined)).toBeNull();
  });

  it("returns null when work log does not exist", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [] } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "u1", team_id: "team-1" })
    );

    expect(result).toBeNull();
  });

  it("allows the log owner", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [LOG_ROW] } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "owner-user", team_id: "team-1" })
    );

    expect(result?.canManage).toBe(true);
    expect(mockedGetProjectAccess).not.toHaveBeenCalled();
  });

  it("allows team Admin without being the log owner", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [LOG_ROW] } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "admin-user", team_id: "team-1", is_admin: true })
    );

    expect(result?.canManage).toBe(true);
    expect(mockedGetProjectAccess).not.toHaveBeenCalled();
  });

  it("allows team Owner without being the log owner", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [LOG_ROW] } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "owner", team_id: "team-1", owner: true })
    );

    expect(result?.canManage).toBe(true);
  });

  it("allows Project Manager on the log's project", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [LOG_ROW] } as never);
    mockedGetProjectAccess.mockResolvedValueOnce({
      isProjectManager: true,
    } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "pm-user", team_id: "team-1" })
    );

    expect(result?.canManage).toBe(true);
    expect(mockedGetProjectAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: "pm-user" }),
      "project-1"
    );
  });

  it("denies plain Member who is not PM and not the log owner", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [LOG_ROW] } as never);
    mockedGetProjectAccess.mockResolvedValueOnce({
      isProjectManager: false,
    } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "member-user", team_id: "team-1" })
    );

    expect(result?.canManage).toBe(false);
  });

  it("denies when user team does not match log project team", async () => {
    mockedDb.query.mockResolvedValueOnce({ rows: [LOG_ROW] } as never);

    const result = await resolveTaskWorkLogManageAccess(
      "log-1",
      session({ id: "other-team-user", team_id: "team-other" })
    );

    expect(result?.canManage).toBe(false);
    expect(mockedGetProjectAccess).not.toHaveBeenCalled();
  });
});
