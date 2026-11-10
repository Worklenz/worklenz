import { PoolClient } from "pg";
import { checkDailyTimeLimit, canWriteDailyTime, getDailyTimeAllowance } from "../services/daily-time-limit.service";
import { allocateDailyTime, exceedsDailyTimeLimit } from "../shared/daily-time-limit";
import OrgConfigurationController from "../controllers/org-configuration-controller";
import { importTaskWorklogs } from "../services/imports/commit-helpers";
import { on_task_timer_stop } from "../socket.io/commands/on-task-timer-stop";
import { SocketEvents } from "../socket.io/events";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
    connect: jest.fn(),
    pool: {
      connect: jest.fn(),
      query: jest.fn(),
    },
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
const mockedDb = db as jest.Mocked<typeof db>;

describe("24-Hour Daily Time Limit Integration Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.connect.mockResolvedValue(mockClient as unknown as PoolClient);
    (mockedDb.pool.connect as jest.Mock).mockResolvedValue(mockClient as unknown as PoolClient);
    mockClient.query.mockReset();
  });

  describe("1. Setting Defaults & Admin Toggle", () => {
    it("existing organizations default enforce_daily_time_limit to false", async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          {
            restrict_task_creation: false,
            base_currency: "USD",
            timelog_backdate_limit_days: 0,
            enforce_daily_time_limit: false,
          },
        ],
      } as any);

      const req = createMockRequest({ user: { team_id: "team-existing" } });
      const res = createMockResponse();

      await OrgConfigurationController.get(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.enforce_daily_time_limit).toBe(false);
    });

    it("new organizations default enforce_daily_time_limit to true when null or newly created", async () => {
      // In PostgreSQL migration:
      // ALTER TABLE organizations ADD COLUMN enforce_daily_time_limit BOOLEAN NOT NULL DEFAULT FALSE;
      // ALTER TABLE organizations ALTER COLUMN enforce_daily_time_limit SET DEFAULT TRUE;
      // This means existing rows had false, but new rows inserted get true.
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          {
            restrict_task_creation: false,
            base_currency: "USD",
            timelog_backdate_limit_days: 0,
            enforce_daily_time_limit: true,
          },
        ],
      } as any);

      const req = createMockRequest({ user: { team_id: "team-new" } });
      const res = createMockResponse();

      await OrgConfigurationController.get(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.body.done).toBe(true);
      expect(res.body.body.enforce_daily_time_limit).toBe(true);
    });

    it("owner/admin can toggle enforce_daily_time_limit in configuration", async () => {
      mockedDb.query.mockResolvedValueOnce({
        rows: [
          {
            restrict_task_creation: false,
            base_currency: "USD",
            timelog_backdate_limit_days: 0,
            enforce_daily_time_limit: true,
          },
        ],
      } as any);

      const req = createMockRequest({
        user: { team_id: "team-1", owner: true },
        body: { enforce_daily_time_limit: true },
      });
      const res = createMockResponse();

      await OrgConfigurationController.update(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(mockedDb.query).toHaveBeenCalledWith(
        expect.stringContaining("enforce_daily_time_limit = $1"),
        expect.arrayContaining([true, "team-1"])
      );
      expect(res.body.body.enforce_daily_time_limit).toBe(true);
    });
  });

  describe("2. Concurrent Writes & Advisory Transaction Lock", () => {
    it("locks the org/member advisory lock and checks totals in transaction", async () => {
      const client1 = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }] })
          .mockResolvedValueOnce({ rows: [] }) // advisory lock
          .mockResolvedValueOnce({ rows: [{ id: "log-1", created_at: new Date("2026-11-10T08:00:00Z"), time_spent: "57600", logged_by_timer: false }] }), // 16h
      } as unknown as PoolClient;

      const client2 = {
        query: jest.fn()
          .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }] })
          .mockResolvedValueOnce({ rows: [] }) // advisory lock
          .mockResolvedValueOnce({
            rows: [
              { id: "log-1", created_at: new Date("2026-11-10T08:00:00Z"), time_spent: "57600", logged_by_timer: false }, // 16h committed by client 1
              { id: "log-2", created_at: new Date("2026-11-10T12:00:00Z"), time_spent: "28800", logged_by_timer: false }, // 8h
            ],
          }),
      } as unknown as PoolClient;

      // First transaction proposes 8 hours (total 16 + 8 = 24h = exactly 24h allowed)
      const allowed1 = await canWriteDailyTime(client1, "team-1", "user-1", [
        { start: "2026-11-10T12:00:00Z", seconds: 28800, isTimedSession: false },
      ]);
      expect(allowed1).toBe(true);

      // Second concurrent transaction waits for lock, then sees 24 hours already logged. Proposing 1 hour is rejected!
      const check2 = await checkDailyTimeLimit(client2, "team-1", "user-1", [
        { start: "2026-11-10T15:00:00Z", seconds: 3600, isTimedSession: false },
      ]);
      expect(check2.allowed).toBe(false);
      expect(check2.remainingSeconds).toBe(0);
      expect(check2.exceededDay).toBe("2026-11-10");
    });
  });

  describe("3. Timezone Boundaries & Daylight Saving", () => {
    it("allocates manual durations to their selected calendar date in member timezone", () => {
      // 18:30 UTC on Nov 9 is 00:00 Nov 10 in Asia/Colombo (UTC+5:30)
      const splits = allocateDailyTime(
        { start: "2026-11-09T18:30:00Z", seconds: 36000, isTimedSession: false },
        "Asia/Colombo"
      );
      expect(splits.get("2026-11-10")).toBe(36000);
      expect(splits.has("2026-11-09")).toBe(false);
    });

    it("splits overnight timed session accurately across midnights in Colombo time", () => {
      // 17:30 UTC on Nov 9 is 23:00 Nov 9 in Colombo.
      // A 4-hour timer spans 23:00 to 03:00 (1 hour on Nov 9, 3 hours on Nov 10 in Colombo).
      const splits = allocateDailyTime(
        { start: "2026-11-09T17:30:00Z", seconds: 14400, isTimedSession: true },
        "Asia/Colombo"
      );
      expect(splits.get("2026-11-09")).toBe(3600);
      expect(splits.get("2026-11-10")).toBe(10800);
    });

    it("respects DST transition in America/New_York (23-hour day)", () => {
      // March 8, 2026 is DST transition in New York (2 AM jumps to 3 AM, so the day has 23 hours)
      const splits = allocateDailyTime(
        { start: "2026-03-08T05:00:00Z", seconds: 86400, isTimedSession: true },
        "America/New_York"
      );
      expect(splits.get("2026-03-08")).toBe(23 * 3600);
      expect(splits.get("2026-03-09")).toBe(3600);
    });
  });

  describe("4. Edits by Admins & Ownership Scoping", () => {
    it("locks and checks the worklog author's daily limit when edited by an admin", async () => {
      const adminUserId = "admin-uuid";
      const memberUserId = "member-uuid";

      const queryMock = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }],
        })
        .mockResolvedValueOnce({ rows: [] }) // lock
        .mockResolvedValueOnce({
          rows: [
            {
              id: "member-log-1",
              created_at: new Date("2026-11-10T09:00:00Z"),
              time_spent: "72000", // 20 hours
              logged_by_timer: false,
            },
          ],
        });

      const client = { query: queryMock } as unknown as PoolClient;

      // Admin tries to edit member's log from 20 hours to 25 hours (fails member's 24h limit)
      const check = await checkDailyTimeLimit(
        client,
        "team-1",
        memberUserId, // Target member's user_id, NOT admin
        [{ start: "2026-11-10T09:00:00Z", seconds: 90000, isTimedSession: false }],
        ["member-log-1"]
      );

      expect(check.allowed).toBe(false);
      expect(queryMock.mock.calls[0][1]).toEqual(["team-1", memberUserId]);
      expect(queryMock.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
      expect(queryMock.mock.calls[1][1][0]).toBe(`daily-time-limit:org-1:${memberUserId}`);
    });

    it("permits an admin to reduce a member's entry even if currently over 24h", async () => {
      const memberUserId = "member-uuid";
      const queryMock = jest.fn()
        .mockResolvedValueOnce({
          rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }],
        })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: "old-log",
              created_at: new Date("2026-11-10T08:00:00Z"),
              time_spent: "95000", // 26.3h existing
              logged_by_timer: false,
            },
          ],
        });

      const client = { query: queryMock } as unknown as PoolClient;

      // Admin reduces the log to 90000s (25h) -> reduction to existing excess is permitted
      const allowed = await canWriteDailyTime(
        client,
        "team-1",
        memberUserId,
        [{ start: "2026-11-10T08:00:00Z", seconds: 90000, isTimedSession: false }],
        ["old-log"]
      );

      expect(allowed).toBe(true);
    });
  });

  describe("5. Existing Over-Limit Logs", () => {
    it("rejects increasing an already over-limit day", () => {
      const previous = new Map([["2026-11-10", 95000]]);
      const nextIncrease = new Map([["2026-11-10", 96000]]);
      expect(exceedsDailyTimeLimit(previous, nextIncrease)).toBe(true);
    });

    it("allows reducing an already over-limit day", () => {
      const previous = new Map([["2026-11-10", 95000]]);
      const nextDecrease = new Map([["2026-11-10", 90000]]);
      expect(exceedsDailyTimeLimit(previous, nextDecrease)).toBe(false);
    });

    it("rejects adding to an already over-limit day even if the addition is small", () => {
      const previous = new Map([["2026-11-10", 95000]]);
      const nextAdded = new Map([["2026-11-10", 95300]]);
      expect(exceedsDailyTimeLimit(previous, nextAdded)).toBe(true);
    });
  });

  describe("6. Timers & Stop Recovery", () => {
    it("preserves running timer in task_timers when timer stop exceeds 24h", async () => {
      const socketEmitMock = jest.fn();
      const mockSocket = {
        request: {
          session: {
            passport: { user: { id: "00000000-0000-4000-8000-000000000001" } },
          },
        },
        emit: socketEmitMock,
      } as any;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              start_time: new Date("2026-11-10T00:00:00Z"),
              time_spent: 86400, // 24 hours timer
              team_id: "team-1",
            },
          ],
        })
        // checkDailyTimeLimit queries:
        .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }] })
        .mockResolvedValueOnce({ rows: [] }) // advisory lock
        .mockResolvedValueOnce({
          rows: [
            {
              id: "existing-log-1",
              created_at: new Date("2026-11-10T08:00:00Z"),
              time_spent: "7200", // 2 hours already logged today
              logged_by_timer: false,
            },
          ],
        }) // existing logs in window (2h + 24h = 26h > 24h -> exceeds!)
        .mockResolvedValueOnce({ rows: [] }); // ROLLBACK

      await on_task_timer_stop(
        {} as any,
        mockSocket,
        JSON.stringify({ task_id: "00000000-0000-4000-8000-000000000002" })
      );

      // Verify ROLLBACK occurred (timer NOT deleted, worklog NOT inserted)
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining("DELETE FROM task_timers"));

      // Verify recovery response was emitted with over_limit details
      expect(socketEmitMock).toHaveBeenCalledWith(
        SocketEvents.TASK_TIMER_STOP.toString(),
        expect.objectContaining({
          over_limit: true,
          elapsed_seconds: 86400,
          remaining_seconds: 79200, // 86400 - 7200 = 79200 (22h)
          exceeded_day: "2026-11-10",
        })
      );
    });

    it("successfully stops and logs timer when resolved with override_seconds", async () => {
      const socketEmitMock = jest.fn();
      const mockSocket = {
        request: {
          session: {
            passport: { user: { id: "00000000-0000-4000-8000-000000000001" } },
          },
        },
        emit: socketEmitMock,
        to: jest.fn().mockReturnValue({ emit: jest.fn() }),
      } as any;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              start_time: new Date("2026-11-10T00:00:00Z"),
              time_spent: 90000,
              team_id: "team-1",
            },
          ],
        })
        // checkDailyTimeLimit queries:
        .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }] })
        .mockResolvedValueOnce({ rows: [] }) // advisory lock
        .mockResolvedValueOnce({ rows: [] }) // existing logs
        .mockResolvedValueOnce({ rows: [] }) // INSERT INTO task_work_log
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM task_timers
        .mockResolvedValueOnce({ rows: [] }) // COMMIT
        .mockResolvedValueOnce({ rows: [] }); // team members query

      mockedDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await on_task_timer_stop(
        {} as any,
        mockSocket,
        JSON.stringify({
          task_id: "00000000-0000-4000-8000-000000000002",
          override_seconds: 86400, // resolved to remaining allowance (24h)
        })
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO task_work_log"),
        expect.arrayContaining([86400, "00000000-0000-4000-8000-000000000002"])
      );
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM task_timers"),
        expect.anything()
      );
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(socketEmitMock).toHaveBeenCalledWith(
        SocketEvents.TASK_TIMER_STOP.toString(),
        expect.objectContaining({
          id: "00000000-0000-4000-8000-000000000002",
        })
      );
    });

    it("discards timer without inserting work log when discard flag is passed", async () => {
      const socketEmitMock = jest.fn();
      const mockSocket = {
        request: {
          session: {
            passport: { user: { id: "00000000-0000-4000-8000-000000000001" } },
          },
        },
        emit: socketEmitMock,
      } as any;

      mockClient.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }) // DELETE FROM task_timers
        .mockResolvedValueOnce({ rows: [] }); // COMMIT

      mockedDb.query.mockResolvedValueOnce({ rows: [] } as any);

      await on_task_timer_stop(
        {} as any,
        mockSocket,
        JSON.stringify({
          task_id: "00000000-0000-4000-8000-000000000002",
          discard: true,
        })
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining("DELETE FROM task_timers"),
        expect.anything()
      );
      expect(mockClient.query).not.toHaveBeenCalledWith(expect.stringContaining("INSERT INTO task_work_log"));
      expect(socketEmitMock).toHaveBeenCalledWith(
        SocketEvents.TASK_TIMER_STOP.toString(),
        expect.objectContaining({
          discarded: true,
        })
      );
    });
  });

  describe("7. Import Behavior", () => {
    it("skips worklog entries that exceed daily limit during import while inserting valid ones", async () => {
      mockClient.query
        // Task project lookup
        .mockResolvedValueOnce({ rows: [{ team_id: "team-1" }] })
        // First worklog check (8 hours) -> context, lock, logs
        .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [] }) // No existing logs -> allowed
        .mockResolvedValueOnce({ rows: [] }) // INSERT worklog 1
        // Second worklog check (20 hours) -> context, lock, logs (already 8 hours today) -> exceeds 24h!
        .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "UTC" }] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ id: "wl-1", created_at: new Date("2026-11-10T09:00:00Z"), time_spent: "28800", logged_by_timer: false }] });

      const raw = {
        __jira_worklogs: [
          { timeSpentSeconds: 28800, started: "2026-11-10T09:00:00.000Z", author: "Alice" }, // 8h -> ok
          { timeSpentSeconds: 72000, started: "2026-11-10T12:00:00.000Z", author: "Bob" },   // 20h -> exceeds (8 + 20 = 28h > 24h) -> skipped
        ],
      };

      const importedCount = await importTaskWorklogs(
        mockClient as unknown as PoolClient,
        "task-1",
        raw,
        "user-importer"
      );

      expect(importedCount).toBe(1);
    });

    it("imports all worklog entries when enforce_daily_time_limit is false", async () => {
      mockClient.query
        .mockResolvedValueOnce({ rows: [{ team_id: "team-1" }] })
        // First worklog check -> disabled
        .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: false, timezone: "UTC" }] })
        .mockResolvedValueOnce({ rows: [] }) // INSERT worklog 1
        // Second worklog check -> disabled
        .mockResolvedValueOnce({ rows: [{ organization_id: "org-1", enforce_daily_time_limit: false, timezone: "UTC" }] })
        .mockResolvedValueOnce({ rows: [] }); // INSERT worklog 2

      const raw = {
        __jira_worklogs: [
          { timeSpentSeconds: 72000, started: "2026-11-10T09:00:00.000Z", author: "Alice" }, // 20h
          { timeSpentSeconds: 72000, started: "2026-11-10T12:00:00.000Z", author: "Bob" },   // 20h
        ],
      };

      const importedCount = await importTaskWorklogs(
        mockClient as unknown as PoolClient,
        "task-1",
        raw,
        "user-importer"
      );

      expect(importedCount).toBe(2);
    });
  });

  describe("8. Remaining Allowance Feedback", () => {
    it("returns remaining allowance for a member on a target date", async () => {
      const client = {
        query: jest.fn()
          .mockResolvedValueOnce({
            rows: [{ organization_id: "org-1", enforce_daily_time_limit: true, timezone: "Asia/Colombo" }],
          })
          .mockResolvedValueOnce({
            rows: [
              {
                id: "wl-1",
                created_at: new Date("2026-11-10T05:30:00Z"), // 11:00 AM Colombo
                time_spent: "28800", // 8 hours
                logged_by_timer: false,
              },
            ],
          }),
      } as unknown as PoolClient;

      const allowance = await getDailyTimeAllowance(
        client,
        "team-1",
        "user-1",
        "2026-11-10"
      );

      expect(allowance.enforce_daily_time_limit).toBe(true);
      expect(allowance.date).toBe("2026-11-10");
      expect(allowance.logged_seconds).toBe(28800);
      expect(allowance.remaining_seconds).toBe(57600); // 16 hours
    });

    it("returns null remaining allowance when daily time limit is disabled", async () => {
      const client = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [{ organization_id: "org-1", enforce_daily_time_limit: false, timezone: "UTC" }],
        }),
      } as unknown as PoolClient;

      const allowance = await getDailyTimeAllowance(
        client,
        "team-1",
        "user-1",
        "2026-11-10"
      );

      expect(allowance.enforce_daily_time_limit).toBe(false);
      expect(allowance.remaining_seconds).toBeNull();
    });
  });
});
