import { PoolClient } from "pg";
import { canWriteDailyTime } from "../services/daily-time-limit.service";

const makeClient = (entries: object[], enabled = true) => {
  const query = jest.fn()
    .mockResolvedValueOnce({ rows: [{ organization_id: "org", enforce_daily_time_limit: enabled, timezone: "UTC" }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: entries });
  return { query, client: { query } as unknown as PoolClient };
};

describe("daily time limit database check", () => {
  const existing = {
    id: "entry", created_at: new Date("2026-11-09T09:00:00Z"),
    time_spent: "82800", logged_by_timer: false,
  };
  const addition = { start: "2026-11-09T12:00:00Z", seconds: 7200, isTimedSession: false };

  it("locks the member and rejects a total above 24 hours", async () => {
    const { client, query } = makeClient([existing]);
    expect(await canWriteDailyTime(client, "team", "user", [addition])).toBe(false);
    expect(query.mock.calls[1][0]).toContain("pg_advisory_xact_lock");
    expect(query.mock.calls[2][1]).toEqual([
      "org", "user", new Date("2026-11-09T00:00:00Z"), new Date("2026-11-10T00:00:00Z"),
    ]);
    expect(query.mock.calls[0][0]).toContain("o.id = team.organization_id");
    expect(query.mock.calls[2][0]).toContain("team.organization_id = $1");
    expect(query.mock.calls[2][0]).toContain("wl.logged_by_timer");
  });

  it("excludes the replaced entry when calculating an edit", async () => {
    const { client } = makeClient([existing]);
    expect(await canWriteDailyTime(client, "team", "user", [addition], ["entry"])).toBe(true);
  });

  it("counts the portion of an overnight timer on each affected day", async () => {
    const { client } = makeClient([{
      id: "timer", created_at: new Date("2026-11-09T22:00:00Z"),
      time_spent: "14400", logged_by_timer: true,
    }]);
    expect(await canWriteDailyTime(client, "team", "user", [{
      start: "2026-11-10T09:00:00Z", seconds: 23 * 3600, isTimedSession: false,
    }])).toBe(false);
  });

  it("allows an edit that reduces an existing over-limit total", async () => {
    const { client } = makeClient([{ ...existing, time_spent: "90000" }]);
    expect(await canWriteDailyTime(client, "team", "user", [{
      start: existing.created_at, seconds: 89000, isTimedSession: false,
    }], ["entry"])).toBe(true);
  });

  it("does not restrict an organization with the setting disabled", async () => {
    const { client, query } = makeClient([], false);
    expect(await canWriteDailyTime(client, "team", "user", [addition])).toBe(true);
    expect(query).toHaveBeenCalledTimes(1);
  });

  it("bounds the query using local midnights across a daylight-saving transition", async () => {
    const query = jest.fn()
      .mockResolvedValueOnce({ rows: [{ organization_id: "org", enforce_daily_time_limit: true, timezone: "America/New_York" }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] });
    await canWriteDailyTime({ query } as unknown as PoolClient, "team", "user", [{
      start: "2026-03-08T12:00:00Z", seconds: 3600, isTimedSession: false,
    }]);
    expect(query.mock.calls[2][1]).toEqual([
      "org", "user", new Date("2026-03-08T05:00:00Z"), new Date("2026-03-09T04:00:00Z"),
    ]);
  });
});
