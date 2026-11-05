process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/paddle-utils");
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
jest.mock("../redis/analytics-cache", () => ({ withLastUpdated: jest.fn() }));
jest.mock("../middlewares/analytics-project-access", () => ({
  __esModule: true, default: jest.fn((_req, _res, next) => next()),
}));
import { RequestHandler } from "express";
import router from "../routes/apis/reporting-analytics-api-router";
import projectAccess from "../middlewares/analytics-project-access";
import { createMockRequest, createMockResponse } from "./utils/express-mock";

interface RouteLayer {
  route?: { path: string; stack: Array<{ handle: RequestHandler }> };
}

describe.each([
  "/budget-tracking/series", "/budget-tracking/export/csv",
  "/project-health/series", "/project-health/export/csv",
])("finance authorization for %s", path => {
  const layers = (router as unknown as { stack: RouteLayer[] }).stack;
  const handlers = layers.find(layer => layer.route?.path === path)!.route!.stack;

  async function authorize(plan: string, role = "Member") {
    const req = createMockRequest({ user: {
      id: "user", team_id: "team", role_name: role,
      subscription_type: "PADDLE", plan_name: plan,
    } });
    const res = createMockResponse();
    for (const { handle } of handlers) {
      // Do not execute the report controller: verify the full preceding chain.
      if (handle === handlers[handlers.length - 1].handle) break;
      const next = jest.fn();
      await handle(req, res, next);
      if (!next.mock.calls.length) break;
    }
    return res;
  }

  it.each(["Member", "Team Lead"])("denies %s before project lookup", async role => {
    const res = await authorize("Business Plan", role);
    expect(res.statusCode).toBe(403);
    expect(projectAccess).not.toHaveBeenCalled();
  });

  it("denies Pro for an admin", async () => {
    const res = await authorize("Pro", "Admin");
    expect(res.statusCode).toBe(403);
    expect(projectAccess).not.toHaveBeenCalled();
  });

  it("allows a Business admin through both gates", async () => {
    const res = await authorize("Business Plan", "Admin");
    expect(res.statusCode).toBe(200);
    expect(projectAccess).toHaveBeenCalled();
  });
});
