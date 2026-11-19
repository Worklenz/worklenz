import { on_get_task_progress } from "../socket.io/commands/on-get-task-progress";
import { on_task_subscriber_change } from "../socket.io/commands/on-task-subscriber-change";
import { verifyTaskAccessSocket } from "../socket.io/authorization";
import { getLoggedInUserIdFromSocket } from "../socket.io/util";
import { canUserEditTask } from "../shared/assignee-task-scope";
import { checkTaskRolePermission } from "../shared/project-role-permissions";
import db from "../config/db";

jest.mock("../socket.io/authorization", () => ({
  verifyTaskAccessSocket: jest.fn(),
  logUnauthorizedSocketAccess: jest.fn()
}));

jest.mock("../socket.io/util", () => ({
  getLoggedInUserIdFromSocket: jest.fn(),
  log_error: jest.fn()
}));

jest.mock("../shared/assignee-task-scope", () => ({
  canUserEditTask: jest.fn()
}));

jest.mock("../shared/project-role-permissions", () => ({
  checkTaskRolePermission: jest.fn()
}));

jest.mock("../controllers/tasks-controller-v2", () => ({
  __esModule: true,
  default: {
    getTaskCompleteRatio: jest.fn().mockResolvedValue({ ratio: 50, total_completed: 1, total_tasks: 2 }),
    getTaskSubscribers: jest.fn().mockResolvedValue([])
  }
}));

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { query: jest.fn() }
}));

const mockVerify = verifyTaskAccessSocket as jest.MockedFunction<typeof verifyTaskAccessSocket>;
const mockGetUserId = getLoggedInUserIdFromSocket as jest.MockedFunction<typeof getLoggedInUserIdFromSocket>;
const mockCanEdit = canUserEditTask as jest.MockedFunction<typeof canUserEditTask>;
const mockRolePerm = checkTaskRolePermission as jest.MockedFunction<typeof checkTaskRolePermission>;
const mockDb = db.query as jest.MockedFunction<typeof db.query>;

describe("socket task security", () => {
  let socket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    socket = {
      emit: jest.fn(),
      request: {}
    };
    mockCanEdit.mockResolvedValue(true);
    mockRolePerm.mockResolvedValue({ allowed: true });
  });

  describe("on_get_task_progress", () => {
    it("denies access and emits null when user is not logged in", async () => {
      mockGetUserId.mockReturnValue(undefined);

      await on_get_task_progress({} as any, socket, "task-1");

      expect(socket.emit).toHaveBeenCalledWith("17", null);
      expect(mockVerify).not.toHaveBeenCalled();
    });

    it("denies access and emits null when user lacks task access", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(false);

      await on_get_task_progress({} as any, socket, "task-1");

      expect(socket.emit).toHaveBeenCalledWith("17", null);
    });

    it("returns progress when user has task access", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(true);

      await on_get_task_progress({} as any, socket, "task-1");

      expect(socket.emit).toHaveBeenCalledWith("17", expect.objectContaining({
        id: "task-1",
        complete_ratio: 50
      }));
    });
  });

  describe("on_task_subscriber_change", () => {
    it("rejects when user is not logged in", async () => {
      mockGetUserId.mockReturnValue(undefined);

      await on_task_subscriber_change({} as any, socket, {
        mode: 0,
        task_id: "task-1",
        user_id: "user-1",
        team_member_id: "tm-1"
      });

      expect(mockDb).not.toHaveBeenCalled();
    });

    it("rejects when user lacks task access", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(false);

      await on_task_subscriber_change({} as any, socket, {
        mode: 0,
        task_id: "task-1",
        user_id: "user-1",
        team_member_id: "tm-1"
      });

      expect(mockDb).not.toHaveBeenCalled();
      expect(socket.emit).toHaveBeenCalledWith("23", expect.any(Array));
    });

    it("rejects when team member does not belong to the task's project", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(true);
      // memberCheck query returns no rows
      mockDb.mockResolvedValueOnce({ rowCount: 0, rows: [] } as any);

      await on_task_subscriber_change({} as any, socket, {
        mode: 0,
        task_id: "task-1",
        user_id: "user-1",
        team_member_id: "tm-other"
      });

      expect(mockDb).toHaveBeenCalledTimes(1);
      expect(socket.emit).toHaveBeenCalledWith("23", expect.any(Array));
    });

    it("rejects when modifying another user without task edit permissions", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(true);
      // memberCheck query finds team member belonging to another user
      mockDb.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "tm-2", user_id: "other-user" }]
      } as any);
      mockCanEdit.mockResolvedValue(false);

      await on_task_subscriber_change({} as any, socket, {
        mode: 0,
        task_id: "task-1",
        user_id: "other-user",
        team_member_id: "tm-2"
      });

      expect(mockDb).toHaveBeenCalledTimes(1); // Only the check query, not the INSERT query
      expect(socket.emit).toHaveBeenCalledWith("23", expect.any(Array));
    });

    it("allows subscribing self when authorized", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(true);
      // memberCheck query
      mockDb.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "tm-1", user_id: "user-1" }]
      } as any);
      // insert query
      mockDb.mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);

      await on_task_subscriber_change({} as any, socket, {
        mode: 0,
        task_id: "task-1",
        user_id: "user-1",
        team_member_id: "tm-1"
      });

      expect(mockDb).toHaveBeenCalledTimes(2);
      expect(socket.emit).toHaveBeenCalledWith("23", expect.any(Array));
    });

    it("allows subscribing another member when user has edit permissions", async () => {
      mockGetUserId.mockReturnValue("user-1");
      mockVerify.mockResolvedValue(true);
      mockDb.mockResolvedValueOnce({
        rowCount: 1,
        rows: [{ id: "tm-2", user_id: "user-2" }]
      } as any);
      mockCanEdit.mockResolvedValue(true);
      mockRolePerm.mockResolvedValue({ allowed: true });
      mockDb.mockResolvedValueOnce({ rowCount: 1, rows: [] } as any);

      await on_task_subscriber_change({} as any, socket, {
        mode: 0,
        task_id: "task-1",
        user_id: "user-2",
        team_member_id: "tm-2"
      });

      expect(mockDb).toHaveBeenCalledTimes(2);
      expect(socket.emit).toHaveBeenCalledWith("23", expect.any(Array));
    });
  });
});
