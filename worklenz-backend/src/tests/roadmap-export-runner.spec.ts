import { EventEmitter } from "events";
import { Worker } from "worker_threads";
import { prepareRoadmapExport } from "../services/roadmap/roadmap-export";
import { RoadmapExportBusyError, runRoadmapExport } from "../services/roadmap/roadmap-export-runner";

jest.mock("worker_threads", () => ({ Worker: jest.fn() }));

class FakeWorker extends EventEmitter {
  terminate = jest.fn(async () => { this.emit("exit", 1); return 1; });
  finish(value = "file") { this.emit("message", Buffer.from(value)); this.emit("exit", 0); }
}

const workers: FakeWorker[] = [];
const prepared = prepareRoadmapExport({ format: "pdf", group_by: "phase", rows: [] });
if (!prepared.ok) throw new Error("Invalid fixture");
const input = { projectName: "Project", exportedOn: "2026-01-01", export: prepared.value };

beforeEach(() => {
  workers.length = 0;
  (Worker as unknown as jest.Mock).mockImplementation(() => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
});

describe("roadmap export worker limits", () => {
  it("bounds global, user and project concurrency and releases slots on completion", async () => {
    const first = runRoadmapExport("user-a", "project-a", input);
    await expect(runRoadmapExport("user-a", "project-b", input)).rejects.toBeInstanceOf(RoadmapExportBusyError);
    await expect(runRoadmapExport("user-b", "project-a", input)).rejects.toBeInstanceOf(RoadmapExportBusyError);
    const second = runRoadmapExport("user-b", "project-b", input);
    await expect(runRoadmapExport("user-c", "project-c", input)).rejects.toBeInstanceOf(RoadmapExportBusyError);
    workers[0].finish("pdf");
    expect((await first).toString()).toBe("pdf");
    workers[1].finish("xlsx");
    expect((await second).toString()).toBe("xlsx");
    const next = runRoadmapExport("user-a", "project-a", input);
    workers[2].finish();
    await expect(next).resolves.toEqual(Buffer.from("file"));
  });

  it("terminates a cancelled worker and frees its slot", async () => {
    const abort = new AbortController();
    const run = runRoadmapExport("user-a", "project-a", input, abort.signal);
    abort.abort();
    await expect(run).rejects.toThrow("cancelled");
    expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    const next = runRoadmapExport("user-a", "project-a", input);
    workers[1].finish();
    await expect(next).resolves.toEqual(Buffer.from("file"));
  });

  it("releases slots when a worker errors", async () => {
    const run = runRoadmapExport("user-a", "project-a", input);
    workers[0].emit("error", new Error("failed"));
    workers[0].emit("exit", 1);
    await expect(run).rejects.toThrow("failed");
    const next = runRoadmapExport("user-a", "project-a", input);
    workers[1].finish();
    await expect(next).resolves.toEqual(Buffer.from("file"));
  });

  it("terminates a worker that exceeds the time limit", async () => {
    jest.useFakeTimers({ doNotFake: ["performance"] });
    try {
      const run = runRoadmapExport("user-a", "project-a", input);
      const failure = expect(run).rejects.toThrow("timed out");
      jest.advanceTimersByTime(60_000);
      await failure;
      expect(workers[0].terminate).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
