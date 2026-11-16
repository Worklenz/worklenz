import fs from "fs";
import os from "os";
import path from "path";
import type { Express } from "express";
import { loadAddonRouters, resolveAddonDir, startAddonWorkers, stopAddonWorkers } from "./load-addons";

describe("resolveAddonDir", () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), "worklenz-addons-"));
    fs.mkdirSync(path.join(root, "backend"));
    jest.spyOn(process, "cwd").mockReturnValue(path.join(root, "backend"));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    fs.rmSync(root, { recursive: true, force: true });
  });

  it("finds an add-on in the private add-on repository", () => {
    const addonDir = path.join(root, "addons", "worklenz-addons", "test-addon");
    fs.mkdirSync(addonDir, { recursive: true });
    expect(resolveAddonDir("test-addon")).toBe(addonDir);
  });

  it("prefers a directly installed add-on", () => {
    const direct = path.join(root, "addons", "test-addon");
    fs.mkdirSync(direct, { recursive: true });
    fs.mkdirSync(path.join(root, "addons", "worklenz-addons", "test-addon"), { recursive: true });
    expect(resolveAddonDir("test-addon")).toBe(direct);
  });

  it("returns null for a missing add-on", () => {
    expect(resolveAddonDir("missing-test-addon")).toBeNull();
  });
});

describe("add-on opt-in entry points", () => {
  it("mounts public endpoints and runs lifecycle only for an enabled add-on", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "worklenz-addon-entry-"));
    const addon = path.join(root, "addons", "test-entry");
    fs.mkdirSync(path.join(addon, "backend"), { recursive: true });
    fs.writeFileSync(path.join(addon, "manifest.json"), JSON.stringify({
      id: "test-entry", backend: { publicRoutes: true, webhookRoutes: true, lifecycle: true },
    }));
    fs.writeFileSync(path.join(addon, "backend", "routes.js"), `
      const router = () => {};
      module.exports = { default: router, publicRouter: router, webhookRouter: router,
        start: () => { global.__addonStart = true; }, stop: () => { global.__addonStop = true; } };
    `);
    const globals = global as typeof globalThis & { __addonStart?: boolean; __addonStop?: boolean };
    const previous = process.env.ENABLED_ADDONS;
    const cwd = jest.spyOn(process, "cwd").mockReturnValue(root);
    const use = jest.fn();
    const app = { use } as unknown as Express;
    try {
      process.env.ENABLED_ADDONS = "";
      loadAddonRouters(app);
      expect(use).not.toHaveBeenCalled();
      process.env.ENABLED_ADDONS = "test-entry";
      loadAddonRouters(app);
      expect(use.mock.calls.map(call => call[0])).toEqual([
        "/api/v1/addons/test-entry", "/public/addons/test-entry", "/webhook/addons/test-entry",
      ]);
      startAddonWorkers();
      await Promise.resolve();
      expect(globals.__addonStart).toBe(true);
      await stopAddonWorkers();
      expect(globals.__addonStop).toBe(true);
    } finally {
      if (previous === undefined) delete process.env.ENABLED_ADDONS;
      else process.env.ENABLED_ADDONS = previous;
      delete globals.__addonStart;
      delete globals.__addonStop;
      cwd.mockRestore();
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
