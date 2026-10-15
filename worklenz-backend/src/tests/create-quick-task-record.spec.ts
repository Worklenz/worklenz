import db from "../config/db";
import { createQuickTaskRecord } from "../shared/create-quick-task-record";

jest.mock("../config/db", () => ({ connect: jest.fn() }));
const query = jest.fn();
const release = jest.fn();
const connect = db.connect as jest.MockedFunction<typeof db.connect>;

beforeEach(() => {
  jest.clearAllMocks();
  query.mockReset();
  connect.mockResolvedValue({ query, release } as never);
});

it("commits the created story and scoped type assignment before returning", async () => {
  query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ task: { id: "task-id" } }] })
    .mockResolvedValueOnce({ rowCount: 1 }).mockResolvedValueOnce({});
  const result = await createQuickTaskRecord('{"name":"Story"}', "project-id", "story");
  expect(result.rows[0].task?.issue_type).toBe("story");
  expect(query).toHaveBeenNthCalledWith(3,
    "UPDATE tasks SET issue_type = $2 WHERE id = $1 AND project_id = $3;",
    ["task-id", "story", "project-id"]);
  expect(query).toHaveBeenLastCalledWith("COMMIT");
  expect(release).toHaveBeenCalledTimes(1);
});

it("rolls back creation when issue type assignment fails", async () => {
  query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ task: { id: "task-id" } }] })
    .mockRejectedValueOnce(new Error("Type update failed")).mockResolvedValueOnce({});
  await expect(createQuickTaskRecord("{}", "project-id", "bug")).rejects.toThrow("Type update failed");
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
  expect(query.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
  expect(release).toHaveBeenCalledTimes(1);
});

it("rolls back when the type update cannot find the task in its project", async () => {
  query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ task: { id: "task-id" } }] })
    .mockResolvedValueOnce({ rowCount: 0 }).mockResolvedValueOnce({});
  await expect(createQuickTaskRecord("{}", "different-project", "story")).rejects.toThrow("Created task not found");
  expect(query).toHaveBeenLastCalledWith("ROLLBACK");
});

it("commits an ordinary task without a separate type update", async () => {
  query.mockResolvedValueOnce({}).mockResolvedValueOnce({ rows: [{ task: { id: "task-id" } }] }).mockResolvedValueOnce({});
  await createQuickTaskRecord("{}", "project-id", "task");
  expect(query).toHaveBeenCalledTimes(3);
  expect(query).toHaveBeenLastCalledWith("COMMIT");
});
