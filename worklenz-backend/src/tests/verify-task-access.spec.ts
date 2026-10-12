jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
}));

jest.mock("../shared/assignee-task-scope", () => ({
  canUserAccessTaskDetail: jest.fn(),
  canUserEditTask: jest.fn(),
  TASK_ASSIGNEE_READONLY_CODE: "TASK_ASSIGNEE_READONLY",
  TASK_ASSIGNEE_RESTRICTED_CODE: "TASK_ASSIGNEE_RESTRICTED",
}));

import db from "../config/db";
import {
  canUserAccessTaskDetail,
  canUserEditTask,
} from "../shared/assignee-task-scope";
import verifyTaskAccess from "../middlewares/verify-task-access";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedDb = db as jest.Mocked<typeof db>;
const mockedCanAccess = canUserAccessTaskDetail as jest.MockedFunction<
  typeof canUserAccessTaskDetail
>;
const mockedCanEdit = canUserEditTask as jest.MockedFunction<typeof canUserEditTask>;

const TASK_ID = "task-b";
const PROJECT_ID = "project-b";
const SOURCE_TEAM_ID = "team-a";
const TARGET_TEAM_ID = "team-b";

const activateTeamWasCalled = () =>
  mockedDb.query.mock.calls.some((call) =>
    String(call[0]).includes("activate_team")
  );

const mockCrossTeamMemberLookup = () => {
  mockedDb.query
    .mockResolvedValueOnce(
      createQueryResult([{ project_id: PROJECT_ID, project_team_id: TARGET_TEAM_ID }])
    )
    .mockResolvedValueOnce(
      createQueryResult([
        {
          id: "tm-b",
          owner: false,
          admin_role: false,
          name: "Member",
          is_guest: false,
        },
      ])
    )
    .mockResolvedValueOnce(createQueryResult([]))
    .mockResolvedValueOnce(createQueryResult([{ ok: 1 }]));
};

describe("verifyTaskAccess auto team switch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const ownerOnAnotherTeam = () =>
    createMockRequest({
      user: {
        id: "user-1",
        team_id: SOURCE_TEAM_ID,
        team_member_id: "tm-a",
        owner: true,
        is_admin: true,
        role_name: "Owner",
        is_guest: false,
      },
      params: { id: TASK_ID },
    });

  it("does not activate the target team when assignee scope denies the task", async () => {
    mockCrossTeamMemberLookup();
    mockedCanAccess.mockImplementation(async (_userId, _taskId, session) => {
      expect(activateTeamWasCalled()).toBe(false);
      expect(session?.team_id).toBe(TARGET_TEAM_ID);
      expect(session?.owner).toBe(false);
      expect(session?.is_admin).toBe(false);
      expect(session?.role_name).toBe("Member");
      expect(session?.team_member_id).toBe("tm-b");
      return false;
    });

    const req = ownerOnAnotherTeam();
    const res = createMockResponse();
    const next = jest.fn();

    await verifyTaskAccess("params", "id")(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.body).toEqual({ code: "TASK_ASSIGNEE_RESTRICTED" });
    expect(activateTeamWasCalled()).toBe(false);
    expect(req.user.team_id).toBe(SOURCE_TEAM_ID);
    expect(req.user.owner).toBe(true);
    expect(req.user.role_name).toBe("Owner");
    expect(next).not.toHaveBeenCalled();
    expect(mockedCanEdit).not.toHaveBeenCalled();
  });

  it("activates the target team only after task detail access is allowed", async () => {
    mockCrossTeamMemberLookup();
    mockedDb.query.mockResolvedValueOnce(createQueryResult([{ activate_team: null }]));
    mockedCanAccess.mockImplementation(async (_userId, _taskId, session) => {
      expect(activateTeamWasCalled()).toBe(false);
      expect(session?.team_id).toBe(TARGET_TEAM_ID);
      expect(session?.role_name).toBe("Member");
      expect(session?.owner).toBe(false);
      return true;
    });

    const req = ownerOnAnotherTeam();
    const res = createMockResponse();
    const next = jest.fn();

    await verifyTaskAccess("params", "id")(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(activateTeamWasCalled()).toBe(true);
    const activateCall = mockedDb.query.mock.calls.find((call) =>
      String(call[0]).includes("activate_team")
    );
    expect(activateCall?.[1]).toEqual([TARGET_TEAM_ID, "user-1"]);
    expect(req.user.team_id).toBe(TARGET_TEAM_ID);
    expect(req.user.team_member_id).toBe("tm-b");
    expect(req.user.owner).toBe(false);
    expect(req.user.is_admin).toBe(false);
    expect(req.user.role_name).toBe("Member");
  });

  it("does not activate the target team when a mutation is read-only under assignee scope", async () => {
    mockCrossTeamMemberLookup();
    mockedCanAccess.mockResolvedValue(true);
    mockedCanEdit.mockImplementation(async (_userId, _taskId, session) => {
      expect(activateTeamWasCalled()).toBe(false);
      expect(session?.team_id).toBe(TARGET_TEAM_ID);
      expect(session?.role_name).toBe("Member");
      return false;
    });

    const req = ownerOnAnotherTeam();
    req.method = "PUT";
    const res = createMockResponse();
    const next = jest.fn();

    await verifyTaskAccess("params", "id")(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body.body).toEqual({ code: "TASK_ASSIGNEE_READONLY" });
    expect(activateTeamWasCalled()).toBe(false);
    expect(req.user.team_id).toBe(SOURCE_TEAM_ID);
    expect(req.user.owner).toBe(true);
    expect(next).not.toHaveBeenCalled();
  });
});
