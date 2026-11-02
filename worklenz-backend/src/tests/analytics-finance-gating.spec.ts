process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../shared/paddle-utils");
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));
jest.mock("../redis/analytics-cache", () => ({ withLastUpdated: jest.fn() }));
jest.mock("../middlewares/analytics-project-access", () => ({
  __esModule: true, default: jest.fn((_req, _res, next) => next()),
}));
jest.mock("../shared/organization-permissions", () => ({
  ...jest.requireActual("../shared/organization-permissions"),
  hasOrganizationPermission: jest.fn(),
}));

import { RequestHandler } from "express";
import router from "../routes/apis/reporting-analytics-api-router";
import { hasOrganizationPermission } from "../shared/organization-permissions";
import { viewFinanceValidator } from "../middlewares/validators/organization-permission-validator";
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

  async function authorize(plan: string, hasPermission: boolean, role = "Member") {
    (hasOrganizationPermission as jest.Mock).mockResolvedValue(hasPermission);
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

  it.each(["Member", "Team Lead"])("denies %s without View finance before project lookup", async role => {
    const res = await authorize("Business Plan", false, role);
    expect(res.statusCode).toBe(403);
    expect(projectAccess).not.toHaveBeenCalled();
  });

  it("denies Pro even with View finance", async () => {
    const res = await authorize("Pro", true);
    expect(res.statusCode).toBe(403);
    expect(projectAccess).not.toHaveBeenCalled();
  });

  it("allows Business with View finance through both gates", async () => {
    expect(handlers.map(layer => layer.handle)).toContain(viewFinanceValidator);
    const res = await authorize("Business Plan", true);
    expect(res.statusCode).toBe(200);
    expect(projectAccess).toHaveBeenCalled();
  });
});
