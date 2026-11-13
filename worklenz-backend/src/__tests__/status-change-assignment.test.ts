import { Server, Socket } from "socket.io";
import db from "../config/db";
import { SocketEvents } from "../socket.io/events";
import { on_task_status_change } from "../socket.io/commands/on-task-status-change";
import { on_task_sort_order_change } from "../socket.io/commands/on-task-sort-order-change";
import { assignMemberIfNot } from "../socket.io/commands/on-quick-assign-or-remove";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../controllers/tasks-controller-v2", () => ({ __esModule: true, default: {
  checkForCompletedDependencies: jest.fn().mockResolvedValue(true),
  checkUserAssignedToTask: jest.fn().mockResolvedValue(false),
  getTaskCompleteRatio: jest.fn().mockResolvedValue({ ratio: 0, total_completed: 0, total_tasks: 1 }),
} }));
jest.mock("../controllers/tasks-controller", () => ({ __esModule: true, default: { notifyStatusChange: jest.fn() } }));
jest.mock("../socket.io/commands/on-quick-assign-or-remove", () => ({ assignMemberIfNot: jest.fn() }));
jest.mock("../socket.io/authorization", () => ({ verifyNonGuestTaskAccessSocket: jest.fn().mockResolvedValue(true), verifyNonGuestProjectAccessSocket: jest.fn().mockResolvedValue(true), logUnauthorizedSocketAccess: jest.fn() }));
jest.mock("../socket.io/util", () => ({ getLoggedInUserIdFromSocket: jest.fn().mockReturnValue("user-1"), notifyProjectUpdates: jest.fn(), log_error: jest.fn() }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
jest.mock("../shared/assignee-task-scope", () => ({ canUserEditTask: jest.fn().mockResolvedValue(true), isAssigneeScopeEditRestrictedForTask: jest.fn().mockResolvedValue(false) }));
jest.mock("../shared/phase-completion-guard", () => ({ checkPhaseCompletionGuard: jest.fn().mockResolvedValue({ blocked: false }) }));
jest.mock("../shared/phase-auto-advance", () => ({ autoAdvanceToNextPhase: jest.fn() }));
jest.mock("../services/reporting-analytics/task-status-history.service", () => ({ recordTaskStatusHistory: jest.fn() }));
jest.mock("../services/activity-logs/activity-logs.service", () => ({ getTaskDetails: jest.fn().mockResolvedValue({ status_id: "old-status" }), logStatusChange: jest.fn(), logPhaseChange: jest.fn(), logPriorityChange: jest.fn(), logProgressChange: jest.fn() }));
jest.mock("../services/notifications/notifications.service", () => ({ NotificationsService: { createNotification: jest.fn() } }));
jest.mock("../services/external-notifications.service", () => ({ ExternalNotificationsService: { sendExternalNotifications: jest.fn() } }));

const makeSocket = () => ({ emit: jest.fn(), request: { session: { passport: { user: { id: "user-1" } } } } }) as unknown as Socket;

beforeEach(() => {
  jest.clearAllMocks();
  (db.query as jest.Mock).mockReset();
});

describe("status changes preserve task assignees", () => {
  it("updates the status from the task drawer without assigning the acting user", async () => {
    (db.query as jest.Mock)
      .mockResolvedValueOnce({ rows: [{ res: { color_code: "#fff", status_category: { is_done: false }, members: [] } }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ name: "Doing" }] })
      .mockResolvedValueOnce({ rows: [{ name: "User" }] })
      .mockResolvedValueOnce({ rows: [{ project_id: "project-1" }] });
    const socket = makeSocket();
    await on_task_status_change({} as Server, socket, JSON.stringify({ task_id: "task-1", status_id: "new-status", team_id: "team-1" }));
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.TASK_STATUS_CHANGE.toString(), expect.objectContaining({ id: "task-1", status_id: "new-status" }));
    expect(assignMemberIfNot).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalledWith(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), expect.anything());
  });

  it.each([false, true])("reorders a task by status without assigning the acting user (bulk: %s)", async isBulk => {
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
    const socket = makeSocket();
    const request = {
      from_index: 0, to_index: 1, project_id: "project-1", from_group: "old-status", to_group: "new-status",
      group_by: "status", to_last_index: false, team_id: "team-1",
      task: { id: "task-1", project_id: "project-1", status: "old-status", priority: "priority-1" },
      ...(isBulk ? { task_updates: [{ task_id: "task-1", sort_order: 1, status_id: "new-status" }] } : {}),
    };
    await on_task_sort_order_change({} as Server, socket, request);
    expect(db.query).toHaveBeenCalledWith(expect.stringContaining(isBulk ? "update_task_sort_orders_bulk" : "handle_task_list_sort_order_change"), expect.any(Array));
    expect(socket.emit).toHaveBeenCalledWith(SocketEvents.TASK_SORT_ORDER_CHANGE.toString(), []);
    expect(assignMemberIfNot).not.toHaveBeenCalled();
    expect(socket.emit).not.toHaveBeenCalledWith(SocketEvents.QUICK_ASSIGNEES_UPDATE.toString(), expect.anything());
  });
});
