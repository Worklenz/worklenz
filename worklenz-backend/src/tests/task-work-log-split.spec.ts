const mockClient = {
  query: jest.fn().mockResolvedValue({ rows: [] }),
  release: jest.fn(),
};

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
  },
}));

jest.mock("../shared/io", () => ({
  __esModule: true,
  IO: {
    in: jest.fn().mockReturnThis(),
    emit: jest.fn(),
  },
}));

import db from "../config/db";
import TaskWorklogController from "../controllers/task-work-log-controller";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

const mockedDb = db as jest.Mocked<typeof db>;

describe("TaskWorklogController.splitTimeEntry", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.query.mockResolvedValue({ rows: [] } as any);
    mockedDb.connect.mockResolvedValue(mockClient as any);
    mockClient.query.mockResolvedValue({ rows: [] });
  });

  it("returns 400 when segment1 or segment2 is missing required fields", async () => {
    const req = createMockRequest({
      params: { id: "log-1" },
      body: {
        segment1: { seconds_spent: 3600 }, // missing formatted_start
        segment2: { seconds_spent: 3600, formatted_start: "2026-09-25T00:00:00.000Z" },
      },
    });
    const res = createMockResponse();

    await TaskWorklogController.splitTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.body.done).toBe(false);
  });

  it("returns 403 when user is not authorized to modify the log", async () => {
    mockedDb.query.mockResolvedValueOnce(createQueryResult([])); // No matching log

    const req = createMockRequest({
      user: { id: "user-unauthorized", team_id: "team-1", is_admin: false, owner: false },
      params: { id: "log-other-member" },
      body: {
        segment1: { seconds_spent: 50400, formatted_start: "2026-09-24T10:00:00.000Z" },
        segment2: { seconds_spent: 39600, formatted_start: "2026-09-25T00:00:00.000Z" },
      },
    });
    const res = createMockResponse();

    await TaskWorklogController.splitTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body.done).toBe(false);
    expect(res.body.message).toContain("You can only edit your own time entries");
  });

  it("preserves original member's user_id on segment 2 when an admin splits another member's log", async () => {
    const originalLog = {
      task_id: "task-original",
      user_id: "original-member-id", // Belongs to original member, NOT admin
    };
    mockedDb.query.mockResolvedValueOnce(createQueryResult([originalLog]));

    const adminUser = {
      id: "admin-id",
      team_id: "team-1",
      is_admin: true,
      owner: false,
    };

    const req = createMockRequest({
      user: adminUser,
      params: { id: "log-1" },
      body: {
        segment1: {
          seconds_spent: 50400,
          formatted_start: "2026-09-24T10:00:00.000Z",
          description: "Night shift by member",
        },
        segment2: {
          seconds_spent: 39600,
          formatted_start: "2026-09-25T00:00:00.000Z",
        },
      },
    });
    const res = createMockResponse();

    await TaskWorklogController.splitTimeEntry(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body.done).toBe(true);

    // Verify transactional execution: BEGIN -> UPDATE segment 1 -> INSERT segment 2 -> COMMIT
    expect(mockClient.query).toHaveBeenCalledWith("BEGIN");

    // Segment 1 update
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE task_work_log"),
      [
        "log-1",
        50400,
        "Night shift by member",
        "2026-09-24T10:00:00.000Z",
      ]
    );

    // Segment 2 insert: CRUCIAL: must use original-member-id, NOT admin-id!
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO task_work_log"),
      [
        39600,
        "Night shift by member",
        "task-original",
        "original-member-id", // Verified: preserved author!
        "2026-09-25T00:00:00.000Z",
      ]
    );

    expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
    expect(mockClient.release).toHaveBeenCalled();
  });

  it("rolls back transaction if an error occurs during split writes", async () => {
    const originalLog = {
      task_id: "task-original",
      user_id: "original-member-id",
    };
    mockedDb.query.mockResolvedValueOnce(createQueryResult([originalLog]));

    // Fail during query inside transaction
    mockClient.query.mockImplementation(async (sql: string) => {
      if (sql.includes("UPDATE")) {
        throw new Error("DB write error");
      }
      return { rows: [] };
    });

    const req = createMockRequest({
      user: { id: "admin-id", team_id: "team-1", is_admin: true },
      params: { id: "log-1" },
      body: {
        segment1: { seconds_spent: 50400, formatted_start: "2026-09-24T10:00:00.000Z" },
        segment2: { seconds_spent: 39600, formatted_start: "2026-09-25T00:00:00.000Z" },
      },
    });
    const res = createMockResponse();

    await TaskWorklogController.splitTimeEntry(req, res);

    expect(res.body.done).toBe(false);
    expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
    expect(mockClient.release).toHaveBeenCalled();
  });
});
