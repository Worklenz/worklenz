import TasksControllerV2 from "../controllers/tasks-controller-v2";
import { IWorkLenzRequest } from "../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../interfaces/worklenz-response";

describe("task list custom column filter", () => {
  it.each(["getList", "getTasksOnly", "getTasksV3"] as const)(
    "%s rejects a column key before querying the database",
    async method => {
      const req = { query: { custom_column_ids: "P0o-LRyE8wyox0jLHnGvv" } } as unknown as IWorkLenzRequest;
      const res = { status: jest.fn().mockReturnThis(), send: jest.fn() } as unknown as IWorkLenzResponse;
      await TasksControllerV2[method](req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    }
  );

  it("accepts UUIDs as query parameters", () => {
    const id = "4203921e-1b19-440f-a262-f8aee8830023";
    expect(TasksControllerV2["hasInvalidCustomColumnIds"](id)).toBe(false);
    const { query, params } = TasksControllerV2["getQuery"]("user", {
      customColumns: "true",
      custom_column_ids: id,
    });
    expect(params).toContainEqual([id]);
    expect(query).toMatch(/ccv\.column_id = ANY\(\$\d+::UUID\[\]\)/);
  });
});
