import db from "../config/db";
import {NotificationsService} from "../services/notifications/notifications.service";
import {NotificationTypes} from "../services/notifications/notification-types";
import {sendTaskDone} from "../shared/email-notifications";
import {notifyTaskDoneSubscribers} from "../pg_notify_listeners/db-task-status-changed";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {query: jest.fn()},
}));

jest.mock("../services/notifications/notifications.service", () => ({
  NotificationsService: {createNotification: jest.fn()},
}));

jest.mock("../shared/email-notifications", () => ({
  sendTaskDone: jest.fn(),
}));

jest.mock("../cron_jobs/helpers", () => ({
  getBaseUrl: () => "https://app.worklenz.test",
}));

const mockedQuery = db.query as jest.Mock;
const mockedCreateNotification = NotificationsService.createNotification as jest.Mock;
const mockedSendTaskDone = sendTaskDone as jest.Mock;

describe("notifyTaskDoneSubscribers", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("sends both in-app notification and email for each subscriber", async () => {
    mockedQuery.mockResolvedValue({
      rows: [
        {
          user_id: "user-1",
          socket_id: "socket-1",
          team_id: "team-1",
          task_name: "Ship release",
          user_name: "Alex",
          task_id: "task-1",
          email: "alex@example.com",
          project_id: "project-1",
          team_name: "Core",
          members: "Alex, Sam",
          project_name: "Worklenz",
        },
      ],
    });

    await notifyTaskDoneSubscribers("task-1");

    expect(mockedCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        teamId: "team-1",
        socketId: "socket-1",
        taskId: "task-1",
        projectId: "project-1",
        messageKey: "notifications.taskMarkedDone",
        notificationTypeKey: NotificationTypes.TASK_MARKED_DONE,
        messageParams: {task: "Ship release"},
      })
    );

    expect(mockedSendTaskDone).toHaveBeenCalledWith(
      ["alex@example.com"],
      expect.objectContaining({
        greeting: "Hi Alex",
        summary: "Great news! a task just got completed!",
        task: expect.objectContaining({
          name: "Ship release",
          project_name: "Worklenz",
        }),
      })
    );
  });

  it("skips in-app notification when required ids are missing but still emails when possible", async () => {
    mockedQuery.mockResolvedValue({
      rows: [
        {
          user_id: null,
          socket_id: null,
          team_id: null,
          task_name: "Incomplete row",
          user_name: "Pat",
          task_id: "task-2",
          email: "pat@example.com",
          project_id: null,
          team_name: "Core",
          members: null,
          project_name: "Worklenz",
        },
      ],
    });

    await notifyTaskDoneSubscribers("task-2");

    expect(mockedCreateNotification).not.toHaveBeenCalled();
    expect(mockedSendTaskDone).toHaveBeenCalledWith(
      ["pat@example.com"],
      expect.objectContaining({
        greeting: "Hi Pat",
      })
    );
  });
  it("limits the subscriber query to users who still belong to the task project", async () => {
    mockedQuery.mockResolvedValue({rows: []});

    await notifyTaskDoneSubscribers("task-1");

    const [sql] = mockedQuery.mock.calls[0];
    expect(sql).toContain("FROM project_members pm");
    expect(sql).toContain("pm.team_member_id = ts.team_member_id");
    expect(sql).toContain("pm.project_id = t.project_id");
  });

});
