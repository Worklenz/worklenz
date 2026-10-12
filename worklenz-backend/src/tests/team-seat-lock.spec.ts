import { withTeamSeatLock } from "../shared/team-seat-lock";

const mockQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: { pool: { connect: jest.fn(async () => ({ query: mockQuery, release: mockRelease })) } },
}));

describe("withTeamSeatLock", () => {
  beforeEach(() => {
    mockQuery.mockReset().mockResolvedValue({ rows: [] });
    mockRelease.mockReset();
  });

  it("locks before running and unlocks after, then releases the connection", async () => {
    const result = await withTeamSeatLock("team-1", async () => {
      expect(mockQuery).toHaveBeenCalledTimes(1);
      return "done";
    });

    expect(result).toBe("done");
    expect(mockQuery.mock.calls[0][0]).toContain("pg_advisory_lock");
    expect(mockQuery.mock.calls[0][1]).toEqual(["team-seats:team-1"]);
    expect(mockQuery.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("unlocks and releases when the callback throws", async () => {
    await expect(
      withTeamSeatLock("team-1", async () => {
        throw new Error("boom");
      })
    ).rejects.toThrow("boom");

    expect(mockQuery.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});
