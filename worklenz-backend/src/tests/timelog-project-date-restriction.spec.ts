import db from "../config/db";
import { getProjectStartDateViolation } from "../shared/timelog-project-date-restriction";

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    query: jest.fn(),
  },
}));

const mockedDb = db as jest.Mocked<typeof db>;

describe("getProjectStartDateViolation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns null if formattedStart is missing", async () => {
    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      formattedStart: null,
    });
    expect(result).toBeNull();
  });

  it("returns null if project has no start_date", async () => {
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          project_start_date: null,
          timezone: "UTC",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      formattedStart: "2026-10-10T10:00:00Z",
    });
    expect(result).toBeNull();
  });

  it("returns null if log date is on the project start date", async () => {
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          project_start_date: "2026-10-10T00:00:00Z",
          timezone: "UTC",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      formattedStart: "2026-10-10T14:30:00Z",
    });
    expect(result).toBeNull();
  });

  it("returns null if log date is after the project start date", async () => {
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          project_start_date: "2026-10-10T00:00:00Z",
          timezone: "UTC",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      formattedStart: "2026-10-15T09:00:00Z",
    });
    expect(result).toBeNull();
  });

  it("returns violation message if log date is before project start date", async () => {
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          project_start_date: "2026-10-10T00:00:00Z",
          timezone: "UTC",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      formattedStart: "2026-10-08T10:00:00Z",
    });
    expect(result).toBe("Time cannot be logged before the project start date (Oct 10, 2026).");
  });

  it("in edit mode: allows saving unchanged date even if before project start date (exemption)", async () => {
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          created_at: "2026-10-05T08:00:00Z",
          task_id: "11111111-1111-4111-8111-111111111111",
          project_start_date: "2026-10-10T00:00:00Z",
          timezone: "UTC",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      workLogId: "22222222-2222-4222-8222-222222222222",
      formattedStart: "2026-10-05T12:00:00Z", // same day, changed time/description
    });
    expect(result).toBeNull();
  });

  it("in edit mode: blocks moving date to another date before project start date", async () => {
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          created_at: "2026-10-12T08:00:00Z",
          task_id: "11111111-1111-4111-8111-111111111111",
          project_start_date: "2026-10-10T00:00:00Z",
          timezone: "UTC",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      workLogId: "22222222-2222-4222-8222-222222222222",
      formattedStart: "2026-10-05T12:00:00Z", // moved to before start date
    });
    expect(result).toBe("Time cannot be logged before the project start date (Oct 10, 2026).");
  });

  it("in edit mode with reassign: validates against new task project start date", async () => {
    // 1st query: existing log
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          created_at: "2026-10-12T08:00:00Z",
          task_id: "11111111-1111-4111-8111-111111111111",
          project_start_date: "2026-10-01T00:00:00Z",
          timezone: "UTC",
        },
      ],
    } as never);

    // 2nd query: new task project
    mockedDb.query.mockResolvedValueOnce({
      rows: [
        {
          project_start_date: "2026-10-15T00:00:00Z",
        },
      ],
    } as never);

    const result = await getProjectStartDateViolation({
      taskId: "33333333-3333-4333-8333-333333333333", // different task
      workLogId: "22222222-2222-4222-8222-222222222222",
      formattedStart: "2026-10-12T08:00:00Z", // before new project start date
    });
    expect(result).toBe("Time cannot be logged before the project start date (Oct 15, 2026).");
  });

  it("fails open on database error", async () => {
    mockedDb.query.mockRejectedValueOnce(new Error("Connection error"));

    const result = await getProjectStartDateViolation({
      taskId: "11111111-1111-4111-8111-111111111111",
      formattedStart: "2026-10-05T12:00:00Z",
    });
    expect(result).toBeNull();
  });
});
