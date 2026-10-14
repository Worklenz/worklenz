import db from "../config/db";
import { startNextSprintNow } from "../shared/sprint-lifecycle";

jest.mock("../config/db", () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

const query = jest.fn();
const release = jest.fn();
const connect = db.connect as jest.MockedFunction<typeof db.connect>;
const originalDates = { start_date: "2026-11-01", end_date: "2026-11-14" };
const shiftedDates = { start_date: "2026-10-14", end_date: "2026-10-27" };
let savedDates = { ...originalDates };
let pendingDates = { ...originalDates };

beforeEach(() => {
  jest.clearAllMocks();
  query.mockReset();
  connect.mockReset().mockResolvedValue({ query, release } as never);
  savedDates = { ...originalDates };
  pendingDates = { ...originalDates };
});

function simulateDatabase(outcome: "success" | "active" | "missing" | "conflict" | "empty") {
  query.mockImplementation(async (sql: string) => {
    if (sql === "BEGIN") pendingDates = { ...savedDates };
    else if (sql === "COMMIT") savedDates = { ...pendingDates };
    else if (sql === "ROLLBACK") pendingDates = { ...savedDates };
    else if (sql.includes("SELECT id\n")) {
      return { rows: outcome === "empty" ? [] : [{ id: "next-sprint" }] };
    } else if (sql.includes("SET start_date = CASE")) {
      pendingDates = { ...shiftedDates };
      return { rows: [], rowCount: 1 };
    } else if (sql.includes("SELECT id, name")) {
      return { rows: outcome === "active" ? [{ id: "other-sprint", name: "Current sprint" }] : [] };
    } else if (sql.includes("SET sprint_status = 'active'")) {
      if (outcome === "conflict") {
        throw Object.assign(new Error("Another sprint won the concurrent start"), { code: "23505" });
      }
      return { rows: outcome === "missing" ? [] : [{ id: "next-sprint", sprint_status: "active", ...pendingDates }] };
    } else throw new Error(`Unexpected query: ${sql}`);
    return { rows: [] };
  });
}

it("commits the date shift and start together on the same client", async () => {
  simulateDatabase("success");
  await expect(startNextSprintNow("project", "next-sprint", 14)).resolves.toEqual({
    id: "next-sprint", sprint_status: "active", ...shiftedDates,
  });
  expect(savedDates).toEqual(shiftedDates);
  expect(query).toHaveBeenNthCalledWith(1, "BEGIN");
  expect(query).toHaveBeenNthCalledWith(2, expect.stringContaining("FOR UPDATE"), ["project", "next-sprint"]);
  expect(query).toHaveBeenLastCalledWith("COMMIT");
  expect(db.query).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(1);
});

it.each(["active", "missing"] as const)("preserves planned dates when the start is rejected (%s)", async outcome => {
  simulateDatabase(outcome);
  await expect(startNextSprintNow("project", null, 14)).resolves.toBeNull();
  expect(savedDates).toEqual(originalDates);
  expect(pendingDates).toEqual(originalDates);
  expect(query).toHaveBeenCalledWith(expect.stringContaining("SET start_date = CASE"), expect.any(Array));
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(query).not.toHaveBeenCalledWith("COMMIT");
  expect(db.query).not.toHaveBeenCalled();
  expect(release).toHaveBeenCalledTimes(1);
});

it("preserves planned dates when a concurrent start causes a unique-index error", async () => {
  simulateDatabase("conflict");
  await expect(startNextSprintNow("project", null, 14)).rejects.toMatchObject({ code: "23505" });
  expect(savedDates).toEqual(originalDates);
  expect(pendingDates).toEqual(originalDates);
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(query).not.toHaveBeenCalledWith("COMMIT");
  expect(release).toHaveBeenCalledTimes(1);
});

it("releases the client without changing dates when no planned sprint exists", async () => {
  simulateDatabase("empty");
  await expect(startNextSprintNow("project", null, 14)).resolves.toBeNull();
  expect(savedDates).toEqual(originalDates);
  expect(query).toHaveBeenCalledTimes(3);
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(release).toHaveBeenCalledTimes(1);
});
