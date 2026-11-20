jest.mock("../config/db", () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock("../services/imports-service", () => ({
  __esModule: true,
  default: { getJob: jest.fn(), createJob: jest.fn(), upsertStageTasks: jest.fn(), progress: jest.fn(), updateJobStatus: jest.fn() },
}));
jest.mock("../shared/entitlements/gates", () => ({ canUseFeature: jest.fn() }));

import ImportsController from "../controllers/imports-controller";
import ImportsService from "../services/imports-service";
import ImportIngestionService from "../services/import-ingestion-service";
import { canUseFeature } from "../shared/entitlements/gates";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { ImportJob } from "../services/imports-service";

const invoke = (handler: RequestHandler, body: object = {}) =>
  new Promise<{ status: number; error?: Error }>(resolve => {
    let status = 200;
    const response = {
      status: jest.fn().mockImplementation(function (this: unknown, value: number) { status = value; return this; }),
      send: jest.fn().mockImplementation(() => resolve({ status })),
    };
    const request = { user: { id: "user" }, params: { jobId: "job" }, body };
    const next = (error: Error) =>
      resolve({ status: (error as Error & { status: number }).status, error });
    handler(request as unknown as Request, response as unknown as Response, next as NextFunction);
  });

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(canUseFeature).mockReturnValue(false);
  jest.mocked(ImportsService.getJob).mockResolvedValue({ id: "job", provider: "asana", flow_type: "direct", status: "running" } as ImportJob);
  jest.mocked(ImportsService.progress).mockResolvedValue({} as never);
});

it("denies caller-staged tasks even for a direct provider job", async () => {
  expect((await invoke(ImportsController.saveStageTasks, { tasks: [{ title: "Task" }] })).status).toBe(403);
  expect(ImportsService.upsertStageTasks).not.toHaveBeenCalled();
});

it.each(["CSV", "Csv"])("denies a Free user a %s provider job", async provider => {
  expect((await invoke(ImportsController.create, { provider, flowType: "direct" })).status).toBe(403);
  expect(ImportsService.createJob).not.toHaveBeenCalled();
  jest.mocked(ImportsService.getJob).mockResolvedValue({ id: "job", provider, flow_type: "direct" } as ImportJob);
  expect((await invoke(ImportsController.ingest)).status).toBe(403);
  expect((await invoke(ImportsController.commit)).status).toBe(403);
});

it("denies a case-varied CSV flow even with a direct provider", async () => {
  expect((await invoke(ImportsController.create, { provider: "asana", flowType: "CSV" })).status).toBe(403);
  jest.mocked(ImportsService.getJob).mockResolvedValue({ id: "job", provider: "asana", flow_type: "CSV" } as unknown as ImportJob);
  expect((await invoke(ImportsController.ingest)).status).toBe(403);
  expect((await invoke(ImportsController.commit)).status).toBe(403);
});

it("does not fall back to CSV for an unknown direct provider", async () => {
  await expect(ImportIngestionService.ingest({ id: "job", provider: "unknown", flow_type: "direct" } as ImportJob, { csvText: "title\nTask" }))
    .rejects.toMatchObject({ status: 400 });
  expect(ImportsService.upsertStageTasks).not.toHaveBeenCalled();
});

it("allows committing a direct provider job without CSV access", async () => {
  expect((await invoke(ImportsController.commit)).status).toBe(202);
});
