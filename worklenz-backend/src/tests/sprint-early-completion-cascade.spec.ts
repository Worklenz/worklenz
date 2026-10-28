import db from "../config/db";
import {
  cascadeUpcomingSprintDates,
  completeSprintRecord,
  startNextSprintNow,
} from "../shared/sprint-lifecycle";

jest.mock("../config/db", () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

const query = jest.fn();
const release = jest.fn();
const connect = db.connect as jest.MockedFunction<typeof db.connect>;

beforeEach(() => {
  jest.clearAllMocks();
  query.mockReset();
  connect.mockReset().mockResolvedValue({ query, release } as never);
});

describe("cascadeUpcomingSprintDates", () => {
  it("reschedules subsequent planned sprints consecutively preserving their duration", async () => {
    const anchorEndDate = "2026-11-11T23:59:59.000Z";
    const updates: Array<{ id: string; start_date: string; end_date: string }> = [];

    const plannedRows = [
      {
        id: "sprint-3",
        start_date: "2026-11-14T00:00:00.000Z",
        end_date: "2026-11-28T23:59:59.000Z",
      },
      {
        id: "sprint-4",
        start_date: "2026-11-29T00:00:00.000Z",
        end_date: "2026-12-13T23:59:59.000Z",
      },
    ];

    const clientMock = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes("SELECT id, start_date, end_date")) {
          return { rows: plannedRows };
        }
        if (sql.includes("UPDATE project_phases")) {
          updates.push({ id: params?.[2], start_date: params?.[0], end_date: params?.[1] });
          return { rowCount: 1 };
        }
        return { rows: [] };
      }),
    } as any;

    await cascadeUpcomingSprintDates(clientMock, "project-1", anchorEndDate, "sprint-2");

    expect(updates).toHaveLength(2);

    // Sprint 3 starts Nov 12 (day after Sprint 2 ends Nov 11) and preserves its 15-day length
    expect(updates[0].id).toBe("sprint-3");
    expect(new Date(updates[0].start_date).toISOString()).toBe("2026-11-12T00:00:00.000Z");
    expect(new Date(updates[0].end_date).toISOString()).toBe("2026-11-26T23:59:59.000Z");

    // Sprint 4 starts Nov 27 (day after Sprint 3 ends Nov 26) and preserves its 15-day length
    expect(updates[1].id).toBe("sprint-4");
    expect(new Date(updates[1].start_date).toISOString()).toBe("2026-11-27T00:00:00.000Z");
    expect(new Date(updates[1].end_date).toISOString()).toBe("2026-12-11T23:59:59.000Z");
  });

  it("safely skips sprints without dates", async () => {
    const anchorEndDate = "2026-11-11T23:59:59.000Z";
    const updates: Array<{ id: string }> = [];

    const plannedRows = [
      { id: "undated-sprint", start_date: null, end_date: null },
      {
        id: "dated-sprint",
        start_date: "2026-11-14T00:00:00.000Z",
        end_date: "2026-11-28T23:59:59.000Z",
      },
    ];

    const clientMock = {
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes("SELECT id, start_date, end_date")) {
          return { rows: plannedRows };
        }
        if (sql.includes("UPDATE project_phases")) {
          updates.push({ id: params?.[2] });
          return { rowCount: 1 };
        }
        return { rows: [] };
      }),
    } as any;

    await cascadeUpcomingSprintDates(clientMock, "project-1", anchorEndDate);

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("dated-sprint");
  });
});

describe("completeSprintRecord end_date handling", () => {
  it("caps end_date to CURRENT_TIMESTAMP when completing before scheduled end date", async () => {
    (db.connect as jest.Mock).mockResolvedValueOnce({
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql === "COMMIT") return {};
        if (sql.includes("SELECT start_date, end_date")) {
          return { rows: [{ start_date: "2026-10-15T00:00:00.000Z", end_date: "2026-10-29T23:59:59.000Z" }] };
        }
        if (sql.includes("UPDATE project_phases")) {
          expect(sql).toContain("WHEN end_date IS NOT NULL AND end_date > CURRENT_TIMESTAMP THEN CURRENT_TIMESTAMP");
          return {
            rows: [
              {
                id: "sprint-1",
                sprint_status: "completed",
                start_date: "2026-10-15T00:00:00.000Z",
                end_date: new Date().toISOString(),
              },
            ],
          };
        }
        if (sql.includes("WITH RECURSIVE")) return { rows: [] };
        if (sql.includes("DELETE FROM task_phase")) return { rowCount: 0 };
        if (sql.includes("SELECT auto_archive_on_sprint_complete")) {
          return { rows: [{ project_type: "software", auto_archive_on_sprint_complete: false }] };
        }
        return { rows: [] };
      }),
      release,
    });

    const result = await completeSprintRecord("project-1", "sprint-1", null);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.phase.sprint_status).toBe("completed");
      expect(result.data.plannedLengthDays).toBe(15);
    }
  });
});

describe("startNextSprintNow", () => {
  it("shifts both the next sprint and subsequent planned sprints by the calculated days", async () => {
    const executedQueries: Array<{ sql: string; params?: any[] }> = [];

    (db.connect as jest.Mock).mockResolvedValueOnce({
      query: jest.fn().mockImplementation(async (sql: string, params?: any[]) => {
        executedQueries.push({ sql, params });
        if (sql === "BEGIN" || sql === "COMMIT") return {};
        if (sql.includes("SELECT id, start_date")) {
          return { rows: [{ id: "sprint-2", start_date: "2026-10-30T00:00:00.000Z" }] };
        }
        if (sql.includes("SELECT FLOOR(EXTRACT(EPOCH")) {
          return { rows: [{ days: -2 }] };
        }
        if (sql.includes("UPDATE project_phases") && sql.includes("CASE")) {
          return { rowCount: 1 };
        }
        if (sql.includes("UPDATE project_phases") && sql.includes("shiftDays")) {
          return { rowCount: 2 };
        }
        if (sql.includes("SELECT id, name FROM project_phases")) {
          return { rows: [] }; // no active sprint
        }
        if (sql.includes("SET sprint_status = 'active'")) {
          return {
            rows: [
              {
                id: "sprint-2",
                sprint_status: "active",
                start_date: "2026-10-28T00:00:00.000Z",
                end_date: "2026-11-11T23:59:59.000Z",
              },
            ],
          };
        }
        return { rows: [] };
      }),
      release,
    });

    const started = await startNextSprintNow("project-1", "sprint-2", 15);
    expect(started).toEqual({
      id: "sprint-2",
      sprint_status: "active",
      start_date: "2026-10-28T00:00:00.000Z",
      end_date: "2026-11-11T23:59:59.000Z",
    });

    // Verify subsequent planned sprints were shifted with start_date >= $4 condition
    const subsequentShiftQuery = executedQueries.find(q =>
      q.sql.includes("SET start_date = start_date + $3::INT")
    );
    expect(subsequentShiftQuery).toBeDefined();
    expect(subsequentShiftQuery?.params).toEqual([
      "sprint-2",
      "project-1",
      -2,
      "2026-10-30T00:00:00.000Z",
    ]);
  });
});
