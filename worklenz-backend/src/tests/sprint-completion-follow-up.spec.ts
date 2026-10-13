import db from "../config/db";
import { tryStartNextSprintAfterCompletion } from "../shared/sprint-lifecycle";
import { log_error } from "../shared/utils";

jest.mock("../config/db", () => ({ query: jest.fn() }));
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
const query = db.query as jest.MockedFunction<typeof db.query>;
beforeEach(() => { jest.clearAllMocks(); query.mockReset(); });

it("keeps a completed sprint successful when reading follow-up settings fails", async () => {
  query.mockRejectedValueOnce(new Error("Settings unavailable"));
  await expect(tryStartNextSprintAfterCompletion("project", null, 14)).resolves.toBeNull();
  expect(log_error).toHaveBeenCalledTimes(1);
});

it("keeps a completed sprint successful when starting the next sprint fails", async () => {
  query.mockResolvedValueOnce({ rows: [{ auto_start_complete_sprints: true }] } as never)
    .mockRejectedValueOnce(new Error("Next sprint unavailable"));
  await expect(tryStartNextSprintAfterCompletion("project", "next-sprint", 14)).resolves.toBeNull();
  expect(log_error).toHaveBeenCalledTimes(1);
});

it("does not start another sprint when automatic scheduling is off", async () => {
  query.mockResolvedValueOnce({ rows: [{ auto_start_complete_sprints: false }] } as never);
  await expect(tryStartNextSprintAfterCompletion("project", null, 14)).resolves.toBeNull();
  expect(query).toHaveBeenCalledTimes(1);
});

it("returns the successfully started next sprint", async () => {
  query.mockResolvedValueOnce({ rows: [{ auto_start_complete_sprints: true }] } as never)
    .mockResolvedValueOnce({ rows: [{ id: "next-sprint" }] } as never)
    .mockResolvedValueOnce({ rows: [] } as never)
    .mockResolvedValueOnce({ rows: [] } as never)
    .mockResolvedValueOnce({ rows: [{ id: "next-sprint", sprint_status: "active" }] } as never);
  await expect(tryStartNextSprintAfterCompletion("project", "next-sprint", 14)).resolves.toEqual({ id: "next-sprint", sprint_status: "active" });
  expect(log_error).not.toHaveBeenCalled();
});
