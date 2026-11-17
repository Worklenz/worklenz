import { NextFunction, Request, Response } from "express";
import { PoolClient } from "pg";
import db from "../config/db";
import TasksControllerV2 from "../controllers/tasks-controller-v2";
import * as assigneeScope from "../shared/assignee-task-scope";
import safeControllerFunction from "../shared/safe-controller-function";

describe("task list v3 transaction", () => {
  afterEach(() => jest.restoreAllMocks());

  it("handles an unbound route and returns tasks with transaction-local JIT disabled", async () => {
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const release = jest.fn();
    jest.spyOn(db, "connect").mockResolvedValue({ query, release } as unknown as PoolClient);
    jest.spyOn(assigneeScope, "resolveAssigneeTaskScope").mockResolvedValue({
      applyFilter: false,
      teamMemberId: null,
    });
    jest.spyOn(TasksControllerV2, "getGroups").mockResolvedValue([]);

    const req = {
      params: { id: "d144234b-83e0-4e1b-96f9-7f90fdfc9996" },
      query: { archived: "false", group: "status" },
      user: { id: "00000000-0000-0000-0000-000000000000" },
    } as unknown as Request;
    let status = 0;
    const response = await new Promise<{ done: boolean; body: { totalTasks: number } }>(
      (resolve, reject) => {
        const res = {
          status: (value: number) => {
            status = value;
            return res;
          },
          send: resolve,
        } as unknown as Response;
        safeControllerFunction(TasksControllerV2.getTasksV3)(req, res, reject as NextFunction);
      }
    );

    expect(status).toBe(200);
    expect(response.done).toBe(true);
    expect(response.body.totalTasks).toBe(0);
    expect(query.mock.calls.map(call => call[0])).toEqual([
      "BEGIN READ ONLY",
      "SET LOCAL jit = off",
      expect.stringContaining("WITH RECURSIVE"),
      "COMMIT",
    ]);
    expect(release).toHaveBeenCalledWith(false);
  });

  it("rolls back on query failure and discards the client if rollback fails", async () => {
    const error = new Error("query failed");
    const query = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(error).mockRejectedValueOnce(new Error("rollback failed"));
    const release = jest.fn();
    jest.spyOn(db, "connect").mockResolvedValue({ query, release } as unknown as PoolClient);

    await expect(TasksControllerV2["queryTasksWithoutJit"]("SELECT 1", [])).rejects.toBe(error);
    expect(query).toHaveBeenLastCalledWith("ROLLBACK");
    expect(release).toHaveBeenCalledWith(true);
  });
});
