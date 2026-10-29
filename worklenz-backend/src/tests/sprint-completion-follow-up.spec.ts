import db from "../config/db";
import { tryStartNextSprintAfterCompletion } from "../shared/sprint-lifecycle";
import { log_error } from "../shared/utils";

jest.mock("../config/db", () => ({ query: jest.fn(), connect: jest.fn() }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
const query = db.query as jest.MockedFunction<typeof db.query>;
const connect = db.connect as jest.MockedFunction<typeof db.connect>;
const clientQuery = jest.fn();
const release = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  query.mockReset();
  clientQuery.mockReset();
  connect.mockReset().mockResolvedValue({ query: clientQuery, release } as never);
});

it("keeps a completed sprint successful when reading follow-up settings fails", async () => {
  query.mockRejectedValueOnce(new Error("Settings unavailable"));
  await expect(tryStartNextSprintAfterCompletion("project", null, 14)).resolves.toBeNull();
  expect(log_error).toHaveBeenCalledTimes(1);
});

it("keeps a completed sprint successful when starting the next sprint fails", async () => {
  query.mockResolvedValueOnce({ rows: [{ auto_start_complete_sprints: true }] } as never);
  clientQuery.mockResolvedValueOnce({})
    .mockRejectedValueOnce(new Error("Next sprint unavailable"))
    .mockResolvedValueOnce({});
  await expect(tryStartNextSprintAfterCompletion("project", "next-sprint", 14)).resolves.toBeNull();
  expect(log_error).toHaveBeenCalledTimes(1);
  expect(clientQuery).toHaveBeenLastCalledWith("ROLLBACK");
  expect(release).toHaveBeenCalledTimes(1);
});

it("does not start another sprint when automatic scheduling is off", async () => {
  query.mockResolvedValueOnce({ rows: [{ auto_start_complete_sprints: false }] } as never);
  await expect(tryStartNextSprintAfterCompletion("project", null, 14)).resolves.toBeNull();
  expect(query).toHaveBeenCalledTimes(1);
});

it("returns the successfully started next sprint", async () => {
  query.mockResolvedValueOnce({ rows: [{ auto_start_complete_sprints: true }] } as never);
  clientQuery.mockResolvedValueOnce({})
    .mockResolvedValueOnce({ rows: [{ id: "next-sprint" }] })
    .mockResolvedValueOnce({ rows: [{ days: 0 }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ id: "next-sprint", sprint_status: "active" }] })
    .mockResolvedValueOnce({});
  await expect(tryStartNextSprintAfterCompletion("project", "next-sprint", 14)).resolves.toEqual({ id: "next-sprint", sprint_status: "active" });
  expect(log_error).not.toHaveBeenCalled();
  expect(clientQuery).toHaveBeenLastCalledWith("COMMIT");
  expect(release).toHaveBeenCalledTimes(1);
});
