import express from "express";
import { AddressInfo } from "net";
import { request } from "http";

jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn(), pool: { connect: jest.fn() } } }));
jest.mock("../shared/paddle-utils");
jest.mock("../shared/utils", () => ({ log_error: jest.fn() }));

import roadmapRouter from "../routes/apis/roadmap-api-router";

describe("roadmap API gating", () => {
  it.each([
    ["POST", "/update-task-dates"],
    ["POST", "/create-task"],
    ["POST", "/create-phase"],
    ["PUT", "/update-phase"],
    ["POST", "/reorder-phases"],
  ])("denies a Pro user %s %s before project permission checks", async (method, path) => {
    const previousMode = process.env.WORKLENZ_DEPLOYMENT_MODE;
    process.env.WORKLENZ_DEPLOYMENT_MODE = "cloud";
    const app = express();
    app.use((req, _res, next) => {
      Object.assign(req, { user: { subscription_type: "PADDLE", plan_name: "Pro" } });
      next();
    });
    app.use(roadmapRouter);
    const server = app.listen(0, "127.0.0.1");
    try {
      await new Promise<void>((resolve, reject) => {
        server.once("listening", resolve);
        server.once("error", reject);
      });
      const port = (server.address() as AddressInfo).port;
      const status = await new Promise<number | undefined>((resolve, reject) => {
        const req = request({ hostname: "127.0.0.1", port, path, method }, res => {
          res.resume();
          res.on("end", () => resolve(res.statusCode));
        });
        req.on("error", reject);
        req.end();
      });
      expect(status).toBe(403);
    } finally {
      await new Promise<void>(resolve => server.close(() => resolve()));
      if (previousMode === undefined) delete process.env.WORKLENZ_DEPLOYMENT_MODE;
      else process.env.WORKLENZ_DEPLOYMENT_MODE = previousMode;
    }
  });
});
