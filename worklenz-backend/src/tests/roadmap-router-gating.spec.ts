import express from "express";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn(), pool: { connect: jest.fn() } } }));
jest.mock("../shared/paddle-utils");
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

import roadmapRouter from "../routes/apis/roadmap-api-router";

type Layer = { route?: { path: string; stack: Array<{ handle: Function; name: string }> } };

describe("roadmap API gating", () => {
  it("protects create-phase, update-phase, and reorder-phases with gantt_edit", () => {
    const stack = (roadmapRouter as unknown as { stack: Layer[] }).stack;
    const mutationPaths = ["/update-task-dates", "/create-task", "/create-phase", "/update-phase", "/reorder-phases"];

    for (const path of mutationPaths) {
      const layer = stack.find((l) => l.route?.path === path);
      expect(layer).toBeDefined();
      expect(layer!.route!.stack.length).toBeGreaterThanOrEqual(3);
    }
  });
});
