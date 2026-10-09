import express from "express";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn(), pool: { connect: jest.fn() } } }));
jest.mock("../shared/paddle-utils");
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

import scheduleV1 from "../routes/apis/gannt-apis/schedule-api-router";
import scheduleV2 from "../routes/apis/gannt-apis/schedule-api-v2-router";

type Layer = { route?: { path: string; methods: Record<string, boolean> }; name: string; handle: { name?: string } };

/** Route paths registered before the first non-route middleware that follows the guest check. */
function routesBeforePlannerGate(router: express.Router): string[] {
  const stack = (router as unknown as { stack: Layer[] }).stack;
  const gateIndex = stack.findIndex((layer, index) => !layer.route && index > 0);
  return stack
    .slice(0, gateIndex === -1 ? stack.length : gateIndex)
    .filter((layer) => layer.route)
    .map((layer) => layer.route!.path);
}

function routePaths(router: express.Router): string[] {
  return (router as unknown as { stack: Layer[] }).stack.filter((l) => l.route).map((l) => l.route!.path);
}

describe("schedule API gating", () => {
  it("v2: only working-hours settings and time-off are available without Planner access", () => {
    const open = new Set(routesBeforePlannerGate(scheduleV2));
    expect([...open].sort()).toEqual(["/settings", "/time-off", "/time-off/:id", "/time-off/summary"].sort());
  });

  it("v2: every other route is registered after the gate", () => {
    const all = routePaths(scheduleV2);
    const open = new Set(routesBeforePlannerGate(scheduleV2));
    const gated = all.filter((path) => !open.has(path));
    expect(gated).toEqual(expect.arrayContaining(["/members", "/workload", "/timeline/projects", "/capacity/daily"]));
  });

  it("v1: no route is registered before the gate", () => {
    expect(routesBeforePlannerGate(scheduleV1)).toEqual([]);
  });
});
