import { withTeamSeatLock } from "../shared/team-seat-lock";

const mockQuery = jest.fn();
const mockRelease = jest.fn();

jest.mock("../config/db", () => ({
  __esModule: true,
  default: {
    pool: {
      connect: jest.fn(async () => ({
        query: mockQuery,
        release: mockRelease,
      })),
    },
  },
}));

describe("withTeamSeatLock", () => {
  beforeEach(() => {
    mockQuery.mockReset().mockResolvedValue({ rows: [{ acquired: true }] });
    mockRelease.mockReset();
  });

  it("locks before running and unlocks after, then releases the connection", async () => {
    const result = await withTeamSeatLock("team-1", async () => {
      expect(mockQuery).toHaveBeenCalledTimes(1);
      return "done";
    });

    expect(result).toBe("done");
    expect(mockQuery.mock.calls[0][0]).toContain("pg_try_advisory_lock");
    expect(mockQuery.mock.calls[0][1]).toEqual(["team-seats:team-1"]);
    expect(mockQuery.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it("unlocks and releases when the callback throws", async () => {
    await expect(
      withTeamSeatLock("team-1", async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");

    expect(mockQuery.mock.calls[1][0]).toContain("pg_advisory_unlock");
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe("team seat lock contention", () => {
  beforeEach(() => {
    mockQuery.mockReset();
    mockRelease.mockReset();
  });

  it("releases a contending connection before retrying so the holder can use the pool", async () => {
    mockQuery.mockResolvedValue({ rows: [{ acquired: true }] });
    mockQuery.mockResolvedValueOnce({ rows: [{ acquired: false }] });
    const callback = jest.fn(async () => {
      expect(mockRelease).toHaveBeenCalledTimes(1);
      return "done";
    });
    const pending = withTeamSeatLock("team-1", callback);
    await expect(pending).resolves.toBe("done");
    expect(callback).toHaveBeenCalledTimes(1);
    expect(mockRelease).toHaveBeenCalledTimes(2);
  });

  it("times out without running the callback or unlocking a lock it never acquired", async () => {
    mockQuery.mockResolvedValue({ rows: [{ acquired: false }] });
    const callback = jest.fn();
    const now = jest
      .spyOn(Date, "now")
      .mockReturnValueOnce(0)
      .mockReturnValue(5001);
    const assertion = expect(
      withTeamSeatLock("team-1", callback),
    ).rejects.toThrow("Timed out");
    await assertion;
    now.mockRestore();
    expect(callback).not.toHaveBeenCalled();
    expect(
      mockQuery.mock.calls.every(
        ([sql]) => !String(sql).includes("pg_advisory_unlock"),
      ),
    ).toBe(true);
    expect(mockRelease).toHaveBeenCalled();
  });

  it("discards a connection whose advisory unlock fails", async () => {
    mockQuery
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockRejectedValueOnce(new Error("unlock failed"));
    await expect(
      withTeamSeatLock("team-1", async () => "done"),
    ).rejects.toThrow("unlock failed");
    expect(mockRelease).toHaveBeenCalledWith(true);
  });
});
