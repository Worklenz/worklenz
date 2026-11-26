jest.unmock("express");
jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/project-role-permissions", () => ({ checkProjectRolePermission: jest.fn().mockResolvedValue({ allowed: true }) }));

import db from "../config/db";
import projectLinksApiRouter from "../routes/apis/project-links-api-router";
import { createMockRequest, createMockResponse } from "./utils/express-mock";
import { createQueryResult } from "./utils/db-mock";

interface Layer { route?: unknown; handle: (...args: never[]) => unknown }
const layers = (projectLinksApiRouter as unknown as { stack: Layer[] }).stack;
const invoke = (index: number, req: unknown, res: unknown, next: () => void) =>
  (layers[index].handle as unknown as (req: unknown, res: unknown, next: () => void) => Promise<void>)(req, res, next);
const query = db.query as jest.MockedFunction<typeof db.query>;

describe("project links authorization", () => {
  beforeEach(() => jest.clearAllMocks());
  it.each(["GET", "POST", "PUT", "DELETE"])("rejects a foreign project for %s", async method => {
    query.mockResolvedValueOnce(createQueryResult([{ id: "member" }]));
    query.mockResolvedValueOnce(createQueryResult([{ team_id: "foreign-team" }]));
    query.mockResolvedValueOnce(createQueryResult([]));
    const req = createMockRequest({ user: { id: "user", team_id: "team" }, params: { projectId: "project" }, method });
    const res = createMockResponse();
    const next = jest.fn();
    await invoke(0, req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it.each(["POST", "PUT", "DELETE"])("rejects guest mutations for %s", async method => {
    query.mockResolvedValueOnce(createQueryResult([]));
    const req = createMockRequest({ user: { id: "user", team_id: "team" }, params: { projectId: "project" }, method });
    const res = createMockResponse();
    const next = jest.fn();
    await invoke(1, req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
  });
  it("allows project-authorized reads to reach the controller", async () => {
    const next = jest.fn();
    await invoke(1, createMockRequest({ method: "GET" }), createMockResponse(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
